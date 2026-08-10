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
  capsJson?: string | null;
}) {
  await env.DB.prepare(
    `INSERT INTO records (
      cell_key, run_id, bundle_id, model_id, quant, lane, kind, config_label,
      identity_json, summary_json, telemetry_json, host_json, flag_json, measured_at, status,
      caps_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{"a":1}', '{"b":2}', '{"c":3}', ?, ?, ?, ?, ?)`,
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
      opts.capsJson ?? null,
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
  pubBundle: string;
  delBundle: string;
  cellKey: string;
  runOld: string;
  runNew: string;
  runFlagged: string;
  runDeleted: string;
}

let fx: Fixture;

beforeEach(async () => {
  const n = ++seq;
  fx = {
    pubBundle: "sha256:" + hex(0xa0000 + n),
    delBundle: "sha256:" + hex(0xb0000 + n),
    cellKey: "sha256:" + hex(0x10000 + n),
    runOld: `run-old-${n}`,
    runNew: `run-new-${n}`,
    runFlagged: `run-flagged-${n}`,
    runDeleted: `run-deleted-${n}`,
  };

  await insertBundle(fx.pubBundle, "published", { title: "Pub Bundle", notes: "notes here" });
  await insertBundle(fx.delBundle, "deleted", { title: "Deleted Bundle" });

  await insertRecord({ cellKey: fx.cellKey, runId: fx.runOld, bundleId: fx.pubBundle, status: "published" });
  await insertRecord({ cellKey: fx.cellKey, runId: fx.runNew, bundleId: fx.pubBundle, status: "published" });

  await insertRecord({
    cellKey: "sha256:" + hex(0x20000 + n),
    runId: fx.runFlagged,
    bundleId: fx.pubBundle,
    status: "published",
    flagJson: '["implausible"]',
  });

  await insertRecord({
    cellKey: "sha256:" + hex(0x30000 + n),
    runId: fx.runDeleted,
    bundleId: fx.delBundle,
    status: "deleted",
  });

  await insertProfile(fx.pubBundle, "myprofile", "published");
  await insertProfile(fx.delBundle, "deadprofile", "deleted");

  await insertEval(fx.pubBundle, "qwen3-30b", "published", fx.runNew);
  await insertEval(fx.delBundle, "qwen3-30b", "deleted", fx.runDeleted);

  await env.BUNDLES.put(`bundles/${fx.pubBundle}.tar.gz`, new Uint8Array([1, 2, 3, 4]));
});

describe("GET /v1/roster", () => {
  it("returns only newest published row per cell, grouped by model", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    expect(res.status).toBe(200);
    const body = await res.json<{
      generated: string;
      models: { model_id: string; cells: { run_id: string; flagged: boolean }[]; host: unknown; bundle_id: string }[];
    }>();
    const group = body.models.find((m) => m.cells.some((c) => c.run_id.endsWith(`-${seq}`)));
    expect(group).toBeDefined();
    const runIds = group!.cells.map((c) => c.run_id);
    expect(runIds).toContain(fx.runNew);
    expect(runIds).not.toContain(fx.runOld);
    expect(runIds).not.toContain(fx.runDeleted);
    const flagged = group!.cells.find((c) => c.run_id === fx.runFlagged);
    expect(flagged?.flagged).toBe(true);
    const unflagged = group!.cells.find((c) => c.run_id === fx.runNew);
    expect(unflagged?.flagged).toBe(false);
  });

  it("surfaces model caps on the group, not the cell", async () => {
    const n = ++seq;
    await insertRecord({
      cellKey: "sha256:" + hex(0x40000 + n),
      runId: `run-caps-${n}`,
      bundleId: fx.pubBundle,
      status: "published",
      modelId: `caps-model-${n}`,
      capsJson: '["coder","vision"]',
    });

    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    const body = await res.json<{ models: { model_id: string; caps: string[] }[] }>();
    const group = body.models.find((m) => m.model_id === `caps-model-${n}`);
    expect(group?.caps).toEqual(["coder", "vision"]);
  });

  // Row order within a group is not guaranteed to put a caps-bearing row first,
  // so a NULL on the first cell must not decide the whole model has no caps.
  it("takes the first non-empty caps across a model's cells", async () => {
    const n = ++seq;
    const modelId = `mixed-caps-${n}`;
    await insertRecord({
      cellKey: "sha256:" + hex(0x50000 + n),
      runId: `run-nocaps-${n}`,
      bundleId: fx.pubBundle,
      status: "published",
      modelId,
      capsJson: null,
    });
    await insertRecord({
      cellKey: "sha256:" + hex(0x60000 + n),
      runId: `run-hascaps-${n}`,
      bundleId: fx.pubBundle,
      status: "published",
      modelId,
      capsJson: '["mtp"]',
    });

    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    const body = await res.json<{ models: { model_id: string; caps: string[] }[] }>();
    const group = body.models.find((m) => m.model_id === modelId);
    expect(group?.caps).toEqual(["mtp"]);
  });

  it("returns an empty caps array for records with no caps", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    const body = await res.json<{ models: { model_id: string; caps: string[] }[] }>();
    const group = body.models.find((m) => m.model_id === "qwen3-30b");
    expect(group?.caps).toEqual([]);
  });

  it("tolerates malformed caps_json without failing the response", async () => {
    const n = ++seq;
    await insertRecord({
      cellKey: "sha256:" + hex(0x70000 + n),
      runId: `run-badcaps-${n}`,
      bundleId: fx.pubBundle,
      status: "published",
      modelId: `bad-caps-${n}`,
      capsJson: "{not json",
    });

    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    expect(res.status).toBe(200);
    const body = await res.json<{ models: { model_id: string; caps: string[] }[] }>();
    expect(body.models.find((m) => m.model_id === `bad-caps-${n}`)?.caps).toEqual([]);
  });

  it("sets cache-control on roster responses", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=60");
  });
});

