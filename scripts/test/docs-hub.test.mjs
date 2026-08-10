// scripts/test/docs-hub.test.mjs
//
// Guards the /docs hub (src/pages/docs/index.astro). Its whole point is
// to be a map — a map with a dead link on it is worse than no map, and
// every card link there is derived from the content collection, so the
// failure mode is silent: a section renamed upstream just stops linking
// anywhere useful.
//
// Requires a fresh `npm run build` (skips with a visible message when
// dist/ is absent — CI always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DOCS_SECTIONS } from '../../src/data/docs-sections.ts';
import { KB_CATEGORIES } from '../../src/data/kb-categories.ts';

const HUB = new URL('../../dist/docs/index.html', import.meta.url);
const built = await access(HUB).then(
	() => true,
	() => false,
);
const skip = !built && 'run npm run build first';

const hubHtml = built ? await readFile(HUB, 'utf8') : '';
const hrefs = () => [...hubHtml.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);

/** Astro escapes `&` in text nodes, so compare labels against escaped HTML. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * True only when a root-relative URL maps to a real FILE in dist.
 *
 * The `isFile` check is the whole point. An earlier version used bare
 * `existsSync`, which returns true for a DIRECTORY — so `/kb/getting-started/`
 * "resolved" against the `dist/kb/getting-started/` folder that holds the
 * category's articles, even though no page is served at that URL. Six dead
 * links shipped past this test that way.
 */
function resolves(href) {
	const root = fileURLToPath(new URL('../../dist', import.meta.url));
	const isFile = (p) => existsSync(p) && statSync(p).isFile();
	const withIndex = root + (href.endsWith('/') ? href + 'index.html' : href + '/index.html');
	return isFile(withIndex) || isFile(root + href);
}

test('/docs is a real page, not the old redirect', { skip }, () => {
	assert.ok(!/http-equiv="refresh"/i.test(hubHtml), '/docs must not be a meta-refresh redirect');
	assert.ok(hubHtml.includes('everything, and where it lives'), 'hub renders its own headline');
});

test('every internal link on the hub resolves to a built page', { skip }, () => {
	const bad = [];
	for (const h of new Set(hrefs())) {
		if (h.startsWith('/_astro') || /\.(xml|svg|png|ico|js|css|txt)$/.test(h)) continue;
		if (!resolves(h)) bad.push(h);
	}
	assert.deepEqual(bad, [], `hub links with no built page: ${bad.join(', ')}`);
});

test('every docs section is represented and links to its listing page', { skip }, () => {
	for (const s of DOCS_SECTIONS) {
		assert.ok(
			hubHtml.includes(`href="/docs/${s.slug}/"`),
			`hub missing link to /docs/${s.slug}/`,
		);
		assert.ok(hubHtml.includes(`>${esc(s.label)}<`), `hub missing card for section "${s.label}"`);
	}
});

test('every KB category is represented, linking real articles only', { skip }, () => {
	for (const c of KB_CATEGORIES) {
		assert.ok(
			hubHtml.includes(`>${esc(c.label)}<`),
			`hub missing card for KB category "${c.label}"`,
		);
		// /kb/<category>/ is NOT a route — only the articles beneath it are.
		assert.ok(
			!hubHtml.includes(`href="/kb/${c.slug}/"`),
			`hub links /kb/${c.slug}/, which no page is served at`,
		);
		// Each category's written page(s) must be linked from its card.
		for (const pg of c.pages.filter((p) => p.href)) {
			assert.ok(hubHtml.includes(`href="${pg.href}"`), `hub missing KB article link ${pg.href}`);
		}
	}
});

test('the hub reaches the other surfaces it advertises', { skip }, () => {
	for (const href of ['/changelog', '/blog', '/benchmarks/', '/profiles']) {
		assert.ok(hubHtml.includes(`href="${href}"`), `hub missing onward link ${href}`);
	}
});

test('nav points at the hub, not past it into Starlight', async () => {
	const nav = JSON.parse(
		await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'),
	);
	const all = [];
	const walk = (links) => {
		for (const l of links) {
			all.push(l);
			if (l.sub) walk(l.sub);
		}
	};
	walk(nav.header);
	for (const col of nav.footerColumns) walk(col.links);

	const docsLinks = all.filter((l) => l.label === 'docs' || l.label === 'learn');
	assert.ok(docsLinks.length >= 2, 'expected docs entries in both header and footer');
	for (const l of docsLinks) {
		assert.equal(
			l.href,
			'/docs/',
			`"${l.label}" should land on the hub so readers see the map before the sidebar`,
		);
	}
});
