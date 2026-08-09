import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, MAX_BODY_BYTES_NO_ARTIFACTS } from "../src/ingest";
import { untarGz } from "../src/untar";

const BLOCK = 512;

/** workerd's `atob` decodes base64 -> binary string; convert to real bytes. */
function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function loadFixtureBytes(): ArrayBuffer {
  return b64ToArrayBuffer(env.FIXTURE_VALID_TAR_GZ_B64);
}

async function loadFixtureMembers(): Promise<Map<string, Uint8Array>> {
  return untarGz(loadFixtureBytes(), {
    maxMembers: 64,
    maxMemberBytes: 1 << 20,
    maxTotalBytes: 1 << 20,
  });
}

/** Builds one 512-byte ustar header block (mirrors test/untar.test.ts). */
function ustarHeader(name: string, size: number, typeflag: string): Uint8Array {
  const block = new Uint8Array(BLOCK);
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  block.set(nameBytes.subarray(0, 100), 0);
  const sizeOctal = size.toString(8).padStart(11, "0") + "\0";
  block.set(enc.encode(sizeOctal), 124);
  block.fill(0x20, 148, 156);
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

function buildTar(entries: { name: string; content: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    parts.push(ustarHeader(e.name, e.content.byteLength, "0"));
    parts.push(padToBlock(e.content));
  }
  parts.push(new Uint8Array(BLOCK * 2));
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

async function buildBody(members: Map<string, Uint8Array>): Promise<ArrayBuffer> {
  const entries = [...members].map(([name, content]) => ({ name, content }));
  return gzip(buildTar(entries));
}

async function sha256hex(data: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalFilesMap(files: Record<string, string>): string {
  const sorted = Object.keys(files).sort();
  return "{" + sorted.map((k) => `${JSON.stringify(k)}:${JSON.stringify(files[k])}`).join(",") + "}";
}

/** Rehashes manifest.files + bundle_id from current member contents (mirrors validate.test.ts). */
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

function post(body: ArrayBuffer, token: string | undefined): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return SELF.fetch("https://api.hal0.dev/v1/bundles", { method: "POST", body, headers });
}

describe("POST /v1/bundles", () => {
  it("rejects a missing token with 401", async () => {
    const res = await post(loadFixtureBytes(), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty("errors");
  });

  it("rejects a bad token with 401", async () => {
    const res = await post(loadFixtureBytes(), "wrong-token");
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty("errors");
  });

  it("publishes a valid fixture bundle, indexes D1, and stores R2 bytes", async () => {
    const fixtureBytes = loadFixtureBytes();
    const res = await post(fixtureBytes, "test-admin-token");
    expect(res.status).toBe(200);
    const body = await res.json<{ bundle_id: string; url: string; records: number }>();
    expect(body.records).toBe(2);
    expect(body.url).toBe("https://hal0.dev/benchmarks");
    expect(body.bundle_id).toMatch(/^sha256:/);

    const bundleRow = await env.DB.prepare(
      "SELECT status, uploader FROM bundles WHERE id = ?",
    )
      .bind(body.bundle_id)
      .first<{ status: string; uploader: string }>();
    expect(bundleRow?.status).toBe("published");
    expect(bundleRow?.uploader).toBe("admin");

    const { results: recordRows } = await env.DB.prepare(
      "SELECT measured_at FROM records WHERE bundle_id = ?",
    )
      .bind(body.bundle_id)
      .all<{ measured_at: string }>();
    expect(recordRows).toHaveLength(2);
    expect(recordRows.map((r) => r.measured_at)).toContain("2026-08-09T01:00:00Z");

    const { results: profileRows } = await env.DB.prepare(
      "SELECT id FROM profiles WHERE bundle_id = ?",
    )
      .bind(body.bundle_id)
      .all();
    expect(profileRows).toHaveLength(1);

    const { results: evalRows } = await env.DB.prepare(
      "SELECT run_id FROM evals WHERE bundle_id = ?",
    )
      .bind(body.bundle_id)
      .all();
    expect(evalRows).toHaveLength(1);

    const r2obj = await env.BUNDLES.get(`bundles/${body.bundle_id}.tar.gz`);
    expect(r2obj).not.toBeNull();
    const stored = await r2obj!.arrayBuffer();
    expect(stored.byteLength).toBe(fixtureBytes.byteLength);
  });

  it("re-uploading the same bundle returns duplicate: true with no new rows", async () => {
    const fixtureBytes = loadFixtureBytes();
    const first = await post(fixtureBytes, "test-admin-token");
    expect(first.status).toBe(200);
    const firstBody = await first.json<{ bundle_id: string }>();

    const countsBefore = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM bundles").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM records").first<{ n: number }>(),
    ]);

    const second = await post(loadFixtureBytes(), "test-admin-token");
    expect(second.status).toBe(200);
    const secondBody = await second.json<{ bundle_id: string; duplicate?: boolean }>();
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.bundle_id).toBe(firstBody.bundle_id);

    const countsAfter = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM bundles").first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM records").first<{ n: number }>(),
    ]);
    expect(countsAfter[0]?.n).toBe(countsBefore[0]?.n);
    expect(countsAfter[1]?.n).toBe(countsBefore[1]?.n);
  });

  it("republishes a deleted bundle on re-upload instead of treating it as a duplicate", async () => {
    const fixtureBytes = loadFixtureBytes();
    const first = await post(fixtureBytes, "test-admin-token");
    expect(first.status).toBe(200);
    const firstBody = await first.json<{ bundle_id: string; records: number }>();

    const del = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${firstBody.bundle_id}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });
    expect(del.status).toBe(200);

    const deletedRow = await env.DB.prepare("SELECT status FROM bundles WHERE id = ?")
      .bind(firstBody.bundle_id)
      .first<{ status: string }>();
    expect(deletedRow?.status).toBe("deleted");

    const rosterAfterDelete = await SELF.fetch("https://api.hal0.dev/v1/roster");
    const rosterAfterDeleteBody = await rosterAfterDelete.json<{
      models: { bundle_id: string }[];
    }>();
    expect(rosterAfterDeleteBody.models.some((m) => m.bundle_id === firstBody.bundle_id)).toBe(
      false,
    );

    const second = await post(loadFixtureBytes(), "test-admin-token");
    expect(second.status).toBe(200);
    const secondBody = await second.json<{
      bundle_id: string;
      republished?: boolean;
      duplicate?: boolean;
      records: number;
    }>();
    expect(secondBody.republished).toBe(true);
    expect(secondBody.duplicate).toBeUndefined();
    expect(secondBody.bundle_id).toBe(firstBody.bundle_id);
    expect(secondBody.records).toBe(firstBody.records);

    const republishedRow = await env.DB.prepare("SELECT status FROM bundles WHERE id = ?")
      .bind(firstBody.bundle_id)
      .first<{ status: string }>();
    expect(republishedRow?.status).toBe("published");

    const { results: recordStatuses } = await env.DB.prepare(
      "SELECT status FROM records WHERE bundle_id = ?",
    )
      .bind(firstBody.bundle_id)
      .all<{ status: string }>();
    expect(recordStatuses.every((r) => r.status === "published")).toBe(true);

    const rosterAfterRepublish = await SELF.fetch("https://api.hal0.dev/v1/roster");
    const rosterAfterRepublishBody = await rosterAfterRepublish.json<{
      models: { bundle_id: string }[];
    }>();
    expect(
      rosterAfterRepublishBody.models.some((m) => m.bundle_id === firstBody.bundle_id),
    ).toBe(true);
  });

  it("rejects a tampered member with 422 and an errors array", async () => {
    const members = await loadFixtureMembers();
    const bytes = members.get("records.jsonl")!;
    const tampered = new Uint8Array(bytes);
    tampered[0] = tampered[0] ^ 0xff; // flip a byte, manifest hash now stale
    members.set("records.jsonl", tampered);
    const body = await buildBody(members);

    const res = await post(body, "test-admin-token");
    expect(res.status).toBe(422);
    const json = await res.json<{ errors: string[] }>();
    expect(Array.isArray(json.errors)).toBe(true);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it("exports MAX_BODY_BYTES / MAX_BODY_BYTES_NO_ARTIFACTS caps as documented", () => {
    expect(MAX_BODY_BYTES).toBe(128 * 1024 * 1024);
    expect(MAX_BODY_BYTES_NO_ARTIFACTS).toBe(64 * 1024 * 1024);
  });

  it("rejects a second bundle reusing a (cell_key, run_id) already published elsewhere", async () => {
    const first = await post(loadFixtureBytes(), "test-admin-token");
    expect(first.status).toBe(200);
    const firstBody = await first.json<{ bundle_id: string }>();

    // Same records.jsonl (same cell_key/run_id pairs), different evals.jsonl content
    // so the recomputed bundle_id differs from the first upload's.
    const members = await loadFixtureMembers();
    members.set("evals.jsonl", new TextEncoder().encode('{"run_id":"ev1","model":"qwen3-30b","task":"tool-calling","score":0.42}\n'));
    await rehash(members);
    const manifest = JSON.parse(new TextDecoder().decode(members.get("manifest.json")!));
    expect(manifest.bundle_id).not.toBe(firstBody.bundle_id);
    const body = await buildBody(members);

    const res = await post(body, "test-admin-token");
    expect(res.status).toBe(422);
    const json = await res.json<{ errors: string[] }>();
    expect(json.errors.join(" ")).toContain("already published");
    expect(json.errors.join(" ")).toContain(firstBody.bundle_id);
  });

  it("ingests a 120-record bundle (collision check spans multiple D1 batches) and reports a truthful duplicate count", async () => {
    const members = await loadFixtureMembers();

    const lines: string[] = [];
    for (let i = 0; i < 120; i++) {
      const cellKey = "sha256:" + (await sha256hex(new TextEncoder().encode(`fixture-cell-${i}`)));
      lines.push(
        JSON.stringify({
          run_id: `2026-08-09T01:00:00Z-big${String(i).padStart(4, "0")}`,
          cell_key: cellKey,
          suite: "roster",
          trigger: "manual",
          identity: {
            model: { id: "qwen3-30b", quant: "Q4_K_M" },
            lane: "rocm",
            workload: { kind: "tg", depth: 2048 },
          },
          host: { name: "fixture-box", gpu: "AMD Strix Halo", mem_gb: 128, hal0_version: "1.0.0" },
          outcome: "ok",
          summary: { decode_ts_med: 42.5, prefill_ts_med: 700.0, ttft_ms_p50: 120.0, ttft_ms_p95: 180.0 },
          telemetry: { vram_peak_mb: 30000, gpu_power_avg_w: 90 },
          schema: 2,
        }),
      );
    }
    members.set("records.jsonl", new TextEncoder().encode(lines.join("\n") + "\n"));
    await rehash(members);

    const first = await post(await buildBody(members), "test-admin-token");
    expect(first.status).toBe(200);
    const firstBody = await first.json<{ bundle_id: string; records: number }>();
    expect(firstBody.records).toBe(120);

    const second = await post(await buildBody(members), "test-admin-token");
    expect(second.status).toBe(200);
    const secondBody = await second.json<{ bundle_id: string; records: number; duplicate?: boolean }>();
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.bundle_id).toBe(firstBody.bundle_id);
    expect(secondBody.records).toBe(120);
  });
});
