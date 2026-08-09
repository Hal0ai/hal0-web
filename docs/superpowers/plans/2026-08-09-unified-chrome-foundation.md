# Unified Chrome Foundation (tokens + nav manifest) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract hal0-web's design tokens, nav contents, and footer into single-source-of-truth artifacts (`src/styles/tokens.css`, `src/data/nav.json`) consumed by every surface, so the future Discourse theme and new pages (bench, gallery) inherit identical chrome.

**Architecture:** `nav.json` is the one place link sets live; a thin typed helper (`src/lib/nav.ts`) wraps it for Astro components. `tokens.css` holds all `--hal0-*` custom properties, imported by `global.css` (and later synced into the Discourse theme). A shared `SiteFooter.astro` renders the footer on both the marketing layout and Starlight pages (via a `Footer` component override), eliminating today's four duplicated link lists.

**Tech Stack:** Astro 6, Starlight 0.39, Tailwind v4, `node --test` for data/consistency tests (no test framework exists in the repo today).

## Global Constraints

- Brand values are fixed and must not change during extraction: accent `#ffb000`, hover `#ffc533`, muted `#7a5500`, bg `#0a0a0a`, fonts Geist Variable (body) / JetBrains Mono (mono/display). Copy values verbatim from `src/styles/global.css` — this is a refactor, zero visual diff intended except where noted.
- Nav labels are lowercase mono everywhere (`docs`, `blog`, …). This intentionally changes the Starlight docnav labels from Capitalized to lowercase — the one deliberate visual change.
- Canonical docs href is `/docs/getting-started/` (avoids the `/docs` redirect hop).
- All hrefs, the Discord invite (`https://discord.gg/7M4y6dcUyq`), and the GitHub org URL (`https://github.com/hal0ai/hal0`) must come from `nav.json` — no hardcoded copies remain in components.
- `npm run build` must pass after every task. Working dir is the repo root.

## File Structure

- `src/data/nav.json` — created. Link manifest: `header`, `footer`, `social` arrays.
- `src/lib/nav.ts` — created. Typed accessors + active-link matcher.
- `src/styles/tokens.css` — created. All `--hal0-*` custom properties.
- `src/styles/global.css` — modified. Imports `tokens.css`; token block removed.
- `src/components/DiscordIcon.astro` — created. The inline Discord SVG (currently pasted twice in MarketingLayout).
- `src/components/SiteFooter.astro` — created. Shared footer, consumes `nav.json`.
- `src/layouts/MarketingLayout.astro` — modified. Header/mobile/footer render from manifest.
- `src/components/StarlightSiteTitle.astro` — modified. Nav renders from manifest.
- `src/components/StarlightFooter.astro` — created. Starlight `Footer` override embedding `SiteFooter`.
- `astro.config.mjs` — modified. Registers the Footer override.
- `scripts/test/nav.test.mjs` — created. Manifest schema test.
- `scripts/test/chrome-consistency.test.mjs` — created. Cross-surface dist assertion.
- `public/brand/README.md` — created. Canonical brand-asset manifest.
- `package.json` — modified. Adds `"test"` script.

---

### Task 1: Nav manifest + schema test

