import { corsHeaders } from "./cors";
import { type Env, json } from "./router";

const CACHE_HEADER = { "cache-control": "public, s-maxage=60" };

/** JSON response with CORS + edge-cache headers applied — the shared GET wrapper. */
export function publicJson(req: Request, data: unknown, status = 200): Response {
  return json(data, status, { ...corsHeaders(req), ...CACHE_HEADER });
}

function publicHeaders(req: Request, extra: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders(req), ...CACHE_HEADER, ...extra };
}

/** Error response with CORS headers — for public read endpoints that return 404s to browsers. */
function publicErrors(req: Request, msgs: string[], status: number): Response {
  return json({ errors: msgs }, status, corsHeaders(req));
}

function safeParse(text: string | null | undefined): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

interface CurrentCellRow {
  cell_key: string;
  run_id: string;
  bundle_id: string;
  model_id: string | null;
  quant: string | null;
  lane: string | null;
  kind: string | null;
  depth: number | null;
  config_label: string | null;
  decode_ts_med: number | null;
  prefill_ts_med: number | null;
  ttft_ms_p50: number | null;
  ttft_ms_p95: number | null;
  accept_med: number | null;
  measured_at: string | null;
  flag_json: string | null;
  host_json: string | null;
  caps_json: string | null;
}

/** caps_json -> string[]; tolerates NULL, malformed JSON, and non-array payloads. */
function parseCaps(raw: string | null): string[] {
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((c): c is string => typeof c === "string");
}

