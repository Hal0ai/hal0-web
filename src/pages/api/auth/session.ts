/**
 * GET /api/auth/session — the client island's "am I signed in" check.
 * 200 + identity JSON when the session cookie is present and verifies,
 * 401 otherwise. Never throws on a missing/garbled cookie — that's just
 * "signed out".
 */
import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/auth/env';
import { verifySession } from '../../../lib/auth/session';
import { SESSION_COOKIE_NAME } from '../../../lib/auth/constants';
import { publicForumUrl } from '../../../lib/auth/forumOrigin';

export const prerender = false;

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
	});
}

export const GET: APIRoute = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!token) {
		return json({ signedIn: false }, 401);
	}

	let secret: string;
	try {
		secret = requireEnv('SESSION_JWT_SECRET');
	} catch (err) {
		console.error('[auth/session]', err);
		return json({ signedIn: false, error: 'server misconfigured' }, 500);
	}

	const session = verifySession(token, secret);
	if (!session) {
		return json({ signedIn: false }, 401);
	}

	return json(
		{
			signedIn: true,
			external_id: session.external_id,
			username: session.username,
			avatar_url: session.avatar_url,
			groups: session.groups,
			forum_url: publicForumUrl(),
		},
		200,
	);
};
