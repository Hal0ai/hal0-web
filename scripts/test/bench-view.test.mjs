import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeRoster,
  normalizeApiRoster,
  applyFilters,
  sortRows,
  bucket,
  defaultView,
  reduceBestLane,
  upgradeRows,
  capCounts,
  drawerModel,
  buildFlagString,
  runDetail,
  runFailureMessage,
  liveAgeMinutes,
  liveBadgeText,
  snapshotBadgeText,
  laneGraphColor,
  laneMarkerShape,
  normalizeHistoryPoints,
  sparklineGeometry,
  selectInitialRows,
  evalTable,
  evalScoreBucket,
  DEFAULT_WORKLOAD,
  DEFAULT_DEPTH,
  DEFAULT_VARIANT,
  DEFAULT_LANE,
} from '../../src/lib/bench-view.mjs';

// --- fixtures ---------------------------------------------------------

const ROSTER_FIXTURE = [
  {
    id: 'model-a',
    hfRepo: 'org/model-a',
    caps: ['mtp', 'vision'],
    params: '35B-A3B',
    kv: 'f16',
    spec: 'draft-mtp',
    gb: 19.0,
    dec: 100.5,
    pf: 902.9,
    acc: 83.1,
    note: 'vision;',
    measured: true,
  },
  {
    id: 'model-b',
    hfRepo: 'org/model-b',
    caps: ['tools'],
    params: '27B dense',
    kv: 'q8',
    spec: 'draft-mtp',
    gb: 14.8,
    dec: 35.5,
    pf: 301.4,
    acc: 79.8,
    note: '',
    measured: true,
  },
  {
    id: 'model-c',
    hfRepo: '',
    caps: [],
    params: '4B',
    kv: 'q4',
    spec: 'none',
    gb: null,
    dec: null,
    pf: null,
    acc: null,
    note: '',
    measured: false,
  },
];

// Trimmed shape matching the /v1/roster contract from task-3-brief.md.
const API_FIXTURE = {
  generated: '2026-08-09T12:00:00Z',
  models: [
    {
      model_id: 'model-a',
      quant: 'f16',
      host: 'strix-halo-01',
      bundle_id: 'bundle-1',
      cells: [
        {
          lane: 'rocm',
          kind: 'tg',
          depth: 2048,
          config_label: 'default',
          decode_ts_med: 95.2,
          prefill_ts_med: 880.1,
          ttft_ms_p50: 120,
          ttft_ms_p95: 180,
          accept_med: 82.0,
          run_id: 'run-1',
          measured_at: '2026-08-09T11:00:00Z',
          flagged: false,
        },
        {
          lane: 'vulkan_radv',
          kind: 'tg',
          depth: 2048,
          config_label: 'default',
          decode_ts_med: 101.3,
          prefill_ts_med: 910.4,
          ttft_ms_p50: 110,
          ttft_ms_p95: 170,
          accept_med: 84.0,
          run_id: 'run-2',
          measured_at: '2026-08-09T11:05:00Z',
          flagged: false,
        },
        {
          lane: 'rocm',
          kind: 'pp',
          depth: 512,
          config_label: 'b1024',
          decode_ts_med: 40.0,
          prefill_ts_med: 700.0,
          ttft_ms_p50: 90,
          ttft_ms_p95: 140,
          accept_med: null,
          run_id: 'run-3',
          measured_at: '2026-08-09T11:10:00Z',
          flagged: true,
        },
      ],
    },
    {
      model_id: 'model-b',
      quant: 'q8',
      host: 'strix-halo-01',
      bundle_id: 'bundle-1',
      cells: [
        {
          lane: 'rocm',
          kind: 'tg',
          depth: 2048,
          config_label: 'default',
          decode_ts_med: 33.1,
          prefill_ts_med: 298.0,
          ttft_ms_p50: 200,
          ttft_ms_p95: 260,
          accept_med: 79.8,
          run_id: 'run-4',
          measured_at: '2026-08-09T11:15:00Z',
          flagged: false,
        },
      ],
    },
  ],
};

// --- normalizeRoster ----------------------------------------------------

test('normalizeRoster maps RosterRow shape to BenchRow with snapshot source', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE, { generatedAt: '2026-06-19' });
  assert.equal(rows.length, 3);
  const a = rows[0];
  assert.equal(a.id, 'model-a');
  assert.equal(a.hfRepo, 'org/model-a');
  assert.deepEqual(a.caps, ['mtp', 'vision']);
  assert.equal(a.params, '35B-A3B');
  assert.equal(a.kv, 'f16');
  assert.equal(a.spec, 'draft-mtp');
  assert.equal(a.gb, 19.0);
  assert.equal(a.dec, 100.5);
  assert.equal(a.pf, 902.9);
  assert.equal(a.acc, 83.1);
  assert.equal(a.source, 'snapshot');
  assert.equal(a.lane, null);
  assert.equal(a.ttftP50, null);
  assert.equal(a.ttftP95, null);
  assert.equal(a.history, null);
  assert.equal(a.measured, true);
});

test('normalizeRoster preserves measured:false rows without inventing numbers', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const c = rows.find((r) => r.id === 'model-c');
  assert.equal(c.measured, false);
  assert.equal(c.dec, null);
  assert.equal(c.pf, null);
  assert.equal(c.acc, null);
  assert.equal(c.gb, null);
});

test('normalizeRoster tolerates missing rosterRows', () => {
  assert.deepEqual(normalizeRoster(undefined), []);
});

// --- normalizeApiRoster ---------------------------------------------------

test('normalizeApiRoster produces one row per (model, cell)', () => {
  const rows = normalizeApiRoster(API_FIXTURE);
  assert.equal(rows.length, 4);
  const rocmTg = rows.find((r) => r.id === 'model-a' && r.lane === 'rocm' && r.workload === 'tg');
  assert.ok(rocmTg);
  assert.equal(rocmTg.dec, 95.2);
  assert.equal(rocmTg.pf, 880.1);
  assert.equal(rocmTg.ttftP50, 120);
  assert.equal(rocmTg.ttftP95, 180);
  assert.equal(rocmTg.acc, 82.0);
  assert.equal(rocmTg.depth, 2048);
  assert.equal(rocmTg.variant, 'default');
  assert.equal(rocmTg.runId, 'run-1');
  assert.equal(rocmTg.measuredAt, '2026-08-09T11:00:00Z');
  assert.equal(rocmTg.flagged, false);
  assert.equal(rocmTg.source, 'api');
  // kv is the KV-cache mode, a different axis than model.quant — it stays
  // null on raw API rows until upgradeRows merges the real value in from
  // the matching snapshot row (see the kv/quant test below).
  assert.equal(rocmTg.kv, null);
  assert.equal(rocmTg.quant, 'f16');
  assert.equal(rocmTg.measured, true);
});

