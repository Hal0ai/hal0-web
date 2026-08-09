// scripts/test/chrome-consistency.test.mjs
//
// Guards the "one site, not four" invariant. Requires a fresh
// `npm run build` (skips with a visible message when dist/ is absent —
// CI always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

const pages = {
  marketing: new URL('../../dist/index.html', import.meta.url),
  starlight: new URL('../../dist/blog/index.html', import.meta.url),
};

const built = await access(pages.marketing).then(() => true, () => false);

const hrefs = (fragment) =>
  new Set([...fragment.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));

function siteFooter(html) {
  const m = html.match(/<footer[^>]*data-site-footer[^>]*>[\s\S]*?<\/footer>/);
  assert.ok(m, 'page contains the shared SiteFooter (data-site-footer)');
  return m[0];
}

const footerLinks = nav.footerColumns.flatMap((col) => col.links);
const visibleHeader = nav.header.filter((l) => !l.hidden);
const footerExtras = nav.footerBase.map((l) => l.href);

test('SiteFooter link set identical across surfaces', { skip: !built && 'run npm run build first' }, async () => {
  const marketing = hrefs(siteFooter(await readFile(pages.marketing, 'utf8')));
  const starlight = hrefs(siteFooter(await readFile(pages.starlight, 'utf8')));
  assert.deepEqual([...marketing].sort(), [...starlight].sort(), 'footer href sets must be equal');
  for (const l of [...footerLinks, ...nav.social]) {
    assert.ok(marketing.has(l.href), `footer missing manifest link ${l.href}`);
  }
  for (const href of footerExtras) {
    assert.ok(marketing.has(href), `footer missing expected link ${href}`);
  }
});

test('header manifest links present in the header of both surfaces', { skip: !built && 'run npm run build first' }, async () => {
  const marketingHtml = await readFile(pages.marketing, 'utf8');
  const starlightHtml = await readFile(pages.starlight, 'utf8');
  const marketingHeader = marketingHtml.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  const starlightNav = starlightHtml.match(/<nav[^>]*aria-label="Site"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.ok(marketingHeader, 'marketing page has a <header>');
  assert.ok(starlightNav, 'starlight page has the site docnav');
  // Marketing renders the umbrella entries; the Starlight docnav flattens
  // `sub` lists (StarlightSiteTitle), so assert each surface's actual shape.
  const flattened = visibleHeader.flatMap((l) => l.sub ?? [l]);
  for (const l of visibleHeader) {
    assert.ok(marketingHeader.includes(`href="${l.href}"`), `marketing header missing ${l.href}`);
  }
  for (const l of flattened) {
    assert.ok(starlightNav.includes(`href="${l.href}"`), `starlight docnav missing ${l.href}`);
  }
});

test('SiteFooter renders outside <main> on Starlight pages', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.starlight, 'utf8');
  const mainClose = html.lastIndexOf('</main>');
  const footerStart = html.search(/<footer[^>]*data-site-footer/);
  assert.ok(mainClose !== -1 && footerStart !== -1, 'page has </main> and SiteFooter');
  assert.ok(footerStart > mainClose, 'SiteFooter must come after </main> (contentinfo landmark)');
});

test('hidden nav entries (forum, profiles) never render on either surface', { skip: !built && 'run npm run build first' }, async () => {
  const marketingHtml = await readFile(pages.marketing, 'utf8');
  const starlightHtml = await readFile(pages.starlight, 'utf8');
  for (const html of [marketingHtml, starlightHtml]) {
    assert.ok(!html.includes('forum.hal0.dev'), 'hidden forum link must not render');
    assert.ok(!html.includes('href="/profiles"'), 'hidden profiles link must not render');
  }
});
