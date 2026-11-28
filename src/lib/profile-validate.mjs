// src/lib/profile-validate.mjs
//
// Dependency-free (besides smol-toml) client-side port of the hal0-profiles
// validator (hal0-profiles/lib/validate.mjs + schema/profile.schema.json).
// Runs entirely in the browser before anything is sent anywhere — see
// docs/design/2026-08-09-community-comps/09 Profile Submission.html and its
// README §9 for the four validation states this implements:
//
//   pass             — parsed summary (slug, intent, runtime, flag count,
//                       model + "in roster" chip when the profile names one)
//   schema-error      — line-numbered, cause-then-recovery, blocking
//   missing-fields    — the three keys that matter (intent, runtime.family,
//                       a non-empty [tune]), each with why it matters, blocking
//   warning           — unknown model id, NOT blocking, "unverified" chip
//
// Plus the duplicate-slug edge state (offer "submit as vN+1" before
// "rename mine") and the GitHub "new file" URL builder used by the
// "continue on GitHub" door.
//
// The registry is on schema 2: a profile file is hal0's own profile body
// ([tune]: flags, ctx_size, enable_thinking, reasoning_effort,
// reasoning_budget, vision, speculation, runner, cloned_from, intent) plus the
// metadata the gallery needs. Schema 1 was the pre-1.0 shape ([runner]
// lane/image, [args] raw with -ngl and -c in it), which hal0 no longer reads.
//
// No fs/path/ajv here — this has to bundle for the client via Vite. The
// shape checks below are a hand-rolled mirror of
// hal0-profiles/schema/profile.schema.json, not a JSON Schema engine.
import { parse as parseToml } from 'smol-toml';
import { benchFor } from './profiles-join.mjs';

