// scripts/test/discourse-connect-sso.test.mjs
//
// Unit tests for the DiscourseConnect (Discourse-as-IdP) sign-in primitives
// under src/lib/auth/**: the SSO request/response HMAC codec, the stateless
// login nonce, the session JWT, and the return-path allowlist. These are
// the pieces where a bug is a security bug (forgeable session, open
// redirect, replay past expiry), so they're pinned directly rather than
// only exercised indirectly through the API routes.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSsoRequest,
  constantTimeEqual,
  resolveAvatarUrl,
  verifyAndParseSsoResponse,
} from '../../src/lib/auth/discourseConnect.ts';
import { createNonce, verifyNonce } from '../../src/lib/auth/nonce.ts';
import { signSession, verifySession } from '../../src/lib/auth/session.ts';
import { sanitizeReturnPath } from '../../src/lib/auth/returnPath.ts';

const SECRET = 'a-shared-discourse-connect-secret';

test('constantTimeEqual', async (t) => {
  await t.test('matches identical strings case-insensitively', () => {
    assert.equal(constantTimeEqual('DEADBEEF', 'deadbeef'), true);
  });
  await t.test('rejects a mismatch', () => {
    assert.equal(constantTimeEqual('deadbeef', 'deadbeee'), false);
  });
  await t.test('rejects different lengths without throwing', () => {
    assert.equal(constantTimeEqual('deadbeef', 'dead'), false);
  });
});

test('buildSsoRequest / verifyAndParseSsoResponse round trip', async (t) => {
  await t.test('signs a payload Discourse-shaped and verifies it back', () => {
    const { sso, sig } = buildSsoRequest(
      { nonce: 'abc123', return_sso_url: 'https://hal0.dev/api/auth/callback' },
      SECRET,
    );
    assert.equal(typeof sso, 'string');
    assert.match(sig, /^[0-9a-f]{64}$/, 'sig is a lowercase hex SHA-256 digest');

    // Simulate Discourse's response payload: same nonce, plus identity
    // fields, signed the same way.
    const responsePayload = buildSsoRequest(
      {
        nonce: 'abc123',
        external_id: '42',
        username: 'alexander',
        name: 'Alexander',
        email: 'alexander@awideweb.com',
        avatar_url: '/user_avatar/forum.hal0.dev/alexander/288/1_2.png',
        admin: 'true',
        moderator: 'false',
        groups: 'staff,beta',
      },
      SECRET,
    );

    const parsed = verifyAndParseSsoResponse(responsePayload.sso, responsePayload.sig, SECRET);
    assert.ok(parsed, 'valid signature parses');
    assert.equal(parsed.nonce, 'abc123');
    assert.equal(parsed.external_id, '42');
    assert.equal(parsed.username, 'alexander');
    assert.equal(parsed.admin, true);
    assert.equal(parsed.moderator, false);
    assert.deepEqual(parsed.groups, ['staff', 'beta']);
    assert.equal(parsed.failed, false);
  });

  await t.test('rejects a payload signed with the wrong secret', () => {
    const { sso, sig } = buildSsoRequest({ nonce: 'n1', username: 'x' }, 'wrong-secret');
    assert.equal(verifyAndParseSsoResponse(sso, sig, SECRET), null);
  });

  await t.test('rejects a tampered sso payload even with the original sig', () => {
    const { sso, sig } = buildSsoRequest({ nonce: 'n1', username: 'alice' }, SECRET);
    const tampered = Buffer.from(
      Buffer.from(sso, 'base64').toString('utf8').replace('alice', 'mallory'),
      'utf8',
    ).toString('base64');
    assert.equal(verifyAndParseSsoResponse(tampered, sig, SECRET), null);
  });

  await t.test('rejects a payload with no nonce field', () => {
    const { sso, sig } = buildSsoRequest({ username: 'alice' }, SECRET);
    assert.equal(verifyAndParseSsoResponse(sso, sig, SECRET), null);
  });

  await t.test('parses failed=true (prompt=none silent-check miss)', () => {
    const { sso, sig } = buildSsoRequest({ nonce: 'n2', failed: 'true' }, SECRET);
    const parsed = verifyAndParseSsoResponse(sso, sig, SECRET);
    assert.ok(parsed);
    assert.equal(parsed.failed, true);
    assert.equal(parsed.username, undefined);
  });
});

test('resolveAvatarUrl', async (t) => {
  await t.test('resolves a root-relative avatar path against the forum origin', () => {
    assert.equal(
      resolveAvatarUrl('/user_avatar/forum.hal0.dev/alexander/288/1_2.png', 'https://forum.hal0.dev'),
      'https://forum.hal0.dev/user_avatar/forum.hal0.dev/alexander/288/1_2.png',
    );
  });
  await t.test('passes through an already-absolute avatar URL', () => {
    assert.equal(
      resolveAvatarUrl('https://cdn.example.com/a.png', 'https://forum.hal0.dev'),
      'https://cdn.example.com/a.png',
    );
  });
  await t.test('returns empty string when there is no avatar_url', () => {
    assert.equal(resolveAvatarUrl(undefined, 'https://forum.hal0.dev'), '');
  });
});

