// scripts/test/landing-page.test.mjs
//
// Guards the slots-first landing page. Source assertions always run; the
// assertions on the built page skip with a visible message when dist/ is
// absent (CI always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);
const source = (path) => readFile(new URL(path, root), 'utf8');

const builtPath = 'dist/client/index.html';
const built = await exists(builtPath);
const skipUnbuilt = { skip: !built && 'run npm run build first' };
const html = built ? await source(builtPath) : '';

const SLOT_BOARD = 'src/components/landing/SlotBoard.astro';

// ── C1: slot board ──────────────────────────────────────────────────────────

test('SlotBoard replaces LiveArtifact', async () => {
  assert.ok(await exists(SLOT_BOARD), `${SLOT_BOARD} exists`);
  assert.ok(!(await exists('src/components/landing/LiveArtifact.astro')), 'LiveArtifact.astro is gone');
});

test('status dots follow the dashboard semantics, in tokens', async () => {
  const board = await source(SLOT_BOARD);
  assert.match(board, /\.sdot\.serving\s*\{[^}]*var\(--hal0-ok\)/, 'serving is --hal0-ok');
  assert.match(board, /\.sdot\.ready\s*\{[^}]*var\(--hal0-accent\)/, 'ready is --hal0-accent');
  assert.match(board, /\.sdot\.warming\s*\{[^}]*var\(--hal0-warn\)/, 'warming is --hal0-warn');
  assert.match(board, /\.sdot\.offline\s*\{[^}]*var\(--hal0-fg-ghost\)/, 'offline is --hal0-fg-ghost');
  assert.ok(!/#6fcf97/i.test(board), 'no literal green');
});

test('every picker button announces a listbox', async () => {
  const board = await source(SLOT_BOARD);
  const buttons = board.match(/<button[^>]*class="rsel"[^>]*>/g) ?? [];
  assert.ok(buttons.length > 0, 'the board has at least one picker button');
  for (const button of buttons) {
    assert.match(button, /aria-haspopup="listbox"/, button);
  }
});

test('the swap script honours reduced motion and keeps the honest lines', async () => {
  const board = await source(SLOT_BOARD);
  assert.match(board, /prefers-reduced-motion/, 'script checks prefers-reduced-motion');
  assert.match(board, /reduced \? 50 : 1500/, 'warming lasts 1500 ms, 50 ms under reduced motion');
  assert.match(board, /clients unchanged/, 'footer line');
  assert.match(board, /same ids as before the swap/, 'readout line');
  assert.match(board, /✓ no client reconfigured/, 'flash line');
  assert.match(board, /503 with Retry-After/, 'names what clients get during the reload');
  assert.ok(!/Math\.random/.test(board), 'no invented live numbers');
  assert.ok(!/\.className\s*=/.test(board), 'className would drop the scoped-style class');
});

test('BOARD_SLOTS carries the four slots with real picks', async () => {
  const { BOARD_SLOTS, BOARD_CLIENTS } = await import(new URL('src/data/slot-board.ts', root));
  assert.deepEqual(BOARD_SLOTS.map((s) => s.name), ['agent', 'coder', 'embed', 'img']);
  const names = BOARD_SLOTS.flatMap((s) => s.models.map((m) => m.name));
  for (const seeded of ['Qwen3.8 27B (UD Q4_K_XL)', 'LFM2.5 2.6B (Q8_0)', 'Qwen3.5 0.8B (UD Q4_K_XL)']) {
    assert.ok(names.includes(seeded), `seeded default ${seeded} is on the board`);
  }
  for (const slot of BOARD_SLOTS) {
    for (const model of slot.models) {
      assert.equal(typeof model.gb, 'number', `${model.name} has a size`);
    }
  }
  assert.deepEqual(BOARD_CLIENTS, [
    { name: 'Open WebUI', target: 'agent, coder' },
    { name: 'Hermes', target: 'hal0/agent' },
    { name: 'pi', target: 'agent' },
    { name: 'Hindsight', target: 'hal0/memory' },
  ]);
});

test('the built landing renders the board', skipUnbuilt, () => {
  for (const name of ['agent', 'coder', 'embed', 'img']) {
    assert.match(html, new RegExp(`data-slot="${name}"`), `data-slot="${name}"`);
  }
  assert.ok(html.includes('GET /v1/models'), 'the /v1/models readout is on the page');
});

// ── C2: section data and components ─────────────────────────────────────────

const LANDING_DATA = 'src/data/landing.ts';
const COMPARE_TABLE = 'src/components/landing/CompareTable.astro';
const FAQ_COMPONENT = 'src/components/landing/Faq.astro';
const RELEASE_TEASER = 'src/components/landing/ReleaseTeaser.astro';
const COPY_FILES = [LANDING_DATA, COMPARE_TABLE, FAQ_COMPONENT, RELEASE_TEASER];

// What a reader can see: drop CSS (line-height: 1.5 is not a version) and comments
// (a doc path is not a claim).
const copyOf = (text) =>
  text
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const FORBIDDEN = ['unleash', 'seamless', 'revolutionary', 'supercharge', 'instantly', 'sandboxed', 'never leak'];

const FAQ_QUESTIONS = [
  'What is hal0?',
  'Do I need a Strix Halo machine?',
  'Is hal0 an Ollama alternative?',
  'Can I run several models at once?',
  'Does my data leave the machine?',
  'Is the API OpenAI-compatible?',
  'Which GPUs and NPUs work?',
];

test('FAQ has the seven questions with short answers', async () => {
  const { FAQ } = await import(new URL(LANDING_DATA, root));
  assert.equal(FAQ.length, 7);
  assert.deepEqual(FAQ.map((f) => f.q), FAQ_QUESTIONS);
  for (const { q, a } of FAQ) {
    assert.ok(a.length < 420, `answer to "${q}" is ${a.length} characters`);
    assert.ok(!/[<`]/.test(a), `answer to "${q}" is plain text, so the schema can reuse it`);
  }
});

test('compare table has nine rows of five cells, each row sourced', async () => {
  const { COMPARE_COLUMNS, COMPARE_ROWS } = await import(new URL(LANDING_DATA, root));
  assert.deepEqual(COMPARE_COLUMNS, ['hal0', 'Ollama', 'LM Studio', 'llama-swap', 'Lemonade']);
  assert.equal(COMPARE_ROWS.length, 9);
  for (const row of COMPARE_ROWS) {
    assert.equal(row.cells.length, 5, row.label);
  }

  const data = await source(LANDING_DATA);
  const block = data.slice(data.indexOf('COMPARE_ROWS'));
  const sources = block.match(/\/\/ source: S\d+/g) ?? [];
  assert.equal(sources.length, COMPARE_ROWS.length, 'one // source: S<n> comment per row');
});

test('the compare table says what the research could not confirm', async () => {
  const { COMPARE_ROWS } = await import(new URL(LANDING_DATA, root));
  const cell = (label, column) =>
    COMPARE_ROWS.find((r) => r.label === label).cells[column];
  // competitive.md marks these "unverified" or "none found", not a flat "no".
  assert.equal(cell('Admin plane as MCP', 1), 'none found');
  assert.equal(cell('Memory bundled', 1), 'none found');
  assert.equal(cell('Voice + images, one API', 1), 'none found');
  assert.match(cell('Strix Halo + NPU', 1), /NPU not found/);
  // Ollama keeps several models resident; the old "one at a time" was wrong.
  assert.equal(cell('Models resident by default', 1), 'up to 3 per GPU');
});

test('site copy avoids the forbidden words, version numbers and em-dash asides', async () => {
  for (const file of COPY_FILES) {
    const text = await source(file);
    for (const word of FORBIDDEN) {
      assert.ok(!text.toLowerCase().includes(word), `${file} contains "${word}"`);
    }
    assert.ok(!text.includes('—'), `${file} contains an em dash`);
    // SD 1.5 is a model family, not a hal0 version.
    const prose = copyOf(text).replaceAll('SD 1.5', '');
    assert.ok(!/\b\d+\.\d+\.\d+\b|\bv?1\.\d\b|\brc\b|\bGA\b|new in\b/.test(prose), `${file} names a version`);
  }
});

test('copy keeps the claims the product inventory requires', async () => {
  const data = await source(LANDING_DATA);
  assert.match(data, /restart/, 'pi needs a restart for new slots');
  assert.match(data, /GPU chat slots pause/, 'image generation pauses GPU chat slots');
  assert.match(data, /unless you connect an upstream/, 'the privacy frame');
  assert.match(data, /key auth/, 'the LAN note');
  assert.match(data, /Key auth covers the API only/, 'Open WebUI and the ComfyUI editor sit outside hal0 auth');
  assert.match(data, /503 with Retry-After/, 'what a reload costs');
  assert.ok(!/nothing else leaves/.test(data), 'no universal "nothing leaves" claim');
  assert.match(data, /One API, one slot per medium/, 'routing is by endpoint and model name');
  assert.match(data, /never reads a prompt/, 'no content-aware router');
});

test('research appears only as a custom slot', async () => {
  const { IDEA_COLUMNS } = await import(new URL(LANDING_DATA, root));
  const data = copyOf(await source(LANDING_DATA));
  assert.equal((data.match(/research/g) ?? []).length, 1, 'one mention');
  assert.match(IDEA_COLUMNS[0].examples, /custom: research/);
});

test('every console shot exists on disk or is marked todo', async () => {
  const { CONSOLE_SHOTS } = await import(new URL(LANDING_DATA, root));
  for (const shot of CONSOLE_SHOTS) {
    // A todo shot may have a stale file on disk; a shot we render must have one.
    if (!shot.todo) {
      assert.ok(await exists(`public/screenshots/${shot.file}.png`), `${shot.file}.png is on disk`);
    }
    assert.ok(shot.alt && shot.caption, `${shot.file} has alt text and a caption`);
  }
  const todo = CONSOLE_SHOTS.filter((s) => s.todo).map((s) => s.file).sort();
  assert.deepEqual(todo, ['approvals-inbox', 'image-gen-models', 'openwebui-picker']);
  const overview = CONSOLE_SHOTS.find((s) => s.file === 'dashboard-overview');
  assert.match(overview.caption, /preview/i, 'nightly-only surface is labelled preview');
  for (const file of ['slot-edit-drawer', 'mcp-tab']) {
    assert.match(CONSOLE_SHOTS.find((s) => s.file === file).caption, /nightly/i, `${file} names the channel`);
  }
});

test('ReleaseTeaser reads the tagged release and links to /releases', async () => {
  const teaser = await source(RELEASE_TEASER);
  assert.match(teaser, /latestTagged/);
  assert.match(teaser, /releaseHighlights/);
  assert.match(teaser, /href="\/releases"/);
  assert.ok(!teaser.includes('href="/changelog'), 'no link to the old route');
});

test('Faq renders one <details> per item from the shared data', async () => {
  const faq = await source(FAQ_COMPONENT);
  assert.match(faq, /FAQ\.map/);
  assert.match(faq, /<details/);
  assert.match(faq, /<summary>\{[^}]*q[^}]*\}<\/summary>/);
});

test('ConsoleShot renders a TODO(shots) comment or the shared Shot', async () => {
  const shot = await source('src/components/landing/ConsoleShot.astro');
  assert.ok(shot.includes('<!-- TODO(shots): ${shot.file} -->'), 'comment names the file');
  assert.match(shot, /<Shot\b/, 'real shots go through src/components/Shot.astro');
  assert.ok(!/<img\b/.test(shot), 'no bare screenshot <img>');
});

test('the ld+json FAQPage mirrors the visible questions', skipUnbuilt, () => {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'exactly one ld+json script');
  const graph = JSON.parse(scripts[0][1])['@graph'];
  const pages = graph.filter((node) => node['@type'] === 'FAQPage');
  assert.equal(pages.length, 1, 'one FAQPage node');
  const summaries = [...html.matchAll(/<summary[^>]*>([^<]*)<\/summary>/g)].map((m) => m[1].trim());
  assert.deepEqual(pages[0].mainEntity.map((q) => q.name), summaries);
  assert.equal(summaries.length, 7);
});

// ── C3: the page ────────────────────────────────────────────────────────────

const PAGE = 'src/pages/index.astro';
const main = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';

function visibleWords(fragment) {
  return fragment
    // The picker lists start `hidden`; a reader does not see them until they open one.
    .replace(/<ul[^>]*\shidden[^>]*>[\s\S]*?<\/ul>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
}

test('the page has one h1, the operator-chosen one', skipUnbuilt, () => {
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.equal(h1s.length, 1);
  assert.equal(h1s[0][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 'Own Your Inference');
});

test('prose keeps its spaces around inline tags', skipUnbuilt, () => {
  // Astro's HTML compression drops a line break between text and an inline tag.
  assert.match(html, /each in a <strong[^>]*>named slot<\/strong>/);
  assert.ok(!/[a-z]<strong/.test(main), 'no word runs straight into a <strong>');
});

test('title and description come from the SEO audit', skipUnbuilt, () => {
  assert.ok(html.includes('<title>hal0: Self-Hosted Local AI Server for AMD Strix Halo</title>'));
  assert.ok(
    html.includes(
      'content="Run LLMs, speech and images on your own hardware. Open-source, OpenAI-compatible local AI server for AMD Strix Halo (Ryzen AI Max+ 395) and Linux."',
    ),
  );
});

test('sections run in the spec order', skipUnbuilt, () => {
  const order = ['idea', 'swap', 'privacy', 'wired', 'memory', 'console', 'hardware', 'compare', 'benchmarks', 'releases', 'faq', 'get'];
  const at = order.map((id) => {
    const i = html.search(new RegExp(`<section[^>]*\\sid="${id}"`));
    assert.ok(i >= 0, `section #${id} is present`);
    return i;
  });
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'section ids are in order');
});

test('the key headings are on the page', skipUnbuilt, () => {
  for (const heading of [
    'One giant model is the wrong shape for a home box.',
    'Swap the model, keep the name.',
    'Your prompts stay on your box.',
    'One memory your agents share.',
  ]) {
    assert.ok(html.includes(heading), heading);
  }
});

test('every screenshot exists on disk or carries its TODO comment', skipUnbuilt, async () => {
  const referenced = new Set([...html.matchAll(/\/screenshots\/([\w-]+)(?:@2x)?\.png/g)].map((m) => m[1]));
  assert.ok(referenced.size >= 8, 'the page references the console shots');
  for (const name of referenced) {
    assert.ok(await exists(`public/screenshots/${name}.png`), `${name}.png is on disk`);
  }
  for (const name of ['openwebui-picker', 'image-gen-models', 'approvals-inbox']) {
    assert.ok(html.includes(`<!-- TODO(shots): ${name} -->`), `TODO comment for ${name}`);
    assert.ok(!referenced.has(name), `${name} has no <img> yet`);
  }
});

test('the page links /releases, not the old route', skipUnbuilt, () => {
  assert.ok(!/href="\/changelog/.test(main), 'no /changelog link in the page body');
  assert.match(main, /href="\/releases"/);
});

test('every internal href in the page body resolves', skipUnbuilt, async () => {
  const config = await source('astro.config.mjs');
  const paths = new Set(
    [...main.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]).filter((p) => p !== '/'),
  );
  assert.ok(paths.size > 0);
  for (const path of paths) {
    const bare = path.replace(/\/$/, '');
    const resolves =
      (await exists(`dist/client${bare}/index.html`)) ||
      (await exists(`dist/client${bare}`)) ||
      config.includes(`'${bare}'`);
    assert.ok(resolves, `${path} resolves`);
  }
});

test('visible copy stays between 1600 and 2800 words', skipUnbuilt, () => {
  const count = visibleWords(main).length;
  assert.ok(count >= 1600 && count <= 2800, `visible word count is ${count}`);
});

test('no inline style forces a width wider than a phone', skipUnbuilt, () => {
  for (const [, style] of html.matchAll(/\sstyle="([^"]*)"/g)) {
    const m = style.match(/min-width:\s*(\d+)px/);
    if (m) assert.ok(Number(m[1]) <= 360, `inline min-width ${m[1]}px`);
  }
});

