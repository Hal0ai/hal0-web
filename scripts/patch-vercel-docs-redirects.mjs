// scripts/patch-vercel-docs-redirects.mjs
//
// Runs as an npm `postbuild` hook (npm auto-runs it after `npm run build`
// — both in CI and on Vercel's own build, which invokes this project's
// `build` script) to fix a gap the @astrojs/vercel adapter leaves in the
// forum.hal0.dev docs redirects (astro.config.mjs's `redirects` spread of
// src/data/docs-redirects.json).
//
// THE BUG: astro.config.mjs's `redirects` keys are exact site paths
// (`/docs/<section>/<slug>`, no trailing slash — see
// src/data/docs-redirects.json's own banner comment). Astro's route
// parser normalizes away a trailing slash on the redirect's OWN key
// before compiling it (`removeTrailingForwardSlash` in
// astro/dist/core/routing/parse-route.js), and the Vercel adapter turns
// each resulting route into an EXACT-match regex with no `trailingSlash`
// leniency baked in when astro.config.mjs's own `trailingSlash` stays at
// its default `'ignore'` (@astrojs/vercel only passes a `trailingSlash`
// hint to `getTransformedRoutes` — and only then does Vercel normalize
// requests at the edge — when that config is explicitly `'always'` or
// `'never'`). The emitted `.vercel/output/config.json` route is
// `{"src": "^/docs/concepts/agents$", ...}` — an exact match with no
// optional trailing slash — so a live request to
// `/docs/concepts/agents/` (Starlight's own canonical, bookmarked,
// trailing-slash URL) never matches it and 404s, while the no-slash form
// 301s correctly.
//
// Setting astro.config.mjs's site-wide `trailingSlash: 'never'` WOULD
// make @astrojs/vercel add global trailing-slash normalization — but
// site-wide, for every route, not just these 44 doc redirects. That
// changes canonical URLs across the whole site (KB, blog, benchmarks,
// profiles, …) as a side effect of a fix scoped to retired docs pages, so
// it's not used here.
//
// THE FIX: patch the compiled routes in place, scoped tightly to just the
// forum.hal0.dev redirects this file's docs-redirects.json produced —
// turn each `^/path$` into `^/path/?$` (optional trailing slash) so both
// URL forms 301 to the same forum topic, exactly as
// src/data/docs-redirects.json intends. Astro also emits each of these
// routes TWICE (once per docs-redirects.json trailing-slash variant that
// normalized to the same route) — reading a de-duped canonical key set
// still leaves it emitting the duplicate; both collapse to the same
// patched regex, so this script also de-dupes them down to one route
// per path, keeping the output small and diff-stable.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CONFIG_URL = new URL('../.vercel/output/config.json', import.meta.url);
const FORUM_PREFIX = 'https://forum.hal0.dev/';

async function main() {
	let raw;
	try {
		raw = await readFile(fileURLToPath(CONFIG_URL), 'utf8');
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('[patch-vercel-docs-redirects] no .vercel/output/config.json — skipping (no adapter output built)');
			return;
		}
		throw err;
	}

	const config = JSON.parse(raw);
	const seen = new Set();
	const patched = [];
	let touched = 0;
	let deduped = 0;

	for (const route of config.routes ?? []) {
		const location = route.headers?.Location;
		const isForumRedirect =
			route.status === 301 && typeof location === 'string' && location.startsWith(FORUM_PREFIX) && route.src?.endsWith('$');

		if (isForumRedirect && !route.src.endsWith('/?$')) {
			route.src = `${route.src.slice(0, -1)}/?$`;
			touched++;
		}

		const key = JSON.stringify(route);
		if (isForumRedirect) {
			if (seen.has(key)) {
				deduped++;
				continue;
			}
			seen.add(key);
		}
		patched.push(route);
	}

	config.routes = patched;
	await writeFile(fileURLToPath(CONFIG_URL), `${JSON.stringify(config, null, '\t')}\n`);
	console.log(
		`[patch-vercel-docs-redirects] made ${touched} forum.hal0.dev redirect routes trailing-slash tolerant, removed ${deduped} duplicate route entries`,
	);
}

await main();
