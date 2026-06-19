#!/usr/bin/env node
/**
 * sync-changelog.mjs — pull the canonical CHANGELOG from the product repo.
 *
 * The human-facing /changelog and /releases pages are *derived* from
 * hal0's CHANGELOG.md so they can never silently drift from what actually
 * shipped (see CONTRIBUTING — the product repo is the single source of
 * truth). This runs as a `prebuild` step, so every Vercel build refreshes
 * the copy. A committed snapshot at src/data/changelog.md is the fallback:
 * if GitHub is unreachable the build still succeeds with the last-good copy.
 *
 * NOTE: this is the human changelog surface only. It is unrelated to the
 * machine-readable updater manifest served at releases.hal0.dev
 * (functions/_middleware.ts + public/releases/*.json) — do not conflate.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '../src/data/changelog.md');

// Canonical source: hal0ai/hal0 main branch. Overridable for testing.
const SOURCE =
  process.env.HAL0_CHANGELOG_URL ??
  'https://raw.githubusercontent.com/hal0ai/hal0/main/CHANGELOG.md';

async function main() {
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    if (!md.includes('# Changelog')) {
      throw new Error('fetched file does not look like the changelog');
    }
    const prev = await readFile(DEST, 'utf8').catch(() => '');
    if (md === prev) {
      console.log('[sync-changelog] up to date — no change');
      return;
    }
    await writeFile(DEST, md, 'utf8');
    console.log(`[sync-changelog] synced ${md.length} bytes from ${SOURCE}`);
  } catch (err) {
    console.warn(
      `[sync-changelog] WARN: could not fetch (${err.message}); ` +
        'keeping committed snapshot at src/data/changelog.md',
    );
  }
}

main();
