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
  assert.match(script, /function reconcile\(\)[\s\S]*?style\.overflow = ''/, 'a swap while open gives the scroll back');
  assert.match(script, /overlay\.inert = true/, 'closed, the dialog is inert');
  assert.match(script, /overlay\.inert = false/, 'open, it is not');
});

test('the overlay offers previous and next, by picture half, arrow key, swipe and (for the keyboard) button', () => {
  assert.match(script, /'Previous screenshot'/);
  assert.match(script, /'Next screenshot'/);
  assert.match(script, /'hal0-lightbox-half hal0-lightbox-half-prev'/, 'the left half of the picture');
  assert.match(script, /'hal0-lightbox-half hal0-lightbox-half-next'/, 'the right half of the picture');
  assert.match(script, /halfPrev\.contains\(target\)\) return tap\(halfPrev, -1\)/, 'a click on the left half steps back');
  assert.match(script, /halfNext\.contains\(target\)\) return tap\(halfNext, 1\)/, 'a click on the right half steps forward');
  assert.match(script, /matchMedia\('\(hover: hover\)'\)/, 'without hover, a tap flashes the edge instead');
  assert.match(script, /classList\.add\('is-flash'\)/);
  assert.match(script, /e\.key === 'ArrowLeft'/);
  assert.match(script, /e\.key === 'ArrowRight'/);
  assert.match(script, /e\.key === 'Escape'/);
  assert.match(script, /'pointerdown'/);
  assert.match(script, /'pointermove'/);
  assert.match(script, /'pointerup', endSwipe/);
  assert.match(script, /'pointercancel', endSwipe/, 'a cancelled pointer stream still counts as a swipe');
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

