import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	onRequest,
	parseMachineRoute,
	parsePointerDocument,
	RELEASE_POINTER_DOCUMENT_KEY,
	type PagesFunctionContext,
} from "./_middleware.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const tags = {
	stable: "v1.2.3",
	preview: "v1.3.0-rc.2",
	nightly: "v1.3.0-nightly.20260722123000",
} as const;

function pointerDocument(
	channels: Record<string, { tag: string; mode: string }> = {
		stable: { tag: tags.stable, mode: "paired" },
		preview: { tag: tags.preview, mode: "paired" },
		nightly: { tag: tags.nightly, mode: "paired" },
	},
): string {
	return JSON.stringify({
		_schema: "hal0.release-pointers.v1",
		generation: 7,
		channels,
	});
}

function release(tag: string, channel: string, options: { draft?: boolean; pair?: boolean } = {}) {
	const assets = [
		{ name: `${channel}.json`, url: "https://api.github.com/repos/Hal0ai/hal0/releases/assets/101" },
	];
	if (options.pair !== false) {
		assets.push({
			name: `${channel}.json.bundle`,
			url: "https://api.github.com/repos/Hal0ai/hal0/releases/assets/102",
		});
	}
	return { tag_name: tag, draft: options.draft ?? false, prerelease: channel !== "stable", assets };
}

function mockFetch(options: {
	tag?: string;
	channel?: string;
	releaseValue?: unknown;
	apiStatus?: number;
	assetStatus?: number;
	manifestBytes?: Uint8Array;
	bundleBytes?: Uint8Array;
	throwApi?: boolean;
	throwAsset?: boolean;
} = {}) {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const tag = options.tag ?? tags.stable;
	const channel = options.channel ?? "stable";
	globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, init });
		if (url.includes("/releases/tags/")) {
			if (options.throwApi) throw new Error("api offline");
			return Response.json(options.releaseValue ?? release(tag, channel), {
				status: options.apiStatus ?? 200,
			});
		}
		if (options.throwAsset) throw new Error("asset offline");
		const isBundle = url.endsWith("/102");
		const bytes = isBundle
			? (options.bundleBytes ?? new TextEncoder().encode("bundle"))
			: (options.manifestBytes ?? new TextEncoder().encode('{"exact":true}\n'));
		return new Response(bytes.slice().buffer as ArrayBuffer, {
			status: options.assetStatus ?? 200,
		});
	};
	return calls;
}

function context(
	path: string,
	options: {
		method?: string;
		binding?: boolean;
		kvText?: string | null;
		kvThrow?: boolean;
		token?: string;
		host?: string;
	} = {},
) {
	let nextCalls = 0;
	let requestedKey: string | null = null;
	const binding = options.binding === false ? undefined : {
		async get(key: string) {
			requestedKey = key;
			if (options.kvThrow) throw new Error("KV offline");
			return options.kvText === undefined ? pointerDocument() : options.kvText;
		},
	};
	const ctx: PagesFunctionContext = {
		request: new Request(`https://${options.host ?? "releases.hal0.dev"}${path}`, {
			method: options.method ?? "GET",
		}),
		env: { RELEASE_POINTERS: binding, GITHUB_TOKEN: options.token },
		next: async (request?: Request) => {
			nextCalls += 1;
			return new Response(request?.url ?? "next", { status: 299 });
		},
	};
	return {
		ctx,
		nextCalls: () => nextCalls,
		requestedKey: () => requestedKey,
	};
}

async function json(response: Response): Promise<Record<string, unknown>> {
	return await response.json() as Record<string, unknown>;
}

test("recognizes only exact stable, preview, and nightly JSON/bundle paths", () => {
	for (const channel of ["stable", "preview", "nightly"]) {
		assert.deepEqual(parseMachineRoute(`/${channel}.json`), {
			channel,
			assetName: `${channel}.json`,
			bundle: false,
		});
		assert.deepEqual(parseMachineRoute(`/${channel}.json.bundle`), {
			channel,
			assetName: `${channel}.json.bundle`,
			bundle: true,
		});
	}
	for (const path of [
		"/dev.json", "/stable.JSON", "/stable.json/", "/x/stable.json",
		"/stable.json.bundle.extra", "/preview", "/stable.json.bundle/",
	]) assert.equal(parseMachineRoute(path), null, path);
});

