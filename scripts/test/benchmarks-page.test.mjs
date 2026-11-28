// scripts/test/benchmarks-page.test.mjs
//
// /benchmarks static shell (Task 4): server-rendered leaderboard built from
// the src/data/model-roster.ts snapshot via defaultView(normalizeRoster(...)).
// Follows chrome-consistency.test.mjs's build strategy — requires a fresh
// `npm run build` (skips with a visible message when dist/ is absent — CI
// always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

// dist/client/ — see chrome-consistency.test.mjs's note on the adapter's
// client/server output split.
const pageUrl = new URL('../../dist/client/benchmarks/index.html', import.meta.url);
const built = await access(pageUrl).then(() => true, () => false);

// The page can be hidden as a whole: its file is renamed to _benchmarks.astro (Astro does
// not build a page whose name starts with an underscore), /benchmarks redirects home, and
// its nav entries are marked `hidden`. Everything below follows the file name, so bringing
// the page back needs no change here.
const exists = (rel) => access(new URL(`../../${rel}`, import.meta.url)).then(() => true, () => false);
const hidden = !(await exists('src/pages/benchmarks.astro'));
const skipPage = hidden ? 'the benchmarks page is hidden (src/pages/_benchmarks.astro)' : !built && 'run npm run build first';

async function loadPage() {
  return readFile(pageUrl, 'utf8');
}

test('benchmarks page has the shared header and footer chrome', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(html, /<header[\s\S]*?<\/header>/, 'page has a <header>');
  const footerMatch = html.match(/<footer[^>]*data-site-footer[^>]*>[\s\S]*?<\/footer>/);
  assert.ok(footerMatch, 'page contains the shared SiteFooter (data-site-footer)');
});

test('leaderboard table renders all 26 roster rows', { skip: skipPage }, async () => {
  const html = await loadPage();
  const tableMatch = html.match(/<table class="dtable[^"]*"[^>]*>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  assert.ok(tableMatch, 'a <table class="dtable"> with a <tbody> is present');
  const rowCount = (tableMatch[1].match(/<tr[ >]/g) ?? []).length;
  assert.equal(rowCount, 26, 'leaderboard renders one row per roster model (defaultView over 26 snapshot rows)');
});

test('a known roster model id renders in the table', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(html, /qwen3\.5-0\.8b/, 'known model id "qwen3.5-0.8b" from model-roster.ts is present');
});

test('freshness badge renders the server-known snapshot state', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(html, /snapshot from 2026-06-19/, 'freshness badge names the ROSTER_DATE snapshot');
});

test("capability glyph SVG paths match ModelRoster.astro's ICONS verbatim", { skip: skipPage }, async () => {
  const html = await loadPage();
  // mtp glyph path — lifted verbatim from src/components/ModelRoster.astro ICONS.
  assert.ok(
    html.includes('M8.7 1 3 9h3.6l-1 6 6.4-8H9.1z'),
    'mtp capability glyph path matches ModelRoster.astro verbatim'
  );
});

test('"share your results" links to the model-roster-benchmark topic', { skip: skipPage }, async () => {
  const html = await loadPage();
  // The docs live on the forum, so this points at the topic. The
  // #sharing-results fragment is gone with the Starlight page: a Discourse
  // post's heading anchors are not the ones Starlight generated.
  assert.match(
    html,
    /href="https:\/\/forum\.hal0\.dev\/t\/model-roster-benchmarks-reference\/55"[^>]*>\s*share your results/,
    'share your results points at the roster benchmark topic'
  );
});

test('methodology links to the model-roster-benchmark topic', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /href="https:\/\/forum\.hal0\.dev\/t\/model-roster-benchmarks-reference\/55"[^>]*>\s*methodology/,
    'methodology button links to the roster benchmark topic'
  );
});

// --- Task 5: interactivity island -----------------------------------------

test('bench-island module script ships on the built page', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /<script type="module" src="\/_astro\/benchmarks\.astro_astro_type_script[^"]*\.js">/,
    'the page loads a bundled module script for the benchmarks <script> block (bench-island.ts)'
  );
});

test('bench-island module script ships and the server table has the full roster row count', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /<script type="module" src="\/_astro\/benchmarks\.astro_astro_type_script[^"]*\.js">/,
    'the island module script (which computes the initial corpus in-bundle via selectInitialRows — no DOM-text JSON island) ships on the page'
  );
  const tableMatch = html.match(/<table class="dtable[^"]*"[^>]*>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  assert.ok(tableMatch, 'a <table class="dtable"> with a <tbody> is present');
  const rowCount = (tableMatch[1].match(/<tr[ >]/g) ?? []).length;
  assert.equal(rowCount, 26, 'server-rendered table still has one row per roster model');
});

test('sortable table headers carry data-sort-key hooks for the island', { skip: skipPage }, async () => {
  const html = await loadPage();
  for (const key of ['id', 'params', 'lane', 'dec', 'pf', 'ttftP50', 'ttftP95', 'acc', 'gb']) {
    assert.match(html, new RegExp(`data-sort-key="${key}"`), `header for ${key} is wired for client-side sort`);
  }
});