export async function rosterHandler(req: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT cell_key, run_id, bundle_id, model_id, quant, lane, kind, depth, config_label,
            decode_ts_med, prefill_ts_med, ttft_ms_p50, ttft_ms_p95, accept_med,
            measured_at, flag_json, host_json, caps_json
     FROM current_cells
     ORDER BY model_id, quant, cell_key`,
  ).all<CurrentCellRow>();

  interface ModelGroup {
    model_id: string | null;
    quant: string | null;
    caps: string[];
    cells: unknown[];
    host: { gpu?: unknown; mem_gb?: unknown };
    bundle_id: string;
  }
  const groups = new Map<string, ModelGroup>();
  for (const row of results) {
    const key = `${row.model_id ?? ""} ${row.quant ?? ""}`;
    let g = groups.get(key);
    // First row for a (model_id, quant) group wins the host/bundle_id snapshot used
    // for the whole group; later rows only contribute additional cells.
    if (!g) {
      const host = safeParse(row.host_json) as Record<string, unknown>;
      g = {
        model_id: row.model_id,
        quant: row.quant,
        caps: [],
        cells: [],
        host: { gpu: host.gpu, mem_gb: host.mem_gb },
        bundle_id: row.bundle_id,
      };
      groups.set(key, g);
    }
    // caps describe the MODEL, not the cell, so they sit on the group. Unlike
    // host/bundle_id above this is not first-row-wins: a group's first cell may
    // predate the caps column (NULL) while a later one carries them, and a
    // model showing no capability tags because of row ordering would read as
    // "has no capabilities" rather than "not recorded". First non-empty wins.
    if (g.caps.length === 0) g.caps = parseCaps(row.caps_json);
    g.cells.push({
      cell_key: row.cell_key,
      lane: row.lane,
      kind: row.kind,
      depth: row.depth,
      config_label: row.config_label,
      decode_ts_med: row.decode_ts_med,
      prefill_ts_med: row.prefill_ts_med,
      ttft_ms_p50: row.ttft_ms_p50,
      ttft_ms_p95: row.ttft_ms_p95,
      accept_med: row.accept_med,
      run_id: row.run_id,
      measured_at: row.measured_at,
      flagged: row.flag_json !== null,
    });
  }

  return publicJson(req, {
    generated: new Date().toISOString(),
    models: [...groups.values()],
  });
}

export async function cellsHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const model = url.searchParams.get("model");
  const lane = url.searchParams.get("lane");
  const kind = url.searchParams.get("kind");
  const config = url.searchParams.get("config");

  const conditions = ["status = 'published'"];
  const params: string[] = [];
  if (model) {
    conditions.push("model_id = ?");
    params.push(model);
  }
  if (lane) {
    conditions.push("lane = ?");
    params.push(lane);
  }
  if (kind) {
    conditions.push("kind = ?");
    params.push(kind);
  }
  if (config) {
    conditions.push("config_label = ?");
    params.push(config);
  }

  const { results } = await env.DB.prepare(
    `SELECT cell_key, run_id, bundle_id, model_id, quant, lane, kind, depth, config_label,
            decode_ts_med, prefill_ts_med, ttft_ms_p50, ttft_ms_p95, accept_med,
            measured_at, flag_json
     FROM records
     WHERE ${conditions.join(" AND ")}
     ORDER BY seq DESC
     LIMIT 2000`,
  )
    .bind(...params)
    .all<CurrentCellRow>();

  // Fetched newest-first so the LIMIT keeps the most recent rows; reverse in JS
  // so the response stays oldest-first without dropping newest records.
  const cells = results.reverse().map((row) => ({
    cell_key: row.cell_key,
    run_id: row.run_id,
    bundle_id: row.bundle_id,
    model_id: row.model_id,
    quant: row.quant,
    lane: row.lane,
    kind: row.kind,
    depth: row.depth,
    config_label: row.config_label,
    decode_ts_med: row.decode_ts_med,
    prefill_ts_med: row.prefill_ts_med,
    ttft_ms_p50: row.ttft_ms_p50,
    ttft_ms_p95: row.ttft_ms_p95,
    accept_med: row.accept_med,
    measured_at: row.measured_at,
    flagged: row.flag_json !== null,
  }));

  return publicJson(req, { cells });
}

interface RecordFullRow {
  cell_key: string;
  run_id: string;
  bundle_id: string;
  model_id: string | null;
  quant: string | null;
  lane: string | null;
  kind: string | null;
  depth: number | null;
  config_label: string | null;
  decode_ts_med: number | null;
  prefill_ts_med: number | null;
  ttft_ms_p50: number | null;
  ttft_ms_p95: number | null;
  accept_med: number | null;
  aggregate_ts: number | null;
  identity_json: string;
  summary_json: string;
  telemetry_json: string;
  host_json: string;
  flag_json: string | null;
  measured_at: string | null;
  bundle_title: string;
  bundle_notes: string;
}

export async function runHandler(req: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const runId = params.run_id;
  const { results } = await env.DB.prepare(
    `SELECT r.cell_key, r.run_id, r.bundle_id, r.model_id, r.quant, r.lane, r.kind, r.depth,
            r.config_label, r.decode_ts_med, r.prefill_ts_med, r.ttft_ms_p50, r.ttft_ms_p95,
            r.accept_med, r.aggregate_ts, r.identity_json, r.summary_json, r.telemetry_json,
            r.host_json, r.flag_json, r.measured_at, b.title AS bundle_title, b.notes AS bundle_notes
     FROM records r
     JOIN bundles b ON b.id = r.bundle_id
     WHERE r.run_id = ? AND r.status = 'published' AND b.status = 'published'
     ORDER BY r.seq ASC`,
  )
    .bind(runId)
    .all<RecordFullRow>();

  if (results.length === 0) return publicErrors(req, ["run not found"], 404);

  const records = results.map((row) => ({
    cell_key: row.cell_key,
    run_id: row.run_id,
    bundle_id: row.bundle_id,
    model_id: row.model_id,
    quant: row.quant,
    lane: row.lane,
    kind: row.kind,
    depth: row.depth,
    config_label: row.config_label,
    decode_ts_med: row.decode_ts_med,
    prefill_ts_med: row.prefill_ts_med,
    ttft_ms_p50: row.ttft_ms_p50,
    ttft_ms_p95: row.ttft_ms_p95,
    accept_med: row.accept_med,
    aggregate_ts: row.aggregate_ts,
    identity: safeParse(row.identity_json),
    summary: safeParse(row.summary_json),
    telemetry: safeParse(row.telemetry_json),
    host: safeParse(row.host_json),
    flagged: row.flag_json !== null,
    measured_at: row.measured_at,
  }));

  return publicJson(req, {
    run_id: runId,
    records,
    bundle: {
      id: results[0].bundle_id,
      title: results[0].bundle_title,
      notes: results[0].bundle_notes,
    },
  });
}

export async function bundleHandler(req: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const id = params.id;
  const row = await env.DB.prepare("SELECT r2_key, status FROM bundles WHERE id = ?")
    .bind(id)
    .first<{ r2_key: string; status: string }>();
  if (!row || row.status !== "published") return publicErrors(req, ["bundle not found"], 404);

  const obj = await env.BUNDLES.get(row.r2_key);
  if (!obj) return publicErrors(req, ["bundle not found"], 404);

  return new Response(obj.body, {
    status: 200,
    headers: publicHeaders(req, {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${id.replace(/[^a-zA-Z0-9_.-]/g, "_")}.tar.gz"`,
    }),
  });
}

interface ProfileRow {
  id: string;
  name: string;
  bundle_id: string;
  sha256: string;
  model_id: string | null;
}

