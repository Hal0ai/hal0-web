#!/usr/bin/env node
/**
 * build-og.mjs — render 1200×630 social/OG cards at build time.
 *
 * Approach: compose the card as a satori element tree, let satori lay it
 * out and rasterize it to SVG (satori does its own text shaping/wrapping —
 * no headless browser, no DOM), then rasterize that SVG to PNG with
 * @resvg/resvg-js. Both are pure-JS/native-binding libraries with no
 * system dependencies (no fontconfig, no Chromium), so this runs
 * identically on a dev box, ubuntu-latest CI, and the Cloudflare Pages
 * build image. That headless reliability is why this approach was picked
 * over composing raw SVG `<text>` (which needs fontconfig/librsvg font
 * resolution — not guaranteed in the Pages build image) or a
 * Playwright/Chromium screenshot (heavy, and a new CI dependency).
 *
 * Template spec: docs/design/2026-08-09-community-comps/README.md § screen 5
 * and `05 OG Card Template.html`. One 1200×630 template, five fills (blog,
 * kb, benchmark, profile, fallback):
 *   - fixed 64px top/bottom, 72px left/right padding
 *   - wordmark top-left ("hal" + amber "0", 40px cap height)
 *   - amber eyebrow top-right with a glowing dot
 *   - title: JetBrains Mono, 62px, dropping to 50px past ~28 characters —
 *     truncated with an ellipsis past the two-line budget, never shrunk
 *     further
 *   - subtitle: Geist 26px, ~44ch measure (optional)
 *   - meta: mono, bottom-left (host / author / date)
 *   - figure: single amber mono 76px number + unit, bottom-right — ONLY
 *     bench and profile fills carry it; blog/kb leave the slot empty
 *   - a 4px filament (amber-centered gradient) along the bottom edge
 *
 * Exports `renderOgCard()` so other build steps (blog/KB) can produce their
 * own fills later without duplicating the font-loading/rasterization glue.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 630;
const PAD_Y = 64;
const PAD_X = 72;

// ── design tokens (src/styles/tokens.css) ──────────────────────────────
const COLOR = {
  bg: '#0a0a0a',
  fg: '#f5f5f4',
  fgDim: '#a3a09c',
  fgFaint: '#5c5c58',
  accent: '#ffb000',
  border: '#262626',
};

// Title drops from 62px to 50px once it crosses ~28 characters, and is
// truncated (never shrunk further) once it would still overflow the
// two-line budget at 50px.
const TITLE_SIZE_SHORT = 62;
const TITLE_SIZE_LONG = 50;
const TITLE_LONG_THRESHOLD = 28;
// Rough two-line character budget at 50px across the ~18ch-wide column
// the template reserves (1200 - 72*2 px at ~30px/glyph advance).
const TITLE_MAX_CHARS = 76;

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Title sizing/truncation as a pure function so tests can assert behaviour
 * against the intermediate value rather than pixels.
 * @param {string} title
 * @returns {{ text: string, fontSize: number, long: boolean }}
 */
export function titleLayout(title) {
  const long = title.length > TITLE_LONG_THRESHOLD;
  const fontSize = long ? TITLE_SIZE_LONG : TITLE_SIZE_SHORT;
  const text = long ? truncate(title, TITLE_MAX_CHARS) : title;
  return { text, fontSize, long };
}

let fontsPromise;
async function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(
        resolve(ROOT, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff')
      ),
      readFile(
        resolve(ROOT, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff')
      ),
      readFile(resolve(ROOT, 'node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff')),
    ]).then(([jbmBold, jbmRegular, geist]) => [
      { name: 'JetBrains Mono', data: jbmBold, weight: 700, style: 'normal' },
      { name: 'JetBrains Mono', data: jbmRegular, weight: 400, style: 'normal' },
      { name: 'Geist', data: geist, weight: 400, style: 'normal' },
    ]);
  }
  return fontsPromise;
}

const mono = (extra = {}) => ({ fontFamily: 'JetBrains Mono', ...extra });
const geist = (extra = {}) => ({ fontFamily: 'Geist', ...extra });

/**
 * Build the satori element tree for one card. Exported (undocumented,
 * internal) mainly so tests can assert the tree without a full render.
 */
function cardTree({ kind, eyebrow, title, subtitle, meta, figure }) {
  const { text: titleText, fontSize: titleSize } = titleLayout(title);

  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: `${PAD_Y}px ${PAD_X}px`,
        background: COLOR.bg,
        position: 'relative',
      },
      children: [
        // top row: wordmark + eyebrow
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
            children: [
              {
                type: 'div',
                props: {
                  style: mono({
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    display: 'flex',
                  }),
                  children: [
                    { type: 'span', props: { style: { color: COLOR.fg }, children: 'hal' } },
                    { type: 'span', props: { style: { color: COLOR.accent }, children: '0' } },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: mono({
                    fontSize: 22,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: COLOR.accent,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }),
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: COLOR.accent,
                          boxShadow: `0 0 18px ${COLOR.accent}`,
                          display: 'flex',
                        },
                      },
                    },
                    { type: 'span', props: { children: eyebrow } },
                  ],
                },
              },
            ],
          },
        },
        // middle: title + subtitle
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: mono({
                    fontSize: titleSize,
                    lineHeight: 1.08,
                    letterSpacing: '-0.03em',
                    color: COLOR.fg,
                    fontWeight: 700,
                    display: 'flex',
                    maxWidth: 1000,
                  }),
                  children: titleText,
                },
              },
              ...(subtitle
                ? [
                    {
                      type: 'div',
                      props: {
                        style: geist({
                          fontSize: 26,
                          lineHeight: 1.45,
                          color: COLOR.fgDim,
                          marginTop: 22,
                          display: 'flex',
                          maxWidth: 780, // ~44ch at 26px Geist
                        }),
                        children: subtitle,
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        // bottom row: meta + figure
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40 },
            children: [
              {
                type: 'div',
                props: {
                  style: mono({ fontSize: 22, color: COLOR.fgFaint, display: 'flex' }),
                  children: meta,
                },
              },
              ...(figure
                ? [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: mono({
                                fontSize: 76,
                                lineHeight: 1,
                                letterSpacing: '-0.03em',
                                color: COLOR.accent,
                                fontWeight: 700,
                                display: 'flex',
                              }),
                              children: String(figure.value),
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: mono({
                                fontSize: 20,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: COLOR.fgFaint,
                                marginTop: 12,
                                display: 'flex',
                              }),
                              children: figure.unit,
                            },
                          },
                        ],
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        // 4px filament along the bottom edge
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 4,
              display: 'flex',
              background: `linear-gradient(90deg, transparent, ${COLOR.border} 18%, ${COLOR.accent} 50%, ${COLOR.border} 82%, transparent)`,
            },
          },
        },
      ],
    },
  };
}

