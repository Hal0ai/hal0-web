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

test('the ld+json script is unconditional: the site nodes are always in the graph', () => {
  assert.ok(!/jsonLd\.length\s*>\s*0/.test(layout), 'no longer gated on the page passing nodes');
  assert.match(layout, /\[\s*\.\.\.siteGraph\(.*\)\s*,\s*\.\.\.jsonLd\s*\]/, 'siteGraph(...) is spread before the page nodes');
});
