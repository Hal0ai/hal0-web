// Cloudflare Pages middleware — explicit release pointers + host rewrite.
//
// Machine release routes never fall through to static files. Their sole source of
// truth is the versioned pointer document in the RELEASE_POINTERS KV binding.

export const RELEASE_POINTER_DOCUMENT_KEY = "release-pointers.v1";
export const RELEASE_POINTER_SCHEMA = "hal0.release-pointers.v1";
const RELEASES_HOST = "releases.hal0.dev";
const GITHUB_RELEASE_BY_TAG =
	"https://api.github.com/repos/Hal0ai/hal0/releases/tags/";
const MACHINE_PATH_RE = /^\/(stable|preview|nightly)\.json(\.bundle)?$/;
const FINAL_TAG_RE = /^v\d+\.\d+\.\d+$/;
const PREVIEW_TAG_RE = /^v\d+\.\d+\.\d+-(?:alpha|beta|rc)\.(?:0|[1-9]\d*)$/;
const NIGHTLY_TAG_RE = /^v\d+\.\d+\.\d+-nightly\.\d{14}$/;

export type ReleaseChannel = "stable" | "preview" | "nightly";
type PointerMode = "paired" | "legacy-json";

interface ReleasePointerRecord {
	tag: string;
	mode: PointerMode;
}

interface ReleasePointerDocument {
	_schema: typeof RELEASE_POINTER_SCHEMA;
	generation: number;
	channels: Partial<Record<ReleaseChannel, ReleasePointerRecord>>;
}

interface KVNamespace {
	get(key: string): Promise<string | null>;
}

interface PagesEnv {
	GITHUB_TOKEN?: string;
	RELEASE_POINTERS?: KVNamespace;
}

export interface PagesFunctionContext {
	request: Request;
	next: (input?: Request) => Promise<Response>;
	env: PagesEnv;
}

type PagesFunction = (context: PagesFunctionContext) => Promise<Response>;

interface GhAsset {
	name: string;
	url: string;
}

interface GhRelease {
	tag_name: string;
	draft: boolean;
	assets: GhAsset[];
}

interface MachineRoute {
	channel: ReleaseChannel;
	assetName: string;
	bundle: boolean;
}

class ResolverError extends Error {
	readonly status: 404 | 502 | 503;
	readonly code: string;

