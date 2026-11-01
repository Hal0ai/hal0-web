// scripts/test/profile-pages.test.mjs
//
// /profiles/<slug>/ — one static page per community profile.
//
// Two halves:
//   1. Unit tests for the pure helper behind the page (src/lib/profile-page.mjs):
//      title/description trimming and JSON-LD, including a record that lacks
//      summary, author and history (the schema lets those be absent).
//   2. Build-dependent checks over dist/client/ — every slug in
//      src/data/profiles.json has a page with a trimmed title, a description,
//      a trailing-slash canonical, a sitemap entry and a parseable JSON-LD
//      graph; the gallery links each card to its page and keeps the drawer.
//      Same strategy as chrome-consistency.test.mjs: they skip with a visible
//      message when dist/ is absent (CI always builds first).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const profilesSnapshot = JSON.parse(
  await readFile(new URL('../../src/data/profiles.json', import.meta.url), 'utf8'),
);
const records = profilesSnapshot.profiles;
const slugs = records.map((r) => r.profile.slug);

const TITLE_SUFFIX = ' · llama.cpp profile | hal0';

// ── unit: src/lib/profile-page.mjs ─────────────────────────────────────

const helpers = () => import('../../src/lib/profile-page.mjs');

// A valid-by-schema-but-sparse record: no summary, no author, no history.
const sparse = {
  schema: 1,
  profile: { slug: 'bare-bones', title: 'Bare bones', intent: 'chat' },
  runner: { kind: 'llama-server', lane: 'rocm', min_build: 'b9219' },
  model: { id: 'qwen3-8b-q4' },
  args: { raw: '-ngl 99 -c 8192' },
};

const BAD_TOKENS = /undefined|null|NaN|\[object/;

test('profileDescription: record without summary, author and history yields a clean sentence', async () => {
  const { profileDescription } = await helpers();
  const text = profileDescription(sparse);
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 40, `generated sentence is substantive, got: ${text}`);
  assert.ok(text.length <= 155, `generated sentence fits 155 chars, got ${text.length}`);
  assert.doesNotMatch(text, BAD_TOKENS, 'no undefined/null leaks into the sentence');
  assert.match(text, /qwen3-8b-q4/, 'names the model');
  assert.match(text, /rocm/, 'names the lane');
});

test('profileDescription: survives a record with almost nothing in it', async () => {
  const { profileDescription } = await helpers();
  const text = profileDescription({ profile: { slug: 'x' } });
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 0);
  assert.doesNotMatch(text, BAD_TOKENS);
});

test('profileDescription: a short summary is used verbatim', async () => {
  const { profileDescription } = await helpers();
  const summary = 'q8 KV cache because tool traces are long.';
  assert.equal(profileDescription({ ...sparse, profile: { ...sparse.profile, summary } }), summary);
});

test('profileDescription: a long summary is trimmed to 155 chars on a word boundary', async () => {
  const { profileDescription } = await helpers();
  const summary = 'word '.repeat(60).trim();
  const text = profileDescription({ ...sparse, profile: { ...sparse.profile, summary } });
  assert.ok(text.length <= 155, `trimmed to 155, got ${text.length}`);
  assert.ok(text.endsWith('…'), 'trimmed text ends with an ellipsis');
  assert.doesNotMatch(text, /wor…$|wo…$|w…$/, 'does not cut a word in half');
});

test('profileDescription: every real record gets a description that fits', async () => {
  const { profileDescription } = await helpers();
  for (const record of records) {
    const text = profileDescription(record);
    assert.ok(text.length > 0 && text.length <= 155, `${record.profile.slug}: ${text.length} chars`);
    assert.doesNotMatch(text, BAD_TOKENS, record.profile.slug);
  }
});

test('profileTitle: keeps the suffix and stays within 60 characters', async () => {
  const { profileTitle } = await helpers();
  assert.equal(profileTitle(sparse), `Bare bones${TITLE_SUFFIX}`);
  const long = profileTitle({
    ...sparse,
    profile: { ...sparse.profile, title: 'An extremely long community profile title that overruns the budget' },
  });
  assert.ok(long.length <= 60, `trimmed to 60, got ${long.length}: ${long}`);
  assert.ok(long.endsWith(TITLE_SUFFIX), 'the suffix survives the trim');
  assert.match(long, /…/, 'trimmed title is marked with an ellipsis');
});

test('profileTitle: falls back to the slug when the record has no title', async () => {
  const { profileTitle } = await helpers();
  assert.equal(profileTitle({ profile: { slug: 'no-title' } }), `no-title${TITLE_SUFFIX}`);
});