export const SCHEMA_VERSION = 2;
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
export const INTENTS = [
  'chat',
  'coding',
  'agent',
  'utility',
  'memory',
  'vision',
  'embedding',
  'reranking',
  'tts',
  'stt',
  'image',
];
export const RUNTIME_FAMILIES = ['llama-server', 'flm', 'kokoro', 'moonshine', 'qwen3tts', 'comfyui', 'halogen'];
export const REASONING_EFFORTS = ['default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
export const VISION_MODES = ['auto', 'off'];
export const SPECULATION_MODES = ['auto', 'off', 'ngram'];
export const CTX_SIZE_MIN = 128;
export const CTX_SIZE_MAX = 16777216;
const MIN_HAL0_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const RUNNER_KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// Flags hal0 refuses in a profile's `flags`, with the reason it gives. This
// is a first screen for a llama-server profile, matched on the exact flag
// name; hal0's own import (POST /api/profiles/import) is the authority and
// screens more (host-owned flags, llama.cpp preset switches, positionals).
const PLACEMENT = 'placement belongs to the slot, not the profile';
const MANAGED = 'hal0 sets this itself';
const MODEL_FACT = 'this is a fact about the model file';
export const DENIED_FLAGS = {
  '-ngl': PLACEMENT,
  '--gpu-layers': PLACEMENT,
  '--n-gpu-layers': PLACEMENT,
  '-dev': PLACEMENT,
  '--device': PLACEMENT,
  '-t': PLACEMENT,
  '--threads': PLACEMENT,
  '-m': MANAGED,
  '--model': MANAGED,
  '-c': `${MANAGED}; use tune.ctx_size`,
  '--ctx-size': `${MANAGED}; use tune.ctx_size`,
  '--host': MANAGED,
  '--port': MANAGED,
  '-a': MANAGED,
  '--alias': MANAGED,
  '--jinja': MODEL_FACT,
  '--no-jinja': MODEL_FACT,
  '--chat-template': MODEL_FACT,
  '--chat-template-file': MODEL_FACT,
  '--mmproj': `${MODEL_FACT}; use tune.vision`,
  '--mmproj-url': `${MODEL_FACT}; use tune.vision`,
  '--mmproj-auto': `${MODEL_FACT}; use tune.vision`,
  '--no-mmproj': `${MODEL_FACT}; use tune.vision`,
  '--no-mmproj-auto': `${MODEL_FACT}; use tune.vision`,
  '--spec-type': 'use tune.speculation',
};

/**
 * Splits a flag string on whitespace the way a shell would, keeping a
 * single- or double-quoted value in one token. A token that opens with a
 * quote is a value, so text inside it is never read as a flag.
 *
 * @param {string} raw
 * @returns {string[]}
 */
export function flagTokens(raw) {
  return typeof raw === 'string' ? (raw.match(/'[^']*'|"[^"]*"|\S+/g) ?? []) : [];
}

/**
 * The flags in a llama-server flag string that hal0 refuses in a profile.
 * A token is a flag when it starts with `-` and is not a negative number;
 * `--flag=value` and `_` for `-` are read the way llama.cpp reads them.
 *
 * @param {string} raw
 * @returns {Array<{ flag: string, reason: string }>}
 */
export function deniedFlags(raw) {
  if (typeof raw !== 'string') return [];
  const found = [];
  for (const tok of flagTokens(raw)) {
    if (!tok.startsWith('-') || /^-\d/.test(tok)) continue;
    const name = tok.split('=')[0].replace(/_/g, '-');
    if (Object.hasOwn(DENIED_FLAGS, name)) found.push({ flag: tok, reason: DENIED_FLAGS[name] });
  }
  return found;
}

// The three keys the "missing fields" state is scoped to — per README §9,
// "the three keys that matter". Any other missing/invalid field is treated
// as a (blocking) schema error instead, with a line rail where one can be
// located.
const CORE_KEYS = ['profile.intent', 'runtime.family', 'tune'];

const CORE_KEY_WHY = {
  'profile.intent': `what this profile is for: ${INTENTS.join(' · ')}`,
  'runtime.family': `the engine these settings are for: ${RUNTIME_FAMILIES.join(' · ')}`,
  tune: 'the settings themselves: flags, ctx_size, enable_thinking, vision, speculation. A profile without a tune is just a name.',
};

const GITHUB_REPO = 'Hal0ai/hal0-profiles';
const GITHUB_NEW_FILE_BASE = `https://github.com/${GITHUB_REPO}/new/main`;
export const GITHUB_URL_WARN_LENGTH = 8000;

/**
 * Count "flags" in a tune.flags string — tokens that start with `-` (but
 * are not bare `-` or a negative number). Values that follow a flag (e.g.
 * the `2048` in `-b 2048`, the `-1` in `--reasoning-budget -1`) are not
 * counted.
 *
 * @param {string} raw
 * @returns {number}
 */
export function countFlags(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return 0;
  return flagTokens(raw)
    .filter((tok) => tok.startsWith('-') && tok !== '-' && !/^-\d/.test(tok)).length;
}

/**
 * Best-effort line locator: finds the `key = ` line inside the named table
 * (or at the document root when `path` has no dotted table prefix).
 * Used only to rail the offending line in the schema-error state — a miss
 * degrades gracefully to `null` (no rail, field name still shown).
 *
 * @param {string} text - raw TOML source
 * @param {string} path - dotted path, e.g. "runtime.family" or "schema"
 * @returns {{ line: number, text: string } | null}
 */
export function locateLine(text, path) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const m = path.match(/^([\w-]+)\.([\w-]+)$/);
  const table = m ? m[1] : null;
  const key = m ? m[2] : path.replace(/\[\d+\]$/, '');

  let currentTable = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const th = line.match(/^\s*\[\[?([\w.-]+)\]\]?\s*$/);
    if (th) {
      currentTable = th[1];
      continue;
    }
    const kv = line.match(/^\s*([\w-]+)\s*=/);
    if (kv && kv[1] === key && (table == null || currentTable === table)) {
      return { line: i + 1, text: line };
    }
  }
  return null;
}