test('the structured data is complete and comes through the layout', skipUnbuilt, () => {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'exactly one ld+json script');
  const graph = JSON.parse(scripts[0][1])['@graph'];
  const app = graph.find((node) => node['@type'] === 'SoftwareApplication');
  assert.ok(app, 'SoftwareApplication node');
  assert.match(app.softwareVersion, /^\d+\.\d+\.\d+/, 'version from latestTagged');
  assert.equal(app.softwareRequirements, 'Linux x86_64, Python 3.12+, systemd, podman');
  assert.equal(app.releaseNotes, 'https://hal0.dev/releases/');
  assert.equal(app.installUrl, 'https://hal0.dev/install.sh');
  assert.deepEqual(app.publisher, { '@id': 'https://hal0.dev/#org' });
  assert.ok(Array.isArray(app.featureList) && app.featureList.length > 0, 'featureList');
  assert.match(app.image, /^https:\/\/hal0\.dev\/screenshots\/.+\.png$/);
  assert.ok(Array.isArray(app.screenshot) && app.screenshot.length >= 8, 'screenshot list');
  for (const url of app.screenshot) {
    assert.match(url, /^https:\/\/hal0\.dev\/screenshots\/.+\.png$/);
  }
});

test('the old sections are gone', async () => {
  const page = await source(PAGE);
  assert.ok(!page.includes('LiveArtifact'), 'no live artifact');
  assert.ok(!/type="application\/ld\+json"/.test(page), 'the page renders no ld+json of its own');
  for (const removed of ['const runners', 'const tiers', 'const features', 'const whatsNew', 'id="stack"', 'id="use-cases"', 'feat-grid', 'matrix-row']) {
    assert.ok(!page.includes(removed), `${removed} is removed`);
  }
});

