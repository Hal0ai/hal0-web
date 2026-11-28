// The three "how it works" pages: /slots/, /memory/ and /agents/
// (src/pages/slots.astro, memory.astro, agents.astro, framed by
// src/components/how/HowPage.astro, listed in src/data/how-pages.ts).
//
// They sit between the landing page and the docs on the forum. Four things are
// pinned here:
//   1. the wiring: the landing page and the footer link to each one, each
//      links to the other two and to the install step, and all three are
//      indexable;
//   2. the mechanics: one h1, a contents list that matches the sections, docs
//      links that resolve, pictures with alt text;
//   3. the commands: every command a reader can copy is on a list here, beside
//      the hal0 docs page it was copied from at the v1.8.1 tag;
//   4. the limits each page must keep stating while they are true.
// Tests marked skipUnbuilt read dist/ and need `npm run build` first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const exists = (path) => access(new URL(path, root)).then(() => true, () => false);
const source = (path) => readFile(new URL(path, root), 'utf8');

const { HOW_PAGES, HOW_KEYS, HOW_CAPTURE_NOTE } = await import(new URL('src/data/how-pages.ts', root));
const docsRedirects = JSON.parse(await source('src/data/docs-redirects.json'));
const captureSet = JSON.parse(await source('src/data/screenshots.json'));

const builtPathOf = (key) => `dist/client/${key}/index.html`;
const built = (await Promise.all(HOW_KEYS.map((key) => exists(builtPathOf(key))))).every(Boolean);
const skipUnbuilt = { skip: !built && 'run npm run build first' };
const pages = {};
for (const key of HOW_KEYS) {
  const html = built ? await source(builtPathOf(key)) : '';
  pages[key] = { html, main: html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '' };
}

const decode = (text) =>
  text
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * Remove every match, and again until the text stops changing, so that taking one
 * block out cannot leave a new one behind (`<scr<script></script>ipt>`).
 */
function removeAll(text, pattern) {
  let previous;
  do {
    previous = text;
    text = text.replace(pattern, '');
  } while (text !== previous);
  return text;
}

// Style and script blocks, in any letter case, with a closing tag that may carry a space or an attribute.
const NOT_TEXT = [/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi];