**Files:**
- Create: `src/data/nav.json`
- Create: `src/lib/nav.ts`
- Create: `scripts/test/nav.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `nav.json` shape `{ header: NavLink[], footer: NavLink[], social: NavLink[] }` where `NavLink = { label: string, href: string, match?: string, exclude?: string[] }` and social entries additionally carry `id: 'github' | 'discord'`.
- Produces: `src/lib/nav.ts` exports `header`, `footer`, `social` (typed arrays) and `isActive(path: string, link: NavLink): boolean`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test/nav.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

test('nav.json has header/footer/social arrays', () => {
  for (const key of ['header', 'footer', 'social']) {
    assert.ok(Array.isArray(nav[key]) && nav[key].length > 0, `${key} is a non-empty array`);
  }
});

test('every link has label and href', () => {
  for (const key of ['header', 'footer', 'social']) {
    for (const link of nav[key]) {
      assert.equal(typeof link.label, 'string');
      assert.match(link.href, /^(\/|https:\/\/|mailto:)/, `${link.label} href is rooted or absolute`);
    }
  }
});

test('labels are lowercase', () => {
  for (const key of ['header', 'footer', 'social']) {
    for (const link of nav[key]) {
      assert.equal(link.label, link.label.toLowerCase(), `${link.label} must be lowercase`);
    }
  }
});

test('social entries carry known ids', () => {
  const ids = nav.social.map((s) => s.id).sort();
  assert.deepEqual(ids, ['discord', 'github']);
});

test('header links carry match prefixes for active-state', () => {
  for (const link of nav.header) {
    assert.equal(typeof link.match, 'string', `${link.label} needs match`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/test/nav.test.mjs`
Expected: FAIL — `ENOENT ... src/data/nav.json`

- [ ] **Step 3: Create the manifest**

```json
{
  "header": [
    { "label": "docs", "href": "/docs/getting-started/", "match": "/docs", "exclude": ["/docs/reference/model-roster-benchmark"] },
    { "label": "benchmarks", "href": "/docs/reference/model-roster-benchmark/", "match": "/docs/reference/model-roster-benchmark" },
    { "label": "blog", "href": "/blog", "match": "/blog" },
    { "label": "changelog", "href": "/changelog", "match": "/changelog" },
    { "label": "releases", "href": "/releases", "match": "/releases" }
  ],
  "footer": [
    { "label": "docs", "href": "/docs/getting-started/" },
    { "label": "blog", "href": "/blog" },
    { "label": "changelog", "href": "/changelog" },
    { "label": "releases", "href": "/releases" },
    { "label": "contributing", "href": "/contributing" },
    { "label": "roadmap", "href": "/#roadmap" },
    { "label": "hello@hal0.dev", "href": "mailto:hello@hal0.dev" }
  ],
  "social": [
    { "id": "github", "label": "github", "href": "https://github.com/hal0ai/hal0" },
    { "id": "discord", "label": "discord", "href": "https://discord.gg/7M4y6dcUyq" }
  ]
}
```

Save as `src/data/nav.json`. Note: header gains `benchmarks` (previously docs-side only) and the marketing header's `roadmap` anchor moves to the footer — the unified set applies everywhere.

- [ ] **Step 4: Create the typed helper**

```ts
// src/lib/nav.ts
/**
 * Single source of truth for site chrome links. Every surface (marketing
 * layout, Starlight docnav, footer, future Discourse theme sync) reads
 * from nav.json via this module — never hardcode chrome hrefs elsewhere.
 */
import nav from '../data/nav.json';

export interface NavLink {
  label: string;
  href: string;
  match?: string;
  exclude?: string[];
}
export interface SocialLink extends NavLink {
  id: 'github' | 'discord';
}

export const header = nav.header as NavLink[];
export const footer = nav.footer as NavLink[];
export const social = nav.social as SocialLink[];

const matches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');

export function isActive(path: string, link: NavLink): boolean {
  if (!link.match) return false;
  return matches(path, link.match) && !(link.exclude ?? []).some((e) => matches(path, e));
}
```

- [ ] **Step 5: Add the test script and run**

In `package.json` `"scripts"`, add:

```json
"test": "node --test scripts/test/"
```

Run: `npm test`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/data/nav.json src/lib/nav.ts scripts/test/nav.test.mjs package.json
git commit -m "feat: add nav manifest as single source of chrome links"
```

---

### Task 2: Extract design tokens to tokens.css

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/styles/global.css:11-40`

**Interfaces:**
- Produces: `src/styles/tokens.css` — standalone file defining every `--hal0-*` property on `:root`. This exact file is what the future Discourse theme sync consumes; it must not depend on Tailwind or Starlight.

