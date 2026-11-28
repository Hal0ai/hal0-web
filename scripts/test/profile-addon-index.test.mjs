// scripts/test/profile-addon-index.test.mjs
//
// /profiles/index.json (src/pages/profiles/index.json.ts): the
// `hal0.addon-index` hal0's dashboard reads. hal0 refuses a row whose
// checksum differs from its envelope's, whose `file` is anything but a bare
// envelope name, or whose name differs from the envelope's, so those are
// pinned here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addonIndex, isSeed, profileEnvelope } from '../../src/lib/profile-envelope.mjs';
import snapshot from '../../src/data/profiles.json' with { type: 'json' };

const records = snapshot.profiles;
const index = addonIndex(records);

test('the index is a hal0.addon-index, schema 1', () => {
  assert.equal(index.kind, 'hal0.addon-index');
  assert.equal(index.schema_version, 1);
  assert.deepEqual(Object.keys(index), ['kind', 'schema_version', 'addons']);
});

test('one row per importable profile, none for a built-in one, sorted by name', () => {
  const importable = records.filter((r) => !isSeed(r)).map((r) => r.profile.slug).sort();
  assert.ok(importable.length > 0);
  assert.deepEqual(index.addons.map((a) => a.name), importable);
});

test('every row agrees with the envelope the site serves for it', () => {
  for (const row of index.addons) {
    const record = records.find((r) => r.profile.slug === row.name);
    const envelope = profileEnvelope(record);
    assert.equal(row.checksum, envelope.checksum, row.name);
    assert.equal(envelope.name, row.name);
    assert.equal(row.file, `${row.name}.hal0profile.json`);
    assert.match(row.file, /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.hal0profile\.json$/);
    assert.equal(row.runner, envelope.profile.runner ?? null);
  }
});

test('every row carries the contract fields with the contract types', () => {
  for (const row of index.addons) {
    for (const key of ['name', 'title', 'description', 'runtime_family', 'checksum', 'file', 'min_hal0_version']) {
      assert.equal(typeof row[key], 'string', `${row.name}.${key}`);
      assert.ok(row[key].length > 0, `${row.name}.${key} is empty`);
    }
    assert.match(row.min_hal0_version, /^\d+\.\d+\.\d+$/);
    assert.ok(row.runner === null || typeof row.runner === 'string');
  }
});

test('a record with no floor of its own gets 1.5.0; one that names a floor keeps it', () => {
  const base = { profile: { slug: 'x', title: 'X' }, tune: { flags: '-fa on' } };
  assert.equal(addonIndex([base]).addons[0].min_hal0_version, '1.5.0');
  assert.equal(addonIndex([{ ...base, runtime: { min_hal0: '1.8.2' } }]).addons[0].min_hal0_version, '1.8.2');
});

test('the optional extras are typed, and absent when the record has none', () => {
  const bare = addonIndex([{ profile: { slug: 'x' }, tune: {} }]).addons[0];
  assert.deepEqual(Object.keys(bare), [
    'name', 'title', 'description', 'runtime_family', 'runner', 'checksum', 'file', 'min_hal0_version',
  ]);
  const full = addonIndex([
    {
      profile: { slug: 'y', title: 'Y', summary: 'A tune.', intent: 'chat', author: 'hal0', first_party: true },
      tune: { intent: 'Y tune · 32K', runner: 'standard' },
      history: [{ v: 1, date: '2026-01-01' }, { v: 3, date: '2026-02-01' }],
    },
  ]).addons[0];
  assert.equal(full.category, 'chat');
  assert.equal(full.summary, 'A tune.');
  assert.equal(full.author, 'hal0');
  assert.equal(full.first_party, true);
  assert.equal(full.version, 3);
  assert.equal(full.description, 'Y tune · 32K');
  assert.equal(full.runner, 'standard');
});