test('normalizeApiRoster: kv stays null (never sourced from model.quant), quant carries model.quant', () => {
  const rows = normalizeApiRoster(API_FIXTURE);
  assert.ok(rows.every((r) => r.kv === null));
  assert.ok(rows.filter((r) => r.id === 'model-a').every((r) => r.quant === 'f16'));
  assert.ok(rows.filter((r) => r.id === 'model-b').every((r) => r.quant === 'q8'));
});

test('normalizeApiRoster: reads a live-payload caps array when present (live ids don\'t reliably join to the snapshot)', () => {
  const rows = normalizeApiRoster({
    models: [
      {
        model_id: 'chadrock-35b-ace-saber-mtp-rocmfpx-moequality',
        caps: ['mtp', 'vision', 'tools'],
        cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 50 }],
      },
    ],
  });
  assert.deepEqual(rows[0].caps, ['mtp', 'vision', 'tools']);
});

test('normalizeApiRoster: missing/malformed model.caps falls back to [], never invented', () => {
  const rows = normalizeApiRoster({
    models: [
      { model_id: 'a', cells: [{ lane: 'rocm', decode_ts_med: 1 }] },
      { model_id: 'b', caps: 'not-an-array', cells: [{ lane: 'rocm', decode_ts_med: 1 }] },
      { model_id: 'c', caps: ['mtp', 42, null], cells: [{ lane: 'rocm', decode_ts_med: 1 }] },
    ],
  });
  assert.deepEqual(rows.find((r) => r.id === 'a').caps, []);
  assert.deepEqual(rows.find((r) => r.id === 'b').caps, []);
  // Non-string entries are filtered out, real ones kept — never thrown.
  assert.deepEqual(rows.find((r) => r.id === 'c').caps, ['mtp']);
});

test('normalizeApiRoster tolerates missing models/cells', () => {
  assert.deepEqual(normalizeApiRoster({}), []);
  assert.deepEqual(normalizeApiRoster({ models: [{ model_id: 'x' }] }), []);
});

test('normalizeApiRoster: drops entries with a missing/null/non-string model_id', () => {
  const rows = normalizeApiRoster({
    models: [
      { model_id: null, cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] },
      { cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] },
      { model_id: '', cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] },
      { model_id: 42, cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] },
      { model_id: 'model-ok', cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] },
    ],
  });
  assert.deepEqual(rows.map((r) => r.id), ['model-ok']);
});

// Live-shaped fixture matching the CT105 adapter: real lanes 'rocm' and
// 'vulkan_radv', plus 'default' — the adapter's own mapping of CT105's
// unlaned '' cells, not a real backend. All cells sit at the tg@2048/default
// facet defaults so a bare lane-only filter reproduces what the UI sends.
const LIVE_LANE_FIXTURE = {
  generated: '2026-08-09T12:00:00Z',
  models: [
    {
      model_id: 'model-a',
      cells: [
        { lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 50, run_id: 'run-1' },
        { lane: 'vulkan_radv', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 70, run_id: 'run-2' },
      ],
    },
    {
      model_id: 'model-b',
      cells: [
        { lane: 'default', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 30, run_id: 'run-3' },
      ],
    },
  ],
};

// --- applyFilters: lane facet against live-shaped data ("best"/"default") -

test('applyFilters+reduceBestLane: lane="best" must never be empty when cells exist (regression: was 0 rows)', () => {
  const rows = normalizeApiRoster(LIVE_LANE_FIXTURE);
  const filtered = applyFilters(rows, {
    workload: DEFAULT_WORKLOAD,
    depth: DEFAULT_DEPTH,
    variant: DEFAULT_VARIANT,
    lane: DEFAULT_LANE, // 'best' — a UI sentinel, never a literal row.lane value
  });
  const view = reduceBestLane(filtered);
  assert.equal(view.length, 2);
  const a = view.find((r) => r.id === 'model-a');
  // best of rocm(50)/vulkan_radv(70) is vulkan_radv
  assert.equal(a.lane, 'vulkan_radv');
  assert.equal(a.dec, 70);
  const b = view.find((r) => r.id === 'model-b');
  // single-lane model: its only (unlaned/'default') cell still shows up
  assert.equal(b.lane, 'default');
  assert.equal(b.dec, 30);
});

test('applyFilters: named-lane filters (rocm/vulkan_radv) still scope to their own subset', () => {
  const rows = normalizeApiRoster(LIVE_LANE_FIXTURE);
  const rocm = applyFilters(rows, { workload: DEFAULT_WORKLOAD, depth: DEFAULT_DEPTH, variant: DEFAULT_VARIANT, lane: 'rocm' });
  assert.deepEqual(rocm.map((r) => r.id), ['model-a']);

  const vulkan = applyFilters(rows, { workload: DEFAULT_WORKLOAD, depth: DEFAULT_DEPTH, variant: DEFAULT_VARIANT, lane: 'vulkan_radv' });
  assert.deepEqual(vulkan.map((r) => r.id), ['model-a']);
});

// --- deselectable facets: "off" (null/unset) matches every value of that
// dimension; the leaderboard's one-row-per-model invariant is kept by
// letting reduceBestLane collapse whatever the widened filter set surfaces
// down to the best cell per model — never fragmenting into multiple rows
// per model. This is the "read honestly" choice documented in the PR body:
// the table has always shown one row per model (defaultView/currentView
// both pipe every filtered set through reduceBestLane), and multi-row
// output would break that invariant (sort, cap counts, "N of M models").

test('applyFilters: an unset (null) facet matches every value of that dimension — "off" is not a value to match, it\'s no filter', () => {
  const rows = normalizeApiRoster(LIVE_LANE_FIXTURE);
  const anyLane = applyFilters(rows, { workload: DEFAULT_WORKLOAD, depth: DEFAULT_DEPTH, variant: DEFAULT_VARIANT, lane: null });
  // All 3 cells (2 for model-a across both lanes, 1 for model-b) survive —
  // same result as passing DEFAULT_LANE ('best'), just via the generic
  // null-means-no-filter path rather than the lane-specific sentinel.
  assert.equal(anyLane.length, 3);
});

