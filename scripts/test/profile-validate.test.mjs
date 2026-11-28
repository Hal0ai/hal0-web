// scripts/test/profile-validate.test.mjs
//
// Unit tests for the client-side profile validator (src/lib/profile-validate.mjs),
// covering the four wireframe validation states plus the duplicate-slug edge
// state and the GitHub submit-URL builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse as parseToml } from 'smol-toml';
import {
  countFlags,
  deniedFlags,
  locateLine,
  collectSchemaIssues,
  validateProfileToml,
  githubSubmitUrl,
  GITHUB_URL_WARN_LENGTH,
} from '../../src/lib/profile-validate.mjs';

const VALID_TOML = `schema = 2

[profile]
slug = "qwen3-9b-longctx"
title = "Long-context chat slot"
summary = "64K context, q8 KV cache."
intent = "chat"
author = "lemond"

[runtime]
family = "llama-server"
min_hal0 = "1.8.3"

[tune]
flags = "-fa auto -ctk q8_0 -ctv q8_0 -b 2048 -ub 512 --parallel 1 --reasoning-budget -1"
ctx_size = 65536
vision = "off"

[model]
id = "qwen3.5-9b-q4kxl"

[[history]]
v = 1
date = "2026-08-01"
note = "initial"
`;

const FLAGS_LINE = 'flags = "-fa auto -ctk q8_0 -ctv q8_0 -b 2048 -ub 512 --parallel 1 --reasoning-budget -1"\n';
const MODEL_TABLE = '[model]\nid = "qwen3.5-9b-q4kxl"\n\n';

const ROSTER = [{ id: 'qwen3.5-9b-q4kxl', measured: true, dec: 42.1, pf: 900, gb: 6 }];

function withField(toml, find, replace) {
  assert.ok(toml.includes(find), `fixture must contain ${JSON.stringify(find)}`);
  return toml.replace(find, replace);
}

test('countFlags counts flag tokens, not their values', () => {
  assert.equal(countFlags('-fa auto -b 2048 -ub 512 --parallel 1 --temp 0'), 5);
  assert.equal(countFlags('--reasoning-budget -1 --seed 123'), 2, 'a negative number is a value');
  assert.equal(countFlags(''), 0);
  assert.equal(countFlags(undefined), 0);
  assert.equal(countFlags('-'), 0);
});

test('locateLine finds a key inside its table', () => {
  const loc = locateLine(VALID_TOML, 'runtime.family');
  assert.ok(loc);
  assert.equal(loc.text.trim(), 'family = "llama-server"');
});

test('locateLine returns null for a key it cannot find', () => {
  assert.equal(locateLine(VALID_TOML, 'runtime.nope'), null);
});

test('collectSchemaIssues finds nothing wrong with a valid profile', () => {
  const parsed = parseToml(VALID_TOML);
  assert.deepEqual(collectSchemaIssues(parsed), []);
});

test('validateProfileToml: pass state — full summary, in-roster chip, linked runs', () => {
  const result = validateProfileToml(VALID_TOML, { rosterRows: ROSTER, existingProfiles: [] });
  assert.equal(result.state, 'pass');
  assert.equal(result.blocking, false);
  assert.equal(result.summary.slug, 'qwen3-9b-longctx');
  assert.equal(result.summary.intent, 'chat');
  assert.equal(result.summary.modelId, 'qwen3.5-9b-q4kxl');
  assert.equal(result.summary.modelKnown, true);
  assert.equal(result.summary.family, 'llama-server');
  assert.equal(result.summary.minHal0, '1.8.3');
  assert.equal(result.summary.contextSize, 65536);
  assert.equal(result.summary.flagCount, 7);
  assert.equal(result.summary.linkedRuns, 1);
});

test('validateProfileToml: a profile that names no model passes, with nothing to look up', () => {
  const noModel = withField(VALID_TOML, MODEL_TABLE, '');
  const result = validateProfileToml(noModel, { rosterRows: ROSTER, existingProfiles: [] });
  assert.equal(result.state, 'pass');
  assert.equal(result.summary.modelId, null);
  assert.equal(result.summary.modelKnown, true);
  assert.equal(result.summary.linkedRuns, 0);
});

test('validateProfileToml: schema-error state on malformed TOML syntax, with a line number', () => {
  const broken = 'schema = 2\n[profile\nslug = "x"\n';
  const result = validateProfileToml(broken);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.blocking, true);
  assert.equal(result.parseError, true);
  assert.equal(typeof result.line, 'number');
});

