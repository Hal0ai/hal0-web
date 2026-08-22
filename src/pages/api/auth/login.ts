/**
 * GET /api/auth/login — starts the DiscourseConnect provider round trip.
 *
 * Query params:
 *   return  optional same-origin path to land on after sign-in (default `/`)
 *   prompt  optional; `prompt=none` requests a silent check — Discourse
 *           won't show a login page, it'll immediately bounce back with
 *           `failed=true` if the browser isn't already logged in.
 *
 * The `return` path travels inside `return_sso_url`'s own query string,
 * which is itself part of what we HMAC-sign to Discourse — an attacker
 * can't swap it for another destination without forging DISCOURSE_CONNECT_SECRET.
 */
import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/auth/env';
import { buildSsoRequest } from '../../../lib/auth/discourseConnect';
import { createNonce } from '../../../lib/auth/nonce';
import { sanitizeReturnPath } from '../../../lib/auth/returnPath';

export const prerender = false;

export const GET: APIRoute = async ({ request, redirect }) => {
	const url = new URL(request.url);
	const origin = url.origin;
	const returnPath = sanitizeReturnPath(url.searchParams.get('return'), origin);
	const prompt = url.searchParams.get('prompt');

	let discourseUrl: string;
	let secret: string;
	try {
		discourseUrl = requireEnv('DISCOURSE_URL').replace(/\/+$/, '');
		secret = requireEnv('DISCOURSE_CONNECT_SECRET');
	} catch (err) {
		console.error('[auth/login]', err);
		return new Response('Server misconfigured', { status: 500 });
	}

	const nonce = createNonce(secret);
	const returnSsoUrl = new URL('/api/auth/callback', origin);
	returnSsoUrl.searchParams.set('return', returnPath);

	const payloadParams: Record<string, string> = {
		nonce,
		return_sso_url: returnSsoUrl.toString(),
	};
	if (prompt === 'none') payloadParams.prompt = 'none';

	const { sso, sig } = buildSsoRequest(payloadParams, secret);

	const target = new URL('/session/sso_provider', discourseUrl);
	target.searchParams.set('sso', sso);
	target.searchParams.set('sig', sig);

	return redirect(target.toString(), 302);
};