test('copy no longer overclaims what Hermes does alone', async () => {
  const card = await source('src/components/HermesCard.astro');
  assert.ok(!card.includes('unattended for hours'), 'the unattended line is gone');
  assert.ok(!card.includes('never relearns'), 'the "never relearns" line is gone');
});

test('page copy avoids the forbidden words and version numbers', async () => {
  const page = copyOf(await source(PAGE));
  for (const word of FORBIDDEN) {
    assert.ok(!page.toLowerCase().includes(word), `index.astro contains "${word}"`);
  }
  assert.ok(!page.includes('—'), 'no em dash in page copy');
  assert.ok(!/\b1\.\d+(\.\d+)?\b|\brc\b|\bGA\b|new in\b/.test(page), 'no hal0 version in page copy');
});

// ── C4: responsive and motion ───────────────────────────────────────────────

const CONSOLE_SHOT = 'src/components/landing/ConsoleShot.astro';
const BENCH = 'src/components/landing/BenchHighlights.astro';
const CSS_FILES = [PAGE, SLOT_BOARD, COMPARE_TABLE, FAQ_COMPONENT, RELEASE_TEASER, CONSOLE_SHOT, BENCH];

function styleOf(file) {
  return [...file.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Splits CSS into top-level { head, body } blocks, leaving nested bodies intact. */
function blocks(css) {
  const found = [];
  let depth = 0;
  let start = 0;
  let head = '';
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      if (depth === 0) {
        head = css.slice(start, i).trim();
        start = i + 1;
      }
      depth += 1;
    } else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        found.push({ head, body: css.slice(start, i) });
        start = i + 1;
      }
    } else if (css[i] === ';' && depth === 0) {
      start = i + 1;
    }
  }
  return found;
}

