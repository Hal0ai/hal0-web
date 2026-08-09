// scripts/test/primitives.test.mjs
//
// Guards the shared data-surface primitive layer (Task 1): `.btn` family,
// `.chip` + status/device variants, `.dot` states, and the previously-inert
// `.dtable`/`.fpill`/`.well`/`.panel`/`.fbar` surfaces from site-data.css
// must all be loaded site-wide via the compiled CSS bundle. Follows
// chrome-consistency.test.mjs's build strategy: requires a fresh
// `npm run build` (skips with a visible message when dist/ is absent — CI
// always builds first, see .github/workflows/ci.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';

const distAstro = new URL('../../dist/_astro/', import.meta.url);
const indexHtml = new URL('../../dist/index.html', import.meta.url);

const built = await access(indexHtml).then(() => true, () => false);

async function bundledCss() {
  const entries = await readdir(distAstro).catch(() => []);
  const cssFiles = entries.filter((f) => f.endsWith('.css'));
  const chunks = await Promise.all(
    cssFiles.map((f) => readFile(new URL(f, distAstro), 'utf8'))
  );
  return chunks.join('\n');
}

// The production build runs source CSS nesting (`.site { .dtable { ... } }`)
// through Lightning CSS's minifier, which is free to keep the nested form
// as a literal `&` combinator (`.site{& .dtable{...}}`) instead of
// expanding it to the descendant-combinator form (`.site .dtable`) — both
// are equivalent CSS, so scoped selectors are matched with a pattern that
// accepts either minifier output.
function hasScopedSelector(css, scope, cls) {
  return css.includes(`${scope} ${cls}`) || css.includes(`& ${cls}`);
}

test('shared primitive selectors are present in the compiled CSS bundle', { skip: !built && 'run npm run build first' }, async () => {
  const css = await bundledCss();

  const scoped = ['.dtable', '.fpill', '.well', '.panel', '.fbar'];
  for (const cls of scoped) {
    assert.ok(
      hasScopedSelector(css, '.site', cls),
      `compiled CSS bundle missing selector .site ${cls} (nested or expanded) — site-data.css must be imported`
    );
  }

  const bare = [
    '.chip.dev-rocm',
    '.chip.dev-vulkan',
    '.chip.dev-npu',
    '.chip.dev-cpu',
    '.chip.amber',
    '.chip.ok',
    '.chip.warn',
    '.chip.err',
    '.chip.info',
    '.btn.ghost',
    '.btn.sm',
    '.btn.lg',
    '.dot.ready',
    '.dot.serving',
    '.dot.warming',
    '.dot.error',
    '.dot.offline',
  ];

  for (const selector of bare) {
    assert.ok(
      css.includes(selector),
      `compiled CSS bundle missing selector ${selector} — site-data.css must be imported and site.css must define .btn/.chip/.dot`
    );
  }
});

test('index.astro buttons still render with resolvable .btn classes (regression)', { skip: !built && 'run npm run build first' }, async () => {
  const html = await readFile(indexHtml, 'utf8');
  assert.match(html, /class="[^"]*\bbtn\b[^"]*"/, 'homepage renders at least one element with the .btn class');
});
