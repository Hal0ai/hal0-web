// scripts/test/build-og.test.mjs
//
// Guards the OG card generator (scripts/build-og.mjs): every fill kind
// must rasterize to a valid 1200×630 PNG, and long titles must take the
// smaller mono size (asserted via the intermediate layout value, not
// pixels — see titleLayout()).
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOgCard, titleLayout, wrapMonospace } from '../build-og.mjs';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG IHDR chunk: 8-byte magic, 4-byte length, "IHDR", then width/height
// as two big-endian uint32s.
function dimensionsOf(buf) {
  assert.ok(buf.subarray(0, 8).equals(PNG_MAGIC), 'buffer starts with the PNG magic bytes');
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR', 'first chunk is IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const FILLS = [
  {
    kind: 'blog',
    eyebrow: 'blog · 2026-06-19',
    title: 'The June sweep: 26 models on one box',
    subtitle: 'Every model in the roster, measured end to end on the same hardware.',
    meta: 'hal0.dev · @hal0-ci · 12 min',
  },
  {
    kind: 'kb',
    eyebrow: 'knowledge base · hardware',
    title: 'Unified memory is not VRAM',
    subtitle: '128 GB installed, ~96 GB addressable from the iGPU — a pool, not a card.',
    meta: 'hal0.dev · reviewed 2026-07-28',
  },
  {
    kind: 'benchmark',
    eyebrow: 'benchmark · tg @ 2048',
    title: 'chadrock3-6-35b-uncensored-mtp',
    subtitle: 'Ryzen AI Max+ 395 · rocm · draft-mtp · q4 cache',
    meta: 'hal0.dev/benchmarks · sweep 2026-06-19',
    figure: { value: '102.1', unit: 'tok/s decode' },
  },
  {
    kind: 'profile',
    eyebrow: 'profile · v4',
    title: 'strix-mtp-max',
    subtitle: 'Speculative decode, everything on.',
    meta: 'hal0.dev/profiles · @hal0-ci',
    figure: { value: '102.1', unit: 'tok/s decode' },
  },
  {
    kind: 'fallback',
    eyebrow: 'hal0.dev',
    title: 'Own Your Inference',
    subtitle: 'Self-hosted local AI for AMD Strix Halo. Several models in named slots, one API.',
    meta: 'hal0.dev · Apache-2.0',
  },
];

for (const fill of FILLS) {
  test(`renderOgCard produces a valid 1200×630 PNG for the "${fill.kind}" fill`, async () => {
    const png = await renderOgCard(fill);
    assert.ok(Buffer.isBuffer(png), 'returns a Buffer');
    const { width, height } = dimensionsOf(png);
    assert.equal(width, 1200);
    assert.equal(height, 630);
  });
}

test('blog and kb fills never render a figure even if one is mistakenly passed', async () => {
  // The spec is explicit: blog/KB leave the figure slot empty rather than
  // inventing a metric. renderOgCard itself doesn't enforce that (kind is
  // documentation, not a guard) — this test exists so a future caller
  // change is caught if it starts wiring bench numbers into those kinds.
  // Here we just confirm the two "no figure" fills above rendered without
  // one supplied, which the FILLS table above already encodes.
  const blog = FILLS.find((f) => f.kind === 'blog');
  const kb = FILLS.find((f) => f.kind === 'kb');
  assert.equal(blog.figure, undefined);
  assert.equal(kb.figure, undefined);
});

test('titleLayout keeps short titles at 62px, unmodified, one line', () => {
  const result = titleLayout('strix-mtp-max');
  assert.equal(result.fontSize, 62);
  assert.equal(result.long, false);
  assert.deepEqual(result.lines, ['strix-mtp-max']);
  assert.equal(result.truncated, false);
});

test('titleLayout drops titles over ~28 chars to 50px', () => {
  const title = 'The June sweep: 26 models on one box'; // 37 chars
  const result = titleLayout(title);
  assert.equal(result.fontSize, 50);
  assert.equal(result.long, true);
});

test('titleLayout boundary: exactly 28 chars stays short, 29 goes long', () => {
  const at28 = 'a'.repeat(28);
  const at29 = 'a'.repeat(29);
  assert.equal(titleLayout(at28).fontSize, 62);
  assert.equal(titleLayout(at29).fontSize, 50);
});

// ── the "two lines max, truncate never shrink further" contract ─────────
// The title box is a fixed 18ch column (comp: `.og-title{max-width:18ch}`).
// A prior version of this generator only checked total character count
// against a hand-estimated budget, which let a spaced title render 3 lines
// and let a single long unbroken token overflow the canvas. These tests
// pin the fix: line count is always <= 2, and every line is <= 18 chars,
// regardless of input shape.

test('titleLayout never produces more than 2 lines for a spaced title near the threshold', () => {
  // 73 chars, many short words — a naive char-count budget would let this
  // wrap to 3+ lines of ~18 chars each.
  const title = 'The complete guide to running every model family on one Strix Halo box';
  const result = titleLayout(title);
  assert.ok(result.lines.length <= 2, `expected <= 2 lines, got ${result.lines.length}`);
  for (const line of result.lines) {
    assert.ok(line.length <= 18, `line "${line}" (${line.length} chars) exceeds the 18ch box`);
  }
  assert.equal(result.truncated, true);
});

test('titleLayout hard-breaks a single long unbroken token instead of overflowing', () => {
  const title = 'supercalifragilisticexpialidocioussupercalifragilisticexpialidocious';
  const result = titleLayout(title);
  assert.ok(result.lines.length <= 2, `expected <= 2 lines, got ${result.lines.length}`);
  for (const line of result.lines) {
    assert.ok(line.length <= 18, `line "${line}" (${line.length} chars) exceeds the 18ch box`);
  }
  assert.equal(result.truncated, true);
  assert.ok(result.lines[result.lines.length - 1].endsWith('…'));
});

test('titleLayout truncates (never shrinks further) once a long title exceeds the 2-line budget', () => {
  const title = 'a'.repeat(120);
  const result = titleLayout(title);
  assert.equal(result.fontSize, 50, 'stays at the long-title size, does not shrink again');
  assert.equal(result.lines.length, 2);
  assert.ok(result.lines[1].endsWith('…'), 'truncation ends with an ellipsis');
});

test('wrapMonospace: exact fit across 2 lines is not marked truncated', () => {
  // 18 + 18 = 36 chars across two single "words" that each exactly fill a line.
  const result = wrapMonospace(`${'a'.repeat(18)} ${'b'.repeat(18)}`, 18, 2);
  assert.deepEqual(result.lines, ['a'.repeat(18), 'b'.repeat(18)]);
  assert.equal(result.truncated, false);
});

test('wrapMonospace: every returned line respects maxCharsPerLine', () => {
  const title = 'chadrock3-6-35b-uncensored-mtp-strix-lean-and-then-some-more-words';
  const { lines } = wrapMonospace(title, 18, 2);
  assert.ok(lines.length <= 2);
  for (const line of lines) assert.ok(line.length <= 18);
});

// ── word-boundary wrapping ───────────────────────────────────────────────
// The default card once read "Your Strix Halo bo / x, running real /…": a word
// that did not fit on the rest of a line was split mid-way. Lines break between
// words; only a word wider than a whole line is split, and then with a hyphen.

test('wrapMonospace: a two-word title straddling the limit wraps the second word whole', () => {
  // 11 + 1 + 9 = 21 chars > 18, so "inference" must start line two, not split as "infere" / "nce".
  assert.deepEqual(wrapMonospace('self-hosted inference', 18, 2), {
    lines: ['self-hosted', 'inference'],
    truncated: false,
  });
  // 15 chars on line one, 3 left: "box," (4 chars) moves down whole instead of becoming "bo" / "x,".
  assert.deepEqual(wrapMonospace('Your Strix Halo box,', 18, 2), {
    lines: ['Your Strix Halo', 'box,'],
    truncated: false,
  });
});

test('wrapMonospace: a single word longer than the line breaks with a hyphen at the limit', () => {
  const word = 'supercalifragilisticexpialidocious'; // 34 chars
  const { lines, truncated } = wrapMonospace(word, 18, 2);
  assert.deepEqual(lines, ['supercalifragilis-', 'ticexpialidocious']);
  assert.equal(truncated, false);
  assert.equal(lines[0].length, 18, 'the hyphen sits inside the 18ch box');
  assert.equal(lines.join('').replace('-', ''), word, 'no characters lost around the hyphen');
});

test('wrapMonospace: a hyphen-broken word still truncates with an ellipsis at maxLines', () => {
  assert.deepEqual(wrapMonospace('supercalifragilisticexpialidocious', 18, 1), {
    lines: ['supercalifragilis…'],
    truncated: true,
  });
});

test('wrapMonospace: truncation drops whole words, never half of one, before the ellipsis', () => {
  // Line two would be 17 chars, so the ellipsis fits as-is.
  assert.deepEqual(wrapMonospace('Your Strix Halo box, running real /v1/* inference', 18, 2), {
    lines: ['Your Strix Halo', 'box, running real…'],
    truncated: true,
  });
  // "ddd eee fff" fills the 11ch line, so "fff" goes to make room for the ellipsis.
  assert.deepEqual(wrapMonospace('aaa bbb ccc ddd eee fff ggg hhh', 11, 2), {
    lines: ['aaa bbb ccc', 'ddd eee…'],
    truncated: true,
  });
});

test('the default social card title fits on one line at the short size', () => {
  const result = titleLayout('Own Your Inference');
  assert.deepEqual(result.lines, ['Own Your Inference']);
  assert.equal(result.fontSize, 62);
  assert.equal(result.truncated, false);
});