/** Number of tracks in a grid-template-columns value. */
function trackCount(value) {
  const repeat = value.match(/^repeat\(\s*(\d+)/);
  if (repeat) return Number(repeat[1]);
  let depth = 0;
  let tracks = 0;
  let inToken = false;
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) inToken = false;
    else if (!inToken) {
      tracks += 1;
      inToken = true;
    }
  }
  return tracks;
}

const columnsOf = (body) => body.match(/grid-template-columns:\s*([^;]+);?/)?.[1].trim();

function narrowRules(css) {
  const rules = [];
  for (const { head, body } of blocks(css)) {
    if (/^@media[^{]*max-width/.test(head)) {
      for (const rule of blocks(body)) rules.push(rule);
    }
  }
  return rules;
}

const collapses = (selector, tracks, rules) =>
  rules.some(({ head, body }) => {
    const columns = columnsOf(body);
    return columns && head.split(',').map((s) => s.trim()).includes(selector) && trackCount(columns) < tracks;
  });

test('every repeat() grid in the landing CSS collapses on a narrow screen', async () => {
  for (const path of CSS_FILES) {
    const css = styleOf(await source(path));
    const rules = narrowRules(css);
    for (const { head, body } of blocks(css)) {
      if (head.startsWith('@')) continue;
      const columns = columnsOf(body);
      if (!columns || !columns.startsWith('repeat(')) continue;
      for (const selector of head.split(',').map((s) => s.trim())) {
        assert.ok(collapses(selector, trackCount(columns), rules), `${path}: ${selector} (${columns}) has no narrower rule`);
      }
    }
  }
});

test('the two-column layout grids collapse too', async () => {
  const css = styleOf(await source(PAGE));
  const rules = narrowRules(css);
  for (const selector of ['.sec-head', '.hero-grid', '.swap-grid', '.priv', '.wired-grid', '.mem-grid']) {
    assert.ok(collapses(selector, 2, rules), `${selector} stays two-column on a phone`);
  }
});

test('breakpoints follow the mockup', async () => {
  const css = styleOf(await source(PAGE));
  for (const width of [1080, 720, 560]) {
    assert.ok(new RegExp(`@media \\(max-width:\\s*${width}px\\)`).test(css), `${width}px breakpoint`);
  }
});

test('the compare table scrolls inside its wrapper', async () => {
  const css = styleOf(await source(COMPARE_TABLE));
  assert.match(css, /\.tbl-wrap\s*\{[^}]*overflow-x:\s*auto/);
});

test('motion stops under prefers-reduced-motion', async () => {
  for (const path of [PAGE, SLOT_BOARD]) {
    assert.match(styleOf(await source(path)), /@media \(prefers-reduced-motion: reduce\)/, path);
  }
});

// ── after the rebase: shared helpers from the releases and SEO lanes ────────

test('ReleaseTeaser uses the shared highlights helper', async () => {
  const teaser = await source(RELEASE_TEASER);
  assert.match(teaser, /import \{[^}]*releaseHighlights[^}]*\} from '..\/..\/lib\/changelog\.js'/);
  assert.ok(!teaser.includes('releaseHighlightsFallback'), 'the local fallback is gone');
  assert.ok(!teaser.includes('topLevelItems'), 'list parsing lives in the shared helper');
});

