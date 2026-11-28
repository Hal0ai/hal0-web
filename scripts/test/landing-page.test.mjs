// The landing page (src/pages/index.astro): a plain-language story for someone
// setting up a first local AI server.
//
// Three things are pinned here:
//   1. the brief: plain words up top, the technical layer lower down;
//   2. the limits on what the copy may claim (src/data/landing.ts lists them);
//   3. the mechanics: one h1, the section order, old anchors, links, schema,
//      and every multi-column grid collapsing on a narrow screen.
// Tests marked skipUnbuilt read dist/ and need `npm run build` first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);
const source = (path) => readFile(new URL(path, root), 'utf8');

const builtPath = 'dist/client/index.html';
const built = await exists(builtPath);
const skipUnbuilt = { skip: !built && 'run npm run build first' };
const html = built ? await source(builtPath) : '';
const main = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';

const PAGE = 'src/pages/index.astro';
const LANDING_DATA = 'src/data/landing.ts';
const TEAM_BOARD = 'src/components/landing/TeamBoard.astro';
const SLOT_VERSUS = 'src/components/landing/SlotVersus.astro';
const TOUR = 'src/components/landing/DashboardTour.astro';
const DEVICE_SHOT = 'src/components/landing/DeviceShot.astro';
const COMPARE_TABLE = 'src/components/landing/CompareTable.astro';
const FAQ_COMPONENT = 'src/components/landing/Faq.astro';
const RELEASE_TEASER = 'src/components/landing/ReleaseTeaser.astro';
const HERMES_CARD = 'src/components/HermesCard.astro';
const COPY_FILES = [PAGE, LANDING_DATA, TEAM_BOARD, SLOT_VERSUS, TOUR, COMPARE_TABLE, FAQ_COMPONENT, RELEASE_TEASER];

const data = await import(new URL(LANDING_DATA, root));
const captureSet = JSON.parse(await source('src/data/screenshots.json'));
const figuresOf = (name) => captureSet.images.find((i) => i.file === `${name}.png`)?.figures;

// What a reader can see: drop CSS (line-height: 1.5 is not a version), scripts
// and comments (a doc path is not a claim).
const copyOf = (text) =>
  text
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

function visibleWords(fragment) {
  return copyOf(fragment)
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
}

/** The built markup of one `<section id>` (or the hero, which has a class and no id). */
function section(selector) {
  const open = selector.startsWith('.')
    ? new RegExp(`<section[^>]*\\sclass="[^"]*\\b${selector.slice(1)}\\b[^"]*"[^>]*>`)
    : new RegExp(`<section[^>]*\\sid="${selector}"[^>]*>`);
  const start = main.search(open);
  assert.ok(start >= 0, `section ${selector} is on the page`);
  const end = main.indexOf('</section>', start);
  return main.slice(start, end);
}

// ── 1. the brief ────────────────────────────────────────────────────────────

