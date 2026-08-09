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
