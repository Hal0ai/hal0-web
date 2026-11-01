// scripts/test/images.test.mjs
//
// The image derivative pipeline (scripts/build-images.mjs) and the Shot
// component (src/components/Shot.astro, src/lib/shot.ts).
//
// Four layers:
//   1. hermetic: build-images.mjs and the picture resolver run against a
//      throwaway directory with generated PNGs, so they never skip;
//   2. component: Shot.astro rendered by a real (tiny) `astro build` of a
//      fixture page, covering what no real page uses yet (caption prop and
//      slot, placeholder, eager); never skips;
//   3. build-dependent: derivatives of the real screenshots in public/ and
//      the built blog pages in dist/client/ (skip with a hint when
//      `npm run build` has not run, like seo.test.mjs);
//   4. landing page: the same checks on the built landing page, skipped with
//      an explicit reason until it renders <Shot> figures.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

import { buildImages, HERMES_WIDTH } from '../build-images.mjs';
import { pictureSources, resolveShot } from '../../src/lib/shot.ts';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PUBLIC = path.join(REPO, 'public');
const DIST = path.join(REPO, 'dist/client');

const exists = (p) => access(p).then(() => true, () => false);

// ---------------------------------------------------------------------------
// helpers

/** A deterministic, UI-ish PNG: a gradient with mild noise. Lossless PNG keeps the noise, AVIF/WebP drop it. */
async function makePng(file, width, height) {
	await mkdir(path.dirname(file), { recursive: true });
	const buf = Buffer.alloc(width * height * 3);
	let seed = 1234567;
	const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 3;
			const n = rnd() * 24;
			buf[i] = 30 + (x / width) * 150 + n;
			buf[i + 1] = 20 + (y / height) * 120 + n;
			buf[i + 2] = 60 + n * 2;
		}
	}
	await sharp(buf, { raw: { width, height, channels: 3 } }).png().toFile(file);
}

async function withTmp(fn) {
	const dir = await mkdtemp(path.join(tmpdir(), 'hal0-images-'));
	try {
		return await fn(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/** A scratch repo root holding a screenshot with a @2x sibling, a screenshot without one, and the Hermes portrait. */
async function seedRoot(root) {
	await makePng(path.join(root, 'public/screenshots/demo.png'), 480, 300);
	await makePng(path.join(root, 'public/screenshots/demo@2x.png'), 960, 600);
	await makePng(path.join(root, 'public/screenshots/solo.png'), 320, 200);
	await makePng(path.join(root, 'public/agents/hermes.png'), 1488, 1202);
	// Not a build input: only hermes.png in agents/ is resized.
	await makePng(path.join(root, 'public/agents/other.png'), 200, 200);
}

const EXPECTED_WRITES = [
	'public/agents/hermes-744.avif',
	'public/agents/hermes-744.png',
	'public/agents/hermes-744.webp',
	'public/agents/hermes.avif',
	'public/agents/hermes.webp',
	'public/screenshots/demo.avif',
	'public/screenshots/demo.webp',
	'public/screenshots/demo@2x.avif',
	'public/screenshots/demo@2x.webp',
	'public/screenshots/solo.avif',
	'public/screenshots/solo.webp',
];

const quiet = () => {};

// ---------------------------------------------------------------------------
// 1a. build-images.mjs (hermetic)

test('build-images writes avif and webp siblings that are smaller than the png', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		const res = await buildImages({ root, log: quiet });
		assert.deepEqual([...res.written].sort(), EXPECTED_WRITES);
		for (const png of ['screenshots/demo', 'screenshots/demo@2x', 'screenshots/solo', 'agents/hermes']) {
			const pngSize = (await stat(path.join(root, 'public', `${png}.png`))).size;
			for (const ext of ['avif', 'webp']) {
				const derived = await stat(path.join(root, 'public', `${png}.${ext}`));
				assert.ok(derived.size > 0 && derived.size < pngSize, `${png}.${ext} (${derived.size}) is smaller than its png (${pngSize})`);
			}
		}
	});
});

