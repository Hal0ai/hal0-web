#!/usr/bin/env node
/**
 * sync-bench.mjs — pull the live roster sweep from the bench API.
 *
 * The /benchmarks leaderboard renders the build-time snapshot first and
 * upgrades in the browser when api.hal0.dev answers (see design handoff
 * §5 Freshness badge). This prebuild step keeps the *committed* snapshot
 * fresh so a cold build (or one where the API is unreachable) still ships
 * a real, non-empty table — same fetch-with-committed-fallback contract as
 * sync-changelog.mjs.
 *
 * NOTE: as of this writing api.hal0.dev is built (hal0-web PR #63) but not
 * yet deployed, so this step is expected to no-op (fall through to the
 * catch) on every build until that lands. That is intentional, not a bug.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '../src/data/bench-snapshot.json');

// Canonical source: the hal0 bench API. Overridable for testing.
const SOURCE = process.env.HAL0_BENCH_API_URL ?? 'https://api.hal0.dev/v1/roster';

async function main() {
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(3_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const roster = await res.json();
    if (!roster || !Array.isArray(roster.models)) {
      throw new Error('fetched payload does not look like the /v1/roster contract');
    }
    const snapshot = {
      fetched_at: new Date().toISOString(),
      source: 'api',
      roster,
    };
    const next = JSON.stringify(snapshot, null, 2) + '\n';
    const prev = await readFile(DEST, 'utf8').catch(() => '');
    if (next === prev) {
      console.log('[sync-bench] up to date — no change');
      return;
    }
    await writeFile(DEST, next, 'utf8');
    console.log(`[sync-bench] synced ${roster.models.length} models from ${SOURCE}`);
  } catch (err) {
    console.warn(
      `[sync-bench] WARN: could not fetch (${err.message}); ` +
        'keeping committed snapshot at src/data/bench-snapshot.json',
    );
  }
}

main();
