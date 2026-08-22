/**
 * Origin-locks a `?return=` path so the SSO login/logout/callback routes
 * can never be used as an open redirect. Only a same-origin, single-leading-
 * slash relative path is accepted; anything else (protocol-relative `//`,
 * backslash tricks browsers normalize to `//`, absolute URLs to another
 * host, or embedded CR/LF for header-injection attempts) falls back to the
 * given default.
 */
export function sanitizeReturnPath(
	input: string | null | undefined,
	requestOrigin: string,
	fallback = '/',
): string {
	if (!input) return fallback;
	if (!input.startsWith('/') || input.startsWith('//') || input.startsWith('/\\')) return fallback;
	if (/[\r\n]/.test(input)) return fallback;

	let parsed: URL;
	try {
		parsed = new URL(input, requestOrigin);
	} catch {
		return fallback;
	}
	if (parsed.origin !== requestOrigin) return fallback;

	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
