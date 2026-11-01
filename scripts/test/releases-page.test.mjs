// scripts/test/releases-page.test.mjs
//
// /releases is the canonical release-notes route; /changelog redirects to it.
// Build-dependent: skips with a visible message when the page is absent
// (CI always builds first). Astro emits static output under dist/client/
// once an adapter is set — see chrome-consistency.test.mjs's note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { parseChangelog, releaseTagUrl, splitReleases } from '../../src/lib/changelog.js';

const PAGE = new URL('../../dist/client/releases/index.html', import.meta.url);
const OLD_PAGE = new URL('../../dist/client/changelog/index.html', import.meta.url);

const built = await access(PAGE).then(() => true, () => false);
const skip = !built && 'run npm run build first (produces dist/client/releases/index.html)';

const raw = await readFile(new URL('../../src/data/changelog.md', import.meta.url), 'utf8');
const tags = JSON.parse(
  await readFile(new URL('../../src/data/release-tags.json', import.meta.url), 'utf8'),
).tags;
const parsed = parseChangelog(raw, { tags });
const RECENT = 8;

test('the built releases page exists', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.match(html, /<h1[^>]*>/, 'page has an h1');
});

test('/changelog is no longer a page of its own', { skip }, async () => {
  const html = await readFile(OLD_PAGE, 'utf8').catch(() => null);
  if (html === null) return; // adapter emits no file for a redirect: fine
  assert.match(html, /http-equiv="refresh"/, 'a file at /changelog must be a redirect stub');
  assert.ok(html.length < 5_000, 'redirect stub, not a rendered changelog');
});

test('the first eight tagged entries are anchored on the page', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const firstEight = parsed.versions.filter((v) => !v.untagged).slice(0, RECENT);
  assert.equal(firstEight.length, Math.min(RECENT, parsed.versions.filter((v) => !v.untagged).length));
  for (const v of firstEight) {
    assert.ok(html.includes(`id="${v.slug}"`), `missing anchor id="${v.slug}" for ${v.version}`);
  }
});

test('the releases page stays small now that old entries are links', { skip }, async () => {
  const { size } = await stat(PAGE);
  assert.ok(size < 350_000, `built /releases HTML is ${size} bytes, expected < 350000`);
});

// ── page structure ─────────────────────────────────────────────────────────

const B7_TITLE = 'hal0 Changelog: Release Notes for the Local AI Server';
const B7_DESCRIPTION =
  'Every hal0 release, newest first: new features, fixes and breaking changes for the self-hosted AI inference server, with install and upgrade commands.';

const tagged = parsed.versions.filter((v) => !v.untagged);
// Untagged entries ahead of the newest tagged one stay visible in the recent
// list (with their "unreleased" badge) on top of the eight tagged entries.
const leadingUntagged = parsed.versions.findIndex((v) => !v.untagged);
const expectedRecent = Math.max(leadingUntagged, 0) + Math.min(RECENT, tagged.length);
const archiveVersions = splitReleases(parsed.versions, RECENT).archive;

const attr = (s) => s.replace(/&/g, '&amp;');
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('title and meta description are the B7 text', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], B7_TITLE);
  assert.equal(html.match(/<meta name="description" content="([^"]*)"/)?.[1], B7_DESCRIPTION);
});

test('one latest-release card names the latest tagged stable version', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const marks = html.match(/data-latest-release/g) ?? [];
  assert.equal(marks.length, 1, 'exactly one data-latest-release element');
  const start = html.indexOf('data-latest-release');
  const card = html.slice(start, html.indexOf('</article>', start));
  assert.ok(textOf(card).includes(parsed.latestTagged.version), 'card shows latestTagged.version');
  assert.ok(card.includes('latest stable'), 'card carries the "latest stable" chip');
  assert.ok(card.includes(`href="${releaseTagUrl(parsed.latestTagged.version)}"`), 'card links the GitHub release');
  assert.ok(card.includes('curl -fsSL https://hal0.dev/install.sh | sudo bash'), 'card has the install one-liner');
  assert.ok(card.includes('sudo hal0 update'), 'card has the upgrade command');
  // The callout is for a section titled Breaking; "Supported upgrades" and
  // "Upgrade notes" classify as breaking-kind but are not breaking changes.
  const hasBreaking = parsed.latestTagged.sections.some(
    (s) => /^breaking/i.test(s.title.trim()) && /<li[\s>]/.test(s.html),
  );
  assert.equal(/class="rel-brk\b/.test(card), hasBreaking, 'Breaking block iff the entry has a breaking section');
});

