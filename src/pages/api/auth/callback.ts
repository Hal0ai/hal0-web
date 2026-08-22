/**
 * GET /api/auth/callback — DiscourseConnect return leg.
 *
 * Discourse redirects here with `?sso=<base64>&sig=<hex>&return=<path>`
 * (the `return` param round-trips from what /api/auth/login put into
 * `return_sso_url`). Three outcomes:
 *
 *  1. No `sso`/`sig` at all — this is the tail of a `logout=true` round
 *     trip (Discourse omits both on logout completion). Nothing to verify;
 *     the local cookie was already cleared by /api/auth/logout before it
 *     sent the browser to Discourse, so just land back on `return`.
 *  2. `sso`/`sig` present but invalid, or the embedded nonce doesn't
 *     verify — reject with 401. Never mint a cookie from an unverified
 *     payload.
 *  3. Valid payload, but `failed=true` (a `prompt=none` silent check that
 *     found no live Discourse session) or missing identity fields — no
 *     session to mint, quietly land back on `return`.
 *  4. Valid, successful payload — mint the session cookie and redirect.
 */
import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/auth/env';
import { resolveAvatarUrl, verifyAndParseSsoResponse } from '../../../lib/auth/discourseConnect';
import { verifyNonce } from '../../../lib/auth/nonce';
import { sanitizeReturnPath } from '../../../lib/auth/returnPath';
import { signSession } from '../../../lib/auth/session';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../../../lib/auth/constants';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
	const url = new URL(request.url);
	const origin = url.origin;
	const returnPath = sanitizeReturnPath(url.searchParams.get('return'), origin);

	const sso = url.searchParams.get('sso');
	const sig = url.searchParams.get('sig');

	if (!sso || !sig) {
		// Logout completion (or a bare hit on this route) — nothing to verify.
		return redirect(returnPath, 302);
	}

	let discourseUrl: string;
	let connectSecret: string;
	try {
		discourseUrl = requireEnv('DISCOURSE_URL').replace(/\/+$/, '');
		connectSecret = requireEnv('DISCOURSE_CONNECT_SECRET');
	} catch (err) {
		console.error('[auth/callback]', err);
		return new Response('Server misconfigured', { status: 500 });
	}

	const payload = verifyAndParseSsoResponse(sso, sig, connectSecret);
	if (!payload) {
		return new Response('Invalid SSO signature', { status: 401 });
	}

	if (!verifyNonce(payload.nonce, connectSecret)) {
		return new Response('Invalid or expired nonce', { status: 401 });
	}

	if (payload.failed || !payload.username || !payload.external_id) {
		// prompt=none silent-check miss, or Discourse-side auth failure.
		return redirect(returnPath, 302);
	}

	let sessionSecret: string;
	try {
		sessionSecret = requireEnv('SESSION_JWT_SECRET');
	} catch (err) {
		console.error('[auth/callback]', err);
		return new Response('Server misconfigured', { status: 500 });
	}

	const token = signSession(
		{
			external_id: payload.external_id,
			username: payload.username,
			avatar_url: resolveAvatarUrl(payload.avatar_url, discourseUrl),
			groups: payload.groups,
		},
		sessionSecret,
		SESSION_TTL_SECONDS,
	);

	cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		path: '/',
		maxAge: SESSION_TTL_SECONDS,
	});

	return redirect(returnPath, 302);
};
