// src/lib/profile-envelope.mjs
//
// Turns a registry record's [tune] table into the two things a hal0 box can
// take: the `.hal0profile.json` envelope the dashboard imports (Profiles →
// Import, POST /api/profiles/import) and the `[profile.<name>]` table for
// /etc/hal0/profiles.toml.
//
// The envelope mirrors hal0's own export (src/hal0/profiles/portable.py):
// `profile` is the profile body and `checksum` is sha256 over that body
// serialized the way Python's json.dumps(body, sort_keys=True) writes it. hal0
// refuses an envelope whose checksum is present and wrong, so the serializer
// here has to match Python's byte for byte; scripts/test/profile-envelope.test.mjs
// pins it against the checksums hal0 publishes for its own addon profiles.
//
// Build-time only (node:crypto). Nothing here may be imported by a client
// script.
import { createHash } from 'node:crypto';

export const ENVELOPE_KIND = 'hal0.profile';
export const ENVELOPE_SCHEMA_VERSION = 2;

// hal0's ProfileConfig keys, in the order hal0 documents them.
export const TUNE_KEYS = [
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

/** A JSON string literal the way Python writes it with ensure_ascii=True. */
function pythonString(value) {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/**
 * Python's `json.dumps(value, sort_keys=True)`: keys sorted, ", " and ": "
 * separators, non-ASCII escaped. Covers what a profile body holds (strings,
 * integers, booleans, null, arrays, plain objects).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function pythonJsonDumps(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return pythonString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new TypeError(`profile body holds a non-integer number: ${value}`);
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(pythonJsonDumps).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${pythonString(k)}: ${pythonJsonDumps(value[k])}`).join(', ')}}`;
  }
  throw new TypeError(`profile body holds an unsupported value: ${typeof value}`);
}

/** `sha256:<hex>` over a profile body, as hal0's `portable._checksum` computes it. */
export function bodyChecksum(body) {
  return `sha256:${createHash('sha256').update(pythonJsonDumps(body), 'utf8').digest('hex')}`;
}

/** The record's tune as a plain object in TUNE_KEYS order; {} when it has none. */
export function tuneOf(record) {
  const tune = record?.tune;
  if (tune == null || typeof tune !== 'object') return {};
  const body = {};
  for (const key of TUNE_KEYS) {
    if (tune[key] !== undefined && tune[key] !== null) body[key] = tune[key];
  }
  return body;
}

/**
 * True when the record is a profile hal0 already ships. Its name is taken on
 * every box, so there is nothing to import; the page says to clone it.
 */
export function isSeed(record) {
  return record?.profile?.seed === true;
}

/** The newest history entry's date, or '' when the record has none. */
function latestDate(record) {
  const history = Array.isArray(record?.history) ? record.history : [];
  const latest = history.reduce((best, h) => (best === null || h.v > best.v ? h : best), null);
  return typeof latest?.date === 'string' ? latest.date : '';
}

/**
 * The `.hal0profile.json` envelope for a record. `exported_at` is the date of
 * the record's newest history entry, so the file is the same on every build.
 *
 * @param {object} record - one entry of profiles.json
 * @returns {object}
 */
export function profileEnvelope(record) {
  const body = tuneOf(record);
  const date = latestDate(record);
  return {
    kind: ENVELOPE_KIND,
    schema_version: ENVELOPE_SCHEMA_VERSION,
    hal0_version: record?.runtime?.min_hal0 ?? '',
    exported_at: date ? `${date}T00:00:00Z` : '',
    name: record.profile.slug,
    checksum: bodyChecksum(body),
    profile: body,
  };
}

/** Where the site serves a record's envelope. */
export function envelopePath(slug) {
  return `/profiles/${envelopeFile(slug)}`;
}

/** The envelope's file name, relative to /profiles/. */
export function envelopeFile(slug) {
  return `${slug}.hal0profile.json`;
}

export const ADDON_INDEX_KIND = 'hal0.addon-index';
export const ADDON_INDEX_SCHEMA_VERSION = 1;
// Envelope schema 2 is read from hal0 1.5.0; a record that names no floor of
// its own gets this one.
export const ADDON_MIN_HAL0 = '1.5.0';

/** The newest history entry's version number, or undefined. */
function latestVersion(record) {
  const history = Array.isArray(record?.history) ? record.history : [];
  const versions = history.map((h) => h?.v).filter((v) => Number.isInteger(v));
  return versions.length ? Math.max(...versions) : undefined;
}

/**
 * The `hal0.addon-index` hal0's dashboard reads to list importable profiles
 * (contract: hal0 docs/reference/profile-addons.mdx). One row per importable
 * record, sorted by name; a built-in profile has no envelope and no row.
 *
 * `checksum` is the envelope's own, so the two files always agree. The keys
 * after `min_hal0_version` are optional extras the dashboard shows when
 * present; `category` is the gallery's intent tag.
 *
 * @param {object[]} records - profiles.json `profiles`, already filtered to
 *   the ones that get a page
 * @returns {object}
 */
export function addonIndex(records) {
  const addons = records
    .filter((record) => !isSeed(record) && typeof record?.profile?.slug === 'string')
    .map((record) => {
      const { profile, runtime = {} } = record;
      const envelope = profileEnvelope(record);
      const row = {
        name: profile.slug,
        title: profile.title || profile.slug,
        description: envelope.profile.intent || profile.summary || profile.title || profile.slug,
        runtime_family: runtime.family || 'llama-server',
        runner: envelope.profile.runner ?? null,
        checksum: envelope.checksum,
        file: envelopeFile(profile.slug),
        min_hal0_version: runtime.min_hal0 || ADDON_MIN_HAL0,
      };
      if (typeof profile.intent === 'string' && profile.intent) row.category = profile.intent;
      if (typeof profile.summary === 'string' && profile.summary) row.summary = profile.summary;
      if (typeof profile.author === 'string' && profile.author) row.author = profile.author;
      if (typeof profile.first_party === 'boolean') row.first_party = profile.first_party;
      const version = latestVersion(record);
      if (version !== undefined) row.version = version;
      return row;
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { kind: ADDON_INDEX_KIND, schema_version: ADDON_INDEX_SCHEMA_VERSION, addons };
}

/**
 * The record's tune as the table hal0 reads from /etc/hal0/profiles.toml.
 *
 * @param {object} record
 * @param {string} [name] - the profile name to write; defaults to the slug
 * @returns {string}
 */
export function hal0ProfileToml(record, name = record.profile.slug) {
  const body = tuneOf(record);
  const lines = [`[profile.${name}]`];
  for (const [key, value] of Object.entries(body)) {
    lines.push(`${key} = ${typeof value === 'string' ? JSON.stringify(value) : value}`);
  }
  return lines.join('\n');
}

/**
 * The tune's typed fields as short labels for a card or a fact list, in a
 * fixed order. Only fields the profile sets are returned; flags are shown on
 * their own.
 *
 * @param {object} record
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function tuneFacts(record) {
  const tune = tuneOf(record);
  const facts = [];
  if (tune.ctx_size !== undefined) {
    facts.push({ key: 'ctx_size', label: 'context', value: formatContext(tune.ctx_size) });
  }
  if (tune.enable_thinking !== undefined) {
    facts.push({ key: 'enable_thinking', label: 'thinking', value: tune.enable_thinking ? 'on' : 'off' });
  }
  if (tune.reasoning_effort !== undefined) {
    facts.push({ key: 'reasoning_effort', label: 'effort', value: String(tune.reasoning_effort) });
  }
  if (tune.reasoning_budget !== undefined) {
    facts.push({
      key: 'reasoning_budget',
      label: 'reasoning budget',
      value: tune.reasoning_budget === -1 ? 'unlimited' : String(tune.reasoning_budget),
    });
  }
  if (tune.vision !== undefined) facts.push({ key: 'vision', label: 'vision', value: String(tune.vision) });
  if (tune.speculation !== undefined) {
    facts.push({ key: 'speculation', label: 'speculation', value: String(tune.speculation) });
  }
  if (tune.runner !== undefined) facts.push({ key: 'runner', label: 'runner', value: String(tune.runner) });
  if (tune.cloned_from !== undefined) {
    facts.push({ key: 'cloned_from', label: 'cloned from', value: String(tune.cloned_from) });
  }
  return facts;
}

/** 65536 → "64K", 4096 → "4096", 262144 → "256K". Exact multiples of 1024 only. */
export function formatContext(tokens) {
  if (!Number.isInteger(tokens)) return String(tokens);
  return tokens >= 16384 && tokens % 1024 === 0 ? `${tokens / 1024}K` : String(tokens);
}