test('build-images resizes hermes.png to a 744px-wide hermes-744.png and gives it derivatives', async () => {
	assert.equal(HERMES_WIDTH, 744);
	await withTmp(async (root) => {
		await seedRoot(root);
		await buildImages({ root, log: quiet });
		const meta = await sharp(path.join(root, 'public/agents/hermes-744.png')).metadata();
		assert.equal(meta.width, 744);
		assert.equal(meta.height, Math.round((1202 * 744) / 1488), 'aspect ratio is kept');
		for (const ext of ['avif', 'webp']) {
			const m = await sharp(path.join(root, `public/agents/hermes-744.${ext}`)).metadata();
			assert.equal(m.width, 744, `hermes-744.${ext} is 744px wide`);
		}
		assert.equal(await exists(path.join(root, 'public/agents/other.avif')), false, 'agents/other.png is not an input');
		assert.equal(await exists(path.join(root, 'public/agents/hermes-744-744.png')), false, 'a derivative is never re-processed as a source');
	});
});

test('build-images is incremental: a second run writes nothing, a stale or missing derivative is rebuilt alone', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		await buildImages({ root, log: quiet });

		const again = await buildImages({ root, log: quiet });
		assert.deepEqual(again.written, [], 'nothing to do on an up-to-date tree');
		assert.equal(again.skipped.length, EXPECTED_WRITES.length);

		// demo.png was edited after its derivatives were built.
		const old = new Date(Date.now() - 60_000);
		await utimes(path.join(root, 'public/screenshots/demo.avif'), old, old);
		await utimes(path.join(root, 'public/screenshots/demo.webp'), old, old);
		// solo.webp was never built (or was deleted).
		await rm(path.join(root, 'public/screenshots/solo.webp'));

		const third = await buildImages({ root, log: quiet });
		assert.deepEqual(
			[...third.written].sort(),
			['public/screenshots/demo.avif', 'public/screenshots/demo.webp', 'public/screenshots/solo.webp'],
		);
	});
});

test('build-images names the source PNG of a derivative that fails, and still builds the rest', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		await writeFile(path.join(root, 'public/screenshots/broken.png'), 'not a png');
		await assert.rejects(
			buildImages({ root, log: quiet }),
			(err) => {
				assert.match(err.message, /2 derivative\(s\) failed/);
				assert.match(err.message, /public\/screenshots\/broken\.avif \(from public\/screenshots\/broken\.png\)/);
				assert.match(err.message, /public\/screenshots\/broken\.webp \(from public\/screenshots\/broken\.png\)/);
				return true;
			},
		);
		assert.ok(await exists(path.join(root, 'public/screenshots/demo.avif')), 'a healthy screenshot is still built');
		assert.ok(await exists(path.join(root, 'public/agents/hermes-744.png')), 'so is the Hermes resize');
		assert.equal(await exists(path.join(root, 'public/screenshots/broken.avif')), false, 'no truncated file is left behind');
		assert.deepEqual((await readdir(path.join(root, 'public/screenshots'))).filter((f) => f.endsWith('.tmp')), [], 'no temp file is left behind');
	});
});

test('build-images tolerates a tree with no screenshots or Hermes portrait', async () => {
	await withTmp(async (root) => {
		await mkdir(path.join(root, 'public'), { recursive: true });
		const res = await buildImages({ root, log: quiet });
		assert.deepEqual(res.written, []);
	});
});

// ---------------------------------------------------------------------------
// 1b. picture resolver behind <Shot> (hermetic)

