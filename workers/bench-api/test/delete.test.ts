import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

// D1 storage is shared across `it` blocks within this test file (no reset
// between tests), so every id must be unique per test run. Derive them from
// an incrementing counter seeded in beforeEach.
let seq = 0;
function hex(seed: number): string {
  return seed.toString(16).padStart(64, "0");
}

async function insertBundle(
  id: string,
  status: string,
  extra: { title?: string; notes?: string } = {},
) {
  await env.DB.prepare(
    `INSERT INTO bundles (id, uploaded_at, title, notes, host_json, status, r2_key, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(
      id,
      "2026-08-09T00:00:00Z",
      extra.title ?? "",
      extra.notes ?? "",
      "{}",
      status,
      `bundles/${id}.tar.gz`,
    )
    .run();
}

async function insertRecord(opts: {
  cellKey: string;
  runId: string;
  bundleId: string;
  status: string;
  modelId?: string;
  quant?: string;
  lane?: string;
  kind?: string;
  configLabel?: string;
  flagJson?: string | null;
  hostJson?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO records (
      cell_key, run_id, bundle_id, model_id, quant, lane, kind, config_label,
      identity_json, summary_json, telemetry_json, host_json, flag_json, measured_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{"a":1}', '{"b":2}', '{"c":3}', ?, ?, ?, ?)`,
  )
    .bind(
      opts.cellKey,
      opts.runId,
      opts.bundleId,
      opts.modelId ?? "qwen3-30b",
      opts.quant ?? "Q4_K_M",
      opts.lane ?? "rocm",
      opts.kind ?? "tg",
      opts.configLabel ?? "default",
      opts.hostJson ?? '{"gpu":"AMD Strix Halo","mem_gb":128}',
      opts.flagJson ?? null,
      "2026-08-09T01:00:00Z",
      opts.status,
    )
    .run();
}

async function insertProfile(bundleId: string, name: string, status: string) {
  await env.DB.prepare(
    `INSERT INTO profiles (id, name, bundle_id, sha256, toml, status) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(`${bundleId}/${name}`, name, bundleId, "f".repeat(64), "[profile]\nkey = 1\n", status)
    .run();
}

async function insertEval(bundleId: string, model: string, status: string, runId: string) {
  await env.DB.prepare(
    `INSERT INTO evals (run_id, bundle_id, model, task, score, status) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(runId, bundleId, model, "tool-calling", 0.9, status)
    .run();
}

interface Fixture {
  bundleId: string;
  cellKey: string;
  runId: string;
}

let fx: Fixture;

beforeEach(async () => {
  const n = ++seq;
  fx = {
    bundleId: "sha256:" + hex(0xc0000 + n),
    cellKey: "sha256:" + hex(0x10000 + n),
    runId: `run-delete-${n}`,
  };

  // Create a published bundle with record + profile + eval + R2 object
  await insertBundle(fx.bundleId, "published", { title: "Delete Test Bundle" });
  await insertRecord({ cellKey: fx.cellKey, runId: fx.runId, bundleId: fx.bundleId, status: "published" });
  await insertProfile(fx.bundleId, "test-profile", "published");
  await insertEval(fx.bundleId, "qwen3-30b", "published", fx.runId);
  await env.BUNDLES.put(`bundles/${fx.bundleId}.tar.gz`, new Uint8Array([1, 2, 3, 4]));
});

describe("DELETE /v1/bundles/:id", () => {
  it("returns 401 without authorization token", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
    const body = await res.json<{ errors: string[] }>();
    expect(body.errors).toContain("unauthorized");
  });

  it("returns 401 with invalid token", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json<{ errors: string[] }>();
    expect(body.errors).toContain("unauthorized");
  });

  it("returns 404 for unknown bundle id", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/sha256:${"0".repeat(64)}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });
    expect(res.status).toBe(404);
    const body = await res.json<{ errors: string[] }>();
    expect(body.errors).toContain("bundle not found");
  });

  it("soft-deletes a bundle with 200 response", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ deleted: string }>();
    expect(body.deleted).toBe(fx.bundleId);
  });

  it("removes bundle from /v1/roster after delete", async () => {
    // Delete the bundle
    await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });

    // Check roster is empty for this bundle
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    expect(res.status).toBe(200);
    const body = await res.json<{
      generated: string;
      models: { model_id: string; cells: { run_id: string }[] }[];
    }>();
    const group = body.models.find((m) => m.cells.some((c) => c.run_id === fx.runId));
    expect(group).toBeUndefined();
  });

  it("removes profiles from /v1/profiles after delete", async () => {
    // Delete the bundle
    await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });

    // Check profiles endpoint
    const res = await SELF.fetch("https://api.hal0.dev/v1/profiles");
    expect(res.status).toBe(200);
    const body = await res.json<{ profiles: { id: string; bundle_id: string }[] }>();
    const profile = body.profiles.find((p) => p.bundle_id === fx.bundleId);
    expect(profile).toBeUndefined();
  });

  it("removes evals from /v1/evals after delete", async () => {
    // Delete the bundle
    await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });

    // Check evals endpoint
    const res = await SELF.fetch("https://api.hal0.dev/v1/evals?model=qwen3-30b");
    expect(res.status).toBe(200);
    const body = await res.json<{ evals: { run_id: string }[] }>();
    const evalRow = body.evals.find((e) => e.run_id === fx.runId);
    expect(evalRow).toBeUndefined();
  });

  it("returns 404 for GET /v1/bundles/:id after delete", async () => {
    // Delete the bundle
    await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });

    // Try to fetch the bundle
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`);
    expect(res.status).toBe(404);
  });

  it("retains R2 object after delete (archive retained)", async () => {
    // Delete the bundle
    await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.bundleId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-admin-token" },
    });

    // R2 object should still exist
    const obj = await env.BUNDLES.get(`bundles/${fx.bundleId}.tar.gz`);
    expect(obj).toBeDefined();
    const bytes = new Uint8Array(await obj!.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });
});
