// scripts/sync-screenshots.mjs: the hal0 dashboard screenshot set, copied into
// public/screenshots/ with its manifest as src/data/screenshots.json.
//
// Hermetic: every sync here reads a scratch directory, never the network. The
// last block checks the committed set against the files on disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

import { directorySource, parseArgs, parseManifest, pngSize, syncScreenshots } from '../sync-screenshots.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const COMMIT = 'a'.repeat(40);

const HEAD = [
  '| File | Route | Viewport | Pixels | What it shows | Suggested use | Replaces (hal0-web `public/screenshots/`) | Figures |',
  '|---|---|---|---|---|---|---|---|',
];
const ROWS = [
  '| `overview.png` | `#dashboard` | 1440×900 | 2880×1800 | Overview page | hero, feature section | overview.png | historical + illustrative |',
  '| `closeup-usage.png` | `#dashboard` | 1440×900, element | 1326×857 | Close-up: Usage card | close-up | requests-widget.png (#3629, nearest) | illustrative |',
  '| `phone-memory.png` | `#memory/health` | 390×844 | 780×1688 | Phone: Memory health | feature section | — | none |',
];
const manifest = (rows = ROWS) => ['# Dashboard screenshots', '', 'Prose before the table.', '', ...HEAD, ...rows, '', 'Prose after.'].join('\n');

const png = (width, height, shade = 40) =>
  sharp({ create: { width, height, channels: 3, background: { r: shade, g: shade, b: shade } } })
    .png()
    .toBuffer();