test('resolveShot: avif, webp, then png, with 1x/2x descriptors only when the @2x png exists', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		await buildImages({ root, log: quiet });
		const publicDir = path.join(root, 'public');

		const withRetina = resolveShot('demo', { publicDir });
		assert.deepEqual(withRetina.sources, [
			{ type: 'image/avif', srcset: '/screenshots/demo.avif 1x, /screenshots/demo@2x.avif 2x' },
			{ type: 'image/webp', srcset: '/screenshots/demo.webp 1x, /screenshots/demo@2x.webp 2x' },
		]);
		assert.equal(withRetina.src, '/screenshots/demo.png');
		assert.equal(withRetina.srcset, '/screenshots/demo.png 1x, /screenshots/demo@2x.png 2x');
		assert.deepEqual([withRetina.width, withRetina.height], [480, 300], 'intrinsic size comes from the png');

		const single = resolveShot('solo', { publicDir });
		assert.deepEqual(single.sources, [
			{ type: 'image/avif', srcset: '/screenshots/solo.avif' },
			{ type: 'image/webp', srcset: '/screenshots/solo.webp' },
		]);
		assert.equal(single.src, '/screenshots/solo.png');
		assert.equal(single.srcset, undefined, 'no 2x png, no srcset');
	});
});

test('resolveShot: a format without its derivatives is left out instead of 404ing', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		await buildImages({ root, log: quiet });
		const publicDir = path.join(root, 'public');

		// webp missing entirely (never built, e.g. `astro dev` before prebuild)
		await rm(path.join(root, 'public/screenshots/demo.webp'));
		await rm(path.join(root, 'public/screenshots/demo@2x.webp'));
		assert.deepEqual(resolveShot('demo', { publicDir }).sources.map((s) => s.type), ['image/avif']);

		// avif only half there: 1x without 2x would pair the wrong pixels with a retina screen
		await rm(path.join(root, 'public/screenshots/demo@2x.avif'));
		assert.deepEqual(resolveShot('demo', { publicDir }).sources, []);

		// nothing built at all
		await rm(path.join(root, 'public/screenshots/solo.avif'));
		await rm(path.join(root, 'public/screenshots/solo.webp'));
		const bare = resolveShot('solo', { publicDir });
		assert.deepEqual(bare.sources, []);
		assert.equal(bare.src, '/screenshots/solo.png');
	});
});

test('resolveShot: explicit width and height win, one alone scales the other, bad names throw', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		const publicDir = path.join(root, 'public');
		const both = resolveShot('demo', { publicDir, width: 100, height: 50 });
		assert.deepEqual([both.width, both.height], [100, 50]);
		const onlyW = resolveShot('demo', { publicDir, width: 240 });
		assert.deepEqual([onlyW.width, onlyW.height], [240, 150]);

		assert.throws(() => resolveShot('missing-shot', { publicDir }), /missing-shot/);
		for (const bad of ['../secret', 'demo@2x', 'Demo Shot', 'a/b', '']) {
			assert.throws(() => resolveShot(bad, { publicDir }), /name/i, `rejects ${JSON.stringify(bad)}`);
		}
	});
});

test('resolveShot: placeholder mode answers a missing PNG with a sized stand-in, never for a bad name', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		const publicDir = path.join(root, 'public');

		assert.throws(() => resolveShot('not-captured-yet', { publicDir }), /not-captured-yet/, 'throwing stays the default');
		assert.throws(() => resolveShot('not-captured-yet', { publicDir, placeholder: false }), /not-captured-yet/);

		const ph = resolveShot('not-captured-yet', { publicDir, placeholder: true });
		assert.equal(ph.missing, true);
		assert.deepEqual(ph.sources, []);
		assert.deepEqual([ph.width, ph.height], [1440, 900], 'defaults to the capture viewport');
		const half = resolveShot('not-captured-yet', { publicDir, placeholder: true, width: 600 });
		assert.deepEqual([half.width, half.height], [600, 375], 'one dimension scales the other at 1440:900');
		const sized = resolveShot('not-captured-yet', { publicDir, placeholder: true, width: 600, height: 300 });
		assert.deepEqual([sized.width, sized.height], [600, 300]);

		const real = resolveShot('demo', { publicDir, placeholder: true });
		assert.equal(real.missing, false, 'a PNG that exists renders normally even in placeholder mode');
		assert.deepEqual([real.width, real.height], [480, 300]);
		assert.equal(resolveShot('demo', { publicDir }).missing, false);

		assert.throws(() => resolveShot('../secret', { publicDir, placeholder: true }), /name/i, 'a malformed name is a bug, not a missing capture');
	});
});

