// src/lib/profile-validate.mjs
//
// Dependency-free (besides smol-toml) client-side port of the hal0-profiles
// validator (hal0-profiles/lib/validate.mjs + schema/profile.schema.json).
// Runs entirely in the browser before anything is sent anywhere — see
// docs/design/2026-08-09-community-comps/09 Profile Submission.html and its
// README §9 for the four validation states this implements:
//
//   pass             — parsed summary (slug, intent, model + "in roster"
//                       chip, lane, flag count, linked-runs count)
//   schema-error      — line-numbered, cause-then-recovery, blocking
//   missing-fields    — the three keys that matter (intent, model.id,
//                       args.raw), each with why it matters, blocking
//   warning           — unknown model id, NOT blocking, "unverified" chip
//
// Plus the duplicate-slug edge state (offer "submit as vN+1" before
// "rename mine") and the GitHub "new file" URL builder used by the
// "continue on GitHub" door.
//
// No fs/path/ajv here — this has to bundle for the client via Vite. The
// shape checks below are a hand-rolled mirror of
// hal0-profiles/schema/profile.schema.json, not a JSON Schema engine.
import { parse as parseToml } from 'smol-toml';
import { benchFor } from './profiles-join.mjs';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
export const INTENTS = ['chat', 'coding', 'agent', 'vision', 'draft', 'moe', 'embedding'];
export const RUNNER_KINDS = ['llama-server', 'flm', 'onnx', 'vllm'];
export const LANES = ['rocm', 'vulkan_radv', 'default', 'npu'];

// The three keys the "missing fields" state is scoped to — per README §9,
// "the three keys that matter". Any other missing/invalid field is treated
// as a (blocking) schema error instead, with a line rail where one can be
// located.
const CORE_KEYS = ['profile.intent', 'model.id', 'args.raw'];

const CORE_KEY_WHY = {
  'profile.intent':
    'what this profile is for: chat · coding · agent · vision · draft · moe · embedding',
  'model.id':
    'the roster id this config was tuned against. Without it nothing can join to a benchmark run.',
  'args.raw': 'the flag string itself. A profile without flags is just a name.',
};

const GITHUB_REPO = 'Hal0ai/hal0-profiles';
const GITHUB_NEW_FILE_BASE = `https://github.com/${GITHUB_REPO}/new/main`;
export const GITHUB_URL_WARN_LENGTH = 8000;

/**
 * Count "flags" in an args.raw string — tokens that start with `-` (but
 * are not bare `-`). Values that follow a flag (e.g. the `16384` in
 * `-c 16384`) are not counted.
 *
 * @param {string} raw
 * @returns {number}
 */
export function countFlags(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return 0;
  return raw
    .trim()
    .split(/\s+/)
    .filter((tok) => tok.startsWith('-') && tok !== '-').length;
}

