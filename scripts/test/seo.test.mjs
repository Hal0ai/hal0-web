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

import { ROSTER_DATE } from '../../src/data/model-roster.ts';
import { breadcrumbList, organizationSameAs } from '../../src/lib/seo.ts';

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

/** Attribute map of every <link> tag. */
const linkTags = (html) =>
	(html.match(/<link\b[^>]*>/g) ?? []).map((tag) => Object.fromEntries([...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])])));

/** Content of every <meta name=KEY>, in document order. */
function metaTags(html, attr, key) {
	return (html.match(/<meta\b[^>]*>/g) ?? [])
		.map((tag) => Object.fromEntries([...tag.matchAll(/([a-z:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])])))
		.filter((m) => m[attr] === key);
}

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

// ---------------------------------------------------------------------------
// E1.2 — site-wide structured data and head hygiene

// Starlight-rendered pages (blog, tags, authors, 404) get their head from
// Starlight and starlight-blog; every other page goes through MarketingLayout.
const isStarlight = (route) => route === '/404' || route.startsWith('/blog/');
const marketing = pages.filter((p) => !isStarlight(p.route));

const ORG_ID = 'https://hal0.dev/#org';
const WEBSITE_ID = 'https://hal0.dev/#website';

// Inner pages that must carry Home > Page breadcrumbs. `/changelog/` is the
// releases lane's page (it becomes `/releases/`); held to the same rule as a
// todo until that lane has landed.
const BREADCRUMB_PAGES = ['/benchmarks/', '/profiles/', '/profiles/submit/', '/contributing/'];
const BREADCRUMB_PENDING = new Set(['/changelog/', '/releases/']);

for (const { route, html } of marketing) {
	test(`organization and website nodes: ${route}`, { skip }, () => {
		assert.ok(jsonLdOf(html).length >= 1, 'has an ld+json script');
		const graph = jsonLdOf(html).find((doc) => Array.isArray(doc['@graph']))['@graph'];

		const [org, site] = graph;
		assert.equal(org['@type'], 'Organization', 'Organization is first in the graph');
		assert.equal(org['@id'], ORG_ID);
		assert.equal(org.url, 'https://hal0.dev/');
		assert.equal(org.logo, 'https://hal0.dev/brand/logo-halo-dark.png');
		assert.equal(org.sameAs.length, 3, 'three sameAs profiles');
		assert.ok(org.sameAs.includes('https://github.com/hal0ai'), 'GitHub org');
		assert.ok(org.sameAs.includes('https://discord.gg/7M4y6dcUyq'), 'Discord invite');
		assert.ok(org.sameAs.includes('https://forum.hal0.dev'), 'forum');

		assert.equal(site['@type'], 'WebSite', 'WebSite is second in the graph');
		assert.equal(site['@id'], WEBSITE_ID);
		assert.equal(site.url, 'https://hal0.dev/');
		assert.deepEqual(site.publisher, { '@id': ORG_ID });
	});
}

test('the Organization and WebSite nodes are declared once per page', { skip }, () => {
	for (const { route, html } of marketing) {
		const nodes = nodesOf(html);
		assert.equal(nodes.filter((n) => n['@id'] === ORG_ID).length, 1, `${route}: one Organization`);
		assert.equal(nodes.filter((n) => n['@id'] === WEBSITE_ID).length, 1, `${route}: one WebSite`);
	}
});

for (const route of [...BREADCRUMB_PAGES, ...BREADCRUMB_PENDING]) {
	const page = pages.find((p) => p.route === route);
	if (!page && BREADCRUMB_PENDING.has(route)) continue; // not built on this branch
	test(`breadcrumb: ${route}`, { skip: skip || (!page && 'page not built'), todo: BREADCRUMB_PENDING.has(route) }, () => {
		const crumbs = nodesOf(page.html).filter((n) => n['@type'] === 'BreadcrumbList');
		assert.equal(crumbs.length, 1, 'exactly one BreadcrumbList');
		const items = crumbs[0].itemListElement;
		assert.equal(items.length, 2, 'two items: Home and the page');
		assert.deepEqual(
			items.map((i) => [i['@type'], i.position]),
			[['ListItem', 1], ['ListItem', 2]],
		);
		assert.equal(items[0].item, 'https://hal0.dev/');
		assert.equal(items[1].item, `https://hal0.dev${route}`);
		assert.ok(items[1].name.length > 0, 'page crumb is named');
	});
}

