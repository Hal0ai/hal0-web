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
import { existsSync } from 'node:fs';
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

/** dist path a root-relative URL should resolve to. */
function resolves(href) {
	const root = fileURLToPath(new URL('../../dist', import.meta.url));
	const withIndex = root + (href.endsWith('/') ? href + 'index.html' : href + '/index.html');
	return existsSync(withIndex) || existsSync(root + href);
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
		assert.ok(hubHtml.includes(`>${s.label}<`), `hub missing card for section "${s.label}"`);
	}
});

test('every KB category is represented and links to its section', { skip }, () => {
	for (const c of KB_CATEGORIES) {
		assert.ok(hubHtml.includes(`href="/kb/${c.slug}/"`), `hub missing link to /kb/${c.slug}/`);
	}
});

test('the hub reaches the other surfaces it advertises', { skip }, () => {
	for (const href of ['/kb/', '/changelog', '/blog', '/benchmarks/', '/profiles']) {
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
