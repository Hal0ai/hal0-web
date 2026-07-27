// Cloudflare Pages middleware — host-conditional rewrite + releases proxy.
//
// Two responsibilities on `releases.hal0.dev`:
//
//  1. `releases.hal0.dev/{stable,preview,nightly}.json` — and the sibling
//     `<channel>.json.bundle` Sigstore bundle for each — are proxied LIVE from the
//     most recent GitHub release on `Hal0ai/hal0` that carries the channel
//     manifest. Self-syncing: each tagged release on hal0 becomes visible
//     at releases.hal0.dev without a hal0-web deploy.
//     Static `public/releases/*.json` stays as a placeholder backstop
//     in case the GitHub API is unreachable.
//
//     Channels mirror hal0's `src/hal0/release/policy.py` manifest targets:
//       final tag  v1.2.3          → stable.json + preview.json
//       preview    v1.2.3-alpha.2  → preview.json
//       nightly    v1.2.3-nightly.20260727 → nightly.json
//     release.yml uploads `<channel>.json` AND `<channel>.json.bundle` as a
//     pair for every target, so both are always resolvable from the SAME
//     release. Hardened clients (installer/bootstrap.sh `verify_release_manifest`,
//     src/hal0/updater/updater.py) require BOTH: they cosign-verify the exact
//     manifest bytes against the sibling bundle before parsing any artifact
//     URL. Serving the manifest without its bundle leaves the channel
//     non-operational, so the two are resolved from one release selection
//     (see `proxyChannelArtifact`) — never independently, which could pair a
//     manifest from release N with a bundle from release N-1 mid-publish.
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

// Capture 1 = channel, capture 2 = ".bundle" when the sibling Sigstore bundle
// is being requested. `dev` is a legacy alias kept so an old client asking for
// it behaves exactly as before (no release publishes dev.json, so it falls
// through to the static backstop); the live channels are stable/preview/nightly.
const CHANNEL_RE = /^\/(stable|preview|nightly|dev)\.json(\.bundle)?$/;
// per_page must comfortably out-span the nightly cadence: nightlies publish
// daily and carry only `nightly.json`, so at per_page=10 the newest release
// still carrying `stable.json` scrolls out of the window in ~a week and the
// stable pointer silently degrades to the static placeholder. 50 keeps a
// stable/preview tag reachable through a long nightly streak.
const RELEASES_API = "https://api.github.com/repos/Hal0ai/hal0/releases?per_page=50";

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

// Resolve `<channel>.json` or its sibling `<channel>.json.bundle` from the most
// recent non-draft release that carries the channel manifest.
//
// Release selection is driven by the MANIFEST asset in both cases, never by the
// bundle. That keeps a bundle request pinned to the same release a manifest
// request would resolve to, so `cosign verify-blob --bundle` sees a matching
// pair even if a new release lands between a client's two fetches. If the
// selected release carries the manifest but not its bundle (a broken publish),
// we fail loudly rather than walking back to an older release and handing out a
// mismatched pair.
async function proxyChannelArtifact(
	channel: string,
	wantBundle: boolean,
	token: string | undefined,
): Promise<ProxyOutcome> {
	const manifestName = `${channel}.json`;
	const assetName = wantBundle ? `${manifestName}.bundle` : manifestName;
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
		// The manifest decides which release serves this channel.
		if (!release.assets?.some((a) => a.name === manifestName)) continue;

		const asset = release.assets?.find((a) => a.name === assetName);
		if (!asset) {
			const reason = `no-sibling:${assetName}:${release.tag_name}`;
			console.warn(`[releases-proxy] ${reason}`);
			return { ok: false, reason };
		}

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
					// Sigstore bundles are JSON too (`cosign sign-blob --bundle`
					// writes a JSON-serialized protobuf bundle), so one
					// content-type covers manifest and bundle alike.
					"content-type": "application/json; charset=utf-8",
					"access-control-allow-origin": "*",
					"cache-control": "public, max-age=60, must-revalidate",
					"x-content-type-options": "nosniff",
					"x-hal0-source": `github-release/${release.tag_name}`,
					"x-hal0-channel": channel,
					"x-hal0-artifact": wantBundle ? "bundle" : "manifest",
				},
			}),
		};
	}
	const reason = `no-asset:${manifestName}:${releases.length}releases`;
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
			const outcome = await proxyChannelArtifact(
				channelMatch[1],
				channelMatch[2] === ".bundle",
				context.env.GITHUB_TOKEN,
			);
			if (outcome.ok) return outcome.response;
			// Fall through to the static placeholder, but annotate why.
			// Bundles have no static backstop (a placeholder signature would be
			// worse than a 404 — it would fail cosign verification and read as
			// tampering), so a bundle fallthrough is an annotated 404.
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