export async function profilesHandler(req: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.bundle_id, p.sha256, r.model_id
     FROM profiles p
     LEFT JOIN records r ON r.bundle_id = p.bundle_id AND r.status = 'published'
     WHERE p.status = 'published'
     ORDER BY p.id`,
  ).all<ProfileRow>();

  interface Profile {
    id: string;
    name: string;
    bundle_id: string;
    sha256: string;
    models: string[];
  }
  const byId = new Map<string, Profile>();
  for (const row of results) {
    let p = byId.get(row.id);
    if (!p) {
      p = { id: row.id, name: row.name, bundle_id: row.bundle_id, sha256: row.sha256, models: [] };
      byId.set(row.id, p);
    }
    if (row.model_id && !p.models.includes(row.model_id)) p.models.push(row.model_id);
  }

  return publicJson(req, { profiles: [...byId.values()] });
}

export async function profileByIdHandler(
  req: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const id = `${params.bundle_id}/${params.name}`;
  const row = await env.DB.prepare("SELECT toml FROM profiles WHERE id = ? AND status = 'published'")
    .bind(id)
    .first<{ toml: string }>();
  if (!row) return publicErrors(req, ["profile not found"], 404);

  return new Response(row.toml, {
    status: 200,
    headers: publicHeaders(req, { "content-type": "text/plain; charset=utf-8" }),
  });
}

interface EvalRowOut {
  run_id: string | null;
  model: string | null;
  task: string | null;
  score: number;
}

export async function evalsHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const model = url.searchParams.get("model");

  const conditions = ["status = 'published'"];
  const params: string[] = [];
  if (model) {
    conditions.push("model = ?");
    params.push(model);
  }

  const { results } = await env.DB.prepare(
    `SELECT run_id, model, task, score FROM evals WHERE ${conditions.join(" AND ")} ORDER BY run_id LIMIT 2000`,
  )
    .bind(...params)
    .all<EvalRowOut>();

  return publicJson(req, { evals: results });
}

interface HistoryPointRow {
  ts: string | null;
  decode_ts_med: number | null;
  prefill_ts_med: number | null;
  lane: string | null;
}

/**
 * Time series behind the run drawer's decode-history sparkline.
 *
 * Unlike the roster (which reads current_cells — newest published row per
 * cell), this deliberately reads the full `records` table: the whole point is
 * the trend across successive runs of the same cell, so superseded rows are
 * the data, not noise.
 *
 * Filter contract mirrors CT105's own /api/benchmarks/history — `cell_key` or
 * `model` is required (an unfiltered "history of everything" is a table scan
 * with no caller); `lane`, `kind` and `config` narrow further. The site calls
 * it as ?model=&lane=&kind=tg&config=…; the CLI-shaped ?cell_key= form is
 * supported for parity.
 *
 * `kind` and `config` matter more than they look. A model typically has both
 * pp (prefill) and tg (decode) records under the same model_id and lane, and
 * a pp record has no decode_ts_med at all. Without narrowing, a "decode
 * history" series is half prefill runs — measured against real data, an
 * 8-point response where only 4 points belonged on the graph. Different
 * config_labels are the same apples-to-oranges problem: they are different
 * configurations of the model, not successive measurements of one.
 *
 * Filtering is by these DISPLAY DIMENSIONS rather than by cell_key even
 * though a cell is exactly "one comparable series". A cell_key is
 * content-addressed over engine/image provenance, so an unrelated runner-image
 * bump between two sweeps forks the key and shatters one continuous history
 * into several one-point series. hal0's own dashboard moved off cell_key for
 * this reason. cell_key remains available as an explicit filter for callers
 * that genuinely want that one identity.
 *
 * Ordered oldest-first because that is plot order. The LIMIT therefore has to
 * be applied to the NEWEST rows and reversed in JS, or a model with more than
 * MAX_POINTS runs would silently graph only its ancient history.
 */
const MAX_HISTORY_POINTS = 500;

export async function historyHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const cellKey = url.searchParams.get("cell_key");
  const model = url.searchParams.get("model");
  const lane = url.searchParams.get("lane");
  const kind = url.searchParams.get("kind");
  const config = url.searchParams.get("config");

  if (!cellKey && !model) {
    return publicErrors(req, ["cell_key or model is required"], 400);
  }

  const conditions = ["status = 'published'"];
  const params: string[] = [];
  if (cellKey) {
    conditions.push("cell_key = ?");
    params.push(cellKey);
  }
  if (model) {
    conditions.push("model_id = ?");
    params.push(model);
  }
  if (lane) {
    conditions.push("lane = ?");
    params.push(lane);
  }
  if (kind) {
    conditions.push("kind = ?");
    params.push(kind);
  }
  if (config) {
    conditions.push("config_label = ?");
    params.push(config);
  }

  const { results } = await env.DB.prepare(
    `SELECT measured_at AS ts, decode_ts_med, prefill_ts_med, lane
     FROM records
     WHERE ${conditions.join(" AND ")}
     ORDER BY measured_at DESC, seq DESC
     LIMIT ${MAX_HISTORY_POINTS}`,
  )
    .bind(...params)
    .all<HistoryPointRow>();

  return publicJson(req, {
    cell_key: cellKey,
    model,
    points: results.reverse(),
  });
}
