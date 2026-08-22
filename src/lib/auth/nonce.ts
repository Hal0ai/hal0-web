/**
 * Stateless, self-verifying nonce for the DiscourseConnect login round
 * trip. No server-side store: the nonce carries its own timestamp and an
 * HMAC over `timestamp.random`, so `verifyNonce` can confirm it was minted
 * by us and hasn't expired without looking anything up. This trades strict
 * single-use replay protection (which would need a store) for a stateless
 * serverless deployment — a replayed nonce within the age window just
 * re-authenticates the same Discourse-signed identity, which the user could
 * always do again via a fresh login anyway.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DEFAULT_NONCE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// Small tolerance for clock skew between the request that minted the nonce
// and the request that verifies it (both run on Vercel's own clock, but
// different invocations/regions can drift by a couple seconds).
const CLOCK_SKEW_TOLERANCE_MS = 5_000;

function hmacHex(data: string, secret: string): string {
	return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

export function createNonce(secret: string, now: number = Date.now()): string {
	const random = randomBytes(16).toString('hex');
	const payload = `${now}.${random}`;
	const sig = hmacHex(payload, secret);
	return `${payload}.${sig}`;
}

export function verifyNonce(
	nonce: string | null | undefined,
	secret: string,
	now: number = Date.now(),
	maxAgeMs: number = DEFAULT_NONCE_MAX_AGE_MS,
): boolean {
	if (!nonce) return false;
	const parts = nonce.split('.');
	if (parts.length !== 3) return false;
	const [tsStr, random, sig] = parts;
	if (!tsStr || !random || !sig) return false;

	const ts = Number(tsStr);
	if (!Number.isFinite(ts)) return false;

	const expected = hmacHex(`${tsStr}.${random}`, secret);
	if (!constantTimeEqualHex(expected, sig)) return false;

	const age = now - ts;
	return age >= -CLOCK_SKEW_TOLERANCE_MS && age <= maxAgeMs;
}
