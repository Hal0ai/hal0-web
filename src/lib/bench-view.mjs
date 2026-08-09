/**
 * bench-view.mjs — pure, dependency-free view logic for the /benchmarks page.
 *
 * Plain JS + JSDoc (not TS) on purpose: `node --test` imports this module
 * directly for unit tests, and the Astro page imports the exact same file
 * for rendering — no build step, no type-erasure mismatch between the two
 * consumers. See docs/design/2026-08-09-platform-handoff/README.md
 * (§Interactions & behaviour, §6 Leaderboard table) for the source spec.
 *
 * Two data sources feed BenchRow[]:
 *  - normalizeRoster: the committed src/data/model-roster.ts snapshot — one
 *    row per model, already reduced (no lane/workload/depth/variant axes).
 *  - normalizeApiRoster: the live /v1/roster API — one row per (model, cell),
 *    preserving every lane/workload/depth/variant combination so filters and
 *    the "best lane" reduction have real data to work over.
 *
 * Synthetic-data rule (context-brief.md): only fields backed by a real
 * measurement are ever populated. Anything the source doesn't provide stays
 * null — never invented.
 */

/**
 * @typedef {Object} BenchRow
 * @property {string} id
 * @property {string} hfRepo
 * @property {string[]} caps
 * @property {string} params
 * @property {string|null} kv      KV-cache mode; real on snapshot rows, and on
 *                                  API rows only after upgradeRows merges it
 *                                  in from the matching snapshot row — never
 *                                  populated from model.quant (see quant)
 * @property {string|null} quant   API rows only: the model.quant field from
 *                                  /v1/roster (a different axis than kv —
 *                                  quantization, not KV-cache mode)
 * @property {string} spec
 * @property {number|null} gb
 * @property {number|null} dec           decode tok/s
 * @property {number|null} pf            prefill tok/s
 * @property {number|null} acc           accept %
 * @property {string} note
 * @property {boolean} measured
 * @property {string|null} lane          null on snapshot rows (already reduced)
 * @property {number|null} ttftP50
 * @property {number|null} ttftP95
 * @property {Array|null} history        never populated from real sources yet
 * @property {'snapshot'|'api'} source
 * @property {string|null} workload      null on snapshot rows (implies default)
 * @property {number|null} depth         null on snapshot rows (implies default)
 * @property {string|null} variant       null on snapshot rows (implies default)
 * @property {string|null} runId
 * @property {string|null} measuredAt
 * @property {boolean} flagged
 */

/** @typedef {{workload?: string|null, depth?: number|null, variant?: string|null, lane?: string|null, caps?: string[], q?: string}} FacetFilters */

export const DEFAULT_WORKLOAD = 'tg';
export const DEFAULT_DEPTH = 2048;
export const DEFAULT_VARIANT = 'default';
export const DEFAULT_LANE = 'best';

const NUMERIC_KEYS = new Set([
  'gb',
  'dec',
  'pf',
  'acc',
  'ttftP50',
  'ttftP95',
  'depth',
]);

/**
 * Build BenchRow[] from the committed src/data/model-roster.ts snapshot.
 * One row per model. Snapshot rows carry no lane/workload/depth/variant axis
 * (the sweep only ever recorded one configuration per model), so those
 * fields are left null; applyFilters treats null as "matches the default
 * facet value only" (see matchesFacet below).
 *
 * @param {Array<{id:string,hfRepo?:string,caps?:string[],params?:string,kv?:string,spec?:string,gb?:number|null,dec?:number|null,pf?:number|null,acc?:number|null,note?:string,measured?:boolean}>} rosterRows
 * @param {{generatedAt?: string}} [meta]
 * @returns {BenchRow[]}
 */
export function normalizeRoster(rosterRows, meta = {}) {
  return (rosterRows ?? []).map((r) => ({
    id: r.id,
    hfRepo: r.hfRepo ?? '',
    caps: Array.isArray(r.caps) ? r.caps : [],
    params: r.params ?? '—',
    kv: r.kv ?? '',
    spec: r.spec ?? '',
    gb: r.gb ?? null,
    dec: r.dec ?? null,
    pf: r.pf ?? null,
    acc: r.acc ?? null,
    note: r.note ?? '',
    measured: !!r.measured,
    quant: null,
    lane: null,
    ttftP50: null,
    ttftP95: null,
    history: null,
    source: 'snapshot',
    workload: null,
    depth: null,
    variant: null,
    runId: null,
    measuredAt: meta.generatedAt ?? null,
    flagged: false,
  }));
}

