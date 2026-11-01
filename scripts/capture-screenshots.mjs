#!/usr/bin/env node
/**
 * capture-screenshots.mjs — regenerate the dashboard screenshots in
 * public/screenshots/ from a live hal0 instance.
 *
 * The dashboard is a React SPA with hash routes (#dashboard, #slots, …) and
 * is dark-by-default, so we capture at a fixed 1440×900 dark viewport for a
 * consistent set. Modelled on the product repo's Playwright e2e setup
 * (ui/tests/e2e/specs/slot-indicator-live-screenshot.spec.ts).
 *
 * Usage (Docker — host Chromium usually lacks system libs):
 *   HAL0_BOX_IP=<ip> scripts/capture-screenshots.sh [--out <dir>] [shot-name ...]
 * runs this script inside mcr.microsoft.com/playwright:v1.64.0-noble on the
 * host network with `--add-host hal0.local:<ip>` and
 * HAL0_DASHBOARD_URL=http://hal0.local:8080.
 * Without Docker: `npx playwright install chromium`, then
 *   HAL0_DASHBOARD_URL=http://your-host:8080 npm run capture:screenshots
 *
 * `--out <dir>` writes the PNGs there instead of public/screenshots/, so a
 * sweep can be reviewed in a scratch directory before anything is copied in.
 * Open WebUI shots (openwebui-*) load HAL0_OPENWEBUI_URL, which defaults to the
 * dashboard host on port 3001.
 *
 * Every shot is written twice: <name>.png at 1× and <name>@2x.png at
 * deviceScaleFactor 2, which is what the retina variants already in the
 * directory are.
 *
 * The base URL is NEVER hard-coded to a private host — pass it via
 * HAL0_DASHBOARD_URL (default http://localhost:8080). To keep host names out
 * of the captured pixels, reach the box by a neutral name (hal0.local) so any
 * endpoint shown in the UI reads `hal0.local`. Without root, map the name in
 * Chromium itself via HAL0_CHROMIUM_ARGS (launch args, split on whitespace
 * outside quotes; a JSON array is accepted too):
 *   HAL0_CHROMIUM_ARGS='--host-resolver-rules="MAP hal0.local <ip>"'
 *
 * The capture box must show NO private hostnames, keys, or personal slot and
 * model names: seed slots and public models only. Every PNG is reviewed before
 * it is committed.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/screenshots');
const BASE = process.env.HAL0_DASHBOARD_URL || 'http://localhost:8080';

/**
 * Where Open WebUI answers. HAL0_OPENWEBUI_URL wins; otherwise it is the
 * dashboard host on :3001, so a box reached as hal0.local needs no extra
 * setting (and no private hostname lands in the pixels).
 */
export function openWebUiUrl(env = process.env, base = BASE) {
  const set = (env.HAL0_OPENWEBUI_URL ?? '').trim();
  if (set) return set;
  const u = new URL(base);
  u.port = '3001';
  return u.origin;
}
const OPENWEBUI = openWebUiUrl();

/** `slot-card.png` + `@2x` → `slot-card@2x.png`. */
export function variantFile(file, suffix) {
  return file.replace(/\.png$/, `${suffix}.png`);
}

const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 1600; // SSE-backed panels keep repainting for ~1s after load

// 1× writes `<name>.png`, 2× writes `<name>@2x.png` — the retina variants the
// docs and marketing pages reference via srcset.
const SCALES = [
  { factor: 1, suffix: '' },
  { factor: 2, suffix: '@2x' },
];

/**
 * A shot is one output file:
 *
 *   name    output basename, kebab-case; also used by docs/marketing `src`s
 *   file    the 1× output file, always `<name>.png` (filled in below, never
 *           set by hand). The 2× variant is `<name>@2x.png`
 *   route   hash route to load (the SPA is remounted for every shot)
 *   url     full URL to load instead of a dashboard route, for a surface on
 *           another origin (Open WebUI on :3001). Such a shot skips the
 *           dashboard sign-in and banner handling
 *   act     optional async (page) => {} that drives the UI into an interaction
 *           state — open a drawer, switch a sub-view, scroll a section up
 *   expect  selector that must be visible before we shoot. This is the guard
 *           against shipping a loading spinner or an empty frame: if the
 *           surface never renders, the shot fails loudly instead of quietly
 *           writing a blank PNG over a good one
 *   clip    selector to crop to, for the small element shots the docs embed
 *           inline (memory bar, Overview now band …)
 *   area    list of selectors; the shot is the union of their boxes plus `pad`
 *           px (default 12), for a card plus its open picker and the like
 *   viewport  {width,height} override for shots whose subject is taller than
 *           the default frame (drawers)
 *   settle  override for SETTLE_MS — how long to wait after the route loads
 *   after   extra ms to wait once `act` has run, for animations that only
 *           start on the interaction (a force-directed graph settling)
 *   skip    leave the shot out of a default sweep; naming it still runs it
 *   verify  true when a selector is a best guess that has not been checked
 *           against the dashboard source for the release being captured.
 *           Confirm it, then delete the flag
 */
