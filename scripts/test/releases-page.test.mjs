// scripts/test/releases-page.test.mjs
//
// /releases is the canonical release-notes route; /changelog redirects to it.
// Build-dependent: skips with a visible message when the page is absent
// (CI always builds first). Astro emits static output under dist/client/
// once an adapter is set — see chrome-consistency.test.mjs's note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import { parseChangelog } from '../../src/lib/changelog.js';

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
  assert.ok(size < 250_000, `built /releases HTML is ${size} bytes, expected < 250000`);
});