test('the page has one h1, in plain words', skipUnbuilt, () => {
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.equal(h1s[0][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 'Private AI for your home.');
});

test('the first three sections stay free of product jargon', skipUnbuilt, () => {
  // A first-time visitor meets the hero, the five uses and the slot idea before
  // anything else. None of it may need a glossary.
  const JARGON = [
    /\/v1\b/,
    /:\d{4}\b/,
    /\bROCm\b/,
    /\bVulkan\b/,
    /\bGGUF\b/,
    /\bNPU\b/,
    /\bMCP\b/,
    /\bquant/i,
    /\bcontext window\b/i,
    /\bendpoint/i,
    /\bcontainer/i,
    /\binference\b/, // the brand line "Own your inference" is the one allowed use
    /\b503\b/,
    /\btok\/s\b/,
  ];
  for (const selector of ['.hero', 'uses', 'slots']) {
    const text = visibleWords(section(selector)).join(' ').replace('Own your inference', '');
    for (const term of JARGON) {
      assert.doesNotMatch(text, term, `section ${selector} uses ${term}`);
    }
  }
});

test('the technical layer is still on the page, lower down', skipUnbuilt, () => {
  const details = section('details');
  for (const term of ['OpenAI-compatible', 'MCP', 'llama.cpp']) {
    assert.ok(details.includes(term), `the details band names ${term}`);
  }
  // The named comparison is behind a disclosure, closed by default.
  const compare = section('compare');
  assert.match(compare, /<details class="named[^"]*"(?![^>]*\sopen)[^>]*>/, 'the named table starts closed');
  assert.ok(compare.includes('Ollama') && compare.includes('LM Studio'), 'and it names the tools');
  assert.ok(main.indexOf('id="details"') > main.indexOf('id="start"'), 'the details come after "get started"');
});

test('sections run in story order, and old anchors still land somewhere', skipUnbuilt, () => {
  const order = ['uses', 'slots', 'connected', 'agent', 'memory', 'privacy', 'models', 'tour', 'hardware', 'start', 'details', 'compare', 'releases', 'faq'];
  const at = order.map((id) => {
    const i = html.search(new RegExp(`<section[^>]*\\sid="${id}"`));
    assert.ok(i >= 0, `section #${id} is present`);
    return i;
  });
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'section ids are in order');
  // Links published before this rewrite (README, forum, blog) keep working.
  for (const id of ['idea', 'swap', 'wired', 'console', 'get', 'install', 'benchmarks', 'whats-new', 'roadmap', 'privacy', 'memory', 'hardware', 'compare', 'faq']) {
    assert.match(html, new RegExp(`\\sid="${id}"`), `#${id} still exists`);
  }
  const ids = [...main.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'no id is used twice');
});

test('the key headings are on the page', skipUnbuilt, () => {
  for (const heading of [
    'A team of models, not a queue for one.',
    'Everything arrives connected.',
    'An agent that gets on with it.',
    'An assistant that remembers.',
    'What happens on your box stays on your box.',
    'Run the models people are talking about.',
    'See it before you install it.',
    'What you need.',
    'Up and running in three steps.',
    'Want the details?',
  ]) {
    assert.ok(html.includes(heading), heading);
  }
});