test('applyFilters+reduceBestLane: toggling workload off surfaces every workload\'s cells, collapsed to the best cell per model (never multiple rows per model)', () => {
  const twoWorkloads = {
    models: [
      {
        model_id: 'model-a',
        cells: [
          { lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 50, run_id: 'run-1' },
          { lane: 'rocm', kind: 'pp', depth: 2048, config_label: 'default', decode_ts_med: 900, run_id: 'run-2' },
        ],
      },
    ],
  };
  const rows = normalizeApiRoster(twoWorkloads);

  // workload filter active (tg only): one row, the tg cell.
  const tgOnly = reduceBestLane(applyFilters(rows, { workload: 'tg', depth: DEFAULT_DEPTH, variant: DEFAULT_VARIANT }));
  assert.equal(tgOnly.length, 1);
  assert.equal(tgOnly[0].workload, 'tg');

  // workload toggled off (null): both cells are candidates; still exactly
  // one row per model — reduceBestLane picks the higher-dec cell (pp's 900
  // here), not both.
  const workloadOff = reduceBestLane(applyFilters(rows, { workload: null, depth: DEFAULT_DEPTH, variant: DEFAULT_VARIANT }));
  assert.equal(workloadOff.length, 1);
  assert.equal(workloadOff[0].workload, 'pp');
  assert.equal(workloadOff[0].dec, 900);
});

// --- applyFilters ---------------------------------------------------------

test('applyFilters: snapshot rows only match the default facet values', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const atDefault = applyFilters(rows, {
    workload: DEFAULT_WORKLOAD,
    depth: DEFAULT_DEPTH,
    variant: DEFAULT_VARIANT,
    lane: DEFAULT_LANE,
  });
  assert.equal(atDefault.length, 3);

  const offDefault = applyFilters(rows, { workload: 'pp' });
  assert.equal(offDefault.length, 0);

  const offDepth = applyFilters(rows, { depth: 512 });
  assert.equal(offDepth.length, 0);

  const noFilters = applyFilters(rows, {});
  assert.equal(noFilters.length, 3);
});

test('applyFilters: AND across facets on API rows', () => {
  const rows = normalizeApiRoster(API_FIXTURE);
  const result = applyFilters(rows, { workload: 'tg', lane: 'rocm' });
  assert.equal(result.length, 2); // model-a rocm/tg, model-b rocm/tg
  assert.ok(result.every((r) => r.workload === 'tg' && r.lane === 'rocm'));

  const none = applyFilters(rows, { workload: 'tg', lane: 'rocm', depth: 512 });
  assert.equal(none.length, 0);
});

test('applyFilters: caps filter is OR within the facet', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const result = applyFilters(rows, { caps: ['vision', 'tools'] });
  const ids = result.map((r) => r.id).sort();
  assert.deepEqual(ids, ['model-a', 'model-b']);
});

test('applyFilters: q is a case-insensitive substring match on id/hfRepo', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const result = applyFilters(rows, { q: 'MODEL-A' });
  assert.deepEqual(result.map((r) => r.id), ['model-a']);

  const byRepo = applyFilters(rows, { q: 'org/model-b' });
  assert.deepEqual(byRepo.map((r) => r.id), ['model-b']);

  const none = applyFilters(rows, { q: 'nope' });
  assert.equal(none.length, 0);
});

// --- sortRows ---------------------------------------------------------

test('sortRows: numeric columns sort on raw value', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const asc = sortRows(rows, 'dec', 'asc');
  // model-c has dec:null, always last regardless of direction.
  assert.deepEqual(asc.map((r) => r.id), ['model-b', 'model-a', 'model-c']);

  const desc = sortRows(rows, 'dec', 'desc');
  assert.deepEqual(desc.map((r) => r.id), ['model-a', 'model-b', 'model-c']);
});

test('sortRows: text columns sort via localeCompare', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const asc = sortRows(rows, 'id', 'asc');
  assert.deepEqual(asc.map((r) => r.id), ['model-a', 'model-b', 'model-c']);
  const desc = sortRows(rows, 'id', 'desc');
  assert.deepEqual(desc.map((r) => r.id), ['model-c', 'model-b', 'model-a']);
});

test('sortRows: nulls always sort last, in both directions', () => {
  const rows = [
    { id: 'x', dec: null },
    { id: 'y', dec: 10 },
    { id: 'z', dec: 5 },
  ];
  assert.deepEqual(sortRows(rows, 'dec', 'asc').map((r) => r.id), ['z', 'y', 'x']);
  assert.deepEqual(sortRows(rows, 'dec', 'desc').map((r) => r.id), ['y', 'z', 'x']);
});

// --- bucket ---------------------------------------------------------

test('bucket: edges at 60 and 25', () => {
  assert.equal(bucket(60), 'fast');
  assert.equal(bucket(60.1), 'fast');
  assert.equal(bucket(25), 'mid');
  assert.equal(bucket(59.9), 'mid');
  assert.equal(bucket(24.9), 'slow');
  assert.equal(bucket(0), 'slow');
  assert.equal(bucket(null), null);
  assert.equal(bucket(undefined), null);
});

// --- defaultView ---------------------------------------------------------

test('defaultView: identity on snapshot rows (already one row per model)', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const view = defaultView(rows);
  assert.equal(view.length, 3);
  assert.deepEqual(view.map((r) => r.id).sort(), ['model-a', 'model-b', 'model-c']);
});

test('defaultView: reduces API rows to tg @ 2048 default variant, best lane per model', () => {
  const rows = normalizeApiRoster(API_FIXTURE);
  const view = defaultView(rows);
  // model-a has two tg@2048/default cells (rocm 95.2, vulkan_radv 101.3);
  // the pp@512/b1024 cell must be excluded by the default facet filter.
  assert.equal(view.length, 2);
  const a = view.find((r) => r.id === 'model-a');
  assert.equal(a.lane, 'vulkan_radv');
  assert.equal(a.dec, 101.3);
  const b = view.find((r) => r.id === 'model-b');
  assert.equal(b.lane, 'rocm');
  assert.equal(b.dec, 33.1);
});

// --- reduceBestLane ---------------------------------------------------

test('reduceBestLane: keeps the highest-decode row per model id, first-appearance order', () => {
  const rows = [
    { id: 'model-a', dec: 10 },
    { id: 'model-b', dec: 5 },
    { id: 'model-a', dec: 20 },
    { id: 'model-c', dec: null },
  ];
  const view = reduceBestLane(rows);
  assert.deepEqual(view.map((r) => r.id), ['model-a', 'model-b', 'model-c']);
  assert.equal(view[0].dec, 20);
});

test('reduceBestLane: tolerates an empty/missing input', () => {
  assert.deepEqual(reduceBestLane([]), []);
  assert.deepEqual(reduceBestLane(undefined), []);
});

// --- upgradeRows --------------------------------------------------------

