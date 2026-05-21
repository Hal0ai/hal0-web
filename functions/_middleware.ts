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

const CHANNEL_RE = /^\/(stable|nightly|dev)\.json$/;
const RELEASES_API = "https://api.github.com/repos/Hal0ai/hal0/releases?per_page=10";

interface GhAsset {
	name: string;
	browser_download_url: string;
}
interface GhRelease {
	tag_name: string;
	draft: boolean;
	prerelease: boolean;
	assets: GhAsset[];
}

async function proxyChannelManifest(channel: string): Promise<Response | null> {
	// CF's HTTP cache honors Cache-Control on upstream responses; the GitHub
	// API ships its own cache headers. For tighter control (per-edge TTL),
	// switch to the `cf: { cacheTtl }` fetch option once
	// @cloudflare/workers-types is wired into the Pages tsconfig.
	const listResp = await fetch(RELEASES_API, {
		headers: {
			"User-Agent": "hal0-releases-proxy",
			Accept: "application/vnd.github+json",
		},
	});
	if (!listResp.ok) return null;

	const releases = (await listResp.json()) as GhRelease[];
	for (const release of releases) {
		if (release.draft) continue;
		const asset = release.assets?.find((a) => a.name === `${channel}.json`);
		if (!asset) continue;

		const assetResp = await fetch(asset.browser_download_url, {
			headers: { "User-Agent": "hal0-releases-proxy" },
			redirect: "follow",
		});
		if (!assetResp.ok) continue;

		const body = await assetResp.text();
		return new Response(body, {
			status: 200,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"access-control-allow-origin": "*",
				"cache-control": "public, max-age=60, must-revalidate",
				"x-content-type-options": "nosniff",
				"x-hal0-source": `github-release/${release.tag_name}`,
				"x-hal0-channel": channel,
			},
		});
	}
	return null;
}

export const onRequest: PagesFunction = async (context) => {
	const url = new URL(context.request.url);

	if (url.hostname === "releases.hal0.dev") {
		const channelMatch = url.pathname.match(CHANNEL_RE);
		if (channelMatch) {
			try {
				const live = await proxyChannelManifest(channelMatch[1]);
				if (live) return live;
			} catch {
				// fall through to static backstop
			}
		}

		if (!url.pathname.startsWith("/releases/")) {
			const rewritten = new URL(context.request.url);
			rewritten.pathname = "/releases" + url.pathname;
			return context.next(new Request(rewritten.toString(), context.request));
		}
	}

	return context.next();
};