test('the page takes its site constants from src/lib/seo.ts', async () => {
  const page = await source(PAGE);
  assert.match(page, /import \{[^}]*ORG_ID[^}]*SITE_URL[^}]*\} from '..\/lib\/seo/);
  assert.ok(!page.includes("'https://hal0.dev'"), 'no second copy of the site URL');
});

test('the publisher reference resolves inside the graph', skipUnbuilt, () => {
  const script = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
  const graph = JSON.parse(script[1])['@graph'];
  const app = graph.find((node) => node['@type'] === 'SoftwareApplication');
  assert.ok(graph.some((node) => node['@id'] === app.publisher['@id']), 'an Organization node carries that @id');
});

// ── review fix round 1: what the claims audit found ─────────────────────────

test('a default install is described as it behaves', skipUnbuilt, () => {
  // Only `brain` gets a model on a default install; the agent and image offers default to no.
  assert.ok(html.includes('One install brings up the API, a chat UI, an agent and memory, already pointed at each other, and pulls a small model for the steward. You pick the models for the other slots from the console.'));
  assert.ok(html.includes('One command on a fresh Linux box brings up the API, the chat UI, the agent and memory. Then pick models for your slots from the console.'));
  assert.ok(!html.includes('the slots, a chat UI, an agent, image generation'), 'old section 5 lede');
  assert.ok(!html.includes('the slots, the chat UI, the agent, image generation'), 'old CTA');
});

