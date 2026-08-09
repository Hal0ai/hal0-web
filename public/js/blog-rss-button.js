// Progressive enhancement only: completes the blog index header toward
// the comp (04 Blog and KB.html, BlogIndex `phead`): a "blog · dated"
// surface tag above the title, the intro line under it, and the "rss"
// ghost button right-aligned on the title row.
//
// Why this exists instead of a template edit: starlight-blog's blog index
// route (its Blog.astro) isn't one of the component slots Starlight lets a
// consumer override (re-verified on starlight-blog 0.28 — the plugin has
// no overridable-components mechanism; only `title` is configurable, and
// that string also feeds the RSS feed + page metadata, so it can't carry
// the comp's display headline). This runs after the static HTML is in and
// inserts real, accessible elements; with JS disabled the page keeps its
// static h1 + post list, and the footer's RSS icon button (present on
// every page via SiteFooter) covers the no-JS RSS case.
(() => {
	if (document.querySelector('.blog-rss-btn')) return;
	const path = location.pathname.replace(/\/$/, '') || '/';
	if (path !== '/blog') return;

	const posts = document.querySelector('.content-panel .sl-markdown-content .posts');
	if (!posts) return;

	const btn = document.createElement('a');
	btn.className = 'blog-rss-btn';
	btn.href = '/blog/rss.xml';
	btn.textContent = 'rss';
	btn.setAttribute('aria-label', 'Subscribe via RSS');

	// Comp `phead`: surface tag over the h1, intro under it, RSS button
	// right-aligned on the title row. The h1 lives in Starlight's own
	// title panel; rebuild that panel's inner layout as tag/h1/intro in a
	// left column with the button beside it.
	const h1 = document.getElementById('_top');
	const holder = h1?.parentElement;
	if (h1 && holder) {
		const tag = document.createElement('span');
		tag.className = 'blog-surface-tag';
		tag.textContent = 'blog · dated';

		const intro = document.createElement('p');
		intro.className = 'blog-intro';
		intro.textContent =
			'Releases, sweeps and post-mortems, in order. Anything that stays true after six months moves to the knowledge base instead.';

		const left = document.createElement('div');
		const row = document.createElement('div');
		row.className = 'blog-phead-row';
		holder.insertBefore(row, h1);
		left.append(tag, h1, intro);
		row.append(left, btn);
	} else {
		posts.parentElement?.insertBefore(btn, posts);
	}
})();
