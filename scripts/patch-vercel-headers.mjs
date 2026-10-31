// scripts/patch-vercel-headers.mjs
//
// Runs as part of `postbuild` (after patch-vercel-docs-redirects.mjs) and
// copies the `headers` block of vercel.json into .vercel/output/config.json
// as `{ src, headers, continue: true }` routes, placed ahead of the
// filesystem handler so they apply to static files and prerendered HTML.
//
// WHY: with @astrojs/vercel the deploy is driven by the Build Output API
// config.json the adapter emits, and the adapter only ever feeds Astro's
// own `redirects` into it (`headers: []` in its getTransformedRoutes call).
// Whether Vercel then layers vercel.json's `headers` on top of a
// framework-emitted config.json is not something this repo wants to depend
// on: the security headers, the `/install.sh` content type and the asset
// cache TTLs are part of the site's contract (curl'd by the installer,
// checked by external probes). Writing them into config.json ourselves
// makes them unconditional. If Vercel also applies vercel.json, the result
// is the same header value twice over, which is harmless.
//
// vercel.json stays the single human-readable source; this script never
// invents a header of its own. `source` patterns are written in the
// subset that is both valid path-to-regexp (vercel.json) and, once
// anchored, a valid route regex: `/(.*)`, `/install.sh`,
// `/(a|b)/(.*)`. The only translation is anchoring and escaping literal
// dots (a `.` followed by `*` or `+` is a regex wildcard and is left
// alone).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CONFIG_URL = new URL('../.vercel/output/config.json', import.meta.url);
const VERCEL_JSON_URL = new URL('../vercel.json', import.meta.url);

/** vercel.json `source` → Build Output API route `src` regex. Exported for the test. */
export function sourceToRouteSrc(source) {
	return `^${source.replace(/\.(?![*+])/g, '\\.')}$`;
}

/** The routes to splice in, derived from a parsed vercel.json. Exported for the test. */
export function headerRoutes(vercelJson) {
	return (vercelJson.headers ?? []).map((entry) => ({
		src: sourceToRouteSrc(entry.source),
		headers: Object.fromEntries(entry.headers.map(({ key, value }) => [key, value])),
		continue: true,
	}));
}

/**
 * Insert the header routes just before the filesystem handler (or at the
 * front when there is none). Idempotent: an existing route with the same
 * src + headers + continue is left alone, so re-running postbuild does not
 * stack duplicates. Exported for the test.
 */
export function applyHeaderRoutes(config, routes) {
	const existing = new Set((config.routes ?? []).map((r) => JSON.stringify(r)));
	const fresh = routes.filter((r) => !existing.has(JSON.stringify(r)));
	const all = [...(config.routes ?? [])];
	const fsIndex = all.findIndex((r) => r.handle === 'filesystem');
	all.splice(fsIndex === -1 ? 0 : fsIndex, 0, ...fresh);
	return { ...config, routes: all, added: fresh.length };
}

async function main() {
	let raw;
	try {
		raw = await readFile(fileURLToPath(CONFIG_URL), 'utf8');
	} catch (err) {
		if (err.code === 'ENOENT') {
			console.log('[patch-vercel-headers] no .vercel/output/config.json — skipping (no adapter output built)');
			return;
		}
		throw err;
	}
	const vercelJson = JSON.parse(await readFile(fileURLToPath(VERCEL_JSON_URL), 'utf8'));
	const { added, ...config } = applyHeaderRoutes(JSON.parse(raw), headerRoutes(vercelJson));
	await writeFile(fileURLToPath(CONFIG_URL), `${JSON.stringify(config, null, '\t')}\n`);
	console.log(`[patch-vercel-headers] added ${added} header routes from vercel.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	await main();
}
