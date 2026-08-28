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

test('every header carries the same five entries, forum included', { skip: !built && 'run npm run build first' }, async () => {
  const marketingHtml = await readFile(pages.marketing, 'utf8');
  const starlightHtml = await readFile(pages.starlight, 'utf8');
  // `forum` used to be hidden in nav.json -- a launch switch this test
  // guarded by asserting the header never rendered a forum.hal0.dev link.
  // The unified chrome flipped that switch on purpose: hal0.dev and the
  // forum now carry the SAME five entries, so the assertion inverts. It
  // stays scoped to the header nav, because forum.hal0.dev links appear
  // legitimately elsewhere on these pages (the homepage ForumTopics strip,
  // and the docs hub linking out to topics).
  const marketingHeader = marketingHtml.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  const starlightNav = starlightHtml.match(/<nav[^>]*aria-label="Site"[\s\S]*?<\/nav>/)?.[0] ?? '';
  // Compared as a parsed href SET, not by substring: an `includes()` against
  // a URL matches it anywhere in a longer string (CodeQL's
  // js/incomplete-url-substring-sanitization), and here it would also pass on
  // a header that merely mentioned the forum somewhere other than its nav.
  for (const [where, markup] of [['marketing header', marketingHeader], ['starlight docnav', starlightNav]]) {
    const links = hrefs(markup);
    for (const href of ['/', '/docs/', '/benchmarks/', '/profiles', 'https://forum.hal0.dev']) {
      assert.ok(links.has(href), `${where} missing ${href}`);
    }
  }
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

test('benchmarks carries the same header as every other page', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(pages.benchmarks, 'utf8');
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  const links = hrefs(header);
  assert.ok(links.has('https://forum.hal0.dev'), 'benchmarks header missing the forum link');
  assert.ok(links.has('/docs/'), 'benchmarks header missing /docs/');
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
