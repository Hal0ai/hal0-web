import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChangelog,
  releaseHighlights,
  splitReleases,
  releaseSections,
  plainText,
} from '../../src/lib/changelog.js';

const RAW = `# Changelog

## [Unreleased]

## [1.4.0] — 2026-10-08

Intro.

### Highlights

- big thing

## [1.3.1-rc.1] — 2026-09-20

### Fixed

- thing

## [1.3.0] — 2026-09-16

### Added

- thing
`;

test('untagged heading first in file is not latestTagged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.3.1-rc.1', 'v1.3.0'] });
  assert.equal(r.latest.version, '1.4.0');
  assert.equal(r.latest.untagged, true);
  assert.equal(r.latestTagged.version, '1.3.0');
});

test('tagged heading is latestTagged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.4.0', 'v1.3.0'] });
  assert.equal(r.latestTagged.version, '1.4.0');
  assert.equal(r.latestTagged.untagged, false);
  assert.equal(r.versions.find((v) => v.version === '1.3.1-rc.1').untagged, true);
});

test('bare (unprefixed) tag names also match', () => {
  const r = parseChangelog(RAW, { tags: ['1.4.0'] });
  assert.equal(r.latestTagged.version, '1.4.0');
});

test('tags omitted falls back to latestStable and nothing is untagged', () => {
  const r = parseChangelog(RAW);
  assert.equal(r.latestTagged, r.latestStable);
  assert.equal(r.latestTagged.version, '1.4.0');
  assert.ok(r.versions.every((v) => v.untagged === false));
});

test('prerelease handling unchanged', () => {
  const r = parseChangelog(RAW, { tags: ['v1.3.1-rc.1', 'v1.3.0'] });
  assert.equal(r.latestPrerelease.version, '1.3.1-rc.1');
  assert.equal(r.latestPrerelease.prerelease, true);
  assert.equal(r.latestStable.version, '1.4.0');
});

// ── releaseHighlights / splitReleases (releases page helpers) ──────────────

const HL_RAW = `# Changelog

## [9.9.0] — 2026-11-01

### Highlights

- first highlight with \`code\`
- second highlight

### Fixed

- fix one
- fix two
- fix three

## [9.8.1] — 2026-10-20

### Fixed

- alpha fix
- beta fix
- gamma fix
- delta fix

## [9.8.0] — 2026-10-10

Just an intro paragraph and no lists at all.
`;

test('releaseHighlights returns the Highlights bullets when that section exists', () => {
  const r = parseChangelog(HL_RAW);
  const v = r.versions.find((x) => x.version === '9.9.0');
  const items = releaseHighlights(v);
  assert.equal(items.length, 2);
  assert.equal(items[0], 'first highlight with <code>code</code>');
  assert.equal(items[1], 'second highlight');
});

test('releaseHighlights falls back to the first bullets of added/changed/fixed, capped at max', () => {
  const r = parseChangelog(HL_RAW);
  const v = r.versions.find((x) => x.version === '9.8.1');
  assert.deepEqual(releaseHighlights(v), ['alpha fix', 'beta fix', 'gamma fix']);
  assert.deepEqual(releaseHighlights(v, 2), ['alpha fix', 'beta fix']);
});

test('releaseHighlights prefers added over changed over fixed in the fallback', () => {
  const raw = `# Changelog

## [9.7.0] — 2026-09-01

### Fixed

- a fix

### Changed

- a change

### Added

- an add one
- an add two
`;
  const v = parseChangelog(raw).versions[0];
  assert.deepEqual(releaseHighlights(v), ['an add one', 'an add two', 'a change']);
});

test('releaseHighlights returns [] when the entry has no bullets', () => {
  const r = parseChangelog(HL_RAW);
  const v = r.versions.find((x) => x.version === '9.8.0');
  assert.deepEqual(releaseHighlights(v), []);
});

test('releaseHighlights ignores nested sub-bullets', () => {
  const raw = `# Changelog

## [9.6.0] — 2026-08-01

### Highlights

- top one
  - nested detail
- top two
`;
  const v = parseChangelog(raw).versions[0];
  const items = releaseHighlights(v);
  assert.equal(items.length, 2);
  assert.ok(items[0].startsWith('top one'));
  assert.equal(items[1], 'top two');
});

function twelve() {
  const lines = ['# Changelog', ''];
  for (let i = 12; i >= 1; i--) {
    lines.push(`## [8.${i}.0] — 2026-0${i > 9 ? 9 : i}-01`, '', '### Fixed', '', `- fix ${i}`, '');
  }
  return lines.join('\n');
}

