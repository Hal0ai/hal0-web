// scripts/test/vercel-docs-redirects.test.mjs
//
// Regression test for the trailing-slash gap scripts/patch-vercel-docs-redirects.mjs
// fixes (see that script's banner for the full mechanism): every
// forum.hal0.dev redirect compiled into .vercel/output/config.json must
// match BOTH `/docs/<section>/<slug>` and `/docs/<section>/<slug>/` — the
// no-slash form always worked, but the trailing-slash form (Starlight's
// own canonical, previously-indexed/bookmarked URL) 404'd until this
// patch ran, because @astrojs/vercel compiles astro.config.mjs's
// `redirects` to an exact-match regex with no trailing-slash leniency.
//
// Requires `npm run build` (which runs this repo's `postbuild` hook —
// see package.json) to have produced .vercel/output/config.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const CONFIG_URL = new URL('../../.vercel/output/config.json', import.meta.url);
const REDIRECTS_URL = new URL('../../src/data/docs-redirects.json', import.meta.url);

const config = await readFile(CONFIG_URL, 'utf8')
	.then(JSON.parse)
	.catch(() => null);
const skip = !config && 'run npm run build first (produces .vercel/output/config.json)';

const redirects = JSON.parse(await readFile(REDIRECTS_URL, 'utf8'));
const routes = config?.routes ?? [];

function matchingRoutes(pathname) {
	return routes.filter((r) => {
		if (!r.src || !r.headers?.Location) return false;
		try {
			return new RegExp(r.src).test(pathname);
		} catch {
			return false;
		}
	});
}

test('every docs-redirects.json entry 301s in both its trailing-slash and bare forms', { skip }, () => {
	const missing = [];
	for (const [slashPath, forumUrl] of Object.entries(redirects)) {
		const barePath = slashPath.replace(/\/$/, '');
		for (const pathname of [slashPath, barePath]) {
			const matches = matchingRoutes(pathname);
			const hit = matches.find((r) => r.headers.Location === forumUrl && r.status === 301);
			if (!hit) missing.push(pathname);
		}
	}
	assert.deepEqual(missing, [], `paths with no matching forum redirect route: ${missing.join(', ')}`);
});

test('the patch removed duplicate forum redirect route entries', { skip }, () => {
	const forumRoutes = routes.filter((r) => r.headers?.Location?.startsWith('https://forum.hal0.dev/'));
	const keys = forumRoutes.map((r) => JSON.stringify(r));
	assert.equal(keys.length, new Set(keys).size, 'duplicate forum redirect route objects survived the patch');
	// One route per docs-redirects.json entry, not one per (slash, bare) pair.
	assert.equal(forumRoutes.length, Object.keys(redirects).length, 'expected exactly one route per docs-redirects.json entry');
});

test('the /kb and /releases redirects are untouched (single form, no forum prefix)', { skip }, () => {
	const kb = routes.filter((r) => r.headers?.Location === '/docs/');
	const releases = routes.filter((r) => r.headers?.Location === '/changelog');
	assert.deepEqual(
		kb.map((r) => r.src),
		['^/kb$'],
	);
	assert.deepEqual(
		releases.map((r) => r.src),
		['^/releases$'],
	);
});