/** What a reader can see in a built fragment, as one line of text. */
const visibleText = (fragment) =>
  decode(NOT_TEXT.reduce(removeAll, fragment).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const hrefsOf = (fragment) => [...fragment.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => decode(m[1]));

// ── 1. the wiring ───────────────────────────────────────────────────────────

test('there are three pages, each at a short path of its own', () => {
  assert.deepEqual(HOW_KEYS, ['slots', 'memory', 'agents']);
  for (const key of HOW_KEYS) {
    assert.equal(HOW_PAGES[key].key, key);
    assert.equal(HOW_PAGES[key].href, `/${key}/`);
    assert.ok(HOW_PAGES[key].heading.length > 0 && HOW_PAGES[key].teaser.length > 0);
  }
});

test('each page has a source file and none is a leftover prototype', async () => {
  for (const key of HOW_KEYS) {
    assert.ok(await exists(`src/pages/${key}.astro`), `src/pages/${key}.astro exists`);
    const text = await source(`src/pages/${key}.astro`);
    assert.doesNotMatch(text, /prototype/i, `${key}.astro does not call itself a prototype`);
    assert.doesNotMatch(text, /noindex/, `${key}.astro is indexable`);
  }
  assert.ok(!(await exists('src/pages/prototype')), 'no src/pages/prototype directory');
  assert.ok(!(await exists('src/components/prototype')), 'no src/components/prototype directory');
});

test('the landing page links to all three', skipUnbuilt, async () => {
  const landing = await source('dist/client/index.html');
  const hrefs = hrefsOf(landing.match(/<main[\s\S]*<\/main>/)?.[0] ?? '');
  for (const key of HOW_KEYS) {
    assert.ok(hrefs.includes(HOW_PAGES[key].href), `the landing page links to ${HOW_PAGES[key].href}`);
  }
});

test('each page links to the other two and to the install step', skipUnbuilt, () => {
  for (const key of HOW_KEYS) {
    const next = pages[key].main.match(/<nav class="how-next[^"]*"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const hrefs = hrefsOf(next);
    const others = HOW_KEYS.filter((other) => other !== key).map((other) => HOW_PAGES[other].href);
    assert.deepEqual(hrefs, [...others, '/#start'], `${key}: the "keep going" cards`);
  }
});

test('each page is indexable, with its own canonical URL, and is in the sitemap', skipUnbuilt, async () => {
  const sitemap = await source('dist/client/sitemap-0.xml');
  const titles = new Set();
  for (const key of HOW_KEYS) {
    const { html } = pages[key];
    assert.doesNotMatch(html, /<meta[^>]+name="robots"[^>]+noindex/i, `${key} is not noindex`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://hal0\\.dev/${key}/"`), `${key} has its canonical URL`);
    assert.ok(sitemap.includes(`<loc>https://hal0.dev/${key}/</loc>`), `${key} is in the sitemap`);
    titles.add(html.match(/<title>([^<]*)<\/title>/)?.[1]);
  }
  assert.equal(titles.size, HOW_KEYS.length, 'three different titles');
});

test('the footer has a "how it works" group with the three pages, in the manifest order', async () => {
  const nav = JSON.parse(await source('src/data/nav.json'));
  const group = nav.footerColumns.find((col) => col.heading === 'how it works');
  assert.ok(group, 'nav.json has a "how it works" footer column');
  assert.deepEqual(group.links.map((l) => l.href), HOW_KEYS.map((key) => HOW_PAGES[key].href));
  assert.deepEqual(group.links.map((l) => l.label), HOW_KEYS, 'each link is named after its page');
  assert.ok(group.links.every((l) => !l.hidden && !l.external), 'the links are shown and stay on the site');
});

test('the footer grid has a track for every group in nav.json', async () => {
  // The grid used to say "3". A fourth group then wrapped under the brand.
  const footer = await source('src/components/SiteFooter.astro');
  assert.match(footer, /class="ftr-cols" style=\{`--ftr-n: \$\{footerColumns\.length\}`\}/);
  const css = await source('src/styles/site.css');
  assert.match(css, /grid-template-columns:\s*1\.4fr repeat\(var\(--ftr-n, \d\), minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.ftr-cols\s*\{[^}]*repeat\(\d/, 'no hard-coded column count');
});

test('the footer of a built page links to all three', skipUnbuilt, async () => {
  for (const path of ['dist/client/index.html', builtPathOf('slots')]) {
    const footer = (await source(path)).match(/<footer[^>]*data-site-footer[^>]*>[\s\S]*?<\/footer>/)?.[0] ?? '';
    const hrefs = hrefsOf(footer);
    for (const key of HOW_KEYS) {
      assert.ok(hrefs.includes(HOW_PAGES[key].href), `${path}: the footer links to ${HOW_PAGES[key].href}`);
    }
    assert.match(footer, /style="--ftr-n: ?4;?"/, `${path}: four link groups`);
  }
});

test('llms.txt lists the three pages', async () => {
  const txt = await source('public/llms.txt');
  for (const key of HOW_KEYS) {
    assert.ok(txt.includes(`(https://hal0.dev/${key})`), `llms.txt links /${key}`);
  }
});

// ── 2. the mechanics ────────────────────────────────────────────────────────

test('each page has one h1, the page name from the manifest', skipUnbuilt, () => {
  for (const key of HOW_KEYS) {
    const h1s = [...pages[key].html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(h1s.length, 1, `${key} has one h1`);
    assert.equal(visibleText(h1s[0][1]), HOW_PAGES[key].heading);
  }
});

test('the contents list and the sections are the same list, in the same order', skipUnbuilt, () => {
  for (const key of HOW_KEYS) {
    const { main } = pages[key];
    const toc = main.match(/<aside class="how-toc[^"]*"[\s\S]*?<\/aside>/)?.[0] ?? '';
    const listed = hrefsOf(toc).map((href) => href.replace(/^#/, ''));
    const sections = [...main.matchAll(/<section[^>]*\sclass="how-sec[^"]*"[^>]*>/g)].map((m) => m[0].match(/\sid="([^"]+)"/)?.[1]);
    assert.ok(listed.length >= 6, `${key} lists its sections`);
    assert.deepEqual(listed, sections, `${key}: contents list matches the sections`);
    assert.equal(new Set(sections).size, sections.length, `${key}: section ids are unique`);
    // The pages share a shape: a summary first, then commands, then the docs.
    assert.equal(sections[0], 'short');
    assert.deepEqual(sections.slice(-2), ['try', 'deeper']);
  }
});

test('every docs link has a redirect to the forum, and every page hands over to the docs', skipUnbuilt, () => {
  const known = new Set(Object.keys(docsRedirects).map((path) => path.replace(/\/$/, '')));
  for (const key of HOW_KEYS) {
    const docs = hrefsOf(pages[key].main).filter((href) => href.startsWith('/docs/'));
    assert.ok(docs.length >= 5, `${key} links into the docs (got ${docs.length})`);
    for (const href of docs) {
      assert.ok(href.endsWith('/'), `${key}: ${href} ends with a slash`);
      assert.ok(known.has(href.replace(/\/$/, '')), `${key}: ${href} is in src/data/docs-redirects.json`);
    }
    const deeper = pages[key].main.match(/<section[^>]*\sid="deeper"[\s\S]*?<\/section>/)?.[0] ?? '';
    assert.ok(hrefsOf(deeper).length >= 5, `${key}: the last section is a set of links`);
  }
});

test('every dashboard picture is from the capture set, has alt text, and none is beside a figure', skipUnbuilt, () => {
  const byFile = new Map(captureSet.images.map((image) => [image.file, image]));
  for (const key of HOW_KEYS) {
    const { main } = pages[key];
    const imgs = [...main.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((tag) => /\ssrc="[^"]*\/screenshots\//.test(tag));
    assert.ok(imgs.length >= 2, `${key} shows the dashboard (got ${imgs.length})`);
    for (const tag of imgs) {
      const name = tag.match(/\/screenshots\/([a-z0-9-]+)/)?.[1];
      const alt = decode(tag.match(/\salt="([^"]*)"/)?.[1] ?? '');
      assert.ok(byFile.has(`${name}.png`), `${key}: ${name}.png is in src/data/screenshots.json`);
      assert.ok(alt.length >= 40, `${key}: ${name} has descriptive alt text`);
      // These pages quote no speeds, so a capture with sample gauges has no place here.
      assert.equal(byFile.get(`${name}.png`).figures, 'none', `${key}: ${name}.png carries no readings`);
    }
    assert.ok(visibleText(main).includes(HOW_CAPTURE_NOTE), `${key} says the pictures show sample data`);
  }
});

// ── 3. the commands ─────────────────────────────────────────────────────────

// Every command a reader can copy, and the hal0 docs page (at the v1.8.1 tag)
// it was copied from. A new command needs a line here with its source.
const COMMANDS = {
  slots: {
    'hal0 model pull qwen3.5-9b': 'docs/getting-started/beginners-guide.mdx',
    'hal0 slot load agent --model qwen3.5-9b': 'docs/getting-started/beginners-guide.mdx',
    'hal0 slot list': 'docs/getting-started/beginners-guide.mdx',
    'hal0 chat': 'docs/getting-started/beginners-guide.mdx',
  },
  memory: {
    'hal0 memory status': 'docs/getting-started/beginners-guide.mdx',
    'hal0 memory bank list': 'docs/getting-started/beginners-guide.mdx',
    'hal0 memory recall "a question"': 'docs/getting-started/beginners-guide.mdx',
  },
  agents: {
    'hal0 bridge add my-laptop': 'docs/getting-started/beginners-guide.mdx',
    'hal0 bridge revoke my-laptop': 'docs/getting-started/beginners-guide.mdx',
    'hal0 agent list': 'docs/getting-started/beginners-guide.mdx',
    'sudo hal0 agent install pi': 'docs/getting-started/beginners-guide.mdx',
  },
};

test('every command on a page is on the list of commands copied from the docs', skipUnbuilt, () => {
  for (const key of HOW_KEYS) {
    const { main } = pages[key];
    const rows = [...main.matchAll(/<div class="how-cmd[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1]);
    const shown = rows.map((row) => visibleText(row.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1] ?? ''));
    const copied = rows.map((row) => decode(row.match(/\sdata-copy="([^"]*)"/)?.[1] ?? row.match(/\sdata-copy='([^']*)'/)?.[1] ?? ''));
    assert.deepEqual(shown, copied, `${key}: the copy button copies what the row shows`);
    assert.deepEqual([...shown].sort(), Object.keys(COMMANDS[key]).sort(), `${key}: the commands on the page`);
  }
});

test('a command named in running text is one hal0 documents', skipUnbuilt, () => {
  // `hal0 doctor all` is in docs/getting-started/beginners-guide.mdx (stage 5, "Common stumble").
  const ALSO_NAMED = new Set(['hal0 doctor all']);
  const all = new Set([...Object.values(COMMANDS).flatMap((set) => Object.keys(set)), ...ALSO_NAMED]);
  for (const key of HOW_KEYS) {
    const inline = [...pages[key].main.matchAll(/<code[^>]*>([^<]*)<\/code>/g)].map((m) => decode(m[1]).trim());
    for (const text of inline.filter((value) => /^(sudo )?hal0 /.test(value))) {
      assert.ok(all.has(text), `${key}: "${text}" is on the list`);
    }
  }
});

// ── 4. the limits ───────────────────────────────────────────────────────────

test('no page claims more than the product does', skipUnbuilt, () => {
  const FORBIDDEN = [/\bunleash/i, /\bseamless/i, /\brevolutionary/i, /\bsupercharge/i, /\binstantly/i, /\bsandbox/i, /never leak/i, /\bfull MCP support\b/i, /—/];
  for (const key of HOW_KEYS) {
    const text = visibleText(pages[key].main);
    for (const term of FORBIDDEN) assert.doesNotMatch(text, term, `${key} uses ${term}`);
    // No speeds and no release numbers: the first has no current source, the second goes stale.
    assert.doesNotMatch(text, /\btok(ens)?\/s\b/i, `${key} quotes no speed`);
    assert.doesNotMatch(text, /\bv?\d+\.\d+\.\d+\b/, `${key} names no release`);
  }
});

test('slots: only one seeded slot starts with a model, and swapping is not instant', skipUnbuilt, () => {
  const { main } = pages.slots;
  const seeded = main.match(/<ul class="seeded[^"]*"[\s\S]*?<\/ul>/)?.[0] ?? '';
  const items = [...seeded.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.equal(items.length, 10, 'ten seeded slots');
  const filled = items.filter((item) => /class="[^"]*\bfilled\b/.test(item));
  assert.equal(filled.length, 1, 'one of them has a model');
  assert.match(filled[0], /<code[^>]*>brain<\/code>/, 'and it is brain');
  const text = visibleText(main);
  assert.match(text, /The reload is a real restart, so it is not instant/);
  assert.match(text, /If a model will not fit in the memory that is left, the load is refused/);
});

test('slots: says that making an image pauses the chat models on the graphics chip', skipUnbuilt, () => {
  const images = pages.slots.main.match(/<section[^>]*\sid="images"[\s\S]*?<\/section>/)?.[0] ?? '';
  const text = visibleText(images);
  assert.match(text, /the chat models on that chip step aside/);
  assert.match(text, /about ten seconds after the last image/);
});

test('memory: says it needs a chat model, starts empty, and can lose writes while the engine is down', skipUnbuilt, () => {
  const text = visibleText(pages.memory.main);
  assert.match(text, /Memory needs a chat model to do its reading/);
  assert.match(text, /an empty memory on day one is normal/);
  assert.match(text, /Anything saved in that gap is not kept/);
  assert.match(text, /switched off until you turn it on/, 'the chat app filter is opt-in');
});

test('agents: says approvals are not a wall, and links the security notes beside it', skipUnbuilt, () => {
  const approvals = pages.agents.main.match(/<section[^>]*\sid="approvals"[\s\S]*?<\/section>/)?.[0] ?? '';
  const text = visibleText(approvals);
  assert.match(text, /Approvals raise the bar\. They are not a wall\./);
  assert.match(text, /The agent runs with the same access as hal0 itself/);
  assert.match(text, /terminal tool[^.]*is off unless you switch it on/);
  assert.ok(hrefsOf(approvals).includes('/docs/concepts/security/'), 'links the security notes');
});

test('agents: says the built-in agents cannot call a tool server you installed yourself', skipUnbuilt, () => {
  const tools = pages.agents.main.match(/<section[^>]*\sid="tools"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(visibleText(tools), /the built-in agents cannot call a server you installed yourself/);
});

test('agents: Pi is described as off until you add it', skipUnbuilt, () => {
  const text = visibleText(pages.agents.main);
  assert.match(text, /off until you add it/);
  assert.match(text, /Pi is not installed unless you ask for it/);
});

// ── the shared stylesheet ───────────────────────────────────────────────────

/** A selector list split at its top-level commas, so `:is(h1, h2)` stays whole. */
function splitSelectors(list) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

test('the stylesheet collapses every multi-column grid on a narrow screen', async () => {
  const css = await source('src/styles/site-how.css');
  const narrow = css.slice(css.indexOf('@media (max-width: 1000px)'));
  for (const selector of ['.how-hero-grid', '.how-split', '.how-body', '.how-cards', '.how-deeper', '.how-next-grid']) {
    assert.ok(narrow.includes(selector), `${selector} is in the narrow-screen block`);
  }
  assert.match(css, /@media \(max-width: 640px\)/, 'has the phone text floor');
  assert.match(css, /@media \(pointer: coarse\)/, 'has touch tap areas');
  // The element resets carry no class weight, or they flatten the margins of
  // every single-class rule in the sheet (.how-k, .how-lede, .how-cards).
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bare, /(^|[\s,}])\.how (p|ul|ol|code)\b/, 'no `.how p` style reset; use :where(.how)');
  assert.doesNotMatch(bare, /\.how-sec > p\b/, 'the running-text rule is `:where(.how-sec) > p`');
  // Every rule is namespaced, so the sheet cannot restyle another page.
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{/g, '')
    .split('}')
    .map((rule) => rule.split('{')[0].trim())
    .filter(Boolean)
    .flatMap(splitSelectors);
  for (const selector of selectors) {
    assert.match(selector, /^(:where\()?\.how\b|^(:where\()?\.how-/, `"${selector}" is namespaced under .how`);
  }
});
