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
import sharp from 'sharp';

import { ROSTER_DATE } from '../../src/data/model-roster.ts';
import * as seo from '../../src/lib/seo.ts';
import { ICONS, renderIcon } from '../build-icons.mjs';
import { sourceToRouteSrc } from '../patch-vercel-headers.mjs';

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
// E1.1: titles and descriptions

// Pages that still break the limits because another lane owns their head and
// has not landed yet. Each entry is pinned by an expected-failure test below
// that FAILS the moment the page meets the limits, so the entry cannot
// outlive the fix: delete it when that happens.
const KNOWN_FAILING = new Set();

// The confirmation page is noindex and never ranks; its copy is not an SEO surface.
const EXEMPT = new Set(['/profiles/submitted/']);

const pages = built ? await Promise.all((await walk(DIST)).map(async (f) => ({ route: routeOf(f), html: await readFile(f, 'utf8') }))) : [];
const checked = pages.filter((p) => !EXEMPT.has(p.route));

/** Everything wrong with a page's title and description; empty when it is fine. */
function headProblems(html) {
	const problems = [];
	const title = titleOf(html);
	if (!title) problems.push('<title> missing');
	else if (title.length > 60) problems.push(`title is ${title.length} chars (max 60): ${JSON.stringify(title)}`);

	const description = metaContent(html, 'name', 'description');
	if (!description) problems.push('<meta name="description"> missing');
	else {
		if (description.length < 50 || description.length > 155) problems.push(`description is ${description.length} chars (want 50..155): ${JSON.stringify(description)}`);
		if (description === SITE_DEFAULT_DESCRIPTION) problems.push('description is the site-wide default');
	}
	return problems;
}

test('the build contains the pages this suite expects to cover', { skip }, () => {
	const routes = new Set(pages.map((p) => p.route));
	for (const r of ['/', '/404', '/benchmarks/', '/profiles/', '/profiles/submit/', '/contributing/', '/releases/', '/blog/', '/blog/whats-new-since-1-0/']) {
		assert.ok(routes.has(r), `${r} was built`);
	}
	for (const r of KNOWN_FAILING) assert.ok(routes.has(r), `KNOWN_FAILING entry ${r} was built, delete a stale entry`);
});

test('/changelog redirects to /releases (a route, not a built page)', { skip }, async () => {
	const config = JSON.parse(await readFile(new URL('../../.vercel/output/config.json', import.meta.url), 'utf8'));
	const redirect = config.routes.find((r) => r.src === '^/changelog/?$');
	assert.ok(redirect, 'a /changelog route exists');
	assert.equal(redirect.status, 301);
	assert.equal(redirect.headers.Location, '/releases');
	assert.ok(!pages.some((p) => p.route === '/changelog/'), 'no stale /changelog/ page is built');
});

