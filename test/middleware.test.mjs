// Behavioural tests for functions/_middleware.ts — the releases.hal0.dev
// channel-manifest + Sigstore-bundle proxy.
//
// Why these exist: the middleware decides which GitHub Release a hardened
// client's manifest AND its signature bundle come from. If those two ever
// come from different releases, `cosign verify-blob` fails and the client
// reads a routing bug as tampering. The same-release pairing rule and the
// fail-closed-on-missing-bundle rule are load-bearing security invariants
// that a later refactor could silently break, so they are pinned here.
//
// Runs the real exported `onRequest` against a stubbed GitHub Releases API.
// Node's built-in test runner and type stripping only — no dev dependencies,
// no build step. `npm test`.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const MIDDLEWARE = new URL("../functions/_middleware.ts", import.meta.url);

// ── fixture ────────────────────────────────────────────────────────────────
// Shaped like GET /repos/Hal0ai/hal0/releases, newest first as the real API
// returns. Channel targets mirror hal0's src/hal0/release/policy.py.
const asset = (name) => ({
	id: name.length,
	name,
	url: `https://api.github.com/asset/${name}`,
	browser_download_url: `https://github.com/dl/${name}`,
});

const NIGHTLY_TAG = "v1.0.0-nightly.20260727";
const PREVIEW_TAG = "v1.0.0-alpha.2";
const STABLE_TAG = "v0.9.8";

const RELEASES = [
	{
		tag_name: NIGHTLY_TAG,
		draft: false,
		prerelease: true,
		assets: [asset("nightly.json"), asset("nightly.json.bundle")],
	},
	{
		tag_name: PREVIEW_TAG,
		draft: false,
		prerelease: true,
		assets: [asset("preview.json"), asset("preview.json.bundle")],
	},
	{
		// A final tag publishes to BOTH stable and preview.
		tag_name: STABLE_TAG,
		draft: false,
		prerelease: false,
		assets: [
			asset("stable.json"),
			asset("stable.json.bundle"),
			asset("preview.json"),
			asset("preview.json.bundle"),
		],
	},
];

let releases = RELEASES;
let assetFetches = [];
let apiCalls = 0;
let realFetch;

