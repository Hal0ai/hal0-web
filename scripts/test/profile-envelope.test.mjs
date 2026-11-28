// scripts/test/profile-envelope.test.mjs
//
// The `.hal0profile.json` envelope the site builds for each importable
// profile (src/lib/profile-envelope.mjs). hal0 refuses an envelope whose
// checksum is present and wrong, so the checksum is pinned here against the
// values hal0 itself publishes for its addon profiles
// (Hal0ai/hal0 community/addons/*.hal0profile.json and index.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENVELOPE_KIND,
  TUNE_KEYS,
  bodyChecksum,
  envelopePath,
  formatContext,
  hal0ProfileToml,
  isSeed,
  profileEnvelope,
  pythonJsonDumps,
  tuneFacts,
  tuneOf,
} from '../../src/lib/profile-envelope.mjs';
import snapshot from '../../src/data/profiles.json' with { type: 'json' };

const records = snapshot.profiles;
const bySlug = (slug) => records.find((r) => r.profile.slug === slug);

// Copied from hal0's community/addons/index.json.
const HAL0_ADDON_CHECKSUMS = {
  'chat-long-context': 'sha256:f3149e0100c69e729587e5c1f5799500c8d10a439af1e6559e53cc13ccb12e2a',
  dense: 'sha256:7151d0c5c4fb3a927ac267ab225a25bf481f2b73517b9a8deb26d46adee9091a',
  moe: 'sha256:93c3d70c98b480b7c6bcbbd76211a0519a428ef6f67adafeadfbff6db84134dd',
  thinking: 'sha256:c3bc105dbf9af3a46f018915d1b5a0d14d7027c5c14012e2dbc51fcbb6028d98',
};

test('pythonJsonDumps writes what json.dumps(sort_keys=True) writes', () => {
  assert.equal(
    pythonJsonDumps({ vision: 'off', ctx_size: 32768, enable_thinking: true, flags: '-fa auto', runner: null }),
    '{"ctx_size": 32768, "enable_thinking": true, "flags": "-fa auto", "runner": null, "vision": "off"}',
  );
  assert.equal(pythonJsonDumps({ intent: 'chat · 64K' }), '{"intent": "chat \\u00b7 64K"}', 'non-ASCII is escaped');
  assert.equal(pythonJsonDumps({ a: 'q"\\\n\t' }), '{"a": "q\\"\\\\\\n\\t"}');
  assert.equal(pythonJsonDumps({ a: '😀' }), '{"a": "\\ud83d\\ude00"}', 'astral characters as surrogate pairs');
  assert.equal(pythonJsonDumps({ a: [1, -1, 'x'], b: {} }), '{"a": [1, -1, "x"], "b": {}}');
  assert.throws(() => pythonJsonDumps({ a: 1.5 }), /non-integer/);
});

test("the checksum of each hal0 addon profile equals the one hal0 publishes", () => {
  for (const [slug, checksum] of Object.entries(HAL0_ADDON_CHECKSUMS)) {
    const record = bySlug(slug);
    assert.ok(record, `the registry carries hal0's ${slug} addon`);
    assert.equal(bodyChecksum(tuneOf(record)), checksum, `${slug}: body checksum`);
    assert.equal(profileEnvelope(record).checksum, checksum, `${slug}: envelope checksum`);
  }
});

test('profileEnvelope has the fields hal0 reads, and is the same on every build', () => {
  const record = bySlug('thinking');
  const envelope = profileEnvelope(record);
  assert.deepEqual(Object.keys(envelope), [
    'kind',
    'schema_version',
    'hal0_version',
    'exported_at',
    'name',
    'checksum',
    'profile',
  ]);
  assert.equal(envelope.kind, ENVELOPE_KIND);
  assert.equal(envelope.schema_version, 2);
  assert.equal(envelope.name, 'thinking');
  assert.equal(envelope.exported_at, `${record.history[0].date}T00:00:00Z`, 'dated by the history, not the clock');
  assert.deepEqual(envelope.profile, record.tune);
  assert.deepEqual(profileEnvelope(record), envelope);
});

test('an envelope body carries only keys hal0 has on a profile, and none it refuses', () => {
  for (const record of records) {
    const body = tuneOf(record);
    for (const key of Object.keys(body)) {
      assert.ok(TUNE_KEYS.includes(key), `${record.profile.slug}: ${key} is a hal0 profile key`);
    }
    // `mtp` was renamed to `speculation` in hal0 1.5; an envelope that still
    // carries it is refused whole.
    assert.equal('mtp' in body, false, `${record.profile.slug}: no mtp key`);
    assert.equal('image' in body, false, `${record.profile.slug}: no image key`);
  }
});

test('tuneOf tolerates a record with no tune and drops unset keys', () => {
  assert.deepEqual(tuneOf({ profile: { slug: 'x' } }), {});
  assert.deepEqual(tuneOf({ tune: { vision: 'off', flags: '-fa auto', nope: 1, runner: null } }), {
    flags: '-fa auto',
    vision: 'off',
  });
});

test('isSeed is true only for a record marked as built in', () => {
  assert.equal(isSeed(bySlug('agent')), true);
  assert.equal(isSeed(bySlug('thinking')), false);
  assert.equal(isSeed({ profile: { slug: 'x', seed: 'yes' } }), false);
  assert.equal(isSeed({}), false);
});

test('hal0ProfileToml writes the table hal0 reads from profiles.toml', () => {
  assert.equal(
    hal0ProfileToml(bySlug('agent')),
    [
      '[profile.agent]',
      'flags = "-fa auto -b 2048 -ub 512 --parallel 1 --no-context-shift --temp 0 --top-p 0.95 --top-k 20 --seed 123"',
      'ctx_size = 65536',
      'enable_thinking = false',
      'vision = "off"',
      'intent = "Agent workload (bundled agent) · 64K ctx"',
    ].join('\n'),
  );
  assert.equal(hal0ProfileToml(bySlug('agent'), 'my-agent').split('\n')[0], '[profile.my-agent]');
  assert.equal(hal0ProfileToml({ profile: { slug: 'bare' } }), '[profile.bare]');
});

test('tuneFacts lists the typed settings a profile makes, in a fixed order, without the flags', () => {
  assert.deepEqual(
    tuneFacts(bySlug('agent')).map((f) => `${f.label}=${f.value}`),
    ['context=64K', 'thinking=off', 'vision=off'],
  );
  assert.deepEqual(
    tuneFacts({ tune: { reasoning_budget: -1, runner: 'halogen', ctx_size: 4096, speculation: 'ngram' } }).map(
      (f) => `${f.label}=${f.value}`,
    ),
    ['context=4096', 'reasoning budget=unlimited', 'speculation=ngram', 'runner=halogen'],
  );
  assert.deepEqual(tuneFacts(bySlug('kokoro')), [], 'a profile that sets nothing typed has no facts');
});

test('formatContext shortens only exact multiples of 1024 from 16K up', () => {
  assert.equal(formatContext(65536), '64K');
  assert.equal(formatContext(262144), '256K');
  assert.equal(formatContext(16384), '16K');
  assert.equal(formatContext(8192), '8192');
  assert.equal(formatContext(131000), '131000');
});

test('envelopePath is where the page links and the endpoint serves', () => {
  assert.equal(envelopePath('dense'), '/profiles/dense.hal0profile.json');
});
