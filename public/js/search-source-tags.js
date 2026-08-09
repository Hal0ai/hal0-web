// Source tags on Pagefind search results — Tier B of the Starlight
// theming handoff item 3.5 (comp: 01 Unified Chrome, spec 06 "search":
// every result row carries a right-aligned source tag so a unified index
// still reads as sections). Progressive enhancement, same pattern as
// blog-rss-button.js: Pagefind renders results client-side with no
// template seam, so a MutationObserver annotates rows as they appear.
// No JS → plain rows, nothing breaks.
//
// Tags derive from the result URL's path prefix. bench / profiles /
// forum are FUTURE indexes (cross-surface federation is a separate
// workstream) — add their prefixes here when those surfaces join the
// index.
(() => {
	const PREFIXES = [
		['/docs/', 'docs'],
		['/kb/', 'kb'],
		['/blog/', 'blog'],
		['/changelog', 'changelog'],
	];

	const tagFor = (href) => {
		try {
			const p = new URL(href, location.origin).pathname;
			for (const [prefix, tag] of PREFIXES) if (p.startsWith(prefix)) return tag;
		} catch {
			/* malformed href — fall through */
		}
		return 'page';
	};

	const annotate = (root) => {
		for (const link of root.querySelectorAll(
			'.pagefind-ui__result-link:not([data-src-tagged])',
		)) {
			link.setAttribute('data-src-tagged', '');
			const title = link.closest('.pagefind-ui__result-title');
			if (!title) continue;
			const tag = document.createElement('span');
			tag.className = 'search-src';
			tag.textContent = tagFor(link.getAttribute('href') || '');
			title.appendChild(tag);
		}
	};

	const init = () => {
		const mount = document.getElementById('starlight__search');
		if (!mount) return;
		new MutationObserver(() => annotate(mount)).observe(mount, {
			childList: true,
			subtree: true,
		});
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
