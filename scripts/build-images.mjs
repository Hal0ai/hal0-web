#!/usr/bin/env node
/**
 * build-images.mjs: AVIF and WebP derivatives of the site's raster images, at
 * build time (`prebuild`).
 *
 *   public/screenshots/<name>.png          →  <name>.avif  <name>.webp
 *   public/screenshots/<name>@2x.png       →  <name>@2x.avif  <name>@2x.webp
 *   public/agents/hermes.png               →  hermes.avif  hermes.webp
 *                                             hermes-744.png  hermes-744.avif  hermes-744.webp
 *
 * hermes-744 is the Hermes portrait at 744px wide: the 340x520 card crops it
 * with object-fit: cover, so the image renders about 644 CSS px wide. 744 px
 * covers that at 1x and the full 1488px portrait is its 2x
 * (src/components/HermesCard.astro).
 *
 * A derivative is written only when it is missing or older than its source
 * PNG, so a second run is a no-op and a re-captured screenshot refreshes only
 * its own siblings. Every output is gitignored: the PNGs stay the single
 * committed copy, and a derivative is never an input (hermes-744.png is not
 * re-resized, `agents/` holds no other source).
 *
 * <Shot> (src/components/Shot.astro) only emits a <source> for a format whose
 * derivative exists, so `astro dev` without this step serves the PNGs. Unlike
 * the sync scripts this one fails the build on an encoder error: a half-built
 * set would silently ship PNG-only pages.
 *
 * Runs on sharp, already a dependency (Astro's image service).
 */
import { mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Width of public/agents/hermes-744.png. */
export const HERMES_WIDTH = 744;

// AVIF effort 2 costs ~0.8 s for a 2880×1800 capture (effort 4 is ~6.5 s for ~10% fewer bytes);
// the cold build on Vercel re-encodes everything, so speed wins. 4:4:4 chroma (sharp's default)
// keeps coloured UI text crisp.
export const AVIF_OPTIONS = { quality: 55, effort: 2 };
export const WEBP_OPTIONS = { quality: 80, effort: 4, smartSubsample: true };
export const PNG_OPTIONS = { compressionLevel: 9, effort: 10 };

/** Files encoded in parallel. libvips threads each encode, so a few at a time saturate a build box. */
const CONCURRENCY = 3;

// Decoded pixels are not reused between files; do not keep them around.
sharp.cache(false);

/**
 * @typedef {{ src: string, dest: string, format: 'avif' | 'webp' | 'png', width?: number }} Job
 */

/**
 * Every derivative this step maintains for `root`.
 * @param {string} root
 * @returns {Promise<Job[]>}
 */
export async function planJobs(root) {
  const shots = join(root, 'public/screenshots');
  const agents = join(root, 'public/agents');
  /** @type {Job[]} */
  const jobs = [];

  for (const file of await listPngs(shots)) {
    const src = join(shots, file);
    for (const format of /** @type {const} */ (['avif', 'webp'])) {
      jobs.push({ src, dest: join(shots, file.replace(/\.png$/, `.${format}`)), format });
    }
  }

  const hermes = join(agents, 'hermes.png');
  if (await isFile(hermes)) {
    jobs.push({ src: hermes, dest: join(agents, 'hermes.avif'), format: 'avif' });
    jobs.push({ src: hermes, dest: join(agents, 'hermes.webp'), format: 'webp' });
    jobs.push({ src: hermes, dest: join(agents, 'hermes-744.png'), format: 'png', width: HERMES_WIDTH });
    jobs.push({ src: hermes, dest: join(agents, 'hermes-744.avif'), format: 'avif', width: HERMES_WIDTH });
    jobs.push({ src: hermes, dest: join(agents, 'hermes-744.webp'), format: 'webp', width: HERMES_WIDTH });
  }
  return jobs;
}

/** @param {string} dir @returns {Promise<string[]>} the .png file names in `dir`, [] when it does not exist */
async function listPngs(dir) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/** @param {string} file */
async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

/** True when `dest` exists and is at least as new as `src`. */
async function isFresh(src, dest) {
  try {
    return (await stat(dest)).mtimeMs >= (await stat(src)).mtimeMs;
  } catch {
    return false;
  }
}

/** @param {Job} job */
async function encode({ src, dest, format, width }) {
  let img = sharp(src);
  if (width) img = img.resize({ width, withoutEnlargement: true });
  const out =
    format === 'avif' ? img.avif(AVIF_OPTIONS) : format === 'webp' ? img.webp(WEBP_OPTIONS) : img.png(PNG_OPTIONS);
  const buf = await out.toBuffer();
  // Write-then-rename so an interrupted build never leaves a truncated file that looks fresh.
  const tmp = `${dest}.${process.pid}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, dest);
  return buf.length;
}

/**
 * Bring every derivative under `root` up to date.
 * @param {{ root?: string, log?: (line: string) => void }} [opts]
 * @returns {Promise<{ written: string[], skipped: string[] }>} paths relative to `root`
 */
export async function buildImages({ root = ROOT, log = console.log } = {}) {
  const started = Date.now();
  const rel = (p) => relative(root, p).split('\\').join('/');
  const jobs = await planJobs(root);

  const stale = [];
  const skipped = [];
  for (const job of jobs) (await isFresh(job.src, job.dest) ? skipped : stale).push(job);

  const written = [];
  const failures = [];
  let bytes = 0;
  const queue = [...stale];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await mkdir(dirname(job.dest), { recursive: true });
        bytes += await encode(job);
        written.push(rel(job.dest));
      } catch (err) {
        failures.push(`${rel(job.dest)} (from ${rel(job.src)}): ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker));

  if (failures.length) {
    throw new Error(`build-images: ${failures.length} derivative(s) failed\n  ${failures.join('\n  ')}`);
  }
  if (jobs.length) {
    log(
      `build-images: ${written.length} written (${(bytes / 1024).toFixed(0)} KiB), ` +
        `${skipped.length} up to date, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
  return { written, skipped: skipped.map((j) => rel(j.dest)) };
}

// Only run when invoked directly (`node scripts/build-images.mjs`), not when
// imported for `buildImages` (tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  buildImages().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
