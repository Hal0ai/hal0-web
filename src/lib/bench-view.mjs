// src/lib/bench-view.mjs
//
// Pure view-model logic for /benchmarks: decode-speed bucket classification,
// best-lane reduction over live /v1/roster cells, filter application (AND
// across every facet, including a facet's own multi-select — caps requires
// all selected caps to be present, not any), and sort comparators. No DOM,
// no fetch, no Date.now() — safe for node --test and the browser island
// alike. DOM wiring stays in src/pages/benchmarks.astro.
//
// Bucket thresholds and wording match src/components/ModelRoster.astro
// verbatim (fast >= 60, mid >= 25, slow < 25) per the comp handoff README.

export const DECODE_FAST = 60;
export const DECODE_MID = 25;

/**
 * Classify a decode tok/s value into the roster's three-bucket scale.
 * @param {number | null | undefined} v
 * @returns {'fast' | 'mid' | 'slow' | null}
 */
export function decodeBucket(v) {
  if (v == null || typeof v !== 'number' || Number.isNaN(v)) return null;
  if (v >= DECODE_FAST) return 'fast';
  if (v >= DECODE_MID) return 'mid';
  return 'slow';
}

/** Number of filled segments (of 3) in the decode meter for a bucket. */
export function decodeBucketFill(bucket) {
  return { fast: 3, mid: 2, slow: 1 }[bucket] ?? 0;
}

// ── live cell selection (/v1/roster response) ──────────────────────────

/**
 * @typedef {{ cell_key: string, lane: string, kind: string, depth: number,
 *   config_label: string, decode_ts_med: number|null, prefill_ts_med: number|null,
 *   ttft_ms_p50: number|null, ttft_ms_p95: number|null, accept_med: number|null,
 *   run_id: string, measured_at: string, flagged: boolean }} Cell
 */

/**
 * Filter a model's cells to those matching the active workload/depth/variant
 * dimensions. Any filter left `undefined`/`null` is not applied on that
 * dimension (used when a dimension has no snapshot analogue).
 * @param {Cell[]} cells
 * @param {{ kind?: string, depth?: number, configLabel?: string }} [filters]
 */
export function cellsMatching(cells, filters = {}) {
  const { kind, depth, configLabel } = filters;
  return cells.filter((c) => {
    if (kind != null && c.kind !== kind) return false;
    if (depth != null && c.depth !== depth) return false;
    if (configLabel != null && c.config_label !== configLabel) return false;
    return true;
  });
}

/**
 * The workload's primary ranking metric: prefill throughput for a pure
 * prompt-processing workload, decode throughput for everything else (tg,
 * chat, batch, embed, rerank, reuse all read out on decode_ts_med in the
 * comp). Keeps `bestCell` from silently ranking a `pp` sweep on a field
 * that workload rarely populates.
 * @param {string | null | undefined} kind
 */
function primaryMetricKey(kind) {
  return kind === 'pp' ? 'prefill_ts_med' : 'decode_ts_med';
}

/**
 * The cell ranking highest on the workload's primary metric. Cells missing
 * that metric are never preferred over one that has it, but an empty
 * *ranking* (every cell null on the metric — e.g. an embed/rerank sweep
 * that doesn't populate decode_ts_med) still returns the first matching
 * cell rather than nothing: a model measured under the active filter
 * shouldn't vanish from the table just because its primary metric is null.
 * Only a genuinely empty cell set returns null.
 * @param {Cell[]} cells
 * @param {string} [kind]
 */
export function bestCell(cells, kind) {
  if (!cells || !cells.length) return null;
  const key = primaryMetricKey(kind);
  let best = null;
  for (const c of cells) {
    if (c[key] == null) continue;
    if (best == null || c[key] > best[key]) best = c;
  }
  return best ?? cells[0];
}

/**
 * Resolve one cell for a given lane selection: `"best"` (or unset) picks the
 * cell ranking highest on the active workload's primary metric (see
 * `bestCell`); anything else picks the first cell on that exact lane (or
 * null if the model has no cell on that lane).
 * @param {Cell[]} cells
 * @param {string} [lane]
 * @param {string} [kind]
 */
export function cellForLane(cells, lane, kind) {
  if (lane == null || lane === 'best') return bestCell(cells, kind);
  return cells.find((c) => c.lane === lane) ?? null;
}

/**
 * Build one leaderboard row per model from a `/v1/roster` response's
 * `models` array, given the active workload/depth/variant/lane filter.
 * Models with no cell matching the filter are dropped, not shown empty.
 * @param {Array<{model_id: string|null, quant: string, host?: {gpu?: string, mem_gb?: number}, cells: Cell[]}>} models
 * @param {{ kind?: string, depth?: number, configLabel?: string, lane?: string }} filters
 */