const drawer = '.drawer.open .drawer-body';

/** act() helper: bring a section of a long view into frame. */
const scrollTo =
  (selector, block = 'center') =>
  async (page) => {
    await page.locator(selector).first().evaluate((el, b) => el.scrollIntoView({ block: b }), block);
    await page.waitForTimeout(400);
  };

/**
 * act() helper: pin the Memory bank workspace to the `agents` bank. Its facts
 * are about the runtime itself, so the frame stays on-product instead of
 * showing whatever the box's own project banks happen to hold. `settleMs` is
 * how long the bank's data gets to load before the shot moves on.
 */
const pinAgentsBank = async (page, settleMs = 1000) => {
  await page.selectOption('[data-testid="mv-bank-select"]', 'agents');
  await page.waitForTimeout(settleMs);
};

/**
 * act() helper: open the edit-a-copy drawer for the seed profile `agent`
 * (present on every install); fall back to the first seed's button.
 */
const openProfileCopy = async (page) => {
  const sel = '[data-testid="pf-btn-editcopy-agent"]';
  await page.waitForSelector('[data-testid^="pf-btn-editcopy-"]', { state: 'visible', timeout: 15_000 });
  const target = (await page.locator(sel).count())
    ? page.locator(sel)
    : page.locator('[data-testid^="pf-btn-editcopy-"]').first();
  await target.click();
};

/**
 * Split HAL0_CHROMIUM_ARGS into launch args. Quotes group an argument that
 * contains spaces (`--host-resolver-rules="MAP hal0.local 10.0.0.5"`) and are
 * stripped; a JSON array is passed through as-is.
 */
export function parseLaunchArgs(raw) {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) return JSON.parse(text).map(String);
  const args = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) args.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
    }
  }
  if (has || cur) args.push(cur);
  return args;
}

/**
 * Parse the command line: `--out <dir>` (or `--out=<dir>`) and positional shot
 * names, in any order. Keys appear only when given, so `--out /tmp/x` is
 * `{ out: '/tmp/x' }` and a bare sweep is `{}`. An option the script does not
 * know is an error rather than a shot name that silently matches nothing.
 */
export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a.startsWith('--out=')) {
      const value = a === '--out' ? argv[++i] : a.slice('--out='.length);
      if (!value || value.startsWith('--')) throw new Error('--out needs a directory');
      args.out = value;
    } else if (a.startsWith('--')) {
      throw new Error(`unknown option ${a}`);
    } else {
      (args.names ??= []).push(a);
    }
  }
  return args;
}

/**
 * A LAN-bound box with an admin key shows a login view to any off-box
 * browser. When HAL0_ADMIN_KEY is set, sign in with "remember me" so the
 * session cookie carries across the per-shot remounts; the key never lands
 * in a file or a pixel. Without the key the read-only view is used.
 */
