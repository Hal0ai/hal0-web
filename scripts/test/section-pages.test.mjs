// scripts/test/section-pages.test.mjs
//
// Unit tests for the pure listing derivation behind SectionPageList.astro
// (src/lib/section-pages.mjs) plus a cross-check against the generated
// data it actually runs on in production: every row DOCS_FORUM_PAGES
// produces must resolve to a forum.hal0.dev href that also appears in
// src/data/docs-redirects.json — the handoff's "derived, never
// hand-maintained" rule, now anchored on the forum move instead of the
// old content collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deriveForumSectionRows } from '../../src/lib/section-pages.mjs';
import { DOCS_FORUM_PAGES } from '../../src/data/docs-forum-pages.ts';

const page = (id, order, extra = {}) => ({
	section: id.split('/')[1],
	subsection: extra.subsection ?? null,
	id,
	title: extra.title ?? id.split('/').pop(),
	description: extra.description ?? '',
	order: order === undefined ? null : order,
	href: extra.href ?? `https://forum.hal0.dev/t/${id.split('/').pop()}/1`,
});

test('filters to the requested section', () => {
	const rows = deriveForumSectionRows(
		[page('docs/concepts/slots', 20), page('docs/guides/manage-slots', 10)],
		'concepts',
	);
	assert.deepEqual(
		rows.map((r) => r.title),
		['slots'],
	);
});

test('sorts by order, missing order last, id tie-break', () => {
	const rows = deriveForumSectionRows(
		[
			page('docs/concepts/zeta', undefined),
			page('docs/concepts/slots', 20),
			page('docs/concepts/architecture', 10),
			page('docs/concepts/alpha', undefined),
		],
		'concepts',
	);
	assert.deepEqual(
		rows.map((r) => r.title),
		['architecture', 'slots', 'alpha', 'zeta'],
	);
});

test('nested sub-pages (api/) trail top-level pages regardless of order', () => {
	const rows = deriveForumSectionRows(
		[
			page('docs/reference/api/rest', 1, { subsection: 'api' }),
			page('docs/reference/cli', 50),
		],
		'reference',
	);
	assert.deepEqual(
		rows.map((r) => r.title),
		['cli', 'rest'],
	);
});

test('ord is zero-based and zero-padded; href passes through untouched', () => {
	const rows = deriveForumSectionRows(
		[
			page('docs/operate/auth', 10, { href: 'https://forum.hal0.dev/t/authentication-hal0-docs/43' }),
			page('docs/operate/services', 20, { href: 'https://forum.hal0.dev/t/services-hal0-docs/45' }),
		],
		'operate',
	);
	assert.deepEqual(
		rows.map((r) => r.ord),
		['00', '01'],
	);
	assert.equal(rows[0].href, 'https://forum.hal0.dev/t/authentication-hal0-docs/43');
});

// ── cross-check against the generated data ─────────────────────────────
// Every page DOCS_FORUM_PAGES lists must (a) resolve via
// deriveForumSectionRows for its own section, and (b) carry the exact
// href docs-redirects.json maps its site path to — the two generated
// artifacts must agree, since a redirect and a listing row pointing at
// different forum topics for the same doc would be a broken link with no
// build-time signal.
const redirectsUrl = new URL('../../src/data/docs-redirects.json', import.meta.url);
const REDIRECTS = JSON.parse(await readFile(fileURLToPath(redirectsUrl), 'utf8'));
const SECTIONS = ['getting-started', 'concepts', 'guides', 'operate', 'reference'];

test('every DOCS_FORUM_PAGES entry is covered by its section listing', () => {
	for (const section of SECTIONS) {
		const rows = deriveForumSectionRows(DOCS_FORUM_PAGES, section);
		const expected = DOCS_FORUM_PAGES.filter((p) => p.section === section).length;
		assert.equal(rows.length, expected, `${section} listing dropped a page`);
	}
});

test('DOCS_FORUM_PAGES hrefs match docs-redirects.json for the same path', () => {
	for (const p of DOCS_FORUM_PAGES) {
		const redirect = REDIRECTS[`/${p.id}`];
		assert.ok(redirect, `docs-redirects.json missing an entry for /${p.id}`);
		assert.equal(redirect, p.href, `href drift for /${p.id}`);
	}
});
