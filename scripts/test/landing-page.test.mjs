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
