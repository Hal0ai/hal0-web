// scripts/test/kb.test.mjs
//
// The KB moved to forum.hal0.dev as wiki topics (2026-08-28), the same way
// the 44 product docs did before it. hal0.dev keeps no KB content: what is
// left is a manifest (src/data/kb-categories.ts) that renders the hub's
// cards, and a redirect map (src/data/kb-redirects.json) that carries the
// old article URLs to the topics that replaced them.
//
// This file used to guard KB_CATEGORIES against src/content/docs/kb/**.
// There is nothing local left to guard, so it now guards the two things
// that can actually rot: a card pointing nowhere, and an old URL that
// stops resolving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { KB_CATEGORIES } from '../../src/data/kb-categories.ts';

const KB_CONTENT_ROOT = fileURLToPath(new URL('../../src/content/docs/kb/', import.meta.url));
const redirects = JSON.parse(
  readFileSync(new URL('../../src/data/kb-redirects.json', import.meta.url), 'utf8'),
);
const redirectEntries = Object.entries(redirects).filter(([key]) => key.startsWith('/kb/'));
const categoriesBySlug = new Map(KB_CATEGORIES.map((c) => [c.slug, c]));

test('KB_CATEGORIES has a non-empty, slug-unique category list', () => {
  assert.ok(KB_CATEGORIES.length > 0);
  assert.equal(categoriesBySlug.size, KB_CATEGORIES.length, 'category slugs are unique');
});

test('no KB content is left on hal0.dev', () => {
  // The whole point of the move. A stray kb/**/*.mdx would render a page
  // that the redirect map also claims to send to the forum.
  assert.ok(!existsSync(KB_CONTENT_ROOT), 'src/content/docs/kb/ must not exist');
});

test('every category points at its forum category', () => {
  for (const c of KB_CATEGORIES) {
    assert.match(
      c.forumUrl,
      /^https:\/\/forum\.hal0\.dev\/c\/kb\/[a-z-]+\/\d+$/,
      `${c.slug} forumUrl is a forum KB category URL`,
    );
  }
});

test('every written page links to a forum topic, and planned ones link nowhere', () => {
  for (const c of KB_CATEGORIES) {
    for (const page of c.pages) {
      if (page.href === undefined) continue; // "planned", rendered as plain text
      assert.match(
        page.href,
        /^https:\/\/forum\.hal0\.dev\/t\/[a-z0-9-]+\/\d+$/,
        `${c.slug}: ${page.title} links to a forum topic`,
      );
    }
  }
});

test('the redirect map covers every written page, and only forum topics', () => {
  const linked = KB_CATEGORIES.flatMap((c) => c.pages.map((p) => p.href).filter(Boolean)).sort();
  const targets = redirectEntries.map(([, url]) => url).sort();
  assert.deepEqual(targets, linked, 'each old KB URL redirects to a page the hub still links');

  for (const [from, to] of redirectEntries) {
    assert.match(from, /^\/kb\/[a-z0-9-]+\/[a-z0-9-]+$/, `${from} is an old KB article path`);
    assert.ok(!from.endsWith('/'), `${from} is stored without a trailing slash (the patch adds /?$)`);
    assert.match(to, /^https:\/\/forum\.hal0\.dev\/t\//, `${from} points at a forum topic`);
  }
});

test('every redirect source names a real category directory', () => {
  for (const [from] of redirectEntries) {
    const slug = from.split('/')[2];
    assert.ok(categoriesBySlug.has(slug), `${from} belongs to a known KB category (${slug})`);
  }
});