	constructor(status: 404 | 502 | 503, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(object: Record<string, unknown>, expected: string[]): boolean {
	const actual = Object.keys(object).sort();
	return actual.length === expected.length &&
		actual.every((key, index) => key === [...expected].sort()[index]);
}

function tagAllowedForChannel(channel: ReleaseChannel, tag: string): boolean {
	if (channel === "stable") return FINAL_TAG_RE.test(tag);
	if (channel === "preview") return FINAL_TAG_RE.test(tag) || PREVIEW_TAG_RE.test(tag);
	return NIGHTLY_TAG_RE.test(tag);
}

export function parseMachineRoute(pathname: string): MachineRoute | null {
	const match = MACHINE_PATH_RE.exec(pathname);
	if (!match) return null;
	const channel = match[1] as ReleaseChannel;
	return {
		channel,
		assetName: `${channel}.json${match[2] ?? ""}`,
		bundle: Boolean(match[2]),
	};
}

export function parsePointerDocument(text: string): ReleasePointerDocument {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new ResolverError(503, "pointer-invalid-json", "release pointer document is not valid JSON");
	}
	if (!isPlainObject(value) || !hasExactKeys(value, ["_schema", "generation", "channels"])) {
		throw new ResolverError(503, "pointer-invalid-schema", "release pointer document has unexpected fields");
	}
	if (value._schema !== RELEASE_POINTER_SCHEMA) {
		throw new ResolverError(503, "pointer-invalid-schema", "release pointer document schema is unsupported");
	}
	if (!Number.isSafeInteger(value.generation) || (value.generation as number) <= 0) {
		throw new ResolverError(503, "pointer-invalid-generation", "release pointer generation must be a positive integer");
	}
	if (!isPlainObject(value.channels)) {
		throw new ResolverError(503, "pointer-invalid-channels", "release pointer channels must be an object");
	}

	const channels: Partial<Record<ReleaseChannel, ReleasePointerRecord>> = {};
	for (const [channelName, rawRecord] of Object.entries(value.channels)) {
		if (channelName !== "stable" && channelName !== "preview" && channelName !== "nightly") {
			throw new ResolverError(503, "pointer-invalid-channel", `unknown release pointer channel: ${channelName}`);
		}
		if (!isPlainObject(rawRecord) || !hasExactKeys(rawRecord, ["tag", "mode"]) ||
			typeof rawRecord.tag !== "string" ||
			(rawRecord.mode !== "paired" && rawRecord.mode !== "legacy-json")) {
			throw new ResolverError(503, "pointer-invalid-record", `invalid release pointer record: ${channelName}`);
		}
		if (!tagAllowedForChannel(channelName, rawRecord.tag)) {
			throw new ResolverError(503, "pointer-invalid-tag", `tag is invalid for release pointer channel: ${channelName}`);
		}
		if (channelName === "preview" && rawRecord.mode === "legacy-json") {
			throw new ResolverError(503, "pointer-invalid-mode", "preview release pointers must use paired mode");
		}
		channels[channelName] = { tag: rawRecord.tag, mode: rawRecord.mode };
	}

	return {
		_schema: RELEASE_POINTER_SCHEMA,
		generation: value.generation as number,
		channels,
	};
}

function githubHeaders(token: string | undefined, accept: string): HeadersInit {
	const headers: Record<string, string> = {
		Accept: accept,
		"User-Agent": "hal0-releases-resolver",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function fetchResponse(
	url: string,
	init: RequestInit,
	code: string,
	description: string,
): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(url, init);
	} catch {
		throw new ResolverError(502, `${code}-network`, `${description} request failed`);
	}
	if (!response.ok) {
		throw new ResolverError(502, `${code}-${response.status}`, `${description} returned ${response.status}`);
	}
	return response;
}

async function fetchExactRelease(tag: string, token: string | undefined): Promise<GhRelease> {
	const response = await fetchResponse(
		`${GITHUB_RELEASE_BY_TAG}${encodeURIComponent(tag)}`,
		{ headers: githubHeaders(token, "application/vnd.github+json") },
		"github-release",
		"GitHub release API",
	);
	let value: unknown;
	try {
		value = await response.json();
	} catch {
		throw new ResolverError(502, "github-release-invalid-json", "GitHub release API returned invalid JSON");
	}
	if (!isPlainObject(value) || typeof value.tag_name !== "string" ||
		typeof value.draft !== "boolean" || !Array.isArray(value.assets)) {
		throw new ResolverError(502, "github-release-malformed", "GitHub release API response is malformed");
	}
	if (value.tag_name !== tag) {
		throw new ResolverError(502, "github-release-tag-mismatch", "GitHub release API returned a different tag");
	}
	if (value.draft) {
		throw new ResolverError(502, "github-release-draft", "pointed GitHub release is a draft");
	}
	const assets: GhAsset[] = [];
	for (const rawAsset of value.assets) {
		if (!isPlainObject(rawAsset) || typeof rawAsset.name !== "string" || typeof rawAsset.url !== "string") {
			throw new ResolverError(502, "github-release-malformed", "GitHub release asset metadata is malformed");
		}
		assets.push({ name: rawAsset.name, url: rawAsset.url });
	}
	return { tag_name: value.tag_name, draft: value.draft, assets };
}

function isGithubAssetApiUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "api.github.com" &&
			url.port === "" && url.search === "" && url.hash === "" &&
			/^\/repos\/Hal0ai\/hal0\/releases\/assets\/[1-9]\d*$/.test(url.pathname);
	} catch {
		return false;
	}
}

function exactAsset(release: GhRelease, name: string): GhAsset | null {
	const matches = release.assets.filter((asset) => asset.name === name);
	if (matches.length > 1) {
		throw new ResolverError(502, "github-release-duplicate-asset", `GitHub release has duplicate ${name} assets`);
	}
	const asset = matches[0] ?? null;
	if (asset && !isGithubAssetApiUrl(asset.url)) {
		throw new ResolverError(502, "github-release-invalid-asset-url", `GitHub release has an invalid API URL for ${name}`);
	}
	return asset;
}

function machineHeaders(
	route: MachineRoute,
	tag: string,
	generation: number,
): Headers {
	return new Headers({
		"access-control-allow-origin": "*",
		"cache-control": "public, max-age=60, must-revalidate",
		"content-type": route.bundle ? "application/octet-stream" : "application/json; charset=utf-8",
		"x-content-type-options": "nosniff",
		"x-hal0-channel": route.channel,
		"x-hal0-pointer-generation": String(generation),
		"x-hal0-source": `github-release/${tag}`,
		"x-hal0-tag": tag,
	});
}