test("unsupported methods return machine 405 without KV, fetch, or static next", async () => {
	let fetched = false;
	globalThis.fetch = async () => { fetched = true; return new Response(); };
	for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]) {
		const state = context("/preview.json", { method });
		const response = await onRequest(state.ctx);
		assert.equal(response.status, 405);
		assert.equal(response.headers.get("allow"), "GET, HEAD");
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(state.requestedKey(), null);
		assert.equal(state.nextCalls(), 0);
	}
	assert.equal(fetched, false);
});

test("missing binding, missing document, and KV failure fail closed", async () => {
	for (const [options, code] of [
		[{ binding: false }, "pointer-binding-unavailable"],
		[{ kvText: null }, "pointer-document-unavailable"],
		[{ kvThrow: true }, "pointer-read-failed"],
	] as const) {
		const state = context("/stable.json", options);
		const response = await onRequest(state.ctx);
		assert.equal(response.status, 503);
		assert.equal((await json(response)).error, code);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(state.nextCalls(), 0);
	}
});

test("reads exactly the documented KV key", async () => {
	mockFetch();
	const state = context("/stable.json");
	assert.equal((await onRequest(state.ctx)).status, 200);
	assert.equal(state.requestedKey(), RELEASE_POINTER_DOCUMENT_KEY);
});

