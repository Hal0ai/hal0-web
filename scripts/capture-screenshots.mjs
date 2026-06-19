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

// route → output filename. Names match what the docs/blog/marketing pages
// already reference, so a re-capture overwrites in place.
const SHOTS = [
  { route: '#dashboard', name: 'dashboard-overview' },
  { route: '#slots', name: 'slots-inference' },
  { route: '#models', name: 'models-registry' },
  { route: '#memory', name: 'memory-view' },
  { route: '#agent', name: 'agents-overview' },
  { route: '#mcp', name: 'mcp-tab' },
  { route: '#board', name: 'operator-board' },
  { route: '#logs', name: 'logs-activity' },
  { route: '#settings', name: 'settings-page' },
];

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await reachable(BASE))) {
    console.error(
      `[capture] ${BASE} is unreachable. Point HAL0_DASHBOARD_URL at a ` +
        `running hal0 dashboard and retry. No placeholders are written.`,
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  for (const shot of SHOTS) {
    try {
      await page.goto(`/${shot.route}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(700); // let SSE-backed panels settle
      const out = resolve(OUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: out });
      console.log(`[capture] ${shot.route} → public/screenshots/${shot.name}.png`);
    } catch (err) {
      console.warn(`[capture] WARN: ${shot.route} failed (${err.message}) — skipped`);
    }
  }

  await browser.close();
  console.log('[capture] done. Review the diff before committing.');
}

main();
