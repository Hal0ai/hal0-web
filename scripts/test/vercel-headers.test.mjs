// scripts/test/vercel-headers.test.mjs
//
// Pins scripts/patch-vercel-headers.mjs: vercel.json's `headers` must land
// in .vercel/output/config.json as continue-routes ahead of the filesystem
// handler, idempotently, with sources translated to anchored regexes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { applyHeaderRoutes, headerRoutes, sourceToRouteSrc } from '../patch-vercel-headers.mjs';

const vercelJson = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));

test('sourceToRouteSrc anchors and escapes literal dots only', () => {
	assert.equal(sourceToRouteSrc('/(.*)'), '^/(.*)$');
	assert.equal(sourceToRouteSrc('/install.sh'), '^/install\\.sh$');
	assert.equal(sourceToRouteSrc('/(screenshots|brand)/(.*)'), '^/(screenshots|brand)/(.*)$');
	assert.ok(new RegExp(sourceToRouteSrc('/install.sh')).test('/install.sh'));
	assert.ok(!new RegExp(sourceToRouteSrc('/install.sh')).test('/installXsh'));
});

test('vercel.json carries the headers the installer and crawlers rely on', () => {
	const routes = headerRoutes(vercelJson);
	const bySrc = Object.fromEntries(routes.map((r) => [r.src, r.headers]));
	assert.equal(bySrc['^/(.*)$']['X-Content-Type-Options'], 'nosniff');
	assert.equal(bySrc['^/(.*)$']['Referrer-Policy'], 'strict-origin-when-cross-origin');
	assert.match(bySrc['^/install\\.sh$']['Content-Type'], /^text\/x-shellscript/);
	assert.match(bySrc['^/install\\.sh$']['Cache-Control'], /max-age=300/);
	for (const r of routes) assert.equal(r.continue, true, `${r.src} is a continue-route`);
});

test('applyHeaderRoutes inserts before the filesystem handler and is idempotent', () => {
	const base = {
		version: 3,
		routes: [
			{ src: '^/releases$', headers: { Location: '/changelog' }, status: 301 },
			{ handle: 'filesystem' },
			{ src: '^/api/(.*)$', dest: '_render' },
		],
	};
	const routes = headerRoutes(vercelJson);
	const once = applyHeaderRoutes(base, routes);
	assert.equal(once.added, routes.length);
	const fsIndex = once.routes.findIndex((r) => r.handle === 'filesystem');
	assert.equal(fsIndex, 1 + routes.length, 'header routes sit between redirects and the filesystem handler');
	assert.deepEqual(once.routes[0], base.routes[0], 'redirects stay first');

	const twice = applyHeaderRoutes(once, routes);
	assert.equal(twice.added, 0);
	assert.equal(twice.routes.length, once.routes.length);
});

const config = await readFile(new URL('../../.vercel/output/config.json', import.meta.url), 'utf8')
	.then(JSON.parse)
	.catch(() => null);

test('built config.json contains the header routes', { skip: !config && 'run npm run build first' }, () => {
	for (const r of headerRoutes(vercelJson)) {
		assert.ok(
			config.routes.some((c) => c.src === r.src && c.continue === true && c.headers?.[Object.keys(r.headers)[0]]),
			`config.json has a continue-route for ${r.src}`,
		);
	}
	const fsIndex = config.routes.findIndex((r) => r.handle === 'filesystem');
	const hdrIndex = config.routes.findIndex((r) => r.src === '^/(.*)$' && r.continue === true);
	assert.ok(hdrIndex !== -1 && (fsIndex === -1 || hdrIndex < fsIndex), 'header routes precede the filesystem handler');
});