test("strictly validates pointer schema, generation, channels, records, tags, and modes", () => {
	const invalid: unknown[] = [
		{},
		{ _schema: "wrong", generation: 1, channels: {} },
		{ _schema: "hal0.release-pointers.v1", generation: 0, channels: {} },
		{ _schema: "hal0.release-pointers.v1", generation: 1.2, channels: {} },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: [], extra: true },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { dev: { tag: "v1.2.3", mode: "paired" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { stable: { tag: "v1.2.3-rc.1", mode: "paired" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { preview: { tag: "v1.2.3-nightly.20260722123000", mode: "paired" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { nightly: { tag: "v1.2.3-nightly.20260722", mode: "paired" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { preview: { tag: "v1.2.3-rc.1", mode: "legacy-json" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { stable: { tag: "v1.2.3", mode: "other" } } },
		{ _schema: "hal0.release-pointers.v1", generation: 1, channels: { stable: { tag: "v1.2.3", mode: "paired", extra: true } } },
	];
	assert.throws(() => parsePointerDocument("not-json"));
	for (const value of invalid) assert.throws(() => parsePointerDocument(JSON.stringify(value)));
	for (const tag of ["v1.2.3", "v1.2.3-alpha.0", "v1.2.3-beta.2", "v1.2.3-rc.10"]) {
		assert.doesNotThrow(() => parsePointerDocument(pointerDocument({ preview: { tag, mode: "paired" } })));
	}
});

test("an absent channel is a machine 404 and never calls static next", async () => {
	const state = context("/nightly.json", { kvText: pointerDocument({ stable: { tag: tags.stable, mode: "paired" } }) });
	const response = await onRequest(state.ctx);
	assert.equal(response.status, 404);
	assert.equal((await json(response)).error, "channel-not-configured");
	assert.equal(state.nextCalls(), 0);
});

test("paired mode resolves the exact tag endpoint and exact requested asset", async () => {
	const calls = mockFetch({ tag: tags.preview, channel: "preview" });
	const state = context("/preview.json.bundle");
	const response = await onRequest(state.ctx);
	assert.equal(response.status, 200);
	assert.equal(calls.length, 2);
	assert.equal(calls[0].url, `https://api.github.com/repos/Hal0ai/hal0/releases/tags/${encodeURIComponent(tags.preview)}`);
	assert.ok(calls[1].url.endsWith("/102"));
	assert.equal(calls.some((call) => /releases\?(?:.*per_page|.*page)|releases\/latest/.test(call.url)), false);
	assert.equal(state.nextCalls(), 0);
});

test("newer unrelated releases are irrelevant because no list/latest API is requested", async () => {
	const calls = mockFetch({ tag: tags.stable, channel: "stable" });
	const response = await onRequest(context("/stable.json").ctx);
	assert.equal(response.status, 200);
	assert.equal(calls.length, 2);
	assert.ok(calls[0].url.endsWith(`/tags/${tags.stable}`));
	assert.equal(calls.some((call) => call.url.includes("latest") || call.url.includes("per_page")), false);
});

test("paired mode refuses both files when either half of the same-release pair is absent", async () => {
	const complete = release(tags.stable, "stable");
	for (const releaseValue of [
		release(tags.stable, "stable", { pair: false }),
		{ ...complete, assets: complete.assets.slice(1) },
	]) {
		for (const path of ["/stable.json", "/stable.json.bundle"]) {
			mockFetch({ releaseValue });
			const state = context(path);
			const response = await onRequest(state.ctx);
			assert.equal(response.status, 502);
			assert.equal((await json(response)).error, "github-release-incomplete-pair");
			assert.equal(state.nextCalls(), 0);
		}
	}
});

test("bundle and manifest bytes are preserved exactly, including high bytes", async () => {
	const bundle = Uint8Array.from([0, 127, 128, 255, 10, 13]);
	mockFetch({ bundleBytes: bundle });
	const bundleResponse = await onRequest(context("/stable.json.bundle").ctx);
	assert.deepEqual(new Uint8Array(await bundleResponse.arrayBuffer()), bundle);
	assert.equal(bundleResponse.headers.get("content-type"), "application/octet-stream");

	const manifest = new TextEncoder().encode(" {\n  \"z\": \"é\"\n}\n");
	mockFetch({ manifestBytes: manifest });
	const manifestResponse = await onRequest(context("/stable.json").ctx);
	assert.deepEqual(new Uint8Array(await manifestResponse.arrayBuffer()), manifest);
	assert.equal(manifestResponse.headers.get("content-type"), "application/json; charset=utf-8");
});

test("legacy-json is restricted to stable/nightly JSON and bundle is an explicit 404", async () => {
	for (const channel of ["stable", "nightly"] as const) {
		const tag = tags[channel];
		const kvText = pointerDocument({ [channel]: { tag, mode: "legacy-json" } });
		const calls = mockFetch({ tag, channel, releaseValue: release(tag, channel, { pair: false }) });
		assert.equal((await onRequest(context(`/${channel}.json`, { kvText }).ctx)).status, 200);
		assert.equal(calls.length, 2);

		const noFetchCalls = mockFetch({ tag, channel });
		const bundle = await onRequest(context(`/${channel}.json.bundle`, { kvText }).ctx);
		assert.equal(bundle.status, 404);
		assert.equal((await json(bundle)).error, "legacy-bundle-unavailable");
		assert.equal(noFetchCalls.length, 0);
	}
});

test("draft, tag mismatch, malformed API JSON/shape, duplicate assets, and API failures return 502", async () => {
	const cases = [
		{ releaseValue: release(tags.stable, "stable", { draft: true }), code: "github-release-draft" },
		{ releaseValue: release("v9.9.9", "stable"), code: "github-release-tag-mismatch" },
		{ releaseValue: { tag_name: tags.stable, draft: false, assets: "bad" }, code: "github-release-malformed" },
		{ releaseValue: { ...release(tags.stable, "stable"), assets: [
			...release(tags.stable, "stable").assets,
			release(tags.stable, "stable").assets[0],
		] }, code: "github-release-duplicate-asset" },
		{ releaseValue: { ...release(tags.stable, "stable"), assets: [
			{ name: "stable.json", url: "https://example.test/not-github" },
			...release(tags.stable, "stable").assets.slice(1),
		] }, code: "github-release-invalid-asset-url" },
		{ apiStatus: 500, code: "github-release-500" },
		{ throwApi: true, code: "github-release-network" },
	];
	for (const entry of cases) {
		mockFetch(entry);
		const response = await onRequest(context("/stable.json").ctx);
		assert.equal(response.status, 502, entry.code);
		assert.equal((await json(response)).error, entry.code);
	}

	globalThis.fetch = async () => new Response("not json");
	const invalidJson = await onRequest(context("/stable.json").ctx);
	assert.equal(invalidJson.status, 502);
	assert.equal((await json(invalidJson)).error, "github-release-invalid-json");
});

test("malformed KV and asset download failures are closed JSON errors", async () => {
	const malformed = await onRequest(context("/stable.json", { kvText: "{" }).ctx);
	assert.equal(malformed.status, 503);
	assert.equal(malformed.headers.get("content-type"), "application/json; charset=utf-8");

	for (const options of [{ assetStatus: 404 }, { throwAsset: true }]) {
		mockFetch(options);
		const response = await onRequest(context("/stable.json").ctx);
		assert.equal(response.status, 502);
		assert.match(String((await json(response)).error), /^github-asset-/);
		assert.equal(response.headers.get("cache-control"), "no-store");
	}
});

test("GitHub API and asset calls carry optional authentication and required Accept headers", async () => {
	const calls = mockFetch();
	assert.equal((await onRequest(context("/stable.json", { token: "secret" }).ctx)).status, 200);
	assert.equal(new Headers(calls[0].init?.headers).get("authorization"), "Bearer secret");
	assert.equal(new Headers(calls[0].init?.headers).get("accept"), "application/vnd.github+json");
	assert.equal(new Headers(calls[1].init?.headers).get("authorization"), "Bearer secret");
	assert.equal(new Headers(calls[1].init?.headers).get("accept"), "application/octet-stream");
	assert.equal(calls[1].init?.redirect, "follow");
});

test("success headers identify source/tag/channel/generation and HEAD has no body", async () => {
	mockFetch();
	const response = await onRequest(context("/stable.json", { method: "HEAD" }).ctx);
	assert.equal(response.status, 200);
	assert.equal((await response.arrayBuffer()).byteLength, 0);
	assert.equal(response.headers.get("access-control-allow-origin"), "*");
	assert.equal(response.headers.get("x-content-type-options"), "nosniff");
	assert.equal(response.headers.get("x-hal0-source"), `github-release/${tags.stable}`);
	assert.equal(response.headers.get("x-hal0-tag"), tags.stable);
	assert.equal(response.headers.get("x-hal0-channel"), "stable");
	assert.equal(response.headers.get("x-hal0-pointer-generation"), "7");

	const error = await onRequest(context("/stable.json", { method: "HEAD", binding: false }).ctx);
	assert.equal(error.status, 503);
	assert.equal((await error.arrayBuffer()).byteLength, 0);
	assert.equal(error.headers.get("content-type"), "application/json; charset=utf-8");
});

test("recognized machine routes never call next, including query strings and all resolver errors", async () => {
	mockFetch();
	const success = context("/stable.json?cache=no");
	assert.equal((await onRequest(success.ctx)).status, 200);
	assert.equal(success.nextCalls(), 0);

	const failure = context("/stable.json.bundle", { binding: false });
	assert.equal((await onRequest(failure.ctx)).status, 503);
	assert.equal(failure.nextCalls(), 0);
});

test("non-machine release-host routes retain static rewrite and other hosts pass through", async () => {
	const generic = context("/notes.txt");
	const genericResponse = await onRequest(generic.ctx);
	assert.equal(genericResponse.status, 299);
	assert.equal(await genericResponse.text(), "https://releases.hal0.dev/releases/notes.txt");
	assert.equal(generic.nextCalls(), 1);

	const marketing = context("/stable.json", { host: "hal0.dev" });
	assert.equal((await onRequest(marketing.ctx)).status, 299);
	assert.equal(marketing.nextCalls(), 1);
});
