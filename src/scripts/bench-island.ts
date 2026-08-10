/**
 * bench-island.ts — DOM wiring for the /benchmarks leaderboard: header
 * sort, facet filters, text search, reset, and the progressive
 * snapshot → live upgrade (idle fetch of api.hal0.dev/v1/roster).
 *
 * All decision logic (filtering, sorting, the best-lane reduction, and the
 * snapshot/API row merge) lives in src/lib/bench-view.mjs and is unit
 * tested there (scripts/test/bench-view.test.mjs). This file only reads
 * DOM state into a filters object, calls those pure functions, and paints
 * the result back into the table — one render() path for both the initial
 * hydrate and every subsequent re-render, per
 * docs/design/2026-08-09-platform-handoff/README.md §Interactions.
 *
 * The initial corpus is computed in-bundle via `selectInitialRows(ROSTER,
 * { generatedAt: ROSTER_DATE }, BENCH_SNAPSHOT)` — the exact same call
 * benchmarks.astro makes server-side — rather than reading it back out of
 * a DOM-embedded JSON island. Same function, same inputs, so the two
 * render paths can never drift, and there's no DOM-text taint source
 * flowing into the innerHTML sinks below (CodeQL js/xss-through-dom).
 */
import {
  applyFilters,
  reduceBestLane,
  sortRows,
  bucket,
  defaultView,
  normalizeApiRoster,
  upgradeRows,
  capCounts,
  drawerModel,
  runDetail,
  runFailureMessage,
  liveAgeMinutes,
  liveBadgeText,
  snapshotBadgeText,
  laneGraphColor,
  laneMarkerShape,
  normalizeHistoryPoints,
  sparklineGeometry,
  evalTable,
  evalScoreBucket,
  selectInitialRows,
  DEFAULT_WORKLOAD,
} from '../lib/bench-view.mjs';
import { ROSTER, ROSTER_DATE } from '../data/model-roster';
import BENCH_SNAPSHOT from '../data/bench-snapshot.json';

type DrawerModel = ReturnType<typeof drawerModel>;

interface BenchRow {
  id: string;
  hfRepo: string;
  caps: string[];
  params: string;
  kv: string | null;
  quant: string | null;
  spec: string;
  gb: number | null;
  dec: number | null;
  pf: number | null;
  acc: number | null;
  note: string;
  measured: boolean;
  lane: string | null;
  ttftP50: number | null;
  ttftP95: number | null;
  history: unknown[] | null;
  source: 'snapshot' | 'api';
  workload: string | null;
  depth: number | null;
  variant: string | null;
  runId: string | null;
  measuredAt: string | null;
  flagged: boolean;
  cellKey: string | null;
}

// depth and variant were dropped as filter facets (not just made
// deselectable): the live corpus is effectively single-depth/single-variant,
// so a facet for them was noise rather than a real choice. The underlying
// `depth`/`variant` BenchRow fields are untouched — still real data used
// elsewhere (defaultView's opinionated reduction, the drawer's identity
// chips) — only the interactive filter UI/state for them is gone.
type FacetKey = 'workload' | 'lane';
type Tab = 'leaderboard' | 'evals';

// workload/lane are deselectable: `null` means the facet is off — "all
// values of this dimension", not a literal value to match (see
// bench-view.mjs's applyFilters, which treats a null/unset facet as no
// filter at all). Clicking an already-active segment button clears it back
// to null rather than forcing exactly one value to always be selected.
interface Filters {
  workload: string | null;
  lane: string | null;
  caps: string[];
  q: string;
}

interface EvalEntry {
  run_id?: string;
  model?: string;
  task?: string;
  score?: number;
}

// import.meta.env.PUBLIC_BENCH_API lets a preview/staging deploy point at a
// non-production bench API without a code change; falls back to the real
// api.hal0.dev origin, same as the build-time sync (scripts/sync-bench.mjs's
// HAL0_BENCH_API_URL) and the RunDrawer's static links.
const API_BASE = (import.meta.env.PUBLIC_BENCH_API as string | undefined) ?? 'https://api.hal0.dev';
const API_URL = `${API_BASE}/v1/roster`;
const EVALS_API_URL = `${API_BASE}/v1/evals`;
const RUN_API_BASE = `${API_BASE}/v1/runs`;
const BUNDLE_API_BASE = `${API_BASE}/v1/bundles`;
// /v1/history is part of the worker contract (workers/bench-api registers it
// alongside roster/evals/runs); the dev-preview adapter
// (bench-live-adapter.mjs) also serves it as a passthrough to CT105's own
// /api/benchmarks/history. It stays a soft dependency regardless — see
// fetchRunHistory: a 404/network failure here degrades silently (the graph
// section is simply never inserted), not an error state, so pointing
// PUBLIC_BENCH_API at an older deploy that predates the route is fine.
const HISTORY_API_BASE = `${API_BASE}/v1/history`;
// The roster live-upgrade fetch is the visible, above-the-fold promise (the
// leaderboard itself) — a tight 4s budget keeps a slow/unreachable API from
// leaving the page looking stalled. Evals and the run drawer's supplementary
// lookups are lower-stakes background enhancement, so they keep a slightly
// longer budget.
const ROSTER_FETCH_TIMEOUT_MS = 4000;
const FETCH_TIMEOUT_MS = 5000;
const SORT_KEYS = new Set(['id', 'params', 'lane', 'dec', 'pf', 'ttftP50', 'ttftP95', 'acc', 'gb']);
const LANE_CHIP: Record<string, string> = { rocm: 'dev-rocm', vulkan_radv: 'dev-vulkan' };

