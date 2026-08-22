/**
 * GET/POST /api/auth/logout — clears the local hal0.dev session cookie
 * and, when `?forum=1` is set, also round-trips through Discourse's
 * `logout=true` DiscourseConnect flow to end the forum session. The local
 * cookie is cleared unconditionally and first, so even if the forum leg is
 * requested but DISCOURSE_URL/DISCOURSE_CONNECT_SECRET are missing, the
 * user still ends up signed out of hal0.dev.
 */
import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/auth/env';
import { buildSsoRequest } from '../../../lib/auth/discourseConnect';
import { createNonce } from '../../../lib/auth/nonce';
import { sanitizeReturnPath } from '../../../lib/auth/returnPath';
import { SESSION_COOKIE_NAME } from '../../../lib/auth/constants';

export const prerender = false;

const handle: APIRoute = async ({ request, cookies, redirect }) => {
	const url = new URL(request.url);
	const origin = url.origin;
	const returnPath = sanitizeReturnPath(url.searchParams.get('return'), origin);
	const alsoForum = ['1', 'true'].includes(url.searchParams.get('forum') ?? '');

	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });

	if (!alsoForum) {
		return redirect(returnPath, 302);
	}

	let discourseUrl: string;
	let secret: string;
	try {
		discourseUrl = requireEnv('DISCOURSE_URL').replace(/\/+$/, '');
		secret = requireEnv('DISCOURSE_CONNECT_SECRET');
	} catch (err) {
		// Local cookie is already gone — degrade to a local-only sign-out
		// instead of 500ing an otherwise-working logout action.
		console.error('[auth/logout]', err);
		return redirect(returnPath, 302);
	}

	const nonce = createNonce(secret);
	const returnSsoUrl = new URL('/api/auth/callback', origin);
	returnSsoUrl.searchParams.set('return', returnPath);

	const { sso, sig } = buildSsoRequest(
		{ nonce, return_sso_url: returnSsoUrl.toString(), logout: 'true' },
		secret,
	);

	const target = new URL('/session/sso_provider', discourseUrl);
	target.searchParams.set('sso', sso);
	target.searchParams.set('sig', sig);

	return redirect(target.toString(), 302);
};

export const GET = handle;
export const POST = handle;