- [ ] **Step 1: Create tokens.css**

Cut the entire `/* ---------- design tokens ---------- */` block (the `:root { ... }` rule containing `--hal0-accent` through `--hal0-ease`, currently `src/styles/global.css` lines 11–40) into a new file, with this header comment:

```css
/* hal0 design tokens — the single source of truth for brand values.
 *
 * Consumed by global.css (site-wide) and synced verbatim into the
 * Discourse theme component. Keep this file dependency-free: plain
 * CSS custom properties on :root, nothing Tailwind- or Starlight-
 * specific. Change brand values HERE and nowhere else. */

:root {
	/* Brand */
	--hal0-accent:        #ffb000; /* sodium amber */
	--hal0-accent-hover:  #ffc533;
	--hal0-accent-muted:  #7a5500;
	--hal0-accent-glow:   rgba(255, 176, 0, 0.18);

	/* Dark surfaces (default theme) */
	--hal0-bg:           #0a0a0a;
	--hal0-bg-elevated: #141414;
	--hal0-bg-sunken:   #050505;
	--hal0-fg:          #f5f5f4;
	--hal0-fg-muted:    #c8c2bd; /* ≥7:1 on bg-elevated */
	--hal0-fg-dim:      #a3a09c; /* ≥4.5:1 on bg-elevated */
	--hal0-border:      #262626;
	--hal0-border-strong: #3a3a3a;

	/* Type stack — 'JBM Fallback' / 'Geist Fallback' are local size-adjusted
	 * faces (see fonts.css) so the swap from system → webfont is metric-
	 * neutral and CLS stays low. */
	--hal0-font-mono:    'JetBrains Mono', 'JBM Fallback', ui-monospace, 'SF Mono', Menlo, monospace;
	--hal0-font-body:    'Geist Variable', 'Geist', 'Geist Fallback', system-ui, -apple-system, BlinkMacSystemFont,
	                      'Segoe UI', Roboto, sans-serif;
	--hal0-font-display: var(--hal0-font-mono);

	/* Motion */
	--hal0-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: Import it from global.css**

In `src/styles/global.css`, replace the removed block with an import — order matters, tokens must precede the Starlight overrides that reference them:

```css
@import './fonts.css';
@import './tokens.css';
@import 'tailwindcss';
@import '@astrojs/starlight-tailwind';
```

(The `/* ---------- design tokens ---------- */` section header and `:root` block are gone from global.css; everything else stays.)

- [ ] **Step 3: Verify the build and the emitted CSS**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -rlo -- '--hal0-accent:\s*#ffb000' dist/_astro/*.css | head -1`
Expected: one CSS file listed — tokens still reach the bundle.

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/global.css
git commit -m "refactor: extract design tokens into standalone tokens.css"
```

---

### Task 3: Shared SiteFooter + DiscordIcon components

**Files:**
- Create: `src/components/DiscordIcon.astro`
- Create: `src/components/SiteFooter.astro`
- Modify: `src/layouts/MarketingLayout.astro` (footer block, lines 150–186; changelog imports, lines 20–26)

**Interfaces:**
- Consumes: `footer`, `social` from `src/lib/nav.ts` (Task 1).
- Produces: `<SiteFooter />` — no props, self-contained (derives the version line itself). `<DiscordIcon size={14} />` — prop `size?: number` (px, default 18).

- [ ] **Step 1: Create DiscordIcon.astro**

Move the inline Discord SVG (pasted twice in `MarketingLayout.astro`, lines 119 and 180) into a component:

```astro
---
/** Discord glyph, currentColor. The one copy of this path in the repo. */
interface Props { size?: number }
const { size = 18 } = Astro.props;
---
<svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
```

- [ ] **Step 2: Create SiteFooter.astro**

```astro
---
/**
 * SiteFooter — THE footer. Rendered on marketing pages (MarketingLayout)
 * and Starlight pages (StarlightFooter override) so every surface ends in
 * byte-identical chrome. Links come from nav.json; version from changelog.
 */