export function rowsFromRoster(models, filters = {}) {
  const { kind, depth, configLabel, lane } = filters;
  const rows = [];
  for (const m of models) {
    const matching = cellsMatching(m.cells ?? [], { kind, depth, configLabel });
    const cell = cellForLane(matching, lane, kind);
    if (!cell) continue;
    rows.push({
      id: m.model_id,
      hfRepo: null,
      quant: m.quant ?? null,
      caps: [],
      params: null,
      kv: null,
      spec: null,
      // C1: host.mem_gb is the reference box's RAM, not the model's
      // on-disk size — never surface it as `gb`. Always resolved from the
      // snapshot join (joinSnapshotIdentity); a live row with no snapshot
      // match just shows no gb, rather than a wildly wrong host figure.
      gb: null,
      dec: cell.decode_ts_med,
      pf: cell.prefill_ts_med,
      ttftP50: cell.ttft_ms_p50,
      ttftP95: cell.ttft_ms_p95,
      acc: cell.accept_med,
      lane: cell.lane,
      depth: cell.depth,
      kind: cell.kind,
      variant: cell.config_label,
      runId: cell.run_id,
      cellKey: cell.cell_key ?? null,
      measuredAt: cell.measured_at,
      flagged: !!cell.flagged,
      live: true,
    });
  }
  return rows;
}

/** Unique, sorted dimension values across every cell of every model — drives which segmented controls are enabled and their options. */
export function facetOptions(models) {
  const kinds = new Set();
  const depths = new Set();
  const variants = new Set();
  const lanes = new Set();
  for (const m of models) {
    for (const c of m.cells ?? []) {
      if (c.kind) kinds.add(c.kind);
      if (c.depth != null) depths.add(c.depth);
      if (c.config_label) variants.add(c.config_label);
      if (c.lane) lanes.add(c.lane);
    }
  }
  return {
    kinds: [...kinds].sort(),
    depths: [...depths].sort((a, b) => a - b),
    variants: [...variants].sort(),
    lanes: [...lanes].sort(),
  };
}

// ── snapshot rows (src/data/model-roster.ts) ────────────────────────────

/**
 * Build leaderboard rows from the build-time ROSTER snapshot. Only measured
 * rows are included — the snapshot has no ttft/lane/depth/trend fields, so
 * those stay `null` rather than being invented.
 * @param {Array<Object>} roster
 */
export function rowsFromSnapshot(roster) {
  return roster
    .filter((r) => r.measured)
    .map((r) => ({
      id: r.id,
      hfRepo: r.hfRepo || null,
      quant: null,
      caps: r.caps,
      params: r.params,
      kv: r.kv,
      spec: r.spec,
      gb: r.gb,
      dec: r.dec,
      pf: r.pf,
      ttftP50: null,
      ttftP95: null,
      acc: r.acc,
      lane: null,
      depth: null,
      kind: null,
      variant: null,
      runId: null,
      cellKey: null,
      measuredAt: null,
      flagged: false,
      live: false,
    }));
}

/**
 * Attach static identity fields (hfRepo, caps, params, kv, spec, and a gb
 * fallback) from the build-time snapshot onto live rows keyed by model id —
 * the live payload carries measured results, not model metadata. Rows with
 * no snapshot match are returned unchanged (caps stays empty, not invented).
 * @param {Array<Object>} liveRows
 * @param {Array<Object>} roster
 */
export function joinSnapshotIdentity(liveRows, roster) {
  const byId = new Map(roster.map((r) => [r.id, r]));
  return liveRows.map((row) => {
    const snap = byId.get(row.id);
    if (!snap) return row;
    return {
      ...row,
      hfRepo: row.hfRepo ?? (snap.hfRepo || null),
      caps: row.caps.length ? row.caps : snap.caps,
      params: row.params ?? snap.params,
      kv: row.kv ?? snap.kv,
      spec: row.spec ?? snap.spec,
      gb: row.gb ?? snap.gb,
    };
  });
}

// ── filtering ────────────────────────────────────────────────────────────

/** Keep rows carrying every requested capability (AND across the caps facet). */
export function applyCaps(rows, caps) {
  if (!caps || !caps.length) return rows;
  return rows.filter((r) => caps.every((c) => r.caps.includes(c)));
}

/** Case-insensitive substring match on model id. `id` is string|null per the
 * /v1/roster contract — a null id never matches a non-empty query rather
 * than throwing. */
export function applyQuery(rows, q) {
  if (!q) return rows;
  const needle = q.toLowerCase();
  return rows.filter((r) => String(r.id ?? '').toLowerCase().includes(needle));
}

// ── sorting ──────────────────────────────────────────────────────────────

/**
 * Compare two rows on `key`: numeric fields subtract, everything else uses
 * localeCompare on the string form. Nulls always sort last regardless of
 * direction, so an unmeasured/omitted column never floats to the top on
 * ascending sort.
 * @param {Object} a
 * @param {Object} b
 * @param {string} key
 * @param {1 | -1} dir
 */
export function compareRows(a, b, key, dir) {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  const cmp =
    typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
  return cmp * dir;
}

/** Sort a copy of `rows` by `key` in `dir` (1 asc, -1 desc). */
export function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => compareRows(a, b, key, dir));
}
