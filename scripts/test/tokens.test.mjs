import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (rel) => readFile(new URL(`../../src/${rel}`, import.meta.url), 'utf8');

const tokensCss = await read('styles/tokens.css');
const siteCss = await read('styles/site.css');

// tokens.css has no nested braces, so a flat `{ ... }` capture is enough.
const rootBlock = tokensCss.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
const lightBlock = tokensCss.match(/\[data-theme='light'\]\s*\{([^}]*)\}/)?.[1] ?? '';

// Whitespace-insensitive compare: `rgba(0, 0, 0, 0.28)` equals
// `rgba(0,0,0,0.28)`, but `0 6px` stays two tokens.
const squash = (v) => v.trim().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ');

/** Value of `--name` declared in a block, or null. */
function decl(block, name) {
  const re = new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`);
  const m = block.match(re);
  return m ? squash(m[1]) : null;
}

test('tokens.css has a :root and a [data-theme=light] block', () => {
  assert.ok(rootBlock.length > 0, ':root block found');
  assert.ok(lightBlock.length > 0, "[data-theme='light'] block found");
});

// ── B1: add-only tokens ───────────────────────────────────────────────

const NEW_ROOT = {
  '--hal0-accent-bg': '#2a1d00',
  '--hal0-rad-xs': '3px',
  '--hal0-dur': '0.18s',
  '--hal0-dur-slow': '0.22s',
  '--hal0-shadow-hover': '0 6px 20px rgba(0,0,0,0.28)',
  '--hal0-ok-glow': 'rgba(111,207,151,0.35)',
  '--hal0-warn-glow': 'rgba(232,185,78,0.35)',
};

const NEW_LIGHT = {
  '--hal0-accent-bg': '#fdf3d7',
  '--hal0-shadow-hover': '0 6px 20px rgba(0,0,0,0.10)',
};

for (const [name, value] of Object.entries(NEW_ROOT)) {
  test(`:root declares ${name}`, () => {
    assert.equal(decl(rootBlock, name), squash(value));
  });
}

for (const [name, value] of Object.entries(NEW_LIGHT)) {
  test(`[data-theme=light] overrides ${name}`, () => {
    assert.equal(decl(lightBlock, name), squash(value));
  });
}

// The forum theme copies tokens.css verbatim, so existing values are frozen.
// These are the values on master when the redesign started.
const FROZEN_ROOT = {
  '--hal0-accent': '#ffb000',
  '--hal0-bg': '#0a0a0a',
  '--hal0-bg-elevated': '#141414',
  '--hal0-fg': '#f5f5f4',
  '--hal0-fg-dim': '#a3a09c',
  '--hal0-border': '#262626',
  '--hal0-rad': '6px',
  '--hal0-rad-sm': '4px',
  '--hal0-rad-lg': '10px',
  '--hal0-ok': '#6fcf97',
  '--hal0-warn': '#e8b94e',
  '--hal0-err': '#ef6b6b',
};

// Light overrides for the frozen tokens that have one.
const FROZEN_LIGHT = {
  '--hal0-accent': '#b87800',
  '--hal0-bg': '#fafaf9',
  '--hal0-bg-elevated': '#ffffff',
  '--hal0-fg': '#1c1917',
  '--hal0-fg-dim': '#6b6660',
  '--hal0-border': '#e7e5e4',
  '--hal0-ok': '#1a7f37',
  '--hal0-warn': '#8a5a00',
  '--hal0-err': '#cf222e',
};

for (const [name, value] of Object.entries(FROZEN_ROOT)) {
  test(`existing token ${name} keeps its :root value`, () => {
    assert.equal(decl(rootBlock, name), squash(value));
  });
}

for (const [name, value] of Object.entries(FROZEN_LIGHT)) {
  test(`existing token ${name} keeps its light value`, () => {
    assert.equal(decl(lightBlock, name), squash(value));
  });
}

test('site.css .site alias block maps the new tokens', () => {
  const aliasBlock = siteCss.match(/^\.site\s*\{([^}]*)\}/m)?.[1] ?? '';
  const aliases = {
    '--accent-bg': 'var(--hal0-accent-bg)',
    '--rad-xs': 'var(--hal0-rad-xs)',
    '--dur': 'var(--hal0-dur)',
    '--dur-slow': 'var(--hal0-dur-slow)',
    '--shadow-hover': 'var(--hal0-shadow-hover)',
  };
  for (const [name, value] of Object.entries(aliases)) {
    assert.equal(decl(aliasBlock, name), squash(value), `${name} -> ${value}`);
  }
});

// ── B2: shared interactive-card recipe ────────────────────────────────

const siteDataCss = await read('styles/site-data.css');

// Landing components that own a card-like link surface. ForumTopics is
// deliberately absent from CARD_COMPONENTS: its `.topic` rows live inside one
// overflow-hidden list panel, where a lift + shadow would clip and misalign.
const CARD_COMPONENTS = ['FeaturedProfiles', 'BenchHighlights', 'LatestWriting'];
const LANDING_COMPONENTS = [...CARD_COMPONENTS, 'ForumTopics'];
const landing = Object.fromEntries(
  await Promise.all(
    LANDING_COMPONENTS.map(async (name) => [name, await read(`components/landing/${name}.astro`)]),
  ),
);

/** Body of the first `.card-hover { ... }` / `.card-hover:hover { ... }` rule. */
function ruleBody(css, selector) {
  const escaped = selector.replace(/[.:()]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

test('site-data.css defines the .card-hover recipe', () => {
  assert.ok(siteDataCss.includes('.card-hover'), '.card-hover present');
  assert.ok(siteDataCss.includes('translateY(-1px)'), 'hover lifts by 1px');
});

test('.card-hover transitions border, transform and shadow at .15s', () => {
  const base = squash(ruleBody(siteDataCss, '.card-hover'));
  assert.match(
    base,
    /transition: border-color \.15s ease,transform \.15s ease,box-shadow \.15s ease;/,
    'base rule carries the three-property transition',
  );
});

test('.card-hover:hover uses line-strong, the 1px lift and --shadow-hover', () => {
  const hover = squash(ruleBody(siteDataCss, '.card-hover:hover'));
  assert.ok(hover.includes('border-color: var(--line-strong)'), 'border-color');
  assert.ok(hover.includes('transform: translateY(-1px)'), 'transform');
  assert.ok(hover.includes('box-shadow: var(--shadow-hover)'), 'box-shadow');
});

test('.card-hover removes the lift under prefers-reduced-motion', () => {
  const reduced = siteDataCss.match(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.card-hover:hover\s*\{([^}]*)\}/,
  );
  assert.ok(reduced, 'reduced-motion block targets .card-hover:hover');
  assert.ok(squash(reduced[1]).includes('transform: none'), 'transform: none');
});

for (const name of LANDING_COMPONENTS) {
  test(`${name} has no translateY(-2px) and no literal #6fcf97`, () => {
    assert.ok(!landing[name].includes('translateY(-2px)'), 'no 2px lift');
    assert.ok(!landing[name].includes('#6fcf97'), 'no literal ok green; use var(--ok)');
  });

  test(`${name} amber chips do not fill with accent-glow`, () => {
    assert.ok(!landing[name].includes('accent-glow'), 'accent-soft + accent-line only');
  });
}

for (const name of CARD_COMPONENTS) {
  test(`${name} cards opt into card-hover`, () => {
    assert.match(landing[name], /class:list=\{\[[^\]]*'card-hover'/, "class:list includes 'card-hover'");
  });

  test(`${name} no longer keeps its own border-color hover rule`, () => {
    // The shared recipe owns the hover border; a component-level
    // `:hover { border-color: ... }` would fork it.
    assert.ok(
      !/:hover\s*\{[^}]*border-color/.test(landing[name]),
      'no component-local :hover border-color',
    );
  });
}