test('wired tiles claim only what works out of the box', async () => {
  const data = copyOf(await source(LANDING_DATA));
  assert.ok(data.includes('Voice is wired from the start; document search on hal0 embeddings and the ComfyUI image button switch on once embed and img have models.'));
  assert.ok(data.includes('renders SDXL, SD 1.5 or Qwen-Image'), 'names models the API renders at the latest tag');
  assert.ok(!/Flux/.test(data), 'Flux is not in the catalogue at the latest tag');
});

test('the structured data does not promise an image engine on install', async () => {
  const page = await source(PAGE);
  assert.ok(!page.includes('Hermes and ComfyUI configured on install'));
});

test('only the slots that are on loopback are called loopback', async () => {
  const data = copyOf(await source(LANDING_DATA));
  assert.ok(data.includes('Every model runs in a container on your box. Chat, embedding and speech slots sit on loopback ports behind the API.'));
  assert.ok(!data.includes('on a loopback port'), 'the img slot listens on the LAN by default');
  assert.ok(data.includes('The API, Open WebUI and the ComfyUI editor serve your network with no login and no TLS by default.'));
});

test('a pending shot renders only its TODO comment', skipUnbuilt, async () => {
  assert.ok(!/screenshot pending/i.test(html), 'no visible pending box');
  const shot = await source(CONSOLE_SHOT);
  assert.ok(!/\.placeholder|\.pending|role="img"/.test(shot), 'placeholder markup and CSS are gone');
  const { CONSOLE_SHOTS } = await import(new URL(LANDING_DATA, root));
  const figures = html.match(/<figure/g) ?? [];
  assert.equal(figures.length, CONSOLE_SHOTS.filter((s) => !s.todo).length, 'one figure per real shot');
});