test('splitReleases(recent=2) on twelve entries gives 2 + 10', () => {
  const { versions } = parseChangelog(twelve());
  assert.equal(versions.length, 12);
  const { recent, archive } = splitReleases(versions, 2);
  assert.equal(recent.length, 2);
  assert.equal(archive.length, 10);
  assert.equal(recent[0].version, '8.12.0');
  assert.equal(archive[0].version, '8.10.0');
});

test('splitReleases defaults to eight recent entries', () => {
  const { versions } = parseChangelog(twelve());
  const { recent, archive } = splitReleases(versions);
  assert.equal(recent.length, 8);
  assert.equal(archive.length, 4);
});

test('splitReleases keeps leading untagged entries in recent on top of the tagged count', () => {
  const { versions } = parseChangelog(twelve(), { tags: ['v8.11.0', 'v8.10.0', 'v8.9.0', 'v8.8.0', 'v8.7.0', 'v8.6.0', 'v8.5.0', 'v8.4.0', 'v8.3.0', 'v8.2.0', 'v8.1.0'] });
  assert.equal(versions[0].untagged, true);
  const { recent, archive } = splitReleases(versions, 2);
  // 8.12.0 is untagged: it rides in recent in addition to the 2 tagged entries.
  assert.deepEqual(recent.map((v) => v.version), ['8.12.0', '8.11.0', '8.10.0']);
  assert.equal(archive.length, 9);
  assert.ok(archive.every((v) => !v.untagged));
});

test('splitReleases archives untagged history that follows the recent tagged entries', () => {
  const { versions } = parseChangelog(twelve(), { tags: ['v8.12.0', 'v8.11.0', 'v8.10.0', 'v8.8.0', 'v8.7.0'] });
  // 8.9.0 untagged sits between recent tagged entries; 8.6.0 and older are untagged history.
  const { recent, archive } = splitReleases(versions, 4);
  assert.deepEqual(recent.map((v) => v.version), ['8.12.0', '8.11.0', '8.10.0', '8.9.0', '8.8.0']);
  assert.equal(archive.length, 7);
  assert.equal(archive[0].version, '8.7.0');
  assert.ok(archive.some((v) => v.untagged));
});

test('splitReleases with fewer entries than recent leaves the archive empty', () => {
  const { versions } = parseChangelog(twelve());
  const { recent, archive } = splitReleases(versions.slice(0, 3), 8);
  assert.equal(recent.length, 3);
  assert.deepEqual(archive, []);
});

// ── plainText / releaseSections (releases page entry bodies) ───────────────

test('plainText strips tags, decodes entities and collapses whitespace', () => {
  assert.equal(
    plainText('<strong>The dock.</strong> It&#39;s <code>a &lt;b&gt;</code>\n  &amp; more &quot;q&quot;'),
    'The dock. It\'s a <b> & more "q"',
  );
  assert.equal(plainText(''), '');
});

const SECTIONS_RAW = `# Changelog

## [9.5.0] — 2026-11-01

Intro paragraph.

### Fixed

- fix 1
- fix 2

### Highlights

- hl 1
- hl 2
- hl 3
- hl 4
- hl 5

### Breaking

- brk 1

### Added

- add 1
- add 2
- add 3
- add 4
- add 5
- add 6
- add 7
- add 8

### Audience

Plain paragraph with no list.

### Known issues

- ki 1
`;

test('releaseSections orders Highlights, Breaking, then added/changed/removed/fixed/security, then the rest', () => {
  const v = parseChangelog(SECTIONS_RAW).versions[0];
  assert.deepEqual(
    releaseSections(v).map((s) => s.title),
    ['Highlights', 'Breaking', 'Added', 'Fixed', 'Known issues'],
  );
});

test('releaseSections caps Added at six bullets and reports how many were cut', () => {
  const v = parseChangelog(SECTIONS_RAW).versions[0];
  const byTitle = Object.fromEntries(releaseSections(v).map((s) => [s.title, s]));
  assert.equal(byTitle.Highlights.items.length, 5, 'Highlights are never cut');
  assert.equal(byTitle.Highlights.more, 0);
  assert.equal(byTitle.Added.items.length, 6);
  assert.equal(byTitle.Added.more, 2);
  assert.equal(byTitle.Fixed.items.length, 2);
  assert.equal(byTitle.Fixed.more, 0);
  assert.equal(byTitle.Breaking.kind, 'breaking');
  assert.equal(releaseSections(v, { max: 3 }).find((s) => s.title === 'Added').items.length, 3, 'max still overrides the cap');
});

