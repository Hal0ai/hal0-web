// scripts/test/section-pages.test.mjs
//
// Unit tests for the pure listing derivation behind SectionPageList.astro
// (src/lib/section-pages.mjs) plus a filesystem cross-check: every
// section listed by a docs/<section>/index.mdx must derive one row per
// non-hidden .mdx page in that directory — the handoff's "derived, never
// hand-maintained" rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deriveSectionRows } from '../../src/lib/section-pages.mjs';

const entry = (id, order, extra = {}) => ({
	id,
	data: { title: id.split('/').pop(), sidebar: order === undefined ? {} : { order }, ...extra.data },
	...extra,
});

test('filters to the section, excluding the section index itself', () => {
	const rows = deriveSectionRows(
		[
			entry('docs/concepts/slots', 20),
			entry('docs/concepts', undefined), // the index page (id has no trailing segment)
			entry('docs/guides/manage-slots', 10),
		],
		'concepts',
	);
	assert.deepEqual(
		rows.map((r) => r.href),
		['/docs/concepts/slots/'],
	);
});

test('sorts by sidebar.order, missing order last, slug tie-break', () => {
	const rows = deriveSectionRows(
		[
			entry('docs/concepts/zeta', undefined),
			entry('docs/concepts/slots', 20),
			entry('docs/concepts/architecture', 10),
			entry('docs/concepts/alpha', undefined),
		],
		'concepts',
	);
	assert.deepEqual(
		rows.map((r) => r.title),
		['architecture', 'slots', 'alpha', 'zeta'],
	);
});

test('nested sub-pages (api/) trail top-level pages regardless of order', () => {
	const rows = deriveSectionRows(
		[
			entry('docs/reference/api/rest', 1),
			entry('docs/reference/cli', 50),
		],
		'reference',
	);
	assert.deepEqual(
		rows.map((r) => r.title),
		['cli', 'rest'],
	);
});

test('ord is zero-based and zero-padded; hidden entries are excluded', () => {
	const rows = deriveSectionRows(
		[
			entry('docs/operate/auth', 10),
			entry('docs/operate/services', 20),
			{ id: 'docs/operate/draft', data: { title: 'draft', sidebar: { hidden: true } } },
		],
		'operate',
	);
	assert.deepEqual(
		rows.map((r) => r.ord),
		['00', '01'],
	);
});

test('filename derives from filePath as <section>/<file>.mdx', () => {
	const rows = deriveSectionRows(
		[
			entry('docs/concepts/slots', 20, {
				filePath: 'src/content/docs/docs/concepts/slots.mdx',
			}),
		],
		'concepts',
	);
	assert.equal(rows[0].filename, 'concepts/slots.mdx');
});

// ── filesystem cross-check ─────────────────────────────────────────────
// For each section that ships an index.mdx listing page, the number of
// listable pages on disk (non-index .mdx files) must equal the number of
// rows the derivation produces from equivalent synthetic entries. This
// catches a page added to the directory that the listing silently drops
// (e.g. a filter regression), without needing the Astro runtime.
const DOCS_ROOT = fileURLToPath(new URL('../../src/content/docs/docs/', import.meta.url));
const LISTED_SECTIONS = ['concepts', 'guides', 'operate', 'reference'];

async function mdxFiles(dir, rel = '') {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...(await mdxFiles(full, path.join(rel, e.name))));
		else if (e.name.endsWith('.mdx')) out.push(path.join(rel, e.name));
	}
	return out;
}

for (const section of LISTED_SECTIONS) {
	test(`listing covers every page on disk: ${section}`, async () => {
		const files = (await mdxFiles(path.join(DOCS_ROOT, section))).filter(
			(f) => f !== 'index.mdx',
		);
		const hidden = [];
		for (const f of files) {
			const src = await readFile(path.join(DOCS_ROOT, section, f), 'utf8');
			if (/^\s*hidden:\s*true\s*$/m.test(src)) hidden.push(f);
		}
		const synthetic = files.map((f) =>
			entry(`docs/${section}/${f.replace(/\.mdx$/, '').replace(/\/index$/, '')}`, 1, {
				data: { title: f, sidebar: { hidden: hidden.includes(f) } },
			}),
		);
		const rows = deriveSectionRows(synthetic, section);
		assert.equal(rows.length, files.length - hidden.length);
	});
}
