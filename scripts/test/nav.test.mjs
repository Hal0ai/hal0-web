import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

// Flatten every link object that appears anywhere in the manifest (header
// entries, their `sub` lists, footer column links, social) for schema
// checks that apply uniformly.
function allLinks() {
  const out = [];
  for (const link of nav.header) {
    out.push(link);
    for (const sub of link.sub ?? []) out.push(sub);
  }
  for (const col of nav.footerColumns) {
    for (const link of col.links) out.push(link);
  }
  for (const link of nav.social) out.push(link);
  return out;
}

test('nav.json has header/footerColumns/social', () => {
  assert.ok(Array.isArray(nav.header) && nav.header.length > 0, 'header is a non-empty array');
  assert.ok(Array.isArray(nav.footerColumns) && nav.footerColumns.length > 0, 'footerColumns is a non-empty array');
  assert.ok(Array.isArray(nav.social) && nav.social.length > 0, 'social is a non-empty array');
});

test('footerColumns entries carry heading + links array', () => {
  for (const col of nav.footerColumns) {
    assert.equal(typeof col.heading, 'string');
    assert.ok(Array.isArray(col.links) && col.links.length > 0, `${col.heading} has links`);
  }
});

test('every link has label and href', () => {
  for (const link of allLinks()) {
    assert.equal(typeof link.label, 'string');
    assert.match(link.href, /^(\/|https:\/\/|mailto:)/, `${link.label} href is rooted, absolute, or mailto`);
  }
});

test('labels are lowercase everywhere, including sub and footer column links', () => {
  for (const link of allLinks()) {
    assert.equal(link.label, link.label.toLowerCase(), `${link.label} must be lowercase`);
  }
  for (const col of nav.footerColumns) {
    assert.equal(col.heading, col.heading.toLowerCase(), `${col.heading} heading must be lowercase`);
  }
});

test('hidden entries still carry hrefs', () => {
  const hidden = nav.header.filter((l) => l.hidden);
  assert.ok(hidden.length > 0, 'at least one hidden header entry exists (profiles/forum)');
  for (const link of hidden) {
    assert.match(link.href, /^(\/|https:\/\/|mailto:)/, `${link.label} (hidden) still has a real href`);
  }
});

test('social entries carry known ids', () => {
  const ids = nav.social.map((s) => s.id).sort();
  assert.deepEqual(ids, ['discord', 'github']);
});

test('community footer column github/discord hrefs match the social entries (guards JSON duplication)', () => {
  const community = nav.footerColumns.find((c) => c.heading === 'community');
  assert.ok(community, 'a "community" footer column exists');
  for (const id of ['github', 'discord']) {
    const social = nav.social.find((s) => s.id === id);
    const footer = community.links.find((l) => l.label === id);
    assert.ok(social, `social entry '${id}' exists`);
    assert.ok(footer, `community footer link '${id}' exists`);
    assert.equal(footer.href, social.href, `community footer '${id}' href must match social '${id}' href`);
  }
});

test('header links that carry match use string or array form (forum has none by design)', () => {
  for (const link of nav.header) {
    if (link.match === undefined) continue;
    assert.ok(
      typeof link.match === 'string' || Array.isArray(link.match),
      `${link.label} match must be a string or array`,
    );
  }
  const withMatch = nav.header.filter((l) => l.match !== undefined).map((l) => l.label).sort();
  assert.deepEqual(withMatch, ['benchmarks', 'learn', 'profiles']);
});

// nav.ts is TypeScript and can't be imported under node --test, so this
// replicates the matcher contract from src/lib/nav.ts's isActive/subFor
// against the real nav.json data.
const matches = (path, prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
const isActiveJs = (path, link) => {
  if (!link.match) return false;
  const prefixes = Array.isArray(link.match) ? link.match : [link.match];
  return prefixes.some((p) => matches(path, p)) && !(link.exclude ?? []).some((e) => matches(path, e));
};
const visibleHeaderJs = nav.header.filter((l) => !l.hidden);
const subForJs = (path) => {
  for (const link of visibleHeaderJs) {
    if (link.sub && isActiveJs(path, link)) return link.sub;
  }
  return null;
};

test('isActive: learn/benchmarks mutual exclusion', () => {
  const learn = nav.header.find((l) => l.label === 'learn');
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  assert.ok(isActiveJs('/docs/getting-started/', learn));
  // The old docs bench page (src/content/docs/docs/reference/model-roster-benchmark.mdx)
  // stays put and is a plain docs page again now that /benchmarks owns the
  // "benchmarks" nav entry — it lights "learn" like any other /docs/* page.
  assert.ok(isActiveJs('/docs/reference/model-roster-benchmark/', learn), 'the retained docs bench page is still a docs page');
  assert.ok(isActiveJs('/benchmarks', bench));
  assert.ok(!isActiveJs('/docs/getting-started/', bench), 'docs page must not light benchmarks');
  assert.ok(!isActiveJs('/docs/reference/model-roster-benchmark/', bench), 'the retained docs bench page must not light the new benchmarks nav entry');
});

test('isActive: learn covers array-match sections (blog/changelog/releases)', () => {
  const learn = nav.header.find((l) => l.label === 'learn');
  assert.ok(isActiveJs('/blog/some-post/', learn), 'learn is active on /blog/x');
  assert.ok(isActiveJs('/changelog', learn), 'learn is active on /changelog');
  assert.ok(isActiveJs('/releases', learn), 'learn is active on /releases');
});

test('subFor: /blog resolves to learn\'s sub list', () => {
  const learn = nav.header.find((l) => l.label === 'learn');
  assert.deepEqual(subForJs('/blog/some-post/'), learn.sub);
});

test('subFor: the retained docs bench page resolves to learn\'s sub list, like any other docs page', () => {
  const learn = nav.header.find((l) => l.label === 'learn');
  assert.deepEqual(subForJs('/docs/reference/model-roster-benchmark/'), learn.sub);
});

test('subFor: /benchmarks resolves to the benchmarks sub list (leaderboard/evals/methodology/profiles)', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  assert.deepEqual(subForJs('/benchmarks'), bench.sub);
  assert.deepEqual(
    bench.sub.map((l) => l.label),
    ['leaderboard', 'evals', 'methodology', 'profiles'],
  );
});

test('subFor: unrelated path resolves to null', () => {
  assert.equal(subForJs('/contributing'), null);
});