test('what a reader sees without opening anything stays between 1600 and 2800 words', skipUnbuilt, () => {
  // Closed disclosures (the named comparison, most FAQ answers) keep their summary only,
  // and the tour counts its first stop: a reader sees one at a time.
  let seen = main.replace(/<details(?![^>]*\sopen)[^>]*>[\s\S]*?<\/details>/g, (block) => block.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? '');
  let stops = 0;
  seen = seen.replace(/<div[^>]*role="tabpanel"[\s\S]*?(?=<div[^>]*role="tabpanel"|<p class="tour-note)/g, (panel) => (stops++ === 0 ? panel : ''));
  assert.equal(stops, data.TOUR.length, 'every tour stop was found');
  const count = visibleWords(seen).length;
  assert.ok(count >= 1600 && count <= 2800, `visible word count is ${count}`);
  // Everything, opened: still a page, not a manual.
  assert.ok(visibleWords(main).length <= 3600, `full word count is ${visibleWords(main).length}`);
});

// ── 2. what the copy may claim ──────────────────────────────────────────────

const FORBIDDEN = ['unleash', 'seamless', 'revolutionary', 'supercharge', 'instantly', 'sandboxed', 'never leak', 'blazing', 'effortless'];

test('site copy avoids the forbidden words, version numbers and em-dash asides', async () => {
  for (const file of COPY_FILES) {
    const text = await source(file);
    for (const word of FORBIDDEN) {
      assert.ok(!text.toLowerCase().includes(word), `${file} contains "${word}"`);
    }
    assert.ok(!copyOf(text).includes('—'), `${file} has an em dash in its copy`);
    // SD 1.5 and Stable Diffusion 1.5 are a model family, hal0 0.5 is the dated sweep's own build.
    const prose = copyOf(text).replaceAll('Stable Diffusion 1.5', '').replaceAll('SD 1.5', '').replaceAll('hal0 0.5', '');
    assert.ok(!/\b\d+\.\d+\.\d+\b|\bv?1\.\d\b|\brc\b|\bGA\b|new in\b/.test(prose), `${file} names a version`);
  }
});

test('nothing from an untagged release is announced', skipUnbuilt, async () => {
  // The changelog can describe a release before it is tagged. Until the tag exists the
  // page may not repeat any of it: no highlight of an entry that sits above the latest
  // tagged release may appear in the page's words. The same search has to find the first
  // highlight of the latest tagged release, which the page does show, or it proves nothing.
  // The snapshot and the release list on disk are the ones the build read.
  const { parseChangelog, releaseHighlights } = await import(new URL('src/lib/changelog.js', root));
  const { tags } = JSON.parse(await source('src/data/release-tags.json'));
  const { versions, latestTagged } = parseChangelog(await source('src/data/changelog.md'), { tags });
  assert.ok(latestTagged, 'the changelog has a tagged release');

  const words = (fragment) =>
    visibleWords(fragment).join(' ').replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&').toLowerCase();
  const lead = (item) => words(item).split(' ').slice(0, 6).join(' ');
  const text = words(main);

  const shipped = releaseHighlights(latestTagged, 3);
  if (shipped.length) {
    assert.ok(text.includes(lead(shipped[0])), `the page carries the first highlight of ${latestTagged.version}: "${lead(shipped[0])}"`);
  }

  const ahead = versions.slice(0, versions.indexOf(latestTagged)).filter((version) => version.untagged);
  for (const version of ahead) {
    for (const item of releaseHighlights(version, 99)) {
      assert.ok(!text.includes(lead(item)), `the page repeats a highlight of ${version.version}, which has no tag: "${lead(item)}"`);
    }
  }
});

test('MCP is described as it works today', async () => {
  const text = copyOf(await source(LANDING_DATA));
  assert.doesNotMatch(text, /full MCP/i, 'no "full MCP support"');
  assert.doesNotMatch(text, /any MCP server/i);
  assert.match(text, /built-in agents cannot call those yet/, 'installed servers do not reach the agents');
  assert.match(text, /a key you can revoke/, 'outside clients connect with a revocable key');
});

test('a default install is described as it behaves', async () => {
  const text = copyOf(await source(LANDING_DATA));
  // Slots are seeded empty apart from one small helper model.
  assert.match(text, /A small model is already loaded/);
  assert.match(text, /Give each slot a model/);
  assert.doesNotMatch(text, /models? (are|come) pre-?(loaded|installed)/i);
  // Pi is not installed by default.
  assert.match(text, /Pi, a coding agent for the terminal, is one command to add/);
  // Voice, document search and images need their slots filled first.
  assert.match(text, /connect as soon as those slots have a model/);
});

test('the limits of slots are said out loud', async () => {
  const { SLOT_NOTE, FAQ } = data;
  assert.match(SLOT_NOTE, /depends on your machine’s memory/);
  assert.match(SLOT_NOTE, /reloads for a moment when you change its model/);
  const several = FAQ.find((f) => f.q === 'Can I run several models at once?').a;
  assert.match(several, /while an image is being generated, the chat models on the graphics chip step aside/);
  // The hero picture leaves image generation out for the same reason.
  assert.ok(!data.HERO_TEAM.some((seat) => /image/i.test(seat.job)), 'no image row "answering" beside the chat rows');
});

test('privacy claims are scoped to what was checked', async () => {
  const { PRIVACY_FACTS, PRIVACY_NOTE } = data;
  const text = PRIVACY_FACTS.map((f) => `${f.title} ${f.body}`).join(' ');
  assert.match(text, /sends no usage data and no crash reports/);
  assert.match(text, /looks for new releases while the dashboard is open/, 'the update check is not hidden');
  assert.match(text, /A cloud model is used only if you add one yourself/);
  assert.doesNotMatch(text, /nothing (ever )?leaves/i, 'no universal "nothing leaves" claim');
  // No sign-in by default on any of the three web surfaces.
  assert.match(PRIVACY_NOTE, /dashboard, the chat app and the image editor have no password/);
  assert.match(PRIVACY_NOTE, /Keep the box off the public internet/);
});

test('the agent is not oversold', async () => {
  assert.match(data.AGENT_NOTE, /keys to the box/, 'the agent can reach what the box holds');
  assert.match(data.AGENT_NOTE, /terminal tool is off unless you turn it on/);
  const card = await source(HERMES_CARD);
  assert.ok(!card.includes('unattended for hours'), 'the unattended line is gone');
  assert.ok(!card.includes('never relearns'), 'the "never relearns" line is gone');
});

test('only image models the API can render are named', async () => {
  const text = copyOf(await source(LANDING_DATA));
  assert.doesNotMatch(text, /\bFLUX\b/i, 'FLUX is in the sample captures, not in the catalogue the API renders');
  assert.match(text, /SDXL · Stable Diffusion 1\.5 · Qwen-Image/);
});

test('FAQ has the eleven questions with short, plain answers', () => {
  const { FAQ } = data;
  assert.deepEqual(FAQ.map((f) => f.q), [
    'What is hal0?',
    'Do I need to be technical?',
    'Do I need a Strix Halo machine?',
    'Can I run several models at once?',
    'Is it really private?',
    'What does it cost?',
    'Is hal0 an Ollama alternative?',
    'Can I still use a cloud model sometimes?',
    'Is the API OpenAI-compatible?',
    'Which GPUs and NPUs work?',
    'What if I get stuck?',
  ]);
  for (const { q, a } of FAQ) {
    assert.ok(a.length < 420, `answer to "${q}" is ${a.length} characters`);
    assert.ok(!/[<`]/.test(a), `answer to "${q}" is plain text, so the schema can reuse it`);
  }
});

test('compare table has nine rows of five cells, each row sourced', async () => {
  const { COMPARE_COLUMNS, COMPARE_ROWS, PLAIN_COMPARE } = data;
  assert.deepEqual(COMPARE_COLUMNS, ['hal0', 'Ollama', 'LM Studio', 'llama-swap', 'Lemonade']);
  assert.equal(COMPARE_ROWS.length, 9);
  for (const row of COMPARE_ROWS) assert.equal(row.cells.length, 5, row.label);
  const text = await source(LANDING_DATA);
  const block = text.slice(text.indexOf('COMPARE_ROWS'), text.indexOf('COMPARE_NOTE'));
  assert.equal((block.match(/\/\/ source: S\d+/g) ?? []).length, COMPARE_ROWS.length, 'one // source: S<n> comment per row');
  for (const row of PLAIN_COMPARE) assert.equal(row.length, 3, row[0]);
});

test('the comparisons say what the research could and could not confirm', () => {
  const cell = (label, column) => data.COMPARE_ROWS.find((r) => r.label === label).cells[column];
  // competitive.md marks these "unverified" or "none found", not a flat "no".
  assert.equal(cell('Admin plane as MCP', 1), 'none found');
  assert.equal(cell('Memory bundled', 1), 'none found');
  assert.equal(cell('Voice + images, one API', 1), 'none found');
  assert.match(cell('Strix Halo + NPU', 1), /NPU not found/);
  // Ollama keeps several models resident, so the plain table hedges ("usually")
  // and names no product.
  assert.equal(cell('Models resident by default', 1), 'up to 3 per GPU');
  assert.match(data.PLAIN_COMPARE[0][1], /^Usually one/);
  const plain = data.PLAIN_COMPARE.flat().join(' ');
  for (const name of ['Ollama', 'LM Studio', 'llama-swap', 'Lemonade']) {
    assert.ok(!plain.includes(name), `the plain table does not name ${name}`);
  }
});

// ── captures ────────────────────────────────────────────────────────────────

/** Every capture the page can show: each placed shot and its tablet and phone variants. */
function allShots() {
  const { SHOT_CONNECTED, SHOT_MEMORY, SHOT_MODELS, TOUR: stops } = data;
  const placed = [
    ...[SHOT_CONNECTED, SHOT_MEMORY, SHOT_MODELS].map((s) => ({ ...s, where: 'beside the copy' })),
    ...stops.map((s) => ({ name: s.shot, alt: s.alt, tablet: s.tablet, phone: s.phone, where: 'tour' })),
  ];
  return placed.flatMap((s) => [
    { name: s.name, alt: s.alt, where: s.where, device: 'desktop' },
    ...(s.tablet ? [{ ...s.tablet, where: s.where, device: 'tablet' }] : []),
    ...(s.phone ? [{ ...s.phone, where: s.where, device: 'phone' }] : []),
  ]);
}

test('every capture on the page is on disk and described', async () => {
  const shots = allShots();
  for (const shot of shots) {
    assert.ok(await exists(`public/screenshots/${shot.name}.png`), `${shot.name}.png is on disk`);
    assert.ok(shot.alt.length >= 60, `${shot.name} has alt text that describes the picture`);
    assert.ok(figuresOf(shot.name), `${shot.name} is in the synced set, so its Figures value is known`);
  }
  assert.equal(new Set(shots.map((s) => s.name)).size, shots.length, 'no capture is shown twice');
});

test('a tablet or phone variant is a capture at that width, and says so', () => {
  const widthOf = (name) => captureSet.images.find((i) => i.file === `${name}.png`).viewport;
  const variants = allShots().filter((s) => s.device !== 'desktop');
  assert.ok(variants.length >= 6, `the page has ${variants.length} device variants`);
  for (const v of variants) {
    assert.equal(widthOf(v.name), v.device === 'phone' ? '390×844' : '834×1112', `${v.name} is a ${v.device} capture`);
    assert.match(v.alt, new RegExp(`on a ${v.device}\\b`), `${v.name}: the alt text says it is a ${v.device} capture`);
    // The manifest marks two captures for docs use only, because the dashboard clips text in them.
    const use = captureSet.images.find((i) => i.file === `${v.name}.png`).use;
    assert.doesNotMatch(use, /^docs step \(/, `${v.name} is not one the manifest keeps out of promotion`);
  }
});

test('captures with invented readings stay out of the hero and away from the claims', async () => {
  const { SHOT_CONNECTED, TOUR_NOTE } = data;
  // Beside the copy: no performance figures at all, on any device.
  for (const shot of allShots().filter((s) => s.where === 'beside the copy')) {
    assert.equal(figuresOf(shot.name), 'none', `${shot.name} sits beside a claim`);
  }
  // The hero is an illustration, not a capture.
  const page = await source(PAGE);
  const hero = page.slice(page.indexOf('<!-- 1. HERO -->'), page.indexOf('<!-- 2.'));
  assert.ok(!hero.includes('<Shot') && !hero.includes('<DeviceShot'), 'no capture in the hero');
  assert.ok(hero.includes('<TeamBoard'), 'the hero picture is the labelled illustration');
  assert.match(await source(TEAM_BOARD), />illustration</, 'and it says it is one');
  // The tour may show them, because the point there is the page layout, and it says so.
  if (allShots().some((s) => s.where === 'tour' && figuresOf(s.name) !== 'none')) {
    assert.match(TOUR_NOTE, /sample data/);
    assert.match(TOUR_NOTE, /not measurements/);
    assert.match(await source(TOUR), /\{TOUR_NOTE\}/, 'the note is rendered under the tour');
  }
  // The structured data's lead image carries no figures either.
  assert.match(page, /image: shotUrl\(SHOT_CONNECTED\.name\)/);
  assert.equal(figuresOf(SHOT_CONNECTED.name), 'none');
});

test('one device variant shows at a time, and the lightbox leaves the others out', async () => {
  const css = (await source(DEVICE_SHOT)).match(/<style>[\s\S]*<\/style>/)[0];
  assert.match(css, /\.v-tablet,\s*\.v-phone \{\s*display: none;/, 'only the desktop capture shows by default');
  assert.match(css, /@media \(max-width: 1100px\) \{\s*\.has-tablet \.v-desktop \{\s*display: none;/);
  assert.match(css, /@media \(max-width: 600px\) \{\s*\.has-phone \.v-desktop,\s*\.has-phone \.v-tablet \{\s*display: none;/);
  // A hidden variant must not be reachable by stepping through the lightbox.
  const lightbox = await source('public/js/lightbox.js');
  assert.match(lightbox, /closest\('\[data-shot-variant\]'\)/);
  assert.match(lightbox, /getComputedStyle\(variant\)\.display !== 'none'/);
  assert.match(await source(DEVICE_SHOT), /data-shot-variant="phone"/);
});

test('the tour is tabs with the right roles, and works without its script', async () => {
  const tour = await source(TOUR);
  assert.match(tour, /role="tablist"/);
  assert.match(tour, /role="tab"/);
  assert.match(tour, /role="tabpanel"/);
  assert.match(tour, /aria-controls=\{`tour-panel-\$\{stop\.key\}`\}/);
  assert.match(tour, /<DeviceShot\b/, 'captures go through DeviceShot, and through it src/components/Shot.astro');
  assert.match(await source(DEVICE_SHOT), /<Shot\b/);
  assert.ok(!/<img\b/.test(tour), 'no bare screenshot <img>');
  // No panel is hidden in the markup: the script hides all but the first.
  assert.ok(!/<div class="stop"[^>]*\shidden/.test(tour), 'panels are visible until the script runs');
  assert.match(tour, /\.is-tabbed \.tabs/, 'the tab strip shows only once the script has taken over');
  const keys = data.TOUR.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'tab keys are unique');
});

test('the built tour renders one panel and one picture per stop', skipUnbuilt, () => {
  const tour = section('tour');
  assert.equal((tour.match(/role="tabpanel"/g) ?? []).length, data.TOUR.length);
  const variants = data.TOUR.reduce((n, stop) => n + (stop.tablet ? 1 : 0) + (stop.phone ? 1 : 0), 0);
  assert.equal((tour.match(/<picture\b/g) ?? []).length, data.TOUR.length + variants, 'one picture per stop and per device variant');
  assert.ok(tour.includes(data.TOUR_NOTE));
});

// ── 3. mechanics ────────────────────────────────────────────────────────────

test('title and description come from the SEO audit', skipUnbuilt, () => {
  assert.ok(html.includes('<title>hal0: Self-Hosted Local AI Server for AMD Strix Halo</title>'));
  assert.ok(
    html.includes(
      'content="Run LLMs, speech and images on your own hardware. Open-source, OpenAI-compatible local AI server for AMD Strix Halo (Ryzen AI Max+ 395) and Linux."',
    ),
  );
});

test('prose keeps its spaces around inline tags', skipUnbuilt, () => {
  // Astro's HTML compression drops a line break between text and an inline tag.
  assert.match(html, /its own <strong[^>]*>slot<\/strong>:/);
  assert.ok(!/[a-z]<strong/.test(main), 'no word runs straight into a <strong>');
  assert.ok(!/[a-z.]<a\s/.test(main.replace(/<li[^>]*><a\s/g, '')), 'no sentence runs straight into a link');
  assert.ok(!/<\/(b|strong)>[A-Za-z]/.test(main), 'no bold lead-in runs straight into the sentence after it');
});

test('the install command is the one from the docs, shown once with a copy button', skipUnbuilt, async () => {
  const command = 'curl -fsSL https://hal0.dev/install.sh | sudo bash';
  assert.ok((await source(PAGE)).includes(`const INSTALL_COMMAND = '${command}';`));
  const start = section('start');
  assert.ok(start.includes(command.replace('|', '|')), 'the command is in the start section');
  assert.match(start, new RegExp(`data-copy="${command.replace(/[|.]/g, '\\$&')}"`));
  assert.match(start, /href="\/docs\/getting-started\/install\/"/, 'with the install guide beside it');
  assert.match(start, /href="\/docs\/getting-started\/beginners-guide\/"/, 'and the beginner’s guide');
});

test('the version comes from the latest tagged release, never from the copy', skipUnbuilt, async () => {
  const page = await source(PAGE);
  assert.match(page, /latestTagged\?\.version/);
  assert.match(section('start'), /Latest stable release: \d+\.\d+\.\d+\./);
});

test('the page links /releases, not the old route', skipUnbuilt, () => {
  assert.ok(!/href="\/changelog/.test(main), 'no /changelog link in the page body');
  assert.match(main, /href="\/releases"/);
});

test('every internal href in the page body resolves', skipUnbuilt, async () => {
  const config = await source('astro.config.mjs');
  const redirects = JSON.parse(await source('src/data/docs-redirects.json'));
  const paths = new Set([...main.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]).filter((p) => p !== '/'));
  assert.ok(paths.size > 0);
  for (const path of paths) {
    const bare = path.replace(/\/$/, '');
    const resolves =
      (await exists(`dist/client${bare}/index.html`)) ||
      (await exists(`dist/client${bare}`)) ||
      config.includes(`'${bare}'`) ||
      `${bare}/` in redirects;
    assert.ok(resolves, `${path} resolves`);
  }
  for (const [, id] of main.matchAll(/href="#([^"]+)"/g)) {
    assert.match(main, new RegExp(`\\sid="${id}"`), `#${id} is on the page`);
  }
});

test('the beginner’s guide has its redirect', async () => {
  const redirects = JSON.parse(await source('src/data/docs-redirects.json'));
  assert.equal(redirects['/docs/getting-started/beginners-guide/'], 'https://forum.hal0.dev/t/beginners-guide/159');
  const keys = Object.keys(redirects);
  assert.deepEqual(keys, [...keys].sort(), 'the map stays sorted');
});

test('no inline style forces a width wider than a phone', skipUnbuilt, () => {
  for (const [, style] of html.matchAll(/\sstyle="([^"]*)"/g)) {
    const m = style.match(/min-width:\s*(\d+)px/);
    if (m) assert.ok(Number(m[1]) <= 360, `inline min-width ${m[1]}px`);
  }
});

test('the ld+json FAQPage mirrors the visible questions', skipUnbuilt, () => {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'exactly one ld+json script');
  const graph = JSON.parse(scripts[0][1])['@graph'];
  const pages = graph.filter((node) => node['@type'] === 'FAQPage');
  assert.equal(pages.length, 1, 'one FAQPage node');
  const faq = section('faq');
  const summaries = [...faq.matchAll(/<summary[^>]*>([^<]*)<\/summary>/g)].map((m) => m[1].trim());
  assert.deepEqual(pages[0].mainEntity.map((q) => q.name), summaries);
  assert.equal(summaries.length, data.FAQ.length);
});

test('the structured data is complete and comes through the layout', skipUnbuilt, async () => {
  const page = await source(PAGE);
  assert.ok(!/type="application\/ld\+json"/.test(page), 'the page renders no ld+json of its own');
  const script = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
  const graph = JSON.parse(script[1])['@graph'];
  const app = graph.find((node) => node['@type'] === 'SoftwareApplication');
  assert.ok(app, 'SoftwareApplication node');
  assert.match(app.softwareVersion, /^\d+\.\d+\.\d+/, 'version from latestTagged');
  assert.equal(app.softwareRequirements, 'Linux x86_64, Python 3.12+, systemd, podman');
  assert.equal(app.releaseNotes, 'https://hal0.dev/releases/');
  assert.equal(app.installUrl, 'https://hal0.dev/install.sh');
  assert.deepEqual(app.publisher, { '@id': 'https://hal0.dev/#org' });
  assert.ok(graph.some((node) => node['@id'] === app.publisher['@id']), 'an Organization node carries that @id');
  assert.ok(Array.isArray(app.featureList) && app.featureList.length >= 6, 'featureList');
  assert.ok(!app.featureList.some((f) => /image engine|images? on install/i.test(f)), 'no image engine promised on install');
  assert.match(app.image, /^https:\/\/hal0\.dev\/screenshots\/.+\.png$/);
  assert.ok(Array.isArray(app.screenshot) && app.screenshot.length >= 8, 'screenshot list');
  for (const url of app.screenshot) assert.match(url, /^https:\/\/hal0\.dev\/screenshots\/.+\.png$/);
});

test('the page takes its site constants from src/lib/seo.ts', async () => {
  const page = await source(PAGE);
  assert.match(page, /import \{[^}]*ORG_ID[^}]*SITE_URL[^}]*\} from '..\/lib\/seo/);
  assert.ok(!page.includes("'https://hal0.dev'"), 'no second copy of the site URL');
});

