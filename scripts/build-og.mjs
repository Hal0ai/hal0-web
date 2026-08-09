#!/usr/bin/env node
/**
 * build-og.mjs — render 1200×630 social/OG cards at build time.
 *
 * Approach: compose the card as a satori element tree, let satori lay it
 * out and rasterize it to SVG (satori does its own text shaping/wrapping —
 * no headless browser, no DOM), then rasterize that SVG to PNG with
 * @resvg/resvg-js. Both are pure-JS/native-binding libraries with no
 * system dependencies (no fontconfig, no Chromium), so this runs
 * identically on a dev box, ubuntu-latest CI, and the Vercel build image
 * hal0-web actually deploys on (see README.md — Vercel, not Cloudflare
 * Pages; Cloudflare only fronts releases.hal0.dev). That headless
 * reliability is why this approach was picked over composing raw SVG
 * `<text>` (which needs fontconfig/librsvg font resolution — not
 * guaranteed in the build image) or a Playwright/Chromium screenshot
 * (heavy, and a new CI dependency).
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

// Title drops from 62px to 50px once it crosses ~28 characters. The title
// box itself is always 18ch wide (comp: `.og-title{max-width:18ch}`) — at
// a smaller font-size that's fewer physical pixels, but the same number of
// monospace characters per line, so MAX_CHARS_PER_LINE is constant.
const TITLE_SIZE_SHORT = 62;
const TITLE_SIZE_LONG = 50;
const TITLE_LONG_THRESHOLD = 28;
const TITLE_MAX_LINES = 2;
// JetBrains Mono is a fixed-pitch face with a published advance width of
// 600/1000 em (https://github.com/JetBrains/JetBrainsMono font spec) — so
// "18ch" is exactly 18 monospace glyph cells, independent of font-size.
const MAX_CHARS_PER_LINE = 18;
const JBM_ADVANCE = 0.6; // em per glyph cell

/**
 * Greedy word-wrap `text` into at most `maxLines` lines of at most
 * `maxCharsPerLine` monospace characters each. A single "word" (no
 * whitespace) longer than one line is hard-broken across as many lines as
 * it needs, rather than overflowing — this is the backstop for titles that
 * are one long unbroken token (no spaces to wrap on). Once `maxLines` is
 * reached with input still remaining, the last line is truncated to leave
 * room for a trailing ellipsis: the contract is "truncate, never shrink
 * further past the long-title size."
 *
 * Pure and synchronous so it's unit-testable without a satori render.
 *
 * @param {string} text
 * @param {number} maxCharsPerLine
 * @param {number} maxLines
 * @returns {{ lines: string[], truncated: boolean }}
 */