async function withTmp(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hal0-sync-shots-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The same three rows at a tenth of the size, so the sync tests write small files. */
const SMALL_ROWS = [
  '| `overview.png` | `#dashboard` | 144×90 | 288×180 | Overview page | hero, feature section | overview.png | historical + illustrative |',
  '| `closeup-usage.png` | `#dashboard` | 144×90, element | 132×85 | Close-up: Usage card | close-up | requests-widget.png (#3629, nearest) | illustrative |',
  '| `phone-memory.png` | `#memory/health` | 39×84 | 78×168 | Phone: Memory health | feature section | — | none |',
];

/** A scratch copy of the set and an empty site root. */
async function seed(dir) {
  const from = path.join(dir, 'set');
  const root = path.join(dir, 'site');
  await mkdir(from, { recursive: true });
  await mkdir(path.join(root, 'public/screenshots'), { recursive: true });
  await writeFile(path.join(from, 'README.md'), manifest(SMALL_ROWS));
  await writeFile(path.join(from, 'overview.png'), await png(288, 180));
  await writeFile(path.join(from, 'closeup-usage.png'), await png(132, 85));
  await writeFile(path.join(from, 'phone-memory.png'), await png(78, 168));
  return { from, root };
}

// ---------------------------------------------------------------------------
// the manifest table

test('parseManifest: one entry per table row, cells stripped of backticks', () => {
  const { images, deviceScaleFactor } = parseManifest(manifest());
  assert.equal(deviceScaleFactor, 2, 'pixels divided by viewport, from the whole-page rows');
  assert.deepEqual(images.map((i) => i.file), ['overview.png', 'closeup-usage.png', 'phone-memory.png']);
  assert.deepEqual(images[0], {
    file: 'overview.png',
    route: '#dashboard',
    viewport: '1440×900',
    width: 2880,
    height: 1800,
    shows: 'Overview page',
    use: 'hero, feature section',
    replaces: 'overview.png',
    replacesNote: null,
    figures: 'historical + illustrative',
  });
});

test('parseManifest: the Replaces cell splits into a file name and its note, and a dash names nothing', () => {
  const { images } = parseManifest(manifest());
  assert.deepEqual([images[1].replaces, images[1].replacesNote], ['requests-widget.png', '#3629, nearest']);
  assert.deepEqual([images[2].replaces, images[2].replacesNote], [null, null]);
});

test('parseManifest: an element crop does not vote on the scale factor', () => {
  // Only the crop row: there is no whole-page capture to work the factor out from.
  assert.throws(() => parseManifest(manifest([ROWS[1]])), /device scale factor/);
});

test('parseManifest refuses a table it cannot trust', () => {
  assert.throws(() => parseManifest('# no table here'), /no table/);
  assert.throws(() => parseManifest(manifest().replace('| Figures |', '| Numbers |')), /"Figures" column/);
  assert.throws(() => parseManifest(manifest([ROWS[0].replace('`overview.png`', '`../overview.png`')])), /not a plain PNG file name/);
  assert.throws(() => parseManifest(manifest([ROWS[0], ROWS[0]])), /listed twice/);
  assert.throws(() => parseManifest(manifest([ROWS[0].replace('2880×1800', 'large')])), /Pixels column/);
  assert.throws(() => parseManifest(manifest([])), /no rows/);
  // A 1x page next to a 2x page: the site sizes the whole set by one factor.
  const mixed = '| `flat.png` | `#x` | 1440×900 | 1440×900 | Flat | docs step | — | none |';
  assert.throws(() => parseManifest(manifest([ROWS[0], mixed])), /share one device scale factor/);
});

test('pngSize reads the IHDR chunk and answers null for anything else', async () => {
  assert.deepEqual(pngSize(await png(31, 17)), { width: 31, height: 17 });
  assert.equal(pngSize(Buffer.from('not a png, but long enough to look at')), null);
  assert.equal(pngSize(Buffer.alloc(4)), null);
});

// ---------------------------------------------------------------------------
// the sync

test('sync copies every image byte for byte and writes the manifest as data', async () => {
  await withTmp(async (dir) => {
    const { from, root } = await seed(dir);
    const result = await syncScreenshots(await directorySource(from, { commit: COMMIT }), { root });

    assert.deepEqual(result.images.map((i) => [i.file, i.status]), [
      ['overview.png', 'new'],
      ['closeup-usage.png', 'new'],
      ['phone-memory.png', 'new'],
    ]);
    for (const file of ['overview.png', 'closeup-usage.png', 'phone-memory.png']) {
      const copy = await readFile(path.join(root, 'public/screenshots', file));
      assert.ok(copy.equals(await readFile(path.join(from, file))), `${file} is the same bytes, not a re-encode`);
    }

    const data = JSON.parse(await readFile(path.join(root, 'src/data/screenshots.json'), 'utf8'));
    assert.deepEqual(data.source, { repo: 'Hal0ai/hal0', path: 'docs/screenshots', ref: null, commit: COMMIT });
    assert.equal(data.deviceScaleFactor, 2);
    assert.deepEqual(data.images.map((i) => [i.file, i.width, i.height, i.figures]), [
      ['overview.png', 288, 180, 'historical + illustrative'],
      ['closeup-usage.png', 132, 85, 'illustrative'],
      ['phone-memory.png', 78, 168, 'none'],
    ]);
  });
});

test('sync is idempotent, and reports a changed capture as replaced', async () => {
  await withTmp(async (dir) => {
    const { from, root } = await seed(dir);
    const source = await directorySource(from, { commit: COMMIT });
    await syncScreenshots(source, { root });

    const again = await syncScreenshots(source, { root });
    assert.deepEqual([...new Set(again.images.map((i) => i.status))], ['unchanged']);
    assert.equal(again.manifestChanged, false);

    await writeFile(path.join(from, 'overview.png'), await png(288, 180, 200));
    const third = await syncScreenshots(source, { root });
    assert.deepEqual(third.images.filter((i) => i.status !== 'unchanged').map((i) => [i.file, i.status]), [['overview.png', 'replaced']]);
    assert.ok((await readFile(path.join(root, 'public/screenshots/overview.png'))).equals(await readFile(path.join(from, 'overview.png'))));
  });
});

test('sync never deletes: older captures and stale @2x files stay, and are reported', async () => {
  await withTmp(async (dir) => {
    const { from, root } = await seed(dir);
    const shots = path.join(root, 'public/screenshots');
    const old = await png(20, 10);
    for (const f of ['overview.png', 'overview@2x.png', 'slot-card.png', 'slot-card@2x.png']) await writeFile(path.join(shots, f), old);

    const result = await syncScreenshots(await directorySource(from, { commit: COMMIT }), { root });
    assert.equal(result.images.find((i) => i.file === 'overview.png').status, 'replaced');
    assert.deepEqual(result.unusedRetina, ['overview@2x.png'], 'the retina file of a replaced capture is no longer used');
    assert.deepEqual(result.unlisted, ['slot-card.png', 'slot-card@2x.png'], 'captures the manifest does not name');
    assert.deepEqual((await readdir(shots)).sort(), [
      'closeup-usage.png',
      'overview.png',
      'overview@2x.png',
      'phone-memory.png',
      'slot-card.png',
      'slot-card@2x.png',
    ]);
    assert.ok((await readFile(path.join(shots, 'overview@2x.png'))).equals(old), 'left exactly as it was');
  });
});

test('one bad file stops the run before anything is written', async () => {
  await withTmp(async (dir) => {
    const { from, root } = await seed(dir);
    const source = await directorySource(from, { commit: COMMIT });

    // The right name, the wrong size.
    await writeFile(path.join(from, 'phone-memory.png'), await png(78, 100));
    await assert.rejects(syncScreenshots(source, { root }), /phone-memory\.png is 78×100, but the manifest says 78×168/);
    assert.deepEqual(await readdir(path.join(root, 'public/screenshots')), [], 'no image written');
    await assert.rejects(readFile(path.join(root, 'src/data/screenshots.json')), { code: 'ENOENT' });

    await writeFile(path.join(from, 'phone-memory.png'), 'not a png');
    await assert.rejects(syncScreenshots(source, { root }), /phone-memory\.png is not a PNG/);

    await rm(path.join(from, 'phone-memory.png'));
    await assert.rejects(syncScreenshots(source, { root }), { code: 'ENOENT' });
    assert.deepEqual(await readdir(path.join(root, 'public/screenshots')), []);
  });
});

test('a dry run reports the same plan and writes nothing', async () => {
  await withTmp(async (dir) => {
    const { from, root } = await seed(dir);
    const result = await syncScreenshots(await directorySource(from, { commit: COMMIT }), { root, dryRun: true });
    assert.deepEqual([...new Set(result.images.map((i) => i.status))], ['new']);
    assert.equal(result.manifestChanged, true);
    assert.deepEqual(await readdir(path.join(root, 'public/screenshots')), []);
    await assert.rejects(readFile(path.join(root, 'src/data/screenshots.json')), { code: 'ENOENT' });
  });
});

test('a directory that is not a git checkout has no commit to record', async () => {
  await withTmp(async (dir) => {
    const { from } = await seed(dir);
    const source = await directorySource(from);
    assert.equal(source.source.commit, null);
    assert.equal(source.source.ref, null);
  });
});

test('parseArgs', () => {
  assert.deepEqual(parseArgs([]), { ref: 'main', from: null, commit: null, dryRun: false });
  assert.deepEqual(parseArgs(['--ref', 'docs/website-screenshots', '--dry-run']), {
    ref: 'docs/website-screenshots',
    from: null,
    commit: null,
    dryRun: true,
  });
  assert.deepEqual(parseArgs([`--from=/tmp/set`, `--commit=${COMMIT}`]), { ref: 'main', from: '/tmp/set', commit: COMMIT, dryRun: false });
  assert.throws(() => parseArgs(['--ref']), /--ref needs a value/);
  assert.throws(() => parseArgs(['--ref', '--dry-run']), /--ref needs a value/);
  assert.throws(() => parseArgs(['--commit', 'abc123']), /40-character/);
  assert.throws(() => parseArgs(['--delete']), /unknown argument/);
});

// ---------------------------------------------------------------------------
// the committed set

test('package.json has the sync:screenshots script and keeps it out of prebuild', async () => {
  const pkg = JSON.parse(await readFile(path.join(REPO, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['sync:screenshots'], 'node scripts/sync-screenshots.mjs');
  assert.doesNotMatch(pkg.scripts.prebuild, /sync-screenshots/, 'an 18 MB download does not belong in every build');
});

test('every image in src/data/screenshots.json is on disk at the size the manifest states', async () => {
  const data = JSON.parse(await readFile(path.join(REPO, 'src/data/screenshots.json'), 'utf8'));
  assert.match(data.source.commit, /^[0-9a-f]{40}$/, 'the set records the hal0 commit it came from');
  assert.equal(data.source.repo, 'Hal0ai/hal0');
  assert.equal(data.deviceScaleFactor, 2);
  assert.ok(data.images.length >= 60, `the set has ${data.images.length} images`);
  for (const image of data.images) {
    const size = pngSize(await readFile(path.join(REPO, 'public/screenshots', image.file)));
    assert.deepEqual(size, { width: image.width, height: image.height }, image.file);
    assert.match(image.figures, /^(none|historical|illustrative|historical \+ illustrative)$/, `${image.file}: a known Figures value`);
    assert.ok(image.shows.length > 0, `${image.file}: says what it shows`);
  }
});