describe("GET /v1/cells", () => {
  it("returns all published records including history, filtered", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/cells");
    expect(res.status).toBe(200);
    const body = await res.json<{ cells: { run_id: string }[] }>();
    const runIds = body.cells.map((c) => c.run_id);
    expect(runIds).toContain(fx.runOld);
    expect(runIds).toContain(fx.runNew);
    expect(runIds).not.toContain(fx.runDeleted);
  });

  it("filters by model, lane, kind, config ANDed", async () => {
    const res = await SELF.fetch(
      "https://api.hal0.dev/v1/cells?model=qwen3-30b&lane=rocm&kind=tg&config=default",
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ cells: { run_id: string }[] }>();
    expect(body.cells.map((c) => c.run_id)).toContain(fx.runNew);

    const none = await SELF.fetch("https://api.hal0.dev/v1/cells?model=nonexistent-model");
    const noneBody = await none.json<{ cells: unknown[] }>();
    expect(noneBody.cells).toHaveLength(0);
  });
});

describe("GET /v1/runs/:run_id", () => {
  it("returns parsed JSON fields + bundle info for a published run", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/runs/${fx.runNew}`);
    expect(res.status).toBe(200);
    const body = await res.json<{
      run_id: string;
      records: { identity: unknown; summary: unknown; telemetry: unknown; host: unknown }[];
      bundle: { id: string; title: string; notes: string };
    }>();
    expect(body.run_id).toBe(fx.runNew);
    expect(body.records).toHaveLength(1);
    expect(body.records[0].identity).toEqual({ a: 1 });
    expect(body.records[0].summary).toEqual({ b: 2 });
    expect(body.bundle).toEqual({ id: fx.pubBundle, title: "Pub Bundle", notes: "notes here" });
  });

  it("404s for a run under a deleted bundle", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/runs/${fx.runDeleted}`);
    expect(res.status).toBe(404);
  });

  it("404s for an unknown run", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/runs/no-such-run");
    expect(res.status).toBe(404);
  });
});

describe("GET /v1/bundles/:id", () => {
  it("streams the R2 object for a published bundle", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.pubBundle}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/gzip");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3, 4]);
  });

  it("404s for a deleted bundle even if the R2 object exists", async () => {
    await env.BUNDLES.put(`bundles/${fx.delBundle}.tar.gz`, new Uint8Array([9]));
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/${fx.delBundle}`);
    expect(res.status).toBe(404);
  });

  it("404s for an unknown bundle id", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/bundles/sha256:${"0".repeat(64)}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /v1/profiles", () => {
  it("lists published profiles with models from their bundle's published records", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/profiles");
    expect(res.status).toBe(200);
    const body = await res.json<{
      profiles: { id: string; name: string; bundle_id: string; sha256: string; models: string[] }[];
    }>();
    const p = body.profiles.find((pr) => pr.id === `${fx.pubBundle}/myprofile`);
    expect(p).toBeDefined();
    expect(p!.models).toContain("qwen3-30b");
    expect(body.profiles.find((pr) => pr.id === `${fx.delBundle}/deadprofile`)).toBeUndefined();
  });

  it("fetches raw TOML for a profile by id", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/profiles/${fx.pubBundle}/myprofile`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("[profile]");
  });

  it("404s for a profile under a deleted bundle", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/profiles/${fx.delBundle}/deadprofile`);
    expect(res.status).toBe(404);
  });
});

describe("GET /v1/evals", () => {
  it("filters evals by model and excludes non-published", async () => {
    const res = await SELF.fetch(`https://api.hal0.dev/v1/evals?model=qwen3-30b`);
    expect(res.status).toBe(200);
    const body = await res.json<{ evals: { run_id: string; model: string }[] }>();
    const runIds = body.evals.map((e) => e.run_id);
    expect(runIds).toContain(fx.runNew);
    expect(runIds).not.toContain(fx.runDeleted);
  });
});

describe("CORS", () => {
  it("echoes allow-origin for the site origin", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster", {
      headers: { origin: "https://hal0.dev" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://hal0.dev");
    expect(res.headers.get("vary")).toBe("origin");
  });

  it("echoes allow-origin for a pages.dev preview origin", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster", {
      headers: { origin: "https://preview-123.pages.dev" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://preview-123.pages.dev");
  });

  it("omits allow-origin for a disallowed origin", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster", {
      headers: { origin: "https://evil.example" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("OPTIONS preflight on any /v1 path returns 204 with allow headers", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/roster", {
      method: "OPTIONS",
      headers: { origin: "https://hal0.dev" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://hal0.dev");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type");
  });

  it("read-path 404s include CORS headers for allowed origins", async () => {
    const res = await SELF.fetch("https://api.hal0.dev/v1/runs/no-such-run", {
      headers: { origin: "https://hal0.dev" },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://hal0.dev");
    expect(res.headers.get("vary")).toBe("origin");
  });
});
