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
    const onDisk = await exists(`public/screenshots/${shot.file}.png`);
    assert.equal(!!shot.todo, !onDisk, `${shot.file}: todo flag must match the file on disk`);
    assert.ok(shot.alt && shot.caption, `${shot.file} has alt text and a caption`);
  }
  const todo = CONSOLE_SHOTS.filter((s) => s.todo).map((s) => s.file).sort();
  assert.deepEqual(todo, ['approvals-inbox', 'dock-gpu', 'image-gen-models', 'openwebui-picker', 'overview-now']);
  const overview = CONSOLE_SHOTS.find((s) => s.file === 'overview-now');
  assert.match(overview.caption, /preview/i, 'nightly-only surface is labelled preview');
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

test('ConsoleShot renders a TODO(shots) comment and only real 2x candidates', async () => {
  const shot = await source('src/components/landing/ConsoleShot.astro');
  assert.ok(shot.includes('<!-- TODO(shots): ${shot.file} -->'), 'comment names the file');
  assert.match(shot, /existsSync/, 'srcset checks the @2x file exists');
});

test('the ld+json FAQPage mirrors the visible questions', { ...skipUnbuilt, todo: built && 'wired in C3' }, () => {
  const scripts = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'exactly one ld+json script');
  const graph = JSON.parse(scripts[0][1])['@graph'];
  const pages = graph.filter((node) => node['@type'] === 'FAQPage');
  assert.equal(pages.length, 1, 'one FAQPage node');
  const summaries = [...html.matchAll(/<summary[^>]*>([^<]*)<\/summary>/g)].map((m) => m[1].trim());
  assert.deepEqual(pages[0].mainEntity.map((q) => q.name), summaries);
  assert.equal(summaries.length, 7);
});
