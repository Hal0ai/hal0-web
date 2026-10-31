// scripts/test/analytics.test.mjs
//
// Pins the Google Analytics wiring in src/lib/analytics.ts and, once a build
// exists, checks that the tag is either on EVERY page or on NONE of them —
// a half-tagged site (marketing pages reporting, blog pages silent) is the
// failure mode the Starlight Head override exists to prevent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

import {
	GA_LINKER_DOMAINS,
	gtagInlineScript,
	gtagScriptSrc,
	resolveMeasurementId,
} from '../../src/lib/analytics.ts';

test('resolveMeasurementId accepts a GA4 ID and normalises case/whitespace', () => {
	assert.equal(resolveMeasurementId('G-ABC123XYZ9'), 'G-ABC123XYZ9');
	assert.equal(resolveMeasurementId('  g-abc123xyz9\n'), 'G-ABC123XYZ9');
});

test('resolveMeasurementId rejects unset, empty, UA- and malformed values', () => {
	for (const bad of [undefined, null, '', '   ', 'UA-12345-1', 'GTM-ABC123', 'G-', 'G-abc', 'G-ABC123"><script>']) {
		assert.equal(resolveMeasurementId(bad), null, `rejects ${JSON.stringify(bad)}`);
	}
});

test('gtag loader URL and inline bootstrap carry the ID and the cross-domain linker', () => {
	const id = 'G-TEST000001';
	assert.equal(gtagScriptSrc(id), `https://www.googletagmanager.com/gtag/js?id=${id}`);
	const inline = gtagInlineScript(id);
	assert.match(inline, /gtag\('config',"G-TEST000001"/);
	for (const host of GA_LINKER_DOMAINS) {
		assert.ok(inline.includes(JSON.stringify(host)), `linker lists ${host}`);
	}
	assert.ok(!inline.includes('</script'), 'inline script never contains a closing script tag');
});

// Build-output check. Astro emits under dist/client/ once an adapter is set
// (see chrome-consistency.test.mjs for the same note).
const pages = {
	landing: new URL('../../dist/client/index.html', import.meta.url),
	blog: new URL('../../dist/client/blog/index.html', import.meta.url),
	changelog: new URL('../../dist/client/changelog/index.html', import.meta.url),
};
const built = await access(pages.landing).then(() => true, () => false);

test('GA tag is present on every surface or on none', { skip: !built && 'run npm run build first' }, async () => {
	const tagged = {};
	for (const [name, url] of Object.entries(pages)) {
		const html = await readFile(url, 'utf8');
		tagged[name] = html.includes('googletagmanager.com/gtag/js?id=');
	}
	const values = new Set(Object.values(tagged));
	assert.equal(values.size, 1, `GA tag must be all-or-nothing across surfaces, got ${JSON.stringify(tagged)}`);

	const expected = resolveMeasurementId(process.env.PUBLIC_GA_MEASUREMENT_ID) !== null;
	assert.equal(tagged.landing, expected, 'tag presence follows PUBLIC_GA_MEASUREMENT_ID at build time');
});

test('/profiles/submitted is noindex and absent from the sitemap', { skip: !built && 'run npm run build first' }, async () => {
	const submitted = await readFile(new URL('../../dist/client/profiles/submitted/index.html', import.meta.url), 'utf8');
	assert.match(submitted, /<meta name="robots" content="noindex[^"]*"/);
	const sitemap = await readFile(new URL('../../dist/client/sitemap-0.xml', import.meta.url), 'utf8');
	assert.ok(!sitemap.includes('/profiles/submitted/'), 'thank-you page is not a sitemap entry');
	assert.ok(sitemap.includes('https://hal0.dev/profiles/'), 'real pages are still listed');
});

test('Starlight pages carry an absolute og:image', { skip: !built && 'run npm run build first' }, async () => {
	const blog = await readFile(pages.blog, 'utf8');
	const m = blog.match(/<meta property="og:image" content="([^"]+)"/);
	assert.ok(m, 'blog index has og:image');
	assert.match(m[1], /^https:\/\/hal0\.dev\//, 'og:image is absolute (social crawlers ignore relative paths)');
});