// Verbatim from src/components/bench/CapGlyphs.astro's ICONS map — see that
// file's header comment for the provenance rule (lifted from
// ModelRoster.astro, never redrawn). Duplicated here because this file
// renders client-side HTML strings; CapGlyphs.astro only runs server-side.
const CAP_ICONS: Record<string, { label: string; svg: string }> = {
  mtp: {
    label: 'MTP speculative',
    svg: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8.7 1 3 9h3.6l-1 6 6.4-8H9.1z"/></svg>',
  },
  vision: {
    label: 'Vision',
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1 8s2.6-4.6 7-4.6S15 8 15 8s-2.6 4.6-7 4.6S1 8 1 8z"/><circle cx="8" cy="8" r="1.9"/></svg>',
  },
  tools: {
    label: 'Tool-calling',
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 1.6a3.4 3.4 0 0 0-3.2 4.5L1.7 11.4 4 13.7l5.3-5.4a3.4 3.4 0 0 0 4.5-3.2l-2 2-2-2z"/></svg>',
  },
  coding: {
    label: 'Coding',
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 4 1.6 8 5 12"/><polyline points="11 4 14.4 8 11 12"/></svg>',
  },
  reasoning: {
    label: 'Reasoning',
    svg: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1l1.5 4.3L14 7l-4.5 1.7L8 13l-1.5-4.3L2 7l4.5-1.7z"/></svg>',
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

// Focus trap for the modal drawer (README §Interactions "Accessibility"):
// while the drawer is open, Tab/Shift+Tab must cycle only through its own
// focusable elements rather than escaping into the page behind the scrim.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapTabKey(container: HTMLElement, event: KeyboardEvent): void {
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (event.shiftKey) {
    if (active === first || !active || !container.contains(active) || active === container) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !active || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

function capGlyphsHtml(caps: string[]): string {
  const entries = (caps ?? []).filter((c) => CAP_ICONS[c]);
  if (entries.length === 0) return '<span class="capnone">—</span>';
  return `<span class="caps">${entries
    .map((c) => `<span class="cap cap-${c}" title="${CAP_ICONS[c].label}">${CAP_ICONS[c].svg}</span>`)
    .join('')}</span>`;
}

function bucketMeterHtml(dec: number | null): string {
  if (dec === null || dec === undefined) return '<span class="num dim">—</span>';
  const b = bucket(dec);
  const fill: Record<string, number> = { fast: 3, mid: 2, slow: 1 };
  const filled = b ? fill[b] : 0;
  const ticks = [0, 1, 2].map((i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
  return `<span class="decode ${b}" title="${b} · ${dec} tok/s"><span class="meter" aria-hidden="true">${ticks}</span><span class="v num">${dec.toFixed(
    1
  )}</span><span class="sr">${b}</span></span>`;
}

function laneChipClass(lane: string | null): string {
  if (!lane) return 'dev-rocm';
  return LANE_CHIP[lane] ?? 'dev-cpu';
}

function rowHtml(row: BenchRow): string {
  const lane = row.lane ?? 'rocm';
  const kvSpec = `${escapeHtml(row.kv ?? '')}${row.spec && row.spec !== 'none' ? ` · ${escapeHtml(row.spec)}` : ' · —'}`;
  return `<tr data-row-id="${escapeHtml(row.id)}" style="cursor:pointer" tabindex="0" role="button" aria-label="run details for ${escapeHtml(row.id)}">
    <td class="model mid"><span class="mname">${escapeHtml(row.id)}</span><span class="msub">${escapeHtml(
    row.hfRepo || 'local / auto-scan'
  )}</span></td>
    <td>${capGlyphsHtml(row.caps)}</td>
    <td>${escapeHtml(row.params)}</td>
    <td>${kvSpec}</td>
    <td><span class="chip ${laneChipClass(row.lane)}">${escapeHtml(lane)}</span></td>
    <td class="n">${bucketMeterHtml(row.dec)}</td>
    <td class="n">${row.pf != null ? row.pf.toFixed(0) : '—'}</td>
    <td class="n">${row.ttftP50 != null ? `${row.ttftP50} ms` : '—'}</td>
    <td class="n dim">${row.ttftP95 != null ? row.ttftP95 : '—'}</td>
    <td class="n">${row.acc != null ? `${row.acc}%` : '—'}</td>
    <td class="n">${row.gb != null ? row.gb : '—'}</td>
    <td class="dim trend-cell">—</td>
  </tr>`;
}

// ── evals tab ───────────────────────────────────────────────────────────
// API-only content (no snapshot equivalent for task scores), built entirely
// client-side from evalTable() — see benchmarks.astro's #panel-evals for
// the empty-state shell the server renders while this is unpopulated.

function evalsTheadHtml(tasks: string[]): string {
  const taskHeaders = tasks.map((t) => `<th class="n">${escapeHtml(t)}</th>`).join('');
  return `<tr><th class="model">model</th><th>caps</th><th class="n">decode</th>${taskHeaders}<th class="n">mean</th></tr>`;
}

function evalScoreCellHtml(score: number | null): string {
  if (score === null || score === undefined) return '<td class="n dim">—</td>';
  const b = evalScoreBucket(score);
  const fillClass = b ? ` ${b}` : '';
  const pct = Math.max(0, Math.min(100, score * 100));
  const srLabel = b === 'good' ? 'pass' : b === 'bad' ? 'fail' : 'borderline';
  return `<td class="n"><span class="evalbar"><span class="track"><span class="fill${fillClass}" style="width:${pct}%"></span></span><span class="num" style="font-size:11px">${score.toFixed(
    2
  )}</span><span class="sr">${srLabel}</span></span></td>`;
}

function evalRowHtml(row: ReturnType<typeof evalTable>['rows'][number], tasks: string[]): string {
  const head = `<td class="model mid"><span class="mname">${escapeHtml(row.id)}</span></td>
    <td>${capGlyphsHtml(row.caps)}</td>
    <td class="n">${bucketMeterHtml(row.dec)}</td>`;
  if (!row.hasAnyEval) {
    return `<tr>${head}<td class="dim" colspan="${tasks.length + 1}">not evaluated — no tool/coding claim to test</td></tr>`;
  }
  const cells = tasks.map((t) => evalScoreCellHtml(row.scores[t])).join('');
  const meanClass = row.mean === null ? ' dim' : row.mean >= 0.7 ? ' eval-mean ok' : '';
  const meanValue = row.mean !== null ? row.mean.toFixed(2) : '—';
  return `<tr>${head}${cells}<td class="n${meanClass}">${meanValue}</td></tr>`;
}

// ── run drawer ──────────────────────────────────────────────────────────
// Section builders for #run-drawer-body. All data-derived strings go
// through escapeHtml before interpolation (identity fields, flag string,
// run id) — the only exceptions are values that are provably numeric
// (metrics, sparkline coordinates) or come from a fixed literal (the
// throttle banner text). See RunDrawer.astro's header comment for why
// this content is built here (client-side innerHTML) rather than in a
// scoped Astro component.

const WARN_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2 1.4 14h13.2z"/><path d="M8 6.4v3.4"/><circle cx="8" cy="11.6" r=".2" fill="currentColor"/></svg>';

function drawerMetricsHtml(metrics: NonNullable<DrawerModel>['metrics']): string {
  const ttft =
    metrics.ttftP50 != null
      ? `${metrics.ttftP50}${metrics.ttftP95 != null ? ` <span class="u">/ ${metrics.ttftP95} ms</span>` : ' <span class="u">ms</span>'}`
      : '—';
  return `<div class="dr-metrics">
    <div><div class="label">decode</div>${bucketMeterHtml(metrics.dec)}</div>
    <div><div class="label">prefill</div><div class="stat">${
      metrics.pf != null ? metrics.pf.toFixed(1) : '—'
    } <span class="u">tok/s</span></div></div>
    <div><div class="label">ttft p50 / p95</div><div class="stat">${ttft}</div></div>
    <div><div class="label">accept rate</div><div class="stat">${metrics.acc != null ? `${metrics.acc}%` : '—'}</div></div>
  </div>`;
}

function drawerIdentityHtml(identity: NonNullable<DrawerModel>['identity'], cellKey: string | null): string {
  const workload =
    identity.workload != null
      ? `${escapeHtml(identity.workload)}${identity.depth != null ? ` · depth ${identity.depth}` : ''}`
      : '—';
  const lane = identity.lane
    ? `<span class="chip ${laneChipClass(identity.lane)}">${escapeHtml(identity.lane)}</span>`
    : '—';
  const rows: Array<[string, string]> = [
    ['lane', lane],
    ['variant', identity.variant ? escapeHtml(identity.variant) : '—'],
    ['workload', workload],
    ['kv cache', identity.kv ? escapeHtml(identity.kv) : '—'],
    ['speculative', identity.spec && identity.spec !== 'none' ? escapeHtml(identity.spec) : '—'],
    ['params', identity.params ? escapeHtml(identity.params) : '—'],
    ['hf repo', identity.hfRepo ? escapeHtml(identity.hfRepo) : '—'],
  ];
  // cell_key (the dedup key a run's records are keyed by — see
  // runDetail's header comment) truncated to ~16 chars per the dashboard's
  // own RunDetail chip convention (Benchmarks.tsx), full value in `title`
  // since it's the thing "link to this run" / the bundle API actually key
  // off of.
  if (cellKey) {
    const short = cellKey.length > 16 ? `${cellKey.slice(0, 16)}…` : cellKey;
    rows.push(['cell', `<span title="${escapeHtml(cellKey)}">${escapeHtml(short)}</span>`]);
  }
  return `<section id="run-drawer-identity">
    <h4 class="label">identity</h4>
    <dl class="kv">${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`).join('')}</dl>
  </section>`;
}

// The flag well starts as a partial reconstruction from real row fields
// (buildFlagString — never a fabricated full command line, see its header
// comment) labelled honestly as such. resolveBundleLink() below swaps the
// label + body for the REAL resolved argv (and drops the "(reconstructed)"
// qualifier) once GET /v1/runs/{run_id} answers with one.
function drawerFlagsHtml(flagString: string | null): string {
  const body = flagString ? escapeHtml(flagString) : '— full flags come from the live API';
  return `<section>
    <div class="dr-sec-head">
      <h4 class="label" id="run-drawer-flags-label">representative flags (reconstructed)</h4>
      <button type="button" class="btn ghost sm" id="run-drawer-copy-flags" data-copy-flags>copy</button>
    </div>
    <pre class="well argv" id="run-drawer-flags-well">${body}</pre>
  </section>`;
}

function drawerThrottleHtml(): string {
  return `<section>
    <h4 class="label">telemetry</h4>
    <div class="banner warn">${WARN_SVG}<span>Numbers are a floor, not a ceiling.</span></div>
  </section>`;
}

// drawerModel.hasHistory/row.history stay unused — no data path populates
// BenchRow.history yet (see bench-view.mjs's typedef). The graph below is a
// SEPARATE data path: a per-request fetch of the proposed
// `/v1/history?model=&lane=` endpoint (see fetchRunHistory), not
// drawerModel's `history` field.

const SPARK_ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const svgEsc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => SPARK_ESC_MAP[c]);

// Marker shape ported verbatim from the dashboard's Marker component —
// circle=rocm, square=vulkan_radv, triangle for anything else (see
// laneMarkerShape's header comment: color is never the only lane signal).
function markerSvg(shape: 'circle' | 'square' | 'triangle', cx: number, cy: number, r: number, fill: string, title: string): string {
  const t = `<title>${svgEsc(title)}</title>`;
  if (shape === 'square') {
    return `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" fill="${fill}">${t}</rect>`;
  }
  if (shape === 'triangle') {
    const pts = `${cx.toFixed(1)},${(cy - r * 1.3).toFixed(1)} ${(cx - r * 1.15).toFixed(1)},${(cy + r).toFixed(1)} ${(cx + r * 1.15).toFixed(1)},${(cy + r).toFixed(1)}`;
    return `<polygon points="${pts}" fill="${fill}">${t}</polygon>`;
  }
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}">${t}</circle>`;
}

// Ported from the dashboard's Sparkline component (see bench-view.mjs's
// sparklineGeometry for the full rationale): decode solid, prefill dashed,
// both in the lane's color, lane identity backed by marker shape too. Every
// interpolation here is a number that already passed
// normalizeHistoryPoints'/sparklineGeometry's own validation (never a raw
// API string), consistent with the rest of the drawer's escape-everything
// discipline — svgEsc still wraps the one text value (the tooltip title).
function drawerGraphHtml(geometry: ReturnType<typeof sparklineGeometry>, lane: string | null): string {
  const color = laneGraphColor(lane);
  const shape = laneMarkerShape(lane);
  const { width, height } = geometry;
  let body: string;
  if ('empty' in geometry) {
    return ''; // caller never inserts this — see fetchRunHistory
  } else if ('single' in geometry) {
    const parts: string[] = [];
    if (geometry.prefill) {
      parts.push(markerSvg(shape, geometry.prefill.x, geometry.prefill.y, 4, 'none', `prefill ${fmtNum(geometry.prefill.v)} t/s`));
    }
    if (geometry.decode) {
      parts.push(markerSvg(shape, geometry.decode.x, geometry.decode.y, 2.5, color, `decode ${fmtNum(geometry.decode.v)} t/s`));
      parts.push(
        `<text x="${(width / 2).toFixed(1)}" y="${(height / 2 - 9).toFixed(1)}" text-anchor="middle" fill="var(--fg-3)" font-size="9">${svgEsc(geometry.decode.v.toFixed(1))}</text>`,
      );
    }
    body = parts.join('');
  } else {
    const decodeMarkers = geometry.decodeMarkers
      .map((m) => markerSvg(shape, m.x, m.y, 1.7, color, `${fmtNum(m.v)} t/s`))
      .join('');
    const prefillPath = geometry.prefillPath
      ? `<path d="${geometry.prefillPath}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.75" />`
      : '';
    const decodePath = geometry.decodePath ? `<path d="${geometry.decodePath}" fill="none" stroke="${color}" stroke-width="1.5" />` : '';
    const scaleLabels =
      geometry.decodeMax != null && geometry.decodeMin != null
        ? `<text x="6" y="10" fill="var(--fg-4)" font-size="8">${svgEsc(fmtNum(geometry.decodeMax))}</text><text x="6" y="${(height - 1).toFixed(1)}" fill="var(--fg-4)" font-size="8">${svgEsc(fmtNum(geometry.decodeMin))}</text>`
        : '';
    body = `${prefillPath}${decodePath}${decodeMarkers}${scaleLabels}`;
  }
  return `<section id="run-drawer-graph">
    <h4 class="label">decode history${lane ? ` · ${escapeHtml(lane)} lane` : ''}</h4>
    <div class="well" style="padding:8px 10px">
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="decode throughput history">${body}</svg>
    </div>
  </section>`;
}

function fmtNum(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) : '—';
}

