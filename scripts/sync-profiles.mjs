#!/usr/bin/env node
/**
 * sync-profiles.mjs — pull community profiles from the hal0-profiles repo.
 *
 * The /profiles gallery is *derived* from Hal0ai/hal0-profiles (profiles/*.toml)
 * so it can never silently drift from the community registry. This runs as a
 * `prebuild` step, so every Vercel build refreshes the copy. A committed
 * snapshot at src/data/profiles.json is the fallback: if GitHub is
 * unreachable the build still succeeds with the last-good copy.
 *
 * Bench numbers are never stored here — see src/lib/profiles-join.mjs, which
 * joins these records against src/data/model-roster.ts at render time.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse, TomlDate } from 'smol-toml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '../src/data/profiles.json');

// Canonical source: Hal0ai/hal0-profiles main branch. Overridable for testing.
const CONTENTS_URL =
  process.env.HAL0_PROFILES_CONTENTS_URL ??
  'https://api.github.com/repos/Hal0ai/hal0-profiles/contents/profiles';

/**
 * Recursively convert smol-toml's TomlDate instances into plain
 * "YYYY-MM-DD" strings so the committed snapshot is pure JSON (no Date
 * objects, no timezone surprises).
 */
function stringifyDates(value) {
  if (value instanceof TomlDate) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(stringifyDates);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = stringifyDates(v);
    }
    return out;
  }
  return value;
}

/**
 * Parse a single profile TOML source into a ProfileRecord. Exported for
 * tests. Throws (with the filename in the message) on malformed TOML.
 */
export function parseProfileToml(source, filename) {
  try {
    const parsed = parse(source);
    return stringifyDates(parsed);
  } catch (err) {
    throw new Error(`failed to parse profile TOML ${filename}: ${err.message}`);
  }
}

async function main() {
  try {
    const res = await fetch(CONTENTS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entries = await res.json();
    const tomlEntries = entries.filter((e) => e.name.endsWith('.toml'));
    if (tomlEntries.length === 0) {
      throw new Error('no .toml files found in profiles/');
    }

    const profiles = await Promise.all(
      tomlEntries.map(async (entry) => {
        const fileRes = await fetch(entry.download_url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status} fetching ${entry.name}`);
        const source = await fileRes.text();
        return parseProfileToml(source, entry.name);
      }),
    );

    profiles.sort((a, b) => a.profile.slug.localeCompare(b.profile.slug));

    const snapshot = {
      synced: new Date().toISOString(),
      profiles,
    };

    const prev = await readFile(DEST, 'utf8').catch(() => '');
    const next = JSON.stringify(snapshot, null, 2) + '\n';
    if (JSON.stringify(JSON.parse(prev || '{}').profiles) === JSON.stringify(profiles)) {
      console.log('[sync-profiles] up to date — no change');
      return;
    }
    await writeFile(DEST, next, 'utf8');
    console.log(`[sync-profiles] synced ${profiles.length} profiles from ${CONTENTS_URL}`);
  } catch (err) {
    console.warn(
      `[sync-profiles] WARN: could not fetch (${err.message}); ` +
        'keeping committed snapshot at src/data/profiles.json',
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
