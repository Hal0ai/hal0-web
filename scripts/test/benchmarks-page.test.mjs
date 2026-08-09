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

const pageUrl = new URL('../../dist/benchmarks/index.html', import.meta.url);
const built = await access(pageUrl).then(() => true, () => false);

async function loadPage() {
  return readFile(pageUrl, 'utf8');
}

test('benchmarks page has the shared header and footer chrome', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(html, /<header[\s\S]*?<\/header>/, 'page has a <header>');
  const footerMatch = html.match(/<footer[^>]*data-site-footer[^>]*>[\s\S]*?<\/footer>/);
  assert.ok(footerMatch, 'page contains the shared SiteFooter (data-site-footer)');
});

test('leaderboard table renders all 26 roster rows', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  const tableMatch = html.match(/<table class="dtable[^"]*"[^>]*>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  assert.ok(tableMatch, 'a <table class="dtable"> with a <tbody> is present');
  const rowCount = (tableMatch[1].match(/<tr[ >]/g) ?? []).length;
  assert.equal(rowCount, 26, 'leaderboard renders one row per roster model (defaultView over 26 snapshot rows)');
});

test('a known roster model id renders in the table', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(html, /qwen3\.5-0\.8b/, 'known model id "qwen3.5-0.8b" from model-roster.ts is present');
});

test('freshness badge renders the server-known snapshot state', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(html, /snapshot from 2026-06-19/, 'freshness badge names the ROSTER_DATE snapshot');
});

test("capability glyph SVG paths match ModelRoster.astro's ICONS verbatim", { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  // mtp glyph path — lifted verbatim from src/components/ModelRoster.astro ICONS.
  assert.ok(
    html.includes('M8.7 1 3 9h3.6l-1 6 6.4-8H9.1z'),
    'mtp capability glyph path matches ModelRoster.astro verbatim'
  );
});

test('"share your results" links to the model-roster-benchmark sharing docs anchor', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /href="\/docs\/reference\/model-roster-benchmark\/#sharing-results"[^>]*>\s*share your results/,
    'share your results points at the docs sharing anchor, not an upload flow'
  );
});

test('methodology links to the model-roster-benchmark docs page', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /href="\/docs\/reference\/model-roster-benchmark\/"[^>]*>\s*methodology/,
    'methodology button links to the docs reference page'
  );
});

// --- Task 5: interactivity island -----------------------------------------

test('bench-island module script ships on the built page', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(
    html,
    /<script type="module" src="\/_astro\/benchmarks\.astro_astro_type_script[^"]*\.js">/,
    'the page loads a bundled module script for the benchmarks <script> block (bench-island.ts)'
  );
});

test('bench-island module script ships and the server table has the full roster row count', { skip: !built && 'run npm run build first' }, async () => {
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

test('sortable table headers carry data-sort-key hooks for the island', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  for (const key of ['id', 'params', 'lane', 'dec', 'pf', 'ttftP50', 'ttftP95', 'acc', 'gb']) {
    assert.match(html, new RegExp(`data-sort-key="${key}"`), `header for ${key} is wired for client-side sort`);
  }
});

test('filter bar controls carry the data hooks the island wires up', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(html, /id="bench-filters"/, 'filter bar root has an id');
  assert.match(html, /id="bench-search"/, 'text filter input has an id');
  assert.match(html, /id="bench-reset"/, 'reset button has an id');
  assert.match(html, /id="bench-empty-reset"/, 'empty-state reset button has an id');
  assert.match(html, /id="bench-freshness"/, 'freshness badge has an id');
  assert.match(html, /data-cap-count="mtp"/, 'capability pills render a count hook');
});

// --- Task 6: run drawer + deep link ----------------------------------------

test('run drawer ships hidden with dialog semantics (aria-modal, aria-labelledby)', { skip: !built && 'run npm run build first' }, async () => {
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

test('run drawer has an empty title + body ready for the island to populate, and a labelled close control', { skip: !built && 'run npm run build first' }, async () => {
  const html = await loadPage();
  assert.match(html, /<div class="mono dr-title" id="run-drawer-title"><\/div>/, 'drawer title node starts empty');
  assert.match(html, /<div class="dr-body" id="run-drawer-body"><\/div>/, 'drawer body node starts empty');
  assert.match(html, /id="run-drawer-close"[^>]*aria-label="Close"/, 'close button is labelled for a11y');
});
