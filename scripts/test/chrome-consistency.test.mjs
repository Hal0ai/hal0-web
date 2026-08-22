// scripts/test/chrome-consistency.test.mjs
//
// Guards the "one site, not four" invariant. Requires a fresh
// `npm run build` (skips with a visible message when dist/ is absent —
// CI always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

// Astro emits static output under dist/client/ (not dist/ directly) once an
// adapter is configured — see astro.config.mjs's `adapter: vercel()`,
// added for the DiscourseConnect SSO API routes under src/pages/api/**.
const pages = {
  marketing: new URL('../../dist/client/index.html', import.meta.url),
  starlight: new URL('../../dist/client/blog/index.html', import.meta.url),
  benchmarks: new URL('../../dist/client/benchmarks/index.html', import.meta.url),
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
  // ONE flat nav on both renderers since the one-header unification:
  // hub entries (array match, i.e. learn) contribute their sub links,
  // real sections pass through — nav.ts's flatHeader. Both surfaces
  // must carry the complete flattened set; neither may render a hub
  // umbrella as a standalone "learn" label anymore.
  const flattened = visibleHeader.flatMap((l) => (l.sub && Array.isArray(l.match) ? l.sub : [l]));
  const marketingNav = marketingHtml.match(/<nav[^>]*aria-label="Site"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.ok(marketingNav, 'marketing page has the site nav');
  for (const l of flattened) {
    assert.ok(marketingNav.includes(`href="${l.href}"`), `marketing nav missing ${l.href}`);
    assert.ok(starlightNav.includes(`href="${l.href}"`), `starlight docnav missing ${l.href}`);
  }
  for (const l of visibleHeader) {
    if (l.sub && Array.isArray(l.match)) {
      assert.ok(
        !new RegExp(`>\\s*${l.label}\\s*<`).test(marketingNav),
        `hub umbrella "${l.label}" must not render as a nav label`,
      );
    }
  }
});

test('both surfaces expose a search affordance', { skip: !built && 'run npm run build first' }, async () => {
  const marketingHtml = await readFile(pages.marketing, 'utf8');
  const starlightHtml = await readFile(pages.starlight, 'utf8');
  assert.ok(marketingHtml.includes('data-site-search-open'), 'marketing header has the search button');
  assert.ok(marketingHtml.includes('/js/site-search.js'), 'marketing page loads the search palette script');
  assert.ok(starlightHtml.includes('data-open-modal'), 'starlight header has the Pagefind search button');
});

test('SiteFooter renders outside <main> on Starlight pages', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.starlight, 'utf8');
  const mainClose = html.lastIndexOf('</main>');
  const footerStart = html.search(/<footer[^>]*data-site-footer/);
  assert.ok(mainClose !== -1 && footerStart !== -1, 'page has </main> and SiteFooter');
  assert.ok(footerStart > mainClose, 'SiteFooter must come after </main> (contentinfo landmark)');
});

test('hidden forum header entry never renders as a nav link; profiles is now visible in both headers', { skip: !built && 'run npm run build first' }, async () => {
  const marketingHtml = await readFile(pages.marketing, 'utf8');
  const starlightHtml = await readFile(pages.starlight, 'utf8');
  // nav.json's `forum` header entry still carries `hidden: true` — that's
  // the operator's launch switch (this test does not, and must not, flip
  // it). What changed is the blanket "forum.hal0.dev must not appear
  // anywhere on a static page" pin: the homepage's ForumTopics strip
  // (src/components/landing/ForumTopics.astro) legitimately renders
  // forum.hal0.dev links once DISCOURSE_URL is set, and the docs hub /
  // section pages now link straight out to forum.hal0.dev topics too
  // (src/data/docs-redirects.json). So the assertion narrows to what it
  // was actually guarding: the HEADER NAV specifically must still respect
  // nav.json's hidden flag and never render a "forum" link.
  const marketingHeader = marketingHtml.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  const starlightNav = starlightHtml.match(/<nav[^>]*aria-label="Site"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.ok(!marketingHeader.includes('forum.hal0.dev'), 'hidden forum link must not render in the marketing header nav');
  assert.ok(!starlightNav.includes('forum.hal0.dev'), 'hidden forum link must not render in the starlight docnav');
  assert.ok(marketingHeader.includes('href="/profiles"'), 'marketing header missing /profiles');
  assert.ok(starlightNav.includes('href="/profiles"'), 'starlight docnav missing /profiles');
});

test('benchmarks carries the shared SiteFooter with the full manifest link set', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.benchmarks, 'utf8');
  const footer = hrefs(siteFooter(html));
  const marketingFooter = hrefs(siteFooter(await readFile(pages.marketing, 'utf8')));
  assert.deepEqual([...footer].sort(), [...marketingFooter].sort(), 'benchmarks footer href set must match marketing');
});

test('benchmarks carries the shared header with visible manifest links', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.benchmarks, 'utf8');
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.ok(header, 'benchmarks page has a <header>');
  for (const l of visibleHeader) {
    assert.ok(header.includes(`href="${l.href}"`), `benchmarks header missing ${l.href}`);
  }
});

test('benchmarks never renders the hidden forum link in its header', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.benchmarks, 'utf8');
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.ok(!header.includes('forum.hal0.dev'), 'benchmarks header must not render the hidden forum link');
});

test('benchmarks renders a real <title> and meta description', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.benchmarks, 'utf8');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  assert.match(title, /Benchmarks/i, `benchmarks <title> should mention "benchmarks", got "${title}"`);
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  assert.ok(desc.length > 20, 'benchmarks should have a non-trivial meta description');
  assert.ok(
    html.includes('property="og:image" content="https://hal0.dev/og-default.png"'),
    'benchmarks should fall back to the default OG image',
  );
});
