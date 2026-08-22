/**
 * GET /api/forum/notifications — server-side proxy for the header bell's
 * unread pip. Requires a valid hal0.dev session; fetches
 * `{DISCOURSE_URL}/notifications.json?username=<session username>` with
 * the admin API key/username from env (never sent to the client) and
 * returns only `{ unread_count }`.
 *
 * Cached 90s per username in a module-scope Map. This is best-effort: a
 * Vercel serverless function instance can be reused across requests (warm),
 * in which case the cache hits, or cold-started, in which case it's empty
 * and we fetch fresh — either way is correct, just not guaranteed-cached.
 */
import type { APIRoute } from 'astro';
import { requireEnv } from '../../../lib/auth/env';
import { verifySession } from '../../../lib/auth/session';
import { SESSION_COOKIE_NAME } from '../../../lib/auth/constants';

export const prerender = false;

const CACHE_TTL_MS = 90_000;

interface CacheEntry {
	unreadCount: number;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface DiscourseNotification {
	read?: boolean;
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', ...extraHeaders },
	});
}

export const GET: APIRoute = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!token) {
		return json({ error: 'not signed in' }, 401);
	}

	let sessionSecret: string;
	try {
		sessionSecret = requireEnv('SESSION_JWT_SECRET');
	} catch (err) {
		console.error('[forum/notifications]', err);
		return json({ error: 'server misconfigured' }, 500);
	}

	const session = verifySession(token, sessionSecret);
	if (!session) {
		return json({ error: 'not signed in' }, 401);
	}

	const username = session.username;
	const now = Date.now();
	const cached = cache.get(username);
	if (cached && cached.expiresAt > now) {
		return json({ unread_count: cached.unreadCount }, 200, { 'x-cache': 'hit' });
	}

	let discourseUrl: string;
	let apiKey: string;
	let apiUsername: string;
	try {
		discourseUrl = requireEnv('DISCOURSE_URL').replace(/\/+$/, '');
		apiKey = requireEnv('DISCOURSE_ADMIN_API_KEY');
		apiUsername = requireEnv('DISCOURSE_ADMIN_API_USERNAME');
	} catch (err) {
		console.error('[forum/notifications]', err);
		return json({ error: 'server misconfigured' }, 500);
	}

	const target = new URL('/notifications.json', discourseUrl);
	target.searchParams.set('username', username);

	try {
		const resp = await fetch(target.toString(), {
			headers: {
				'Api-Key': apiKey,
				'Api-Username': apiUsername,
				Accept: 'application/json',
			},
		});

		if (!resp.ok) throw new Error(`Discourse responded ${resp.status}`);

		const data = (await resp.json()) as { notifications?: DiscourseNotification[] };
		const notifications = Array.isArray(data.notifications) ? data.notifications : [];
		const unreadCount = notifications.filter((n) => n && n.read === false).length;

		cache.set(username, { unreadCount, expiresAt: now + CACHE_TTL_MS });
		return json({ unread_count: unreadCount }, 200, { 'x-cache': 'miss' });
	} catch (err) {
		console.error('[forum/notifications]', err);
		// Serve the last-known count on an upstream hiccup rather than
		// flashing the bell to zero; only 502 if we have nothing at all.
		if (cached) {
			return json({ unread_count: cached.unreadCount }, 200, { 'x-cache': 'stale' });
		}
		return json({ error: 'forum unreachable' }, 502);
	}
};
