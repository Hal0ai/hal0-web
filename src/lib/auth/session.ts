/**
 * Minimal hand-rolled HS256 JWT for the hal0.dev session cookie. Not a
 * general-purpose JWT implementation: the header is a fixed constant (we
 * never parse or trust an incoming `alg`, which sidesteps the classic
 * "alg: none" / algorithm-confusion class of JWT bugs entirely — every
 * token is verified as HMAC-SHA256 against our own secret, full stop) and
 * the payload shape is exactly the DiscourseConnect identity fields the
 * session cookie needs.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SessionClaims {
	external_id: string;
	username: string;
	avatar_url: string;
	groups: string[];
}

export interface SessionPayload extends SessionClaims {
	iat: number;
	exp: number;
}

const HEADER_JSON = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
const HEADER_B64 = Buffer.from(HEADER_JSON, 'utf8').toString('base64url');

function sign(signingInput: string, secret: string): string {
	return createHmac('sha256', secret).update(signingInput, 'utf8').digest('base64url');
}

export function signSession(
	claims: SessionClaims,
	secret: string,
	ttlSeconds: number,
	now: number = Date.now(),
): string {
	const iat = Math.floor(now / 1000);
	const exp = iat + ttlSeconds;
	const payload: SessionPayload = { ...claims, iat, exp };
	const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const signingInput = `${HEADER_B64}.${body}`;
	const sig = sign(signingInput, secret);
	return `${signingInput}.${sig}`;
}

export function verifySession(
	token: string | null | undefined,
	secret: string,
	now: number = Date.now(),
): SessionPayload | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [header, body, sig] = parts;
	if (header !== HEADER_B64) return null;

	const expectedSig = sign(`${header}.${body}`, secret);
	const bufExpected = Buffer.from(expectedSig, 'utf8');
	const bufActual = Buffer.from(sig, 'utf8');
	if (bufExpected.length !== bufActual.length) return null;
	if (!timingSafeEqual(bufExpected, bufActual)) return null;

	let payload: SessionPayload;
	try {
		payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	} catch {
		return null;
	}
	if (typeof payload.exp !== 'number' || Math.floor(now / 1000) > payload.exp) return null;
	if (typeof payload.username !== 'string' || typeof payload.external_id !== 'string') return null;

	return payload;
}