test('filter bar controls carry the data hooks the island wires up', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(html, /id="bench-filters"/, 'filter bar root has an id');
  assert.match(html, /id="bench-search"/, 'text filter input has an id');
  assert.match(html, /id="bench-reset"/, 'reset button has an id');
  assert.match(html, /id="bench-empty-reset"/, 'empty-state reset button has an id');
  assert.match(html, /id="bench-freshness"/, 'freshness badge has an id');
  assert.match(html, /data-cap-count="mtp"/, 'capability pills render a count hook');
});

// --- Task 6: run drawer + deep link ----------------------------------------

test('run drawer ships hidden with dialog semantics (aria-modal, aria-labelledby)', { skip: skipPage }, async () => {
  const html = await loadPage();
  const scrimMatch = html.match(/<div class="scrim" id="run-drawer-scrim"[^>]*>/);
  assert.ok(scrimMatch, 'scrim element is present');
  assert.match(scrimMatch[0], /\bhidden\b/, 'scrim ships hidden');

  const drawerMatch = html.match(/<aside class="drawer-run" id="run-drawer"[^>]*>/);
  assert.ok(drawerMatch, 'drawer element is present');
  const drawerTag = drawerMatch[0];
  assert.match(drawerTag, /\bhidden\b/, 'drawer ships hidden');
  assert.match(drawerTag, /role="dialog"/, 'drawer has role="dialog"');
  assert.match(drawerTag, /aria-modal="true"/, 'drawer has aria-modal="true"');
  assert.match(drawerTag, /aria-labelledby="run-drawer-title"/, 'drawer is labelled by its title element');
});

test('run drawer has an empty title + body ready for the island to populate, and a labelled close control', { skip: skipPage }, async () => {
  const html = await loadPage();
  assert.match(html, /<div class="mono dr-title" id="run-drawer-title"><\/div>/, 'drawer title node starts empty');
  assert.match(html, /<div class="dr-body" id="run-drawer-body"><\/div>/, 'drawer body node starts empty');
  assert.match(html, /id="run-drawer-close"[^>]*aria-label="Close"/, 'close button is labelled for a11y');
});

// ── hidden state ─────────────────────────────────────────────────────────────

const read = (rel) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('the page file, the redirect and the nav entries move together', async () => {
  assert.notEqual(await exists('src/pages/benchmarks.astro'), await exists('src/pages/_benchmarks.astro'), 'exactly one of the two files exists');
  const nav = JSON.parse(await read('src/data/nav.json'));
  const entries = [
    nav.header.find((l) => l.label === 'benchmarks'),
    nav.footerColumns.flatMap((c) => c.links).find((l) => l.label === 'benchmarks'),
  ];
  for (const entry of entries) {
    assert.ok(entry, 'the entry stays in the manifest either way');
    assert.equal(Boolean(entry.hidden), hidden, `${entry.href} is hidden exactly while the page is`);
  }
  const config = await read('astro.config.mjs');
  assert.equal(/'\/benchmarks':\s*\{\s*status:\s*302,\s*destination:\s*'\/'\s*\}/.test(config), hidden, 'a temporary redirect stands in for a hidden page');
  assert.equal((await read('public/llms.txt')).includes('/benchmarks'), !hidden, 'llms.txt lists the page only while it exists');
});

test('while hidden, no surface shows benchmark figures or links the page', { skip: !hidden && 'the benchmarks page is visible' }, async () => {
  const landing = await read('src/pages/index.astro');
  assert.ok(!landing.includes('BenchHighlights'), 'the landing page has no benchmark highlights');
  assert.ok(!/href="\/benchmarks/.test(landing), 'and no link to the page');
  assert.match(landing, /id="benchmarks"/, 'old /#benchmarks links still land on the page');
  assert.ok(!(await read('src/content/docs/404.md')).includes('benchmarks'), 'the 404 page does not send people there');
});

const homeUrl = new URL('../../dist/client/index.html', import.meta.url);
const siteBuilt = await access(homeUrl).then(() => true, () => false);

test('while hidden, the build has no page, a 302 to the home page, and no link left', { skip: !hidden ? 'the benchmarks page is visible' : !siteBuilt && 'run npm run build first' }, async () => {
  assert.equal(built, false, 'dist has no /benchmarks page');
  const routes = JSON.parse(await read('.vercel/output/config.json')).routes;
  const redirect = routes.find((r) => typeof r.src === 'string' && r.src.includes('benchmarks') && r.headers?.Location);
  assert.ok(redirect, 'the deploy config has a /benchmarks redirect');
  assert.equal(redirect.status, 302, 'temporary, so search engines keep the URL');
  assert.equal(redirect.headers.Location, '/');
  assert.ok(new RegExp(redirect.src).test('/benchmarks') && new RegExp(redirect.src).test('/benchmarks/'), 'with and without the trailing slash');
  for (const page of ['index.html', 'releases/index.html', 'profiles/index.html', 'contributing/index.html', 'blog/index.html', '404.html']) {
    const html = await read(`dist/client/${page}`);
    assert.ok(!/href="\/benchmarks/.test(html), `${page} does not link /benchmarks`);
  }
  const sitemap = await read('dist/client/sitemap-0.xml');
  assert.ok(!sitemap.includes('/benchmarks'), 'the sitemap does not list it');
});
