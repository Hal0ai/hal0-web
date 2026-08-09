// scripts/test/profiles-join.test.mjs
//
// Unit tests for profile bench join and family derivation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { familyOf, benchFor, familiesOf, renderProfileToml, tintToml } from '../../src/lib/profiles-join.mjs';

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
  schema: 1,
  profile: {
    slug: 'strix-mtp-max',
    title: 'Max throughput on strix, MTP on',
    summary: 'Speculative decode via MTP for the biggest wins on strix lanes.',
    intent: 'coding',
    author: 'lemond'
  },
  runner: {
    kind: 'llama-server',
    lane: 'rocm',
    min_build: 'b9219'
  },
  model: {
    id: 'chadrock3-6-35b-uncensored-mtp-strix-lean',
    compatible: ['chadrock-35b-ace-saber']
  },
  args: { raw: '-ngl 99 -c 8192 -fa 1 --mtp on' },
  history: [
    { v: 2, date: '2026-06-19', note: 'bump context' },
    { v: 1, date: '2026-05-01', note: 'initial' }
  ]
};

test('renderProfileToml emits fields in hal0-profiles order', () => {
  const toml = renderProfileToml(SAMPLE_RECORD);
  assert.equal(toml.indexOf('schema'), 0);
  assert.ok(toml.indexOf('[profile]') < toml.indexOf('[runner]'));
  assert.ok(toml.indexOf('[runner]') < toml.indexOf('[model]'));
  assert.ok(toml.indexOf('[model]') < toml.indexOf('[args]'));
  assert.ok(toml.indexOf('[args]') < toml.indexOf('[[history]]'));
  assert.ok(toml.includes('slug = "strix-mtp-max"'));
  assert.ok(toml.includes('compatible = ["chadrock-35b-ace-saber"]'));
  assert.ok(toml.includes('v = 2'));
  assert.ok(toml.includes('date = "2026-06-19"'));
  // second history entry present too
  assert.ok(toml.includes('v = 1'));
});

test('renderProfileToml omits absent optional fields', () => {
  const toml = renderProfileToml(SAMPLE_RECORD);
  assert.ok(!toml.includes('quant'));
  assert.ok(!toml.includes('image'));
  assert.ok(!toml.includes('[requires]'));
  assert.ok(!toml.includes('first_party'));
});

test('tintToml tints headers, keys, numeric and string values', () => {
  const tokens = tintToml('[profile]\nslug = "strix-mtp-max"\nv = 2\nfirst_party = true\n');
  assert.equal(tokens[0].cls, 'h');
  assert.equal(tokens[1].cls, 'kv');
  assert.equal(tokens[1].valueCls, 's');
  assert.equal(tokens[2].valueCls, 'n');
  assert.equal(tokens[3].valueCls, 'n');
});
