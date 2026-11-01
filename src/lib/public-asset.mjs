// src/lib/public-asset.mjs
//
// A cache-busting URL for a file in public/: the path plus `?v=<8 hex>` of its
// sha256, computed at build time.
//
// The scripts in public/js/ are served under a long Cache-Control (the /js/
// rule in vercel.json; Cloudflare stretches it further on hal0.dev), so a
// changed script at a stable URL keeps serving the previous copy to returning
// visitors for hours. A URL that changes with the content is a cache miss the
// first time and a long-lived hit from then on, like Astro's own hashed
// bundles. The query string leaves vercel.json's /js/ header rule matching.
//
// Plain .mjs so astro.config.mjs (the Starlight head) and .astro frontmatter
// (MarketingLayout, StarlightPageFrame) can both import it. astro.config.mjs
// is evaluated once per `astro dev`, so a script edited during dev keeps its
// old hash on Starlight pages until the dev server restarts; a build always
// hashes what it ships.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Relative to the working directory, like src/lib/shot.ts: Astro bundles the
// components that call this into prerender chunks, so import.meta.url would
// point into .vercel/output/, not src/lib/.
const defaultPublicDir = () => path.join(process.cwd(), 'public');

/**
 * `/js/lightbox.js` → `/js/lightbox.js?v=1a2b3c4d`.
 *
 * Throws when the path is not absolute, escapes public/, or names a file that
 * does not exist, so a typo fails the build instead of shipping a 404.
 */
export function versioned(urlPath, publicDir = defaultPublicDir()) {
	if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) {
		throw new Error(`versioned: expected an absolute URL path like /js/lightbox.js, got ${JSON.stringify(urlPath)}`);
	}
	const root = path.resolve(publicDir);
	const file = path.resolve(root, `.${urlPath}`);
	if (file !== root && !file.startsWith(root + path.sep)) {
		throw new Error(`versioned: ${urlPath} resolves outside public/ (${file})`);
	}
	let bytes;
	try {
		bytes = readFileSync(file);
	} catch (err) {
		throw new Error(`versioned: ${urlPath} is not in public/ (${file})`, { cause: err });
	}
	const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
	return `${urlPath}?v=${hash}`;
}
