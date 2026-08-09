import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { untarGz } from "../src/untar";

const BLOCK = 512;

const DEFAULT_OPTS = { maxMembers: 64, maxMemberBytes: 1 << 20, maxTotalBytes: 1 << 20 };

/** workerd's `atob` decodes base64 -> binary string; convert to real bytes. */
function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function loadFixture(): ArrayBuffer {
  return b64ToArrayBuffer(env.FIXTURE_VALID_TAR_GZ_B64);
}

/** Builds one 512-byte ustar header block. Checksum field is left blank
 * (ASCII spaces) — untarGz doesn't verify it, only real tar tools would care. */
function ustarHeader(name: string, size: number, typeflag: string): Uint8Array {
  const block = new Uint8Array(BLOCK);
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  block.set(nameBytes.subarray(0, 100), 0);
  // mode/uid/gid (100,8)(108,8)(116,8) left zeroed - unused by the parser.
  const sizeOctal = size.toString(8).padStart(11, "0") + "\0";
  block.set(enc.encode(sizeOctal), 124);
  // mtime (136,12) left zeroed - unused by the parser.
  block.fill(0x20, 148, 156); // checksum: 8 spaces, not verified
  block[156] = typeflag.charCodeAt(0);
  block.set(enc.encode("ustar\0"), 257);
  block.set(enc.encode("00"), 263);
  return block;
}

function padToBlock(payload: Uint8Array): Uint8Array {
  const pad = (BLOCK - (payload.byteLength % BLOCK)) % BLOCK;
  const out = new Uint8Array(payload.byteLength + pad);
  out.set(payload, 0);
  return out;
}

function buildTar(entries: { name: string; typeflag: string; content: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    parts.push(ustarHeader(e.name, e.content.byteLength, e.typeflag));
    parts.push(padToBlock(e.content));
  }
  parts.push(new Uint8Array(BLOCK * 2)); // end-of-archive marker
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

async function gzip(bytes: Uint8Array): Promise<ArrayBuffer> {
  const cs = new CompressionStream("gzip");
  const stream = new Response(bytes).body!.pipeThrough(cs);
  return await new Response(stream).arrayBuffer();
}

describe("untarGz", () => {
  it("round-trips the real fixture bundle", async () => {
    const members = await untarGz(loadFixture(), DEFAULT_OPTS);

    for (const name of ["manifest.json", "records.jsonl", "evals.jsonl", "profiles/chat.toml"]) {
      expect(members.has(name)).toBe(true);
      expect(members.get(name)!.byteLength).toBeGreaterThan(0);
    }
  });

  it("throws on a truncated buffer", async () => {
    const full = loadFixture();
    const truncated = full.slice(0, Math.floor(full.byteLength / 2));
    await expect(untarGz(truncated, DEFAULT_OPTS)).rejects.toThrow();
  });

  it("throws 'too many members' when the member-count cap is exceeded", async () => {
    await expect(untarGz(loadFixture(), { ...DEFAULT_OPTS, maxMembers: 1 })).rejects.toThrow(
      "too many members",
    );
  });

  it("throws mentioning 'decompressed size' when maxTotalBytes is exceeded", async () => {
    await expect(untarGz(loadFixture(), { ...DEFAULT_OPTS, maxTotalBytes: 10 })).rejects.toThrow(
      "decompressed size",
    );
  });

  it("throws 'unsafe member name' for a path-traversal entry", async () => {
    const content = new TextEncoder().encode("evil payload");
    const tar = buildTar([{ name: "../evil", typeflag: "0", content }]);
    const body = await gzip(tar);

    await expect(untarGz(body, DEFAULT_OPTS)).rejects.toThrow("unsafe member name");
  });

  it("skips pax 'x' typeflag entries instead of returning them", async () => {
    const paxContent = new TextEncoder().encode("30 mtime=1700000000.0\n");
    const fileContent = new TextEncoder().encode("hello world\n");
    const tar = buildTar([
      { name: "PaxHeaders/hello.txt", typeflag: "x", content: paxContent },
      { name: "hello.txt", typeflag: "0", content: fileContent },
    ]);
    const body = await gzip(tar);

    const members = await untarGz(body, DEFAULT_OPTS);

    expect(members.has("PaxHeaders/hello.txt")).toBe(false);
    expect(members.size).toBe(1);
    expect(new TextDecoder().decode(members.get("hello.txt")!)).toBe("hello world\n");
  });

  it("throws 'bad octal field' when size field contains non-octal digit", async () => {
    const header = ustarHeader("test.txt", 0, "0");
    const enc = new TextEncoder();
    // Replace size field (offset 124, 12 bytes) with "18\0..." (8 is an invalid octal digit)
    const invalidSize = "18\0".padEnd(12, "\0");
    header.set(enc.encode(invalidSize), 124);
    const content = new TextEncoder().encode("test");
    const parts = [header, padToBlock(content), new Uint8Array(BLOCK * 2)];
    const total = parts.reduce((n, p) => n + p.byteLength, 0);
    const tar = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      tar.set(p, off);
      off += p.byteLength;
    }
    const body = await gzip(tar);

    await expect(untarGz(body, DEFAULT_OPTS)).rejects.toThrow("bad octal field");
  });

  it("throws 'unsafe member name' when prefix field contains '..' traversal", async () => {
    // Build a custom header with prefix = ".." and name = "evil"
    const block = new Uint8Array(BLOCK);
    const enc = new TextEncoder();
    block.set(enc.encode("evil"), 0); // name at offset 0
    const sizeOctal = "0".padStart(11, "0") + "\0";
    block.set(enc.encode(sizeOctal), 124); // size
    block.fill(0x20, 148, 156); // checksum: spaces
    block[156] = "0".charCodeAt(0); // typeflag
    block.set(enc.encode("ustar\0"), 257);
    block.set(enc.encode("00"), 263);
    block.set(enc.encode(".."), 345); // prefix with traversal
    const content = new TextEncoder().encode("");
    const parts = [block, padToBlock(content), new Uint8Array(BLOCK * 2)];
    const total = parts.reduce((n, p) => n + p.byteLength, 0);
    const tar = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      tar.set(p, off);
      off += p.byteLength;
    }
    const body = await gzip(tar);

    await expect(untarGz(body, DEFAULT_OPTS)).rejects.toThrow("unsafe member name");
  });
});
