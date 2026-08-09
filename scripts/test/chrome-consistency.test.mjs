// Guards the "one site, not four" invariant: the footer link set and the
// header manifest links must be identical on a marketing page and a
// Starlight page. Requires a fresh `npm run build` (skips if dist/ absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

const pages = {
  marketing: new URL('../../dist/index.html', import.meta.url),
  starlight: new URL('../../dist/blog/index.html', import.meta.url),
};

const built = await access(pages.marketing).then(() => true, () => false);

function hrefs(html, sectionRe) {
  const section = html.match(sectionRe)?.[0] ?? '';
  return new Set([...section.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
}

test('footer link set identical across surfaces', { skip: !built && 'run npm run build first' }, async () => {
  const marketing = hrefs(await readFile(pages.marketing, 'utf8'), /<footer[\s\S]*?<\/footer>/);
  const starlight = hrefs(await readFile(pages.starlight, 'utf8'), /<footer[\s\S]*<\/footer>/);
  for (const l of [...nav.footer, ...nav.social]) {
    assert.ok(marketing.has(l.href), `marketing footer missing ${l.href}`);
    assert.ok(starlight.has(l.href), `starlight footer missing ${l.href}`);
  }
});

test('header manifest links present on both surfaces', { skip: !built && 'run npm run build first' }, async () => {
  for (const [name, url] of Object.entries(pages)) {
    const html = await readFile(url, 'utf8');
    for (const l of nav.header) {
      assert.ok(html.includes(`href="${l.href}"`), `${name} header missing ${l.href}`);
    }
  }
});