test('the channel line names stable, preview and nightly', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const line = html.match(/<div class="rel-channels"[\s\S]*?<\/div>/)?.[0] ?? '';
  const text = textOf(line);
  for (const word of ['stable', 'preview', 'nightly']) assert.ok(text.includes(word), `channel line mentions ${word}`);
});

test('exactly min(8, tagged) entries render as collapsible <details>', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const entries = html.match(/<details class="rel-entry\b[^"]*"/g) ?? [];
  assert.equal(entries.length, expectedRecent);
  const open = new RegExp(`<details class="rel-entry\\b[^"]*" id="${tagged[0].slug.replace(/\./g, '\\.')}" open`);
  assert.match(html, open, 'newest tagged entry opens by default');
});

test('each entry leads with Highlights when the changelog has them', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const entries = html.split(/<details class="rel-entry\b[^"]*"/).slice(1);
  // The newest entry's Highlights sit in the latest card above it, so check the rest.
  let checked = 0;
  for (const chunk of entries.slice(1)) {
    const slug = chunk.match(/id="([^"]+)"/)?.[1];
    const v = parsed.versions.find((x) => x.slug === slug);
    const hasHighlights = v.sections.some((s) => s.title.trim().toLowerCase() === 'highlights');
    if (!hasHighlights) continue;
    const body = chunk.slice(0, chunk.indexOf('</details>'));
    const firstHeading = body.match(/<h4[^>]*>([^<]*)<\/h4>/)?.[1].trim().toLowerCase();
    assert.equal(firstHeading, 'highlights', `${v.version} opens with Highlights`);
    checked += 1;
  }
  assert.ok(checked > 0, 'at least one older entry with Highlights was checked');
});

test('the archive lists every remaining version with a GitHub link', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.equal((html.match(/id="archive"/g) ?? []).length, 1, 'one #archive section');
  const start = html.indexOf('id="archive"');
  const section = html.slice(start, html.indexOf('</section>', start));
  const links = [...section.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  assert.equal(links.length, archiveVersions.length, 'one link per archived version');
  for (const v of archiveVersions) {
    // Untagged history has no tag page; it falls back to the releases index
    // (same convention the page always had) rather than a 404.
    const href = v.untagged ? 'https://github.com/hal0ai/hal0/releases' : releaseTagUrl(v.version);
    assert.ok(links.includes(attr(href)), `archive links ${v.version} to ${href}`);
    assert.ok(section.includes(`>${v.version}<`), `archive shows ${v.version}`);
  }
  // Nothing from the archive is also rendered inline.
  for (const v of archiveVersions) {
    assert.ok(!html.includes(`id="${v.slug}" open`) && !new RegExp(`<details[^>]* id="${v.slug.replace(/\./g, '\\.')}"`).test(html), `${v.version} is not inline`);
  }
});

test('only untagged entries carry the unreleased badge in their summary', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const entries = html.split(/<details class="rel-entry\b[^"]*"/).slice(1);
  assert.equal(entries.length, expectedRecent);
  let untaggedSeen = 0;
  for (const chunk of entries) {
    const slug = chunk.match(/id="([^"]+)"/)?.[1];
    const v = parsed.versions.find((x) => x.slug === slug);
    const summary = chunk.slice(chunk.indexOf('<summary'), chunk.indexOf('</summary>'));
    assert.equal(summary.includes('>unreleased<'), v.untagged, `${v.version}: unreleased badge iff untagged`);
    if (v.untagged) untaggedSeen += 1;
  }
  assert.equal(untaggedSeen, Math.max(leadingUntagged, 0), 'every leading untagged entry was checked');
});

test('BreadcrumbList structured data lists Home then the page', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  // MarketingLayout emits one @graph script in <head> from the jsonLd prop;
  // the page must not carry a second, hand-written one.
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'exactly one ld+json script');
  assert.ok(html.indexOf(scripts[0][0]) < html.indexOf('</head>'), 'it lives in <head>');
  const graph = JSON.parse(scripts[0][1]); // the layout writes "<" as \u003c; JSON.parse decodes it
  const nodes = Array.isArray(graph['@graph']) ? graph['@graph'] : [graph];
  const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
  assert.ok(crumbs, 'a BreadcrumbList node exists');
  const items = crumbs.itemListElement;
  assert.deepEqual(items.map((i) => i.position), [1, 2]);
  assert.equal(items[0].item, 'https://hal0.dev/');
  assert.equal(items[1].item, 'https://hal0.dev/releases/');
});

