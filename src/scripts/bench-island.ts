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
  evalTable,
  evalScoreBucket,
  selectInitialRows,
  DEFAULT_WORKLOAD,
  DEFAULT_DEPTH,
  DEFAULT_VARIANT,
  DEFAULT_LANE,
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
}

type FacetKey = 'workload' | 'depth' | 'variant' | 'lane';
type Tab = 'leaderboard' | 'evals';

interface Filters {
  workload: string;
  depth: number;
  variant: string;
  lane: string;
  caps: string[];
  q: string;
}

interface EvalEntry {
  run_id?: string;
  model?: string;
  task?: string;
  score?: number;
}

const API_URL = 'https://api.hal0.dev/v1/roster';
const EVALS_API_URL = 'https://api.hal0.dev/v1/evals';
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

const RUN_API_BASE = 'https://api.hal0.dev/v1/runs';
const BUNDLE_API_BASE = 'https://api.hal0.dev/v1/bundles';

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

function drawerIdentityHtml(identity: NonNullable<DrawerModel>['identity']): string {
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
  return `<section>
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

// drawerHistoryHtml/sparkSvg (history sparkline section) were removed as
// dead code: drawerModel.hasHistory is only ever true when a row carries
// real `history` data, and no data path populates it yet (see bench-view.mjs
// BenchRow typedef — "history: never populated from real sources yet").
// Re-add both once the live API surfaces per-run history.

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
  </section>`;
}

function drawerBodyHtml(model: NonNullable<DrawerModel>): string {
  const parts = [drawerMetricsHtml(model.metrics), drawerIdentityHtml(model.identity)];
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

  const DEFAULT_FILTERS: Filters = {
    workload: DEFAULT_WORKLOAD,
    depth: DEFAULT_DEPTH,
    variant: DEFAULT_VARIANT,
    lane: DEFAULT_LANE,
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
    if (state.filters.depth !== DEFAULT_FILTERS.depth) n++;
    if (state.filters.variant !== DEFAULT_FILTERS.variant) n++;
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

  function currentView(): BenchRow[] {
    const filtered = applyFilters(state.corpus, state.filters);
    const reduced = reduceBestLane(filtered);
    return state.sort.key ? sortRows(reduced, state.sort.key, state.sort.dir) : reduced;
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
      const laneSuffix = state.filters.lane === DEFAULT_LANE ? ' · best lane per model' : '';
      countEl.textContent = `${view.length} of ${total} models${laneSuffix}`;
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
        const raw = btn.dataset.value ?? '';
        const value: string | number = facet === 'depth' ? Number(raw) : raw;
        btn.classList.toggle('on', state.filters[facet] === value);
      }
    }

    for (const btn of capButtons) {
      const cap = btn.dataset.value ?? '';
      btn.classList.toggle('on', state.filters.caps.includes(cap));
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
    freshnessDot?.classList.remove('stale');
    freshnessDot?.classList.add('serving');
    const minutesAgo = generatedAt
      ? Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60000))
      : 0;
    freshnessText.textContent = `live · api.hal0.dev, ${minutesAgo} min ago`;
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
      const raw = btn.dataset.value ?? '';
      const value: string | number = facet === 'depth' ? Number(raw) : raw;
      (state.filters as unknown as Record<FacetKey, string | number>)[facet] = value;
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
    drawerEl.focus();

    if (model.mode === 'api' && model.runId) {
      void resolveBundleLink(model.runId);
    }

    if (opts.pushState !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set('run', id);
      history.pushState({ run: id }, '', url);
    }
  }

  // Bundle download resolves lazily: GET /v1/runs/{run_id} carries the
  // bundle id (not derivable from the roster row), so the button stays
  // disabled until this returns. 5s timeout, silent failure — on network
  // error, bad status, non-JSON body, or an unrecognized payload shape the
  // button just stays disabled with its "bundle lookup unavailable" title.
  async function resolveBundleLink(runId: string) {
    const link = drawerBody?.querySelector<HTMLAnchorElement>('#run-drawer-bundle-btn');
    if (!link) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${RUN_API_BASE}/${encodeURIComponent(runId)}`, { signal: controller.signal });
      if (!res.ok) return;
      const json = await res.json();
      const detail = runDetail(json);
      if (!detail) return;
      // The drawer may have been closed/reopened on a different run while
      // this fetch was in flight — bail if the link isn't for this run.
      if (link.dataset.runId !== runId || !link.isConnected) return;
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
      // Network error, abort, or non-JSON body — stay disabled.
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
    lastFocusedEl?.focus();
    lastFocusedEl = null;

    if (!opts.popState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('run');
      history.pushState({}, '', url);
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

  async function fetchLiveRoster() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, { signal: controller.signal });
      if (!res.ok) return;
      const json = await res.json();
      const apiRows = normalizeApiRoster(json) as BenchRow[];
      if (apiRows.length === 0) return;
      const upgraded = upgradeRows(snapshotRows, apiRows) as BenchRow[];
      state.corpus = upgraded;
      updateCapCounts(upgraded);
      render();
      renderEvals();
      setLiveFreshness(json?.generated ?? null);
    } catch {
      // Network error, non-JSON body, or abort — stay on the snapshot.
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
