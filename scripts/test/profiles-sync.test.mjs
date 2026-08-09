// scripts/test/profiles-sync.test.mjs
//
// Unit tests for the TOML → ProfileRecord parser used by sync-profiles.mjs.
// Does not touch the network — see scripts/sync-profiles.mjs for the fetch
// step, which is exercised only by running the script itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProfileToml } from '../sync-profiles.mjs';

// Straight from the hal0-profiles README's documented example.
const STRIX_MTP_MAX = `
schema = 1

[profile]
slug = "strix-mtp-max"
title = "Speculative decode, everything on"
summary = "draft-mtp with an f16 KV cache. The fastest tokens this box produces, at the cost of 19 GB resident and no room for a second big slot."
intent = "chat"
author = "hal0-ci"
first_party = true

[runner]
kind = "llama-server"
lane = "rocm"
min_build = "b9219"
image = "ghcr.io/hal0ai/amd-strix-halo-toolboxes:rocm-7.2.4-rocmfp4-server"

[model]
id = "chadrock3-6-35b-uncensored-mtp-strix-lean"
quant = "q4_k_xl"
compatible = ["chadrock-35b-ace-saber", "qwen3.6-35b-a3b-crown-halo-mtp-dynamic"]

[args]
raw = "-ngl 99 -c 2048 -fa 1 -ctk f16 -ctv f16 --parallel 1 -b 512 --draft-max 4 --draft-min 1 --mtp on"

[requires]
gtt_gb = 24
exclusive = false

[[history]]
v = 4
date = 2026-06-19
note = "pin build b9219 — draft-mtp accept regressed on b9101"
`;

test('parseProfileToml parses the strix-mtp-max example', () => {
  const record = parseProfileToml(STRIX_MTP_MAX, 'strix-mtp-max.toml');
  assert.equal(record.profile.slug, 'strix-mtp-max');
  assert.equal(record.profile.intent, 'chat');
  assert.equal(record.history[0].v, 4);
  assert.equal(record.history[0].date, '2026-06-19');
  assert.equal(typeof record.history[0].date, 'string');
});

test('parseProfileToml throws with the filename in the message on malformed TOML', () => {
  assert.throws(
    () => parseProfileToml('this = [is not valid toml', 'broken.toml'),
    (err) => err instanceof Error && err.message.includes('broken.toml'),
  );
});
