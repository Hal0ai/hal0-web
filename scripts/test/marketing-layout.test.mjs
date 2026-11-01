import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const layout = await readFile(
  new URL('../../src/layouts/MarketingLayout.astro', import.meta.url),
  'utf8',
);

test('MarketingLayout Props interface declares an optional jsonLd array', () => {
  assert.ok(layout.includes('jsonLd?:'), 'Props has `jsonLd?:`');
});

test('MarketingLayout builds a single schema.org @graph', () => {
  assert.ok(layout.includes("'@graph'"), "frontmatter builds an '@graph' key");
  assert.ok(layout.includes("'@context'"), "frontmatter sets '@context'");
  assert.ok(layout.includes('https://schema.org'), 'context points at schema.org');
});

test('MarketingLayout renders exactly one ld+json script', () => {
  const matches = layout.match(/type="application\/ld\+json"/g) ?? [];
  assert.equal(matches.length, 1, 'exactly one <script type="application/ld+json">');
});

test('the ld+json script is gated on a non-empty jsonLd', () => {
  assert.match(layout, /jsonLd\.length\s*>\s*0/, 'rendered only when jsonLd.length > 0');
});
