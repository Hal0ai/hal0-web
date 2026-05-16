// Cloudflare Pages middleware — host-conditional rewrite.
//
// When the same Pages project is fronted by both `hal0.dev` and
// `releases.hal0.dev`, rewrite the bare subdomain root to /releases/
// so `https://releases.hal0.dev/stable.json` serves
// `dist/releases/stable.json` without polluting the marketing-site
// root with channel manifests.
//
// `_redirects` host-conditional rewrites (the `https://host/* /dest 200`
// form) don't reliably fire for same-project routing, so we use a Function
// middleware instead. Static-asset routing kicks in after `context.next`.

export const onRequest: PagesFunction = async (context) => {
	const url = new URL(context.request.url);

	if (
		url.hostname === "releases.hal0.dev" &&
		!url.pathname.startsWith("/releases/")
	) {
		const rewritten = new URL(context.request.url);
		rewritten.pathname = "/releases" + url.pathname;
		return context.next(new Request(rewritten.toString(), context.request));
	}

	return context.next();
};