test('pictureSources pairs the Hermes 744 and full-size portraits as 1x and 2x', async () => {
	await withTmp(async (root) => {
		await seedRoot(root);
		await buildImages({ root, log: quiet });
		const { sources, srcset } = pictureSources(['/agents/hermes-744', '/agents/hermes'], path.join(root, 'public'));
		assert.deepEqual(sources, [
			{ type: 'image/avif', srcset: '/agents/hermes-744.avif 1x, /agents/hermes.avif 2x' },
			{ type: 'image/webp', srcset: '/agents/hermes-744.webp 1x, /agents/hermes.webp 2x' },
		]);
		assert.equal(srcset, '/agents/hermes-744.png 1x, /agents/hermes.png 2x');
	});
});

// ---------------------------------------------------------------------------
// 1c. wiring (hermetic, reads the repo)

test('prebuild runs build-images and the derivatives stay out of git', async () => {
	const pkg = JSON.parse(await readFile(path.join(REPO, 'package.json'), 'utf8'));
	assert.match(pkg.scripts.prebuild, /node scripts\/build-images\.mjs/);
	assert.equal(pkg.scripts['build:images'], 'node scripts/build-images.mjs');

	let gitOk = true;
	try {
		execFileSync('git', ['rev-parse', '--git-dir'], { cwd: REPO, stdio: 'ignore' });
	} catch {
		gitOk = false;
	}
	if (!gitOk) return; // tarball checkout: nothing to ask git
	for (const p of [
		'public/screenshots/x.avif',
		'public/screenshots/x@2x.webp',
		'public/agents/hermes.avif',
		'public/agents/hermes-744.png',
		'public/agents/hermes-744.webp',
		'public/screenshots/x.avif.12345.tmp', // leftover from an interrupted build-images run
		'public/agents/hermes-744.png.12345.tmp',
	]) {
		let ignored = true;
		try {
			execFileSync('git', ['check-ignore', '-q', p], { cwd: REPO, stdio: 'ignore' });
		} catch {
			ignored = false;
		}
		assert.ok(ignored, `${p} is gitignored`);
	}
	// ...but the source portrait and the screenshots themselves stay tracked.
	for (const p of ['public/agents/hermes.png', 'public/screenshots/dashboard-overview.png']) {
		let ignored = false;
		try {
			execFileSync('git', ['check-ignore', '-q', p], { cwd: REPO, stdio: 'ignore' });
			ignored = true;
		} catch {}
		assert.equal(ignored, false, `${p} must not be ignored`);
	}
});

// ---------------------------------------------------------------------------
// 2. Shot.astro rendered by a real astro build of a fixture page
//
// The blog posts use neither captions nor placeholders, so the component is
// built here from a throwaway project under .astro/ (gitignored; inside the repo
// so astro's own runtime resolves from node_modules). Shot reads public/ from
// process.cwd(), so the build runs with the repo as cwd and finds the real
// slot-card capture.

const FIXTURE_PAGE = `---
import Shot from ${JSON.stringify(path.join(REPO, 'src/components/Shot.astro'))};
---
<html lang="en"><head><title>fixture</title></head><body>
  <Shot name="slot-card" alt="prop caption case" caption="Slots & profiles <b>not bold</b>" />
  <Shot name="slot-card" alt="slot caption case"><Fragment slot="caption"><strong>Slots</strong>: rich caption</Fragment></Shot>
  <Shot name="slot-card" alt="slot beats prop case" caption="from the prop"><Fragment slot="caption">from the slot</Fragment></Shot>
  <Shot name="slot-card" alt="no caption case" />
  <Shot name="slot-card" alt="eager case" loading="eager" />
  <Shot name="not-captured-yet" alt="placeholder case" placeholder caption="Coming soon" />
  <Shot name="not-captured-yet-too" alt="placeholder sized case" placeholder width={600} height={300} />
  <Shot name="slot-card" alt="placeholder flag, png exists case" placeholder />
</body></html>
`;

