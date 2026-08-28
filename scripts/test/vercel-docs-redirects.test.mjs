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
const KB_REDIRECTS_URL = new URL('../../src/data/kb-redirects.json', import.meta.url);
// The KB followed the docs to the forum; its map is the same shape, minus
// the "//" banner key and stored without trailing slashes (the patch adds
// the `/?$` tolerance to both maps alike).
const KB_LANDING = 'https://forum.hal0.dev/c/kb/12';

const config = await readFile(CONFIG_URL, 'utf8')
	.then(JSON.parse)
	.catch(() => null);
const skip = !config && 'run npm run build first (produces .vercel/output/config.json)';

const redirects = JSON.parse(await readFile(REDIRECTS_URL, 'utf8'));
const kbRedirects = Object.fromEntries(
	Object.entries(JSON.parse(await readFile(KB_REDIRECTS_URL, 'utf8'))).filter(([key]) =>
		key.startsWith('/kb/'),
	),
);
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

test('every kb-redirects.json entry 301s in both its trailing-slash and bare forms', { skip }, () => {
	const missing = [];
	for (const [barePath, forumUrl] of Object.entries(kbRedirects)) {
		for (const pathname of [barePath, `${barePath}/`]) {
			const hit = matchingRoutes(pathname).find(
				(r) => r.headers.Location === forumUrl && r.status === 301,
			);
			if (!hit) missing.push(pathname);
		}
	}
	assert.deepEqual(missing, [], `KB paths with no matching forum redirect route: ${missing.join(', ')}`);
});

test('the patch removed duplicate forum redirect route entries', { skip }, () => {
	const forumRoutes = routes.filter((r) => r.headers?.Location?.startsWith('https://forum.hal0.dev/'));
	const keys = forumRoutes.map((r) => JSON.stringify(r));
	assert.equal(keys.length, new Set(keys).size, 'duplicate forum redirect route objects survived the patch');
	// One route per map entry, not one per (slash, bare) pair — plus the /kb
	// landing, which points at the forum's KB category and so is counted here
	// too now that the KB lives there.
	assert.equal(
		forumRoutes.length,
		Object.keys(redirects).length + Object.keys(kbRedirects).length + 1,
		'expected one route per docs + kb redirect entry, plus the /kb landing',
	);
});

test('the /kb and /releases redirects point at the forum KB and the changelog', { skip }, () => {
	// /kb is compiled to an EXACT-match route, so the bare form never covered
	// /kb/ and the slash form 404'd; patch-vercel-docs-redirects.mjs gives it
	// `/?$` tolerance. Its target moved with the content: the KB is forum
	// categories now, not a section of the /docs hub.
	const kb = routes.filter((r) => r.headers?.Location === KB_LANDING);
	const releases = routes.filter((r) => r.headers?.Location === '/changelog');
	assert.deepEqual(
		kb.map((r) => r.src),
		['^/kb/?$'],
	);
	assert.deepEqual(
		releases.map((r) => r.src),
		['^/releases$'],
	);
});