test('validateProfileToml: schema-error state on an invalid enum value, railed to its line', () => {
  const bad = withField(VALID_TOML, 'family = "llama-server"', 'family = "llama.cpp"');
  const result = validateProfileToml(bad);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.blocking, true);
  assert.equal(result.primary.path, 'runtime.family');
  assert.match(result.primary.message, /must be one of llama-server/);
  assert.equal(result.line, 11);
});

test('validateProfileToml: missing-fields state scoped to intent, runtime.family and the tune', () => {
  const missing = VALID_TOML.replace('intent = "chat"\n', '')
    .replace('family = "llama-server"\n', '')
    .replace(FLAGS_LINE, '')
    .replace('ctx_size = 65536\n', '')
    .replace('vision = "off"\n', '');
  const result = validateProfileToml(missing);
  assert.equal(result.state, 'missing-fields');
  assert.equal(result.blocking, true);
  const keys = result.missing.map((m) => m.key).sort();
  assert.deepEqual(keys, ['profile.intent', 'runtime.family', 'tune']);
  for (const m of result.missing) {
    assert.ok(m.why.length > 0, `${m.key} should carry a why-it-matters string`);
  }
});

test('validateProfileToml: other missing required fields (e.g. profile.title) are a schema error, not missing-fields', () => {
  const missingTitle = VALID_TOML.replace('title = "Long-context chat slot"\n', '');
  const result = validateProfileToml(missingTitle);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.primary.path, 'profile.title');
});

test('validateProfileToml: warning state for an unknown model id, non-blocking', () => {
  const unknownModel = withField(VALID_TOML, 'id = "qwen3.5-9b-q4kxl"', 'id = "qwen3.7-11b-experimental"');
  const result = validateProfileToml(unknownModel, { rosterRows: ROSTER, existingProfiles: [] });
  assert.equal(result.state, 'warning');
  assert.equal(result.blocking, false);
  assert.equal(result.reason, 'unknown-model');
  assert.equal(result.summary.modelKnown, false);
});

test('validateProfileToml: warning state also clears via an existing profile.model.compatible entry', () => {
  const compatModel = withField(VALID_TOML, 'id = "qwen3.5-9b-q4kxl"', 'id = "qwen3.5-9b-mtp-variant"');
  const existingProfiles = [
    { profile: { slug: 'other' }, model: { id: 'other-model', compatible: ['qwen3.5-9b-mtp-variant'] }, history: [{ v: 1 }] },
  ];
  const result = validateProfileToml(compatModel, { rosterRows: ROSTER, existingProfiles });
  assert.equal(result.state, 'pass');
  assert.equal(result.summary.modelKnown, true);
});

test('validateProfileToml: duplicate-slug edge state offers the version-bump path', () => {
  const existingProfiles = [
    {
      profile: { slug: 'qwen3-9b-longctx', author: 'kyuz0' },
      model: { id: 'qwen3.5-9b-q4kxl' },
      history: [{ v: 6, date: '2026-07-01', note: 'x' }],
    },
  ];
  const result = validateProfileToml(VALID_TOML, { rosterRows: ROSTER, existingProfiles });
  assert.equal(result.state, 'duplicate-slug');
  assert.equal(result.blocking, true);
  assert.equal(result.author, 'kyuz0');
  assert.equal(result.currentVersion, 6);
  assert.equal(result.nextVersion, 7);
});

// ── CI-parity gaps (validator must be at least as strict as
// hal0-profiles/lib/validate.mjs — a pass-here/fail-in-review hole is the
// worst outcome for this page) ────────────────────────────────────────

test('collectSchemaIssues rejects an empty-string model.id (minLength 1)', () => {
  const bad = withField(VALID_TOML, 'id = "qwen3.5-9b-q4kxl"', 'id = ""');
  const result = validateProfileToml(bad);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.blocking, true);
  assert.ok(
    result.issues.some((i) => i.path === 'model.id'),
    'expected an issue at model.id'
  );
});

test('collectSchemaIssues rejects an unknown key in any table (additionalProperties: false)', () => {
  const unknownProfileKey = withField(VALID_TOML, 'author = "lemond"', 'author = "lemond"\nnickname = "lem"');
  const r1 = validateProfileToml(unknownProfileKey);
  assert.equal(r1.state, 'schema-error');
  assert.ok(r1.issues.some((i) => i.path === 'profile.nickname'));

  const unknownRootKey = `${VALID_TOML}\n[extra]\nfoo = "bar"\n`;
  const r2 = validateProfileToml(unknownRootKey);
  assert.equal(r2.state, 'schema-error');
  assert.ok(r2.issues.some((i) => i.path === 'extra'));
});

