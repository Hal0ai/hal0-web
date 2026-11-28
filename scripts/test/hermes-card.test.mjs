// scripts/test/hermes-card.test.mjs
//
// The Hermes card (src/components/HermesCard.astro) is a port of the
// dashboard's agent card, which is drawn for a desktop: labels of 8 to 11px
// and a fixed 340 by 520 box. On the site it also has to work on a phone.
// Three things were wrong there and can come back with the next port:
//
//   1. the back was clipped on a 320px screen, where the box is narrower
//      than its content needs (the last skill was cut off);
//   2. most labels were smaller than the site's phone text floor;
//   3. a tap tilted the card, because a tap also sends a mouse move.
//
// These checks read the component source. The measured result (no clipping
// and no text under 11.5px from 320 to 430px, and the same 340 by 520 card
// on a desktop) is in the pull request that added this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../src/components/HermesCard.astro', import.meta.url), 'utf8');
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
const script = src.slice(src.indexOf('<script>'));

const PHONE = '@media (max-width: 640px)';
/** Labels may go down to this on a phone; sentences to 12px (see src/styles/site-blog-kb.css). */
const FLOOR = 11.5;

/** The body of a top-level `@media` block. */
function block(query) {
  const start = css.indexOf(query);
  assert.notEqual(start, -1, `the card has a "${query}" block`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  assert.fail(`the "${query}" block is not closed`);
}

/** Map of selector to its font-size in px, for every rule in `text` that sets one. */
function fontSizes(text) {
  const sizes = new Map();
  for (const [, selectors, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const size = body.match(/(?:^|;)\s*font-size:\s*([\d.]+)px/);
    if (!size) continue;
    for (const selector of selectors.split(',')) sizes.set(selector.trim(), Number(size[1]));
  }
  return sizes;
}

/** The declarations of the first rule whose selector list is exactly `selector`. */
function declarations(text, selector) {
  for (const [, selectors, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((s) => s.trim() === selector)) return body;
  }
  assert.fail(`the card has a "${selector}" rule`);
}

const phone = block(PHONE);
const base = css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

test('every label smaller than the floor is raised on a phone', () => {
  const small = [...fontSizes(base)].filter(([, px]) => px < FLOOR);
  assert.ok(small.length >= 10, 'the port still has its small desktop labels, so this test still bites');
  const raised = fontSizes(phone);
  for (const [selector, px] of small) {
    assert.ok(raised.has(selector), `${selector} is ${px}px and has no size in the phone block`);
  }
  for (const [selector, px] of raised) {
    assert.ok(px >= FLOOR, `${selector} is ${px}px on a phone, under the ${FLOOR}px floor`);
  }
});

test('the sentences on the back are at least 12px on a phone', () => {
  assert.ok(fontSizes(phone).get('.atk-desc') >= 12);
});

test('the card takes its height from its faces, so the back is never clipped', () => {
  const card = declarations(base, '.hermes-card');
  assert.match(card, /height:\s*fit-content/, 'the card is as tall as its content');
  assert.doesNotMatch(card, /(?:^|;)\s*height:\s*\d/, 'no fixed height on the card');
  assert.match(declarations(base, '.fcard-inner'), /display:\s*grid/);
  const face = declarations(base, '.fc-face');
  assert.match(face, /grid-area:\s*1\s*\/\s*1/, 'both faces share one cell');
  assert.doesNotMatch(face, /position:\s*absolute/, 'a face out of flow gives the card no height');
  assert.match(declarations(base, '.fcard-inner::before'), /aspect-ratio:\s*340\s*\/\s*520/, 'the card keeps its shape when the content is short');
  assert.doesNotMatch(declarations(base, '.fcb-body'), /overflow:\s*hidden/, 'the back does not hide what does not fit');
  assert.doesNotMatch(css, /@media \(max-width: 420px\)/, 'no narrow-screen rule that pins the height to the width again');
});

test('only a mouse tilts the card', () => {
  assert.match(script, /addEventListener\('pointermove'/);
  assert.match(script, /pointerType !== 'mouse'\) return/);
  assert.doesNotMatch(script, /addEventListener\('mousemove'/, 'a tap sends a mouse move too');
});

test('the role line does not break inside a word', () => {
  assert.match(src, /<span class="fc-nb">self-improving<\/span>/);
  assert.match(declarations(base, '.fc-nb'), /white-space:\s*nowrap/);
});
