// scripts/test/images.test.mjs
//
// The image derivative pipeline (scripts/build-images.mjs) and the Shot
// component (src/components/Shot.astro, src/lib/shot.ts).
//
// Three layers:
//   1. hermetic: build-images.mjs and the picture resolver run against a
//      throwaway directory with generated PNGs, so they never skip;
//   2. build-dependent: derivatives of the real screenshots in public/ and
//      the built blog pages in dist/client/ (skip with a hint when
//      `npm run build` has not run, like seo.test.mjs);
//   3. landing page: the same checks on the built landing page, skipped with
//      an explicit reason until src/pages/index.astro uses <Shot>.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, utimes } from 'node:fs/promises';
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
// 2. build-dependent: real derivatives and built blog pages

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
// 3. landing page: pending the landing lane

const landingSource = await readFile(path.join(REPO, 'src/pages/index.astro'), 'utf8');
const LANDING_USES_SHOT = /<Shot\b/.test(landingSource);
const skipLanding = !LANDING_USES_SHOT
	? 'landing lane not merged: src/pages/index.astro does not use <Shot> yet'
	: skipBlog;

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