// Profile-TOML download is dropped: the API's GET /v1/runs/{run_id} payload
// carries `{run_id, records, bundle: {id, title, notes}}` — no profile
// name, and a profile TOML can't be resolved without one. Needs the API to
// surface a profile name in the run/records payload first — P4 follow-up.
function drawerProvenanceHtml(model: NonNullable<DrawerModel>): string {
  const runId = model.runId ?? '';
  const encodedRunId = encodeURIComponent(runId);
  const measured = model.measuredAt ? `measured ${escapeHtml(model.measuredAt)}` : '';
  return `<section>
    <h4 class="label">provenance</h4>
    <p class="site-sm">run <span class="mono">${escapeHtml(runId)}</span>${measured ? ` · ${measured}` : ''}</p>
    <div class="dr-actions">
      <a class="btn" href="${RUN_API_BASE}/${encodedRunId}" rel="noopener">view run json</a>
      <a class="btn ghost" id="run-drawer-bundle-btn" href="#" aria-disabled="true" title="bundle lookup unavailable" data-run-id="${escapeHtml(
        runId
      )}" rel="noopener">download bundle</a>
      <button type="button" class="btn ghost" id="run-drawer-copy-link" data-copy-link="${escapeHtml(model.id)}">link to this run</button>
    </div>
    <p class="site-sm dim" id="run-drawer-fetch-status" hidden></p>
  </section>`;
}

