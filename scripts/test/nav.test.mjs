import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

test('nav.json has header/footer/social arrays', () => {
  for (const key of ['header', 'footer', 'social']) {
    assert.ok(Array.isArray(nav[key]) && nav[key].length > 0, `${key} is a non-empty array`);
  }
});

test('every link has label and href', () => {
  for (const key of ['header', 'footer', 'social']) {
    for (const link of nav[key]) {
      assert.equal(typeof link.label, 'string');
      assert.match(link.href, /^(\/|https:\/\/|mailto:)/, `${link.label} href is rooted or absolute`);
    }
  }
});

test('labels are lowercase', () => {
  for (const key of ['header', 'footer', 'social']) {
    for (const link of nav[key]) {
      assert.equal(link.label, link.label.toLowerCase(), `${link.label} must be lowercase`);
    }
  }
});

test('social entries carry known ids', () => {
  const ids = nav.social.map((s) => s.id).sort();
  assert.deepEqual(ids, ['discord', 'github']);
});

test('header links carry match prefixes for active-state', () => {
  for (const link of nav.header) {
    assert.equal(typeof link.match, 'string', `${link.label} needs match`);
  }
});

test('isActive: docs/benchmarks mutual exclusion', async () => {
  // nav.ts is TypeScript and can't be imported under node --test, so this
  // replicates the matcher contract from src/lib/nav.ts's isActive against
  // the real nav.json data.
  const matches = (path, prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
  const isActiveJs = (path, link) => !!link.match && matches(path, link.match) && !(link.exclude ?? []).some((e) => matches(path, e));
  const docs = nav.header.find((l) => l.label === 'docs');
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  assert.ok(isActiveJs('/docs/getting-started/', docs));
  assert.ok(!isActiveJs('/docs/reference/model-roster-benchmark/', docs), 'bench page must not light docs');
  assert.ok(isActiveJs('/docs/reference/model-roster-benchmark/', bench));
  assert.ok(!isActiveJs('/blog/some-post/', docs));
});