test('the landing page has no breadcrumb', { skip }, () => {
	const home = pages.find((p) => p.route === '/');
	assert.equal(nodesOf(home.html).filter((n) => n['@type'] === 'BreadcrumbList').length, 0);
});

test('/benchmarks declares a Dataset dated to the roster sweep', { skip }, () => {
	const bench = pages.find((p) => p.route === '/benchmarks/');
	const datasets = nodesOf(bench.html).filter((n) => n['@type'] === 'Dataset');
	assert.equal(datasets.length, 1, 'exactly one Dataset');
	const [ds] = datasets;
	assert.equal(ds.dateModified, ROSTER_DATE, 'dateModified is the roster date');
	assert.equal(ds.url, 'https://hal0.dev/benchmarks/');
	assert.ok(ds.name && ds.description, 'named and described');
	assert.ok(ds.measurementTechnique, 'says how it was measured');
	assert.ok(ds.license, 'licensed');
	assert.deepEqual(ds.publisher, { '@id': ORG_ID });
	assert.ok(Array.isArray(ds.variableMeasured) && ds.variableMeasured.length >= 4, 'lists the measured variables');
	for (const v of ds.variableMeasured) assert.ok(v.name && v.unitText, `variable ${JSON.stringify(v)} has name and unit`);
});

test('every page head links the blog RSS feed', { skip }, () => {
	for (const { route, html } of pages) {
		const feeds = linkTags(html).filter((l) => l.rel === 'alternate' && l.type === 'application/rss+xml');
		assert.ok(
			feeds.some((l) => new URL(l.href, 'https://hal0.dev').href === 'https://hal0.dev/blog/rss.xml'),
			`${route} links /blog/rss.xml`,
		);
	}
});

for (const { route, html } of marketing) {
	test(`og:locale and theme-color per scheme: ${route}`, { skip }, () => {
		assert.equal(metaContent(html, 'property', 'og:locale'), 'en_US');
		const colors = metaTags(html, 'name', 'theme-color');
		const byScheme = Object.fromEntries(colors.map((c) => [c.media, c.content]));
		assert.equal(colors.length, 2, 'two theme-color tags');
		assert.equal(byScheme['(prefers-color-scheme: dark)'], '#0a0a0a');
		assert.equal(byScheme['(prefers-color-scheme: light)'], '#fafaf9');
	});
}

test('Starlight pages use the same per-scheme theme-color', { skip }, () => {
	for (const { route, html } of pages.filter((p) => isStarlight(p.route))) {
		const byScheme = Object.fromEntries(metaTags(html, 'name', 'theme-color').map((c) => [c.media, c.content]));
		assert.deepEqual(byScheme, { '(prefers-color-scheme: dark)': '#0a0a0a', '(prefers-color-scheme: light)': '#fafaf9' }, route);
	}
});

// Unit checks for src/lib/seo.ts (no build needed).

test('organizationSameAs reduces the GitHub repo link to its organization', () => {
	const social = [
		{ id: 'github', href: 'https://github.com/hal0ai/hal0' },
		{ id: 'discord', href: 'https://discord.gg/abc' },
	];
	assert.deepEqual(organizationSameAs(social), ['https://github.com/hal0ai', 'https://discord.gg/abc', 'https://forum.hal0.dev']);
	assert.throws(() => organizationSameAs([social[0]]), /no "discord" social link/);
});

test('breadcrumbList is Home then the page, with absolute URLs', () => {
	const crumb = breadcrumbList('Benchmarks', '/benchmarks/');
	assert.equal(crumb['@type'], 'BreadcrumbList');
	assert.deepEqual(crumb.itemListElement, [
		{ '@type': 'ListItem', position: 1, name: 'hal0', item: 'https://hal0.dev/' },
		{ '@type': 'ListItem', position: 2, name: 'Benchmarks', item: 'https://hal0.dev/benchmarks/' },
	]);
});