test('profileJsonLd: [BreadcrumbList, SoftwareSourceCode] with no undefined for a sparse record', async () => {
  const { profileJsonLd } = await helpers();
  const nodes = profileJsonLd(sparse, 'https://hal0.dev/profiles/bare-bones/');
  assert.deepEqual(
    nodes.map((n) => n['@type']),
    ['BreadcrumbList', 'SoftwareSourceCode'],
  );
  const text = JSON.stringify(nodes);
  assert.doesNotMatch(text, BAD_TOKENS, 'serialised graph has no undefined/null');
  const code = nodes[1];
  assert.equal(code.url, 'https://hal0.dev/profiles/bare-bones/');
  assert.equal('author' in code, false, 'no author node when the record has no author');
  assert.equal('dateModified' in code, false, 'no dateModified when the record has no history');
  const crumbs = nodes[0].itemListElement;
  assert.deepEqual(
    crumbs.map((c) => c.position),
    [1, 2, 3],
  );
  assert.equal(crumbs[2].item, 'https://hal0.dev/profiles/bare-bones/');
});

test('profileJsonLd: author and latest history entry are carried when present', async () => {
  const { profileJsonLd } = await helpers();
  const full = records.find((r) => r.profile.author && r.history?.length);
  const nodes = profileJsonLd(full, `https://hal0.dev/profiles/${full.profile.slug}/`);
  const code = nodes[1];
  assert.equal(code.author.name, full.profile.author);
  assert.equal(code.dateModified, full.history[0].date);
  assert.doesNotMatch(JSON.stringify(nodes), BAD_TOKENS);
});

// ── build: dist/client/profiles/<slug>/index.html ──────────────────────

const dist = new URL('../../dist/client/', import.meta.url);
const built = await access(new URL('profiles/index.html', dist)).then(() => true, () => false);
const skip = !built && 'run npm run build first';

const pageUrl = (slug) => new URL(`profiles/${slug}/index.html`, dist);
const loadPage = (slug) => readFile(pageUrl(slug), 'utf8');

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function metaContent(html, attr, name) {
  const m = html.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*content="([^"]*)"`));
  return m ? decode(m[1]) : null;
}

function jsonLdGraph(html) {
  const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, 'page carries a JSON-LD script');
  // `<` is written as a six-character escape; JSON.parse decodes it back.
  return JSON.parse(m[1])['@graph'];
}

test('a page is built for every profile slug', { skip }, async () => {
  assert.ok(slugs.length > 0, 'profiles.json has records');
  for (const slug of slugs) {
    await access(pageUrl(slug)).catch(() => assert.fail(`missing dist/client/profiles/${slug}/index.html`));
  }
});

test('every profile page has a title of 60 characters or fewer', { skip }, async () => {
  for (const slug of slugs) {
    const html = await loadPage(slug);
    const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
    assert.ok(title.length > 0, `${slug}: has a <title>`);
    assert.ok(title.length <= 60, `${slug}: title is ${title.length} chars: ${title}`);
    assert.ok(title.endsWith(TITLE_SUFFIX), `${slug}: title ends with the suffix: ${title}`);
  }
});

test('every profile page has a meta description that fits and is clean', { skip }, async () => {
  for (const slug of slugs) {
    const html = await loadPage(slug);
    const desc = metaContent(html, 'name', 'description');
    assert.ok(desc && desc.length > 0, `${slug}: has a meta description`);
    assert.ok(desc.length <= 155, `${slug}: description is ${desc.length} chars`);
    assert.doesNotMatch(desc, BAD_TOKENS, `${slug}: description is clean`);
  }
});

test('every profile page canonicalises to https://hal0.dev/profiles/<slug>/', { skip }, async () => {
  for (const slug of slugs) {
    const html = await loadPage(slug);
    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="https://hal0\\.dev/profiles/${slug}/"`),
      `${slug}: canonical`,
    );
    assert.equal(metaContent(html, 'property', 'og:url'), `https://hal0.dev/profiles/${slug}/`, `${slug}: og:url`);
  }
});

test('every profile page uses its own OG card and the file is shipped', { skip }, async () => {
  for (const slug of slugs) {
    const html = await loadPage(slug);
    assert.equal(
      metaContent(html, 'property', 'og:image'),
      `https://hal0.dev/og/profiles/${slug}.png`,
      `${slug}: og:image`,
    );
    await access(new URL(`og/profiles/${slug}.png`, dist)).catch(() =>
      assert.fail(`${slug}: og/profiles/${slug}.png missing from dist/client`),
    );
  }
});

test('the sitemap lists every profile page', { skip }, async () => {
  const sitemap = await readFile(new URL('sitemap-0.xml', dist), 'utf8');
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const slug of slugs) {
    assert.ok(locs.has(`https://hal0.dev/profiles/${slug}/`), `sitemap lists /profiles/${slug}/`);
  }
});

test('every profile page emits a parseable BreadcrumbList + SoftwareSourceCode graph', { skip }, async () => {
  for (const slug of slugs) {
    const graph = jsonLdGraph(await loadPage(slug));
    assert.deepEqual(
      graph.map((n) => n['@type']),
      ['BreadcrumbList', 'SoftwareSourceCode'],
      `${slug}: graph types`,
    );
    assert.equal(graph[1].url, `https://hal0.dev/profiles/${slug}/`, `${slug}: SoftwareSourceCode url`);
  }
});

