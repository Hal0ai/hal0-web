// Pure derivation for the docs section listing pages (comp: 08 Docs.html
// Category view, `.plist`/`.prow`). Rows come from
// src/data/docs-forum-pages.ts now that hal0's docs content lives on
// forum.hal0.dev instead of a local content collection — this module used
// to query `getCollection('docs')`; it now filters/sorts the static
// generated array instead. Kept as a separate module (rather than inlined
// in SectionPageList.astro) so the ordering rules stay testable under
// plain `node --test` (scripts/test/section-pages.test.mjs).

/**
 * Derive ordered listing rows for one docs section, each linking straight
 * out to the page's forum.hal0.dev topic.
 *
 * @param {Array<{section: string, subsection: string|null, id: string,
 *   title: string, description: string, order: number|null, href: string}>} pages
 *   Entries from DOCS_FORUM_PAGES (or an equivalently-shaped test fixture).
 * @param {string} section  Section slug, e.g. "concepts".
 * @returns {Array<{ord: string, href: string, title: string, description: string}>}
 *
 * Rows are sorted top-level pages first (matching the old sidebar's
 * trailing nested `api/` group), then by `order` ascending (missing order
 * sorts last), then `id` — the same ordering `deriveSectionRows` used to
 * apply over the content collection, minus the parts that only made sense
 * for an on-site route (`filename`, collection-relative `href`).
 */
export function deriveForumSectionRows(pages, section) {
	const rows = pages
		.filter((p) => p.section === section)
		.sort(
			(a, b) =>
				Number(Boolean(a.subsection)) - Number(Boolean(b.subsection)) ||
				(a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) ||
				a.id.localeCompare(b.id),
		);
	return rows.map((r, i) => ({
		ord: String(i).padStart(2, '0'),
		href: r.href,
		title: r.title,
		description: r.description,
	}));
}
