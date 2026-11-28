// src/lib/profiles-join.mjs
//
// Pure functions for joining profile data with bench metrics.
// No external dependencies — can be loaded directly with node --test.

/**
 * Derive family from a model ID by prefix matching.
 * First-match wins. Unmatched models → "other".
 *
 * @param {string} modelId
 * @returns {string} family name
 */
export function familyOf(modelId) {
  // Order matters: qwen3-coder before qwen3
  const prefixes = ['qwen3-coder', 'qwen3', 'chadrock', 'qwopus', 'gemma', 'hermes'];

  for (const prefix of prefixes) {
    if (modelId.toLowerCase().startsWith(prefix.toLowerCase())) {
      return prefix;
    }
  }

  return 'other';
}

/**
 * The model ids a profile names: its primary model, then the ones it is also
 * known to run. A profile that is not tied to a model (most are not: a tune
 * is a workload, and the slot picks the model) names none.
 *
 * @param {Object} profile - ProfileRecord; `model` is optional
 * @returns {string[]}
 */
export function modelIdsOf(profile) {
  const model = profile?.model;
  if (!model || typeof model.id !== 'string' || model.id === '') return [];
  return [model.id, ...(Array.isArray(model.compatible) ? model.compatible : [])];
}

/**
 * Join a profile's models against roster rows to produce bench metrics. A
 * profile that names no model joins to nothing.
 *
 * @param {Object} profile - ProfileRecord shape: { model?: { id: string, compatible?: string[] }, ... }
 * @param {Array<Object>} rosterRows - roster rows with { id, dec, pf, gb, measured }
 * @returns {{ headline: ({ modelId: string, dec: number, pf: number, gb: number } | null), runs: Array<{ modelId: string, dec: number, pf: number, gb: number }> }}
 */
export function benchFor(profile, rosterRows) {
  const modelIds = modelIdsOf(profile);

  // Filter measured rows, match against our model ids, and sort by dec descending
  const runs = rosterRows
    .filter((row) => {
      // Must be measured and have dec value
      return row.measured && row.dec !== null && row.dec !== undefined;
    })
    .filter((row) => modelIds.includes(row.id))
    .map((row) => ({
      modelId: row.id,
      dec: row.dec,
      pf: row.pf,
      gb: row.gb
    }))
    .sort((a, b) => b.dec - a.dec);

  const headline = runs.length > 0 ? runs[0] : null;

  return {
    headline,
    runs
  };
}

/**
 * Extract unique families from a profile's model IDs, in insertion order.
 *
 * @param {Object} profile - ProfileRecord with an optional model.id and model.compatible
 * @returns {Array<string>} unique family names in insertion order
 */
export function familiesOf(profile) {
  const seen = new Set();
  const result = [];

  for (const modelId of modelIdsOf(profile)) {
    const family = familyOf(modelId);
    if (!seen.has(family)) {
      seen.add(family);
      result.push(family);
    }
  }

  return result;
}

// [tune] keys in the order the registry writes them (hal0's ProfileConfig).
const TUNE_KEY_ORDER = [
  'flags',
  'ctx_size',
  'enable_thinking',
  'reasoning_effort',
  'reasoning_budget',
  'vision',
  'speculation',
  'runner',
  'cloned_from',
  'intent',
];

/**
 * Reconstruct the hal0-profiles TOML source for a profile record,
 * deterministically, in the same field order the upstream repo uses:
 * schema, [profile], [runtime], [tune], [model]?, [[history]]…
 * (newest first, matching the order already present on the record).
 *
 * Pure/string-only — no TOML library needed since the record was already
 * parsed once by the sync script; this is the inverse direction, purely
 * for display in the drawer.
 *
 * @param {Object} record - ProfileRecord (schema, profile, runtime, tune, model?, history)
 * @returns {string} TOML source text
 */
export function renderProfileToml(record) {
  const { schema, profile, runtime, tune, model, history } = record;
  const lines = [];
  const push = (line = '') => lines.push(line);
  const quote = (value) => JSON.stringify(String(value));
  const scalar = (value) => (typeof value === 'string' ? quote(value) : String(value));

  push(`schema = ${schema}`);

  push('');
  push('[profile]');
  push(`slug = ${quote(profile.slug)}`);
  push(`title = ${quote(profile.title)}`);
  push(`summary = ${quote(profile.summary)}`);
  push(`intent = ${quote(profile.intent)}`);
  push(`author = ${quote(profile.author)}`);
  if (profile.first_party) push(`first_party = true`);
  if (profile.seed) push(`seed = true`);

  push('');
  push('[runtime]');
  push(`family = ${quote(runtime?.family ?? '')}`);
  if (runtime?.min_hal0) push(`min_hal0 = ${quote(runtime.min_hal0)}`);

  push('');
  push('[tune]');
  for (const key of TUNE_KEY_ORDER) {
    if (tune?.[key] !== undefined) push(`${key} = ${scalar(tune[key])}`);
  }

  if (model?.id) {
    push('');
    push('[model]');
    push(`id = ${quote(model.id)}`);
    if (model.compatible && model.compatible.length) {
      push(`compatible = [${model.compatible.map(quote).join(', ')}]`);
    }
  }

  for (const h of history ?? []) {
    push('');
    push('[[history]]');
    push(`v = ${h.v}`);
    push(`date = ${quote(h.date)}`);
    push(`note = ${quote(h.note)}`);
  }

  return lines.join('\n');
}

/**
 * Split rendered TOML text into per-line syntax-tint tokens, mirroring the
 * comp's `Toml` component: comment lines → "c", [table]/[[array]] headers →
 * "h", `key = value` lines → a key span ("k") plus a value span tinted "n"
 * (numeric/bool) or "s" (string/other). Blank or unrecognized lines pass
 * through untinted.
 *
 * @param {string} text - TOML source (e.g. from renderProfileToml)
 * @returns {Array<{cls: 'c'|'h'|'kv'|null, text?: string, key?: string, value?: string, valueCls?: 'n'|'s'}>}
 */
export function tintToml(text) {
  return text.split('\n').map((line) => {
    if (line.startsWith('#')) return { cls: 'c', text: line };
    if (line.startsWith('[')) return { cls: 'h', text: line };
    const m = line.match(/^(\s*[\w_]+\s*=\s*)(.*)$/);
    if (!m) return { cls: null, text: line || ' ' };
    const value = m[2];
    const valueCls = /^-?[\d.]+$/.test(value) || value === 'true' || value === 'false' ? 'n' : 's';
    return { cls: 'kv', key: m[1], value, valueCls };
  });
}