test('every profile page shows the title, model, runner, raw args, history and author', { skip }, async () => {
  for (const record of records) {
    const { profile, runner, model, args } = record;
    const html = await loadPage(profile.slug);
    assert.match(html, /<h1[\s>]/, `${profile.slug}: has an h1`);
    const text = decode(html);
    assert.ok(text.includes(profile.title), `${profile.slug}: shows the title`);
    assert.ok(text.includes(profile.intent), `${profile.slug}: shows the intent`);
    assert.ok(text.includes(model.id), `${profile.slug}: shows the model id`);
    for (const m of model.compatible ?? []) assert.ok(text.includes(m), `${profile.slug}: lists compatible ${m}`);
    assert.ok(text.includes(runner.lane), `${profile.slug}: shows the lane`);
    if (runner.min_build) assert.ok(text.includes(runner.min_build), `${profile.slug}: shows the min build`);
    assert.ok(text.includes(args.raw), `${profile.slug}: shows the raw args`);
    assert.match(html, /<pre[^>]*>[\s\S]*?<code/, `${profile.slug}: args sit in a code block`);
    for (const h of record.history ?? []) assert.ok(text.includes(h.note), `${profile.slug}: history note v${h.v}`);
    if (profile.author) assert.ok(text.includes(profile.author), `${profile.slug}: shows the author`);
    assert.doesNotMatch(html, />\s*undefined\s*</, `${profile.slug}: no stray undefined text node`);
  }
});

test('every profile page links back to the gallery and on to the submit page', { skip }, async () => {
  for (const slug of slugs) {
    const main = (await loadPage(slug)).match(/<main[\s\S]*<\/main>/)?.[0] ?? '';
    assert.match(main, /href="\/profiles\/?"/, `${slug}: links to the gallery`);
    assert.match(main, /href="\/profiles\/submit\/?"/, `${slug}: links to the submit page`);
  }
});

test('internal links inside a profile page resolve to built pages', { skip }, async () => {
  const slug = slugs[0];
  const main = (await loadPage(slug)).match(/<main[\s\S]*<\/main>/)?.[0] ?? '';
  const hrefs = [...main.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) {
    const path = href.replace(/\/$/, '');
    const candidates = [`${path}/index.html`.replace(/^\//, ''), `${path}.html`.replace(/^\//, ''), path.replace(/^\//, '')];
    let found = false;
    for (const c of candidates) {
      if (c && (await access(new URL(c, dist)).then(() => true, () => false))) found = true;
    }
    assert.ok(found || path === '', `${href} resolves to a built file`);
  }
});

test('a profile page ships the .chip and .btn rules it uses (site-data.css is imported)', { skip }, async () => {
  const html = await loadPage(slugs[0]);
  const sheets = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    sheets.push(await readFile(new URL(m[1].replace(/^\//, ''), dist), 'utf8'));
  }
  const css = sheets.join('\n');
  assert.match(css, /\.chip[.{,\s:]/, 'page CSS includes the .chip rule');
  assert.match(css, /\.btn[.{,\s:]/, 'page CSS includes the .btn rule');
});

test('the gallery has the new h2 and links every card title to its page', { skip }, async () => {
  const html = await readFile(new URL('profiles/index.html', dist), 'utf8');
  assert.match(
    html,
    /<h2[^>]*>\s*Community profiles for Strix Halo and local LLMs\s*<\/h2>/,
    'gallery has the h2',
  );
  for (const slug of slugs) {
    assert.match(
      html,
      new RegExp(`<h3[^>]*class="[^"]*pc-title[^"]*"[^>]*>\\s*<a[^>]*href="/profiles/${slug}/"[^>]*>\\s*${slug}\\s*</a>`),
      `${slug}: card title is a link to its page`,
    );
  }
});

test('the gallery keeps the ?p= drawer: every card trigger and drawer is still there', { skip }, async () => {
  const html = await readFile(new URL('profiles/index.html', dist), 'utf8');
  for (const slug of slugs) {
    assert.ok(html.includes(`data-profile-open="${slug}"`), `${slug}: card still opens its drawer`);
    assert.match(html, new RegExp(`<aside[^>]*data-profile="${slug}"`), `${slug}: drawer still rendered`);
  }
});

test('the drawer script lets clicks and keys on the title link through to the browser', { skip }, async () => {
  // Astro inlines the page <script> blocks into the HTML as module scripts.
  // The drawer one reads data-profile-open; it must ignore events that start
  // on an inner <a>, or the card would swallow the navigation (a click pushes
  // ?p=<slug> before the link fires, Enter is preventDefault-ed).
  const html = await readFile(new URL('profiles/index.html', dist), 'utf8');
  const drawer = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((src) => src.includes('profileOpen'))
    .join('\n');
  assert.ok(drawer.length > 0, 'found the drawer script');
  const guards = drawer.match(/closest\(["'`]a["'`]\)/g) ?? [];
  assert.equal(guards.length, 2, 'both the click and the keydown handler skip events that start on an inner link');
});