/**
 * Render one OG card to a PNG buffer.
 *
 * @param {Object} opts
 * @param {'blog'|'kb'|'benchmark'|'profile'|'fallback'} opts.kind - fill kind.
 *   Only 'benchmark' and 'profile' are expected to pass `figure` — the
 *   template intentionally leaves the figure slot empty for blog/kb rather
 *   than inventing a metric.
 * @param {string} opts.eyebrow - top-right amber label, e.g. "profile · v4".
 * @param {string} opts.title - main heading. Titles over ~28 chars render
 *   at 50px instead of 62px; titles that still don't fit are truncated
 *   with an ellipsis rather than shrunk further.
 * @param {string} [opts.subtitle] - Geist body copy under the title, ~44ch.
 * @param {string} opts.meta - bottom-left mono line (host · author · date).
 * @param {{value: string|number, unit: string}} [opts.figure] - bottom-right
 *   amber 76px number + unit. Omit for blog/kb fills.
 * @returns {Promise<Buffer>} PNG buffer, 1200×630.
 */
export async function renderOgCard(opts) {
  const fonts = await loadFonts();
  const svg = await satori(cardTree(opts), { width: WIDTH, height: HEIGHT, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  const png = resvg.render();
  return png.asPng();
}

// ── build-time generation ──────────────────────────────────────────────
async function main() {
  const [{ default: profilesSnapshot }, { ROSTER }, { benchFor }] = await Promise.all([
    import('../src/data/profiles.json', { with: { type: 'json' } }),
    import('../src/data/model-roster.ts'),
    import('../src/lib/profiles-join.mjs'),
  ]);

  const outDir = resolve(ROOT, 'public/og/profiles');
  await mkdir(outDir, { recursive: true });

  for (const record of profilesSnapshot.profiles) {
    const { profile } = record;
    const bench = benchFor(record, ROSTER);
    const figure = bench.headline
      ? { value: bench.headline.dec.toFixed(1), unit: 'tok/s decode' }
      : undefined;

    const png = await renderOgCard({
      kind: 'profile',
      eyebrow: 'profile',
      title: profile.slug,
      subtitle: profile.summary,
      meta: `hal0.dev/profiles · @${profile.author}`,
      figure,
    });

    const dest = resolve(outDir, `${profile.slug}.png`);
    await writeFile(dest, png);
    console.log(`build-og: wrote ${dest.replace(ROOT + '/', '')} (${png.length} bytes)`);
  }

  // Gallery-level card for the /profiles index itself (no single profile's
  // join, so no figure — see MarketingLayout ogImage prop on that page).
  const galleryPng = await renderOgCard({
    kind: 'profile',
    eyebrow: 'profiles',
    title: 'community profile registry',
    subtitle: 'Find the config for your model, install it, read what it trades.',
    meta: 'hal0.dev/profiles',
  });
  const galleryDest = resolve(ROOT, 'public/og/profiles-index.png');
  await writeFile(galleryDest, galleryPng);
  console.log(`build-og: wrote ${galleryDest.replace(ROOT + '/', '')} (${galleryPng.length} bytes)`);

  // Fallback fill for pages without a card of their own. NOTE: the legacy
  // ImageMagick-rendered public/og-default.png (built by scripts/build-og.sh)
  // is left untouched — it's still referenced from astro.config.mjs and
  // MarketingLayout's default `ogImage` prop, and pixel-replacing a file
  // every other page depends on is riskier than shipping the new template's
  // fallback fill under a new path. This new fallback lives at
  // public/og/default.png, conforming to the fallback fill spec, ready to
  // be wired in once the rest of the fills (blog/KB) exist and a page can
  // switch over deliberately.
  const fallbackPng = await renderOgCard({
    kind: 'fallback',
    eyebrow: 'self-hosted ai inference',
    title: 'Your Strix Halo box, running real /v1/* inference',
    subtitle: 'One command installs it. Slots, unified memory, an OpenAI-compatible API.',
    meta: 'hal0.dev · Apache-2.0',
  });
  const fallbackDest = resolve(ROOT, 'public/og/default.png');
  await mkdir(dirname(fallbackDest), { recursive: true });
  await writeFile(fallbackDest, fallbackPng);
  console.log(`build-og: wrote ${fallbackDest.replace(ROOT + '/', '')} (${fallbackPng.length} bytes)`);
}

// Only run when invoked directly (`node scripts/build-og.mjs`), not when
// imported for its `renderOgCard`/`titleLayout` exports (tests, future
// blog/KB build steps).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