/**
 * Build BenchRow[] from the /v1/roster API contract. One row per
 * (model, cell) so callers retain every lane/workload/depth/variant
 * combination for filtering; defaultView() performs the best-lane
 * reduction down to one row per model.
 *
 * Rows with a missing/null/non-string `model_id` are dropped entirely — a
 * roster entry with no model identity can't be shown or joined against the
 * snapshot, so it would only ever render as a broken row.
 *
 * `kv` is left null here: the API's `model.quant` field is quantization,
 * not KV-cache mode, and mapping it into `kv` would silently mislabel the
 * cache mode in the leaderboard/drawer. `quant` carries that value instead;
 * `kv` only becomes real once upgradeRows merges it in from the matching
 * snapshot row.
 *
 * `caps`: the committed snapshot's ids and the live roster's ids live in
 * different namespaces (the snapshot's curated short ids vs. the live
 * roster's full gguf-derived slugs), so upgradeRows' by-id join against the
 * snapshot only accidentally matches a handful of models — nowhere near
 * real capability coverage. When the live payload itself carries a `caps`
 * array per model (an optional contract extension a v1/roster adapter can
 * populate — see bench-live-adapter.mjs), it's read here and preferred by
 * upgradeRows over the snapshot join; a missing/malformed `model.caps`
 * falls back to `[]` (upgradeRows' snapshot-join fallback still applies —
 * never invented).
 *
 * @param {{generated?: string, models?: Array<{model_id: string, quant?: string, caps?: string[], cells?: Array<{lane?: string, kind?: string, depth?: number, config_label?: string, decode_ts_med?: number|null, prefill_ts_med?: number|null, ttft_ms_p50?: number|null, ttft_ms_p95?: number|null, accept_med?: number|null, run_id?: string, measured_at?: string, flagged?: boolean}>}>}} apiJson
 * @returns {BenchRow[]}
 */
export function normalizeApiRoster(apiJson) {
  const rows = [];
  for (const model of apiJson?.models ?? []) {
    if (typeof model.model_id !== 'string' || model.model_id === '') continue;
    const caps = Array.isArray(model.caps) ? model.caps.filter((c) => typeof c === 'string') : [];
    const cells = model.cells ?? [];
    for (const cell of cells) {
      rows.push({
        id: model.model_id,
        hfRepo: '',
        caps,
        params: '—',
        kv: null,
        quant: model.quant ?? null,
        spec: '',
        gb: null,
        dec: cell.decode_ts_med ?? null,
        pf: cell.prefill_ts_med ?? null,
        acc: cell.accept_med ?? null,
        note: '',
        measured: true,
        lane: cell.lane ?? null,
        ttftP50: cell.ttft_ms_p50 ?? null,
        ttftP95: cell.ttft_ms_p95 ?? null,
        history: null,
        source: 'api',
        workload: cell.kind ?? null,
        depth: cell.depth ?? null,
        variant: cell.config_label ?? null,
        runId: cell.run_id ?? null,
        measuredAt: cell.measured_at ?? null,
        flagged: !!cell.flagged,
      });
    }
  }
  return rows;
}

/**
 * A row matches a single-select facet if:
 *  - no filter is active (null/undefined/''), or
 *  - the row's value equals the filter value, or
 *  - the row's value is null (snapshot rows / unset axis) AND the filter
 *    equals that facet's default — snapshot rows only ever match the
 *    default facet values.
 *
 * @param {*} rowValue
 * @param {*} filterValue
 * @param {*} defaultValue
 */
function matchesFacet(rowValue, filterValue, defaultValue) {
  if (filterValue === null || filterValue === undefined || filterValue === '') return true;
  if (rowValue === null || rowValue === undefined) return filterValue === defaultValue;
  return rowValue === filterValue;
}

/**
 * AND across facets, OR within a facet (caps).
 *
 * @param {BenchRow[]} rows
 * @param {FacetFilters} [filters]
 * @returns {BenchRow[]}
 */