function stubFetch() {
	return async (input, init) => {
		const url = typeof input === "string" ? input : input.url;
		if (url.startsWith("https://api.github.com/repos/")) {
			apiCalls++;
			return new Response(JSON.stringify(releases), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		if (url.startsWith("https://api.github.com/asset/")) {
			const name = url.slice(url.lastIndexOf("/") + 1);
			assetFetches.push(name);
			assert.equal(
				init.headers.Accept,
				"application/octet-stream",
				"asset download must use the documented octet-stream path",
			);
			return new Response(`BYTES:${name}`, { status: 200 });
		}
		throw new Error(`unexpected fetch: ${url}`);
	};
}

before(() => {
	realFetch = globalThis.fetch;
	globalThis.fetch = stubFetch();
});
after(() => {
	globalThis.fetch = realFetch;
});

const { onRequest } = await import(MIDDLEWARE.href);

// `next` stands in for the static-asset pipeline: it records the path it was
// handed (so rewrites are observable) and 404s anything not in public/releases/.
const STATIC_FILES = new Set(["/releases/stable.json", "/releases/nightly.json"]);

function request(url) {
	const seen = [];
	const context = {
		request: new Request(url),
		env: {},
		next: async (req) => {
			const path = new URL(req ? req.url : url).pathname;
			seen.push(path);
			return STATIC_FILES.has(path)
				? new Response(`{"_placeholder":true,"path":"${path}"}`, { status: 200 })
				: new Response("not found", { status: 404 });
		},
	};
	return { context, seen };
}

function reset() {
	releases = RELEASES;
	assetFetches = [];
	apiCalls = 0;
}

// ── the pairing invariant ──────────────────────────────────────────────────
describe("manifest/bundle pairing", () => {
	it("serves a channel manifest from the newest release carrying it", async () => {
		reset();
		const { context } = request("https://releases.hal0.dev/stable.json");
		const res = await onRequest(context);

		assert.equal(res.status, 200);
		assert.equal(await res.text(), "BYTES:stable.json");
		assert.equal(res.headers.get("x-hal0-source"), `github-release/${STABLE_TAG}`);
		assert.equal(res.headers.get("x-hal0-channel"), "stable");
		assert.equal(res.headers.get("x-hal0-artifact"), "manifest");
	});

	it("serves the sibling bundle from the SAME release as the manifest", async () => {
		reset();
		const { context } = request("https://releases.hal0.dev/stable.json.bundle");
		const res = await onRequest(context);

		assert.equal(res.status, 200);
		assert.equal(await res.text(), "BYTES:stable.json.bundle");
		assert.equal(res.headers.get("x-hal0-source"), `github-release/${STABLE_TAG}`);
		assert.equal(res.headers.get("x-hal0-artifact"), "bundle");
	});

	it("selects the release by the MANIFEST asset, never by the bundle", async () => {
		// v1.1.0 is newer and carries stable.json but its bundle upload broke.
		// Selecting by bundle would silently skip to v0.9.8 and pair v1.1.0's
		// manifest with v0.9.8's signature on a later request. Fail closed.
		reset();
		releases = [
			{ tag_name: "v1.1.0", draft: false, prerelease: false, assets: [asset("stable.json")] },
			...RELEASES,
		];
		const { context, seen } = request("https://releases.hal0.dev/stable.json.bundle");
		const res = await onRequest(context);

		assert.equal(res.status, 404, "bundles have no static backstop");
		assert.equal(
			res.headers.get("x-hal0-proxy-failed"),
			"no-sibling:stable.json.bundle:v1.1.0",
		);
		assert.deepEqual(seen, ["/releases/stable.json.bundle"]);
		assert.deepEqual(assetFetches, [], "must not download an older release's bundle");
	});
});

// ── channel semantics (hal0 src/hal0/release/policy.py) ────────────────────
describe("channel semantics", () => {
	it("resolves preview from the newest prerelease", async () => {
		reset();
		for (const [path, body] of [
			["/preview.json", "BYTES:preview.json"],
			["/preview.json.bundle", "BYTES:preview.json.bundle"],
		]) {
			const { context } = request(`https://releases.hal0.dev${path}`);
			const res = await onRequest(context);
			assert.equal(res.status, 200, path);
			assert.equal(await res.text(), body);
			assert.equal(res.headers.get("x-hal0-source"), `github-release/${PREVIEW_TAG}`);
			assert.equal(res.headers.get("x-hal0-channel"), "preview");
		}
	});

	it("falls back to a final tag for preview when no prerelease is newer", async () => {
		// A final tag publishes stable.json AND preview.json.
		reset();
		releases = [RELEASES[2]];
		const { context } = request("https://releases.hal0.dev/preview.json");
		const res = await onRequest(context);
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("x-hal0-source"), `github-release/${STABLE_TAG}`);
	});

	it("resolves nightly from the newest nightly", async () => {
		reset();
		for (const path of ["/nightly.json", "/nightly.json.bundle"]) {
			const { context } = request(`https://releases.hal0.dev${path}`);
			const res = await onRequest(context);
			assert.equal(res.status, 200, path);
			assert.equal(res.headers.get("x-hal0-source"), `github-release/${NIGHTLY_TAG}`);
		}
	});

	it("does not let a nightly serve the stable pointer", async () => {
		reset();
		const { context } = request("https://releases.hal0.dev/stable.json");
		const res = await onRequest(context);
		assert.equal(res.headers.get("x-hal0-source"), `github-release/${STABLE_TAG}`);
	});

	it("skips draft releases", async () => {
		reset();
		releases = [
			{ tag_name: "v2.0.0", draft: true, prerelease: false, assets: [asset("stable.json")] },
			...RELEASES,
		];
		const { context } = request("https://releases.hal0.dev/stable.json");
		const res = await onRequest(context);
		assert.equal(res.headers.get("x-hal0-source"), `github-release/${STABLE_TAG}`);
	});
});

// ── response contract ─────────────────────────────────────────────────────
describe("response headers", () => {
	it("sets JSON content-type, permissive CORS, short cache and nosniff", async () => {
		reset();
		const { context } = request("https://releases.hal0.dev/preview.json");
		const res = await onRequest(context);

		assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
		assert.equal(res.headers.get("access-control-allow-origin"), "*");
		assert.equal(res.headers.get("cache-control"), "public, max-age=60, must-revalidate");
		assert.equal(res.headers.get("x-content-type-options"), "nosniff");
	});
});

// ── degradation ───────────────────────────────────────────────────────────
describe("fallthrough", () => {
	it("annotates the static placeholder when no release carries the channel", async () => {
		reset();
		releases = [];
		const { context, seen } = request("https://releases.hal0.dev/stable.json");
		const res = await onRequest(context);

		assert.equal(res.status, 200, "static placeholder still served");
		assert.equal(res.headers.get("x-hal0-proxy-failed"), "no-asset:stable.json:0releases");
		assert.deepEqual(seen, ["/releases/stable.json"]);
	});

	it("annotates rather than throwing when the GitHub API rate-limits", async () => {
		reset();
		const stubbed = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url = typeof input === "string" ? input : input.url;
			if (url.startsWith("https://api.github.com/repos/"))
				return new Response("rate limited", { status: 403 });
			return stubbed(input, init);
		};
		try {
			const { context } = request("https://releases.hal0.dev/nightly.json");
			const res = await onRequest(context);
			assert.equal(res.status, 200);
			assert.equal(res.headers.get("x-hal0-proxy-failed"), "gh-list-403-anon");
		} finally {
			globalThis.fetch = stubbed;
		}
	});

	it("keeps the legacy dev.json alias behaving exactly as before", async () => {
		reset();
		const { context, seen } = request("https://releases.hal0.dev/dev.json");
		const res = await onRequest(context);

		assert.equal(res.status, 404);
		assert.equal(res.headers.get("x-hal0-proxy-failed"), "no-asset:dev.json:3releases");
		assert.deepEqual(seen, ["/releases/dev.json"]);
	});
});

// ── routing ───────────────────────────────────────────────────────────────
describe("host-conditional rewrites", () => {
	it("rewrites non-channel paths under /releases/", async () => {
		reset();
		const { context, seen } = request("https://releases.hal0.dev/foo");
		await onRequest(context);
		assert.deepEqual(seen, ["/releases/foo"]);
	});

	it("does not double-prefix an already-/releases/ path", async () => {
		reset();
		const { context, seen } = request("https://releases.hal0.dev/releases/stable.json");
		await onRequest(context);
		assert.deepEqual(seen, ["/releases/stable.json"]);
	});

	it("leaves other hosts untouched and makes no GitHub API call", async () => {
		reset();
		for (const url of ["https://hal0.dev/install.sh", "https://hal0.dev/stable.json"]) {
			const { context, seen } = request(url);
			await onRequest(context);
			assert.deepEqual(seen, [new URL(url).pathname]);
		}
		assert.equal(apiCalls, 0, "no upstream call for non-releases hosts");
	});
});
