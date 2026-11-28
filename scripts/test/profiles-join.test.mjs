// scripts/test/profiles-join.test.mjs
//
// Unit tests for profile bench join and family derivation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { familyOf, benchFor, familiesOf, renderProfileToml, tintToml, modelIdsOf } from '../../src/lib/profiles-join.mjs';

test('familyOf recognizes qwen3-coder prefix (before qwen3)', () => {
  assert.equal(familyOf('qwen3-coder-next-q4kxl'), 'qwen3-coder');
  assert.equal(familyOf('qwen3-coder-reap-25b-a3b-q5km'), 'qwen3-coder');
});

test('familyOf recognizes qwen3 prefix', () => {
  assert.equal(familyOf('qwen3.5-9b-q4kxl'), 'qwen3');
  assert.equal(familyOf('qwen3.6-35b-a3b-q4kxl'), 'qwen3');
  assert.equal(familyOf('qwen3.6-27b'), 'qwen3');
});

test('familyOf recognizes chadrock prefix', () => {
  assert.equal(familyOf('chadrock-35b-ace-saber'), 'chadrock');
  assert.equal(familyOf('chadrock3.6-27b-pi-agent-rocmfp4-mtp'), 'chadrock');
  assert.equal(familyOf('chadrock3-6-35b-uncensored-mtp-strix-lean'), 'chadrock');
});

test('familyOf recognizes qwopus prefix', () => {
  assert.equal(familyOf('qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean'), 'qwopus');
  assert.equal(familyOf('qwopus3-5-9b-coder-mtp-q6-k'), 'qwopus');
  assert.equal(familyOf('Qwopus3.6-27B-Coder-MTP'), 'qwopus');
});

test('familyOf recognizes gemma prefix', () => {
  assert.equal(familyOf('gemma-4-12B-agentic-fable5'), 'gemma');
  assert.equal(familyOf('gemma-4-26b-a4b-it-q4kxl'), 'gemma');
  assert.equal(familyOf('gemma-4-12b-it'), 'gemma');
  assert.equal(familyOf('gemma4-v2-q4-k-m'), 'gemma');
});

test('familyOf recognizes hermes prefix', () => {
  assert.equal(familyOf('hermes-4-14b-q5km'), 'hermes');
});

test('familyOf returns "other" for unmatched models', () => {
  assert.equal(familyOf('weird-model'), 'other');
  assert.equal(familyOf('unknown-42b'), 'other');
  assert.equal(familyOf('strix-mtp-max'), 'other');
});

test('benchFor returns headline and runs sorted by dec descending', () => {
  const profile = {
    model: {
      id: 'qwen3-coder-next-q4kxl',
      compatible: ['qwen3-coder-reap-25b-a3b-q5km']
    }
  };

  const roster = [
    {
      id: 'qwen3-coder-next-q4kxl',
      dec: 37.8,
      pf: 716.0,
      gb: 49.6,
      measured: true
    },
    {
      id: 'qwen3-coder-reap-25b-a3b-q5km',
      dec: 54.7,
      pf: 1367.6,
      gb: 17.7,
      measured: true
    },
    {
      id: 'other-model',
      dec: 100.0,
      pf: 1000.0,
      gb: 10.0,
      measured: true
    }
  ];

  const result = benchFor(profile, roster);
  assert.ok(result.headline);
  assert.equal(result.headline.modelId, 'qwen3-coder-reap-25b-a3b-q5km');
  assert.equal(result.headline.dec, 54.7);
  assert.equal(result.headline.pf, 1367.6);

  assert.equal(result.runs.length, 2);
  assert.equal(result.runs[0].modelId, 'qwen3-coder-reap-25b-a3b-q5km');
  assert.equal(result.runs[0].dec, 54.7);
  assert.equal(result.runs[1].modelId, 'qwen3-coder-next-q4kxl');
  assert.equal(result.runs[1].dec, 37.8);
});

