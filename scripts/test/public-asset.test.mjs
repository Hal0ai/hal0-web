// scripts/test/public-asset.test.mjs
//
// src/lib/public-asset.mjs: cache-busting URLs for the scripts in public/js/.
// Those files are served under a long Cache-Control (the /js/ rule in
// vercel.json, stretched further by Cloudflare), so a changed script at a
// stable URL kept serving the previous copy to returning visitors: the
// lightbox gallery of #140 opened without its ‹ › buttons for anyone whose
// browser still held the older file. Every <script src="/js/…"> therefore
// carries the file's content hash.
//
// Three layers:
//   1. hermetic: the helper against a throwaway public/ directory;
//   2. source: no script tag in src/ or astro.config.mjs names a /js/ file
//      bare, and every file in public/js/ is referenced through versioned();
//   3. build-dependent: the built landing (MarketingLayout) and blog index
//      (the Starlight head and PageFrame; the docs live on the forum) carry
//      the hash of the file actually shipped (skipped with a hint when
//      `npm run build` has not run, like images.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { versioned } from '../../src/lib/public-asset.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DIST = path.join(REPO, 'dist/client');

const exists = (p) => access(p).then(() => true, () => false);
const sha8 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);

// ---------------------------------------------------------------------------
// 1. hermetic

test('versioned() appends the first 8 hex digits of the file sha256 and follows the content', async () => {
	const dir = await mkdtemp(path.join(tmpdir(), 'hal0-public-'));
	try {
		await mkdir(path.join(dir, 'js'));
		await writeFile(path.join(dir, 'js/a.js'), 'alert(1)');
		assert.equal(versioned('/js/a.js', dir), `/js/a.js?v=${sha8('alert(1)')}`);
		assert.match(versioned('/js/a.js', dir), /^\/js\/a\.js\?v=[0-9a-f]{8}$/);

		await writeFile(path.join(dir, 'js/a.js'), 'alert(2)');
		assert.equal(versioned('/js/a.js', dir), `/js/a.js?v=${sha8('alert(2)')}`, 'a changed file gets a new URL');
		assert.notEqual(sha8('alert(1)'), sha8('alert(2)'));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test('versioned() refuses a missing file, a relative path and a path that escapes public/', async () => {
	const dir = await mkdtemp(path.join(tmpdir(), 'hal0-public-'));
	try {
		await writeFile(path.join(dir, 'x.js'), '');
		assert.throws(() => versioned('/js/missing.js', dir), /not in public/, 'a typo fails the build instead of shipping a 404');
		assert.throws(() => versioned('js/x.js', dir), /absolute URL path/);
		assert.throws(() => versioned('/../x.js', dir), /outside public/);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// 2. source

/** Every file under src/ that can hold a script tag, plus the Starlight head in astro.config.mjs. */
async function siteSources() {
	const files = [path.join(REPO, 'astro.config.mjs')];
	async function walk(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const p = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(p);
			else if (/\.(astro|ts|mjs|js|mdx?)$/.test(entry.name)) files.push(p);
		}
	}
	await walk(path.join(REPO, 'src'));
	return Promise.all(files.map(async (f) => ({ file: path.relative(REPO, f), text: await readFile(f, 'utf8') })));
}

test('no script tag names a /js/ file bare, and every public/js/ script is referenced through versioned()', async () => {
	const sources = await siteSources();
	for (const { file, text } of sources) {
		assert.doesNotMatch(text, /src\s*[=:]\s*["']\/js\//, `${file}: a bare /js/ URL outlives its cache; use versioned()`);
	}
	const all = sources.map((s) => s.text).join('\n');
	const scripts = (await readdir(path.join(REPO, 'public/js'))).filter((f) => f.endsWith('.js'));
	assert.ok(scripts.length >= 1, 'public/js/ holds the site scripts');
	for (const script of scripts) {
		const ref = new RegExp(`versioned\\(['"]/js/${script.replace(/\./g, '\\.')}['"]\\)`);
		assert.match(all, ref, `${script} is loaded through versioned()`);
	}
});

// ---------------------------------------------------------------------------
// 3. built pages

const built = await exists(path.join(DIST, 'index.html'));
const skipBuilt = !built && 'run npm run build first';

test('the built landing and blog pages load the shipped script versions and nothing bare', { skip: skipBuilt }, async () => {
	const pages = [
		// MarketingLayout
		['index.html', ['/js/lightbox.js', '/js/site-search.js']],
		// Starlight: the head from astro.config.mjs plus the PageFrame override
		['blog/index.html', ['/js/lightbox.js', '/js/blog-rss-button.js', '/js/search-source-tags.js']],
	];
	for (const [page, scripts] of pages) {
		const html = await readFile(path.join(DIST, page), 'utf8');
		for (const url of scripts) {
			assert.ok(html.includes(`src="${versioned(url)}"`), `${page}: loads ${versioned(url)}`);
		}
		assert.doesNotMatch(html, /src="\/js\/[^"?]+"/, `${page}: no script at a bare /js/ URL`);
	}
});