test('collectSchemaIssues rejects out-of-order and duplicate history versions', () => {
  const outOfOrder = VALID_TOML.replace(
    '[[history]]\nv = 1\ndate = "2026-08-01"\nnote = "initial"\n',
    '[[history]]\nv = 1\ndate = "2026-08-01"\nnote = "initial"\n\n[[history]]\nv = 2\ndate = "2026-08-05"\nnote = "bumped after v1, out of order"\n'
  );
  const r1 = validateProfileToml(outOfOrder);
  assert.equal(r1.state, 'schema-error');
  assert.ok(
    r1.issues.some((i) => i.path === 'history[1].v' && /strictly descending/.test(i.message)),
    'expected an ordering issue at history[1].v'
  );

  const duplicateV = VALID_TOML.replace(
    '[[history]]\nv = 1\ndate = "2026-08-01"\nnote = "initial"\n',
    '[[history]]\nv = 1\ndate = "2026-08-05"\nnote = "second"\n\n[[history]]\nv = 1\ndate = "2026-08-01"\nnote = "initial"\n'
  );
  const r2 = validateProfileToml(duplicateV);
  assert.equal(r2.state, 'schema-error');
  assert.ok(
    r2.issues.some((i) => i.path === 'history[1].v' && /strictly descending/.test(i.message)),
    'expected a duplicate-version issue at history[1].v'
  );
});

test('collectSchemaIssues rejects a non-integer history[i].v', () => {
  const bad = withField(VALID_TOML, 'v = 1', 'v = 1.5');
  const result = validateProfileToml(bad);
  assert.equal(result.state, 'schema-error');
  assert.ok(result.issues.some((i) => i.path === 'history[0].v' && /integer/.test(i.message)));
});

test('schema 1, the pre-1.0 shape, is refused whole with a message that says why', () => {
  const v1 = `schema = 1

[profile]
slug = "old-shape"
title = "t"
summary = "s"
intent = "chat"
author = "a"

[runner]
kind = "llama-server"
lane = "rocm"

[model]
id = "m"

[args]
raw = "-ngl 99 -c 2048"

[[history]]
v = 1
date = "2026-06-01"
note = "initial"
`;
  const result = validateProfileToml(v1);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.issues.length, 1, 'one message, not one per old key');
  assert.equal(result.primary.path, 'schema');
  assert.match(result.primary.message, /pre-1\.0/);
  assert.match(result.primary.message, /\[tune\]/);
});

test('deniedFlags finds the flags hal0 refuses in a profile, in every spelling', () => {
  const flagsOf = (raw) => deniedFlags(raw).map((d) => d.flag);
  assert.deepEqual(flagsOf('-fa auto -ngl 99 --device Vulkan0 -t 8'), ['-ngl', '--device', '-t']);
  assert.deepEqual(flagsOf('--ctx-size=8192 --ctx_size 4096 -c 2048'), ['--ctx-size=8192', '--ctx_size', '-c']);
  assert.deepEqual(flagsOf('--jinja --mmproj mmproj-f16.gguf --no-mmproj --spec-type draft'), [
    '--jinja',
    '--mmproj',
    '--no-mmproj',
    '--spec-type',
  ]);
  assert.match(deniedFlags('-c 2048')[0].reason, /tune\.ctx_size/);
  assert.match(deniedFlags('--mmproj x')[0].reason, /tune\.vision/);
  assert.match(deniedFlags('--spec-type x')[0].reason, /tune\.speculation/);
});

test('deniedFlags leaves the flags a profile may carry alone', () => {
  const allowed =
    '-fa auto -ctk q8_0 -ctv q8_0 -b 2048 -ub 512 --parallel 1 --threads-batch 8 --cache-ram 1024 ' +
    "--reasoning-budget -1 --temp 0 --chat-template-kwargs '{\"enable_thinking\":false}'";
  assert.deepEqual(deniedFlags(allowed), []);
  assert.deepEqual(deniedFlags(''), []);
  assert.deepEqual(deniedFlags(undefined), []);
});

test('a refused flag in tune.flags is a blocking schema error on a llama-server profile', () => {
  const bad = withField(VALID_TOML, '-fa auto', '-fa auto -ngl 99');
  const result = validateProfileToml(bad);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.primary.path, 'tune.flags');
  assert.match(result.primary.message, /-ngl/);
  assert.match(result.primary.message, /slot/);
  assert.equal(result.line, 15, 'railed to the flags line');
});

