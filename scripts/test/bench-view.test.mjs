import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeBucket,
  decodeBucketFill,
  cellsMatching,
  bestCell,
  cellForLane,
  rowsFromRoster,
  facetOptions,
  rowsFromSnapshot,
  joinSnapshotIdentity,
  applyCaps,
  applyQuery,
  compareRows,
  sortRows,
} from '../../src/lib/bench-view.mjs';

test('decodeBucket boundaries match the roster wording (fast >=60, mid >=25, slow <25)', () => {
  assert.equal(decodeBucket(60), 'fast');
  assert.equal(decodeBucket(59.9), 'mid');
  assert.equal(decodeBucket(25), 'mid');
  assert.equal(decodeBucket(24.9), 'slow');
  assert.equal(decodeBucket(0), 'slow');
  assert.equal(decodeBucket(null), null);
  assert.equal(decodeBucket(undefined), null);
  assert.equal(decodeBucket(NaN), null);
});

test('decodeBucketFill maps bucket to meter segment count', () => {
  assert.equal(decodeBucketFill('fast'), 3);
  assert.equal(decodeBucketFill('mid'), 2);
  assert.equal(decodeBucketFill('slow'), 1);
  assert.equal(decodeBucketFill(null), 0);
});

const cells = [
  { cell_key: 'a', lane: 'rocm', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 40, prefill_ts_med: 500, ttft_ms_p50: 10, ttft_ms_p95: 20, accept_med: null, run_id: 'r1', measured_at: 't1', flagged: false },
  { cell_key: 'b', lane: 'vulkan_radv', kind: 'tg', depth: 2048, config_label: 'default', decode_ts_med: 55, prefill_ts_med: 480, ttft_ms_p50: 12, ttft_ms_p95: 22, accept_med: null, run_id: 'r2', measured_at: 't2', flagged: false },
  { cell_key: 'c', lane: 'rocm', kind: 'tg', depth: 8192, config_label: 'default', decode_ts_med: 30, prefill_ts_med: 400, ttft_ms_p50: 14, ttft_ms_p95: 24, accept_med: null, run_id: 'r3', measured_at: 't3', flagged: false },
  { cell_key: 'd', lane: 'rocm', kind: 'pp', depth: 2048, config_label: 'default', decode_ts_med: 90, prefill_ts_med: 900, ttft_ms_p50: 8, ttft_ms_p95: 18, accept_med: null, run_id: 'r4', measured_at: 't4', flagged: false },
];

test('cellsMatching filters by kind/depth/configLabel independently, ignoring unset dimensions', () => {
  assert.equal(cellsMatching(cells, { kind: 'tg' }).length, 3);
  assert.equal(cellsMatching(cells, { kind: 'tg', depth: 2048 }).length, 2);
  assert.equal(cellsMatching(cells, {}).length, 4);
  assert.deepEqual(cellsMatching(cells, { kind: 'pp' }).map((c) => c.cell_key), ['d']);
});

test('bestCell picks the highest decode_ts_med and ignores nulls', () => {
  assert.equal(bestCell(cells).cell_key, 'd');
  assert.equal(bestCell([]), null);
  assert.equal(bestCell([{ decode_ts_med: null }]), null);
});

test('cellForLane: "best"/unset picks max-decode, a named lane picks that exact lane', () => {
  const tg2048 = cellsMatching(cells, { kind: 'tg', depth: 2048 });
  assert.equal(cellForLane(tg2048, 'best').cell_key, 'b');
  assert.equal(cellForLane(tg2048).cell_key, 'b');
  assert.equal(cellForLane(tg2048, 'rocm').cell_key, 'a');
  assert.equal(cellForLane(tg2048, 'nonexistent-lane'), null);
});

const models = [
  { model_id: 'model-a', quant: 'q4', host: { gpu: 'x', mem_gb: 12 }, cells },
  { model_id: 'model-b', quant: 'q4', host: { mem_gb: 8 }, cells: [{ cell_key: 'z', lane: 'rocm', kind: 'chat', depth: 4096, config_label: 'default', decode_ts_med: 20, prefill_ts_med: 100, ttft_ms_p50: 5, ttft_ms_p95: 9, accept_med: 0.5, run_id: 'r5', measured_at: 't5', flagged: true }] },
];