for (const { route, html } of checked) {
	if (KNOWN_FAILING.has(route)) {
		test(`title and description (expected failure): ${route}`, { skip }, () => {
			assert.ok(headProblems(html).length > 0, `${route} now passes, delete the entry from KNOWN_FAILING`);
		});
	} else {
		test(`title and description: ${route}`, { skip }, () => {
			assert.deepEqual(headProblems(html), []);
		});
	}
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
// E1.2: site-wide structured data and head hygiene

// Starlight-rendered pages (blog, tags, authors, 404) get their head from
// Starlight and starlight-blog; every other page goes through MarketingLayout.
const isStarlight = (route) => route === '/404' || route.startsWith('/blog/');
const marketing = pages.filter((p) => !isStarlight(p.route));

const ORG_ID = 'https://hal0.dev/#org';
const WEBSITE_ID = 'https://hal0.dev/#website';

// Inner pages that must carry a Home > Page breadcrumb.
const BREADCRUMB_PAGES = ['/benchmarks/', '/profiles/', '/profiles/submit/', '/contributing/', '/releases/'];

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

for (const route of BREADCRUMB_PAGES) {
	test(`breadcrumb: ${route}`, { skip }, () => {
		const page = pages.find((p) => p.route === route);
		assert.ok(page, `${route} was built`);
		const crumbs = nodesOf(page.html).filter((n) => n['@type'] === 'BreadcrumbList');
		assert.equal(crumbs.length, 1, 'exactly one BreadcrumbList');
		const items = crumbs[0].itemListElement;
		assert.equal(items.length, 2, 'two items: Home and the page');
		assert.deepEqual(
			items.map((i) => [i['@type'], i.position]),
			[['ListItem', 1], ['ListItem', 2]],
		);
		assert.equal(items[0].name, 'Home');
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
		assert.equal(byScheme['(prefers-color-scheme: dark)'], seo.THEME_COLOR_DARK);
		assert.equal(byScheme['(prefers-color-scheme: light)'], seo.THEME_COLOR_LIGHT);
	});
}

test('Starlight pages use the same per-scheme theme-color', { skip }, () => {
	for (const { route, html } of pages.filter((p) => isStarlight(p.route))) {
		const byScheme = Object.fromEntries(metaTags(html, 'name', 'theme-color').map((c) => [c.media, c.content]));
		assert.deepEqual(byScheme, { '(prefers-color-scheme: dark)': seo.THEME_COLOR_DARK, '(prefers-color-scheme: light)': seo.THEME_COLOR_LIGHT }, route);
	}
});

test('the theme-color pair is the page background of each theme in tokens.css', async () => {
	const css = await readFile(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
	const bg = (block) => block.match(/--hal0-bg:\s*(#[0-9a-f]{6})/i)?.[1];
	const light = css.slice(css.indexOf("[data-theme='light']"));
	assert.equal(bg(css), seo.THEME_COLOR_DARK, 'dark --hal0-bg');
	assert.equal(bg(light), seo.THEME_COLOR_LIGHT, 'light --hal0-bg');
});

// ---------------------------------------------------------------------------
// E1.3: icons, manifest, llms.txt

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width/height and colour type from a PNG's IHDR chunk. */
function pngHeader(buf) {
	assert.ok(buf.subarray(0, 8).equals(PNG_MAGIC), 'PNG magic bytes');
	assert.equal(buf.toString('ascii', 12, 16), 'IHDR', 'first chunk is IHDR');
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}
const pngSize = (buf) => {
	const { width, height } = pngHeader(buf);
	return { width, height };
};
// PNG colour types: 4 = greyscale + alpha, 6 = RGBA. Anything else has no alpha channel.
const hasAlpha = (buf) => [4, 6].includes(pngHeader(buf).colorType);

const EXPECTED_ICONS = { 'apple-touch-icon-180.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };

test('build-icons declares the three icon sizes', () => {
	assert.deepEqual(Object.fromEntries(ICONS.map((i) => [i.file, i.size])), EXPECTED_ICONS);
});

test('renderIcon rasterizes the favicon to a square PNG of the requested size', async () => {
	const svg = await readFile(new URL('../../public/favicon.svg', import.meta.url));
	const png = await renderIcon(svg, 64);
	assert.deepEqual(pngSize(png), { width: 64, height: 64 });
});

test('renderIcon output has no alpha channel and is filled with the dark theme colour', async () => {
	const svg = await readFile(new URL('../../public/favicon.svg', import.meta.url));
	const png = await renderIcon(svg, 64);
	assert.ok(!hasAlpha(png), `PNG colour type ${pngHeader(png).colorType} carries alpha`);
	// The corner is background, never glyph.
	const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
	const [r, g, b] = [...data.subarray(0, info.channels)];
	assert.equal(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, seo.THEME_COLOR_DARK);
});

test('the build writes the icon set at its exact pixel sizes', { skip }, async () => {
	for (const [file, size] of Object.entries(EXPECTED_ICONS)) {
		const png = await readFile(path.join(DIST, 'icons', file));
		assert.deepEqual(pngSize(png), { width: size, height: size }, file);
		assert.ok(!hasAlpha(png), `${file} has no alpha channel`);
	}
});

test('site.webmanifest parses and names both install icons', { skip }, async () => {
	const manifest = JSON.parse(await readFile(path.join(DIST, 'site.webmanifest'), 'utf8'));
	assert.equal(manifest.name, 'hal0');
	assert.equal(manifest.start_url, '/');
	// The manifest stays a literal, human-readable file in public/; these two
	// assertions are what keep its colours in step with src/lib/seo.ts.
	assert.equal(manifest.theme_color, seo.THEME_COLOR_DARK);
	assert.equal(manifest.background_color, seo.THEME_COLOR_DARK);
	const bySrc = Object.fromEntries(manifest.icons.map((i) => [i.src, i]));
	assert.equal(bySrc['/icons/icon-192.png']?.sizes, '192x192');
	assert.equal(bySrc['/icons/icon-512.png']?.sizes, '512x512');
	for (const icon of manifest.icons) assert.equal(icon.type, 'image/png');
});

test('every page head points at the 180px apple-touch-icon and the manifest', { skip }, () => {
	for (const { route, html } of pages) {
		const links = linkTags(html);
		const touch = links.filter((l) => l.rel === 'apple-touch-icon');
		assert.deepEqual(touch.map((l) => l.href), ['/icons/apple-touch-icon-180.png'], `${route} apple-touch-icon`);
		assert.deepEqual(links.filter((l) => l.rel === 'manifest').map((l) => l.href), ['/site.webmanifest'], `${route} manifest`);
	}
});

test('llms.txt summarises the product and lists the key URLs', { skip }, async () => {
	const txt = await readFile(path.join(DIST, 'llms.txt'), 'utf8');
	assert.match(txt, /^# hal0\n/, 'starts with an H1 naming the product');
	for (const needle of ['hal0.dev/releases', 'forum.hal0.dev', '/benchmarks', '/profiles', '/blog', '/contributing', 'github.com/hal0ai/hal0', 'install.sh']) {
		assert.ok(txt.includes(needle), `mentions ${needle}`);
	}
	// install.sh has no root check, so the documented command pipes into sudo.
	const INSTALL = 'curl -fsSL https://hal0.dev/install.sh | sudo bash';
	assert.ok(txt.includes(INSTALL), `llms.txt gives the install command: ${INSTALL}`);
	const installer = await readFile(new URL('../../public/install.sh', import.meta.url), 'utf8');
	assert.ok(installer.includes(INSTALL), 'the installer documents the same command');
	// Claims that the product inventory rules out must not creep in.
	for (const banned of [/content-aware/i, /\bunleash/i, /\bseamless/i, /\brevolutionary/i, /\bsupercharge/i, /\binstantly/i, /\bsandboxed/i, /never leak/i, /\b1\.\d+\b/, /\u2014/]) {
		assert.ok(!banned.test(txt), `llms.txt avoids ${banned}`);
	}
});

test('the generated icons get the same cache header as the other static assets', async () => {
	const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
	const rule = vercel.headers.find((h) => new RegExp(sourceToRouteSrc(h.source)).test('/icons/icon-192.png') && h.source !== '/(.*)');
	assert.ok(rule, 'a vercel.json header rule matches /icons/*');
	assert.ok(rule.headers.some((h) => h.key === 'Cache-Control' && /max-age=\d+/.test(h.value)), 'it sets Cache-Control');
	assert.ok(new RegExp(sourceToRouteSrc(rule.source)).test('/brand/logo-halo-dark.png'), 'same rule as /brand/');
});

test('benchmarks.astro takes the model count from the roster, never a literal', async () => {
	const source = await readFile(new URL('../../src/pages/benchmarks.astro', import.meta.url), 'utf8');
	assert.deepEqual(source.match(/\b\d+ models\b/g) ?? [], [], 'no "<number> models" literal');
});

// Unit checks for src/lib/seo.ts (no build needed).

test('organizationSameAs reduces the GitHub repo link to its organization', () => {
	const social = [
		{ id: 'github', href: 'https://github.com/hal0ai/hal0' },
		{ id: 'discord', href: 'https://discord.gg/abc' },
	];
	assert.deepEqual(seo.organizationSameAs(social), ['https://github.com/hal0ai', 'https://discord.gg/abc', 'https://forum.hal0.dev']);
	assert.throws(() => seo.organizationSameAs([social[0]]), /no "discord" social link/);
});

test('breadcrumbList is Home then the page, with absolute URLs', () => {
	const crumb = seo.breadcrumbList('Benchmarks', '/benchmarks/');
	assert.equal(crumb['@type'], 'BreadcrumbList');
	assert.deepEqual(crumb.itemListElement, [
		{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://hal0.dev/' },
		{ '@type': 'ListItem', position: 2, name: 'Benchmarks', item: 'https://hal0.dev/benchmarks/' },
	]);
});