test('upgradeRows: merges caps/hfRepo/params/gb/kv from the matching snapshot row', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = normalizeApiRoster(API_FIXTURE);

  // Sanity: the API contract carries no caps/hfRepo/params/gb data, and kv
  // (KV-cache mode) is never sourced from model.quant.
  assert.deepEqual(apiRows[0].caps, []);
  assert.equal(apiRows[0].hfRepo, '');
  assert.equal(apiRows[0].params, '—');
  assert.equal(apiRows[0].gb, null);
  assert.equal(apiRows[0].kv, null);

  const upgraded = upgradeRows(snapshotRows, apiRows);
  const a = upgraded.find((r) => r.id === 'model-a' && r.lane === 'rocm' && r.workload === 'tg');
  assert.deepEqual(a.caps, ['mtp', 'vision']);
  assert.equal(a.hfRepo, 'org/model-a');
  assert.equal(a.params, '35B-A3B');
  assert.equal(a.gb, 19.0);
  assert.equal(a.kv, 'f16');
  // API-sourced measurement fields are untouched by the merge.
  assert.equal(a.dec, 95.2);
  assert.equal(a.source, 'api');
  // model.quant is a different axis and is untouched by the kv merge.
  assert.equal(a.quant, 'f16');

  const b = upgraded.find((r) => r.id === 'model-b');
  assert.deepEqual(b.caps, ['tools']);
  assert.equal(b.hfRepo, 'org/model-b');
  assert.equal(b.kv, 'q8');
});

test('upgradeRows: does not overwrite a real API-provided kv value', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = [{ id: 'model-a', kv: 'q4', caps: [], workload: 'tg', lane: 'rocm', depth: 2048, variant: 'default', dec: 1 }];
  const upgraded = upgradeRows(snapshotRows, apiRows);
  assert.equal(upgraded[0].kv, 'q4');
});

test('upgradeRows: leaves rows with no matching snapshot id untouched', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = normalizeApiRoster({
    models: [{ model_id: 'model-unknown', cells: [{ lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 1 }] }],
  });
  const upgraded = upgradeRows(snapshotRows, apiRows);
  assert.equal(upgraded.length, 1);
  assert.deepEqual(upgraded[0].caps, []);
  assert.equal(upgraded[0].hfRepo, '');
});

test('upgradeRows: does not overwrite API-provided hfRepo/params/gb when already present', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = [
    { id: 'model-a', hfRepo: 'org/other-repo', params: '99B', gb: 5, caps: [], workload: 'tg', lane: 'rocm', depth: 2048, variant: 'default', dec: 1 },
  ];
  const upgraded = upgradeRows(snapshotRows, apiRows);
  assert.equal(upgraded[0].hfRepo, 'org/other-repo');
  assert.equal(upgraded[0].params, '99B');
  assert.equal(upgraded[0].gb, 5);
  // Empty payload caps ([]) falls back to the snapshot join.
  assert.deepEqual(upgraded[0].caps, ['mtp', 'vision']);
});

test('upgradeRows: prefers non-empty payload caps over the snapshot join (live ids rarely match the curated snapshot ids)', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = [
    { id: 'model-a', hfRepo: '', params: '—', gb: null, caps: ['tools', 'reasoning'], workload: 'tg', lane: 'rocm', depth: 2048, variant: 'default', dec: 1 },
  ];
  const upgraded = upgradeRows(snapshotRows, apiRows);
  assert.deepEqual(upgraded[0].caps, ['tools', 'reasoning']);
});

test('upgradeRows: tolerates missing snapshotRows/apiRows', () => {
  assert.deepEqual(upgradeRows(undefined, undefined), []);
  assert.deepEqual(upgradeRows([], undefined), []);
});

// --- capCounts ----------------------------------------------------------

test('capCounts: counts rows per capability across the given rows', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const counts = capCounts(rows, ['mtp', 'vision', 'tools', 'coding', 'reasoning']);
  assert.deepEqual(counts, { mtp: 1, vision: 1, tools: 1, coding: 0, reasoning: 0 });
});

test('capCounts: does not change when rows are filtered — caller passes the full corpus', () => {
  const rows = normalizeRoster(ROSTER_FIXTURE);
  const filtered = applyFilters(rows, { q: 'model-a' });
  const fullCounts = capCounts(rows, ['mtp', 'vision']);
  const filteredCounts = capCounts(filtered, ['mtp', 'vision']);
  assert.deepEqual(fullCounts, { mtp: 1, vision: 1 });
  assert.deepEqual(filteredCounts, { mtp: 1, vision: 1 }); // same in this fixture, but the point is the caller's choice of input, not a filter-aware helper
  assert.equal(capCounts([], ['mtp']).mtp, 0);
});

// --- drawerModel ----------------------------------------------------------

test('drawerModel: null row returns null', () => {
  assert.equal(drawerModel(null), null);
  assert.equal(drawerModel(undefined), null);
});

test('drawerModel: snapshot row (no runId) reduces to mode "snapshot" with a note, no run-only fields', () => {
  const [row] = normalizeRoster(ROSTER_FIXTURE);
  const model = drawerModel(row);
  assert.equal(model.mode, 'snapshot');
  assert.equal(model.id, 'model-a');
  assert.deepEqual(model.metrics, { dec: 100.5, pf: 902.9, ttftP50: null, ttftP95: null, acc: 83.1 });
  assert.equal(model.identity.hfRepo, 'org/model-a');
  assert.equal(model.note, 'full run detail requires the live API');
  assert.equal(model.runId, null);
  assert.equal(model.flagString, null);
  assert.equal(model.hasHistory, false);
  assert.equal(model.history, null);
});

test('drawerModel: API row (runId present) reduces to mode "api" with a reconstructed flag string and no note', () => {
  const apiRows = normalizeApiRoster(API_FIXTURE);
  const row = apiRows.find((r) => r.lane === 'rocm');
  const model = drawerModel(row);
  assert.equal(model.mode, 'api');
  assert.equal(model.note, null);
  assert.equal(model.runId, 'run-1');
  assert.equal(model.measuredAt, '2026-08-09T11:00:00Z');
  assert.equal(model.flagged, false);
  // kv is null on a raw (non-upgraded) API row, so only depth is derivable —
  // no invented model path, -ngl, -fa, batch default, or sampler constants.
  assert.equal(model.flagString, '-c 2048');
});

test('drawerModel: API row upgraded with a real kv value includes it in the reconstructed flags', () => {
  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  const apiRows = normalizeApiRoster(API_FIXTURE);
  const upgraded = upgradeRows(snapshotRows, apiRows);
  const row = upgraded.find((r) => r.id === 'model-a' && r.lane === 'rocm');
  const model = drawerModel(row);
  assert.equal(model.flagString, '-c 2048 -ctk f16 -ctv f16');
});