test('rowsFromRoster builds one row per model matching the filter, dropping models with no matching cell', () => {
  const rows = rowsFromRoster(models, { kind: 'tg', depth: 2048, configLabel: 'default', lane: 'best' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'model-a');
  assert.equal(rows[0].dec, 55);
  assert.equal(rows[0].lane, 'vulkan_radv');
  assert.equal(rows[0].live, true);
});

test('rowsFromRoster default view (tg @ 2048, default, best) matches comp spec', () => {
  const rows = rowsFromRoster(models, { kind: 'tg', depth: 2048, configLabel: 'default', lane: 'best' });
  assert.equal(rows.length, 1);
});

test('rowsFromRoster picks a named lane per-model and carries run identity fields', () => {
  const rows = rowsFromRoster(models, { kind: 'tg', depth: 2048, configLabel: 'default', lane: 'rocm' });
  assert.equal(rows[0].runId, 'r1');
  assert.equal(rows[0].measuredAt, 't1');
});

test('facetOptions dedups and sorts kinds/depths/variants/lanes across all models', () => {
  const opts = facetOptions(models);
  assert.deepEqual(opts.kinds, ['chat', 'pp', 'tg']);
  assert.deepEqual(opts.depths, [2048, 4096, 8192]);
  assert.deepEqual(opts.variants, ['default']);
  assert.deepEqual(opts.lanes, ['rocm', 'vulkan_radv']);
});

const roster = [
  { id: 'model-a', hfRepo: 'org/model-a', caps: ['mtp'], params: '7B', kv: 'q4', spec: 'draft-mtp', gb: 5, dec: 40, pf: 500, acc: 80, measured: true },
  { id: 'model-c', hfRepo: '', caps: [], params: '3B', kv: 'q4', spec: 'none', gb: 2, dec: 10, pf: 100, acc: null, measured: true },
  { id: 'model-unmeasured', hfRepo: '', caps: [], params: '1B', kv: 'q4', spec: 'none', gb: null, dec: null, pf: null, acc: null, measured: false },
];

test('rowsFromSnapshot only includes measured rows and never invents ttft/lane/depth', () => {
  const rows = rowsFromSnapshot(roster);
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.ttftP50, null);
    assert.equal(r.ttftP95, null);
    assert.equal(r.lane, null);
    assert.equal(r.depth, null);
    assert.equal(r.live, false);
  }
});

test('joinSnapshotIdentity attaches caps/hfRepo/params from the roster by id, leaves unmatched rows alone', () => {
  const live = rowsFromRoster(models, { kind: 'tg', depth: 2048, configLabel: 'default', lane: 'best' });
  const joined = joinSnapshotIdentity(live, roster);
  assert.deepEqual(joined[0].caps, ['mtp']);
  assert.equal(joined[0].hfRepo, 'org/model-a');
  assert.equal(joined[0].params, '7B');
  const noMatch = joinSnapshotIdentity([{ id: 'ghost', caps: [], hfRepo: null, params: null, kv: null, spec: null, gb: null }], roster);
  assert.deepEqual(noMatch[0].caps, []);
});

test('applyCaps requires every requested cap (AND), applyCaps([]) is a no-op', () => {
  const rows = [
    { id: 'a', caps: ['mtp', 'vision'] },
    { id: 'b', caps: ['mtp'] },
    { id: 'c', caps: [] },
  ];
  assert.equal(applyCaps(rows, []).length, 3);
  assert.deepEqual(applyCaps(rows, ['mtp']).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(applyCaps(rows, ['mtp', 'vision']).map((r) => r.id), ['a']);
});

test('applyQuery is a case-insensitive substring match on id', () => {
  const rows = [{ id: 'Qwen3-Coder-Next' }, { id: 'gemma-4-12b' }];
  assert.deepEqual(applyQuery(rows, 'coder').map((r) => r.id), ['Qwen3-Coder-Next']);
  assert.deepEqual(applyQuery(rows, 'QWEN').map((r) => r.id), ['Qwen3-Coder-Next']);
  assert.equal(applyQuery(rows, '').length, 2);
});

test('compareRows sorts numerics arithmetically, strings via localeCompare, and always pushes nulls last', () => {
  assert.ok(compareRows({ v: 1 }, { v: 2 }, 'v', 1) < 0);
  assert.ok(compareRows({ v: 1 }, { v: 2 }, 'v', -1) > 0);
  assert.ok(compareRows({ v: 'b' }, { v: 'a' }, 'v', 1) > 0);
  assert.equal(compareRows({ v: null }, { v: 5 }, 'v', 1), 1);
  assert.equal(compareRows({ v: 5 }, { v: null }, 'v', 1), -1);
  assert.equal(compareRows({ v: null }, { v: null }, 'v', 1), 0);
  // nulls stay last even descending
  assert.equal(compareRows({ v: null }, { v: 5 }, 'v', -1), 1);
});

test('sortRows returns a new array sorted by key/dir without mutating the input', () => {
  const rows = [{ id: 'a', dec: 10 }, { id: 'b', dec: 30 }, { id: 'c', dec: 20 }];
  const copy = [...rows];
  const sorted = sortRows(rows, 'dec', -1);
  assert.deepEqual(sorted.map((r) => r.id), ['b', 'c', 'a']);
  assert.deepEqual(rows, copy);
});