function longSections(titles, count) {
  const body = titles
    .map((t) => `### ${t}\n\n${Array.from({ length: count }, (_, i) => `- ${t.toLowerCase()} item ${i + 1}`).join('\n')}\n`)
    .join('\n');
  return parseChangelog(`# Changelog\n\n## [9.4.0] — 2026-11-01\n\n${body}`).versions[0];
}

test('Breaking, Migrations, Security and Highlights are never cut, even at ten bullets', () => {
  const v = longSections(['Highlights', 'Breaking', 'Migrations', 'Security'], 10);
  const sections = releaseSections(v);
  assert.deepEqual(sections.map((s) => s.title), ['Highlights', 'Breaking', 'Security', 'Migrations']);
  for (const s of sections) {
    assert.equal(s.items.length, 10, `${s.title} keeps all ten bullets`);
    assert.equal(s.more, 0, `${s.title} reports nothing cut`);
  }
});

test('an "Operator migrations" section is never cut either, whatever its case', () => {
  for (const title of ['Operator migrations', 'Operator Migrations', 'OPERATOR MIGRATIONS']) {
    const [s] = releaseSections(longSections([title], 10));
    assert.equal(s.title, title);
    assert.equal(s.items.length, 10, `${title} keeps all ten bullets`);
    assert.equal(s.more, 0, `${title} reports nothing cut`);
  }
});

test('the protected titles are exact: a longer migrations-ish title is still capped at six', () => {
  const [s] = releaseSections(longSections(['Operator migrations checklist'], 10));
  assert.equal(s.items.length, 6);
  assert.equal(s.more, 4);
});

test('Added, Changed, Removed and Fixed are cut at six bullets', () => {
  const v = longSections(['Added', 'Changed', 'Removed', 'Fixed'], 10);
  for (const s of releaseSections(v)) {
    assert.equal(s.items.length, 6, `${s.title} shows six`);
    assert.equal(s.more, 4, `${s.title} reports four more`);
  }
});

test('a Highlights section with no bullets is not a Highlights section', () => {
  const raw = `# Changelog

## [9.3.0] — 2026-11-01

### Highlights

Only prose here, no list.

### Added

- an add
`;
  const v = parseChangelog(raw).versions[0];
  assert.ok(!releaseSections(v).some((s) => s.title === 'Highlights'));
  assert.deepEqual(releaseHighlights(v), ['an add']);
});

test('releaseSections skips sections without list items and can skip Highlights', () => {
  const v = parseChangelog(SECTIONS_RAW).versions[0];
  assert.ok(!releaseSections(v).some((s) => s.title === 'Audience'));
  assert.ok(!releaseSections(v, { skipHighlights: true }).some((s) => s.title === 'Highlights'));
});

// ── sync-changelog fallback ────────────────────────────────────────────────
// A failed fetch must keep the committed snapshot, never fail the build, and
// say so in exactly one stderr line that names the URL and why it failed.