test('telemetry and swap claims are scoped to what was audited', async () => {
  const data = copyOf(await source(LANDING_DATA));
  assert.ok(data.includes('Apache-2.0 · none; console checks updates'), 'hal0 compare cell names its own checks');
  assert.match(data, /own code has no telemetry\./);
  assert.ok(!data.includes('ships no telemetry code'));
  const page = await source(PAGE);
  assert.match(page, /every\s+chat\s+client\s+keeps\s+the\s+config\s+it\s+already\s+has\./);
  const board = await source('src/data/slot-board.ts');
  assert.ok(board.includes("note: 'feeds Open WebUI document search',"), 'no wiring from embed to memory');
  const card = await source('src/components/HermesCard.astro');
  assert.ok(card.includes('Connect Telegram or Discord through its gateway.'));
  assert.ok(!card.includes('Reach it from any'));
});

test('the board and the Hermes card pass the forbidden-word scan', async () => {
  for (const file of [SLOT_BOARD, 'src/data/slot-board.ts', 'src/components/HermesCard.astro']) {
    const text = (await source(file)).toLowerCase();
    for (const word of FORBIDDEN) {
      assert.ok(!text.includes(word), `${file} contains "${word}"`);
    }
  }
});

test('review minors stay fixed', skipUnbuilt, async () => {
  assert.ok(!main.includes('will say when it lands'), 'no promise about the next sweep');
  const { FAQ } = await import(new URL(LANDING_DATA, root));
  assert.ok(FAQ[1].a.endsWith('Linux x86_64 with systemd and podman is the hard requirement.'));
  const page = await source(PAGE);
  assert.ok(!page.includes('unified memory <b>'), 'no stale memory figure in the ticker');
  const board = await source(SLOT_BOARD);
  assert.match(board, /data-swapnote><\/span>/, 'the note is empty until the script runs');
  assert.ok(board.includes("swapnote.textContent = 'pick a model above to swap it'"), 'the script sets it');
  assert.match(board, /BOARD_MODEL_IDS\.map[^\n]*\n\s*<span>…<\/span>/, 'the readout admits it is partial');
});