import Wordmark from './Wordmark.astro';
import DiscordIcon from './DiscordIcon.astro';
import { footer, social } from '../lib/nav';
import rawChangelog from '../data/changelog.md?raw';
import { parseChangelog } from '../lib/changelog.js';

const { latest } = parseChangelog(rawChangelog);
const footerVersion = latest?.version ?? '';
const github = social.find((s) => s.id === 'github')!;
const discord = social.find((s) => s.id === 'discord')!;
---

<footer class="border-t border-hal0-border bg-hal0-bg-sunken">
  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-hal0-fg-muted md:flex-row md:items-center md:justify-between">
    <div class="flex items-center gap-3">
      <Wordmark size="text-base" />
      <span class="font-mono text-xs text-hal0-fg-dim">
        Apache-2.0{footerVersion ? ` · ${footerVersion}` : ''}
      </span>
    </div>
    <ul class="flex flex-wrap items-center gap-6 font-mono text-xs">
      {footer.map((l) => (
        <li><a class="hover:text-hal0-fg" href={l.href}>{l.label}</a></li>
      ))}
      <li>
        <a class="hover:text-hal0-fg" href={github.href} rel="noopener">{github.label}</a>
      </li>
      <li>
        <a class="inline-flex items-center gap-1.5 hover:text-hal0-fg" href={discord.href} rel="noopener">
          <DiscordIcon size={14} />
          {discord.label}
        </a>
      </li>
    </ul>
  </div>
</footer>
```

- [ ] **Step 3: Use it in MarketingLayout**

In `src/layouts/MarketingLayout.astro`:
- Delete the whole `<footer>…</footer>` block (lines 150–186).
- In its place put `<SiteFooter />`.
- Add `import SiteFooter from '../components/SiteFooter.astro';` to the frontmatter.
- Remove the now-unused frontmatter lines: `import rawChangelog …`, `import { parseChangelog } …`, `const { latest } …`, `const footerVersion …` (lines 20–26). Keep the `Wordmark` import (header still uses it).

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -c 'hello@hal0.dev' dist/index.html`
Expected: `1` (footer renders once, from the manifest).

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscordIcon.astro src/components/SiteFooter.astro src/layouts/MarketingLayout.astro
git commit -m "refactor: shared SiteFooter component fed by nav manifest"
```

---

### Task 4: MarketingLayout header from the manifest

**Files:**
- Modify: `src/layouts/MarketingLayout.astro` (desktop nav lines 98–123, mobile menu lines 135–143)

**Interfaces:**
- Consumes: `header`, `social`, `isActive` from `src/lib/nav.ts`; `DiscordIcon` from Task 3.

- [ ] **Step 1: Replace the hardcoded desktop nav**

Add to the frontmatter:

```ts
import DiscordIcon from '../components/DiscordIcon.astro';
import { header as navHeader, social, isActive } from '../lib/nav';

const path = Astro.url.pathname;
const github = social.find((s) => s.id === 'github')!;
const discord = social.find((s) => s.id === 'discord')!;
```

Replace the desktop `<ul class="hidden items-center …">…</ul>` (lines 98–123) with:

```astro
<ul class="hidden items-center gap-7 font-mono text-sm text-hal0-fg-muted md:flex">
  {navHeader.map((l) => (
    <li>
      <a
        class:list={['transition hover:text-hal0-fg', { 'text-hal0-accent': isActive(path, l) }]}
        aria-current={isActive(path, l) ? 'page' : undefined}
        href={l.href}
      >{l.label}</a>
    </li>
  ))}
  <li>
    <a class="transition hover:text-hal0-fg" href={github.href} rel="noopener">{github.label}</a>
  </li>
  <li>
    <a
      class="flex items-center transition hover:text-hal0-fg"
      href={discord.href}
      rel="noopener"
      aria-label="Join the hal0 Discord"
      title="Discord"
    >
      <DiscordIcon />
      <span class="sr-only">Discord</span>
    </a>
  </li>