test('the page style block has no min-width above phone width', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  // Astro may emit the page's CSS as a linked stylesheet instead of inline.
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    const file = await readFile(new URL(`../../dist/client${m[1]}`, import.meta.url), 'utf8').catch(() => '');
    if (file.includes('.rel-entry')) css += `\n${file}`;
  }
  assert.ok(css.includes('.rel-entry'), 'found the releases page CSS');
  // `(min-width: Npx)` media queries are breakpoints, not element widths.
  const bad = [...css.matchAll(/(?<!\()\bmin-width:\s*(\d+(?:\.\d+)?)px/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 360);
  assert.deepEqual(bad, [], 'no element min-width wider than a 360px phone');
});

test('the retired changelog rail and Get hal0 block are gone', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.ok(!html.includes('data-cl-side'), 'no sticky release rail');
  assert.ok(!html.includes('cl-get'), 'no old Get hal0 block');
});

// ── never-cut sections, headings, a11y, scripts ────────────────────────────

// Top-level <li> count of a rendered list (nested lists do not add items).
function topLevelCount(html) {
  let depth = 0;
  let n = 0;
  for (const m of html.matchAll(/<(\/?)li[\s>]/g)) {
    if (m[1] === '') {
      if (depth === 0) n += 1;
      depth += 1;
    } else depth = Math.max(0, depth - 1);
  }
  return n;
}

test('Highlights, Breaking, Migrations and Security render whole in every entry', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const entries = html.split(/<details class="rel-entry\b[^"]*"/).slice(1);
  let checked = 0;
  for (const chunk of entries) {
    const slug = chunk.match(/id="([^"]+)"/)?.[1];
    const v = parsed.versions.find((x) => x.slug === slug);
    const body = chunk.slice(0, chunk.indexOf('</details>'));
    for (const section of v.sections) {
      const title = section.title.trim().toLowerCase();
      if (!['highlights', 'breaking', 'migrations', 'security'].includes(title)) continue;
      const expected = topLevelCount(section.html);
      if (expected === 0) continue;
      const at = body.search(new RegExp(`<h4[^>]*>${section.title.trim()}</h4>`));
      if (at === -1) continue; // the newest entry's Highlights live in the card above
      const list = body.slice(at, body.indexOf('</ul>', at));
      assert.ok(!list.includes('rel-more'), `${v.version} ${section.title} has no "+N more" cut`);
      assert.equal(topLevelCount(list), expected, `${v.version} ${section.title} shows all ${expected} bullets`);
      checked += 1;
    }
  }
  assert.ok(checked >= 3, `checked several never-cut sections, got ${checked}`);
});

test('the heading outline is h1, then h2 sections, then an h3 per entry', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const levels = [...main.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  assert.equal(levels.filter((n) => n === 1).length, 1, 'one h1');
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] - levels[i - 1] <= 1, `heading levels never skip: ${levels.slice(0, i + 1).join('>')}`);
  }
  const entries = main.split(/<details class="rel-entry\b[^"]*"/).slice(1);
  for (const chunk of entries) {
    const slug = chunk.match(/id="([^"]+)"/)?.[1];
    const v = parsed.versions.find((x) => x.slug === slug);
    const summary = chunk.slice(chunk.indexOf('<summary'), chunk.indexOf('</summary>'));
    assert.match(summary, new RegExp(`<h3[^>]*>[^<]*${v.version.replace(/\./g, '\\.')}[^<]*</h3>`), `${v.version}: summary carries an h3 with the version`);
  }
});

test('borderless lists keep list semantics and the plain channel div has no stray label', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  assert.match(html, /<ul class="rel-hl" role="list"/);
  assert.match(html, /<ul class="rel-archive" role="list"/);
  assert.doesNotMatch(html, /<div class="rel-channels"[^>]*aria-label/, 'aria-label on a role-less div is ignored');
});

test('the entry summary keeps a visible focus ring inside the clipped card', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    const file = await readFile(new URL(`../../dist/client${m[1]}`, import.meta.url), 'utf8').catch(() => '');
    if (file.includes('.rel-entry')) css += `\n${file}`;
  }
  assert.match(css, /\.rel-entry summary:focus-visible\s*\{[^}]*outline-offset:\s*-3px/);
});

test('a malformed URL fragment does not throw in the page script', { skip }, async () => {
  const html = await readFile(PAGE, 'utf8');
  const source = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .find((code) => code.includes('data-copy'));
  assert.ok(source, 'found the page script');
  const noop = () => {};
  const context = {
    document: { querySelectorAll: () => [], getElementById: () => null, querySelector: () => null },
    window: { addEventListener: noop },
    location: { hash: '#%E0%A4%A', replace: noop },
    HTMLDetailsElement: class {},
    CSS: { escape: (x) => x },
    setTimeout: noop,
    navigator: {},
  };
  vm.runInNewContext(source, context);
});