function drawerBodyHtml(model: NonNullable<DrawerModel>): string {
  const parts = [drawerMetricsHtml(model.metrics), drawerIdentityHtml(model.identity, model.cellKey)];
  if (model.mode === 'api') {
    parts.push(drawerFlagsHtml(model.flagString));
    if (model.flagged) parts.push(drawerThrottleHtml());
    parts.push(drawerProvenanceHtml(model));
  } else {
    parts.push(`<section><p class="site-sm dim">${escapeHtml(model.note ?? '')}</p></section>`);
  }
  return parts.join('');
}

function scheduleIdle(cb: () => void) {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(cb, { timeout: 3000 });
  } else {
    setTimeout(cb, 200);
  }
}

function init() {
  const root = document.getElementById('bench-filters');
  const tbody = document.getElementById('bench-tbody');
  const table = document.getElementById('bench-table');
  if (!root || !tbody || !table) return;

  const { rows: snapshotRows } = selectInitialRows(ROSTER, { generatedAt: ROSTER_DATE }, BENCH_SNAPSHOT) as {
    rows: BenchRow[];
  };

  const countEl = document.getElementById('bench-count');
  const resetBtn = document.getElementById('bench-reset');
  const emptyResetBtn = document.getElementById('bench-empty-reset');
  const emptyPanel = document.getElementById('bench-empty');
  const tablescroll = document.querySelector<HTMLElement>('#panel-leaderboard .tablescroll');
  const bucketLegend = document.querySelector<HTMLElement>('#panel-leaderboard .bucket-legend');
  const searchInput = document.getElementById('bench-search') as HTMLInputElement | null;
  const freshnessEl = document.getElementById('bench-freshness');
  const freshnessDot = freshnessEl?.querySelector<HTMLElement>('.dot') ?? null;
  const freshnessText = document.getElementById('bench-freshness-text');
  const capButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.fbar[data-facet="caps"] .fpill'));
  const facetSegs = Array.from(root.querySelectorAll<HTMLElement>('.seg[data-facet]'));
  const sortHeaders = Array.from(table.querySelectorAll<HTMLTableCellElement>('th[data-sort-key]'));

  const drawerScrim = document.getElementById('run-drawer-scrim');
  const drawerEl = document.getElementById('run-drawer');
  const drawerTitle = document.getElementById('run-drawer-title');
  const drawerBody = document.getElementById('run-drawer-body');
  const drawerCloseBtn = document.getElementById('run-drawer-close');

  const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs [role="tab"]'));
  const leaderboardPanel = document.getElementById('panel-leaderboard');
  const evalsPanel = document.getElementById('panel-evals');
  const evalsTablescroll = document.getElementById('evals-tablescroll');
  const evalsEmpty = document.getElementById('evals-empty');
  const evalsThead = document.getElementById('evals-thead');
  const evalsTbody = document.getElementById('evals-tbody');

  // Mobile toolbar (README §Screens 2.10) — filters + sort collapse behind
  // these two controls below 820px; see the <style> block in
  // benchmarks.astro for the breakpoint.
  const filtersToggleBtn = document.getElementById('bench-filters-toggle');
  const filterCountEl = document.getElementById('bench-filter-count');
  const sortToggleBtn = document.getElementById('bench-sort-toggle');
  const sortLabelEl = document.getElementById('bench-sort-label');
  const sortMenu = document.getElementById('bench-sort-menu');
  const sortMenuButtons = Array.from(
    sortMenu?.querySelectorAll<HTMLButtonElement>('button[data-sort-key]') ?? [],
  );

  // The opinionated default: workload=tg, lane off (best lane per model).
  // "reset to default view" returns here — everything else (depth, variant,
  // an off lane) is the widest-possible view, not a facet with its own
  // default value to reset to.
  const DEFAULT_FILTERS: Filters = {
    workload: DEFAULT_WORKLOAD,
    lane: null,
    caps: [],
    q: '',
  };

  const state = {
    corpus: snapshotRows as BenchRow[],
    filters: { ...DEFAULT_FILTERS, caps: [] as string[] },
    sort: { key: null as string | null, dir: 'desc' as 'asc' | 'desc' },
    tab: 'leaderboard' as Tab,
    evals: [] as EvalEntry[],
  };

  // Labels for the mobile "sort · <key>" button/menu — mirrors the desktop
  // column headers' th-label text. `null` (unsorted / natural roster
  // order) reads as "decode" per README §Screens 2.10's own example label,
  // since decode throughput is the leaderboard's default focus metric.
  const SORT_LABELS: Record<string, string> = {
    id: 'model',
    params: 'params',
    lane: 'lane',
    dec: 'decode',
    pf: 'prefill',
    ttftP50: 'ttft p50',
    ttftP95: 'p95',
    acc: 'accept',
    gb: 'gb',
  };

  function activeFilterCount(): number {
    let n = 0;
    if (state.filters.workload !== DEFAULT_FILTERS.workload) n++;
    if (state.filters.lane !== DEFAULT_FILTERS.lane) n++;
    n += state.filters.caps.length;
    if (state.filters.q) n++;
    return n;
  }

  function setSort(key: string) {
    if (!SORT_KEYS.has(key)) return;
    if (state.sort.key === key) {
      state.sort.dir = state.sort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      state.sort.key = key;
      state.sort.dir = 'desc';
    }
    render();
  }

  function closeSortMenu() {
    if (!sortMenu || !sortToggleBtn) return;
    sortMenu.hidden = true;
    sortToggleBtn.setAttribute('aria-expanded', 'false');
  }

  function viewFor(corpus: BenchRow[]): BenchRow[] {
    const filtered = applyFilters(corpus, state.filters);
    const reduced = reduceBestLane(filtered);
    return state.sort.key ? sortRows(reduced, state.sort.key, state.sort.dir) : reduced;
  }

  function currentView(): BenchRow[] {
    return viewFor(state.corpus);
  }

  function render() {
    const view = currentView();
    tbody!.innerHTML = view.map(rowHtml).join('');

    const isEmpty = view.length === 0;
    if (tablescroll) tablescroll.hidden = isEmpty;
    if (bucketLegend) bucketLegend.hidden = isEmpty;
    if (emptyPanel) emptyPanel.hidden = !isEmpty;

    if (countEl) {
      const total = new Set(state.corpus.map((r) => r.id)).size;
      // Deselectable facets ("off" = every value of that dimension) make the
      // readout the only place the active filter set is legible at a
      // glance — so it always names both facets' state, not just lane.
      const workloadSuffix = state.filters.workload ? '' : ' · all workloads';
      const laneSuffix = state.filters.lane ? ` · ${state.filters.lane} only` : ' · best lane per model';
      countEl.textContent = `${view.length} of ${total} models${workloadSuffix}${laneSuffix}`;
    }

    for (const th of sortHeaders) {
      const key = th.dataset.sortKey;
      const arrow = th.querySelector('.sort-arrow');
      const active = !!key && key === state.sort.key;
      th.classList.toggle('sorted', active);
      if (active) {
        th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
        if (arrow) arrow.textContent = state.sort.dir === 'asc' ? '▲' : '▼';
      } else {
        th.removeAttribute('aria-sort');
        if (arrow) arrow.textContent = '';
      }
    }

    for (const seg of facetSegs) {
      const facet = seg.dataset.facet as FacetKey | undefined;
      if (!facet) continue;
      const buttons = Array.from(seg.querySelectorAll<HTMLButtonElement>('button[data-value]'));
      for (const btn of buttons) {
        const value = btn.dataset.value ?? '';
        // state.filters[facet] is null when the facet is off — no button is
        // "on" in that state (a cleared facet has no active value, not a
        // hidden default one).
        const active = state.filters[facet] === value;
        btn.classList.toggle('on', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    }

    for (const btn of capButtons) {
      const cap = btn.dataset.value ?? '';
      const active = state.filters.caps.includes(cap);
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    if (searchInput && searchInput.value !== state.filters.q) {
      searchInput.value = state.filters.q;
    }

    if (filterCountEl) filterCountEl.textContent = String(activeFilterCount());
    if (sortLabelEl) sortLabelEl.textContent = SORT_LABELS[state.sort.key ?? 'dec'] ?? 'decode';
    for (const btn of sortMenuButtons) {
      btn.classList.toggle('on', btn.dataset.sortKey === state.sort.key);
    }
  }

  // Evals tab: rendered off `defaultView(state.corpus)` (the opinionated
  // default, one row per model) rather than currentView(), so the evals
  // table is never shifted by leaderboard-only filter state (workload,
  // depth, lane…) that has nothing to do with task scores.
  function renderEvals() {
    if (!evalsTablescroll || !evalsEmpty || !evalsThead || !evalsTbody) return;
    const table = evalTable(defaultView(state.corpus), state.evals);
    if (!table.hasEvals) {
      evalsTablescroll.hidden = true;
      evalsEmpty.hidden = false;
      return;
    }
    evalsThead.innerHTML = evalsTheadHtml(table.tasks);
    evalsTbody.innerHTML = table.rows.map((r) => evalRowHtml(r, table.tasks)).join('');
    evalsTablescroll.hidden = false;
    evalsEmpty.hidden = true;
  }

  function activateTab(tab: Tab) {
    state.tab = tab;
    for (const btn of tabButtons) {
      const btnTab: Tab = btn.id === 'evals' ? 'evals' : 'leaderboard';
      const active = btnTab === tab;
      btn.classList.toggle('on', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (leaderboardPanel) leaderboardPanel.hidden = tab !== 'leaderboard';
    if (evalsPanel) evalsPanel.hidden = tab !== 'evals';
  }

  function updateCapCounts(rows: BenchRow[]) {
    const base = defaultView(rows);
    const caps = capButtons.map((b) => b.dataset.value ?? '');
    const counts = capCounts(base, caps);
    for (const btn of capButtons) {
      const cap = btn.dataset.value ?? '';
      const span = btn.querySelector<HTMLElement>('[data-cap-count]');
      if (span) span.textContent = String(counts[cap] ?? 0);
    }
  }

  function setLiveFreshness(generatedAt?: string | null) {
    if (!freshnessEl || !freshnessText) return;
    freshnessEl.classList.remove('snap');
    freshnessEl.removeAttribute('title');
    freshnessDot?.classList.remove('stale');
    freshnessDot?.classList.add('serving');
    // liveAgeMinutes validates `generatedAt` itself — a missing/malformed
    // timestamp on an otherwise-successful live fetch reads as "freshness
    // unknown" (liveBadgeText), never a NaN-bearing string.
    const host = new URL(API_URL).host;
    freshnessText.textContent = liveBadgeText(host, liveAgeMinutes(generatedAt ?? null, Date.now()));
  }

  // Reverts the badge to the snapshot's degraded state — snapshotBadgeText's
  // `reason` is honest about *why* the page isn't live: a fetch/HTTP failure
  // ('unreachable') reads differently from a payload that answered but
  // couldn't be turned into rows ('invalid'). Both still land on the
  // always-well-formed build-time snapshot already on screen.
  function setSnapshotFreshness(reason?: 'unreachable' | 'invalid') {
    if (!freshnessEl || !freshnessText) return;
    freshnessEl.classList.add('snap');
    freshnessDot?.classList.add('stale');
    freshnessDot?.classList.remove('serving');
    const { text, title } = snapshotBadgeText(ROSTER_DATE, reason);
    freshnessText.textContent = text;
    freshnessEl.title = title;
  }

  // --- events -------------------------------------------------------

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      activateTab(btn.id === 'evals' ? 'evals' : 'leaderboard');
    });
  }

  for (const seg of facetSegs) {
    const facet = seg.dataset.facet as FacetKey | undefined;
    if (!facet) continue;
    seg.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const btn = target.closest<HTMLButtonElement>('button[data-value]');
      if (!btn || !seg.contains(btn)) return;
      const value = btn.dataset.value ?? '';
      // Deselectable: clicking the already-active segment clears the facet
      // back to "off" (null = every value of this dimension) instead of
      // forcing exactly one value to always be selected.
      state.filters[facet] = state.filters[facet] === value ? null : value;
      render();
    });
  }

  const capsRoot = root.querySelector<HTMLElement>('.fbar[data-facet="caps"]');
  capsRoot?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>('button[data-value]');
    if (!btn) return;
    const cap = btn.dataset.value ?? '';
    state.filters.caps = state.filters.caps.includes(cap)
      ? state.filters.caps.filter((c) => c !== cap)
      : [...state.filters.caps, cap];
    render();
  });

  searchInput?.addEventListener('input', () => {
    state.filters.q = searchInput.value;
    render();
  });

  function resetToDefault() {
    state.filters = { ...DEFAULT_FILTERS, caps: [] };
    state.sort = { key: null, dir: 'desc' };
    render();
  }

  resetBtn?.addEventListener('click', resetToDefault);
  emptyResetBtn?.addEventListener('click', resetToDefault);

  for (const th of sortHeaders) {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (key) setSort(key);
    });
  }

  // --- mobile toolbar (filters · N / sort · <key>) --------------------
  filtersToggleBtn?.addEventListener('click', () => {
    const open = root.classList.toggle('open');
    filtersToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  sortToggleBtn?.addEventListener('click', () => {
    if (!sortMenu) return;
    const open = sortMenu.hidden;
    sortMenu.hidden = !open;
    sortToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) sortMenuButtons[0]?.focus();
  });

  for (const btn of sortMenuButtons) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sortKey;
      if (key) setSort(key);
      closeSortMenu();
      sortToggleBtn?.focus();
    });
  }

  // Roving focus for the sort popover (role="menu"/"menuitem" — README
  // §Screens 2.10): ArrowUp/ArrowDown move between items, Home/End jump to
  // the ends. Enter/Space already work via each button's native click
  // behavior; Escape is handled by the document-level keydown handler
  // below (closeSortMenu + refocus the toggle).
  sortMenu?.addEventListener('keydown', (event) => {
    if (sortMenuButtons.length === 0) return;
    const currentIndex = sortMenuButtons.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % sortMenuButtons.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? sortMenuButtons.length - 1 : (currentIndex - 1 + sortMenuButtons.length) % sortMenuButtons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = sortMenuButtons.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    sortMenuButtons[nextIndex]?.focus();
  });

  document.addEventListener('click', (event) => {
    if (!sortMenu || sortMenu.hidden) return;
    const target = event.target as HTMLElement;
    if (sortMenu.contains(target) || target === sortToggleBtn || sortToggleBtn?.contains(target)) return;
    closeSortMenu();
  });

  // --- run drawer -----------------------------------------------------
  // Row click and the `?run=<id>` deep link both key off the model id
  // (never runId — snapshot rows don't have one, and the deep link has to
  // work for both). Looked up against the full corpus, not currentView(),
  // so a link into a row the active filters happen to hide still opens.
  let lastFocusedEl: HTMLElement | null = null;

  function findRowById(id: string): BenchRow | undefined {
    return state.corpus.find((r) => r.id === id);
  }

  let openRunId: string | null = null;

  // Belt-and-suspenders focus containment: trapTabKey (above) cycles Tab
  // within the drawer, but only guards Tab itself — a screen reader's own
  // virtual cursor, or any programmatic .focus() call, could still land on
  // content behind the scrim. The native `inert` attribute closes that gap
  // by making everything else in the page genuinely unfocusable and
  // unreadable-by-AT while the drawer is open, not just skipped by one key
  // handler. MAIN's own children get it too (except the scrim/drawer
  // themselves) since RunDrawer.astro renders inside <main>, alongside the
  // rest of the page content it needs to sit above.
  function setShellInert(on: boolean) {
    if (!drawerScrim || !drawerEl) return;
    for (const el of Array.from(document.body.children)) {
      if (el.tagName === 'SCRIPT') continue;
      if (el.tagName === 'MAIN') {
        for (const child of Array.from(el.children)) {
          if (child === drawerScrim || child === drawerEl) continue;
          if (on) child.setAttribute('inert', '');
          else child.removeAttribute('inert');
        }
        continue;
      }
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    }
  }

  function openDrawer(id: string, opts: { pushState?: boolean } = {}) {
    if (!drawerScrim || !drawerEl || !drawerTitle || !drawerBody) return;
    // Guard against pushing a duplicate history entry (and re-rendering)
    // when the same run is already open — e.g. a stray popstate/deep-link
    // re-trigger for the run currently on screen.
    if (openRunId === id && !drawerEl.hidden) return;
    const row = findRowById(id);
    if (!row) return;
    const model = drawerModel(row);
    if (!model) return;
    openRunId = id;

    drawerTitle.textContent = model.id;
    drawerBody.innerHTML = drawerBodyHtml(model);

    lastFocusedEl = document.activeElement as HTMLElement | null;
    drawerScrim.hidden = false;
    drawerEl.hidden = false;
    setShellInert(true);
    drawerEl.focus();

    if (model.mode === 'api' && model.runId) {
      void resolveBundleLink(model.runId, model.cellKey);
    }
    if (model.mode === 'api' && model.identity.lane) {
      void fetchRunHistory(id, model.identity.lane, model.identity.variant);
    }

    if (opts.pushState !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set('run', id);
      history.pushState({ run: id }, '', url);
    }
  }

  // Bundle download (+ the resolved argv, matched to the exact cell the
  // visitor clicked via cellKey — see runDetail's header comment) resolves
  // lazily: GET /v1/runs/{run_id} carries the bundle id (not derivable from
  // the roster row), so the button stays disabled until this returns. A
  // failure gets an honest, distinct message (runFailureMessage — a 404
  // means the run genuinely isn't published, not that the API is down)
  // surfaced in #run-drawer-fetch-status rather than leaving the disabled
  // button as the only signal something didn't load.
  async function resolveBundleLink(runId: string, cellKey: string | null) {
    const link = drawerBody?.querySelector<HTMLAnchorElement>('#run-drawer-bundle-btn');
    const statusEl = drawerBody?.querySelector<HTMLElement>('#run-drawer-fetch-status');
    if (!link) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${RUN_API_BASE}/${encodeURIComponent(runId)}`, { signal: controller.signal });
      // The drawer may have been closed/reopened on a different run while
      // this fetch was in flight — bail if the link isn't for this run.
      if (link.dataset.runId !== runId || !link.isConnected) return;
      if (!res.ok) {
        if (statusEl) {
          statusEl.textContent = runFailureMessage(res.status);
          statusEl.hidden = false;
        }
        return;
      }
      const json = await res.json();
      const detail = runDetail(json, cellKey);
      if (!detail) return;
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
      link.href = `${BUNDLE_API_BASE}/${encodeURIComponent(detail.bundleId)}`;
      link.dataset.bundleId = detail.bundleId;
      link.textContent = detail.title ? `download bundle · ${detail.title}` : 'download bundle';

      // Real argv arrived — replace the reconstructed flag well with it
      // (see drawerFlagsHtml's header comment) and drop the "reconstructed"
      // qualifier from the label since this is now the real thing.
      if (detail.argv && detail.argv.length > 0) {
        const flagsLabel = drawerBody?.querySelector<HTMLElement>('#run-drawer-flags-label');
        const flagsWell = drawerBody?.querySelector<HTMLElement>('#run-drawer-flags-well');
        if (flagsLabel) flagsLabel.textContent = 'resolved flags';
        if (flagsWell) flagsWell.textContent = detail.argv.join(' ');
      }
    } catch {
      // Network error or abort — no response at all, so runFailureMessage's
      // null-status branch (the honest "may be unreachable" copy) applies.
      if (link.dataset.runId === runId && link.isConnected && statusEl) {
        statusEl.textContent = runFailureMessage(null);
        statusEl.hidden = false;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Decode-history graph: fetches /v1/history and, only on a fully successful
  // + non-empty response, inserts the graph section right after
  // #run-drawer-identity. Any failure — network error, non-2xx (including a
  // 404 on a deploy predating the route), non-JSON body, or a shape that
  // normalizes to zero usable points — degrades silently: no section, no
  // skeleton, no error text, per the same "the snapshot/existing content
  // stays, nothing looks broken" principle the rest of this file follows for
  // optional enhancements.
  //
  // The query pins the DISPLAY DIMENSIONS, not just model+lane. A model
  // usually has pp (prefill) records alongside its tg (decode) ones under the
  // same model_id and lane, and a pp record carries no decode figure at all —
  // asking only by model+lane returns a "decode history" that is half prefill
  // runs. `config` is pinned to the row's own variant for the same reason:
  // two config_labels are different configurations, not successive
  // measurements of one.
  async function fetchRunHistory(modelId: string, lane: string, variant: string | null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const query = new URLSearchParams({ model: modelId, lane, kind: DEFAULT_WORKLOAD });
      if (variant) query.set('config', variant);
      const url = `${HISTORY_API_BASE}?${query.toString()}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const json = await res.json();
      const points = normalizeHistoryPoints(json);
      if (points.length === 0) return;
      // The drawer may have moved on to a different run while this fetch
      // was in flight — bail rather than inserting a graph for a model
      // that's no longer the one on screen.
      if (openRunId !== modelId || !drawerBody) return;
      const identitySection = drawerBody.querySelector('#run-drawer-identity');
      if (!identitySection) return;
      const geometry = sparklineGeometry(points.map((p) => ({ decode: p.decode, prefill: p.prefill })));
      if ('empty' in geometry) return;
      identitySection.insertAdjacentHTML('afterend', drawerGraphHtml(geometry, lane));
    } catch {
      // Network error, abort, or non-JSON body — no graph, silently.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function closeDrawer(opts: { popState?: boolean } = {}) {
    if (!drawerScrim || !drawerEl || !drawerBody) return;
    if (drawerEl.hidden) return;
    drawerScrim.hidden = true;
    drawerEl.hidden = true;
    drawerBody.innerHTML = '';
    openRunId = null;
    setShellInert(false);
    lastFocusedEl?.focus();
    lastFocusedEl = null;

    if (!opts.popState) {
      // replaceState, not pushState: closing shouldn't leave a "?run=
      // stripped" entry sitting in history behind the one that opened the
      // drawer — that would make Back a no-op (it'd just restore the
      // just-closed ?run= state) and double history size per open/close.
      const url = new URL(window.location.href);
      url.searchParams.delete('run');
      history.replaceState({}, '', url);
    }
  }

  tbody.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const tr = target.closest<HTMLElement>('tr[data-row-id]');
    if (!tr) return;
    const id = tr.dataset.rowId;
    if (id) openDrawer(id);
  });

  // Rows are keyboard-focusable (tabindex="0" role="button" — see rowHtml)
  // so Enter/Space must open the drawer the same way a click does, per the
  // same pattern profiles-island.ts uses for its cards.
  tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement;
    const tr = target.closest<HTMLElement>('tr[data-row-id]');
    if (!tr) return;
    event.preventDefault();
    const id = tr.dataset.rowId;
    if (id) openDrawer(id);
  });

  drawerScrim?.addEventListener('click', () => closeDrawer());
  drawerCloseBtn?.addEventListener('click', () => closeDrawer());

  // Escape closes whichever overlay is open (sort menu takes priority since
  // it's the shallower one); Tab traps focus inside the run drawer while
  // it's open (README §Interactions "Accessibility" — the drawer is a
  // modal dialog, so focus must never leak to the page behind the scrim).
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (sortMenu && !sortMenu.hidden) {
        closeSortMenu();
        return;
      }
      if (drawerEl && !drawerEl.hidden) closeDrawer();
      return;
    }
    if (event.key === 'Tab' && drawerEl && !drawerEl.hidden) {
      trapTabKey(drawerEl, event);
    }
  });

  window.addEventListener('popstate', () => {
    const runId = new URL(window.location.href).searchParams.get('run');
    if (runId) {
      openDrawer(runId, { pushState: false });
    } else {
      closeDrawer({ popState: true });
    }
  });

  drawerBody?.addEventListener('click', (event) => {
    if (!drawerBody) return;
    const target = event.target as HTMLElement;
    const bundleLink = target.closest<HTMLAnchorElement>('#run-drawer-bundle-btn');
    if (bundleLink && bundleLink.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    const copyFlagsBtn = target.closest<HTMLButtonElement>('[data-copy-flags]');
    if (copyFlagsBtn) {
      const flagText = drawerBody.querySelector('.well.argv')?.textContent ?? '';
      navigator.clipboard?.writeText(flagText).then(() => {
        const original = copyFlagsBtn.textContent;
        copyFlagsBtn.textContent = 'copied';
        setTimeout(() => {
          copyFlagsBtn.textContent = original;
        }, 1400);
      });
      return;
    }
    const copyLinkBtn = target.closest<HTMLButtonElement>('[data-copy-link]');
    if (copyLinkBtn) {
      const id = copyLinkBtn.dataset.copyLink ?? '';
      const url = new URL(window.location.href);
      url.searchParams.set('run', id);
      navigator.clipboard?.writeText(url.toString()).then(() => {
        const original = copyLinkBtn.textContent;
        copyLinkBtn.textContent = 'copied';
        setTimeout(() => {
          copyLinkBtn.textContent = original;
        }, 1400);
      });
    }
  });

  render();
  renderEvals();

  // The sub-nav's "evals" link points at /benchmarks/#evals — activate the
  // tab on load when that's how the visitor arrived, so the anchor actually
  // resolves to the tab it names instead of just scrolling to it. Also
  // listen for the hash landing while already on the page (e.g. clicking
  // the sub-nav link from /benchmarks itself, which fires hashchange
  // without a navigation/reload).
  if (window.location.hash === '#evals') activateTab('evals');
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#evals') activateTab('evals');
  });

  // Open-on-load: the URL already carries ?run=<id> (no history entry to
  // push — it's already the current entry).
  const initialRunId = new URL(window.location.href).searchParams.get('run');
  if (initialRunId) openDrawer(initialRunId, { pushState: false });

  // --- progressive live upgrade --------------------------------------
  // Fetch api.hal0.dev/v1/roster (and, in parallel, /v1/evals — API-only,
  // no snapshot equivalent) once the browser is idle. Success swaps the
  // working corpus/evals and freshness badge in place, preserving whatever
  // sort/filter/tab state the visitor has set; failure (network error, bad
  // status, or a >5s round trip) is silent for both — the snapshot badge
  // and evals empty state stay, no error surfaces, per README §Interactions.
  scheduleIdle(() => {
    void fetchLiveRoster();
    void fetchEvals();
  });

  async function fetchEvals() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(EVALS_API_URL, { signal: controller.signal });
      if (!res.ok) return;
      const json = await res.json();
      const evals = Array.isArray(json?.evals) ? (json.evals as EvalEntry[]) : [];
      if (evals.length === 0) return;
      state.evals = evals;
      renderEvals();
    } catch {
      // Network error, non-JSON body, or abort — stay on the empty state.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Two-stage validation (README §Interactions): stage 1 is network/HTTP —
  // a failure here genuinely means the API didn't answer, the honest
  // 'unreachable' badge. Stage 2 is shape — the response arrived but has to
  // prove it can become a working corpus (normalize → upgrade → filter →
  // render) before anything is committed; a failure there is a live-data
  // problem, not an outage, and gets the distinct 'invalid' badge. Building
  // the full view/markup in a local `bodyHtml` before touching `state.corpus`
  // or the DOM means a malformed payload never leaves either half-updated.
  async function fetchLiveRoster() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ROSTER_FETCH_TIMEOUT_MS);
    let json: any;
    try {
      const res = await fetch(API_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`status ${res.status}`);
      json = await res.json();
    } catch {
      clearTimeout(timeoutId);
      setSnapshotFreshness('unreachable');
      return;
    }
    clearTimeout(timeoutId);

    try {
      const apiRows = normalizeApiRoster(json) as BenchRow[];
      if (apiRows.length === 0) throw new Error('empty/malformed roster payload');
      const upgraded = upgradeRows(snapshotRows, apiRows) as BenchRow[];
      // Prove the corpus actually renders (rowHtml can throw on a value that
      // violates the /v1/roster type contract, e.g. a non-numeric metric,
      // despite passing normalizeApiRoster's own tolerance) before
      // committing it to state — a throw here must never leave state.corpus
      // pointing at a corpus the page can't paint.
      viewFor(upgraded).map(rowHtml).join('');

      state.corpus = upgraded;
      updateCapCounts(upgraded);
      render();
      renderEvals();
      setLiveFreshness(json?.generated ?? null);
    } catch {
      setSnapshotFreshness('invalid');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