export function wrapMonospace(text, maxCharsPerLine, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  const pushCurrent = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  outer: for (const word of words) {
    let remaining = word;
    while (remaining.length > 0) {
      const freeOnLine = maxCharsPerLine - (current ? current.length + 1 : 0);
      if (freeOnLine <= 0) {
        pushCurrent();
        if (lines.length >= maxLines) break outer;
        continue;
      }
      if (remaining.length <= freeOnLine) {
        current += (current ? ' ' : '') + remaining;
        remaining = '';
      } else {
        // Hard-break: this single word doesn't fit even on an empty line
        // budget-worth of space — take as much as fits and continue on
        // the next line (the long-unbroken-token backstop).
        const take = current ? freeOnLine : maxCharsPerLine;
        current += (current ? ' ' : '') + remaining.slice(0, take);
        remaining = remaining.slice(take);
        pushCurrent();
        if (lines.length >= maxLines) break outer;
      }
    }
  }
  pushCurrent();

  const consumedChars = lines.join(' ').replace(/ /g, '').length; // rough progress check
  const totalChars = words.join('').length;
  const overflowed = lines.length > maxLines || consumedChars < totalChars;
  const clipped = lines.slice(0, maxLines);

  if (overflowed) {
    const last = clipped[clipped.length - 1] ?? '';
    // Leave room for the ellipsis glyph within the same maxCharsPerLine
    // budget rather than growing the line past the box width.
    clipped[clipped.length - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}…`;
  }

  return { lines: clipped, truncated: overflowed };
}

/**
 * Title sizing/wrapping as a pure function so tests can assert behaviour
 * (line count, truncation) against the intermediate value rather than
 * pixels. The title box is a fixed 18ch column (matching the comp's
 * `.og-title{max-width:18ch}`); titles that don't fit in 2 lines at the
 * long-title size are truncated with an ellipsis rather than shrunk
 * further. `wordBreak`/`overflowWrap` are also set at render time as a
 * hard CSS-level backstop in case any measurement assumption above is off
 * for a given glyph run.
 * @param {string} title
 * @returns {{ lines: string[], fontSize: number, long: boolean, truncated: boolean }}
 */
export function titleLayout(title) {
  const long = title.length > TITLE_LONG_THRESHOLD;
  const fontSize = long ? TITLE_SIZE_LONG : TITLE_SIZE_SHORT;
  const { lines, truncated } = wrapMonospace(title, MAX_CHARS_PER_LINE, TITLE_MAX_LINES);
  return { lines, fontSize, long, truncated };
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

// ── wordmark ────────────────────────────────────────────────────────────
// The real lockup, not an approximation: path data lifted verbatim from
// src/components/Wordmark.astro (source artwork public/brand/logo-halo-dark.svg)
// — Monomaniac One "hal" + JetBrains Mono's stadium "0". The handoff is
// explicit that this is a fixed asset, never redrawn/re-typeset, so it's
// embedded as raw <svg>/<path> nodes (satori supports the SVG primitives,
// not just HTML) rather than faked with mono-font text.
const WORDMARK_VIEWBOX = '160 480 1340 500';
const WORDMARK_ASPECT = 1340 / 500;
const WORDMARK_HAL_PATHS = [
  'M 247.515625 -28.328125 C 247.515625 -20.523438 244.847656 -13.851562 239.515625 -8.3125 C 234.179688 -2.769531 227.613281 0 219.8125 0 L 202.578125 0 C 194.773438 0 188.203125 -2.769531 182.859375 -8.3125 C 177.523438 -13.851562 174.859375 -20.523438 174.859375 -28.328125 L 174.859375 -237.046875 C 174.859375 -239.515625 173.9375 -241.566406 172.09375 -243.203125 C 170.25 -244.847656 168.300781 -245.671875 166.25 -245.671875 L 106.515625 -245.671875 C 104.460938 -245.671875 102.515625 -244.847656 100.671875 -243.203125 C 98.828125 -241.566406 97.90625 -239.515625 97.90625 -237.046875 L 97.90625 -28.328125 C 97.90625 -20.523438 95.234375 -13.851562 89.890625 -8.3125 C 84.554688 -2.769531 77.988281 0 70.1875 0 L 52.953125 0 C 45.148438 0 38.476562 -2.769531 32.9375 -8.3125 C 27.394531 -13.851562 24.625 -20.523438 24.625 -28.328125 L 24.625 -387.90625 C 24.625 -396.113281 27.394531 -402.882812 32.9375 -408.21875 C 38.476562 -413.550781 45.148438 -416.21875 52.953125 -416.21875 L 70.1875 -416.21875 C 77.988281 -416.21875 84.554688 -413.550781 89.890625 -408.21875 C 95.234375 -402.882812 97.90625 -396.113281 97.90625 -387.90625 L 97.90625 -326.328125 C 97.90625 -324.273438 98.828125 -322.53125 100.671875 -321.09375 C 102.515625 -319.65625 104.460938 -318.9375 106.515625 -318.9375 L 179.171875 -318.9375 C 191.898438 -318.9375 203.394531 -315.859375 213.65625 -309.703125 C 223.914062 -303.546875 232.125 -295.234375 238.28125 -284.765625 C 244.4375 -274.296875 247.515625 -262.703125 247.515625 -249.984375 Z M 247.515625 -28.328125',
  'M 247.515625 -68.953125 C 247.515625 -49.660156 240.84375 -33.34375 227.5 -20 C 214.164062 -6.664062 198.054688 0 179.171875 0 L 93.59375 0 C 74.707031 0 58.488281 -6.664062 44.9375 -20 C 31.394531 -33.34375 24.625 -49.660156 24.625 -68.953125 L 24.625 -136.078125 C 24.625 -148.796875 27.804688 -160.179688 34.171875 -170.234375 C 40.535156 -180.296875 48.847656 -188.40625 59.109375 -194.5625 C 69.367188 -200.71875 80.863281 -203.796875 93.59375 -203.796875 L 166.25 -203.796875 C 168.300781 -203.796875 170.25 -204.617188 172.09375 -206.265625 C 173.9375 -207.910156 174.859375 -209.960938 174.859375 -212.421875 L 174.859375 -237.046875 C 174.859375 -239.515625 173.9375 -241.566406 172.09375 -243.203125 C 170.25 -244.847656 168.300781 -245.671875 166.25 -245.671875 L 93.59375 -245.671875 C 85.789062 -245.671875 79.117188 -248.335938 73.578125 -253.671875 C 68.035156 -259.015625 65.265625 -265.582031 65.265625 -273.375 L 65.265625 -290 C 65.265625 -298.207031 68.035156 -305.082031 73.578125 -310.625 C 79.117188 -316.164062 85.789062 -318.9375 93.59375 -318.9375 L 179.171875 -318.9375 C 191.898438 -318.9375 203.394531 -315.859375 213.65625 -309.703125 C 223.914062 -303.546875 232.125 -295.234375 238.28125 -284.765625 C 244.4375 -274.296875 247.515625 -262.703125 247.515625 -249.984375 Z M 174.859375 -80.65625 L 174.859375 -123.140625 C 174.859375 -125.191406 173.9375 -127.035156 172.09375 -128.671875 C 170.25 -130.316406 168.300781 -131.140625 166.25 -131.140625 L 106.515625 -131.140625 C 104.460938 -131.140625 102.515625 -130.316406 100.671875 -128.671875 C 98.828125 -127.035156 97.90625 -125.191406 97.90625 -123.140625 L 97.90625 -80.65625 C 97.90625 -78.601562 98.828125 -76.753906 100.671875 -75.109375 C 102.515625 -73.472656 104.460938 -72.65625 106.515625 -72.65625 L 166.25 -72.65625 C 168.300781 -72.65625 170.25 -73.472656 172.09375 -75.109375 C 173.9375 -76.753906 174.859375 -78.601562 174.859375 -80.65625 Z M 174.859375 -80.65625',
  'M 136.6875 -28.328125 C 136.6875 -20.523438 133.914062 -13.851562 128.375 -8.3125 C 122.832031 -2.769531 116.160156 0 108.359375 0 L 92.96875 0 C 74.09375 0 57.878906 -6.664062 44.328125 -20 C 30.785156 -33.34375 24.015625 -49.660156 24.015625 -68.953125 L 24.015625 -387.90625 C 24.015625 -396.113281 26.785156 -402.882812 32.328125 -408.21875 C 37.867188 -413.550781 44.539062 -416.21875 52.34375 -416.21875 L 69.578125 -416.21875 C 77.378906 -416.21875 84.050781 -413.550781 89.59375 -408.21875 C 95.132812 -402.882812 97.90625 -396.113281 97.90625 -387.90625 L 97.90625 -80.65625 C 97.90625 -75.320312 100.363281 -72.65625 105.28125 -72.65625 L 108.359375 -72.65625 C 116.160156 -72.65625 122.832031 -69.984375 128.375 -64.640625 C 133.914062 -59.304688 136.6875 -52.535156 136.6875 -44.328125 Z M 136.6875 -28.328125',
];
const WORDMARK_ZERO_PATH =
  'M 301.6875 188.453125 C 314.144531 188.523438 324.09375 191.941406 331.53125 198.703125 C 338.96875 205.460938 342.660156 214.578125 342.609375 226.046875 C 342.546875 237.503906 338.757812 246.578125 331.25 253.265625 C 323.738281 259.953125 313.753906 263.257812 301.296875 263.1875 L 226.5625 262.796875 C 214.101562 262.722656 204.15625 259.304688 196.71875 252.546875 C 189.28125 245.785156 185.59375 236.675781 185.65625 225.21875 C 185.707031 213.75 189.488281 204.671875 197 197.984375 C 204.507812 191.296875 214.492188 187.988281 226.953125 188.0625 Z M 152.546875 127.859375 C 121.648438 127.691406 97.0625 136.28125 78.78125 153.625 C 60.5 170.976562 51.28125 194.601562 51.125 224.5 C 50.957031 254.394531 59.921875 278.109375 78.015625 295.640625 C 96.109375 313.171875 120.601562 322.019531 151.5 322.1875 L 383.171875 323.421875 C 414.066406 323.585938 438.65625 315 456.9375 297.65625 C 475.21875 280.320312 484.441406 256.707031 484.609375 226.8125 C 484.765625 196.914062 475.796875 173.195312 457.703125 155.65625 C 439.609375 138.113281 415.113281 129.257812 384.21875 129.09375 Z M 152.90625 60.609375 L 384.578125 61.84375 C 408.992188 61.976562 431.144531 65.957031 451.03125 73.78125 C 470.925781 81.601562 487.804688 92.648438 501.671875 106.921875 C 515.535156 121.203125 526.148438 138.453125 533.515625 158.671875 C 540.890625 178.890625 544.507812 201.707031 544.375 227.125 C 544.238281 252.53125 540.378906 275.300781 532.796875 295.4375 C 525.210938 315.570312 514.410156 332.703125 500.390625 346.828125 C 486.367188 360.960938 469.375 371.835938 449.40625 379.453125 C 429.4375 387.078125 407.242188 390.820312 382.828125 390.6875 L 151.15625 389.453125 C 126.738281 389.328125 104.707031 385.347656 85.0625 377.515625 C 65.414062 369.691406 48.65625 358.640625 34.78125 344.359375 C 20.90625 330.078125 10.160156 312.703125 2.546875 292.234375 C -5.054688 271.765625 -8.789062 249.078125 -8.65625 224.171875 C -8.519531 198.753906 -4.664062 175.976562 2.90625 155.84375 C 10.488281 135.707031 21.289062 118.570312 35.3125 104.4375 C 49.34375 90.3125 66.34375 79.441406 86.3125 71.828125 C 106.289062 64.222656 128.488281 60.484375 152.90625 60.609375 Z M 152.90625 60.609375';

function wordmarkTree(heightPx) {
  return {
    type: 'svg',
    props: {
      viewBox: WORDMARK_VIEWBOX,
      width: Math.round(heightPx * WORDMARK_ASPECT),
      height: heightPx,
      style: { display: 'flex' },
      children: [
        {
          type: 'g',
          props: {
            transform: 'translate(150 194)',
            fill: COLOR.fg,
            children: WORDMARK_HAL_PATHS.map((d, i) => ({
              type: 'g',
              props: {
                transform: `translate(${i === 0 ? 0 : i === 1 ? 272.763287 : 545.526555} 713.543886)`,
                children: [{ type: 'path', props: { d } }],
              },
            })),
          },
        },
        {
          type: 'g',
          props: {
            transform: 'translate(671 518)',
            fill: COLOR.accent,
            children: [
              {
                type: 'g',
                props: {
                  transform: 'translate(183.175087 1.720401)',
                  children: [{ type: 'path', props: { d: WORDMARK_ZERO_PATH } }],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * Build the satori element tree for one card. Exported (undocumented,
 * internal) mainly so tests can assert the tree without a full render.
 */
function cardTree({ kind, eyebrow, title, subtitle, meta, figure }) {
  const { lines: titleLines, fontSize: titleSize } = titleLayout(title);

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
              wordmarkTree(40),
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
                    display: 'flex',
                    flexDirection: 'column',
                    // 18ch box (comp: `.og-title{max-width:18ch}`), plus a
                    // hard CSS-level backstop against overflow — the line
                    // content is already wrapped/truncated to fit by
                    // titleLayout()/wrapMonospace(), this just guarantees
                    // no single glyph run can blow out the canvas width.
                    maxWidth: Math.round(JBM_ADVANCE * titleSize * MAX_CHARS_PER_LINE),
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }),
                  children: titleLines.map((line) => ({
                    type: 'div',
                    props: {
                      style: {
                        fontSize: titleSize,
                        lineHeight: 1.08,
                        letterSpacing: '-0.03em',
                        color: COLOR.fg,
                        fontWeight: 700,
                        display: 'flex',
                      },
                      children: line,
                    },
                  })),
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
