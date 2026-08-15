// scripts/test/releases-proxy.test.mjs
//
// Pins the `releases.hal0.dev` channel allowlist in functions/_middleware.ts.
//
// Every channel hal0's ReleasePolicy can target must be proxied here, or the
// documented one-line install for that channel breaks. That is exactly what
// happened to `preview`: hal0 has built, validated, cosign-signed and
// published `preview.json` (plus its sibling `preview.json.bundle`) on every
// rc tag, but this middleware's channel regex never listed `preview`, so
// `https://releases.hal0.dev/preview.json` fell through to the `/releases/`
// static rewrite and returned the site's HTML 404 page — served as
// `content-type: application/json`, so updater clients saw a raw JSON parse
// failure rather than a clean "channel unavailable". See Hal0ai/hal0#1531
// (and #1530 for the stable pointer).
//
// The regex is read out of the middleware source rather than imported: the
// middleware is a Cloudflare Pages Function that runs on the live edge path
// for every `hal0 update`, and it is not worth adding a module boundary to
// it just to make it testable. Extracting the literal still constrains the
// value that actually ships.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MIDDLEWARE = fileURLToPath(new URL('../../functions/_middleware.ts', import.meta.url));

// Channels hal0's release workflow emits a `<channel>.json` release asset
// for. Mirrors ReleasePolicy.manifest_targets in Hal0ai/hal0. Written out
// literally so this test constrains the allowlist instead of restating it.
const POLICY_CHANNELS = ['stable', 'preview', 'nightly'];

async function channelRegex() {
  const source = await readFile(MIDDLEWARE, 'utf8');
  const match = source.match(/^const CHANNEL_RE = (\/.+\/);$/m);
  assert.ok(match, 'functions/_middleware.ts declares `const CHANNEL_RE = /.../;`');
  const [, literal] = match;
  const body = literal.slice(1, literal.lastIndexOf('/'));
  return new RegExp(body);
}

test('every hal0 release-policy channel is proxied', async () => {
  const re = await channelRegex();
  for (const channel of POLICY_CHANNELS) {
    assert.ok(
      re.test(`/${channel}.json`),
      `/${channel}.json must be proxied from GitHub releases, not rewritten to the static HTML 404`,
    );
  }
});

// Proxying the manifest without its detached Sigstore bundle does not make a
// channel installable -- it only moves the failure one step later. Both
// clients fetch the bundle from this same origin and cosign-verify the
// manifest against it with no bypass: installer/bootstrap.sh via
// `release_manifest_bundle_url`, and updater.py in
// `_fetch_verified_release_manifest`. An earlier revision of this file
// asserted the opposite -- that `/preview.json.bundle` must NOT match -- which
// would have frozen half the defect in place as intended behaviour.
test('every channel bundle sibling is proxied too', async () => {
  const re = await channelRegex();
  for (const channel of POLICY_CHANNELS) {
    assert.ok(
      re.test(`/${channel}.json.bundle`),
      `/${channel}.json.bundle must be proxied -- cosign verification of the manifest is mandatory, so a channel whose bundle 404s is still uninstallable`,
    );
  }
});

test('the channel regex does not match arbitrary paths', async () => {
  const re = await channelRegex();
  for (const path of [
    '/preview.json.bundle.sig',
    '/preview.json/',
    '/releases/preview.json',
    '/PREVIEW.json',
    '/preview',
    '/nightly.jsonx',
  ]) {
    assert.equal(re.test(path), false, `${path} must not match CHANNEL_RE`);
  }
});

test('the regex captures the channel name for the proxy lookup', async () => {
  const re = await channelRegex();
  for (const channel of POLICY_CHANNELS) {
    assert.equal(`/${channel}.json`.match(re)?.[1], channel);
    // The bundle path must resolve to the same channel capture, so the proxy
    // annotates it with the same x-hal0-channel header.
    assert.equal(`/${channel}.json.bundle`.match(re)?.[1], channel);
  }
});
