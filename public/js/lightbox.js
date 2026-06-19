/* Screenshot lightbox — zero-dependency, no framework.
 *
 * Binds every image whose src points at /screenshots/ (apex showcase, docs,
 * blog) so a click opens it full-size in a dismissible overlay. Styling lives
 * in src/styles/global.css (.hal0-lightbox*). Loaded on the marketing layout
 * and on Starlight pages (see astro.config.mjs head). Idempotent + handles
 * Starlight's client-side view transitions by re-binding on navigation.
 */
(() => {
  const SELECTOR = 'img[src*="/screenshots/"]';
  let overlay = null;
  let overlayImg = null;
  let lastFocus = null;

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'hal0-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Screenshot preview');
    overlay.dataset.open = 'false';

    const close = document.createElement('button');
    close.className = 'hal0-lightbox-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close preview');
    close.textContent = '×'; // ×

    overlayImg = document.createElement('img');
    overlayImg.alt = '';

    overlay.append(close, overlayImg);
    document.body.appendChild(overlay);

    // Click anywhere on the backdrop (or the close button) dismisses; a click
    // on the image itself should not.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlayImg) return;
      closeBox();
    });
  }

  function openBox(src, alt) {
    if (!overlay) build();
    lastFocus = document.activeElement;
    overlayImg.src = src;
    overlayImg.alt = alt || '';
    overlay.dataset.open = 'true';
    document.documentElement.style.overflow = 'hidden';
    overlay.querySelector('.hal0-lightbox-close').focus();
  }

  function closeBox() {
    if (!overlay || overlay.dataset.open !== 'true') return;
    overlay.dataset.open = 'false';
    document.documentElement.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBox();
  });

  function bind(img) {
    if (img.dataset.lbBound || img.closest('.hal0-lightbox')) return;
    img.dataset.lbBound = '1';
    img.addEventListener('click', (e) => {
      // If the screenshot is wrapped in a link, zoom instead of navigating.
      const a = img.closest('a');
      if (a) e.preventDefault();
      openBox(img.currentSrc || img.src, img.alt);
    });
  }

  function bindAll() {
    document.querySelectorAll(SELECTOR).forEach(bind);
  }

  if (document.readyState !== 'loading') bindAll();
  else document.addEventListener('DOMContentLoaded', bindAll);
  // Starlight uses client-side navigation; re-bind after each swap.
  document.addEventListener('astro:page-load', bindAll);
})();
