#!/usr/bin/env node
/**
 * build-icons.mjs: rasterize public/favicon.svg into the PNG icon set that
 * browsers and home screens ask for, at build time (`prebuild`).
 *
 *   public/icons/apple-touch-icon-180.png   iOS home screen (apple-touch-icon)
 *   public/icons/icon-192.png               web manifest, Android
 *   public/icons/icon-512.png               web manifest, install splash
 *
 * The SVG glyph is amber on a transparent canvas. Home-screen icons must be
 * opaque (iOS paints transparency black, Android pads it unpredictably), so
 * each PNG is flattened onto the brand background #0a0a0a, the same value as
 * the manifest's `background_color`.
 *
 * The output directory is gitignored: it is derived from favicon.svg on every
 * build, so there is no second copy to drift. Runs on sharp, already a
 * dependency (Astro's image service), so it adds nothing to the build image.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const BACKGROUND = '#0a0a0a';

/** Every PNG this step writes, relative to public/icons/. */
export const ICONS = [
  { file: 'apple-touch-icon-180.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

/**
 * Rasterize an SVG to an opaque `size`×`size` PNG on the brand background.
 * @param {Buffer | Uint8Array} svg
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
export function renderIcon(svg, size) {
  return sharp(svg)
    .resize(size, size, { fit: 'contain', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

async function main() {
  const svg = await readFile(resolve(ROOT, 'public/favicon.svg'));
  const outDir = resolve(ROOT, 'public/icons');
  await mkdir(outDir, { recursive: true });

  for (const { file, size } of ICONS) {
    const png = await renderIcon(svg, size);
    const dest = resolve(outDir, file);
    await writeFile(dest, png);
    console.log(`build-icons: wrote ${dest.replace(ROOT + '/', '')} (${size}×${size}, ${png.length} bytes)`);
  }
}

// Only run when invoked directly (`node scripts/build-icons.mjs`), not when
// imported for `ICONS`/`renderIcon` (tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
