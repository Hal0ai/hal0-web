/**
 * DiscourseConnect ("Discourse as an identity provider") request/response
 * codec — see https://meta.discourse.org/t/use-discourse-as-an-identity-provider-sso-discourseconnect/32974
 *
 * Request: build `nonce=...&return_sso_url=...[&prompt=none|&logout=true]`,
 * base64-encode it, and HMAC-SHA256-sign the base64 string (hex digest)
 * with the shared `discourse connect provider secrets` value. Discourse
 * redirects the browser to `/session/sso_provider?sso=<base64>&sig=<hex>`.
 *
 * Response: Discourse redirects back to `return_sso_url` with `sso`
 * (base64) and `sig` (hex) query params carrying the signed identity
 * payload — external_id, username, name, email, avatar_url, admin,
 * moderator, groups (comma-separated) — or `failed=true` if `prompt=none`
 * was set and the browser wasn't already logged in to Discourse. A
 * `logout=true` request instead redirects back with neither `sso` nor
 * `sig` once the Discourse session has been cleared.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface DiscourseConnectPayload {
	nonce: string;
	external_id?: string;
	username?: string;
	name?: string;
	email?: string;
	avatar_url?: string;
	admin: boolean;
	moderator: boolean;
	groups: string[];
	failed: boolean;
}

function hmacHex(data: string, secret: string): string {
	return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex/ASCII strings (case-insensitive). */
export function constantTimeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a.toLowerCase(), 'utf8');
	const bufB = Buffer.from(b.toLowerCase(), 'utf8');
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

/**
 * Builds the `sso`/`sig` pair for an outbound request to Discourse's
 * `/session/sso_provider` endpoint. `params` becomes the raw
 * `key=value&key=value` payload before base64 encoding — the caller
 * decides which keys go in (nonce, return_sso_url, and optionally
 * `prompt: 'none'` or `logout: 'true'`).
 */
export function buildSsoRequest(
	params: Record<string, string>,
	secret: string,
): { sso: string; sig: string } {
	const query = new URLSearchParams(params).toString();
	const sso = Buffer.from(query, 'utf8').toString('base64');
	const sig = hmacHex(sso, secret);
	return { sso, sig };
}

/**
 * Verifies the `sig` over the raw `sso` payload string and, only if valid,
 * base64-decodes and parses it. Returns null on any signature mismatch or
 * malformed payload (including a missing `nonce`, which every DiscourseConnect
 * response — success or `failed=true` — carries).
 */
export function verifyAndParseSsoResponse(
	sso: string,
	sig: string,
	secret: string,
): DiscourseConnectPayload | null {
	if (!sso || !sig) return null;

	const expectedSig = hmacHex(sso, secret);
	if (!constantTimeEqual(expectedSig, sig)) return null;

	let decoded: string;
	try {
		decoded = Buffer.from(sso, 'base64').toString('utf8');
	} catch {
		return null;
	}

	const parsed = new URLSearchParams(decoded);
	const nonce = parsed.get('nonce');
	if (!nonce) return null;

	const groupsRaw = parsed.get('groups');

	return {
		nonce,
		external_id: parsed.get('external_id') ?? undefined,
		username: parsed.get('username') ?? undefined,
		name: parsed.get('name') ?? undefined,
		email: parsed.get('email') ?? undefined,
		avatar_url: parsed.get('avatar_url') ?? undefined,
		admin: parsed.get('admin') === 'true',
		moderator: parsed.get('moderator') === 'true',
		groups: groupsRaw ? groupsRaw.split(',').filter(Boolean) : [],
		failed: parsed.get('failed') === 'true',
	};
}

/**
 * Resolves a DiscourseConnect `avatar_url` (which Discourse may return as a
 * root-relative path, e.g. `/user_avatar/forum.hal0.dev/name/288/1_2.png`)
 * against the forum origin, so the value we store is always a fully
 * qualified URL the browser can load from hal0.dev.
 */
export function resolveAvatarUrl(avatarUrl: string | undefined, discourseUrl: string): string {
	if (!avatarUrl) return '';
	try {
		return new URL(avatarUrl, discourseUrl).toString();
	} catch {
		return '';
	}
}
