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
 * It also writes src/data/release-tags.json (the tag_name of every GitHub
 * release) so the site can tell which changelog headings are actually
 * tagged versus unreleased content ahead of the next tag.
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

const TAGS_DEST = resolve(__dirname, '../src/data/release-tags.json');

// Canonical source: hal0ai/hal0 main branch. Overridable for testing.
const SOURCE =
  process.env.HAL0_CHANGELOG_URL ??
  'https://raw.githubusercontent.com/hal0ai/hal0/main/CHANGELOG.md';

const RELEASES_SOURCE =
  process.env.HAL0_RELEASES_URL ??
  'https://api.github.com/repos/hal0ai/hal0/releases?per_page=100';

async function syncChangelog() {
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

async function syncReleaseTags() {
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    // Follow the Link header: nightlies push the real releases past one page.
    const releases = [];
    let url = RELEASES_SOURCE;
    for (let page = 0; url && page < 20; page++) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const batch = await res.json();
      if (
        !Array.isArray(batch) ||
        !batch.every((r) => r && typeof r.tag_name === 'string' && r.tag_name)
      ) {
        throw new Error('releases response is not an array of tagged releases');
      }
      releases.push(...batch);
      const next = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '');
      // Only follow a next page on the configured origin, so a bad override
      // can never redirect the Authorization header elsewhere.
      url = next && new URL(next[1]).origin === new URL(RELEASES_SOURCE).origin ? next[1] : null;
    }
    const tags = releases.map((r) => r.tag_name);
    const prevRaw = await readFile(TAGS_DEST, 'utf8').catch(() => '');
    let prevTags = null;
    try {
      prevTags = JSON.parse(prevRaw).tags;
    } catch {}
    if (prevTags && JSON.stringify(prevTags) === JSON.stringify(tags)) {
      console.log('[sync-changelog] release tags up to date — no change');
      return;
    }
    const out = { fetched_at: new Date().toISOString(), tags };
    await writeFile(TAGS_DEST, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`[sync-changelog] synced ${tags.length} release tags (newest ${tags[0] ?? 'none'})`);
  } catch (err) {
    console.warn(
      `[sync-changelog] WARN: could not fetch release tags (${err.message}); ` +
        'keeping committed snapshot at src/data/release-tags.json',
    );
  }
}

async function main() {
  await syncChangelog();
  await syncReleaseTags();
}

main();