</ul>
```

Active links now light amber on marketing pages — matching the docs nav behavior (spec section 0: active-section highlighting on every surface).

- [ ] **Step 2: Replace the hardcoded mobile menu**

Replace the `<ul id="mobile-menu" …>…</ul>` list items (lines 135–143) with:

```astro
<ul id="mobile-menu" class="hal0-mobile-menu md:hidden" hidden>
  {navHeader.map((l) => (
    <li><a href={l.href}>{l.label}</a></li>
  ))}
  <li><a href={github.href} rel="noopener">{github.label}</a></li>
  <li><a href={discord.href} rel="noopener">{discord.label}</a></li>
</ul>
```

- [ ] **Step 3: Verify no hardcoded chrome hrefs remain**

Run: `npm run build && grep -n 'discord.gg\|github.com/hal0ai/hal0\|/changelog' src/layouts/MarketingLayout.astro`
Expected: build succeeds; grep returns nothing (all chrome links flow from nav.json).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/MarketingLayout.astro
git commit -m "refactor: marketing header + mobile menu render from nav manifest"
```

---

### Task 5: Starlight docnav from the manifest

**Files:**
- Modify: `src/components/StarlightSiteTitle.astro:19-32,44-50`

**Interfaces:**
- Consumes: `header`, `isActive` from `src/lib/nav.ts`.

- [ ] **Step 1: Replace the local links array**

In the frontmatter, delete lines 19–32 (`const path` through `isActive` and the local `links`/`BENCH` definitions) and replace with:

```ts
import { header as links, isActive } from '../lib/nav';
const path = Astro.url.pathname;
```

Update the template loop (lines 44–50) to use the shared matcher:

```astro
{links.map((l) => (
  <a
    href={l.href}
    class:list={['hal0-docnav-link', { active: isActive(path, l) }]}
    aria-current={isActive(path, l) ? 'page' : undefined}
  >{l.label}</a>
))}
```

Labels become lowercase (`docs`, `benchmarks`, …) — the intended unification with the marketing header. Update the component's doc comment to say links come from `src/data/nav.json`.

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: success.

Run: `grep -o 'hal0-docnav-link[^>]*>[a-z]*<' dist/blog/index.html | head -8`
Expected: lowercase labels (`docs`, `benchmarks`, `blog`, `changelog`, `releases`).

- [ ] **Step 3: Commit**

```bash
git add src/components/StarlightSiteTitle.astro
git commit -m "refactor: Starlight docnav renders from nav manifest"
```

---

### Task 6: Identical footer on Starlight surfaces

**Files:**
- Create: `src/components/StarlightFooter.astro`
- Modify: `astro.config.mjs` (the `components:` override block, ~line 92)

**Interfaces:**
- Consumes: `SiteFooter` (Task 3); Starlight's default `Footer` component.

- [ ] **Step 1: Create the override**

```astro
---
/**
 * Starlight Footer override: keep Starlight's own footer content
 * (pagination, edit links) and append the shared SiteFooter so docs,
 * blog, and KB pages end in the exact same chrome as marketing pages.
 */
import Default from '@astrojs/starlight/components/Footer.astro';
import SiteFooter from './SiteFooter.astro';
---
<Default><slot /></Default>
<SiteFooter />
```

- [ ] **Step 2: Register it**

In `astro.config.mjs`, inside the existing starlight `components:` object (which already overrides `SiteTitle`), add:

```js
Footer: './src/components/StarlightFooter.astro',
```

- [ ] **Step 3: Verify**

Run: `npm run build && grep -c 'hello@hal0.dev' dist/blog/index.html`
Expected: build succeeds; count ≥ 1 (shared footer now present on a Starlight page).

- [ ] **Step 4: Commit**

