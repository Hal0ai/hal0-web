#!/usr/bin/env node
/**
 * sync-screenshots.mjs: bring the hal0 dashboard (WebUI) screenshot set into
 * this site.
 *
 * The product repo keeps a reproducible set of dashboard captures in
 * docs/screenshots/, made by its own Playwright specs against the dashboard's
 * mock data, with a manifest (docs/screenshots/README.md) that has one table
 * row per image. Nothing is served from there: hal0.dev and the published docs
 * load /screenshots/<name>.png from this repository, so an image reaches the
 * site only when it is copied here. This script is that copy.
 *
 *   npm run sync:screenshots                          # hal0 main, from GitHub
 *   npm run sync:screenshots -- --ref <branch|tag|sha>
 *   npm run sync:screenshots -- --from <dir>          # a local docs/screenshots/
 *   npm run sync:screenshots -- --dry-run             # report, write nothing
 *
 * What it does:
 *   1. Reads the manifest and takes its table as the list of files. A file the
 *      manifest does not name is never fetched.
 *   2. Fetches every PNG and checks it before anything is written: it must be
 *      a PNG whose pixel size is the one the manifest states. One bad file
 *      stops the run with nothing changed.
 *   3. Writes each PNG to public/screenshots/ under its own name, byte for
 *      byte. The files are lossless captures at device scale factor 2 and are
 *      never re-encoded here; `npm run build:images` derives AVIF and WebP
 *      from them at build time.
 *   4. Writes src/data/screenshots.json: the manifest as data (route, viewport,
 *      pixel size, what the image shows, suggested use, the "Figures" value)
 *      and the hal0 commit the set came from. src/lib/shot.ts reads it to size
 *      these captures at half their pixel dimensions.
 *
 * What it never does: delete or rename a file. The docs link screenshots by
 * name, so a name that exists stays. A replaced capture is overwritten in
 * place; an older capture the manifest no longer covers is left alone and
 * listed in the report, and so is the old `<name>@2x.png` of a replaced
 * capture (the site no longer uses it: see resolveShot).
 *
 * Not part of `prebuild`: the PNGs are committed, the set is about 18 MB, and
 * a new set needs a person to look at where each image is used. Read the
 * manifest's "Figures" column before placing an image: one marked
 * illustrative carries invented readings and does not belong in a hero or
 * beside a performance claim.
 *
 * The other screenshot script, capture-screenshots.mjs, takes captures from a
 * live hal0 box instead. Use this one for the published set.
 *
 * GITHUB_TOKEN, when set, is sent to api.github.com only (to resolve --ref to
 * a commit); it raises the unauthenticated rate limit of 60 requests an hour.
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const SOURCE_REPO = 'Hal0ai/hal0';
export const SOURCE_PATH = 'docs/screenshots';
const MANIFEST_FILE = 'README.md';
const DEFAULT_REF = 'main';
const TIMEOUT_MS = 30_000;
/** Files fetched at once. */
const CONCURRENCY = 4;
/** The manifest promises every capture stays under this; a larger one is reported, not refused. */
const SIZE_LIMIT = 1.5 * 1024 * 1024;

