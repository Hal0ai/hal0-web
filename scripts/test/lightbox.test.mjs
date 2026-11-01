// The screenshot lightbox: public/js/lightbox.js + the .hal0-lightbox styles.
//
//   1. source contract: what the script and the stylesheet must keep offering
//      (gallery navigation, the mirrored <picture>, swipe, the caption bar)
//   2. behaviour, in a real browser: runs only when HAL0_LIGHTBOX_URL points at
//      a served build (the Playwright container; host Chromium cannot start
//      on the devops box), e.g.
//        HAL0_LIGHTBOX_URL=http://127.0.0.1:4322/ node --test scripts/test/lightbox.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const source = (path) => readFile(new URL(path, root), 'utf8');
const script = await source('public/js/lightbox.js');
const css = await source('src/styles/global.css');

test('the lightbox binds every /screenshots/ image and survives view transitions', () => {
  assert.match(script, /img\[src\*="\/screenshots\/"\]/);
  assert.match(script, /astro:page-load/);
  assert.match(script, /document\.body\.contains\(overlay\)/, 'rebuilds after a body swap');
});

test('the overlay offers previous and next, by button, arrow key and swipe', () => {
  assert.match(script, /'Previous screenshot'/);
  assert.match(script, /'Next screenshot'/);
  assert.match(script, /e\.key === 'ArrowLeft'/);
  assert.match(script, /e\.key === 'ArrowRight'/);
  assert.match(script, /e\.key === 'Escape'/);
  assert.match(script, /'pointerdown'/);
  assert.match(script, /'pointerup'/);
  assert.match(script, /SWIPE_PX = \d+/);
  assert.match(script, /\(i \+ items\.length\) % items\.length/, 'navigation wraps around');
});

test('the overlay mirrors the figure picture and shows its caption and a counter', () => {
  assert.match(script, /img\.closest\('picture'\)/);
  assert.match(script, /s\.cloneNode\(true\)/, 'AVIF/WebP sources are copied, so the @2x capture serves retina');
  assert.match(script, /getAttribute\('srcset'\)/);
  assert.match(script, /figure\.querySelector\('figcaption'\)/);
  assert.match(script, /`\$\{index \+ 1\} \/ \$\{items\.length\}`/);
  assert.match(script, /dataset\.single = /, 'a lone screenshot hides the side buttons');
  assert.match(script, /new Image\(\)/, 'neighbours are preloaded');
});

test('the stylesheet lays out the stage, the side buttons and the caption bar', () => {
  assert.match(css, /\.hal0-lightbox-stage\s*\{/);
  assert.match(css, /\.hal0-lightbox-nav\s*\{/);
  assert.match(css, /\.hal0-lightbox-cap\s*\{/);
  assert.match(css, /\.hal0-lightbox\[data-single='true'\] \.hal0-lightbox-nav\s*\{\s*display:\s*none/);
  assert.match(css, /\.hal0-lightbox\s*\{[^}]*touch-action:\s*pan-y/, 'horizontal swipes reach the script');
  assert.match(css, /\.hal0-lightbox img\s*\{[^}]*max-height:\s*calc\(100dvh - [\d.]+rem\)/, 'the picture takes the viewport height');
  assert.match(css, /prefers-reduced-motion: reduce/);
});

// ---------------------------------------------------------------------------
// 2. behaviour in a browser, against a served build.

const url = process.env.HAL0_LIGHTBOX_URL;
const skipBrowser = { skip: !url && 'set HAL0_LIGHTBOX_URL to a served build' };

test('clicking a console shot opens the overlay; arrows, buttons and swipe move through the set', skipBrowser, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    const shots = page.locator('figure.shot img[src*="/screenshots/"]');
    const total = await shots.count();
    assert.ok(total >= 3, `the page has ${total} screenshots`);

    const overlay = page.locator('.hal0-lightbox');
    const state = async () => ({
      open: await overlay.getAttribute('data-open'),
      src: await overlay.locator('img').getAttribute('src'),
      count: await overlay.locator('.hal0-lightbox-count').textContent(),
      text: await overlay.locator('.hal0-lightbox-text').textContent(),
      sources: await overlay.locator('source').count(),
    });

    await shots.nth(1).scrollIntoViewIfNeeded();
    await shots.nth(1).click();
    let s = await state();
    assert.equal(s.open, 'true', 'open after a click');
    assert.equal(s.src, await shots.nth(1).getAttribute('src'), 'shows the clicked shot');
    assert.equal(s.count, `2 / ${total}`);
    assert.ok(s.text.length > 0, 'caption shown');
    assert.ok(s.sources >= 1, 'picture sources mirrored');
    // The overlay image renders larger than the figure it came from.
    const figBox = await shots.nth(1).boundingBox();
    const bigBox = await overlay.locator('img').boundingBox();
    assert.ok(bigBox.width > figBox.width * 1.5, `overlay ${bigBox.width}px wide vs figure ${figBox.width}px`);

    await page.keyboard.press('ArrowRight');
    s = await state();
    assert.equal(s.src, await shots.nth(2).getAttribute('src'), 'ArrowRight steps forward');
    assert.equal(s.count, `3 / ${total}`);

    await overlay.locator('.hal0-lightbox-prev').click();
    await overlay.locator('.hal0-lightbox-prev').click();
    s = await state();
    assert.equal(s.src, await shots.nth(0).getAttribute('src'), 'the previous button steps back');
    assert.equal(s.open, 'true', 'a button click does not close the box');

    await page.keyboard.press('ArrowLeft');
    s = await state();
    assert.equal(s.count, `${total} / ${total}`, 'stepping back from the first wraps to the last');

    // A touch swipe to the left goes forward (and wraps to the first).
    const box = await overlay.boundingBox();
    const y = box.y + box.height * 0.8;
    await page.touchscreen.tap(box.x + box.width * 0.5, y).catch(() => {});
    await overlay.dispatchEvent('pointerdown', { clientX: 700, clientY: y, pointerType: 'touch' });
    await overlay.dispatchEvent('pointerup', { clientX: 600, clientY: y + 5, pointerType: 'touch' });
    s = await state();
    assert.equal(s.count, `1 / ${total}`, 'a left swipe steps forward and wraps');
    assert.equal(s.open, 'true');

    await page.keyboard.press('Escape');
    assert.equal((await state()).open, 'false', 'Escape closes');

    // The backdrop closes; the picture does not.
    await shots.nth(0).click();
    await overlay.locator('img').click();
    assert.equal((await state()).open, 'true', 'clicking the picture keeps it open');
    await page.mouse.click(box.x + 60, box.y + box.height - 20);
    assert.equal((await state()).open, 'false', 'clicking the backdrop closes');
  } finally {
    await browser.close();
  }
});