```bash
git add src/components/StarlightFooter.astro astro.config.mjs
git commit -m "feat: shared SiteFooter on Starlight pages via Footer override"
```

---

### Task 7: Cross-surface consistency test + brand manifest

**Files:**
- Create: `scripts/test/chrome-consistency.test.mjs`
- Create: `public/brand/README.md`

**Interfaces:**
- Consumes: `dist/` output of `npm run build`; `src/data/nav.json`.

- [ ] **Step 1: Write the consistency test**

```js
// scripts/test/chrome-consistency.test.mjs
//
// Guards the "one site, not four" invariant: the footer link set and the
// header manifest links must be identical on a marketing page and a
// Starlight page. Requires a fresh `npm run build` (skips if dist/ absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const nav = JSON.parse(await readFile(new URL('../../src/data/nav.json', import.meta.url), 'utf8'));

const pages = {
  marketing: new URL('../../dist/index.html', import.meta.url),
  starlight: new URL('../../dist/blog/index.html', import.meta.url),
};

const built = await access(pages.marketing).then(() => true, () => false);

function hrefs(html, sectionRe) {
  const section = html.match(sectionRe)?.[0] ?? '';
  return new Set([...section.matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
}

test('footer link set identical across surfaces', { skip: !built && 'run npm run build first' }, async () => {
  const marketing = hrefs(await readFile(pages.marketing, 'utf8'), /<footer[\s\S]*?<\/footer>/);
  const starlight = hrefs(await readFile(pages.starlight, 'utf8'), /<footer[\s\S]*<\/footer>/);
  for (const l of [...nav.footer, ...nav.social]) {
    assert.ok(marketing.has(l.href), `marketing footer missing ${l.href}`);
    assert.ok(starlight.has(l.href), `starlight footer missing ${l.href}`);
  }
});

test('header manifest links present on both surfaces', { skip: !built && 'run npm run build first' }, async () => {
  for (const [name, url] of Object.entries(pages)) {
    const html = await readFile(url, 'utf8');
    for (const l of nav.header) {
      assert.ok(html.includes(`href="${l.href}"`), `${name} header missing ${l.href}`);
    }
  }
});
```

- [ ] **Step 2: Run it**

Run: `npm run build && npm test`
Expected: all tests PASS (nav schema tests from Task 1 + both consistency tests).

- [ ] **Step 3: Write the brand asset manifest**

```markdown
<!-- public/brand/README.md -->
# hal0 brand assets — canonical set

Single source for logos across hal0.dev, the Discourse theme, and any
future surface. Never redraw or approximate; reference these files (they
are served at `https://hal0.dev/brand/<name>`).

| File | Use |
| --- | --- |
| `logo-halo-dark.svg` / `.png` | Full logo on dark surfaces (site header contexts, Discourse logo slot) |
| `logo-halo-light.svg` / `.png` | Full logo on light surfaces (Discourse light-scheme logo slot) |
| `logo-halo-dark-favico.svg` / `.png` | Mark-only glyph, dark (favicon, touch icon, Discourse large icon) |
| `logo-halo-light-favico.svg` / `.png` | Mark-only glyph, light |
| `/favicon.svg` (site root) | Browser favicon |
| `/og-default.png` (site root) | Default OG/social card (1200×630) |

Related sources: the inline wordmark component is `src/components/Wordmark.astro`
(brand mark: Monomaniac One "hal" + JetBrains Mono slashed "0"); design tokens
are `src/styles/tokens.css`; nav contents are `src/data/nav.json`.

Discourse theme slots map: logo → `logo-halo-dark`, mobile logo →
`logo-halo-dark-favico`, favicon → `/favicon.svg`, large icon →
`logo-halo-dark-favico.png`, default OG image → `/og-default.png`.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/test/chrome-consistency.test.mjs public/brand/README.md
git commit -m "test: cross-surface chrome consistency guard + brand asset manifest"
```