async function resolveMachineRoute(
	route: MachineRoute,
	document: ReleasePointerDocument,
	token: string | undefined,
	method: "GET" | "HEAD",
): Promise<Response> {
	const pointer = document.channels[route.channel];
	if (!pointer) {
		throw new ResolverError(404, "channel-not-configured", `release channel is not configured: ${route.channel}`);
	}
	if (pointer.mode === "legacy-json" && route.bundle) {
		throw new ResolverError(404, "legacy-bundle-unavailable", `legacy release channel has no signed bundle: ${route.channel}`);
	}

	const release = await fetchExactRelease(pointer.tag, token);
	const manifestName = `${route.channel}.json`;
	const manifest = exactAsset(release, manifestName);
	let requested: GhAsset | null;
	if (pointer.mode === "paired") {
		const bundle = exactAsset(release, `${manifestName}.bundle`);
		if (!manifest || !bundle) {
			throw new ResolverError(502, "github-release-incomplete-pair", `pointed GitHub release lacks the ${route.channel} asset pair`);
		}
		requested = route.bundle ? bundle : manifest;
	} else {
		if (!manifest) {
			throw new ResolverError(502, "github-release-missing-manifest", `pointed GitHub release lacks ${manifestName}`);
		}
		requested = manifest;
	}

	const assetResponse = await fetchResponse(
		requested.url,
		{
			headers: githubHeaders(token, "application/octet-stream"),
			redirect: "follow",
		},
		"github-asset",
		"GitHub release asset",
	);
	let bytes: ArrayBuffer;
	try {
		bytes = await assetResponse.arrayBuffer();
	} catch {
		throw new ResolverError(502, "github-asset-body", "GitHub release asset body could not be read");
	}
	return new Response(method === "HEAD" ? null : bytes, {
		status: 200,
		headers: machineHeaders(route, pointer.tag, document.generation),
	});
}

function errorResponse(
	error: ResolverError,
	route: MachineRoute,
	method: string,
): Response {
	const body = JSON.stringify({
		error: error.code,
		message: error.message,
		channel: route.channel,
	});
	return new Response(method === "HEAD" ? null : body, {
		status: error.status,
		headers: {
			"access-control-allow-origin": "*",
			"cache-control": "no-store",
			"content-type": "application/json; charset=utf-8",
			"x-content-type-options": "nosniff",
		},
	});
}

function methodNotAllowed(route: MachineRoute): Response {
	return Response.json(
		{ error: "method-not-allowed", channel: route.channel },
		{
			status: 405,
			headers: {
				Allow: "GET, HEAD",
				"access-control-allow-origin": "*",
				"cache-control": "no-store",
				"x-content-type-options": "nosniff",
			},
		},
	);
}

async function readPointerDocument(env: PagesEnv): Promise<ReleasePointerDocument> {
	if (!env.RELEASE_POINTERS) {
		throw new ResolverError(503, "pointer-binding-unavailable", "RELEASE_POINTERS binding is unavailable");
	}
	let text: string | null;
	try {
		text = await env.RELEASE_POINTERS.get(RELEASE_POINTER_DOCUMENT_KEY);
	} catch {
		throw new ResolverError(503, "pointer-read-failed", "release pointer document could not be read");
	}
	if (text === null) {
		throw new ResolverError(503, "pointer-document-unavailable", "release pointer document is unavailable");
	}
	return parsePointerDocument(text);
}

export const onRequest: PagesFunction = async (context) => {
	const url = new URL(context.request.url);

	if (url.hostname === RELEASES_HOST) {
		const route = parseMachineRoute(url.pathname);
		if (route) {
			if (context.request.method !== "GET" && context.request.method !== "HEAD") {
				return methodNotAllowed(route);
			}
			try {
				const document = await readPointerDocument(context.env);
				return await resolveMachineRoute(
					route,
					document,
					context.env.GITHUB_TOKEN,
					context.request.method,
				);
			} catch (error) {
				if (error instanceof ResolverError) {
					return errorResponse(error, route, context.request.method);
				}
				return errorResponse(
					new ResolverError(502, "resolver-failed", "release resolver failed"),
					route,
					context.request.method,
				);
			}
		}

		// Preserve generic release-host static routing for non-machine paths.
		if (!url.pathname.startsWith("/releases/")) {
			const rewritten = new URL(context.request.url);
			rewritten.pathname = `/releases${url.pathname}`;
			return context.next(new Request(rewritten.toString(), context.request));
		}
	}

	return context.next();
};