import { readFile, writeFile, mkdtemp, symlink, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

const TAGS_FILE = new URL('../../src/data/release-tags.json', import.meta.url);
const CHANGELOG_FILE = new URL('../../src/data/changelog.md', import.meta.url);

async function closedPort() {
  const srv = createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

async function withServer(handler, fn) {
  const srv = createServer(handler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    return await fn(srv.address().port);
  } finally {
    srv.closeAllConnections();
    await new Promise((r) => srv.close(r));
  }
}

const withStatus = (status, fn) =>
  withServer((_req, res) => {
    res.statusCode = status;
    res.end('nope');
  }, fn);

function captureWarnings() {
  const lines = [];
  const orig = console.warn;
  console.warn = (...args) => lines.push(args.join(' '));
  return { lines, restore: () => (console.warn = orig) };
}

// What a warning may say went wrong: an error name (ECONNREFUSED, timeout,
// empty release list) or an HTTP status. Never a bare number such as the
// DOMException code 23 a timeout carries.
const REASON = '(?:HTTP \\d{3}|[A-Za-z][A-Za-z_ ]*[A-Za-z])';

const deadPort = await closedPort();
process.env.HAL0_RELEASES_URL = `http://127.0.0.1:${deadPort}/releases?per_page=100`;
process.env.HAL0_CHANGELOG_URL = `http://127.0.0.1:${deadPort}/CHANGELOG.md`;
const sync = await import('../sync-changelog.mjs');

test('release-tag sync resolves to the committed tags and warns once when the API is unreachable', async () => {
  const before = await readFile(TAGS_FILE, 'utf8');
  const cap = captureWarnings();
  let tags;
  try {
    tags = await sync.syncReleaseTags();
  } finally {
    cap.restore();
  }
  assert.deepEqual(tags, JSON.parse(before).tags);
  assert.equal(cap.lines.length, 1, `one warning line, got ${JSON.stringify(cap.lines)}`);
  assert.match(
    cap.lines[0],
    new RegExp(`^\\[sync-changelog\\] http://127\\.0\\.0\\.1:${deadPort}/releases\\?per_page=100 failed \\(${REASON}\\); using committed snapshot$`),
  );
  assert.equal(await readFile(TAGS_FILE, 'utf8'), before, 'the committed snapshot is untouched');
});

test('changelog sync resolves to the committed markdown and warns once when the source is unreachable', async () => {
  const before = await readFile(CHANGELOG_FILE, 'utf8');
  const cap = captureWarnings();
  let md;
  try {
    md = await sync.syncChangelog();
  } finally {
    cap.restore();
  }
  assert.equal(md, before);
  assert.equal(cap.lines.length, 1);
  assert.match(
    cap.lines[0],
    new RegExp(`^\\[sync-changelog\\] http://127\\.0\\.0\\.1:\\d+/CHANGELOG\\.md failed \\(${REASON}\\); using committed snapshot$`),
  );
  assert.equal(await readFile(CHANGELOG_FILE, 'utf8'), before);
});

test('an HTTP error names the status in the warning', async () => {
  const before = await readFile(TAGS_FILE, 'utf8');
  await withStatus(403, async (port) => {
    const url = `http://127.0.0.1:${port}/releases`;
    const cap = captureWarnings();
    let tags;
    try {
      tags = await sync.syncReleaseTags({ source: url });
    } finally {
      cap.restore();
    }
    assert.deepEqual(tags, JSON.parse(before).tags);
    assert.deepEqual(cap.lines, [`[sync-changelog] ${url} failed (HTTP 403); using committed snapshot`]);
  });
  assert.equal(await readFile(TAGS_FILE, 'utf8'), before);
});

test('a request timeout is reported as "timeout", not the DOMException code', async () => {
  const before = await readFile(TAGS_FILE, 'utf8');
  await withServer(() => {}, async (port) => {
    const url = `http://127.0.0.1:${port}/releases`;
    const cap = captureWarnings();
    let tags;
    try {
      tags = await sync.syncReleaseTags({ source: url, timeoutMs: 50 });
    } finally {
      cap.restore();
    }
    assert.deepEqual(tags, JSON.parse(before).tags);
    assert.deepEqual(cap.lines, [`[sync-changelog] ${url} failed (timeout); using committed snapshot`]);
  });
  await withServer(() => {}, async (port) => {
    const url = `http://127.0.0.1:${port}/CHANGELOG.md`;
    const cap = captureWarnings();
    try {
      await sync.syncChangelog({ source: url, timeoutMs: 50 });
    } finally {
      cap.restore();
    }
    assert.deepEqual(cap.lines, [`[sync-changelog] ${url} failed (timeout); using committed snapshot`]);
  });
  assert.equal(await readFile(TAGS_FILE, 'utf8'), before);
});

test('an empty release list counts as a failed fetch and keeps the committed tags', async () => {
  // Work on a copy: a regression here would otherwise overwrite the real snapshot.
  const dir = await mkdtemp(join(tmpdir(), 'sync-empty-'));
  const dest = join(dir, 'release-tags.json');
  const before = await readFile(TAGS_FILE, 'utf8');
  await writeFile(dest, before);
  try {
    await withServer(
      (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end('[]');
      },
      async (port) => {
        const url = `http://127.0.0.1:${port}/releases`;
        const cap = captureWarnings();
        let tags;
        try {
          tags = await sync.syncReleaseTags({ source: url, dest });
        } finally {
          cap.restore();
        }
        assert.deepEqual(cap.lines, [`[sync-changelog] ${url} failed (empty release list); using committed snapshot`]);
        assert.deepEqual(tags, JSON.parse(before).tags, 'an empty list must not replace the snapshot');
      },
    );
    assert.equal(await readFile(dest, 'utf8'), before, 'the snapshot file is untouched');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('running the script through a symlink still runs the sync', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sync-link-'));
  try {
    const link = join(dir, 'sync.mjs');
    await symlink(fileURLToPath(new URL('../sync-changelog.mjs', import.meta.url)), link);
    const { stderr } = await run(process.execPath, [link], {
      env: { ...process.env, HAL0_RELEASES_URL: process.env.HAL0_RELEASES_URL, HAL0_CHANGELOG_URL: process.env.HAL0_CHANGELOG_URL },
    });
    assert.match(stderr, /using committed snapshot/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
