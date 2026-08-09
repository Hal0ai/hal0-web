import { checkAdmin } from "./auth";
import { type Env, errors, json } from "./router";
import { UntarError, untarGz } from "./untar";
import { type EvalRow, type ParsedRecord, ValidationError, type ValidBundle, validateBundle } from "./validate";

/** Hard cap on any request body, regardless of bundle contents. */
export const MAX_BODY_BYTES = 512 * 1024 * 1024;
/** Cap enforced once the manifest is known and `artifacts !== true`. */
export const MAX_BODY_BYTES_NO_ARTIFACTS = 64 * 1024 * 1024;

const UNTAR_OPTS = {
  maxMembers: 4096,
  maxMemberBytes: 128 * 1024 * 1024,
  maxTotalBytes: 768 * 1024 * 1024,
};

const BENCHMARKS_URL = "https://hal0.dev/benchmarks";

function bundleInsert(bundle: ValidBundle, r2Key: string, sizeBytes: number, uploadedAt: string) {
  const m = bundle.manifest;
  return {
    id: bundle.bundleId,
    created_at: m.created_at ?? null,
    uploaded_at: uploadedAt,
    title: m.title ?? "",
    notes: m.notes ?? "",
    host_json: JSON.stringify(m.host ?? {}),
    hal0_version: m.hal0_version ?? "",
    r2_key: r2Key,
    size_bytes: sizeBytes,
  };
}

function recordStatements(env: Env, bundleId: string, records: ParsedRecord[]) {
  return records.map((r) =>
    env.DB.prepare(
      `INSERT INTO records (
        cell_key, run_id, bundle_id, model_id, quant, lane, kind, depth, config_label,
        decode_ts_med, prefill_ts_med, ttft_ms_p50, ttft_ms_p95, accept_med, aggregate_ts,
        identity_json, summary_json, telemetry_json, host_json, flag_json, measured_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
    ).bind(
      r.cellKey,
      r.runId,
      bundleId,
      r.modelId,
      r.quant,
      r.lane,
      r.kind,
      r.depth,
      r.configLabel,
      r.decodeTsMed,
      r.prefillTsMed,
      r.ttftMsP50,
      r.ttftMsP95,
      r.acceptMed,
      r.aggregateTs,
      r.identityJson,
      r.summaryJson,
      r.telemetryJson,
      r.hostJson,
      r.flagJson,
      r.measuredAt,
    ),
  );
}

function profileStatements(
  env: Env,
  bundleId: string,
  profiles: { name: string; sha256: string; toml: string }[],
) {
  return profiles.map((p) =>
    env.DB.prepare(
      `INSERT INTO profiles (id, name, bundle_id, sha256, toml, status) VALUES (?, ?, ?, ?, ?, 'published')`,
    ).bind(`${bundleId}/${p.name}`, p.name, bundleId, p.sha256, p.toml),
  );
}

function evalStatements(env: Env, bundleId: string, evals: EvalRow[]) {
  return evals.map((e) =>
    env.DB.prepare(
      `INSERT INTO evals (run_id, bundle_id, model, task, score, detail_json, status) VALUES (?, ?, ?, ?, ?, ?, 'published')`,
    ).bind(e.runId, bundleId, e.model, e.task, e.score, e.detailJson),
  );
}

/** D1 caps bound params per statement (~100); 40 pairs -> 80 params keeps headroom. */
const COLLISION_CHUNK_SIZE = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Looks up whether any (cell_key, run_id) pair in `bundle.records` is already
 * published under a different bundle. Runs in sequential chunks so a single
 * D1 statement never exceeds the bound-parameter limit.
 */
async function findCollision(
  env: Env,
  bundle: ValidBundle,
): Promise<{ cell_key: string; run_id: string; bundle_id: string } | null> {
  for (const c of chunk(bundle.records, COLLISION_CHUNK_SIZE)) {
    const conditions = c.map(() => "(cell_key = ? AND run_id = ?)").join(" OR ");
    const params = c.flatMap((r) => [r.cellKey, r.runId]);
    const hit = await env.DB.prepare(
      `SELECT cell_key, run_id, bundle_id FROM records WHERE ${conditions} LIMIT 1`,
    )
      .bind(...params)
      .first<{ cell_key: string; run_id: string; bundle_id: string }>();
    if (hit && hit.bundle_id !== bundle.bundleId) return hit;
  }
  return null;
}

export async function ingestHandler(req: Request, env: Env): Promise<Response> {
  if (!(await checkAdmin(req, env))) return errors(["missing or invalid admin token"], 401);

  try {
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return errors(["request body exceeds maximum size"], 413);

    let members: Map<string, Uint8Array>;
    try {
      members = await untarGz(body, UNTAR_OPTS);
    } catch (e) {
      if (e instanceof UntarError) return errors([e.message], 422);
      throw e;
    }

    let bundle: ValidBundle;
    try {
      bundle = await validateBundle(members);
    } catch (e) {
      if (e instanceof ValidationError) return errors(e.errors, 422);
      throw e;
    }

    if (bundle.manifest.artifacts !== true && body.byteLength > MAX_BODY_BYTES_NO_ARTIFACTS) {
      return errors(["request body exceeds cap for a bundle without artifacts"], 413);
    }

    const existing = await env.DB.prepare("SELECT id FROM bundles WHERE id = ?")
      .bind(bundle.bundleId)
      .first<{ id: string }>();
    if (existing) {
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM records WHERE bundle_id = ?",
      )
        .bind(bundle.bundleId)
        .first<{ n: number }>();
      return json({
        bundle_id: bundle.bundleId,
        url: BENCHMARKS_URL,
        records: countRow?.n ?? 0,
        duplicate: true,
      });
    }

    const collision = await findCollision(env, bundle);
    if (collision) {
      return errors(
        [`(${collision.cell_key}, ${collision.run_id}) already published in bundle ${collision.bundle_id}`],
        422,
      );
    }

    const r2Key = `bundles/${bundle.bundleId}.tar.gz`;
    await env.BUNDLES.put(r2Key, body);

    const uploadedAt = new Date().toISOString();
    const b = bundleInsert(bundle, r2Key, body.byteLength, uploadedAt);
    const statements = [
      env.DB.prepare(
        `INSERT INTO bundles (id, created_at, uploaded_at, title, notes, host_json, hal0_version, status, uploader, r2_key, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 'admin', ?, ?)`,
      ).bind(
        b.id,
        b.created_at,
        b.uploaded_at,
        b.title,
        b.notes,
        b.host_json,
        b.hal0_version,
        b.r2_key,
        b.size_bytes,
      ),
      ...recordStatements(env, bundle.bundleId, bundle.records),
      ...profileStatements(env, bundle.bundleId, bundle.profiles),
      ...evalStatements(env, bundle.bundleId, bundle.evals),
    ];

    try {
      await env.DB.batch(statements);
    } catch {
      await env.BUNDLES.delete(r2Key).catch(() => {});
      return errors(["ingest failed, nothing published"], 500);
    }

    return json({ bundle_id: bundle.bundleId, url: BENCHMARKS_URL, records: bundle.records.length });
  } catch (e) {
    console.error("ingestHandler: unexpected error", e);
    return errors(["internal error"], 500);
  }
}