test('the components the old page used are gone, with nothing left pointing at them', async () => {
  for (const removed of ['src/components/landing/SlotBoard.astro', 'src/components/landing/ConsoleShot.astro', 'src/data/slot-board.ts']) {
    assert.equal(await exists(removed), false, `${removed} is removed`);
  }
  const page = await source(PAGE);
  for (const name of ['SlotBoard', 'ConsoleShot', 'CONSOLE_SHOTS', 'slot-board', 'LiveArtifact']) {
    assert.ok(!page.includes(name), `index.astro no longer mentions ${name}`);
  }
});

test('shared blocks keep their context', async () => {
  const teaser = await source(RELEASE_TEASER);
  assert.match(teaser, /latestTagged/);
  assert.match(teaser, /releaseHighlights/);
  assert.match(teaser, /href="\/releases"/);
  const faq = await source(FAQ_COMPONENT);
  assert.match(faq, /FAQ\.map/);
  assert.match(faq, /<summary>\{[^}]*q[^}]*\}<\/summary>/);
  const profiles = await source('src/components/landing/FeaturedProfiles.astro');
  assert.ok(profiles.includes('record.profile.summary'), 'summary is back');
  assert.ok(!profiles.includes('args.raw'), 'flags stay off');
});

test('benchmarks are off the page while that system is reworked', async () => {
  const page = await source(PAGE);
  assert.ok(!page.includes('BenchHighlights'), 'no benchmark highlights');
  assert.ok(!/href="\/benchmarks/.test(page), 'no link to the benchmarks page');
  const text = copyOf(await source(LANDING_DATA));
  assert.ok(!text.includes('/benchmarks'), 'and none from the details band');
  assert.doesNotMatch(text, /tok\/s|tokens per second/i, 'no speed figure anywhere in the copy');
});

// ── responsive and motion ───────────────────────────────────────────────────

const CSS_FILES = [PAGE, TEAM_BOARD, SLOT_VERSUS, TOUR, DEVICE_SHOT, COMPARE_TABLE, FAQ_COMPONENT];

/** `{ selector, body }` for each rule in a stylesheet, with media blocks flattened into `narrow`. */
function rulesOf(text) {
  const css = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const narrow = [...css.matchAll(/@media \(max-width: \d+px\) \{([\s\S]*?\n {2}\})\n/g)].map((m) => m[1]).join('\n');
  const wide = css.replace(/@media[^{]*\{[\s\S]*?\n {2}\}\n/g, '');
  const parse = (block) => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  return { wide: parse(wide), narrow: parse(narrow) };
}

test('every multi-column grid collapses on a narrow screen', async () => {
  for (const file of CSS_FILES) {
    const { wide, narrow } = rulesOf(await source(file));
    for (const { selector, body } of wide) {
      const tracks = body.match(/grid-template-columns:\s*([^;]+)/)?.[1].trim();
      if (!tracks) continue;
      // One track, or a fixed icon column beside flexible text, needs no breakpoint.
      const columns = tracks.match(/repeat\((\d+)/) ? Number(tracks.match(/repeat\((\d+)/)[1]) : tracks.split(/\s+(?![^(]*\))/).length;
      if (columns < 2 || /^\d+px minmax\(0, 1fr\)( auto)?$/.test(tracks)) continue;
      const names = selector.split(',').map((s) => s.trim());
      for (const name of names) {
        const reset = narrow.some((r) => r.selector.split(',').map((s) => s.trim()).includes(name) && /grid-template-columns/.test(r.body));
        assert.ok(reset, `${file}: ${name} (${tracks}) has no narrow-screen rule`);
      }
    }
  }
});

test('the plain and the named comparison scroll inside their wrappers', async () => {
  const page = await source(PAGE);
  assert.match(page, /\.cmp-wrap \{[^}]*overflow-x: auto/);
  assert.match(await source(COMPARE_TABLE), /\.tbl-wrap \{[^}]*overflow-x: auto/);
});

test('motion stops under prefers-reduced-motion', async () => {
  for (const file of [TEAM_BOARD, SLOT_VERSUS]) {
    assert.match(await source(file), /@media \(prefers-reduced-motion: reduce\)/, `${file} has a reduced-motion rule`);
  }
  assert.match(await source(TEAM_BOARD), /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return/, 'the hero picture does not cycle');
  assert.match(await source(SLOT_VERSUS), /animation: none/);
});

test('status dots follow the dashboard semantics, in tokens', async () => {
  const board = await source(TEAM_BOARD);
  // Ready is amber, answering is green with a halo, as on the dashboard.
  assert.match(board, /\.st-ready i \{\s*background: var\(--hal0-accent\)/);
  assert.match(board, /\.st-busy i \{\s*background: var\(--hal0-ok\);\s*box-shadow: 0 0 0 4px var\(--hal0-ok-glow\)/);
  for (const file of [TEAM_BOARD, SLOT_VERSUS, TOUR]) {
    assert.ok(!/#[0-9a-f]{6}\b/i.test((await source(file)).match(/<style>[\s\S]*<\/style>/)[0]), `${file} uses tokens, not hex colours`);
  }
});
