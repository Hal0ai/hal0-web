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
  locateLine,
  collectSchemaIssues,
  validateProfileToml,
  githubSubmitUrl,
  GITHUB_URL_WARN_LENGTH,
} from '../../src/lib/profile-validate.mjs';

const VALID_TOML = `schema = 1

[profile]
slug = "qwen3-9b-longctx"
title = "Long-context chat slot"
summary = "16k context, q4_0 KV cache."
intent = "chat"
author = "lemond"

[runner]
kind = "llama-server"
lane = "rocm"
min_build = "b9219"

[model]
id = "qwen3.5-9b-q4kxl"
quant = "q4_k_xl"

[args]
raw = "-ngl 99 -c 16384 -fa 1 -ctk q4_0 -ctv q4_0 --parallel 1 -b 512"

[[history]]
v = 1
date = "2026-08-01"
note = "initial"
`;

const ROSTER = [{ id: 'qwen3.5-9b-q4kxl', measured: true, dec: 42.1, pf: 900, gb: 6 }];

function withField(toml, find, replace) {
  assert.ok(toml.includes(find), `fixture must contain ${JSON.stringify(find)}`);
  return toml.replace(find, replace);
}

test('countFlags counts flag tokens, not their values', () => {
  assert.equal(countFlags('-ngl 99 -c 16384 -fa 1 --parallel 1 -b 512'), 5);
  assert.equal(countFlags(''), 0);
  assert.equal(countFlags(undefined), 0);
  assert.equal(countFlags('-'), 0);
});

test('locateLine finds a key inside its table', () => {
  const loc = locateLine(VALID_TOML, 'runner.lane');
  assert.ok(loc);
  assert.equal(loc.text.trim(), 'lane = "rocm"');
});

test('locateLine returns null for a key it cannot find', () => {
  assert.equal(locateLine(VALID_TOML, 'runner.nope'), null);
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
  assert.equal(result.summary.lane, 'rocm');
  assert.equal(result.summary.flagCount, 7);
  assert.equal(result.summary.linkedRuns, 1);
});

test('validateProfileToml: schema-error state on malformed TOML syntax, with a line number', () => {
  const broken = 'schema = 1\n[profile\nslug = "x"\n';
  const result = validateProfileToml(broken);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.blocking, true);
  assert.equal(result.parseError, true);
  assert.equal(typeof result.line, 'number');
});

test('validateProfileToml: schema-error state on an invalid enum value, railed to its line', () => {
  const bad = withField(VALID_TOML, 'lane = "rocm"', 'lane = "rocm-6.4"');
  const result = validateProfileToml(bad);
  assert.equal(result.state, 'schema-error');
  assert.equal(result.blocking, true);
  assert.equal(result.primary.path, 'runner.lane');
  assert.match(result.primary.message, /must be one of rocm/);
  assert.equal(result.line, 12);
});

test('validateProfileToml: missing-fields state scoped to intent, model.id, args.raw', () => {
  const missing = VALID_TOML.replace('intent = "chat"\n', '')
    .replace('id = "qwen3.5-9b-q4kxl"\n', '')
    .replace('raw = "-ngl 99 -c 16384 -fa 1 -ctk q4_0 -ctv q4_0 --parallel 1 -b 512"\n', '');
  const result = validateProfileToml(missing);
  assert.equal(result.state, 'missing-fields');
  assert.equal(result.blocking, true);
  const keys = result.missing.map((m) => m.key).sort();
  assert.deepEqual(keys, ['args.raw', 'model.id', 'profile.intent']);
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

test('collectSchemaIssues rejects bad requires.gtt_gb / requires.exclusive types', () => {
  const badGtt = `${VALID_TOML}\n[requires]\ngtt_gb = "lots"\n`;
  const r1 = validateProfileToml(badGtt);
  assert.equal(r1.state, 'schema-error');
  assert.ok(r1.issues.some((i) => i.path === 'requires.gtt_gb'));

  const negativeGtt = `${VALID_TOML}\n[requires]\ngtt_gb = -1\n`;
  const r2 = validateProfileToml(negativeGtt);
  assert.equal(r2.state, 'schema-error');
  assert.ok(r2.issues.some((i) => i.path === 'requires.gtt_gb'));

  const badExclusive = `${VALID_TOML}\n[requires]\nexclusive = "yes"\n`;
  const r3 = validateProfileToml(badExclusive);
  assert.equal(r3.state, 'schema-error');
  assert.ok(r3.issues.some((i) => i.path === 'requires.exclusive'));

  const validRequires = `${VALID_TOML}\n[requires]\ngtt_gb = 24\nexclusive = true\n`;
  const r4 = validateProfileToml(validRequires, { rosterRows: ROSTER, existingProfiles: [] });
  assert.equal(r4.state, 'pass');
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