let fixtureRoot;
let fixturePromise;
/** Build the fixture once; resolves to { html, css }. */
function shotFixture() {
	fixturePromise ??= (async () => {
		const base = path.join(REPO, '.astro/test-fixtures');
		await mkdir(base, { recursive: true });
		fixtureRoot = await mkdtemp(path.join(base, 'shot-'));
		await mkdir(path.join(fixtureRoot, 'src/pages'), { recursive: true });
		await writeFile(path.join(fixtureRoot, 'src/pages/index.astro'), FIXTURE_PAGE);
		const { build } = await import('astro');
		const cwd = process.cwd();
		process.chdir(REPO);
		try {
			await build({ root: fixtureRoot, configFile: false, logLevel: 'silent', outDir: path.join(fixtureRoot, 'dist') });
		} finally {
			process.chdir(cwd);
		}
		const html = await readFile(path.join(fixtureRoot, 'dist/index.html'), 'utf8');
		const cssDir = path.join(fixtureRoot, 'dist/_astro');
		const files = (await exists(cssDir)) ? (await readdir(cssDir)).filter((f) => f.endsWith('.css')) : [];
		const sheets = await Promise.all(files.map((f) => readFile(path.join(cssDir, f), 'utf8')));
		const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
		return { html, css: [...sheets, ...inline].join('\n') };
	})();
	return fixturePromise;
}

