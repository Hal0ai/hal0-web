import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { untarGz } from "../src/untar";
import { ValidationError, validateBundle } from "../src/validate";

const UNTAR_OPTS = { maxMembers: 64, maxMemberBytes: 1 << 20, maxTotalBytes: 1 << 20 };

/** workerd's `atob` decodes base64 -> binary string; convert to real bytes. */
function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function loadFixtureMembers(): Promise<Map<string, Uint8Array>> {
  const buf = b64ToArrayBuffer(env.FIXTURE_VALID_TAR_GZ_B64);
  return untarGz(buf, UNTAR_OPTS);
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalFilesMap(files: Record<string, string>): string {
  const sorted = Object.keys(files).sort();
  return "{" + sorted.map((k) => `${JSON.stringify(k)}:${JSON.stringify(files[k])}`).join(",") + "}";
}

/**
 * Recomputes manifest.files (sha256 per member, excluding manifest.json
 * itself) and manifest.bundle_id from the current contents of `members`,
 * then re-serializes manifest.json in place. Use this after mutating a
 * member's bytes when the test targets a downstream (post-hash) check
 * rather than the hash-verification step itself.
 */
async function rehash(members: Map<string, Uint8Array>): Promise<void> {
  const manifestRaw = members.get("manifest.json");
  if (!manifestRaw) throw new Error("rehash: manifest.json missing");
  const manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
  const files: Record<string, string> = {};
  for (const [name, data] of members) {
    if (name === "manifest.json") continue;
    files[name] = await sha256hex(data);
  }
  manifest.files = files;
  manifest.bundle_id =
    "sha256:" + (await sha256hex(new TextEncoder().encode(canonicalFilesMap(files))));
  members.set("manifest.json", new TextEncoder().encode(JSON.stringify(manifest)));
}

function setRecordsJsonl(members: Map<string, Uint8Array>, lines: string[]): void {
  members.set("records.jsonl", new TextEncoder().encode(lines.join("\n") + "\n"));
}

function decodeRecordsJsonl(members: Map<string, Uint8Array>): Record<string, unknown>[] {
  const text = new TextDecoder().decode(members.get("records.jsonl")!);
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}

describe("validateBundle", () => {
  it("resolves for the valid fixture with expected shape", async () => {
    const members = await loadFixtureMembers();
    const manifestBefore = JSON.parse(new TextDecoder().decode(members.get("manifest.json")!));

    const result = await validateBundle(members);

    expect(result.bundleId).toBe(manifestBefore.bundle_id);
    expect(result.records).toHaveLength(2);
    expect(result.profiles).toHaveLength(1);
    expect(result.evals).toHaveLength(1);
    for (const r of result.records) expect(r.flagJson).toBeNull();
  });

  it("rejects with 'sha256 mismatch' when a member is tampered without rehashing", async () => {
    const members = await loadFixtureMembers();
    const bytes = members.get("records.jsonl")!;
    const tampered = new Uint8Array(bytes);
    tampered[0] = tampered[0] ^ 0xff; // flip a byte, leave manifest stale
    members.set("records.jsonl", tampered);

    await expect(validateBundle(members)).rejects.toThrow(/sha256 mismatch/);
  });

  it("rejects with 'bundle_id mismatch' when bundle_id is forged", async () => {
    const members = await loadFixtureMembers();
    const manifest = JSON.parse(new TextDecoder().decode(members.get("manifest.json")!));
    manifest.bundle_id = "sha256:" + "0".repeat(64);
    members.set("manifest.json", new TextEncoder().encode(JSON.stringify(manifest)));

    await expect(validateBundle(members)).rejects.toThrow(/bundle_id mismatch/);
  });

  it("rejects with 'unexpected member' for a disallowed member name", async () => {
    const members = await loadFixtureMembers();
    members.set("evil.sh", new TextEncoder().encode("#!/bin/sh\necho pwned\n"));

    await expect(validateBundle(members)).rejects.toThrow(/unexpected member: evil\.sh/);
  });

  it("rejects with 'non-ok record' when a record has outcome: failed", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    records[0].outcome = "failed";
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    await expect(validateBundle(members)).rejects.toThrow(/non-ok record/);
  });

  it("rejects with 'non-finite or non-positive' for a negative decode_ts_med", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    (records[0].summary as Record<string, unknown>).decode_ts_med = -1;
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    await expect(validateBundle(members)).rejects.toThrow(/non-finite or non-positive/);
  });

  it("rejects with 'cell_key format' for a malformed cell_key", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    records[0].cell_key = "nonsense";
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    await expect(validateBundle(members)).rejects.toThrow(/cell_key format/);
  });

  it("resolves but flags an implausible decode_ts_med", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    (records[0].summary as Record<string, unknown>).decode_ts_med = 90000;
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    const result = await validateBundle(members);

    const flagged = result.records.find((r) => r.decodeTsMed === 90000);
    expect(flagged).toBeDefined();
    expect(flagged!.flagJson).toContain("implausible decode_ts_med");
  });

  it("rejects with 'unsupported bundle_schema' when bundle_schema is 2", async () => {
    const members = await loadFixtureMembers();
    const manifest = JSON.parse(new TextDecoder().decode(members.get("manifest.json")!));
    manifest.bundle_schema = 2;
    members.set("manifest.json", new TextEncoder().encode(JSON.stringify(manifest)));

    await expect(validateBundle(members)).rejects.toThrow(/unsupported bundle_schema/);
  });

  it("throws ValidationError with an errors array", async () => {
    const members = await loadFixtureMembers();
    members.set("evil.sh", new TextEncoder().encode("x"));

    let caught: unknown;
    try {
      await validateBundle(members);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).errors.length).toBeGreaterThan(0);
  });

  it("rejects with 'no records in bundle' for empty records.jsonl", async () => {
    const members = await loadFixtureMembers();
    setRecordsJsonl(members, []);
    await rehash(members);

    await expect(validateBundle(members)).rejects.toThrow(/no records in bundle/);
  });

  it("rejects with 'non-finite or non-positive' for negative aggregate_ts", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    (records[0].summary as Record<string, unknown>).aggregate_ts = -5;
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    await expect(validateBundle(members)).rejects.toThrow(/non-finite or non-positive/);
  });

  it("resolves when accept_med is 0 (zero is valid)", async () => {
    const members = await loadFixtureMembers();
    const records = decodeRecordsJsonl(members);
    (records[0].summary as Record<string, unknown>).accept_med = 0;
    setRecordsJsonl(members, records.map((r) => JSON.stringify(r)));
    await rehash(members);

    const result = await validateBundle(members);

    expect(result.records).toHaveLength(2);
    const found = result.records.find((r) => r.acceptMed === 0);
    expect(found).toBeDefined();
  });
});
