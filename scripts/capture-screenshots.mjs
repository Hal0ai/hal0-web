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
 * Usage:
 *   npx playwright install chromium      # once, to get the browser binary
 *   HAL0_DASHBOARD_URL=http://your-host:8080 npm run capture:screenshots
 *
 * Every shot is written twice: <name>.png at 1× and <name>@2x.png at
 * deviceScaleFactor 2, which is what the retina variants already in the
 * directory are.
 *
 * The base URL is NEVER hard-coded to a private host — pass it via
 * HAL0_DASHBOARD_URL (default http://localhost:8080). To keep host names out
 * of the captured pixels, reach the box by an mDNS/local name (e.g.
 * http://hal0.local:8080) so any endpoint shown in the UI reads `hal0.local`.
 *
 * The first-run experience is a terminal TUI (`hal0 setup`) as of v0.5.1 —
 * there is no web first-run wizard to screenshot here.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/screenshots');
const BASE = process.env.HAL0_DASHBOARD_URL || 'http://localhost:8080';

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
 *   route   hash route to load (the SPA is remounted for every shot)
 *   act     optional async (page) => {} that drives the UI into an interaction
 *           state — open a drawer, switch a sub-view, scroll a section up
 *   expect  selector that must be visible before we shoot. This is the guard
 *           against shipping a loading spinner or an empty frame: if the
 *           surface never renders, the shot fails loudly instead of quietly
 *           writing a blank PNG over a good one
 *   clip    selector to crop to, for the small element shots the docs embed
 *           inline (memory bar, MTP control, requests widget …)
 *   settle  override for SETTLE_MS — how long to wait after the route loads
 *   after   extra ms to wait once `act` has run, for animations that only
 *           start on the interaction (a force-directed graph settling)
 */
const drawer = '.drawer.open .drawer-body';

/** act() helper: bring a section of a long view into frame. */
const scrollTo =
  (selector, block = 'center') =>
  async (page) => {
    await page.locator(selector).first().evaluate((el, b) => el.scrollIntoView({ block: b }), block);
    await page.waitForTimeout(400);
  };

const SHOTS = [
  // ── Overview ────────────────────────────────────────────────────────────
  {
    name: 'dashboard-overview',
    route: '#dashboard',
    expect: '.rd-mem-card',
  },
  {
    name: 'unified-memory-hero',
    route: '#dashboard',
    clip: '.rd-mem-card',
  },
  {
    // Only worth re-capturing on a box that has served /v1 traffic in the last
    // 60s — on an idle box this is a "0 req/min" card with no endpoint rows,
    // which is a worse image than the one already committed.
    name: 'requests-latency-widget',
    route: '#dashboard',
    clip: '.rd-card:has(.rd-card-title:text-is("Requests"))',
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
    expect: '[data-testid="ri-defaults"]',
  },
  {
    name: 'image-gen-comfyui',
    route: '#slots/image',
    expect: '[data-testid="comfy-engine-pill"]',
  },

  // ── Slot editor (drawer) ────────────────────────────────────────────────
  // The slot drawer is route-addressable: #slots/<name> opens it over the
  // slots view, which is also what clicking a slot row does.
  {
    // The slot editor. Filename kept as slot-detail because the docs already
    // reference /screenshots/slot-detail.png.
    name: 'slot-detail',
    route: '#slots/agent',
    expect: '[data-testid="slot-model-swap"]',
  },

  // ── Model editor (drawer) ───────────────────────────────────────────────
  // No route of its own: it opens from the pencil on a slot card, or from the
  // same button inside the slot drawer (slot-model-edit-open).
  {
    name: 'model-edit-drawer',
    route: '#slots',
    act: (page) => page.click('[data-testid="infer-model-edit-agent"]'),
    expect: drawer,
  },
  {
    name: 'mtp-control',
    route: '#slots',
    act: (page) => page.click('[data-testid="infer-model-edit-agent"]'),
    clip: '.drawer.open .form-row:has-text("MTP")',
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
    // The bank workspace. Pinned to the `agents` bank: its facts are about the
    // runtime itself, so the frame stays on-product instead of showing
    // whatever the box's own project banks happen to hold.
    name: 'memory-bank',
    route: '#memory/bank',
    act: async (page) => {
      await page.selectOption('[data-testid="mv-bank-select"]', 'agents');
      await page.waitForTimeout(1200);
    },
    expect: '[data-testid="mv-workspace"]',
  },
  {
    // Graph explorer — the `web` view renders the whole bank as a
    // force-directed semantic/temporal graph.
    name: 'memory-graph',
    route: '#memory/bank',
    act: async (page) => {
      await page.selectOption('[data-testid="mv-bank-select"]', 'agents');
      await page.waitForTimeout(1000);
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
    name: 'hardware-page',
    route: '#settings/hardware',
    expect: '[data-testid="hardware-page"]',
  },

  // operator-board (#board) is deliberately absent. The board is real but
  // data-dependent: on a box with zero tasks every lane renders "— no tasks —",
  // which is a worse image than the one already committed. Add it back — the
  // route is `#board`, expect `[data-testid="board-lane-todo"]` — when
  // capturing from a box whose board actually has cards in flight.
];

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function capture(page, shot, suffix) {
  const file = `${shot.name}${suffix}.png`;
  const out = resolve(OUT_DIR, file);

  // about:blank first: hash-only navigation does not remount the SPA, so
  // without this a drawer opened by the previous shot bleeds into this one.
  await page.goto('about:blank');
  await page.goto(`/${shot.route}`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(shot.settle ?? SETTLE_MS);

  if (shot.act) await shot.act(page);
  if (shot.expect) {
    await page.waitForSelector(shot.expect, { state: 'visible', timeout: 15_000 });
  }
  await page.waitForTimeout(shot.after ?? 500); // let the transition finish

  if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: out });
  else await page.screenshot({ path: out });

  console.log(`[capture] ${shot.route} → public/screenshots/${file}`);
}

async function main() {
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
  const only = process.argv.slice(2);
  const shots = only.length
    ? SHOTS.filter((s) => only.includes(s.name))
    : SHOTS.filter((s) => !s.skip);
  if (!shots.length) {
    console.error(`[capture] no shot matches ${only.join(', ')}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
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
        await capture(page, shot, suffix);
      } catch (err) {
        const file = `${shot.name}${suffix}.png`;
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

main();