test('community and bench blocks carry their context', async () => {
  const profiles = await source('src/components/landing/FeaturedProfiles.astro');
  assert.ok(profiles.includes('record.profile.summary'), 'summary is back');
  assert.ok(!profiles.includes('args.raw'), 'flags stay off');
  const bench = await source(BENCH);
  assert.match(bench, /fastest\??\.(id|name)/, 'the fastest figure names its model');
});

test('console shots keep their frame styles', async () => {
  const css = styleOf(await source(CONSOLE_SHOT));
  assert.match(css, /:global\(\.shot\)\s*\{[^}]*width:\s*100%/, 'frames fill their column');
  assert.match(css, /:global\(img\)\s*\{[^}]*width:\s*100%[^}]*aspect-ratio:\s*1440 \/ 900[^}]*object-fit:\s*cover/, 'shots crop to one frame');
  assert.match(css, /\.contain :global\(img\)\s*\{[^}]*object-fit:\s*contain/, 'odd-sized shots fit inside it');
});

test('the built landing serves console shots as pictures', skipUnbuilt, async () => {
  const { CONSOLE_SHOTS } = await import(new URL(LANDING_DATA, root));
  const pictures = html.match(/<figure\b[^>]*\bclass="shot\b[^"]*"[^>]*>\s*<picture\b/g) ?? [];
  assert.equal(pictures.length, CONSOLE_SHOTS.filter((s) => !s.todo).length, 'every real shot is a <picture>');
  assert.match(html, /<source type="image\/avif"[^>]*screenshots\/slots-inference/, 'AVIF is offered');
});

test('the hero lede and the Hermes alt carry the reviewed wording', async () => {
  const page = await source(PAGE);
  assert.match(page, /from a dropdown and\s+your apps keep the name they already use\./);
  assert.ok(!page.includes('nothing else changes'));
  const card = await source('src/components/HermesCard.astro');
  assert.ok(card.includes('alt="Hermes, the bundled hal0 agent"'));
});

test('the dock strip keeps its own shape in the console grid', async () => {
  const { CONSOLE_SHOTS } = await import(new URL(LANDING_DATA, root));
  assert.equal(CONSOLE_SHOTS.find((s) => s.file === 'dock-gpu').natural, true, 'dock-gpu is a strip');
  const css = await source(CONSOLE_SHOT);
  assert.match(css, /\.natural :global\(img\)\s*\{[^}]*aspect-ratio:\s*auto/, 'a natural shot drops the 1440 / 900 frame');
  assert.ok(!/\.natural[^{]*\{[^}]*object-fit/.test(css), 'nothing crops a natural shot');
});