const ROOT_KEYS = ['schema', 'profile', 'runtime', 'tune', 'model', 'history'];
const PROFILE_KEYS = ['slug', 'title', 'summary', 'intent', 'author', 'first_party', 'seed'];
const RUNTIME_KEYS = ['family', 'min_hal0'];
const TUNE_KEYS = [
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
// A tune that sets only these is still "just a name".
const TUNE_LABEL_KEYS = ['intent', 'cloned_from'];
const MODEL_KEYS = ['id', 'compatible'];
const HISTORY_ITEM_KEYS = ['v', 'date', 'note'];

/**
 * Hand-rolled mirror of profile.schema.json's shape rules. Returns a flat
 * list of issues rather than throwing — the caller decides how to bucket
 * them into validation states.
 *
 * Parity target: any document the CI validator (hal0-profiles/lib/validate.mjs
 * + schema/profile.schema.json, run via ajv with `additionalProperties: false`
 * on every table) would reject must also produce at least one issue here.
 * A validator that is strictly more permissive than CI is a pass-here/
 * fail-in-review hole — see the additionalProperties, minLength, integer,
 * and history-ordering checks below, which exist specifically to close
 * that gap rather than to mirror the JSON Schema academically.
 *
 * @param {unknown} parsed - the object returned by smol-toml's parse()
 * @returns {Array<{ path: string, kind: 'missing'|'invalid', message: string }>}
 */
export function collectSchemaIssues(parsed) {
  const issues = [];
  const add = (path, kind, message) => issues.push({ path, kind, message });
  // A TOML date parses to a Date, which is an object but not a table.
  const isTable = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

  const addUnknownKeys = (obj, allowed, prefix) => {
    if (!isTable(obj)) return;
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) {
        const path = prefix ? `${prefix}.${key}` : key;
        add(path, 'invalid', `${path}: unknown key (not permitted by the schema)`);
      }
    }
  };

  const requireNonEmptyString = (obj, key, path) => {
    const v = obj?.[key];
    if (v === undefined) return;
    if (typeof v !== 'string' || v.length < 1) {
      add(path, 'invalid', `${path} must be a non-empty string (got ${JSON.stringify(v)})`);
    }
  };

  const requireOneOf = (obj, key, path, allowed) => {
    const v = obj?.[key];
    if (v !== undefined && !allowed.includes(v)) {
      add(path, 'invalid', `${path} must be one of ${allowed.join(' | ')} (got ${JSON.stringify(v)})`);
    }
  };

  const requireBoolean = (obj, key, path) => {
    const v = obj?.[key];
    if (v !== undefined && typeof v !== 'boolean') {
      add(path, 'invalid', `${path} must be a boolean (got ${JSON.stringify(v)})`);
    }
  };

  const requireIntegerIn = (obj, key, path, min, max) => {
    const v = obj?.[key];
    if (v !== undefined && (!Number.isInteger(v) || v < min || v > max)) {
      add(path, 'invalid', `${path} must be an integer from ${min} to ${max} (got ${JSON.stringify(v)})`);
    }
  };

  if (!isTable(parsed)) {
    add('(root)', 'invalid', 'document must be a table');
    return issues;
  }

  if (parsed.schema === 1) {
    add(
      'schema',
      'invalid',
      'schema 1 is the pre-1.0 profile shape ([runner] lane/image, [args] raw), which hal0 no longer reads. ' +
        'Rewrite the file as schema 2: the settings go in [tune].'
    );
    return issues;
  }

  addUnknownKeys(parsed, ROOT_KEYS, '');

  if (parsed.schema !== SCHEMA_VERSION) {
    add(
      'schema',
      parsed.schema === undefined ? 'missing' : 'invalid',
      parsed.schema === undefined
        ? 'schema: required'
        : `schema must equal ${SCHEMA_VERSION} (got ${JSON.stringify(parsed.schema)})`
    );
  }

  for (const key of ['profile', 'runtime', 'history']) {
    if (parsed[key] === undefined) add(key, 'missing', `${key}: required`);
    else if (key !== 'history' && !isTable(parsed[key])) add(key, 'invalid', `${key} must be a table`);
  }

  const profile = isTable(parsed.profile) ? parsed.profile : {};
  addUnknownKeys(profile, PROFILE_KEYS, 'profile');
  for (const key of ['slug', 'title', 'summary', 'intent', 'author']) {
    if (profile[key] === undefined) add(`profile.${key}`, 'missing', `profile.${key}: required`);
  }
  if (profile.slug !== undefined && !SLUG_PATTERN.test(String(profile.slug))) {
    add(
      'profile.slug',
      'invalid',
      `profile.slug must match ${SLUG_PATTERN} (got ${JSON.stringify(profile.slug)})`
    );
  }
  requireNonEmptyString(profile, 'title', 'profile.title');
  requireNonEmptyString(profile, 'summary', 'profile.summary');
  requireNonEmptyString(profile, 'author', 'profile.author');
  requireOneOf(profile, 'intent', 'profile.intent', INTENTS);
  requireBoolean(profile, 'first_party', 'profile.first_party');
  requireBoolean(profile, 'seed', 'profile.seed');
  if (profile.seed === true && profile.first_party !== true) {
    add(
      'profile.seed',
      'invalid',
      'profile.seed = true marks a profile built into hal0, so it also needs profile.first_party = true'
    );
  }

  const runtime = isTable(parsed.runtime) ? parsed.runtime : {};
  addUnknownKeys(runtime, RUNTIME_KEYS, 'runtime');
  if (runtime.family === undefined) add('runtime.family', 'missing', 'runtime.family: required');
  requireOneOf(runtime, 'family', 'runtime.family', RUNTIME_FAMILIES);
  if (
    runtime.min_hal0 !== undefined &&
    (typeof runtime.min_hal0 !== 'string' || !MIN_HAL0_PATTERN.test(runtime.min_hal0))
  ) {
    add(
      'runtime.min_hal0',
      'invalid',
      `runtime.min_hal0 must be a release number such as "1.5.0" (got ${JSON.stringify(runtime.min_hal0)})`
    );
  }

  // [tune] is hal0's profile body, key for key.
  if (parsed.tune === undefined) {
    add('tune', 'missing', 'tune: required');
  } else if (!isTable(parsed.tune)) {
    add('tune', 'invalid', 'tune must be a table');
  }
  const tune = isTable(parsed.tune) ? parsed.tune : {};
  addUnknownKeys(tune, TUNE_KEYS, 'tune');
  if (tune.flags !== undefined && typeof tune.flags !== 'string') {
    add('tune.flags', 'invalid', `tune.flags must be a string (got ${JSON.stringify(tune.flags)})`);
  }
  requireIntegerIn(tune, 'ctx_size', 'tune.ctx_size', CTX_SIZE_MIN, CTX_SIZE_MAX);
  requireBoolean(tune, 'enable_thinking', 'tune.enable_thinking');
  requireOneOf(tune, 'reasoning_effort', 'tune.reasoning_effort', REASONING_EFFORTS);
  requireIntegerIn(tune, 'reasoning_budget', 'tune.reasoning_budget', -1, CTX_SIZE_MAX);
  requireOneOf(tune, 'vision', 'tune.vision', VISION_MODES);
  requireOneOf(tune, 'speculation', 'tune.speculation', SPECULATION_MODES);
  if (tune.runner !== undefined && (typeof tune.runner !== 'string' || !RUNNER_KEY_PATTERN.test(tune.runner))) {
    add(
      'tune.runner',
      'invalid',
      `tune.runner must be a runner key such as "halogen", never an image reference (got ${JSON.stringify(tune.runner)})`
    );
  }
  requireNonEmptyString(tune, 'cloned_from', 'tune.cloned_from');
  if (tune.intent !== undefined && typeof tune.intent !== 'string') {
    add('tune.intent', 'invalid', `tune.intent must be a string (got ${JSON.stringify(tune.intent)})`);
  }

  if (isTable(parsed.tune) && profile.seed !== true) {
    // A blank flags string sets nothing, so it does not count.
    const settings = Object.keys(tune).filter(
      (k) =>
        TUNE_KEYS.includes(k) &&
        !TUNE_LABEL_KEYS.includes(k) &&
        !(k === 'flags' && typeof tune.flags === 'string' && tune.flags.trim() === '')
    );
    if (settings.length === 0) {
      add('tune', 'missing', 'tune: set at least one of flags, ctx_size, enable_thinking, vision, speculation, runner');
    }
  }

  if (runtime.family === 'llama-server') {
    for (const { flag, reason } of deniedFlags(tune.flags)) {
      add('tune.flags', 'invalid', `tune.flags: hal0 refuses ${flag} in a profile (${reason})`);
    }
  }
  if ((tune.runner === 'halogen') !== (runtime.family === 'halogen') && runtime.family !== undefined) {
    add(
      tune.runner === 'halogen' ? 'runtime.family' : 'tune.runner',
      'invalid',
      'tune.runner = "halogen" and runtime.family = "halogen" go together: set both or neither'
    );
  }

  const model = parsed.model;
  if (model !== undefined) {
    if (!isTable(model)) {
      add('model', 'invalid', 'model must be a table');
    } else {
      addUnknownKeys(model, MODEL_KEYS, 'model');
      if (model.id === undefined) add('model.id', 'invalid', 'model.id: required when [model] is present');
      else requireNonEmptyString(model, 'id', 'model.id');
      if (model.compatible !== undefined) {
        if (!Array.isArray(model.compatible)) {
          add('model.compatible', 'invalid', 'model.compatible must be an array of strings');
        } else {
          model.compatible.forEach((v, i) => {
            if (typeof v !== 'string' || v.length < 1) {
              add(
                `model.compatible[${i}]`,
                'invalid',
                `model.compatible[${i}] must be a non-empty string (got ${JSON.stringify(v)})`
              );
            }
          });
        }
      }
    }
  }

  const history = parsed.history;
  if (history !== undefined) {
    if (!Array.isArray(history) || history.length === 0) {
      add('history', 'invalid', 'history must be a non-empty array with at least one entry');
    } else {
      history.forEach((h, i) => {
        addUnknownKeys(h, HISTORY_ITEM_KEYS, `history[${i}]`);
        if (h?.v === undefined) {
          add(`history[${i}].v`, 'missing', `history[${i}].v: required`);
        } else if (!Number.isInteger(h.v) || h.v < 1) {
          add(
            `history[${i}].v`,
            'invalid',
            `history[${i}].v must be an integer >= 1 (got ${JSON.stringify(h.v)})`
          );
        }
        if (h?.date === undefined) add(`history[${i}].date`, 'missing', `history[${i}].date: required`);
        requireNonEmptyString(h ?? {}, 'note', `history[${i}].note`);
        if (h?.note === undefined) add(`history[${i}].note`, 'missing', `history[${i}].note: required`);
      });

      // Cross-check that needs the whole array, not just one entry — mirrors
      // hal0-profiles/lib/validate.mjs's strictly-descending (newest first)
      // check. Only compares entries that already parsed as valid integers,
      // so a malformed `v` doesn't also spam a spurious ordering error.
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1]?.v;
        const cur = history[i]?.v;
        if (Number.isInteger(prev) && Number.isInteger(cur) && !(prev > cur)) {
          add(
            `history[${i}].v`,
            'invalid',
            `history must be strictly descending (newest first); history[${i - 1}].v=${prev} is not greater than history[${i}].v=${cur}`
          );
        }
      }
    }
  }

  return issues;
}