async function loginIfAsked(page, route) {
  const input = page.locator('[data-testid="login-key-input"]');
  if (!(await input.isVisible().catch(() => false))) return;
  const key = process.env.HAL0_ADMIN_KEY;
  if (!key) {
    await page.click('[data-testid="login-view-read-only"]');
  } else {
    await input.fill(key);
    const remember = page.locator('[data-testid="login-remember"]');
    if (await remember.isVisible().catch(() => false)) await remember.check().catch(() => {});
    await page.click('[data-testid="login-submit"]');
  }
  await page.locator('[data-testid="login-view"]').waitFor({ state: 'detached', timeout: 15_000 });
  // The SPA may have swallowed the hash while the gate was up; reassert it.
  await page.goto(`/${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
}

/**
 * Union of the bounding boxes of `selectors` (first match each), grown by
 * `pad` px and clamped to the viewport. Used for the detail shots that need
 * two elements in frame (a slot card plus its open picker) or a little air
 * around one element.
 */
async function areaOf(page, selectors, pad = 12) {
  const vp = page.viewportSize();
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const sel of selectors) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) throw new Error(`area: ${sel} has no box`);
    x1 = Math.min(x1, box.x); y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.width); y2 = Math.max(y2, box.y + box.height);
  }
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(vp.width, x2 + pad); y2 = Math.min(vp.height, y2 + pad);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

const SHOT_DEFS = [
  // ── Overview ────────────────────────────────────────────────────────────
  {
    name: 'dashboard-overview',
    route: '#dashboard',
    // A slot segment in the memory bar means the slots query has landed. The
    // system segment (`.sys`) paints first, from hardware data, so waiting on
    // any `.ov-mem-seg` would pass on a frame whose slot list still says
    // loading and whose stat strip reads "—".
    expect: '.ov-mem-seg:not(.sys)',
    after: 1500,
  },
  {
    // The Overview "now" band: serving mode, live facts and the memory bar.
    // (`unified-memory-hero` was this same clip and is retired; its PNG stays
    // on disk for the post that still references it.)
    name: 'overview-now',
    route: '#dashboard',
    expect: '.ov-mem-seg:not(.sys)',
    clip: '.ov-now',
  },
  {
    // The ⌘K palette, cropped to its panel so the dashboard behind the
    // backdrop stays out of frame. CHECK THE PIXELS: it lists the box's slots
    // and models.
    name: 'command-palette',
    route: '#dashboard',
    act: async (page) => {
      // The global handler takes Ctrl or Meta; Ctrl works on every host OS.
      await page.keyboard.press('Control+k');
      await page.waitForSelector('.cp-input', { state: 'visible' });
    },
    expect: '.cp-input',
    area: ['.cp-shell'],
    pad: 24,
  },
  {
    // The header bell, open on its "needs attention" section. Needs one gated
    // tool call waiting on the box, or the popover reads "all clear".
    name: 'approvals-inbox',
    route: '#dashboard',
    act: async (page) => {
      await page.click('[data-testid="tb-bell"]');
      await page.waitForSelector('[data-testid="notif-pop"]', { state: 'visible' });
    },
    expect: '[data-testid="notif-sec-attention"]',
    area: ['[data-testid="notif-pop"]'],
    pad: 16,
  },
  {
    // The bottom dock expanded on its gpu tab. The tab only exists on a box
    // whose GPU is reporting, so a missing tab fails the shot loudly.
    name: 'dock-gpu',
    route: '#dashboard',
    act: async (page) => {
      if (!(await page.locator('[data-testid="dock-expanded"]').count())) {
        await page.click('[data-testid="dock-toggle"]');
      }
      await page.click('[data-testid="dock-tab-gpu"]');
    },
    expect: '[data-testid="dock-gpu"]',
    area: ['[data-testid="dock"]'],
    pad: 8,
  },

  // ── Slots ───────────────────────────────────────────────────────────────
  {
    name: 'slots-inference',
    route: '#slots',
    expect: '[data-testid="infer-slot-agent"]',
  },
  {
    name: 'slots-lifecycle',
    route: '#slots',
    // Scroll the slot grid up so the frame is state badges rather than
    // telemetry — every lifecycle state the box currently holds, side by side.
    act: scrollTo('[data-testid="infer-slots"]', 'start'),
    expect: '[data-testid="infer-slot-agent"]',
  },
  {
    name: 'npu-occupancy',
    route: '#slots',
    // The NPU occupancy card lives below the inference grid: XDNA duty cycle,
    // the tile probe, and the FLM trio that claims them.
    act: scrollTo('.npu-card', 'center'),
    expect: '.npu-card',
  },
  {
    name: 'hardware-metrics',
    route: '#slots',
    expect: '[data-testid="telemetry-header"]',
    clip: '[data-testid="telemetry-header"]',
  },
  {
    name: 'endpoints-tab',
    route: '#slots/endpoints',
    expect: 'text=Local endpoints',
  },
  {
    name: 'stacks-tab',
    route: '#slots/stacks',
    expect: '[data-testid="st-btn-new"]',
  },
  {
    name: 'runner-images',
    route: '#slots/runner-images',
    expect: '[data-testid="ri-family-strip"]',
  },
  {
    // The Engine pane. The bare `#slots/image` route opens Generate or Models,
    // whichever the installed models call for; the landing's catalogue shot is
    // image-gen-models.
    name: 'image-gen-comfyui',
    route: '#slots/image/engine',
    expect: '[data-testid="image-gen-pane"]',
  },
  {
    // Models sub-tab. The fit meter only renders while the image engine is
    // available, so an engine that is off fails this shot instead of
    // publishing a card without its verdict.
    name: 'image-gen-models',
    route: '#slots/image/models',
    expect: '[data-testid^="fit-meter-"]',
  },
  {
    name: 'image-gen-generate',
    route: '#slots/image/generate',
    expect: '[data-testid="gen-panel"]',
  },

  {
    name: 'slot-card',
    route: '#slots',
    act: scrollTo('[data-testid="infer-slot-agent"]', 'center'),
    expect: '[data-testid="infer-slot-agent"]',
    area: ['[data-testid="infer-slot-agent"]'],
    pad: 16,
  },
  {
    name: 'slot-profile-picker-open',
    route: '#slots',
    act: async (page) => {
      await page.click('[data-testid="infer-profile-agent"]');
      await page.waitForSelector('.rsel-listbox', { state: 'visible' });
    },
    expect: '.rsel-listbox',
    area: ['[data-testid="infer-slot-agent"]', '.rsel-listbox'],
    pad: 20,
    viewport: { width: 1440, height: 1180 },
  },
  {
    name: 'slot-model-picker-open',
    route: '#slots',
    act: async (page) => {
      await page.click('[data-testid="infer-model-agent"]');
      await page.waitForSelector('.rsel-listbox', { state: 'visible' });
    },
    expect: '.rsel-listbox',
    area: ['[data-testid="infer-slot-agent"]', '.rsel-listbox'],
    pad: 20,
    viewport: { width: 1440, height: 1180 },
    after: 1200, // opening the picker fires a feasibility request
  },

  // ── Slot editor (drawer) ────────────────────────────────────────────────
  // The slot drawer is route-addressable: #slots/<name> opens it over the
  // slots view, which is also what clicking a slot row does.
  // (`slot-detail` is dropped: the docs/blog/landing use `slot-drawer`.)
  {
    name: 'slot-drawer',
    route: '#slots/agent',
    act: scrollTo('[data-testid="slot-profile"]'),
    expect: '[data-testid="slot-profile"]',
    area: ['.drawer.open'],
    pad: 0,
  },

  // ── Model editor (drawer) ───────────────────────────────────────────────
  // No route of its own: it opens from the pencil on a slot card, or from the
  // same button inside the slot drawer (slot-model-edit-open).
  {
    name: 'model-edit-drawer',
    route: '#slots',
    act: (page) => page.click('[data-testid="infer-model-edit-agent"]'),
    expect: '[data-testid="model-facts"]',
    area: ['.drawer.open'],
    pad: 0,
  },

  // ── Profile editor (drawer) ─────────────────────────────────────────────
  {
    name: 'profile-edit-drawer',
    route: '#models/profiles',
    act: openProfileCopy,
    expect: '[data-testid="pf-drawer-preview"]',
    area: ['.pf-drawer'],
    pad: 0,
    viewport: { width: 1440, height: 1180 },
  },

  // ── Models ──────────────────────────────────────────────────────────────
  {
    name: 'models-registry',
    route: '#models',
    expect: '.mdl-row',
  },
  {
    name: 'profiles-tab',
    route: '#models/profiles',
    expect: '[data-testid="pf-btn-new"]',
  },
  {
    // The roster is the box's own benchmark history, so it names whatever
    // private checkpoints the operator has run through it. Not publishable
    // from a working box; the committed image stays until a clean sweep.
    skip: true,
    name: 'benchmarks-roster',
    route: '#benchmarks',
    expect: '[data-testid="benchmarks-view"]',
  },

  // ── Agents / memory / MCP ───────────────────────────────────────────────
  {
    name: 'agents-overview',
    route: '#agent',
    expect: '[data-testid="agent-card-hermes"]',
  },
  {
    // DISABLED — do not re-enable without reading this first.
    //
    // The Memory *overview* cannot be pinned to one bank the way the bank and
    // graph shots are: its right-hand panel lists every bank on the box, and on
    // a real box those are named after the operator's own checkouts
    // (`claude-code::<repo>`, `codex::<host>`). The growth chart's selector is
    // `mv-growth-bank-select`, but changing it does not touch that list. The
    // frame also surfaces a red graph-extraction ERRORS count.
    //
    // Capture this one from a box whose banks are safe to publish, or shoot
    // `#memory/bank` (see memory-bank below) instead.
    skip: true,
    name: 'memory-view',
    route: '#memory',
    expect: '[data-testid="mem-tab-bank"]',
  },
  {
    // The bank workspace, pinned to the `agents` bank.
    name: 'memory-bank',
    route: '#memory/bank',
    act: (page) => pinAgentsBank(page, 1200),
    expect: '[data-testid="mv-workspace"]',
  },
  {
    // The Reflect tab of the bank bar (it is the tab a bank opens on, clicked
    // anyway so the shot does not depend on that default), pinned to the
    // `agents` bank like the shots around it. Nothing is submitted: reflect
    // writes to the bank and costs a model call.
    name: 'memory-reflect',
    route: '#memory/bank',
    act: async (page) => {
      await pinAgentsBank(page);
      await page.click('[data-testid="mv-reflect-tab"]');
    },
    expect: '[data-testid="mv-reflect-q"]',
    clip: '[data-testid="mv-bankbar"]',
  },
  {
    // Graph explorer — the `web` view renders the whole bank as a
    // force-directed semantic/temporal graph.
    name: 'memory-graph',
    route: '#memory/bank',
    act: async (page) => {
      await pinAgentsBank(page);
      await page.click('[data-testid="mv-view-web"]');
    },
    expect: '[data-testid="mv-workspace"] svg',
    after: 5000, // the force layout needs a few seconds to stop moving
  },
  {
    name: 'mcp-tab',
    route: '#mcp',
    expect: 'text=MCP servers',
  },

  // ── Runtime / system ────────────────────────────────────────────────────
  {
    name: 'logs-activity',
    route: '#logs',
    expect: 'text=follow tail',
  },
  {
    // CHECK THE PIXELS before shipping this one: each service card prints its
    // configured `url`, so a box whose ComfyUI (or any companion) points at a
    // private domain publishes that domain. Only ship it when every url in
    // frame reads hal0.local / 127.0.0.1.
    name: 'services-page',
    route: '#services',
    expect: '[data-testid="svcp-card-hermes"]',
  },
  {
    name: 'settings-page',
    route: '#settings',
    expect: 'text=Version & privacy',
  },
  {
    name: 'settings-security',
    route: '#settings/security',
    expect: '[data-testid="cmd-approvals"]',
  },
  {
    // CHECK THE PIXELS before shipping this one: a diagnosis row prints its
    // evidence, which can name the box's hostname, paths and model files.
    name: 'settings-doctor',
    route: '#settings/doctor',
    expect: '[data-testid="diagnosis-verdict"]',
  },
  {
    name: 'hardware-page',
    route: '#settings/hardware',
    expect: '[data-testid="hardware-page"]',
  },

  // ── Open WebUI (its own origin, :3001) ──────────────────────────────────
  // Selectors here come from Open WebUI's markup, not the hal0 dashboard, and
  // are unchecked best guesses (`verify`). Open WebUI must already be signed
  // in or running with auth off: the dashboard sign-in does not apply.
  {
    name: 'openwebui-picker',
    url: OPENWEBUI,
    verify: true,
    act: async (page) => {
      await page.click('#model-selector-0-button');
      await page.waitForSelector('[role="menu"]', { state: 'visible' });
    },
    expect: '[role="menu"]',
    area: ['#model-selector-0-button', '[role="menu"]'],
    pad: 20,
    viewport: { width: 1440, height: 1000 },
  },
  {
    // The seeded chat, opened from the sidebar, with the `agent` slot's reply
    // on screen.
    name: 'openwebui-chat',
    url: OPENWEBUI,
    verify: true,
    act: async (page) => {
      await page.locator('a[href^="/c/"]').first().click();
      await page.waitForSelector('#messages-container', { state: 'visible' });
    },
    expect: '#messages-container',
  },

  // operator-board (#board) is deliberately absent. The board is real but
  // data-dependent: on a box with zero tasks every lane renders "— no tasks —",
  // which is a worse image than the one already committed. Add it back — the
  // route is `#board`, expect `[data-testid="board-lane-todo"]` — when
  // capturing from a box whose board actually has cards in flight.
];

