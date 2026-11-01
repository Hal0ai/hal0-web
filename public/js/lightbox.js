/* Screenshot lightbox — zero-dependency, no framework.
 *
 * Binds every image whose src points at /screenshots/ (apex showcase, docs,
 * blog) so a click opens it in a dismissible overlay, as large as the
 * viewport allows, with the page's other screenshots one step left or right:
 * a click on the left or right half of the picture (a thin accent line lights
 * the edge under the pointer, so there is visibly more), the arrow keys, or a
 * horizontal swipe. The ‹ › buttons stay for keyboard and screen-reader
 * users, visible only while focused. The overlay mirrors the figure's
 * <picture> sources (AVIF, WebP, PNG; the @2x capture on a retina screen),
 * shows the figure's caption and a "3 / 12" counter, and preloads the
 * neighbours. Styling lives in src/styles/global.css (.hal0-lightbox*).
 * Loaded on the marketing layout and on Starlight pages (see astro.config.mjs
 * head). Idempotent + handles Starlight's client-side view transitions by
 * re-binding on navigation.
 */
(() => {
  const SELECTOR = 'img[src*="/screenshots/"]';
  const SWIPE_PX = 40; // a horizontal drag this long steps to the next shot

  let overlay = null;
  let stage = null;
  let picture = null;
  let overlayImg = null;
  let captionText = null;
  let counter = null;
  let closeBtn = null;
  let prevBtn = null;
  let nextBtn = null;
  let halfPrev = null; // the left half of the picture: steps back
  let halfNext = null; // the right half: steps forward
  let items = []; // the page's screenshots in DOM order
  let index = -1;
  let lastFocus = null;
  let pointerStart = null;
  let pointerLast = null;
  let swallowClick = false; // the click that follows a mouse swipe must not close the box

  function el(tag, className, attrs) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, value);
    return node;
  }

  function build() {
    overlay = el('div', 'hal0-lightbox', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Screenshot preview' });
    overlay.dataset.open = 'false';
    overlay.dataset.single = 'true';
    overlay.inert = true; // closed: out of the tab order and away from assistive tech

    closeBtn = el('button', 'hal0-lightbox-close', { type: 'button', 'aria-label': 'Close preview' });
    closeBtn.textContent = '×';
    prevBtn = el('button', 'hal0-lightbox-nav hal0-lightbox-prev', { type: 'button', 'aria-label': 'Previous screenshot' });
    prevBtn.textContent = '‹';
    nextBtn = el('button', 'hal0-lightbox-nav hal0-lightbox-next', { type: 'button', 'aria-label': 'Next screenshot' });
    nextBtn.textContent = '›';

    stage = el('figure', 'hal0-lightbox-stage');
    // The frame: the picture under two invisible halves. Each half lights a
    // line along its own edge while hovered (CSS) and steps on click; they are
    // pointer-only, so hidden from assistive tech, which has the buttons.
    const pic = el('div', 'hal0-lightbox-pic');
    picture = el('picture');
    overlayImg = el('img', '', { alt: '', draggable: 'false' });
    picture.appendChild(overlayImg);
    halfPrev = el('div', 'hal0-lightbox-half hal0-lightbox-half-prev', { 'aria-hidden': 'true' });
    halfNext = el('div', 'hal0-lightbox-half hal0-lightbox-half-next', { 'aria-hidden': 'true' });
    pic.append(picture, halfPrev, halfNext);
    const caption = el('figcaption', 'hal0-lightbox-cap');
    captionText = el('span', 'hal0-lightbox-text');
    counter = el('span', 'hal0-lightbox-count');
    caption.append(captionText, counter);
    stage.append(pic, caption);

    overlay.append(closeBtn, prevBtn, stage, nextBtn);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      const target = e.target;
      if (prevBtn.contains(target)) return step(-1);
      if (nextBtn.contains(target)) return step(1);
      if (halfPrev.contains(target)) return tap(halfPrev, -1);
      if (halfNext.contains(target)) return tap(halfNext, 1);
      if (closeBtn.contains(target)) return closeBox();
      // The caption is content; everywhere else is backdrop.
      if (stage.contains(target)) return;
      closeBox();
    });

    // Swipe: a mostly horizontal drag of SWIPE_PX or more steps left or right.
    // The stage is a scroll container with touch-action: pan-y, so a horizontal
    // drag keeps delivering pointer events; should the browser still claim the
    // gesture (pointercancel), the last position seen decides.
    overlay.addEventListener('pointerdown', (e) => {
      pointerStart = pointerLast = { x: e.clientX, y: e.clientY };
    });
    overlay.addEventListener('pointermove', (e) => {
      if (pointerStart) pointerLast = { x: e.clientX, y: e.clientY };
    });
    const endSwipe = (e) => {
      if (!pointerStart) return;
      const end = e.type === 'pointercancel' ? pointerLast : { x: e.clientX, y: e.clientY };
      const dx = end.x - pointerStart.x;
      const dy = end.y - pointerStart.y;
      pointerStart = pointerLast = null;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
      swallowClick = e.pointerType === 'mouse';
      step(dx < 0 ? 1 : -1);
    };
    overlay.addEventListener('pointerup', endSwipe);
    overlay.addEventListener('pointercancel', endSwipe);
  }

  /** Every screenshot on the page, in reading order, excluding the overlay's own copy. */
  function collect() {
    items = Array.from(document.querySelectorAll(SELECTOR)).filter((img) => !img.closest('.hal0-lightbox'));
  }

  /** The figure's caption when it has one, else the alt text. */
  function captionOf(img) {
    const figure = img.closest('figure');
    const cap = figure && figure.querySelector('figcaption');
    const text = cap ? cap.textContent : img.alt;
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function preload(i) {
    if (items.length < 2) return;
    const img = items[(i + items.length) % items.length];
    const probe = new Image();
    probe.src = img.currentSrc || img.src;
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const img = items[index];

    // Mirror the figure's <picture>: the browser picks AVIF/WebP and the @2x
    // capture for the overlay the same way it did for the figure.
    picture.querySelectorAll('source').forEach((s) => s.remove());
    const srcPicture = img.closest('picture');
    if (srcPicture) {
      for (const s of srcPicture.querySelectorAll('source')) picture.insertBefore(s.cloneNode(true), overlayImg);
    }
    const srcset = img.getAttribute('srcset');
    if (srcset) overlayImg.setAttribute('srcset', srcset);
    else overlayImg.removeAttribute('srcset');
    overlayImg.src = img.getAttribute('src');
    overlayImg.alt = img.alt || '';

    const text = captionOf(img);
    captionText.textContent = text;
    counter.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    overlay.dataset.single = items.length > 1 ? 'false' : 'true';
    overlay.setAttribute('aria-label', text ? `Screenshot preview: ${text}` : 'Screenshot preview');

    preload(index + 1);
    preload(index - 1);
  }

  function step(delta) {
    if (items.length < 2) return;
    show(index + delta);
  }

  /**
   * A half of the picture was clicked. With a pointer that hovers, the edge
   * was already lit; on a touch screen it flashes for a moment so the tap
   * reads as "there is more this way".
   */
  function tap(half, delta) {
    step(delta);
    if (matchMedia('(hover: hover)').matches) return;
    half.classList.add('is-flash');
    setTimeout(() => half.classList.remove('is-flash'), 350);
  }

  /**
   * A view transition swaps the body and takes the overlay with it. Forget the
   * detached overlay (the next click builds a fresh one) and give the page its
   * scroll back in case it was open at the time.
   */
  function reconcile() {
    if (!overlay || document.body.contains(overlay)) return;
    overlay = null;
    document.documentElement.style.overflow = '';
  }

  function openBox(img) {
    reconcile();
    if (!overlay) build();
    collect();
    const i = items.indexOf(img);
    if (i < 0) return;
    lastFocus = document.activeElement;
    show(i);
    overlay.inert = false;
    overlay.dataset.open = 'true';
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeBox() {
    if (!overlay || overlay.dataset.open !== 'true') return;
    overlay.dataset.open = 'false';
    overlay.inert = true;
    document.documentElement.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (!overlay || overlay.dataset.open !== 'true') return;
    if (e.key === 'Escape') return closeBox();
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      return step(-1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      return step(1);
    }
    if (e.key === 'Tab') {
      // Keep focus inside the dialog: close, previous, next, and around again.
      // The side buttons are clipped away until focused, and display: none on
      // a page with one screenshot.
      const buttons = [closeBtn, prevBtn, nextBtn].filter((b) => getComputedStyle(b).display !== 'none');
      const at = buttons.indexOf(document.activeElement);
      const to = at < 0 ? 0 : (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      e.preventDefault();
      buttons[to].focus();
    }
  });

  function bind(img) {
    if (img.dataset.lbBound || img.closest('.hal0-lightbox')) return;
    img.dataset.lbBound = '1';
    img.addEventListener('click', (e) => {
      // If the screenshot is wrapped in a link, zoom instead of navigating.
      const a = img.closest('a');
      if (a) e.preventDefault();
      openBox(img);
    });
  }

  function bindAll() {
    document.querySelectorAll(SELECTOR).forEach(bind);
  }

  if (document.readyState !== 'loading') bindAll();
  else document.addEventListener('DOMContentLoaded', bindAll);
  // Starlight uses client-side navigation; re-bind after each swap.
  document.addEventListener('astro:page-load', () => {
    reconcile();
    bindAll();
  });
})();
