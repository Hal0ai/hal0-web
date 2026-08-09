// scripts/test/docs-sections.test.mjs
//
// Guards the docs landing page's "Sections" card counts (SECTIONS in
// src/content/docs/docs/getting-started/index.mdx) against silent drift.
// Those counts are literals, not build-time-derived — see that file's
// header comment for why (MDX's compiled component script splits
// `export const`-visible bindings from same-file `getCollection()`
// results into separate chunks, so a `.filter().length` helper 500s at
// build with "not defined"; an inline `await` IIFE inside the `export
// const` initializer fails to parse at all). This test is the guardrail
// in place of build-time derivation: it recounts each group directory
// from the filesystem and fails if a literal count in SECTIONS goes
// stale — no Astro/content-loader runtime needed, so it runs under plain
// `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const INDEX_MDX = fileURLToPath(
  new URL('../../src/content/docs/docs/getting-started/index.mdx', import.meta.url),
);
const DOCS_ROOT = fileURLToPath(new URL('../../src/content/docs/docs/', import.meta.url));

async function countMdxFiles(dir) {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += await countMdxFiles(full);
    else if (entry.name.endsWith('.mdx')) count += 1;
  }
  return count;
}

// SECTIONS is a plain array literal (see the file), so a tiny regex over
// the `title: '...'` / `count: N` pairs is enough — no need to execute
// the MDX component to read its own data.
function parseSectionsFromSource(source) {
  const block = source.match(/export const SECTIONS = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'index.mdx has an `export const SECTIONS = [...]` block');
  const entries = [];
  const entryRe = /title:\s*'([^']+)'[\s\S]*?count:\s*(\d+)/g;
  let m;
  while ((m = entryRe.exec(block[1]))) {
    entries.push({ title: m[1], count: Number(m[2]) });
  }
  return entries;
}

// title → group directory under src/content/docs/docs/. 'reference'
// recurses into its 'api/' subgroup automatically (countMdxFiles walks
// subdirectories), matching the sidebar's own nesting.
const GROUP_DIR = {
  'getting started': 'getting-started',
  concepts: 'concepts',
  guides: 'guides',
  operate: 'operate',
  reference: 'reference',
};

test('docs landing Sections card counts match the real content tree', async () => {
  const sections = parseSectionsFromSource(await readFile(INDEX_MDX, 'utf8'));
  assert.equal(sections.length, Object.keys(GROUP_DIR).length, 'SECTIONS has one entry per known group');
  for (const { title, count } of sections) {
    const dir = GROUP_DIR[title];
    assert.ok(dir, `SECTIONS entry '${title}' has a known group directory mapping`);
    const actual = await countMdxFiles(path.join(DOCS_ROOT, dir));
    assert.equal(
      count,
      actual,
      `SECTIONS['${title}'].count is ${count} but src/content/docs/docs/${dir}/ actually has ${actual} .mdx files — update the literal in index.mdx`,
    );
  }
});