/**
 * Best-effort line locator: finds the `key = ` line inside the named table
 * (or at the document root when `path` has no dotted table prefix).
 * Used only to rail the offending line in the schema-error state — a miss
 * degrades gracefully to `null` (no rail, field name still shown).
 *
 * @param {string} text - raw TOML source
 * @param {string} path - dotted path, e.g. "runner.lane" or "schema"
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

const ROOT_KEYS = ['schema', 'profile', 'runner', 'model', 'args', 'requires', 'history'];
const PROFILE_KEYS = ['slug', 'title', 'summary', 'intent', 'author', 'first_party'];
const RUNNER_KEYS = ['kind', 'lane', 'min_build', 'image'];
const MODEL_KEYS = ['id', 'quant', 'compatible'];
const ARGS_KEYS = ['raw'];
const REQUIRES_KEYS = ['gtt_gb', 'exclusive'];
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

  const addUnknownKeys = (obj, allowed, prefix) => {
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return;
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

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    add('(root)', 'invalid', 'document must be a table');
    return issues;
  }

  addUnknownKeys(parsed, ROOT_KEYS, '');

  if (parsed.schema !== 1) {
    add(
      'schema',
      parsed.schema === undefined ? 'missing' : 'invalid',
      parsed.schema === undefined
        ? 'schema: required'
        : `schema must equal 1 (got ${JSON.stringify(parsed.schema)})`
    );
  }

  for (const key of ['profile', 'runner', 'model', 'args', 'history']) {
    if (parsed[key] === undefined) add(key, 'missing', `${key}: required`);
  }

  const profile = parsed.profile ?? {};
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
  if (profile.intent !== undefined && !INTENTS.includes(profile.intent)) {
    add(
      'profile.intent',
      'invalid',
      `profile.intent must be one of ${INTENTS.join(' | ')} (got ${JSON.stringify(profile.intent)})`
    );
  }
  if (profile.first_party !== undefined && typeof profile.first_party !== 'boolean') {
    add(
      'profile.first_party',
      'invalid',
      `profile.first_party must be a boolean (got ${JSON.stringify(profile.first_party)})`
    );
  }

  const runner = parsed.runner ?? {};
  addUnknownKeys(runner, RUNNER_KEYS, 'runner');
  for (const key of ['kind', 'lane']) {
    if (runner[key] === undefined) add(`runner.${key}`, 'missing', `runner.${key}: required`);
  }
  if (runner.kind !== undefined && !RUNNER_KINDS.includes(runner.kind)) {
    add(
      'runner.kind',
      'invalid',
      `runner.kind must be one of ${RUNNER_KINDS.join(' | ')} (got ${JSON.stringify(runner.kind)})`
    );
  }
  if (runner.lane !== undefined && !LANES.includes(runner.lane)) {
    add(
      'runner.lane',
      'invalid',
      `runner.lane must be one of ${LANES.join(' | ')} (got ${JSON.stringify(runner.lane)})`
    );
  }
  requireNonEmptyString(runner, 'min_build', 'runner.min_build');
  requireNonEmptyString(runner, 'image', 'runner.image');

  const model = parsed.model ?? {};
  addUnknownKeys(model, MODEL_KEYS, 'model');
  if (model.id === undefined) add('model.id', 'missing', 'model.id: required');
  else requireNonEmptyString(model, 'id', 'model.id');
  requireNonEmptyString(model, 'quant', 'model.quant');
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

  const args = parsed.args ?? {};
  addUnknownKeys(args, ARGS_KEYS, 'args');
  if (args.raw === undefined || args.raw === '') add('args.raw', 'missing', 'args.raw: required');

  const requires = parsed.requires;
  if (requires !== undefined) {
    if (requires == null || typeof requires !== 'object' || Array.isArray(requires)) {
      add('requires', 'invalid', 'requires must be a table');
    } else {
      addUnknownKeys(requires, REQUIRES_KEYS, 'requires');
      if (requires.gtt_gb !== undefined) {
        if (!Number.isInteger(requires.gtt_gb) || requires.gtt_gb < 0) {
          add(
            'requires.gtt_gb',
            'invalid',
            `requires.gtt_gb must be an integer >= 0 (got ${JSON.stringify(requires.gtt_gb)})`
          );
        }
      }
      if (requires.exclusive !== undefined && typeof requires.exclusive !== 'boolean') {
        add(
          'requires.exclusive',
          'invalid',
          `requires.exclusive must be a boolean (got ${JSON.stringify(requires.exclusive)})`
        );
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

  const modelKnown =
    rosterIds.has(parsed.model.id) ||
    existingProfiles.some(
      (p) => p.model?.id === parsed.model.id || (p.model?.compatible ?? []).includes(parsed.model.id)
    );

  const linkedRuns = rosterRows.length ? benchFor(parsed, rosterRows).runs.length : 0;
  const summary = {
    slug,
    intent: parsed.profile.intent,
    modelId: parsed.model.id,
    modelKnown,
    lane: parsed.runner.lane,
    minBuild: parsed.runner.min_build ?? null,
    flagCount: countFlags(parsed.args.raw),
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
