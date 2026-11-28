// scripts/test/profiles-sync.test.mjs
//
// Unit tests for the TOML → ProfileRecord parser and the schema filter used by
// sync-profiles.mjs. Does not touch the network — see scripts/sync-profiles.mjs
// for the fetch step, which is exercised only by running the script itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfileToml, supportedProfiles, SUPPORTED_SCHEMA } from '../sync-profiles.mjs';

// A registry file in the documented schema-2 shape.
const THINKING = `
schema = 2

[profile]
slug = "thinking"
title = "Reasoning on, 32K"
summary = "Reasoning on in the deepseek format with an unlimited budget. 32K window, vision off."
intent = "chat"
author = "hal0"
first_party = true

[runtime]
family = "llama-server"
min_hal0 = "1.5.0"

[tune]
flags = "-fa auto -b 2048 -ub 512 --reasoning on --reasoning-format deepseek --reasoning-budget -1"
ctx_size = 32768
enable_thinking = true
vision = "off"
speculation = "auto"
intent = "Reasoning-ON workload · 32K ctx"

[[history]]
v = 1
date = 2026-11-28
note = "as published in hal0's community/addons"
`;

test('parseProfileToml parses a schema-2 profile with its tune types intact', () => {
  const record = parseProfileToml(THINKING, 'thinking.toml');
  assert.equal(record.schema, 2);
  assert.equal(record.profile.slug, 'thinking');
  assert.equal(record.runtime.family, 'llama-server');
  assert.equal(record.tune.ctx_size, 32768);
  assert.equal(record.tune.enable_thinking, true);
  assert.equal(record.tune.intent, 'Reasoning-ON workload · 32K ctx');
  assert.equal(record.history[0].v, 1);
  assert.equal(record.history[0].date, '2026-11-28');
  assert.equal(typeof record.history[0].date, 'string');
});

test('parseProfileToml throws with the filename in the message on malformed TOML', () => {
  assert.throws(
    () => parseProfileToml('this = [is not valid toml', 'broken.toml'),
    (err) => err instanceof Error && err.message.includes('broken.toml'),
  );
});

test('supportedProfiles keeps schema-2 records and drops the rest with a warning each', () => {
  const current = parseProfileToml(THINKING, 'thinking.toml');
  const old = { schema: 1, profile: { slug: 'strix-mtp-max' }, runner: { lane: 'rocm' }, args: { raw: '-ngl 99' } };
  const warnings = [];
  const kept = supportedProfiles([old, current, { profile: { slug: 'no-schema' } }, null], (m) => warnings.push(m));
  assert.equal(SUPPORTED_SCHEMA, 2);
  assert.deepEqual(kept, [current]);
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /strix-mtp-max/);
  assert.match(warnings[0], /schema 1/);
});

test('supportedProfiles returns nothing for a registry still on the old schema', () => {
  const old = [{ schema: 1, profile: { slug: 'a' } }, { schema: 1, profile: { slug: 'b' } }];
  assert.deepEqual(supportedProfiles(old, () => {}), []);
});

test('the committed snapshot holds only records this build can render', async () => {
  const { default: snapshot } = await import('../../src/data/profiles.json', { with: { type: 'json' } });
  assert.equal(supportedProfiles(snapshot.profiles, () => {}).length, snapshot.profiles.length);
});