test('nonce: create/verify', async (t) => {
  const NOW = 1_700_000_000_000;

  await t.test('a freshly created nonce verifies immediately', () => {
    const nonce = createNonce(SECRET, NOW);
    assert.equal(verifyNonce(nonce, SECRET, NOW), true);
  });

  await t.test('verifies within the 10 minute window', () => {
    const nonce = createNonce(SECRET, NOW);
    assert.equal(verifyNonce(nonce, SECRET, NOW + 9 * 60 * 1000), true);
  });

  await t.test('rejects once older than 10 minutes', () => {
    const nonce = createNonce(SECRET, NOW);
    assert.equal(verifyNonce(nonce, SECRET, NOW + 11 * 60 * 1000), false);
  });

  await t.test('rejects a nonce signed with a different secret', () => {
    const nonce = createNonce('other-secret', NOW);
    assert.equal(verifyNonce(nonce, SECRET, NOW), false);
  });

  await t.test('rejects a nonce with its timestamp tampered', () => {
    const nonce = createNonce(SECRET, NOW);
    const [, random, sig] = nonce.split('.');
    const tampered = `${NOW + 1}.${random}.${sig}`;
    assert.equal(verifyNonce(tampered, SECRET, NOW), false);
  });

  await t.test('rejects malformed nonces', () => {
    assert.equal(verifyNonce('not-a-nonce', SECRET, NOW), false);
    assert.equal(verifyNonce('', SECRET, NOW), false);
    assert.equal(verifyNonce(null, SECRET, NOW), false);
    assert.equal(verifyNonce('a.b.c.d', SECRET, NOW), false);
  });

  await t.test('tolerates a few seconds of clock skew into the future', () => {
    const nonce = createNonce(SECRET, NOW);
    assert.equal(verifyNonce(nonce, SECRET, NOW - 3000), true);
    assert.equal(verifyNonce(nonce, SECRET, NOW - 10_000), false);
  });
});

test('session JWT: sign/verify', async (t) => {
  const NOW = 1_700_000_000_000;
  const claims = {
    external_id: '42',
    username: 'alexander',
    avatar_url: 'https://forum.hal0.dev/a.png',
    groups: ['staff', 'beta'],
  };

  await t.test('round trips valid claims', () => {
    const token = signSession(claims, SECRET, 3600, NOW);
    const verified = verifySession(token, SECRET, NOW);
    assert.ok(verified);
    assert.equal(verified.external_id, '42');
    assert.equal(verified.username, 'alexander');
    assert.deepEqual(verified.groups, ['staff', 'beta']);
  });

  await t.test('is valid right up to expiry and invalid just after', () => {
    const token = signSession(claims, SECRET, 3600, NOW);
    assert.ok(verifySession(token, SECRET, NOW + 3600 * 1000));
    assert.equal(verifySession(token, SECRET, NOW + 3600 * 1000 + 1000), null);
  });

  await t.test('rejects a token signed with a different secret', () => {
    const token = signSession(claims, 'other-secret', 3600, NOW);
    assert.equal(verifySession(token, SECRET, NOW), null);
  });

  await t.test('rejects a token with a tampered payload', () => {
    const token = signSession(claims, SECRET, 3600, NOW);
    const [header, body, sig] = token.split('.');
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    decoded.username = 'mallory';
    const tamperedBody = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');
    assert.equal(verifySession(`${header}.${tamperedBody}.${sig}`, SECRET, NOW), null);
  });

  await t.test('rejects malformed tokens', () => {
    assert.equal(verifySession('not.a.jwt.at.all', SECRET, NOW), null);
    assert.equal(verifySession('', SECRET, NOW), null);
    assert.equal(verifySession(null, SECRET, NOW), null);
  });
});

test('sanitizeReturnPath', async (t) => {
  const ORIGIN = 'https://hal0.dev';

  await t.test('allows a plain same-origin path', () => {
    assert.equal(sanitizeReturnPath('/forum', ORIGIN), '/forum');
  });

  await t.test('allows a path with query and hash', () => {
    assert.equal(sanitizeReturnPath('/benchmarks?tab=evals#top', ORIGIN), '/benchmarks?tab=evals#top');
  });

  await t.test('falls back to / for a missing return', () => {
    assert.equal(sanitizeReturnPath(null, ORIGIN), '/');
    assert.equal(sanitizeReturnPath(undefined, ORIGIN), '/');
    assert.equal(sanitizeReturnPath('', ORIGIN), '/');
  });

  await t.test('rejects a protocol-relative URL (open redirect via //)', () => {
    assert.equal(sanitizeReturnPath('//evil.example.com', ORIGIN), '/');
  });

  await t.test('rejects a backslash trick browsers normalize to //', () => {
    assert.equal(sanitizeReturnPath('/\\evil.example.com', ORIGIN), '/');
  });

  await t.test('rejects an absolute URL to another origin', () => {
    assert.equal(sanitizeReturnPath('https://evil.example.com/x', ORIGIN), '/');
  });

  await t.test('rejects a path with no leading slash', () => {
    assert.equal(sanitizeReturnPath('evil.example.com', ORIGIN), '/');
  });

  await t.test('rejects embedded CR/LF', () => {
    assert.equal(sanitizeReturnPath('/ok\r\nSet-Cookie: pwned=1', ORIGIN), '/');
  });

  await t.test('honours a custom fallback', () => {
    assert.equal(sanitizeReturnPath('//evil.example.com', ORIGIN, '/docs/'), '/docs/');
  });
});
