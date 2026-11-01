#!/usr/bin/env node
/**
 * sync-changelog.mjs — pull the canonical CHANGELOG from the product repo.
 *
 * The human-facing /releases page (and the /changelog redirect to it) is *derived* from
 * hal0's CHANGELOG.md so they can never silently drift from what actually
 * shipped (see CONTRIBUTING — the product repo is the single source of
 * truth). This runs as a `prebuild` step, so every Vercel build refreshes
 * the copy. A committed snapshot at src/data/changelog.md is the fallback:
 * if GitHub is unreachable the build still succeeds with the last-good copy,
 * and prints one line per failed source:
 *   [sync-changelog] <url> failed (<HTTP status or error>); using committed snapshot
 * That line is the only sign the deployed site may be behind the product, so
 * look for it in the build log when a version looks stale. Setting
 * GITHUB_TOKEN raises the GitHub API rate limit (60/hour unauthenticated, and
 * shared by every build on the same egress IP).
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
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '../src/data/changelog.md');

const TAGS_DEST = resolve(__dirname, '../src/data/release-tags.json');

// Canonical source: hal0ai/hal0 main branch. Overridable for testing.
const SOURCE =
  process.env.HAL0_CHANGELOG_URL ??
  'https://raw.githubusercontent.com/hal0ai/hal0/main/CHANGELOG.md';

const TIMEOUT_MS = 10_000;

const RELEASES_SOURCE =
  process.env.HAL0_RELEASES_URL ??
  'https://api.github.com/repos/hal0ai/hal0/releases?per_page=100';

// One line, on stderr, naming the URL and why it failed. The build never
// fails on a sync problem (the committed snapshot is the fallback), so this
// line is the only trace of a stale site: keep it greppable in CI logs.
function warnFallback(url, err) {
  console.warn(`[sync-changelog] ${url} failed (${describe(err)}); using committed snapshot`);
}

function describe(err) {
  if (err instanceof HttpError) return `HTTP ${err.status}`;
  // AbortSignal.timeout() rejects with a DOMException whose numeric `code`
  // is 23; say what happened instead of printing that number.
  if (err?.name === 'TimeoutError') return 'timeout';
  // fetch() rejects with TypeError('fetch failed') and the real reason on cause.
  return err?.cause?.code ?? err?.code ?? err?.message ?? String(err);
}

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

/**
 * Pull CHANGELOG.md. Resolves to the markdown now on disk: the fresh copy
 * when the fetch succeeded, the committed snapshot when it did not.
 */
export async function syncChangelog({ source = SOURCE, dest = DEST, timeoutMs = TIMEOUT_MS } = {}) {
  const committed = await readFile(dest, 'utf8').catch(() => '');
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new HttpError(res.status);
    const md = await res.text();
    if (!md.includes('# Changelog')) {
      throw new Error('fetched file does not look like the changelog');
    }
    if (md === committed) {
      console.log('[sync-changelog] up to date — no change');
      return md;
    }
    await writeFile(dest, md, 'utf8');
    console.log(`[sync-changelog] synced ${md.length} bytes from ${source}`);
    return md;
  } catch (err) {
    warnFallback(source, err);
    return committed;
  }
}

/**
 * Pull the GitHub release tag list. Resolves to the tag names now on disk:
 * the fresh list when every page was fetched, the committed snapshot when
 * any request failed (a half-fetched list is never written).
 */
export async function syncReleaseTags({
  source = RELEASES_SOURCE,
  dest = TAGS_DEST,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  const prevRaw = await readFile(dest, 'utf8').catch(() => '');
  let prevTags = null;
  try {
    prevTags = JSON.parse(prevRaw).tags;
  } catch {}
  let url = source;
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    // Follow the Link header: nightlies push the real releases past one page.
    const releases = [];
    for (let page = 0; url && page < 20; page++) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new HttpError(res.status);
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
      url = next && new URL(next[1]).origin === new URL(source).origin ? next[1] : null;
    }
    // A repo with releases never answers with none: an empty list means the
    // API or an upstream proxy misbehaved, and writing it would empty the
    // tag set (every changelog heading would then read as unreleased).
    if (releases.length === 0) throw new Error('empty release list');
    const tags = releases.map((r) => r.tag_name);
    if (prevTags && JSON.stringify(prevTags) === JSON.stringify(tags)) {
      console.log('[sync-changelog] release tags up to date — no change');
      return tags;
    }
    const out = { fetched_at: new Date().toISOString(), tags };
    await writeFile(dest, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`[sync-changelog] synced ${tags.length} release tags (newest ${tags[0] ?? 'none'})`);
    return tags;
  } catch (err) {
    warnFallback(url ?? source, err);
    return prevTags ?? [];
  }
}

async function main() {
  await syncChangelog();
  await syncReleaseTags();
}

// Importable for tests; only a direct `node scripts/sync-changelog.mjs`
// (npm prebuild, `npm run sync:changelog`) runs the sync.
// argv[1] is the path as typed, so resolve symlinks before comparing.
if (isMain()) main();

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
