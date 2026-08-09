// scripts/test/kb.test.mjs
//
// Guards the KB_CATEGORIES ↔ src/content/docs/kb/**/*.mdx mapping: every
// KB content file must belong to a known category (by directory slug) and
// its `kbCategory` frontmatter must equal that category's display label —
// see src/data/kb-categories.ts's header comment for why this is the
// single source of truth. Parses frontmatter directly (no Astro/content
// loader needed) so this runs under plain `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { KB_CATEGORIES } from '../../src/data/kb-categories.ts';

const KB_ROOT = fileURLToPath(new URL('../../src/content/docs/kb/', import.meta.url));

// Frontmatter here is always flat scalar `key: value` pairs (see the six
// seed pages) — no nested objects or multiline block scalars like the
// blog's `excerpt: >-` — so a tiny line parser is enough and keeps this
// test dependency-free rather than reaching for a YAML parser.
function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'file has a --- frontmatter block');
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    assert.ok(kv, `frontmatter line is flat 'key: value': ${JSON.stringify(line)}`);
    const [, key, rawValue] = kv;
    const value = rawValue.trim().replace(/^"(.*)"$/, '$1');
    data[key] = value;
  }
  return data;
}

async function findMdxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findMdxFiles(full)));
    else if (entry.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

const categoriesBySlug = new Map(KB_CATEGORIES.map((c) => [c.slug, c]));

test('KB_CATEGORIES has a non-empty, slug-unique category list', () => {
  assert.ok(KB_CATEGORIES.length > 0);
  assert.equal(categoriesBySlug.size, KB_CATEGORIES.length, 'category slugs are unique');
});

test('every kb/**/*.mdx file lives under a directory matching a KB_CATEGORIES slug', async () => {
  const files = await findMdxFiles(KB_ROOT);
  assert.ok(files.length > 0, 'at least one kb content file exists');
  for (const file of files) {
    const slug = path.basename(path.dirname(file));
    assert.ok(
      categoriesBySlug.has(slug),
      `${path.relative(KB_ROOT, file)} sits under '${slug}/', which has no KB_CATEGORIES entry`,
    );
  }
});

test("every kb/**/*.mdx file's kbCategory frontmatter matches its category's label", async () => {
  const files = await findMdxFiles(KB_ROOT);
  for (const file of files) {
    const slug = path.basename(path.dirname(file));
    const category = categoriesBySlug.get(slug);
    assert.ok(category, `${file} has a known category`);
    const { kbCategory, reviewed, title } = parseFrontmatter(await readFile(file, 'utf8'));
    assert.equal(
      kbCategory,
      category.label,
      `${path.relative(KB_ROOT, file)}: frontmatter kbCategory '${kbCategory}' must equal KB_CATEGORIES['${slug}'].label '${category.label}'`,
    );
    assert.ok(reviewed, `${path.relative(KB_ROOT, file)} has a 'reviewed' stamp`);
    assert.match(reviewed, /^\d{4}-\d{2}-\d{2}$/, `${file}: reviewed is YYYY-MM-DD`);
    assert.ok(title, `${path.relative(KB_ROOT, file)} has a title`);
  }
});

test('every KB_CATEGORIES page with an href resolves to a real kb/**/*.mdx route', async () => {
  const files = await findMdxFiles(KB_ROOT);
  // Route → file, mirroring Starlight's slug convention: kb/<category>/<name>/
  const routes = new Set(
    files.map((f) => `/kb/${path.relative(KB_ROOT, f).replace(/\.mdx$/, '').replace(/\\/g, '/')}/`),
  );
  for (const category of KB_CATEGORIES) {
    for (const page of category.pages) {
      if (!page.href) continue;
      assert.ok(
        routes.has(page.href),
        `KB_CATEGORIES['${category.slug}'] page '${page.title}' links to ${page.href}, which has no matching kb/**/*.mdx file`,
      );
    }
  }
});
