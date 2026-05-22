// Cloudflare Pages middleware — host-conditional rewrite + releases proxy.
//
// Two responsibilities on `releases.hal0.dev`:
//
//  1. `releases.hal0.dev/{stable,nightly,dev}.json` is proxied LIVE from
//     the most recent GitHub release on `Hal0ai/hal0` that carries an
//     asset of that name. Self-syncing: each tagged release on hal0
//     becomes visible at releases.hal0.dev without a hal0-web deploy.
//     Static `public/releases/*.json` stays as a placeholder backstop
//     in case the GitHub API is unreachable.
//
//  2. Anything else on `releases.hal0.dev` (e.g. `/foo`) is rewritten
//     to `/releases/foo` so the static files under `public/releases/`
//     are reachable without polluting the marketing-site root.
//
// `_redirects` host-conditional rewrites don't reliably fire for
// same-project routing, hence this Function middleware.
//
// Observability: every fallthrough sets `x-hal0-proxy-failed: <reason>`
// on the static-placeholder response so external probes can distinguish
// proxy-broken from proxy-not-deployed without `wrangler tail`.
// `console.warn` calls surface in CF Pages logs for deeper debugging.
//
// Auth: if `env.GITHUB_TOKEN` is set in the CF Pages environment, both
// upstream calls authenticate. Required in practice because CF outbound
// IPs are shared across every CF customer and the anonymous 60/hr/IP
// limit is permanently exhausted. Authenticated requests get 5000/hr
// per token. The token only needs public-repo read scope.

const CHANNEL_RE = /^\/(stable|nightly|dev)\.json$/;
const RELEASES_API = "https://api.github.com/repos/Hal0ai/hal0/releases?per_page=10";

function authHeaders(token: string | undefined): Record<string, string> {
	const base: Record<string, string> = {
		"User-Agent": "hal0-releases-proxy",
	};
	if (token) base.Authorization = `Bearer ${token}`;
	return base;
}

interface GhAsset {
	id: number;
	name: string;
	url: string; // api.github.com asset endpoint
	browser_download_url: string;
}
interface GhRelease {
	tag_name: string;
	draft: boolean;
	prerelease: boolean;
	assets: GhAsset[];
}

type ProxyOutcome =
	| { ok: true; response: Response }
	| { ok: false; reason: string };

async function proxyChannelManifest(
	channel: string,
	token: string | undefined,
): Promise<ProxyOutcome> {
	let listResp: Response;
	try {
		listResp = await fetch(RELEASES_API, {
			headers: {
				...authHeaders(token),
				Accept: "application/vnd.github+json",
			},
		});
	} catch (e) {
		const reason = `gh-list-threw:${(e as Error).message}`;
		console.warn(`[releases-proxy] ${reason}`);
		return { ok: false, reason };
	}
	if (!listResp.ok) {
		const reason = `gh-list-${listResp.status}${token ? "-auth" : "-anon"}`;
		console.warn(`[releases-proxy] ${reason} body=${(await listResp.text()).slice(0, 200)}`);
		return { ok: false, reason };
	}

	let releases: GhRelease[];
	try {
		releases = (await listResp.json()) as GhRelease[];
	} catch (e) {
		const reason = `gh-list-parse:${(e as Error).message}`;
		console.warn(`[releases-proxy] ${reason}`);
		return { ok: false, reason };
	}

	for (const release of releases) {
		if (release.draft) continue;
		const asset = release.assets?.find((a) => a.name === `${channel}.json`);
		if (!asset) continue;

		// Use the api.github.com asset endpoint with octet-stream Accept.
		// Returns a 302 to objects.githubusercontent.com with the asset
		// bytes; `redirect: "follow"` lands us on the body in one hop.
		// This is the documented direct-download path and gets the same
		// rate-limit budget as the releases-list call above.
		let assetResp: Response;
		try {
			assetResp = await fetch(asset.url, {
				headers: {
					...authHeaders(token),
					Accept: "application/octet-stream",
				},
				redirect: "follow",
			});
		} catch (e) {
			const reason = `gh-asset-threw:${(e as Error).message}:${release.tag_name}`;
			console.warn(`[releases-proxy] ${reason}`);
			return { ok: false, reason };
		}
		if (!assetResp.ok) {
			const reason = `gh-asset-${assetResp.status}:${release.tag_name}`;
			console.warn(`[releases-proxy] ${reason}`);
			return { ok: false, reason };
		}

		const body = await assetResp.text();
		return {
			ok: true,
			response: new Response(body, {
				status: 200,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"access-control-allow-origin": "*",
					"cache-control": "public, max-age=60, must-revalidate",
					"x-content-type-options": "nosniff",
					"x-hal0-source": `github-release/${release.tag_name}`,
					"x-hal0-channel": channel,
				},
			}),
		};
	}
	const reason = `no-asset:${channel}.json:${releases.length}releases`;
	console.warn(`[releases-proxy] ${reason}`);
	return { ok: false, reason };
}

// Minimal local shape for the Cloudflare Pages function context. We don't
// pull in `@cloudflare/workers-types` because the production deploy is
// Vercel; this middleware exists for parity if a Pages preview is wired up.
type PagesEnv = {
	GITHUB_TOKEN?: string;
};
type PagesFunctionContext = {
	request: Request;
	next: (input?: Request) => Promise<Response>;
	env: PagesEnv;
};
type PagesFunction = (context: PagesFunctionContext) => Promise<Response>;

async function annotateFallthrough(
	context: PagesFunctionContext,
	rewrittenUrl: string,
	reason: string,
): Promise<Response> {
	const fallback = await context.next(new Request(rewrittenUrl, context.request));
	const headers = new Headers(fallback.headers);
	headers.set("x-hal0-proxy-failed", reason);
	return new Response(fallback.body, {
		status: fallback.status,
		statusText: fallback.statusText,
		headers,
	});
}

export const onRequest: PagesFunction = async (context) => {
	const url = new URL(context.request.url);

	if (url.hostname === "releases.hal0.dev") {
		const channelMatch = url.pathname.match(CHANNEL_RE);
		if (channelMatch) {
			const outcome = await proxyChannelManifest(channelMatch[1], context.env.GITHUB_TOKEN);
			if (outcome.ok) return outcome.response;
			// Fall through to the static placeholder, but annotate why.
			const rewritten = new URL(context.request.url);
			rewritten.pathname = "/releases" + url.pathname;
			return annotateFallthrough(context, rewritten.toString(), outcome.reason);
		}

		if (!url.pathname.startsWith("/releases/")) {
			const rewritten = new URL(context.request.url);
			rewritten.pathname = "/releases" + url.pathname;
			return context.next(new Request(rewritten.toString(), context.request));
		}
	}

	return context.next();
};