/** SHOT_DEFS with each shot's output `file` (`<name>.png`) filled in. */
export const SHOTS = SHOT_DEFS.map((shot) => ({ ...shot, file: `${shot.name}.png` }));

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Close any dismissable banner (update-available, first-run) before the
 * shot: they are box state, not product surface, and a nightly "update now"
 * strip across every page dates the image the day it is taken.
 */
async function dismissBanners(page) {
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('.banner-dismiss').first();
    if (!(await btn.isVisible().catch(() => false))) return;
    await btn.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}

export async function capture(page, shot, suffix, outDir) {
  const file = variantFile(shot.file, suffix);
  const out = resolve(outDir, file);

  // about:blank first: hash-only navigation does not remount the SPA, so
  // without this a drawer opened by the previous shot bleeds into this one.
  await page.goto('about:blank');
  await page.setViewportSize(shot.viewport ?? VIEWPORT);
  // A `url` shot is on another origin (Open WebUI): the dashboard's sign-in
  // gate and banners are not there, so those helpers are skipped for it.
  const dashboard = !shot.url;
  await page.goto(shot.url ?? `/${shot.route}`, { waitUntil: 'networkidle', timeout: 30_000 });
  if (dashboard) await loginIfAsked(page, shot.route);
  await page.waitForTimeout(shot.settle ?? SETTLE_MS);
  if (dashboard) await dismissBanners(page);

  if (shot.act) await shot.act(page);
  if (shot.expect) {
    await page.waitForSelector(shot.expect, { state: 'visible', timeout: 15_000 });
  }
  await page.waitForTimeout(shot.after ?? 500); // let the transition finish

  if (shot.area) {
    await page.screenshot({ path: out, clip: await areaOf(page, shot.area, shot.pad), animations: 'disabled' });
  } else if (shot.clip) {
    await page.locator(shot.clip).first().screenshot({ path: out, animations: 'disabled' });
  } else {
    await page.screenshot({ path: out, animations: 'disabled' });
  }

  console.log(`[capture] ${shot.route ?? shot.url} → ${out}`);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[capture] ${err.message}`);
    process.exit(2);
  }
  const { out, names: only = [] } = args;
  const outDir = out ? resolve(out) : OUT_DIR;

  if (!(await reachable(BASE))) {
    console.error(
      `[capture] ${BASE} is unreachable. Point HAL0_DASHBOARD_URL at a ` +
        `running hal0 dashboard and retry. No placeholders are written.`,
    );
    process.exit(1);
  }

  // A shot marked `skip` is one we deliberately do not publish from this box —
  // see the comment on each. Naming it explicitly still runs it, so you can
  // re-shoot from a box where it is safe.
  const shots = only.length
    ? SHOTS.filter((s) => only.includes(s.name))
    : SHOTS.filter((s) => !s.skip);
  if (!shots.length) {
    console.error(`[capture] no shot matches ${only.join(', ')}`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ args: parseLaunchArgs(process.env.HAL0_CHROMIUM_ARGS) });
  const failures = [];

  for (const { factor, suffix } of SCALES) {
    const ctx = await browser.newContext({
      baseURL: BASE,
      viewport: VIEWPORT,
      colorScheme: 'dark',
      deviceScaleFactor: factor,
    });
    const page = await ctx.newPage();

    for (const shot of shots) {
      try {
        await capture(page, shot, suffix, outDir);
      } catch (err) {
        const file = variantFile(shot.file, suffix);
        failures.push(file);
        console.warn(`[capture] WARN: ${file} failed (${err.message}) — skipped`);
      }
    }

    await ctx.close();
  }

  await browser.close();

  if (failures.length) {
    console.warn(`[capture] ${failures.length} shot(s) failed: ${failures.join(', ')}`);
    console.warn('[capture] the previous PNGs are untouched for those — no blank frames written.');
  }
  console.log('[capture] done. Review the diff before committing.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