export function applyFilters(rows, filters = {}) {
  const { workload = null, depth = null, variant = null, lane = null, caps = [], q = '' } = filters;
  const needle = q ? q.trim().toLowerCase() : '';
  // DEFAULT_LANE ('best') is a UI sentinel for "reduce to the best lane per
  // model" — it is never a literal value stored on row.lane (real lanes are
  // e.g. 'rocm', 'vulkan_radv', or the adapter's 'default' for unlaned
  // cells). Treating it as a facet value to match against would exclude
  // every row (see matchesFacet), so it's normalized to "no lane filter"
  // here; the actual best-lane selection happens downstream in
  // reduceBestLane.
  const effectiveLane = lane === DEFAULT_LANE ? null : lane;
  return (rows ?? []).filter((row) => {
    if (!matchesFacet(row.workload, workload, DEFAULT_WORKLOAD)) return false;
    if (!matchesFacet(row.depth, depth, DEFAULT_DEPTH)) return false;
    if (!matchesFacet(row.variant, variant, DEFAULT_VARIANT)) return false;
    if (!matchesFacet(row.lane, effectiveLane, DEFAULT_LANE)) return false;
    if (caps && caps.length > 0) {
      const rowCaps = row.caps ?? [];
      const hit = caps.some((c) => rowCaps.includes(c));
      if (!hit) return false;
    }
    if (needle) {
      const haystack = `${row.id ?? ''} ${row.hfRepo ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/**
 * Sort rows by a BenchRow key. Numeric columns sort on the raw value; text
 * columns via localeCompare. Nulls always sort last, regardless of
 * direction.
 *
 * @param {BenchRow[]} rows
 * @param {string} key
 * @param {'asc'|'desc'} [dir]
 * @returns {BenchRow[]}
 */
export function sortRows(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  const numeric = NUMERIC_KEYS.has(key);
  return [...(rows ?? [])].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (numeric) return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

/**
 * Decode-speed bucket per the roster legend: fast >=60, mid >=25, slow <25.
 *
 * @param {number|null|undefined} dec
 * @returns {'fast'|'mid'|'slow'|null}
 */
export function bucket(dec) {
  if (dec === null || dec === undefined) return null;
  if (dec >= 60) return 'fast';
  if (dec >= 25) return 'mid';
  return 'slow';
}

/**
 * Reduce a filtered BenchRow[] to one row per model id, keeping whichever
 * row has the highest decode tok/s (nulls treated as -Infinity, so a
 * measured row always beats an unmeasured one). Row order in the output
 * follows first-appearance order in the input. This is the "best lane"
 * reduction both `defaultView` (fixed facets) and the island's live/custom
 * filter views (arbitrary facets) share.
 *
 * @param {BenchRow[]} rows
 * @returns {BenchRow[]}
 */
export function reduceBestLane(rows) {
  /** @type {Map<string, BenchRow>} */
  const best = new Map();
  const order = [];
  for (const row of rows ?? []) {
    const current = best.get(row.id);
    if (!current) {
      best.set(row.id, row);
      order.push(row.id);
      continue;
    }
    const currentDec = current.dec ?? -Infinity;
    const rowDec = row.dec ?? -Infinity;
    if (rowDec > currentDec) {
      best.set(row.id, row);
    }
  }
  return order.map((id) => best.get(id));
}

/**
 * The opinionated default view: tg @ depth 2048, `default` variant, best
 * lane per model — one row per model. On snapshot rows (which carry no
 * lane/workload/depth/variant axis) this is the identity: applyFilters
 * already keeps every row (matchesFacet's null fallback), and each model
 * only has one row to begin with.
 *
 * @param {BenchRow[]} rows
 * @returns {BenchRow[]}
 */
export function defaultView(rows) {
  const filtered = applyFilters(rows, {
    workload: DEFAULT_WORKLOAD,
    depth: DEFAULT_DEPTH,
    variant: DEFAULT_VARIANT,
  });
  return reduceBestLane(filtered);
}

/**
 * Merge caps (and hfRepo/params/gb/kv where the API lacks them) from the
 * snapshot row of the same model id into each API row. The committed
 * snapshot's curated ids and the live roster's full gguf-slug ids live in
 * different namespaces, so this by-id join only accidentally matches a
 * handful of models — real capability coverage instead comes from
 * normalizeApiRoster reading a `caps` array straight off the live payload
 * when the adapter/worker populates one (see its header comment); those
 * payload-sourced caps are preferred here and never clobbered by the
 * snapshot join; only when a row's caps are still empty (no payload caps
 * supplied) does the snapshot join fill them in as a fallback. `kv` has no
 * live-payload source at all (`kv: null` — model.quant is a different axis,
 * see normalizeApiRoster's header comment), so it always relies on this
 * same by-id join — without it, an API-sourced row would never show a kv
 * value the moment the page upgrades from the snapshot to a live fetch.
 *
 * @param {BenchRow[]} snapshotRows
 * @param {BenchRow[]} apiRows
 * @returns {BenchRow[]}
 */
export function upgradeRows(snapshotRows, apiRows) {
  /** @type {Map<string, BenchRow>} */
  const bySnapshotId = new Map((snapshotRows ?? []).map((r) => [r.id, r]));
  return (apiRows ?? []).map((row) => {
    const snap = bySnapshotId.get(row.id);
    if (!snap) return row;
    return {
      ...row,
      caps: row.caps && row.caps.length > 0 ? row.caps : snap.caps ?? row.caps,
      hfRepo: row.hfRepo ? row.hfRepo : snap.hfRepo,
      params: row.params && row.params !== '—' ? row.params : snap.params,
      gb: row.gb ?? snap.gb,
      kv: row.kv ?? snap.kv,
    };
  });
}

/**
 * Choose the /benchmarks leaderboard's server-rendered initial rows and the
 * freshness-badge date, given the committed roster snapshot (ROSTER — the
 * always-available source of truth) and scripts/sync-bench.mjs's prebuild
 * output (src/data/bench-snapshot.json): a live /v1/roster payload synced
 * at build time when api.hal0.dev was reachable, or `{roster: null}` when
 * it wasn't (see that script's header comment — this is the expected state
 * until api.hal0.dev is deployed).
 *
 * When `benchSnapshot.roster` is present, the API payload is normalized,
 * upgraded with the snapshot's caps/hfRepo/params/gb/kv (upgradeRows — the
 * API contract doesn't carry those), and reduced to the same one-row-per-
 * model default view the page always renders; the freshness date becomes
 * the sync's `fetched_at` (still labelled "snapshot" — this ran at build
 * time, not in the visitor's browser). Otherwise this is the identity: the
 * committed ROSTER snapshot, dated `rosterMeta.generatedAt`.
 *
 * @param {Array} rosterRows                                RosterRow[] (ROSTER)
 * @param {{generatedAt?: string}} rosterMeta
 * @param {{fetched_at?: string, roster?: object|null}|null|undefined} benchSnapshot
 * @returns {{rows: BenchRow[], freshnessDate: string|null}}
 */
export function selectInitialRows(rosterRows, rosterMeta = {}, benchSnapshot) {
  const snapshotRows = normalizeRoster(rosterRows, rosterMeta);
  const roster = benchSnapshot?.roster;
  if (roster) {
    const apiRows = normalizeApiRoster(roster);
    const upgraded = upgradeRows(snapshotRows, apiRows);
    return {
      rows: defaultView(upgraded),
      freshnessDate: benchSnapshot?.fetched_at ?? rosterMeta.generatedAt ?? null,
    };
  }
  return { rows: defaultView(snapshotRows), freshnessDate: rosterMeta.generatedAt ?? null };
}

/**
 * Reconstruct the subset of a run's flags that are actually derivable from
 * real per-row fields — never a full, executable `llama-server` invocation.
 * This function used to fabricate a complete command line (a hardcoded
 * model path, `-ngl 99`, sampler constants, a default batch size when the
 * variant didn't say) and present it as the run's resolved flags — that was
 * a synthetic-data-rule violation (context-brief.md: only fields backed by
 * a real measurement/config are ever populated). It now emits only:
 *  - `-c {depth}` when depth is known
 *  - `-ctk/-ctv {kv}` when kv (KV-cache mode) is known — real on snapshot
 *    rows, and on API rows only once upgradeRows has merged it in
 *  - `-b 1024` when the variant label literally encodes the batch size
 *    (`b1024` — not a default assumed for every other variant)
 *  - the speculative-decode flags when spec/variant say so
 * Returns null when none of those fields are populated — callers must show
 * "full flags come from the live API" rather than an empty well, and label
 * whatever this does return as "representative flags (reconstructed)" since
 * it is never the real, complete argv. The real argv (when the live API
 * supplies one) replaces this entirely — see runDetail.
 *
 * @param {BenchRow} row
 * @returns {string|null}
 */
export function buildFlagString(row) {
  const parts = [];
  if (row.depth != null) parts.push(`-c ${row.depth}`);
  if (row.kv) {
    const kvArg = row.kv === 'f16' ? 'f16' : `${row.kv}_0`;
    parts.push(`-ctk ${kvArg}`, `-ctv ${kvArg}`);
  }
  if (row.variant === 'b1024') parts.push('-b 1024');
  if (row.spec === 'draft-mtp' && row.variant !== 'mtp-off') {
    parts.push('--draft-max 4', '--draft-min 1', '--mtp on');
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * @typedef {Object} DrawerModel
 * @property {'snapshot'|'api'} mode
 * @property {string} id
 * @property {{dec:number|null,pf:number|null,ttftP50:number|null,ttftP95:number|null,acc:number|null}} metrics
 * @property {{lane:string|null,variant:string|null,workload:string|null,depth:number|null,kv:string|null,spec:string|null,params:string|null,hfRepo:string|null}} identity
 * @property {string|null} note                snapshot mode only
 * @property {string|null} runId                api mode only
 * @property {string|null} measuredAt           api mode only
 * @property {boolean} flagged                  api mode only
 * @property {string|null} flagString           api mode only
 * @property {boolean} hasHistory                api mode only
 * @property {Array|null} history                api mode only
 */

/**
 * Reduce a BenchRow into everything the run drawer needs to render, without
 * touching the DOM. Snapshot rows (no run identity — `runId` is null) get
 * the reduced view: headline metrics + identity + a note that full detail
 * needs the live API. API rows (real `runId`) get the full set of sections:
 * headline metrics, identity, a resolved flag string, and history (only
 * when the row actually carries history data — never synthesized).
 *
 * @param {BenchRow|null|undefined} row
 * @returns {DrawerModel|null}
 */
export function drawerModel(row) {
  if (!row) return null;
  const mode = row.runId ? 'api' : 'snapshot';
  const metrics = {
    dec: row.dec ?? null,
    pf: row.pf ?? null,
    ttftP50: row.ttftP50 ?? null,
    ttftP95: row.ttftP95 ?? null,
    acc: row.acc ?? null,
  };
  const identity = {
    lane: row.lane ?? null,
    variant: row.variant ?? null,
    workload: row.workload ?? null,
    depth: row.depth ?? null,
    kv: row.kv ?? null,
    spec: row.spec ?? null,
    params: row.params ?? null,
    hfRepo: row.hfRepo ?? null,
  };

  if (mode === 'snapshot') {
    return {
      mode,
      id: row.id,
      metrics,
      identity,
      note: 'full run detail requires the live API',
      runId: null,
      measuredAt: row.measuredAt ?? null,
      flagged: false,
      flagString: null,
      hasHistory: false,
      history: null,
    };
  }

  const hasHistory = Array.isArray(row.history) && row.history.length > 0;
  return {
    mode,
    id: row.id,
    metrics,
    identity,
    note: null,
    runId: row.runId,
    measuredAt: row.measuredAt ?? null,
    flagged: !!row.flagged,
    flagString: buildFlagString(row),
    hasHistory,
    history: hasHistory ? row.history : null,
  };
}

/**
 * Count how many rows in `rows` carry each of `capIds`. Used to label the
 * capability filter pills against the full corpus — per README §Interactions
 * ("Counts on pills reflect the full corpus, not the filtered one"), the
 * counts don't move as the user filters, only when the underlying corpus
 * changes (e.g. the snapshot → live upgrade).
 *
 * @param {BenchRow[]} rows
 * @param {string[]} capIds
 * @returns {Record<string, number>}
 */
export function capCounts(rows, capIds) {
  const counts = Object.fromEntries((capIds ?? []).map((c) => [c, 0]));
  for (const row of rows ?? []) {
    for (const c of row.caps ?? []) {
      if (c in counts) counts[c] += 1;
    }
  }
  return counts;
}

/**
 * Parse the `GET /v1/runs/{run_id}` response into the bundle identity the
 * run drawer's "download bundle" button needs, plus (when present) the
 * REAL resolved argv the run actually used. That endpoint returns
 * `{run_id, records, bundle: {id, title, notes}}` (see bench-api-worker's
 * reads.ts runHandler) — no profile name, so a profile-toml download can't
 * be resolved from this payload (P4 follow-up).
 *
 * Each `records[]` entry carries `identity: safeParse(row.identity_json)` —
 * an opaque JSON blob written by the sweep tool, not a fixed schema this
 * API enforces. When a record's identity carries `config.argv` (an array of
 * strings), that's the real, complete argv the run used, and the caller
 * should replace the reconstructed flag well with it (see buildFlagString's
 * header comment for why that well is a partial reconstruction, not the
 * real thing, until this arrives). The first record with a well-formed
 * `config.argv` wins; malformed/missing identity data yields `argv: null`
 * rather than throwing.
 *
 * @param {*} json
 * @returns {{bundleId: string, title: string|null, argv: string[]|null} | null}
 */
export function runDetail(json) {
  const bundleId = json?.bundle?.id;
  if (typeof bundleId !== 'string' || bundleId === '') return null;
  const title = typeof json.bundle.title === 'string' && json.bundle.title !== '' ? json.bundle.title : null;
  const argv = extractRealArgv(json);
  return { bundleId, title, argv };
}

/**
 * @param {*} json
 * @returns {string[]|null}
 */
function extractRealArgv(json) {
  const records = Array.isArray(json?.records) ? json.records : [];
  for (const record of records) {
    const argv = record?.identity?.config?.argv;
    if (Array.isArray(argv) && argv.length > 0 && argv.every((a) => typeof a === 'string')) {
      return argv;
    }
  }
  return null;
}

/**
 * Bucket an eval score into the pass/fail semantics the evals tab's score
 * bar renders as data, not colour-alone: green ("good"/pass) at >=0.75, red
 * ("bad"/fail) below 0.40, neither in between (the bar and numeric value
 * still render, just without a pass/fail tint).
 *
 * @param {number|null|undefined} score
 * @returns {'good'|'bad'|null}
 */
export function evalScoreBucket(score) {
  if (score === null || score === undefined) return null;
  if (score >= 0.75) return 'good';
  if (score < 0.4) return 'bad';
  return null;
}

/**
 * @typedef {Object} EvalTableRow
 * @property {string} id
 * @property {string[]} caps
 * @property {number|null} dec
 * @property {boolean} hasAnyEval    false → "not evaluated — no tool/coding claim to test"
 * @property {Record<string, number|null>} scores   keyed by task, one entry per `tasks` column
 * @property {number|null} mean      averaged over the tasks this model actually has a score for
 */

/**
 * Reduce the roster (model/caps/decode) and the live `GET /v1/evals`
 * payload (`{evals: [{run_id, model, task, score}]}`) into everything the
 * evals tab table needs to render, without touching the DOM.
 *
 * `hasEvals` distinguishes two very different empty cases:
 *  - `evals` is empty/absent entirely → snapshot mode, or the API hasn't
 *    answered yet. The caller renders the honest empty state ("Eval scores
 *    come from the live API — snapshot mode shows throughput only"), not a
 *    table.
 *  - `evals` has data but a given model has none of it → that model's row
 *    still renders, with `hasAnyEval:false` so the caller can show "not
 *    evaluated — no tool/coding claim to test" instead of a row of dashes.
 *
 * A duplicate (model, task) pair in the payload keeps the last occurrence
 * (array order = payload order); malformed entries (missing model/task, or
 * a non-numeric score) are skipped rather than thrown.
 *
 * @param {BenchRow[]} rows      roster rows (one per model) — supplies id/caps/dec
 * @param {Array<{run_id?: string, model?: string, task?: string, score?: number}>|null|undefined} evals
 * @returns {{tasks: string[], rows: EvalTableRow[], hasEvals: boolean}}
 */
export function evalTable(rows, evals) {
  const hasEvals = Array.isArray(evals) && evals.length > 0;
  if (!hasEvals) {
    return { tasks: [], rows: [], hasEvals: false };
  }

  /** @type {Map<string, Map<string, number>>} */
  const byModel = new Map();
  const taskSet = new Set();
  for (const e of evals) {
    if (!e || typeof e.model !== 'string' || typeof e.task !== 'string' || typeof e.score !== 'number') continue;
    if (Number.isNaN(e.score)) continue;
    taskSet.add(e.task);
    let taskMap = byModel.get(e.model);
    if (!taskMap) {
      taskMap = new Map();
      byModel.set(e.model, taskMap);
    }
    taskMap.set(e.task, e.score);
  }
  const tasks = [...taskSet].sort();

  const outRows = (rows ?? []).map((row) => {
    const taskMap = byModel.get(row.id);
    const hasAnyEval = !!taskMap && taskMap.size > 0;
    const scores = Object.fromEntries(tasks.map((t) => [t, taskMap?.get(t) ?? null]));
    const scored = hasAnyEval ? Object.values(scores).filter((v) => v !== null) : [];
    const mean = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
    return {
      id: row.id,
      caps: row.caps ?? [],
      dec: row.dec ?? null,
      hasAnyEval,
      scores,
      mean,
    };
  });

  return { tasks, rows: outRows, hasEvals: true };
}