test('drawerModel: flagged API row carries flagged:true through for the throttle banner', () => {
  const apiRows = normalizeApiRoster({
    generated: '2026-08-09T12:00:00Z',
    models: [
      {
        model_id: 'model-x',
        quant: 'q8',
        cells: [
          {
            lane: 'rocm',
            kind: 'tg',
            depth: 2048,
            config_label: 'default',
            decode_ts_med: 40,
            run_id: 'run-2',
            measured_at: '2026-08-09T11:00:00Z',
            flagged: true,
          },
        ],
      },
    ],
  });
  const model = drawerModel(apiRows[0]);
  assert.equal(model.flagged, true);
});

test('drawerModel: API row without history data has hasHistory:false, history:null (never synthesized)', () => {
  const apiRows = normalizeApiRoster(API_FIXTURE);
  const row = apiRows.find((r) => r.lane === 'rocm');
  const model = drawerModel(row);
  assert.equal(model.hasHistory, false);
  assert.equal(model.history, null);
});

test('drawerModel: API row with real history data surfaces it, hasHistory:true', () => {
  const apiRows = normalizeApiRoster(API_FIXTURE);
  const row = { ...apiRows.find((r) => r.lane === 'rocm'), history: [80, 82, 79, 85, 90, 95.2] };
  const model = drawerModel(row);
  assert.equal(model.hasHistory, true);
  assert.deepEqual(model.history, [80, 82, 79, 85, 90, 95.2]);
});

// --- buildFlagString --------------------------------------------------------

test('buildFlagString: b1024 variant sets batch flag to 1024', () => {
  const row = { id: 'm', kv: 'q8', depth: 8192, variant: 'b1024', spec: 'none' };
  assert.match(buildFlagString(row), /-b 1024/);
});

test('buildFlagString: draft-mtp spec (with mtp on) adds the speculative flags', () => {
  const row = { id: 'm', kv: 'f16', depth: 2048, variant: 'default', spec: 'draft-mtp' };
  assert.match(buildFlagString(row), /--draft-max 4 --draft-min 1 --mtp on/);
});

test('buildFlagString: mtp-off variant suppresses the speculative flags even with draft-mtp spec', () => {
  const row = { id: 'm', kv: 'f16', depth: 2048, variant: 'mtp-off', spec: 'draft-mtp' };
  assert.doesNotMatch(buildFlagString(row), /--mtp on/);
});