after(async () => {
	if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

/** The <figure> whose img alt (or placeholder aria-label) is `alt`. */
function figureFor(html, alt) {
	const hit = [...html.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map((m) => m[0]).find((f) => f.includes(`"${alt}"`));
	assert.ok(hit, `fixture has a figure for ${JSON.stringify(alt)}`);
	return hit;
}

test('Shot caption prop: plain text, escaped', async () => {
	const { html } = await shotFixture();
	const fig = figureFor(html, 'prop caption case');
	assert.match(fig, /<figcaption\b[^>]*\bclass="shot-cap[^"]*"[^>]*>Slots &amp; profiles &lt;b&gt;not bold&lt;\/b&gt;<\/figcaption>/);
	assert.match(fig, /<picture\b/);
});

test('Shot caption slot: rich markup is kept, and the slot wins over the prop', async () => {
	const { html } = await shotFixture();
	const rich = figureFor(html, 'slot caption case');
	assert.match(rich, /<figcaption\b[^>]*\bclass="shot-cap[^"]*"[^>]*>\s*<strong>Slots<\/strong>: rich caption\s*<\/figcaption>/);
	const both = figureFor(html, 'slot beats prop case');
	assert.match(both, /<figcaption\b[^>]*>\s*from the slot\s*<\/figcaption>/);
	assert.doesNotMatch(both, /from the prop/);
});

test('Shot without a caption renders no <figcaption>', async () => {
	const { html } = await shotFixture();
	assert.doesNotMatch(figureFor(html, 'no caption case'), /<figcaption/);
});

test('Shot loading: lazy by default, eager adds fetchpriority=high', async () => {
	const { html } = await shotFixture();
	const lazy = figureFor(html, 'no caption case');
	assert.match(lazy, /\sloading="lazy"/);
	assert.doesNotMatch(lazy, /fetchpriority/);
	const eager = figureFor(html, 'eager case');
	assert.match(eager, /\sloading="eager"/);
	assert.match(eager, /\sfetchpriority="high"/);
});

test('Shot placeholder: a missing PNG keeps the TODO(shots) comment and a labelled, sized box', async () => {
	const { html } = await shotFixture();
	const fig = figureFor(html, 'placeholder case');
	assert.match(fig, /^<figure\b[^>]*\bclass="shot shot-missing[^"]*"/);
	assert.ok(fig.includes('<!-- TODO(shots): not-captured-yet -->'), 'astro keeps the HTML comment in the built output');
	assert.match(fig, /<div\b[^>]*\brole="img"[^>]*\baria-label="placeholder case"/);
	assert.match(fig, /aspect-ratio:\s*1440\s*\/\s*900/);
	assert.doesNotMatch(fig, /<picture|<img\b/);
	assert.match(fig, /<figcaption\b[^>]*>Coming soon<\/figcaption>/);

	const sized = figureFor(html, 'placeholder sized case');
	assert.ok(sized.includes('<!-- TODO(shots): not-captured-yet-too -->'));
	assert.match(sized, /aspect-ratio:\s*600\s*\/\s*300/);
});

test('Shot placeholder: a PNG that exists renders the normal picture, with no stand-in markers', async () => {
	const { html } = await shotFixture();
	const fig = figureFor(html, 'placeholder flag, png exists case');
	assert.match(fig, /<picture\b/);
	assert.doesNotMatch(fig, /shot-missing|TODO\(shots\)|role="img"/);
});

test('Shot styles: no figure margin (Starlight and grids own the gaps), bold stays in slotted captions', async () => {
	const { css } = await shotFixture();
	// Any unlayered margin here would beat Starlight's layered sibling spacing between a paragraph and the figure.
	const figureRules = [...css.matchAll(/(?:^|[}\s])(\.shot(?![-\w])[^{]*)\{([^}]*)\}/g)];
	assert.ok(figureRules.length > 0, 'found the .shot rule');
	for (const [, selector, body] of figureRules) assert.doesNotMatch(body, /margin/, `${selector.trim()} sets no margin`);
	assert.match(css, /\.shot-cap[^{]*\sstrong[^{]*\{[^}]*font-weight:\s*600/, 'slotted <strong> in a caption is bold');
});

// ---------------------------------------------------------------------------
// 3. build-dependent: real derivatives and built blog pages

const derived = await exists(path.join(PUBLIC, 'screenshots/dashboard-overview.avif'));
const builtBlog = await exists(path.join(DIST, 'blog'));
const skipDerived = !derived && 'run npm run build first (prebuild writes the derivatives)';
const skipBlog = (!derived || !builtBlog) && 'run npm run build first';

/** Every png under public/screenshots (1x and @2x) plus the Hermes portraits. */
async function sourcePngs() {
	const shots = (await readdir(path.join(PUBLIC, 'screenshots'))).filter((f) => f.endsWith('.png')).map((f) => `screenshots/${f}`);
	return [...shots, 'agents/hermes.png', 'agents/hermes-744.png'];
}

test('every screenshot and Hermes portrait has avif and webp derivatives smaller than the png', { skip: skipDerived }, async () => {
	const pngs = await sourcePngs();
	assert.ok(pngs.length > 40, `found ${pngs.length} source pngs`);
	const larger = [];
	for (const rel of pngs) {
		const pngSize = (await stat(path.join(PUBLIC, rel))).size;
		for (const ext of ['avif', 'webp']) {
			const file = path.join(PUBLIC, rel.replace(/\.png$/, `.${ext}`));
			assert.ok(await exists(file), `${rel.replace(/\.png$/, `.${ext}`)} exists`);
			const size = (await stat(file)).size;
			if (size >= pngSize) larger.push(`${rel.replace(/\.png$/, `.${ext}`)}: ${size} >= ${pngSize}`);
		}
	}
	assert.deepEqual(larger, [], 'every derivative is smaller than its png');
});

test('hermes-744.png is 744px wide', { skip: skipDerived }, async () => {
	const meta = await sharp(path.join(PUBLIC, 'agents/hermes-744.png')).metadata();
	assert.equal(meta.width, 744);
});

/** All <picture> blocks in an html string, and the html with them removed. */
function splitPictures(html) {
	const pictures = [...html.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/g)].map((m) => m[1]);
	const rest = html.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/g, '');
	return { pictures, rest };
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** Assert one <picture> body is avif source, webp source, png <img>, with sizes and the retina rule. */
async function assertPictureSemantics(body, where) {
	const sources = body.match(/<source\b[^>]*>/g) ?? [];
	assert.deepEqual(sources.map((s) => attr(s, 'type')), ['image/avif', 'image/webp'], `${where}: avif source, then webp source`);
	const img = body.match(/<img\b[^>]*>/)?.[0];
	assert.ok(img, `${where}: has an <img> fallback`);
	assert.ok(body.indexOf(img) > body.lastIndexOf(sources[1]), `${where}: <img> comes after the sources`);

	const src = attr(img, 'src');
	assert.match(src, /^\/screenshots\/[a-z0-9-]+\.png$/, `${where}: img src is the png (the lightbox binds on /screenshots/)`);
	const w = Number(attr(img, 'width'));
	const h = Number(attr(img, 'height'));
	assert.ok(w > 0 && h > 0, `${where}: img has width and height`);
	const meta = await sharp(path.join(PUBLIC, src)).metadata();
	assert.deepEqual([w, h], [meta.width, meta.height], `${where}: width/height are the png's intrinsic size`);
	assert.ok(['lazy', 'eager'].includes(attr(img, 'loading')), `${where}: loading is set`);
	assert.equal(attr(img, 'decoding'), 'async', `${where}: decoding is async`);
	assert.ok(attr(img, 'alt')?.length > 0, `${where}: alt text`);

	const base = src.replace(/\.png$/, '');
	const hasRetina = await exists(path.join(PUBLIC, `${base}@2x.png`));
	for (const [s, ext] of [[sources[0], 'avif'], [sources[1], 'webp']]) {
		const srcset = attr(s, 'srcset');
		assert.equal(
			srcset,
			hasRetina ? `${base}.${ext} 1x, ${base}@2x.${ext} 2x` : `${base}.${ext}`,
			`${where}: ${ext} srcset follows the @2x png`,
		);
		for (const url of srcset.split(',').map((p) => p.trim().split(/\s+/)[0])) {
			assert.ok(await exists(path.join(DIST, url)), `${where}: ${url} is in dist/client`);
		}
	}
	assert.equal(attr(img, 'srcset'), hasRetina ? `${base}.png 1x, ${base}@2x.png 2x` : undefined, `${where}: img srcset follows the @2x png`);
	return src;
}

test('blog posts reference screenshots only through <Shot>', async () => {
	const dir = path.join(REPO, 'src/content/docs/blog');
	let shots = 0;
	for (const f of (await readdir(dir)).filter((n) => n.endsWith('.mdx'))) {
		const src = await readFile(path.join(dir, f), 'utf8');
		assert.doesNotMatch(src, /\/screenshots\//, `${f} has no raw /screenshots/ path`);
		for (const m of src.matchAll(/<Shot\b[^>]*?\/>/gs)) {
			assert.match(m[0], /\bname="[a-z0-9-]+"/, `${f}: <Shot> carries a name`);
			assert.match(m[0], /\balt="[^"]+"/, `${f}: <Shot> carries alt text`);
			shots++;
		}
		if (/<Shot\b/.test(src)) assert.match(src, /import Shot from ['"][./]+components\/Shot\.astro['"]/, `${f} imports Shot`);
	}
	assert.ok(shots >= 7, `blog posts use <Shot> ${shots} times`);
});

test('built blog pages wrap every screenshot in a correct <picture>', { skip: skipBlog }, async () => {
	const posts = (await readdir(path.join(DIST, 'blog'), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
	let total = 0;
	for (const slug of posts) {
		const file = path.join(DIST, 'blog', slug, 'index.html');
		if (!(await exists(file))) continue;
		const html = await readFile(file, 'utf8');
		const { pictures, rest } = splitPictures(html);
		assert.doesNotMatch(rest, /<img\b[^>]*\ssrc="\/screenshots\//, `/blog/${slug}/: no bare <img src="/screenshots/ outside <picture>`);
		for (const [i, body] of pictures.entries()) {
			if (!/src="\/screenshots\//.test(body)) continue;
			await assertPictureSemantics(body, `/blog/${slug}/ picture ${i + 1}`);
			total++;
		}
	}
	const mdxShots = (await Promise.all(
		(await readdir(path.join(REPO, 'src/content/docs/blog')))
			.filter((n) => n.endsWith('.mdx'))
			.map(async (n) => (await readFile(path.join(REPO, 'src/content/docs/blog', n), 'utf8')).match(/<Shot\b/g)?.length ?? 0),
	)).reduce((a, b) => a + b, 0);
	assert.equal(total, mdxShots, 'one <picture> per <Shot> in the blog sources');
	assert.ok(total >= 7);
});

test('the figure is class="shot" and the lightbox still finds the png', { skip: skipBlog }, async () => {
	const html = await readFile(path.join(DIST, 'blog/whats-new-since-1-0/index.html'), 'utf8');
	assert.match(html, /<figure\b[^>]*class="[^"]*\bshot\b[^"]*"[^>]*>\s*<picture\b/);
	// public/js/lightbox.js binds on img[src*="/screenshots/"]
	assert.match(html, /<picture\b[\s\S]*?<img\b[^>]*\ssrc="\/screenshots\/runner-images\.png"/);
});

// ---------------------------------------------------------------------------
// 4. landing page: pending the landing lane
//
// Un-skips on the BUILT page, not on index.astro's source (which may move or
// be split into components): once the landing renders a <Shot> figure
// (`<figure class="shot"><picture>`), both tests below must pass. The picture
// is part of the trigger because the pre-<Shot> landing already has a
// hand-written `<figure class="shot">` around a bare <img>.

const landingHtml = await readFile(path.join(DIST, 'index.html'), 'utf8').catch(() => null);
const LANDING_RENDERS_SHOT = /<figure\b[^>]*\bclass="shot\b[^"]*"[^>]*>\s*<picture\b/.test(landingHtml ?? '');
const skipLanding =
	skipBlog || landingHtml === null
		? 'run npm run build first'
		: !LANDING_RENDERS_SHOT && 'landing lane not merged: the built landing page has no <Shot> figure yet';

test('landing page: every console shot is a <picture> and no bare screenshot <img> is left', { skip: skipLanding }, async () => {
	const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
	const { pictures, rest } = splitPictures(html);
	assert.doesNotMatch(rest, /<img\b[^>]*\ssrc="\/screenshots\//, 'no bare <img src="/screenshots/ outside <picture>');
	const shots = pictures.filter((b) => /src="\/screenshots\//.test(b));
	assert.ok(shots.length >= 4, `landing has ${shots.length} screenshot pictures`);
	for (const [i, body] of shots.entries()) await assertPictureSemantics(body, `/ picture ${i + 1}`);
});

test('landing page: every screenshot it shows has derivatives smaller than the png', { skip: skipLanding }, async () => {
	const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
	const names = [...new Set([...html.matchAll(/\ssrc="\/screenshots\/([a-z0-9-]+)\.png"/g)].map((m) => m[1]))];
	assert.ok(names.length >= 4);
	for (const n of names) {
		const png = (await stat(path.join(PUBLIC, `screenshots/${n}.png`))).size;
		for (const ext of ['avif', 'webp']) {
			const size = (await stat(path.join(PUBLIC, `screenshots/${n}.${ext}`))).size;
			assert.ok(size < png, `${n}.${ext} (${size}) < ${n}.png (${png})`);
		}
	}
});
