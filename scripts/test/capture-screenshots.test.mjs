import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOTS } from '../capture-screenshots.mjs';

test('shot names are unique kebab-case', () => {
  const names = SHOTS.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('every shot has a hash route and an expect or clip', () => {
  for (const s of SHOTS) {
    assert.ok(s.route.startsWith('#'), `${s.name} route`);
    assert.ok(s.expect || s.clip, `${s.name} needs expect or clip`);
  }
});

test('required shots exist', () => {
  const names = SHOTS.map((s) => s.name);
  for (const n of ['slot-card', 'profile-edit-drawer', 'slot-drawer', 'mtp-control', 'dashboard-overview', 'slots-inference', 'memory-graph']) {
    assert.ok(names.includes(n), n);
  }
});

test('no shot targets ri-defaults testid', () => {
  for (const s of SHOTS) {
    assert.ok(!`${s.expect ?? ''}${s.clip ?? ''}`.includes('data-testid="ri-defaults"'), s.name);
  }
});