test('buildFlagString: never fabricates a model path, -ngl, -fa, sampler constants, host/port, or a default batch', () => {
  const row = { id: 'model-a', kv: 'q8', depth: 2048, variant: 'default', spec: 'none' };
  const flags = buildFlagString(row);
  assert.doesNotMatch(flags, /llama-server/);
  assert.doesNotMatch(flags, /-m \//);
  assert.doesNotMatch(flags, /-ngl/);
  assert.doesNotMatch(flags, /-fa/);
  assert.doesNotMatch(flags, /--temp|--top-p|--min-p/);
  assert.doesNotMatch(flags, /--host|--port/);
  assert.doesNotMatch(flags, /--parallel/);
  // variant is 'default', not 'b1024' — no batch flag is invented.
  assert.doesNotMatch(flags, /-b /);
});

test('buildFlagString: only depth is derivable → "-c {depth}" alone', () => {
  const row = { id: 'm', kv: null, depth: 4096, variant: 'default', spec: 'none' };
  assert.equal(buildFlagString(row), '-c 4096');
});

test('buildFlagString: nothing real is derivable → null', () => {
  const row = { id: 'm', kv: null, depth: null, variant: 'default', spec: 'none' };
  assert.equal(buildFlagString(row), null);
});

// --- runDetail ---------------------------------------------------------

test('runDetail: valid GET /v1/runs/{run_id} payload resolves bundleId and title (argv:null with no identity.config.argv)', () => {
  const json = {
    run_id: 'run-123',
    records: [{ cell_key: 'a' }],
    bundle: { id: 'bundle-abc', title: 'nightly sweep', notes: '' },
  };
  assert.deepEqual(runDetail(json), { bundleId: 'bundle-abc', title: 'nightly sweep', argv: null });
});

test('runDetail: bundle with an empty title resolves title:null', () => {
  const json = { run_id: 'run-123', records: [], bundle: { id: 'bundle-abc', title: '', notes: '' } };
  assert.deepEqual(runDetail(json), { bundleId: 'bundle-abc', title: null, argv: null });
});

test('runDetail: extracts the real argv from records[0].identity.config.argv', () => {
  const json = {
    run_id: 'run-123',
    records: [{ cell_key: 'a', identity: { config: { argv: ['-c', '2048', '-ctk', 'f16_0'] } } }],
    bundle: { id: 'bundle-abc', title: null, notes: '' },
  };
  assert.deepEqual(runDetail(json).argv, ['-c', '2048', '-ctk', 'f16_0']);
});

test('runDetail: falls through to a later record when the first has no usable argv', () => {
  const json = {
    run_id: 'run-123',
    records: [
      { cell_key: 'a', identity: { config: {} } },
      { cell_key: 'b', identity: { config: { argv: ['-c', '512'] } } },
    ],
    bundle: { id: 'bundle-abc', title: null, notes: '' },
  };
  assert.deepEqual(runDetail(json).argv, ['-c', '512']);
});

test('runDetail: malformed identity/config/argv (non-array, non-string entries, empty array) yields argv:null', () => {
  const cases = [
    { identity: { config: { argv: 'not-an-array' } } },
    { identity: { config: { argv: [] } } },
    { identity: { config: { argv: [1, 2, 3] } } },
    { identity: null },
    {},
  ];
  for (const record of cases) {
    const json = { records: [record], bundle: { id: 'bundle-abc', title: null, notes: '' } };
    assert.equal(runDetail(json).argv, null);
  }
});

test('runDetail: cellKey matches a specific record\'s argv over other records', () => {
  const json = {
    run_id: 'run-123',
    records: [
      { cell_key: 'rocm-cell', identity: { config: { argv: ['-c', '2048', '--lane', 'rocm'] } } },
      { cell_key: 'vulkan-cell', identity: { config: { argv: ['-c', '2048', '--lane', 'vulkan'] } } },
    ],
    bundle: { id: 'bundle-abc', title: null, notes: '' },
  };
  assert.deepEqual(runDetail(json, 'vulkan-cell').argv, ['-c', '2048', '--lane', 'vulkan']);
  assert.deepEqual(runDetail(json, 'rocm-cell').argv, ['-c', '2048', '--lane', 'rocm']);
});

test('runDetail: no cellKey (or no match) falls back to the first record with a usable argv', () => {
  const json = {
    run_id: 'run-123',
    records: [
      { cell_key: 'rocm-cell', identity: { config: { argv: ['-c', '2048'] } } },
    ],
    bundle: { id: 'bundle-abc', title: null, notes: '' },
  };
  assert.deepEqual(runDetail(json).argv, ['-c', '2048']);
  assert.deepEqual(runDetail(json, 'no-such-cell').argv, ['-c', '2048']);
});

test('runDetail: a cellKey match with no usable argv still falls back to another record\'s argv', () => {
  const json = {
    run_id: 'run-123',
    records: [
      { cell_key: 'rocm-cell', identity: { config: {} } },
      { cell_key: 'vulkan-cell', identity: { config: { argv: ['-c', '512'] } } },
    ],
    bundle: { id: 'bundle-abc', title: null, notes: '' },
  };
  assert.deepEqual(runDetail(json, 'rocm-cell').argv, ['-c', '512']);
});

test('runDetail: missing bundle returns null', () => {
  assert.equal(runDetail({ run_id: 'run-123', records: [] }), null);
});

test('runDetail: bundle without an id returns null', () => {
  assert.equal(runDetail({ run_id: 'run-123', records: [], bundle: { title: 'x' } }), null);
});

test('runDetail: tolerates garbage input (null, undefined, non-object, array)', () => {
  assert.equal(runDetail(null), null);
  assert.equal(runDetail(undefined), null);
  assert.equal(runDetail('not json'), null);
  assert.equal(runDetail([1, 2, 3]), null);
  assert.equal(runDetail({}), null);
});

// --- selectInitialRows ---------------------------------------------------

test('selectInitialRows: benchSnapshot.roster null → current behavior (defaultView of the committed snapshot, dated by rosterMeta)', () => {
  const { rows, freshnessDate } = selectInitialRows(ROSTER_FIXTURE, { generatedAt: '2026-06-19' }, { fetched_at: '2026-08-09', roster: null });
  assert.deepEqual(rows.map((r) => r.id).sort(), ['model-a', 'model-b', 'model-c']);
  assert.equal(freshnessDate, '2026-06-19');
});

test('selectInitialRows: tolerates a missing/undefined benchSnapshot the same as roster:null', () => {
  const { rows, freshnessDate } = selectInitialRows(ROSTER_FIXTURE, { generatedAt: '2026-06-19' }, undefined);
  assert.equal(rows.length, 3);
  assert.equal(freshnessDate, '2026-06-19');
});

test('selectInitialRows: benchSnapshot.roster present → upgraded, defaultView-reduced API rows dated by fetched_at', () => {
  const { rows, freshnessDate } = selectInitialRows(
    ROSTER_FIXTURE,
    { generatedAt: '2026-06-19' },
    { fetched_at: '2026-08-09T12:00:00Z', roster: API_FIXTURE },
  );
  assert.equal(freshnessDate, '2026-08-09T12:00:00Z');
  // Same reduction defaultView(normalizeApiRoster(...)) does on its own —
  // model-a's best lane at tg@2048/default is vulkan_radv (101.3).
  assert.equal(rows.length, 2);
  const a = rows.find((r) => r.id === 'model-a');
  assert.equal(a.lane, 'vulkan_radv');
  assert.equal(a.dec, 101.3);
  // Upgraded with the snapshot's caps/hfRepo/params/gb/kv, since the API
  // contract doesn't carry them.
  assert.deepEqual(a.caps, ['mtp', 'vision']);
  assert.equal(a.hfRepo, 'org/model-a');
  assert.equal(a.kv, 'f16');
});

test('selectInitialRows: falls back to rosterMeta.generatedAt when benchSnapshot has a roster but no fetched_at', () => {
  const { freshnessDate } = selectInitialRows(ROSTER_FIXTURE, { generatedAt: '2026-06-19' }, { roster: API_FIXTURE });
  assert.equal(freshnessDate, '2026-06-19');
});

// --- evalTable / evalScoreBucket ---------------------------------------

// Matches the real GET /v1/evals contract (bench-api-worker's evalsHandler):
// {evals: [{run_id, model, task, score}]}. model-c never appears — it has
// no applicable tool/coding claim to test.
const EVALS_FIXTURE = [
  { run_id: 'run-1', model: 'model-a', task: 'tool-call', score: 0.82 },
  { run_id: 'run-1', model: 'model-a', task: 'coding', score: 0.31 },
  { run_id: 'run-2', model: 'model-b', task: 'tool-call', score: 0.5 },
];

const EVAL_ROWS_FIXTURE = normalizeRoster(ROSTER_FIXTURE);

test('evalTable: no evals (snapshot mode / API unreachable) reports hasEvals:false', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, []);
  assert.equal(table.hasEvals, false);
  assert.deepEqual(table.tasks, []);
  assert.deepEqual(table.rows, []);
});

test('evalTable: null/undefined evals also reports hasEvals:false', () => {
  assert.equal(evalTable(EVAL_ROWS_FIXTURE, null).hasEvals, false);
  assert.equal(evalTable(EVAL_ROWS_FIXTURE, undefined).hasEvals, false);
});

test('evalTable: distinct task columns are sorted alphabetically', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  assert.deepEqual(table.tasks, ['coding', 'tool-call']);
});

test('evalTable: a model with scores gets its per-task scores mapped, missing tasks null', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  const a = table.rows.find((r) => r.id === 'model-a');
  assert.equal(a.hasAnyEval, true);
  assert.equal(a.scores['tool-call'], 0.82);
  assert.equal(a.scores.coding, 0.31);
  const b = table.rows.find((r) => r.id === 'model-b');
  assert.equal(b.hasAnyEval, true);
  assert.equal(b.scores['tool-call'], 0.5);
  assert.equal(b.scores.coding, null);
});

test('evalTable: mean is averaged over the tasks a model actually has scores for, not all columns', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  const a = table.rows.find((r) => r.id === 'model-a');
  assert.ok(Math.abs(a.mean - (0.82 + 0.31) / 2) < 1e-9);
  const b = table.rows.find((r) => r.id === 'model-b');
  assert.equal(b.mean, 0.5);
});

test('evalTable: a model absent from the evals payload gets hasAnyEval:false, all-null scores, mean:null', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  const c = table.rows.find((r) => r.id === 'model-c');
  assert.equal(c.hasAnyEval, false);
  assert.deepEqual(c.scores, { coding: null, 'tool-call': null });
  assert.equal(c.mean, null);
});

test('evalTable: carries caps and dec through from the roster row for the model/caps/decode columns', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  const a = table.rows.find((r) => r.id === 'model-a');
  assert.deepEqual(a.caps, ['mtp', 'vision']);
  assert.equal(a.dec, 100.5);
});