test('the flag screen is for llama-server: another engine keeps its own tokens', () => {
  const halogen = VALID_TOML.replace('family = "llama-server"', 'family = "halogen"')
    .replace(FLAGS_LINE, 'flags = "HALOGEN_KV_SLOTS=2 --device 0"\nrunner = "halogen"\n')
    .replace(MODEL_TABLE, '');
  assert.equal(validateProfileToml(halogen).state, 'pass');
});

test('the halogen runner and the halogen runtime family go together', () => {
  const runnerOnly = withField(VALID_TOML, 'vision = "off"', 'vision = "off"\nrunner = "halogen"');
  const r1 = validateProfileToml(runnerOnly);
  assert.equal(r1.state, 'schema-error');
  assert.ok(r1.issues.some((i) => /go together/.test(i.message)));

  const familyOnly = withField(VALID_TOML, 'family = "llama-server"', 'family = "halogen"');
  const r2 = validateProfileToml(familyOnly);
  assert.equal(r2.state, 'schema-error');
  assert.ok(r2.issues.some((i) => i.path === 'tune.runner'));
});

test('collectSchemaIssues holds [tune] to the types and ranges hal0 does', () => {
  const cases = [
    ['ctx_size = 65536', 'ctx_size = 64', 'tune.ctx_size'],
    ['ctx_size = 65536', 'ctx_size = "64K"', 'tune.ctx_size'],
    ['vision = "off"', 'vision = "on"', 'tune.vision'],
    ['vision = "off"', 'vision = "off"\nspeculation = "mtp"', 'tune.speculation'],
    ['vision = "off"', 'vision = "off"\nenable_thinking = "yes"', 'tune.enable_thinking'],
    ['vision = "off"', 'vision = "off"\nreasoning_effort = "extreme"', 'tune.reasoning_effort'],
    ['vision = "off"', 'vision = "off"\nreasoning_budget = -2', 'tune.reasoning_budget'],
    ['vision = "off"', 'vision = "off"\nrunner = "ghcr.io/hal0ai/runner:latest"', 'tune.runner'],
    ['vision = "off"', 'vision = "off"\nmtp = "auto"', 'tune.mtp'],
  ];
  for (const [find, replace, path] of cases) {
    const result = validateProfileToml(withField(VALID_TOML, find, replace));
    assert.equal(result.state, 'schema-error', `${replace} is refused`);
    assert.ok(result.issues.some((i) => i.path === path), `${replace}: issue at ${path}`);
  }
});

test('a built-in profile may have an empty tune, and must be first-party', () => {
  const seed = VALID_TOML.replace('author = "lemond"\n', 'author = "hal0"\nfirst_party = true\nseed = true\n')
    .replace(FLAGS_LINE, '')
    .replace('ctx_size = 65536\n', '')
    .replace('vision = "off"\n', '')
    .replace(MODEL_TABLE, '');
  assert.equal(validateProfileToml(seed).state, 'pass');

  const notFirstParty = seed.replace('first_party = true\n', '');
  const result = validateProfileToml(notFirstParty);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.primary.path, 'profile.seed');
});

test('a tune that only labels itself is still missing its settings', () => {
  const labelsOnly = VALID_TOML.replace(FLAGS_LINE, 'intent = "My tune"\ncloned_from = "chat"\n')
    .replace('ctx_size = 65536\n', '')
    .replace('vision = "off"\n', '');
  const result = validateProfileToml(labelsOnly);
  assert.equal(result.state, 'missing-fields');
  assert.deepEqual(result.missing.map((m) => m.key), ['tune']);
});

test('every profile in the committed snapshot validates', async () => {
  const { default: snapshot } = await import('../../src/data/profiles.json', { with: { type: 'json' } });
  assert.ok(snapshot.profiles.length > 0);
  for (const record of snapshot.profiles) {
    assert.deepEqual(collectSchemaIssues(record), [], `${record.profile.slug} is a valid schema-2 record`);
  }
});

test('githubSubmitUrl builds a pre-filled new-file URL and flags overlength', () => {
  const short = githubSubmitUrl('qwen3-9b-longctx', VALID_TOML);
  assert.match(short.url, /^https:\/\/github\.com\/Hal0ai\/hal0-profiles\/new\/main\?filename=/);
  assert.match(short.url, /value=/);
  assert.equal(short.tooLong, false);
  assert.ok(short.length < GITHUB_URL_WARN_LENGTH);

  const huge = githubSubmitUrl('qwen3-9b-longctx', 'x'.repeat(9000));
  assert.equal(huge.tooLong, true);
  assert.match(huge.fallbackUrl, /^https:\/\/github\.com\/Hal0ai\/hal0-profiles\/new\/main\?filename=/);
  assert.doesNotMatch(huge.fallbackUrl, /value=/);
});