test('the stylesheet lays out the stage, the edge hint, the keyboard buttons and the caption bar', () => {
  assert.match(css, /\.hal0-lightbox-stage\s*\{/);
  assert.match(css, /\.hal0-lightbox-nav\s*\{/);
  assert.match(css, /\.hal0-lightbox-cap\s*\{/);
  assert.match(css, /\.hal0-lightbox-pic\s*\{[^}]*overflow:\s*hidden[^}]*border-radius/, 'the frame clips the edge line to its rounded corners');
  assert.match(css, /\.hal0-lightbox-half\s*\{[^}]*width:\s*50%/, 'each half covers its side of the picture');
  assert.match(css, /\.hal0-lightbox-half::before\s*\{[^}]*width:\s*2px[^}]*background:\s*var\(--hal0-accent/, 'a 2px accent line along the edge');
  assert.match(css, /\.hal0-lightbox-half::before\s*\{[^}]*box-shadow:[^;]*var\(--hal0-accent/, 'with a glow');
  assert.match(css, /@media \(hover: hover\)\s*\{\s*\.hal0-lightbox-half:hover::before\s*\{\s*opacity:\s*1/, 'lit while the pointer is over that half');
  assert.match(css, /\.hal0-lightbox-half\.is-flash::before\s*\{\s*opacity:\s*1/, 'or briefly after a tap');
  assert.match(css, /\.hal0-lightbox\[data-single='true'\] \.hal0-lightbox-half\s*\{\s*display:\s*none/, 'a lone screenshot has no halves');
  assert.match(css, /\.hal0-lightbox-nav\s*\{[^}]*clip-path:\s*inset\(50%\)/, 'the side buttons have no pointer target');
  assert.match(css, /\.hal0-lightbox-nav:focus-visible\s*\{[^}]*clip-path:\s*none/, 'but show once focused from the keyboard');
  assert.match(css, /\.hal0-lightbox\[data-single='true'\] \.hal0-lightbox-nav\s*\{\s*display:\s*none/);
  assert.match(css, /\.hal0-lightbox\s*\{[^}]*touch-action:\s*pan-y/, 'horizontal swipes reach the script');
  assert.match(css, /\.hal0-lightbox-stage\s*\{[^}]*touch-action:\s*pan-y/, 'the scrolling stage does not claim horizontal drags');
  assert.match(css, /\.hal0-lightbox-stage\s*\{[^}]*max-height:\s*100%[^}]*overflow-y:\s*auto/, 'a long caption on a short viewport scrolls inside the stage');
  assert.match(css, /\.hal0-lightbox-close,\s*\.hal0-lightbox-nav\s*\{[^}]*position:\s*absolute/, 'the buttons sit on the overlay, outside the scrolling stage');
  assert.match(css, /\.hal0-lightbox\s*\{[^}]*visibility:\s*hidden/, 'closed, it is hidden once faded');
  assert.match(css, /\.hal0-lightbox-stage\s*\{[^}]*margin:\s*auto/, 'the stage centres itself without overflowing');
  assert.match(css, /\.hal0-lightbox img\s*\{[^}]*max-height:\s*calc\(100dvh - [\d.]+rem\)/, 'the picture takes the viewport height');
  assert.match(css, /prefers-reduced-motion: reduce/);
});

// ---------------------------------------------------------------------------
// 2. behaviour in a browser, against a served build.

const url = process.env.HAL0_LIGHTBOX_URL;
const skipBrowser = { skip: !url && 'set HAL0_LIGHTBOX_URL to a served build' };

/** A real touch swipe (Chromium's input pipeline, so touch-action and the click that may follow apply). */
async function swipe(page, { fromX, toX, y }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('clicking a console shot opens the overlay; halves, arrows and the keyboard buttons move through the set', skipBrowser, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    // A desktop page: with touch emulation on, Chromium reports (hover: none) and the edge hint would not light.
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    const shots = page.locator('figure.shot img[src*="/screenshots/"]');
    const total = await shots.count();
    assert.ok(total >= 4, `the page has ${total} screenshots`);

    const overlay = page.locator('.hal0-lightbox');
    const state = async () => ({
      open: await overlay.getAttribute('data-open'),
      inert: (await overlay.getAttribute('inert')) !== null,
      src: await overlay.locator('img').getAttribute('src'),
      count: await overlay.locator('.hal0-lightbox-count').textContent(),
      text: await overlay.locator('.hal0-lightbox-text').textContent(),
      sources: await overlay.locator('source').count(),
    });

    await shots.nth(1).scrollIntoViewIfNeeded();
    await shots.nth(1).click();
    let s = await state();
    assert.equal(s.open, 'true', 'open after a click');
    assert.equal(s.inert, false, 'open, the dialog is not inert');
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

    // The pointer steps through the picture's halves: the edge under it lights up, a click steps.
    const half = (side) => overlay.locator(`.hal0-lightbox-half-${side}`);
    const edge = (side) => half(side).evaluate((h) => getComputedStyle(h, '::before').opacity);
    await half('next').hover();
    await page.waitForTimeout(200); // the 120ms fade
    assert.equal(await edge('next'), '1', 'hovering the right half lights its edge');
    assert.equal(await edge('prev'), '0', 'the other edge stays dark');
    await half('next').click();
    s = await state();
    assert.equal(s.count, `4 / ${total}`, 'clicking the right half steps forward');
    assert.equal(s.open, 'true', 'and keeps the box open');
    await half('prev').hover();
    await page.waitForTimeout(200);
    assert.equal(await edge('prev'), '1', 'hovering the left half lights its edge');
    assert.equal(await edge('next'), '0');
    await half('prev').click();
    s = await state();
    assert.equal(s.count, `3 / ${total}`, 'clicking the left half steps back');

    // Tab cycles the dialog's own buttons and never leaves it.
    const inDialog = () => page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.hal0-lightbox')));
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await inDialog(), true, `Tab ${i + 1} stays in the dialog`);
    }
    await page.keyboard.press('Shift+Tab');
    assert.equal(await inDialog(), true, 'Shift+Tab stays in the dialog');

    // The side buttons are for the keyboard and screen readers: hidden until focused, then they work.
    const prevBtn = overlay.locator('.hal0-lightbox-prev');
    const opacity = (loc) => loc.evaluate((b) => getComputedStyle(b).opacity);
    const focused = () => prevBtn.evaluate((b) => b === document.activeElement);
    assert.equal(await opacity(prevBtn), '0', 'the previous button is hidden until focused');
    for (let i = 0; i < 3 && !(await focused()); i++) await page.keyboard.press('Tab');
    assert.equal(await focused(), true, 'Tab reaches the previous button');
    assert.equal(await opacity(prevBtn), '1', 'focused, it is visible');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    s = await state();
    assert.equal(s.src, await shots.nth(0).getAttribute('src'), 'the previous button steps back');
    assert.equal(s.open, 'true', 'a button press does not close the box');

    await page.keyboard.press('ArrowLeft');
    s = await state();
    assert.equal(s.count, `${total} / ${total}`, 'stepping back from the first wraps to the last');

    const box = await overlay.boundingBox();

    await page.keyboard.press('Escape');
    s = await state();
    assert.equal(s.open, 'false', 'Escape closes');
    assert.equal(s.inert, true, 'closed, the dialog is inert');
    await page.waitForTimeout(300); // the fade, then visibility: hidden
    assert.equal(await overlay.evaluate((o) => o.checkVisibility({ visibilityProperty: true })), false, 'closed, it is hidden once faded');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('.hal0-lightbox'))), false, 'Tab does not land in the closed dialog');

    // The backdrop closes; the picture steps instead.
    await shots.nth(0).click();
    await half('next').click();
    s = await state();
    assert.equal(s.count, `2 / ${total}`, 'clicking the picture steps');
    assert.equal(s.open, 'true', 'and keeps it open');
    await page.mouse.click(box.x + 60, box.y + box.height - 20);
    assert.equal((await state()).open, 'false', 'clicking the backdrop closes');
  } finally {
    await browser.close();
  }
});

test('on a touch screen a swipe steps and a tap on a half flashes its edge', skipBrowser, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    await page.goto(url, { waitUntil: 'networkidle' });
    const shots = page.locator('figure.shot img[src*="/screenshots/"]');
    const total = await shots.count();
    await shots.nth(0).scrollIntoViewIfNeeded();
    await shots.nth(0).click();
    const overlay = page.locator('.hal0-lightbox');
    const count = () => overlay.locator('.hal0-lightbox-count').textContent();
    assert.equal(await count(), `1 / ${total}`);
    assert.equal(await page.evaluate(() => matchMedia('(hover: hover)').matches), false, 'nothing hovers on a touch screen');

    // A tap on the right half steps, and flashes that edge in place of a hover.
    // (Before the swipes: once a raw CDP touch sequence has run, Chromium stops
    // turning Playwright's taps into clicks, a harness quirk, not the page's.)
    const half = overlay.locator('.hal0-lightbox-half-next');
    const lit = () => half.evaluate((h) => Number(getComputedStyle(h, '::before').opacity));
    const hb = await half.boundingBox();
    await page.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.waitForTimeout(100); // into the 120ms fade-in
    assert.ok((await lit()) > 0, 'the tapped edge lights up');
    assert.equal(await count(), `2 / ${total}`, 'the tap steps forward');
    await page.waitForTimeout(600); // the 350ms flash, then the fade
    assert.equal(await lit(), 0, 'and goes dark again');

    // A real touch swipe to the left goes forward; to the right goes back and
    // wraps. Neither closes the box, and no click follows to step again.
    const box = await overlay.boundingBox();
    const y = box.y + box.height * 0.5;
    await swipe(page, { fromX: box.x + box.width * 0.6, toX: box.x + box.width * 0.4, y });
    assert.equal(await count(), `3 / ${total}`, 'a left swipe steps forward');
    assert.equal(await overlay.getAttribute('data-open'), 'true', 'a swipe does not close the box');
    for (let i = 0; i < 3; i++) await swipe(page, { fromX: box.x + box.width * 0.4, toX: box.x + box.width * 0.6, y });
    assert.equal(await count(), `${total} / ${total}`, 'right swipes step back and wrap');
  } finally {
    await browser.close();
  }
});