test('evalTable: rows follow the input roster order, one row per roster model', () => {
  const table = evalTable(EVAL_ROWS_FIXTURE, EVALS_FIXTURE);
  assert.deepEqual(table.rows.map((r) => r.id), ['model-a', 'model-b', 'model-c']);
});

test('evalTable: a duplicate (model, task) pair keeps the last occurrence in the payload', () => {
  const dup = [
    { run_id: 'run-1', model: 'model-a', task: 'tool-call', score: 0.2 },
    { run_id: 'run-5', model: 'model-a', task: 'tool-call', score: 0.9 },
  ];
  const table = evalTable(EVAL_ROWS_FIXTURE, dup);
  const a = table.rows.find((r) => r.id === 'model-a');
  assert.equal(a.scores['tool-call'], 0.9);
});

test('evalTable: malformed eval entries (missing model/task/non-numeric score) are skipped, not thrown', () => {
  const messy = [
    { run_id: 'run-1', model: 'model-a', task: 'tool-call', score: 0.82 },
    { run_id: 'run-2', model: 'model-b', task: null, score: 0.5 },
    { run_id: 'run-3', model: null, task: 'tool-call', score: 0.5 },
    { run_id: 'run-4', model: 'model-b', task: 'coding', score: 'not-a-number' },
    null,
  ];
  const table = evalTable(EVAL_ROWS_FIXTURE, messy);
  assert.deepEqual(table.tasks, ['tool-call']);
  const b = table.rows.find((r) => r.id === 'model-b');
  assert.equal(b.hasAnyEval, false);
});

test('evalScoreBucket: score >= 0.75 is good (pass)', () => {
  assert.equal(evalScoreBucket(0.75), 'good');
  assert.equal(evalScoreBucket(0.99), 'good');
});

test('evalScoreBucket: score < 0.4 is bad (fail)', () => {
  assert.equal(evalScoreBucket(0.39), 'bad');
  assert.equal(evalScoreBucket(0), 'bad');
});

test('evalScoreBucket: score in [0.4, 0.75) is neither — no bucket', () => {
  assert.equal(evalScoreBucket(0.4), null);
  assert.equal(evalScoreBucket(0.74), null);
});

test('evalScoreBucket: null/undefined score returns null', () => {
  assert.equal(evalScoreBucket(null), null);
  assert.equal(evalScoreBucket(undefined), null);
});

// --- cellKey (BenchRow / drawerModel) ------------------------------------

test('normalizeApiRoster: carries cell_key through as cellKey; snapshot rows have cellKey:null', () => {
  const apiRows = normalizeApiRoster(API_FIXTURE);
  // API_FIXTURE cells carry no cell_key field — tolerated as null, never invented.
  assert.ok(apiRows.every((r) => r.cellKey === null));

  const withCellKey = normalizeApiRoster({
    models: [{ model_id: 'model-x', cells: [{ lane: 'rocm', kind: 'tg', cell_key: 'sha256:abc', decode_ts_med: 1 }] }],
  });
  assert.equal(withCellKey[0].cellKey, 'sha256:abc');

  const snapshotRows = normalizeRoster(ROSTER_FIXTURE);
  assert.ok(snapshotRows.every((r) => r.cellKey === null));
});

test('normalizeApiRoster: a non-string/empty cell_key stays null, never invented', () => {
  const rows = normalizeApiRoster({
    models: [
      { model_id: 'model-x', cells: [{ lane: 'rocm', cell_key: '', decode_ts_med: 1 }] },
      { model_id: 'model-y', cells: [{ lane: 'rocm', cell_key: 42, decode_ts_med: 1 }] },
    ],
  });
  assert.ok(rows.every((r) => r.cellKey === null));
});

test('drawerModel: snapshot mode has cellKey:null; api mode carries the row\'s cellKey through', () => {
  const [snapRow] = normalizeRoster(ROSTER_FIXTURE);
  assert.equal(drawerModel(snapRow).cellKey, null);

  const apiRow = { id: 'm', runId: 'run-1', cellKey: 'sha256:def', measured: true };
  assert.equal(drawerModel(apiRow).cellKey, 'sha256:def');
});

// --- runFailureMessage ----------------------------------------------------

test('runFailureMessage: 404 reads as "not published", distinct from an outage', () => {
  assert.equal(runFailureMessage(404), "This run hasn't been published.");
});

test('runFailureMessage: any other status (or none at all, e.g. a network failure) reads as unreachable', () => {
  assert.equal(runFailureMessage(500), 'Could not load full run detail — the API may be unreachable.');
  assert.equal(runFailureMessage(503), 'Could not load full run detail — the API may be unreachable.');
  assert.equal(runFailureMessage(null), 'Could not load full run detail — the API may be unreachable.');
  assert.equal(runFailureMessage(undefined), 'Could not load full run detail — the API may be unreachable.');
});

// --- liveAgeMinutes / liveBadgeText / snapshotBadgeText --------------------

test('liveAgeMinutes: minutes elapsed between generated and now, rounded, never negative', () => {
  const now = Date.parse('2026-08-09T12:10:00Z');
  assert.equal(liveAgeMinutes('2026-08-09T12:00:00Z', now), 10);
  assert.equal(liveAgeMinutes('2026-08-09T12:09:40Z', now), 0);
  // A generated timestamp in the "future" (clock skew) never reads as negative minutes.
  assert.equal(liveAgeMinutes('2026-08-09T12:20:00Z', now), 0);
});

test('liveAgeMinutes: missing/malformed generated returns null, never NaN', () => {
  const now = Date.parse('2026-08-09T12:10:00Z');
  assert.equal(liveAgeMinutes(undefined, now), null);
  assert.equal(liveAgeMinutes(null, now), null);
  assert.equal(liveAgeMinutes('', now), null);
  assert.equal(liveAgeMinutes('not-a-date', now), null);
  assert.equal(liveAgeMinutes(12345, now), null);
});

test('liveBadgeText: renders "N min ago" when age is known', () => {
  assert.equal(liveBadgeText('api.hal0.dev', 10), 'live · api.hal0.dev, 10 min ago');
  assert.equal(liveBadgeText('api.hal0.dev', 0), 'live · api.hal0.dev, 0 min ago');
});

test('liveBadgeText: "freshness unknown" when age is null, never "NaN min ago"', () => {
  assert.equal(liveBadgeText('api.hal0.dev', null), 'live · api.hal0.dev, freshness unknown');
});

test('snapshotBadgeText: default reason is the plain snapshot state', () => {
  const { text, title } = snapshotBadgeText('2026-06-19');
  assert.equal(text, 'snapshot from 2026-06-19');
  assert.match(title, /not live/);
});

