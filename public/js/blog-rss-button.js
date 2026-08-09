// Progressive enhancement only: injects an "rss" button above the blog
// index post list, linking to /blog/rss.xml.
//
// Why this exists instead of a template edit: starlight-blog's blog index
// route (its Blog.astro) isn't one of the component slots Starlight lets a
// consumer override, and it hides Starlight's own page-title panel via its
// own scoped CSS — there's no supported seam to add a header-row button
// without forking the plugin. This runs after the static HTML is in and
// inserts a real, accessible <a> so the button survives with JS disabled
// removed (it simply won't appear — the footer's RSS icon button, present
// on every page via SiteFooter, still covers the no-JS case).
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

	posts.parentElement?.insertBefore(btn, posts);
})();
