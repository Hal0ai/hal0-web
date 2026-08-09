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
 * @returns {Object} { headline: { modelId, dec, pf } | null, runs: Array<{ modelId, dec, pf, gb }> }
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