/**
 * The full client-side validation pipeline: parse → shape-check → bucket
 * into one of the four wireframe states (plus the duplicate-slug edge
 * state, checked once the file is otherwise clean).
 *
 * @param {string} text - raw TOML source, from upload or paste
 * @param {object} [opts]
 * @param {Array<{id:string}>} [opts.rosterRows] - src/data/model-roster.ts ROSTER
 * @param {Array<object>} [opts.existingProfiles] - profiles.json's `profiles` array
 * @returns {object} a discriminated-by-`state` result object
 */
export function validateProfileToml(text, opts = {}) {
  const rosterRows = opts.rosterRows ?? [];
  const existingProfiles = opts.existingProfiles ?? [];
  const rosterIds = new Set(rosterRows.map((r) => r.id));

  let parsed;
  try {
    parsed = parseToml(text);
  } catch (err) {
    return {
      state: 'schema-error',
      blocking: true,
      parseError: true,
      line: typeof err.line === 'number' ? err.line : null,
      message: `failed to parse TOML: ${String(err.message).split('\n')[0]}`,
      cause: 'The file is not valid TOML syntax.',
      recovery: 'Check for a missing quote, bracket, or equals sign near the reported line.',
    };
  }

  const issues = collectSchemaIssues(parsed);
  const coreMissing = issues.filter((i) => i.kind === 'missing' && CORE_KEYS.includes(i.path));
  const otherIssues = issues.filter((i) => !(i.kind === 'missing' && CORE_KEYS.includes(i.path)));

  if (otherIssues.length > 0) {
    const primary = otherIssues[0];
    const loc = locateLine(text, primary.path);
    return {
      state: 'schema-error',
      blocking: true,
      parseError: false,
      issues: otherIssues,
      primary,
      line: loc?.line ?? null,
      lineText: loc?.text ?? null,
    };
  }

  if (coreMissing.length > 0) {
    return {
      state: 'missing-fields',
      blocking: true,
      missing: coreMissing.map((i) => ({ key: i.path, why: CORE_KEY_WHY[i.path] ?? '' })),
    };
  }

  const slug = parsed.profile.slug;
  const dup = existingProfiles.find((p) => p.profile?.slug === slug);
  if (dup) {
    return {
      state: 'duplicate-slug',
      blocking: true,
      slug,
      author: dup.profile.author,
      currentVersion: dup.history?.[0]?.v ?? 1,
      nextVersion: (dup.history?.[0]?.v ?? 1) + 1,
    };
  }

  const modelId = parsed.model?.id ?? null;
  // A profile that names no model has nothing to look up, so it is not "unknown".
  const modelKnown =
    modelId === null ||
    rosterIds.has(modelId) ||
    existingProfiles.some(
      (p) => p.model?.id === modelId || (p.model?.compatible ?? []).includes(modelId)
    );

  const linkedRuns = rosterRows.length ? benchFor(parsed, rosterRows).runs.length : 0;
  const summary = {
    slug,
    intent: parsed.profile.intent,
    modelId,
    modelKnown,
    family: parsed.runtime.family,
    minHal0: parsed.runtime.min_hal0 ?? null,
    flagCount: countFlags(parsed.tune.flags ?? ''),
    contextSize: parsed.tune.ctx_size ?? null,
    linkedRuns,
  };

  if (!modelKnown) {
    return { state: 'warning', blocking: false, reason: 'unknown-model', summary, parsed };
  }

  return { state: 'pass', blocking: false, summary, parsed };
}

/**
 * Builds the "continue on GitHub" pre-filled new-file URL — GitHub handles
 * fork/branch/PR for non-writers, no git commands needed on our end.
 * GitHub URLs have a practical length ceiling (~8k chars); profile TOMLs
 * run 1-2k so this is normally comfortably under, but we still flag it so
 * the caller can fall back to copy-to-clipboard + the plain new-file page.
 *
 * @param {string} slug
 * @param {string} tomlText
 * @returns {{ url: string, length: number, tooLong: boolean, fallbackUrl: string }}
 */
export function githubSubmitUrl(slug, tomlText) {
  const filename = `profiles/${slug}.toml`;
  const fallbackUrl = `${GITHUB_NEW_FILE_BASE}?filename=${encodeURIComponent(filename)}`;
  const url = `${fallbackUrl}&value=${encodeURIComponent(tomlText)}`;
  return { url, length: url.length, tooLong: url.length > GITHUB_URL_WARN_LENGTH, fallbackUrl };
}