test('snapshotBadgeText: "unreachable" and "invalid" reasons render distinct, honest copy', () => {
  const unreachable = snapshotBadgeText('2026-06-19', 'unreachable');
  assert.equal(unreachable.text, 'snapshot from 2026-06-19 · api unreachable');
  assert.match(unreachable.title, /did not answer/);

  const invalid = snapshotBadgeText('2026-06-19', 'invalid');
  assert.equal(invalid.text, 'snapshot from 2026-06-19 · live data invalid');
  assert.match(invalid.title, /could not render/);
});

// --- laneGraphColor / laneMarkerShape --------------------------------------

test('laneGraphColor: known lanes get the dashboard-ported hexes (rocm blue, vulkan_radv gold)', () => {
  assert.equal(laneGraphColor('rocm'), '#7fb8ff');
  assert.equal(laneGraphColor('vulkan_radv'), '#f9d884');
});

test('laneGraphColor: unknown/null lane gets a neutral fallback, never invented', () => {
  assert.equal(laneGraphColor('default'), '#9c9c95');
  assert.equal(laneGraphColor(null), '#9c9c95');
  assert.equal(laneGraphColor(undefined), '#9c9c95');
});

test('laneMarkerShape: circle=rocm, square=vulkan_radv, triangle for anything else (never invisible)', () => {
  assert.equal(laneMarkerShape('rocm'), 'circle');
  assert.equal(laneMarkerShape('vulkan_radv'), 'square');
  assert.equal(laneMarkerShape('default'), 'triangle');
  assert.equal(laneMarkerShape(null), 'triangle');
});

// --- normalizeHistoryPoints -------------------------------------------------

test('normalizeHistoryPoints: keeps points with at least one real metric', () => {
  const points = normalizeHistoryPoints({
    points: [
      { ts: '2026-08-01', decode_ts_med: 50.2, prefill_ts_med: 900.1, lane: 'rocm' },
      { ts: '2026-08-05', decode_ts_med: 52.0, lane: 'rocm' },
    ],
  });
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { ts: '2026-08-01', decode: 50.2, prefill: 900.1, lane: 'rocm' });
  assert.deepEqual(points[1], { ts: '2026-08-05', decode: 52.0, prefill: null, lane: 'rocm' });
});

test('normalizeHistoryPoints: drops points with neither metric as a real number, never invents', () => {
  const points = normalizeHistoryPoints({
    points: [
      { ts: 'a', decode_ts_med: null, prefill_ts_med: null },
      { ts: 'b', decode_ts_med: 'not-a-number' },
      { ts: 'c' },
      null,
      { ts: 'd', decode_ts_med: 40 },
    ],
  });
  assert.deepEqual(points.map((p) => p.ts), ['d']);
});

test('normalizeHistoryPoints: tolerates a missing/malformed points array', () => {
  assert.deepEqual(normalizeHistoryPoints({}), []);
  assert.deepEqual(normalizeHistoryPoints({ points: 'not-an-array' }), []);
  assert.deepEqual(normalizeHistoryPoints(null), []);
  assert.deepEqual(normalizeHistoryPoints(undefined), []);
});

test('normalizeHistoryPoints: a non-string lane is dropped to null rather than kept as garbage', () => {
  const points = normalizeHistoryPoints({ points: [{ ts: 'a', decode_ts_med: 1, lane: 42 }] });
  assert.equal(points[0].lane, null);
});

// --- sparklineGeometry -------------------------------------------------

test('sparklineGeometry: no usable points on either metric → empty', () => {
  const geo = sparklineGeometry([{ decode: null, prefill: null }]);
  assert.deepEqual(geo, { width: 260, height: 54, empty: true });
});

test('sparklineGeometry: empty input array → empty', () => {
  assert.deepEqual(sparklineGeometry([]), { width: 260, height: 54, empty: true });
});

test('sparklineGeometry: a single point is still plotted (centered marker), not withheld', () => {
  const geo = sparklineGeometry([{ decode: 50, prefill: 900 }]);
  assert.equal(geo.single, true);
  assert.deepEqual(geo.decode, { x: 130, y: 27, v: 50 });
  assert.deepEqual(geo.prefill, { x: 130, y: 27, v: 900 });
});

test('sparklineGeometry: a single point with only one metric leaves the other null', () => {
  const geo = sparklineGeometry([{ decode: 50, prefill: null }]);
  assert.ok(geo.decode);
  assert.equal(geo.prefill, null);
});

test('sparklineGeometry: 2+ points produce a decode path, markers, and a min/max scale', () => {
  const geo = sparklineGeometry([
    { decode: 40, prefill: 800 },
    { decode: 60, prefill: 900 },
    { decode: 50, prefill: 810 },
  ]);
  assert.match(geo.decodePath, /^M6\.0,/);
  assert.equal(geo.decodeMarkers.length, 3);
  assert.equal(geo.decodeMin, 40);
  assert.equal(geo.decodeMax, 60);
  // decode and prefill markers carry their own raw values (v), never mixed —
  // the shared `v` is what a caller renders as the plotted number/tooltip.
  assert.deepEqual(geo.decodeMarkers.map((m) => m.v), [40, 60, 50]);
  assert.deepEqual(geo.prefillMarkers.map((m) => m.v), [800, 900, 810]);
  // decode and prefill scale independently: prefill's 3rd point (810) sits
  // near ITS series' min (800), while decode's 3rd point (50) sits at the
  // midpoint of ITS series (40-60) — a shared scale would put both at the
  // same normalized position; independent scales don't.
  assert.notEqual(geo.decodeMarkers[2].y, geo.prefillMarkers[2].y);
});

test('sparklineGeometry: prefill draws a path only with 2+ of its own points (a lone prefill sample still gets a marker)', () => {
  const geo = sparklineGeometry([
    { decode: 40, prefill: 800 },
    { decode: 60, prefill: null },
  ]);
  assert.equal(geo.prefillPath, '');
  assert.equal(geo.prefillMarkers.length, 1);
});

test('sparklineGeometry: flat series (all equal values) doesn\'t divide by zero — span falls back to 1', () => {
  const geo = sparklineGeometry([
    { decode: 50, prefill: null },
    { decode: 50, prefill: null },
  ]);
  assert.ok(Number.isFinite(geo.decodeMarkers[0].y));
  assert.ok(Number.isFinite(geo.decodeMarkers[1].y));
});

test('sparklineGeometry: respects custom width/height/pad', () => {
  const geo = sparklineGeometry([{ decode: 1, prefill: null }], { width: 100, height: 20, pad: 2 });
  assert.equal(geo.width, 100);
  assert.equal(geo.height, 20);
  assert.deepEqual(geo.decode, { x: 50, y: 10, v: 1 });
});
