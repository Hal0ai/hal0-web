/**
 * Public forum origin for client-facing deep links (the header bell/avatar).
 * Sourced from nav.json's `forum` entry — the same single source of truth
 * SiteHeader.astro's own nav would use — rather than DISCOURSE_URL, since
 * that env var is the server's upstream API host and isn't guaranteed to
 * match the public-facing forum hostname.
 *
 * Deliberately read only from server-side code (API routes): the forum nav
 * entry is still `hidden: true` pre-launch, and chrome-consistency.test.mjs
 * pins that no *static* page may contain the forum hostname yet. Returning
 * it from an on-demand API response is fine — that response is never part
 * of the prerendered HTML the test scans.
 */
import { header } from '../nav';

export function publicForumUrl(): string {
	return header.find((l) => l.label === 'forum')?.href ?? '';
}
