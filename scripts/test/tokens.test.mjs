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
