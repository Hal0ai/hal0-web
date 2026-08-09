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
 * Join a profile's models against roster rows to produce bench metrics.
 *
 * @param {Object} profile - ProfileRecord shape: { model: { id: string, compatible?: string[] }, ... }
 * @param {Array<Object>} rosterRows - roster rows with { id, dec, pf, gb, measured }
 * @returns {{ headline: ({ modelId: string, dec: number, pf: number, gb: number } | null), runs: Array<{ modelId: string, dec: number, pf: number, gb: number }> }}
 */
export function benchFor(profile, rosterRows) {
  const modelIds = [profile.model.id];
  if (profile.model.compatible) {
    modelIds.push(...profile.model.compatible);
  }

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
 * @param {Object} profile - ProfileRecord with model.id and model.compatible
 * @returns {Array<string>} unique family names in insertion order
 */
export function familiesOf(profile) {
  const modelIds = [profile.model.id];
  if (profile.model.compatible) {
    modelIds.push(...profile.model.compatible);
  }

  const seen = new Set();
  const result = [];

  for (const modelId of modelIds) {
    const family = familyOf(modelId);
    if (!seen.has(family)) {
      seen.add(family);
      result.push(family);
    }
  }

  return result;
}

/**
 * Reconstruct the hal0-profiles TOML source for a profile record,
 * deterministically, in the same field order the upstream repo uses:
 * schema, [profile], [runner], [model], [args], [requires]?, [[history]]…
 * (newest first, matching the order already present on the record).
 *
 * Pure/string-only — no TOML library needed since the record was already
 * parsed once by the sync script; this is the inverse direction, purely
 * for display in the drawer.
 *
 * @param {Object} record - ProfileRecord (schema, profile, runner, model, args, requires?, history)
 * @returns {string} TOML source text
 */
export function renderProfileToml(record) {
  const { schema, profile, runner, model, args, requires, history } = record;
  const lines = [];
  const push = (line = '') => lines.push(line);
  const quote = (value) => JSON.stringify(String(value));

  push(`schema = ${schema}`);

  push('');
  push('[profile]');
  push(`slug = ${quote(profile.slug)}`);
  push(`title = ${quote(profile.title)}`);
  push(`summary = ${quote(profile.summary)}`);
  push(`intent = ${quote(profile.intent)}`);
  push(`author = ${quote(profile.author)}`);
  if (profile.first_party) push(`first_party = true`);

  push('');
  push('[runner]');
  push(`kind = ${quote(runner.kind)}`);
  push(`lane = ${quote(runner.lane)}`);
  if (runner.min_build) push(`min_build = ${quote(runner.min_build)}`);
  if (runner.image) push(`image = ${quote(runner.image)}`);

  push('');
  push('[model]');
  push(`id = ${quote(model.id)}`);
  if (model.quant) push(`quant = ${quote(model.quant)}`);
  if (model.compatible && model.compatible.length) {
    push(`compatible = [${model.compatible.map(quote).join(', ')}]`);
  }

  push('');
  push('[args]');
  push(`raw = ${quote(args.raw)}`);

  if (requires && Object.keys(requires).length) {
    push('');
    push('[requires]');
    for (const [key, value] of Object.entries(requires)) {
      push(`${key} = ${typeof value === 'string' ? quote(value) : value}`);
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
    const valueCls = /^[\d.]+$/.test(value) || value === 'true' || value === 'false' ? 'n' : 's';
    return { cls: 'kv', key: m[1], value, valueCls };
  });
}
