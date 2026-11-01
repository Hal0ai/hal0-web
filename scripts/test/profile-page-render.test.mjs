// scripts/test/profile-page-render.test.mjs
//
// Page-level render of src/pages/profiles/[slug].astro against records the
// registry data does not contain today: a sparse one (no summary, author,
// history, first_party, min_build, image or compatible list) and a first-party
// one with no author handle. profile-pages.test.mjs checks the built output of
// the real records; this file checks that a record with absent fields renders
// a clean page rather than "undefined", which no real record exercises.
//
// No `npm run build` needed: the page is loaded through Vite's SSR loader and
// rendered with Astro's container API, the same way vitest-based Astro suites
// do it (the container API is still `experimental_`-prefixed in Astro 7).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const PAGE = '/src/pages/profiles/[slug].astro';

const profilesSnapshot = JSON.parse(await readFile(new URL('../../src/data/profiles.json', import.meta.url), 'utf8'));

let server;
let container;
let pageModule;

before(async () => {
  const { createServer } = await import('vite');
  const { getViteConfig } = await import('astro/config');
  const { experimental_AstroContainer: AstroContainer } = await import('astro/container');
  const viteConfig = await getViteConfig({}, { root, site: 'https://hal0.dev', logLevel: 'error' })({
    mode: 'test',
    command: 'serve',
  });
  server = await createServer({
    ...viteConfig,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  pageModule = await server.ssrLoadModule(PAGE);
  container = await AstroContainer.create();
});

after(async () => {
  await server?.close();
});

const render = (record) =>
  container.renderToString(pageModule.default, {
    props: { record },
    request: new Request(`https://hal0.dev/profiles/${record.profile.slug}/`),
  });

const mainOf = (html) => html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';
// The layout starts every graph with the site-wide Organization and WebSite
// nodes; these are the page's own (BreadcrumbList, SoftwareSourceCode).
const jsonLd = (html) =>
  JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])['@graph'].filter(
    (n) => n['@type'] === 'BreadcrumbList' || n['@type'] === 'SoftwareSourceCode',
  );

const BAD = /undefined|null|NaN|\[object/;

// Only the slug is present from the profile; the runner and model carry the
// bare minimum.
const sparse = {
  schema: 1,
  profile: { slug: 'bare-bones' },
  runner: {},
  model: {},
  args: {},
};

// Sparse in the way the schema allows: no summary, author, history, min_build.
const thin = {
  schema: 1,
  profile: { slug: 'thin-one', title: 'Thin one', intent: 'chat' },
  runner: { kind: 'llama-server', lane: 'rocm' },
  model: { id: 'qwen3-8b-q4' },
  args: { raw: '-ngl 99 -c 8192' },
};

test('getStaticPaths yields one path per registry record', () => {
  const paths = pageModule.getStaticPaths();
  assert.deepEqual(
    paths.map((p) => p.params.slug),
    profilesSnapshot.profiles.map((r) => r.profile.slug),
  );
  for (const p of paths) assert.equal(p.props.record.profile.slug, p.params.slug);
});

test('a record without summary, author, history or min_build renders with no undefined anywhere', async () => {
  const html = await render(thin);
  assert.doesNotMatch(html, BAD, 'no undefined/null/NaN in the page, head included');
  const main = mainOf(html);
  assert.match(main, /<h1[^>]*>\s*Thin one\s*<\/h1>/);
  assert.match(main, /-ngl 99 -c 8192/, 'the flags still render');
  assert.match(main, /qwen3-8b-q4/, 'the model still renders');
  // Sections whose field is absent are left out rather than rendered blank.
  assert.doesNotMatch(main, />\s*history\s*</, 'no history section');
  assert.doesNotMatch(main, />\s*author\s*</, 'no author card');
  assert.doesNotMatch(main, />\s*min build\s*</, 'no min build row');
  assert.doesNotMatch(main, />\s*also works with\s*</, 'no compatible list');
});

test('the head of a sparse page: generated description, trimmed title, gallery card as OG image', async () => {
  const html = await render(thin);
  assert.match(html, /<title>Thin one · llama\.cpp profile \| hal0<\/title>/);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.match(desc, /Thin one/);
  assert.match(desc, /qwen3-8b-q4/);
  assert.ok(desc.length <= 155);
  // No public/og/profiles/thin-one.png exists, so the tag must not point at a 404.
  assert.match(html, /<meta property="og:image" content="https:\/\/hal0\.dev\/og\/profiles-index\.png"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/hal0\.dev\/profiles\/thin-one\/"/);
});

test('the JSON-LD of a sparse page has no author, version or date nodes', async () => {
  const [crumbs, code] = jsonLd(await render(thin));
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.equal(code['@type'], 'SoftwareSourceCode');
  for (const key of ['author', 'version', 'dateModified']) {
    assert.equal(key in code, false, `no ${key} key`);
  }
  assert.doesNotMatch(JSON.stringify([crumbs, code]), BAD);
});

test('a record with nothing but a slug still renders a page', async () => {
  const html = await render(sparse);
  assert.doesNotMatch(html, BAD);
  const main = mainOf(html);
  assert.match(main, /<h1[^>]*>\s*bare-bones\s*<\/h1>/, 'the slug stands in for the missing title');
  assert.match(html, /<title>bare-bones · llama\.cpp profile \| hal0<\/title>/);
});

test('a first-party record with no author handle shows the chip and credits the Organization', async () => {
  const html = await render({ ...thin, profile: { ...thin.profile, first_party: true } });
  assert.doesNotMatch(html, BAD);
  assert.match(mainOf(html), /first-party/);
  assert.equal(jsonLd(html)[1].author['@type'], 'Organization');
});

test('the visible breadcrumb is three items and the last one is the page', async () => {
  const main = mainOf(await render(thin));
  const nav = main.match(/<nav[^>]*aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const items = [...nav.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(items, ['Home', 'Profiles', 'Thin one']);
});
