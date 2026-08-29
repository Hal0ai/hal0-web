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

test('the header is the same five entries, in order, with nothing hidden', () => {
  // The unified chrome: hal0.dev and forum.hal0.dev carry this exact list.
  // `forum` used to be hidden here (the site linked it only from the footer);
  // it is a first-class header entry now, and the Discourse theme drops it
  // from its own copy because that host IS the forum.
  assert.deepEqual(
    nav.header.map((l) => l.label),
    ['home', 'docs', 'benchmarks', 'profiles', 'forum'],
  );
  for (const link of nav.header) {
    assert.ok(!link.hidden, `${link.label} must not be hidden`);
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
  // `home`, `docs` and `forum` carry no match by design: "/" as a prefix
  // would light on every route, and docs and forum both point at
  // forum.hal0.dev now, so no hal0.dev route can light them. They rely on
  // the exact-href test in nav.ts's isActive instead.
  const withMatch = nav.header.filter((l) => l.match !== undefined).map((l) => l.label).sort();
  assert.deepEqual(withMatch, ['benchmarks', 'profiles']);
});

// nav.ts is TypeScript and can't be imported under node --test, so this
// replicates the matcher contract from src/lib/nav.ts's isActive/subFor
// against the real nav.json data.
const matches = (path, prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
const isExactMatchJs = (path, href) => {
  const norm = (v) => (v.length > 1 && v.endsWith('/') ? v.slice(0, -1) : v);
  return norm(path) === norm(href);
};
const isActiveJs = (path, link) => {
  if (!link.match) return isExactMatchJs(path, link.href);
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

test('isActive: benchmarks is its own section', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  assert.ok(isActiveJs('/benchmarks/', bench));
  assert.ok(!isActiveJs('/profiles', bench), 'profiles route must not light benchmarks');
});

test('isActive: home lights only on the landing page', () => {
  const home = nav.header.find((l) => l.label === 'home');
  assert.ok(isActiveJs('/', home));
  for (const path of ['/docs/', '/benchmarks/', '/profiles', '/blog/some-post/']) {
    assert.ok(!isActiveJs(path, home), `home must not light on ${path}`);
  }
});

test('docs and the knowledge base both live on the forum', () => {
  // Neither has a `match`: the docs hub and the KB articles are gone from
  // hal0.dev (both are forum categories), so there is no local route left
  // for either entry to light on.
  const docs = nav.header.find((l) => l.label === 'docs');
  assert.equal(docs.match, undefined);
  assert.match(docs.href, /^https:\/\/forum\.hal0\.dev\/c\/docs\//);
  assert.equal(docs.external, true);

  const kb = nav.footerColumns
    .flatMap((c) => c.links)
    .find((l) => l.label === 'knowledge base');
  assert.match(kb.href, /^https:\/\/forum\.hal0\.dev\/c\/kb\//);
});

test('isActive: profiles is its own section', () => {
  const profiles = nav.header.find((l) => l.label === 'profiles');
  assert.ok(isActiveJs('/profiles', profiles));
  assert.ok(!isActiveJs('/benchmarks/', profiles), 'benchmarks route must not light profiles');
});

test('subFor: /blog resolves to null (blog left the header)', () => {
  assert.equal(subForJs('/blog/some-post/'), null);
});

test('subFor: /benchmarks/ resolves to benchmarks\' sub list', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  assert.deepEqual(subForJs('/benchmarks/'), bench.sub);
});

test('subFor: /profiles resolves to null (profiles has no sub-nav)', () => {
  const profiles = nav.header.find((l) => l.label === 'profiles');
  assert.equal(profiles.sub, undefined, 'profiles must not duplicate the benchmarks sub-nav');
  assert.equal(subForJs('/profiles'), null);
});

test('subFor: unrelated path resolves to null', () => {
  assert.equal(subForJs('/contributing'), null);
});

test('benchmarks sub-nav has the expected entries', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  const labels = bench.sub.map((l) => l.label);
  // `profiles` left this sub-nav when it became a top-level header entry on
  // both hosts -- it was the only link here that duplicated the main nav.
  assert.deepEqual(labels, ['leaderboard', 'evals', 'methodology']);
  assert.equal(bench.sub.find((l) => l.label === 'leaderboard').href, '/benchmarks/');
  assert.equal(bench.sub.find((l) => l.label === 'evals').href, '/benchmarks/#evals');
  // methodology is a forum topic now, like the rest of the docs
  assert.match(
    bench.sub.find((l) => l.label === 'methodology').href,
    /^https:\/\/forum\.hal0\.dev\/t\//,
  );
});

test('forum is a visible, external header entry', () => {
  const forum = nav.header.find((l) => l.label === 'forum');
  assert.ok(!forum.hidden, 'forum is no longer hidden');
  assert.equal(forum.external, true, 'forum is marked external so the header renders its ↗');
  assert.equal(forum.href, 'https://forum.hal0.dev');
});

test('benchmarks sub-nav entries have correct match fields', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  const leaderboard = bench.sub.find((l) => l.label === 'leaderboard');
  const evals = bench.sub.find((l) => l.label === 'evals');
  const methodology = bench.sub.find((l) => l.label === 'methodology');

  assert.equal(leaderboard.match, '/benchmarks', 'leaderboard sub-entry has match field');
  assert.equal(evals.match, undefined, 'evals sub-entry does not have match field');
  assert.equal(methodology.match, undefined, 'methodology sub-entry does not have match field');
});

test('isActive on sub-nav entries: leaderboard', () => {
  const bench = nav.header.find((l) => l.label === 'benchmarks');
  const leaderboard = bench.sub.find((l) => l.label === 'leaderboard');
  const topLevelProfiles = nav.header.find((l) => l.label === 'profiles');

  assert.ok(isActiveJs('/benchmarks/', leaderboard), 'leaderboard is active on /benchmarks/');
  // profiles is a header entry now, not a benchmarks sub-entry, and must not
  // light while the reader is on the leaderboard.
  assert.ok(!isActiveJs('/benchmarks/', topLevelProfiles), 'profiles must not light on /benchmarks/');
  assert.ok(isActiveJs('/profiles', topLevelProfiles), 'profiles is active on /profiles');
});