test('benchFor excludes unmeasured rows', () => {
  const profile = {
    model: {
      id: 'test-model'
    }
  };

  const roster = [
    {
      id: 'test-model',
      dec: 50.0,
      pf: 500.0,
      gb: 10.0,
      measured: true
    },
    {
      id: 'test-model-2',
      dec: 60.0,
      pf: 600.0,
      gb: 15.0,
      measured: false
    }
  ];

  const result = benchFor(profile, roster);
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].modelId, 'test-model');
});

test('benchFor excludes rows with null dec', () => {
  const profile = {
    model: {
      id: 'test-model'
    }
  };

  const roster = [
    {
      id: 'test-model',
      dec: null,
      pf: null,
      gb: 10.0,
      measured: true
    }
  ];

  const result = benchFor(profile, roster);
  assert.equal(result.runs.length, 0);
  assert.equal(result.headline, null);
});

test('benchFor returns empty results when no matching models', () => {
  const profile = {
    model: {
      id: 'non-existent-model'
    }
  };

  const roster = [
    {
      id: 'other-model',
      dec: 50.0,
      pf: 500.0,
      gb: 10.0,
      measured: true
    }
  ];

  const result = benchFor(profile, roster);
  assert.equal(result.runs.length, 0);
  assert.equal(result.headline, null);
});

test('benchFor returns headline as the highest dec value from runs', () => {
  const profile = {
    model: {
      id: 'model-a',
      compatible: ['model-b', 'model-c']
    }
  };

  const roster = [
    { id: 'model-a', dec: 25.0, pf: 250.0, gb: 5.0, measured: true },
    { id: 'model-b', dec: 75.0, pf: 750.0, gb: 7.0, measured: true },
    { id: 'model-c', dec: 50.0, pf: 500.0, gb: 6.0, measured: true }
  ];

  const result = benchFor(profile, roster);
  assert.ok(result.headline);
  assert.equal(result.headline.modelId, 'model-b');
  assert.equal(result.headline.dec, 75.0);
});

test('familiesOf returns unique families in insertion order', () => {
  const profile = {
    model: {
      id: 'qwen3-coder-next-q4kxl',
      compatible: ['qwen3.6-35b-a3b-q4kxl', 'chadrock-35b-ace-saber']
    }
  };

  const families = familiesOf(profile);
  assert.deepEqual(families, ['qwen3-coder', 'qwen3', 'chadrock']);
});

test('familiesOf deduplicates families', () => {
  const profile = {
    model: {
      id: 'qwen3.5-9b-q4kxl',
      compatible: ['qwen3.6-35b-a3b-q4kxl']
    }
  };

  const families = familiesOf(profile);
  assert.deepEqual(families, ['qwen3']);
});

test('familiesOf handles single model', () => {
  const profile = {
    model: {
      id: 'gemma-4-12b-it'
    }
  };

  const families = familiesOf(profile);
  assert.deepEqual(families, ['gemma']);
});

test('familiesOf handles mixed families', () => {
  const profile = {
    model: {
      id: 'chadrock3.6-27b-pi-agent-rocmfp4-mtp',
      compatible: ['hermes-4-14b-q5km', 'qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean', 'weird-model']
    }
  };

  const families = familiesOf(profile);
  assert.deepEqual(families, ['chadrock', 'hermes', 'qwopus', 'other']);
});

const SAMPLE_RECORD = {
  schema: 2,
  profile: {
    slug: 'brain-steward',
    title: 'Brain steward, 64K',
    summary: 'For the small tool-routing model: one sequence, a 64K window, vision off.',
    intent: 'utility',
    author: 'lemond'
  },
  runtime: {
    family: 'llama-server',
    min_hal0: '1.8.3'
  },
  tune: {
    // deliberately out of order: the renderer writes hal0's key order
    vision: 'off',
    intent: 'Brain steward · 64K ctx',
    ctx_size: 65536,
    enable_thinking: false,
    reasoning_budget: -1,
    flags: '-fa auto -b 2048 -ub 512 --parallel 1'
  },
  model: {
    id: 'lfm2.5-2.6b',
    compatible: ['lfm2.5-1.2b']
  },
  history: [
    { v: 2, date: '2026-11-19', note: 'bump context' },
    { v: 1, date: '2026-11-01', note: 'initial' }
  ]
};

