// scripts/test/blog-tablet.test.mjs
//
// Between Starlight's 50rem drawer breakpoint and 1100px the blog puts its
// sidebar (recent posts, tags) behind the menu button, as it does on a phone,
// so a post gets the whole width of a tablet. The rules live in one media
// block at the end of src/styles/site-blog-kb.css.
//
// Two things can rot. The block can lose its `[data-blog]` scope and start
// changing other Starlight pages, and Starlight can change the markup the
// block relies on (the menu button is a sibling before the sidebar pane).
// The markup checks read the built page and skip when dist/ is absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/styles/site-blog-kb.css', import.meta.url), 'utf8');
const MEDIA = '@media (min-width: 50rem) and (max-width: 68.74rem)';

/** The body of the tablet media block, with comments removed. */
function tabletBlock() {
  const start = css.indexOf(MEDIA);
  assert.notEqual(start, -1, `site-blog-kb.css has a "${MEDIA}" block`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      return css.slice(open + 1, i).replace(/\/\*[\s\S]*?\*\//g, '');
    }
  }
  assert.fail('the tablet media block is not closed');
}

/** [selector list, declarations] for each rule in the block. */
function rules(block) {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [
    m[1].split(',').map((s) => s.trim()).filter(Boolean),
    m[2],
  ]);
}

test('the tablet block exists once and stops below 1100px', () => {
  assert.equal(css.split(MEDIA).length - 1, 1, 'one tablet block');
  // 68.74rem is 1099.84px: the sidebar is back at exactly 1100px.
  assert.ok(68.74 * 16 < 1100 && 68.74 * 16 > 1099);
});

test('every rule in the tablet block is scoped to the blog', () => {
  const all = rules(tabletBlock());
  assert.ok(all.length >= 6, 'the block has its rules');
  for (const [selectors] of all) {
    for (const selector of selectors) {
      assert.match(
        selector,
        /^\[data-blog\] |:has\(\[data-blog\]\)$/,
        `"${selector}" must be scoped to [data-blog]`,
      );
    }
  }
});

test('the sidebar hides, the menu button shows, and an open menu reveals the sidebar', () => {
  const all = rules(tabletBlock());
  const declarationsFor = (selector) => {
    const rule = all.find(([selectors]) => selectors.includes(selector));
    assert.ok(rule, `the block has a rule for "${selector}"`);
    return rule[1];
  };
  assert.match(declarationsFor('[data-blog] .sidebar-pane'), /--sl-sidebar-visibility:\s*hidden/);
  assert.match(
    declarationsFor("[data-blog] starlight-menu-button[aria-expanded='true'] ~ .sidebar-pane"),
    /--sl-sidebar-visibility:\s*visible/,
  );
  assert.match(declarationsFor('[data-blog] starlight-menu-button button'), /display:\s*flex/);
  // The header leaves room for the button it now shows.
  assert.match(declarationsFor('[data-blog] header.header'), /--sl-menu-button-size/);
});

const pages = {
  index: new URL('../../dist/client/blog/index.html', import.meta.url),
};
const built = existsSync(pages.index);
const skip = !built && 'run npm run build first';

test('the built blog page has the markup the tablet block relies on', { skip }, () => {
  const html = readFileSync(pages.index, 'utf8');
  assert.match(html, /<div data-blog[^>]*>/, 'the blog index is wrapped in [data-blog]');
  const button = html.indexOf('<starlight-menu-button');
  const pane = html.indexOf('id="starlight__sidebar"');
  assert.ok(button !== -1, 'the page has a menu button');
  assert.ok(pane !== -1, 'the page has a sidebar pane');
  assert.ok(button < pane, 'the menu button comes before the sidebar pane');
  assert.match(html, /<div id="starlight__sidebar" class="[^"]*\bsidebar-pane\b/, 'the pane keeps its class');
  // Both sit inside the same <nav>, so the sibling selector can reach the pane.
  const nav = html.lastIndexOf('<nav', button);
  assert.ok(nav !== -1 && html.indexOf('</nav>', nav) > pane, 'button and pane share a nav');
});
