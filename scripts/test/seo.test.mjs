// scripts/test/seo.test.mjs
//
// Build-output checks for the non-landing SEO foundation: per-page titles and
// descriptions, site-wide structured data, head hygiene, icons, web manifest
// and llms.txt. Everything here reads dist/client/, so run `npm run build`
// first (the tests skip with a hint, like analytics.test.mjs, when no build
// exists).
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIST = fileURLToPath(new URL('../../dist/client/', import.meta.url));
const built = await access(path.join(DIST, 'index.html')).then(() => true, () => false);
const skip = !built && 'run npm run build first';

// ---------------------------------------------------------------------------
// helpers

async function walk(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full)));
		else if (entry.name === 'index.html' || (dir === DIST && entry.name === '404.html')) out.push(full);
	}
	return out;
}

/** '/blog/x/' for dist/client/blog/x/index.html; '/404' for dist/client/404.html */
function routeOf(file) {
	if (file === path.join(DIST, '404.html')) return '/404';
	const dir = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
	return dir ? `/${dir}/` : '/';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
	s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) =>
		dec ? String.fromCodePoint(+dec) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (ENTITIES[name.toLowerCase()] ?? m),
	);

/** The first <meta> whose `attr` equals `key`, content decoded; null when absent. */
function metaContent(html, attr, key) {
	for (const tag of html.match(/<meta\b[^>]*>/g) ?? []) {
		const a = tag.match(new RegExp(`\\b${attr}="([^"]*)"`));
		if (a && a[1] === key) {
			const c = tag.match(/\bcontent="([^"]*)"/);
			return c ? decode(c[1]) : null;
		}
	}
	return null;
}

const titleOf = (html) => {
	const m = html.match(/<title>([\s\S]*?)<\/title>/);
	return m ? decode(m[1]).trim() : null;
};

/** Every ld+json script in the document, parsed. */
function jsonLdOf(html) {
	return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

/** Flattened list of every schema.org node across all ld+json scripts. */
const nodesOf = (html) => jsonLdOf(html).flatMap((doc) => (Array.isArray(doc['@graph']) ? doc['@graph'] : [doc]));

const SITE_DEFAULT_DESCRIPTION = 'Local AI for your home. Strix Halo native.';

// ---------------------------------------------------------------------------
// E1.1 — titles and descriptions

// Pages whose head another lane owns and is rewriting in parallel (landing
// lane: `/`; releases lane: `/changelog/` becoming `/releases/`). They are
// still held to the same rules, but as `todo` so a not-yet-merged lane cannot
// turn this suite red. Delete an entry once its lane has landed on master.
const OWNED_BY_OTHER_LANES = new Set(['/', '/changelog/']);

// The confirmation page is noindex and never ranks; its copy is not an SEO surface.
const EXEMPT = new Set(['/profiles/submitted/']);

const pages = built ? await Promise.all((await walk(DIST)).map(async (f) => ({ route: routeOf(f), html: await readFile(f, 'utf8') }))) : [];
const checked = pages.filter((p) => !EXEMPT.has(p.route));

test('the build contains the pages this suite expects to cover', { skip }, () => {
	const routes = new Set(pages.map((p) => p.route));
	for (const r of ['/', '/404', '/benchmarks/', '/profiles/', '/profiles/submit/', '/contributing/', '/blog/', '/blog/whats-new-since-1-0/']) {
		assert.ok(routes.has(r), `${r} was built`);
	}
});

for (const { route, html } of checked) {
	test(`title and description: ${route}`, { skip, todo: OWNED_BY_OTHER_LANES.has(route) }, () => {
		const title = titleOf(html);
		assert.ok(title, '<title> present');
		assert.ok(title.length <= 60, `title is ${title.length} chars (max 60): ${JSON.stringify(title)}`);

		const description = metaContent(html, 'name', 'description');
		assert.ok(description, '<meta name="description"> present');
		assert.ok(description.length >= 50 && description.length <= 155, `description is ${description.length} chars (want 50..155): ${JSON.stringify(description)}`);
		assert.notEqual(description, SITE_DEFAULT_DESCRIPTION, 'description is not the site-wide default');
	});
}

test('blog post descriptions differ from each other and from the blog index', { skip }, () => {
	const blog = checked.filter((p) => /^\/blog\/[^/]+\/$/.test(p.route) && !/^\/blog\/(tags|authors|page)\b/.test(p.route) && /"BlogPosting"/.test(p.html));
	assert.ok(blog.length >= 3, `found the blog posts (got ${blog.length})`);
	const index = checked.find((p) => p.route === '/blog/');
	const seen = new Map();
	for (const { route, html } of blog) {
		const d = metaContent(html, 'name', 'description');
		assert.ok(!seen.has(d), `${route} and ${seen.get(d)} share a description`);
		seen.set(d, route);
		assert.notEqual(d, metaContent(index.html, 'name', 'description'), `${route} repeats the blog index description`);
	}
});

test('blog index carries its own search title, not the bare nav label', { skip }, () => {
	const index = pages.find((p) => p.route === '/blog/');
	assert.equal(titleOf(index.html), 'hal0 Blog: Self-Hosted AI, Strix Halo & Releases');
	assert.equal(metaContent(index.html, 'property', 'og:title'), 'hal0 Blog: Self-Hosted AI, Strix Halo & Releases');
});