test('renderProfileToml emits fields in hal0-profiles order', () => {
  const toml = renderProfileToml(SAMPLE_RECORD);
  assert.equal(toml.indexOf('schema = 2'), 0);
  assert.ok(toml.indexOf('[profile]') < toml.indexOf('[runtime]'));
  assert.ok(toml.indexOf('[runtime]') < toml.indexOf('[tune]'));
  assert.ok(toml.indexOf('[tune]') < toml.indexOf('[model]'));
  assert.ok(toml.indexOf('[model]') < toml.indexOf('[[history]]'));
  assert.ok(toml.includes('slug = "brain-steward"'));
  assert.ok(toml.includes('family = "llama-server"'));
  assert.ok(toml.includes('min_hal0 = "1.8.3"'));
  assert.ok(toml.includes('compatible = ["lfm2.5-1.2b"]'));
  assert.ok(toml.includes('v = 2'));
  assert.ok(toml.includes('date = "2026-11-19"'));
  // second history entry present too
  assert.ok(toml.includes('v = 1'));
});

test('renderProfileToml writes [tune] in hal0 key order with TOML types', () => {
  const toml = renderProfileToml(SAMPLE_RECORD);
  const tune = toml.slice(toml.indexOf('[tune]'), toml.indexOf('[model]')).trim().split('\n');
  assert.deepEqual(tune, [
    '[tune]',
    'flags = "-fa auto -b 2048 -ub 512 --parallel 1"',
    'ctx_size = 65536',
    'enable_thinking = false',
    'reasoning_budget = -1',
    'vision = "off"',
    'intent = "Brain steward · 64K ctx"'
  ]);
});

test('renderProfileToml omits absent optional fields', () => {
  const { model, ...noModel } = SAMPLE_RECORD;
  const toml = renderProfileToml({ ...noModel, runtime: { family: 'kokoro' }, tune: {} });
  assert.ok(!toml.includes('[model]'));
  assert.ok(!toml.includes('min_hal0'));
  assert.ok(!toml.includes('first_party'));
  assert.ok(!toml.includes('seed'));
  assert.ok(!toml.includes('undefined'));
  assert.ok(toml.includes('[tune]\n\n[[history]]'), 'an empty tune is an empty table');
});

test('renderProfileToml round-trips through the validator', async () => {
  const { validateProfileToml } = await import('../../src/lib/profile-validate.mjs');
  const result = validateProfileToml(renderProfileToml(SAMPLE_RECORD));
  assert.ok(['pass', 'warning'].includes(result.state), `rendered TOML is a valid profile, got ${result.state}`);
});

test('a profile that names no model has no model ids, families or bench', () => {
  const { model, ...noModel } = SAMPLE_RECORD;
  assert.deepEqual(modelIdsOf(noModel), []);
  assert.deepEqual(familiesOf(noModel), []);
  assert.deepEqual(benchFor(noModel, [{ id: 'lfm2.5-2.6b', measured: true, dec: 90, pf: 800, gb: 3 }]), {
    headline: null,
    runs: []
  });
  assert.deepEqual(modelIdsOf(SAMPLE_RECORD), ['lfm2.5-2.6b', 'lfm2.5-1.2b']);
});

test('tintToml tints headers, keys, numeric and string values', () => {
  const tokens = tintToml('[profile]\nslug = "brain-steward"\nv = 2\nfirst_party = true\nreasoning_budget = -1\n');
  assert.equal(tokens[0].cls, 'h');
  assert.equal(tokens[1].cls, 'kv');
  assert.equal(tokens[1].valueCls, 's');
  assert.equal(tokens[2].valueCls, 'n');
  assert.equal(tokens[3].valueCls, 'n');
  assert.equal(tokens[4].valueCls, 'n', 'a negative number is numeric');
});