/** The manifest's table columns, in the order this script reads them. */
const COLUMNS = ['File', 'Route', 'Viewport', 'Pixels', 'What it shows', 'Suggested use', 'Replaces', 'Figures'];
const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.png$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Strips the backticks the manifest wraps file names and routes in. */
const plain = (cell) => cell.replace(/`/g, '').trim();

/** `2880×1800` (or `2880x1800`) as numbers; null when the cell is not a size. */
function parseSize(cell) {
  const m = /^(\d+)\s*[×x]\s*(\d+)/.exec(cell.trim());
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** The cells of one markdown table row, without the outer pipes. */
function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * The manifest's image table as data.
 *
 * @param {string} markdown docs/screenshots/README.md
 * @returns {{ deviceScaleFactor: number, images: Array<{
 *   file: string, route: string, viewport: string, width: number, height: number,
 *   shows: string, use: string, replaces: string | null, replacesNote: string | null, figures: string }> }}
 *
 * `replaces` is the hal0-web file name the row names, when it names one; text
 * after it in the cell, such as "(#3629, nearest)", goes to `replacesNote`.
 * `deviceScaleFactor` is worked out from the rows that capture a whole page
 * (pixels divided by viewport) and must be the same for all of them, because
 * the site sizes every image in the set by that one number.
 *
 * Throws on a table it cannot read rather than syncing half a set: a missing
 * column, a file name that is not a plain lowercase PNG name, a size that is
 * not WIDTH×HEIGHT, or the same file twice.
 */
export function parseManifest(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headAt = lines.findIndex((l) => /^\s*\|/.test(l) && cells(l)[0] === 'File');
  if (headAt === -1) throw new Error('manifest: no table whose first column is "File"');

  const head = cells(lines[headAt]);
  const at = Object.fromEntries(
    COLUMNS.map((name) => {
      const i = head.findIndex((h) => h === name || h.startsWith(`${name} `));
      if (i === -1) throw new Error(`manifest: the image table has no "${name}" column`);
      return [name, i];
    }),
  );

  const images = [];
  const seen = new Set();
  const scales = new Set();
  for (const line of lines.slice(headAt + 2)) {
    if (!/^\s*\|/.test(line)) break;
    const row = cells(line);
    const file = plain(row[at.File] ?? '');
    if (!FILE_NAME.test(file)) throw new Error(`manifest: "${file}" is not a plain PNG file name`);
    if (seen.has(file)) throw new Error(`manifest: ${file} is listed twice`);
    seen.add(file);

    const pixels = parseSize(row[at.Pixels] ?? '');
    if (!pixels) throw new Error(`manifest: ${file} has no WIDTH×HEIGHT in its Pixels column`);

    const viewport = plain(row[at.Viewport] ?? '');
    const page = parseSize(viewport);
    // "1440×900, element" is a crop; only a bare viewport is a whole-page capture.
    if (page && /^\d+\s*[×x]\s*\d+$/.test(viewport)) scales.add(pixels.width / page.width);

    const replacesCell = plain(row[at.Replaces] ?? '');
    const replacesMatch = /^([a-z0-9][a-z0-9-]*\.png)\s*(.*)$/.exec(replacesCell);

    images.push({
      file,
      route: plain(row[at.Route] ?? ''),
      viewport,
      width: pixels.width,
      height: pixels.height,
      shows: plain(row[at['What it shows']] ?? ''),
      use: plain(row[at['Suggested use']] ?? ''),
      replaces: replacesMatch ? replacesMatch[1] : null,
      replacesNote: replacesMatch ? replacesMatch[2].replace(/^\(|\)$/g, '') || null : null,
      figures: plain(row[at.Figures] ?? ''),
    });
  }
  if (images.length === 0) throw new Error('manifest: the image table has no rows');
  if (scales.size !== 1) {
    throw new Error(
      `manifest: whole-page captures must share one device scale factor, found ${[...scales].join(', ') || 'none'}`,
    );
  }
  const [deviceScaleFactor] = scales;
  if (!Number.isInteger(deviceScaleFactor)) {
    throw new Error(`manifest: device scale factor ${deviceScaleFactor} is not a whole number`);
  }
  return { deviceScaleFactor, images };
}

/** Pixel size from a PNG's IHDR chunk; null when the bytes are not a PNG. */
export function pngSize(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
  }
}

async function fetchBytes(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new HttpError(res.status, url);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * A reader for the set on GitHub at `ref`.
 * The ref is resolved to a commit first and every file is read at that commit,
 * so a push to the branch mid-run cannot mix two versions of the set.
 */
export async function githubSource(ref, { repo = SOURCE_REPO, path = SOURCE_PATH, token = process.env.GITHUB_TOKEN } = {}) {
  const headers = { Accept: 'application/vnd.github.sha', 'User-Agent': 'hal0-web-sync-screenshots' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const commit = (await fetchBytes(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`, headers))
    .toString('utf8')
    .trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`could not resolve ${repo}@${ref} to a commit`);
  const base = `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
  return {
    describe: `${repo}@${commit.slice(0, 8)} (${ref})`,
    source: { repo, path, ref, commit },
    read: (file) => fetchBytes(`${base}/${file}`),
  };
}

/**
 * A reader for a local copy of the set: a checkout's docs/screenshots/.
 * The commit is that checkout's HEAD when the directory is inside a git
 * repository and has no uncommitted change under it; otherwise it is unknown.
 */
export async function directorySource(dir, { repo = SOURCE_REPO, path = SOURCE_PATH, commit } = {}) {
  const abs = resolve(dir);
  let resolved = commit ?? null;
  if (!resolved) {
    try {
      const dirty = (await run('git', ['-C', abs, 'status', '--porcelain', '--', '.'])).stdout.trim();
      if (!dirty) resolved = (await run('git', ['-C', abs, 'rev-parse', 'HEAD'])).stdout.trim();
    } catch {
      // Not a git checkout: the commit stays unknown.
    }
  }
  return {
    describe: `${abs}${resolved ? ` (${resolved.slice(0, 8)})` : ''}`,
    source: { repo, path, ref: null, commit: resolved },
    read: (file) => readFile(join(abs, file)),
  };
}

/** Runs `worker` over `items`, a few at a time, keeping the results in order. */
async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
}

async function readOrNull(file) {
  try {
    return await readFile(file);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Write through a temp file so an interrupted run never leaves half a PNG. */
async function writeAtomic(file, bytes) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, file);
}

/**
 * Sync the set from `source` into `root`.
 *
 * @param {{ describe: string, source: object, read: (file: string) => Promise<Buffer> }} source
 * @param {{ root?: string, dryRun?: boolean }} [opts]
 * @returns {Promise<{
 *   images: Array<{ file: string, status: 'new' | 'replaced' | 'unchanged', figures: string, bytes: number }>,
 *   manifestChanged: boolean,
 *   oversize: string[],
 *   unusedRetina: string[],
 *   unlisted: string[],
 * }>}
 *
 * `unusedRetina` are `<name>@2x.png` files beside a capture in the set: the
 * set's own file is already the high-density one, so the site ignores them.
 * `unlisted` are other PNGs in public/screenshots/ that the manifest does not
 * name. Both are only reported.
 */
export async function syncScreenshots(source, { root = ROOT, dryRun = false } = {}) {
  const shotsDir = join(root, 'public/screenshots');
  const dataFile = join(root, 'src/data/screenshots.json');

  const manifest = parseManifest((await source.read(MANIFEST_FILE)).toString('utf8'));

  // Fetch and check everything before the first write.
  const fetched = await mapLimit(manifest.images, CONCURRENCY, async (image) => {
    const bytes = await source.read(image.file);
    const size = pngSize(bytes);
    if (!size) throw new Error(`${image.file} is not a PNG`);
    if (size.width !== image.width || size.height !== image.height) {
      throw new Error(
        `${image.file} is ${size.width}×${size.height}, but the manifest says ${image.width}×${image.height}`,
      );
    }
    return { image, bytes };
  });

  const images = [];
  if (!dryRun) await mkdir(shotsDir, { recursive: true });
  for (const { image, bytes } of fetched) {
    const dest = join(shotsDir, image.file);
    const current = await readOrNull(dest);
    const status = current === null ? 'new' : current.equals(bytes) ? 'unchanged' : 'replaced';
    if (status !== 'unchanged' && !dryRun) await writeAtomic(dest, bytes);
    images.push({ file: image.file, status, figures: image.figures, bytes: bytes.length });
  }

  const data = `${JSON.stringify({ source: source.source, deviceScaleFactor: manifest.deviceScaleFactor, images: manifest.images }, null, 2)}\n`;
  const manifestChanged = (await readOrNull(dataFile))?.toString('utf8') !== data;
  if (manifestChanged && !dryRun) {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeAtomic(dataFile, data);
  }

  const inSet = new Set(manifest.images.map((i) => i.file));
  const onDisk = await listPngs(shotsDir);
  return {
    images,
    manifestChanged,
    oversize: images.filter((i) => i.bytes > SIZE_LIMIT).map((i) => i.file),
    unusedRetina: onDisk.filter((f) => f.endsWith('@2x.png') && inSet.has(f.replace('@2x.png', '.png'))),
    unlisted: onDisk.filter((f) => !inSet.has(f) && !(f.endsWith('@2x.png') && inSet.has(f.replace('@2x.png', '.png')))),
  };
}

async function listPngs(dir) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/** `--ref x`, `--ref=x`, `--from dir`, `--commit sha`, `--dry-run`. */
export function parseArgs(argv) {
  const opts = { ref: DEFAULT_REF, from: null, commit: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    const value = () => {
      const v = inline ?? argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === '--ref') opts.ref = value();
    else if (flag === '--from') opts.from = value();
    else if (flag === '--commit') opts.commit = value();
    else if (flag === '--dry-run') opts.dryRun = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (opts.commit && !/^[0-9a-f]{40}$/.test(opts.commit)) throw new Error('--commit needs a full 40-character commit id');
  return opts;
}

function report(result, source, dryRun) {
  const count = (status) => result.images.filter((i) => i.status === status).length;
  const log = (line = '') => console.log(line);
  log(`[sync-screenshots] ${dryRun ? 'dry run against' : 'synced from'} ${source.describe}`);
  log(
    `[sync-screenshots] ${result.images.length} images: ${count('new')} new, ${count('replaced')} replaced, ${count('unchanged')} unchanged` +
      `${result.manifestChanged ? '; src/data/screenshots.json updated' : ''}`,
  );
  for (const image of result.images) {
    if (image.status !== 'unchanged') log(`  ${image.status.padEnd(8)} ${image.file}  (figures: ${image.figures})`);
  }
  if (result.oversize.length) log(`[sync-screenshots] over 1.5 MB: ${result.oversize.join(', ')}`);
  if (result.unusedRetina.length) {
    log('[sync-screenshots] old @2x files the site no longer uses (kept, not deleted):');
    for (const f of result.unusedRetina) log(`  ${f}`);
  }
  if (result.unlisted.length) {
    log('[sync-screenshots] PNGs in public/screenshots/ that the manifest does not name (kept):');
    for (const f of result.unlisted) log(`  ${f}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const source = opts.from
    ? await directorySource(opts.from, { commit: opts.commit ?? undefined })
    : await githubSource(opts.ref);
  const result = await syncScreenshots(source, { dryRun: opts.dryRun });
  report(result, source, opts.dryRun);
}

// Importable for tests; only a direct run (`npm run sync:screenshots`) syncs.
if (isMain()) {
  main().catch((err) => {
    console.error(`[sync-screenshots] ${err.message}`);
    process.exit(1);
  });
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
