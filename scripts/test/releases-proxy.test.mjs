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
import { onRequest } from '../../functions/_middleware.ts';

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

// --- release scan depth -----------------------------------------------------
//
// Only a FINAL tag emits `stable.json` (ReleasePolicy.manifest_targets), while
// every rc and every nightly emits `preview.json` / `nightly.json`. So the
// release carrying `stable.json` is steadily pushed down the release list by
// releases that do not carry it, and a scan that reads one fixed-size page
// stops finding it after enough of them — silently, with a 404 on the channel
// every stable user is on. That is not hypothetical: on 2026-08-29
// `https://releases.hal0.dev/stable.json` answered 404 with
// `x-hal0-proxy-failed: no-asset:stable.json:10releases` because v0.9.8, the
// only release that has ever published the asset, had fallen off the first
// page of 10. Publishing `stable.json` on the GA tag fixes that for as long as
// it takes ten further releases to stack on top of it. See Hal0ai/hal0#1530.
//
// These tests drive the real `onRequest` against a stubbed GitHub API, so they
// constrain the behaviour rather than the page-size literal.

const ASSET_BODY = '{"_schema":"hal0.releases.v1","version":"1.0.0","channel":"stable"}';

// One page of the GitHub releases list, newest first. `withAsset` names the
// asset that release publishes, if any.
function release(tag, withAsset) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: !withAsset,
    assets: withAsset
      ? [{ id: 1, name: withAsset, url: `https://api.github.com/asset/${tag}/${withAsset}`, browser_download_url: '' }]
      : [],
  };
}

// A GitHub API stub that paginates like the real one: `?page=N`, newest-first,
// `Link: rel="next"` while more pages remain. Records the pages it served so a
// test can assert the scan is bounded.
function githubStub(pages) {
  const listed = [];
  const fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.hostname === 'api.github.com' && parsed.pathname.endsWith('/releases')) {
      const page = Number(parsed.searchParams.get('page') ?? '1');
      listed.push(page);
      const body = pages[page - 1] ?? [];
      const headers = new Headers({ 'content-type': 'application/json' });
      if (page < pages.length) {
        const next = new URL(parsed);
        next.searchParams.set('page', String(page + 1));
        headers.set('link', `<${next}>; rel="next"`);
      }
      return new Response(JSON.stringify(body), { status: 200, headers });
    }
    if (parsed.pathname.startsWith('/asset/')) {
      return new Response(ASSET_BODY, { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetch, listed };
}

// Drives the middleware exactly as Cloudflare does: a request for the channel
// path on the releases host, and a `next` standing in for the static-file
// fallthrough (which is where a proxy miss lands).
async function getChannel(path, stub) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = stub.fetch;
  try {
    return await onRequest({
      request: new Request(`https://releases.hal0.dev${path}`),
      next: async () => new Response('<!doctype html>not found', { status: 404 }),
      env: {},
    });
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('a channel manifest published outside the first page of releases still resolves', async () => {
  // 12 rc/nightly tags carrying only preview.json, then the one release that
  // published stable.json — the shape the live repo is in today.
  const stub = githubStub([
    Array.from({ length: 10 }, (_, i) => release(`v1.0.0-rc.${12 - i}`, 'preview.json')),
    [...Array.from({ length: 2 }, (_, i) => release(`v1.0.0-rc.${2 - i}`, 'preview.json')), release('v0.9.8', 'stable.json')],
  ]);

  const response = await getChannel('/stable.json', stub);

  assert.equal(response.status, 200, 'stable.json must resolve from a release beyond the first page');
  assert.equal(await response.text(), ASSET_BODY);
  assert.equal(response.headers.get('x-hal0-source'), 'github-release/v0.9.8');
  assert.equal(response.headers.get('x-hal0-channel'), 'stable');
});

test('the release scan is bounded rather than following pagination forever', async () => {
  // A repo with more history than any manifest lookup should read: no page
  // carries the asset, so the scan runs to its own limit and gives up.
  const stub = githubStub(Array.from({ length: 40 }, () => [release('v1.0.0-nightly.x', 'nightly.json')]));

  const response = await getChannel('/stable.json', stub);

  assert.equal(response.status, 404, 'a genuinely absent asset still falls through');
  assert.ok(
    stub.listed.length <= 10,
    `the scan must stop at a page cap, read ${stub.listed.length} pages`,
  );
  assert.match(response.headers.get('x-hal0-proxy-failed') ?? '', /^no-asset:stable\.json:/);
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
