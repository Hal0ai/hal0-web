# Handoff: Full Starlight Theming to the Unified hal0 Design System

**For:** a fresh implementation session (agent or human) with no context on this repo.
**Repo:** `Hal0ai/hal0-web` (canonical checkout `/mnt/mintdev/repos/hal0-web`; work in a
git worktree under `/mnt/mintdev/worktrees/hal0-web/`, branch `feat/starlight-theme`).
**Mission:** finish theming Starlight-rendered surfaces (docs, blog, KB) so every pixel
matches the unified hal0 design system — closing the gap between "tokens recolored"
and "comp-faithful."

---

## 1. Design source of truth (the demo)

Everything visual is specified by the vendored high-fidelity design handoff at
**`docs/design/2026-08-09-community-comps/`**. Open the HTML files in a browser —
they are live, navigable mockups, not images:

| File | What it specifies for this handoff |
| --- | --- |
| `08 Docs.html` | **Primary reference.** Docs landing (intro, Start-here link cards, section cards), category listing (numbered page rows, `.plist`/`.prow`), article view (state tables, ASCII diagram, caution Aside, pager, TOC, version stamp "applies to v0.5.x") |
| `01 Unified Chrome.html` | Component sheet: header/footer (already shipped), **⌘K search palette spec** (mono rows, source tags: bench/profile/kb/forum), buttons, chips, terminal well |
| `04 Blog and KB.html` | Blog index/post + KB article three-column — mostly shipped (PRs #70, #84); consult for any residual blog-index gap |
| `hal0-site.css` | The comp's actual CSS — **when a number is in question, this file wins over any prose description**. One shared `.site-h1` rule for all surfaces (`clamp(28px,4vw,38px)`, `--ls-display`); reading scale; `.well` terminal idiom |
| `README.md` | The written contract: tokens (incl. required light-theme AA overrides — already in `tokens.css` via PR #72), typography rules (weight tops out at 600; emphasis via color/mono, not weight), motion (one easing, 0.12/0.18/0.22s), a11y invariants (meaning never color-alone, focus = 2px amber at 3px offset, small text never on `--fg-4`) |

Serve the comps locally to interact with them (they load React via CDN):
`cd docs/design/2026-08-09-community-comps && python3 -m http.server 8899` →
`http://localhost:8899/08%20Docs.html`.

## 2. Current state (what is already unified — do not redo)

- **Token bridge:** `src/styles/tokens.css` is canonical (`--hal0-*`, dark + light incl.
  status/device hues). `src/styles/global.css` maps Starlight's `--sl-color-*` /
  `--sl-font-*` onto them. `src/styles/site.css` provides the `.site`-scoped chrome
  classes; `src/styles/site-data.css` the data primitives (dtable, fpill, chip, well).
- **Chrome overrides** (registered in `astro.config.mjs` `components:`):
  `StarlightSiteTitle.astro` (wordmark + flattened global docnav — flattens ONLY hub
  entries with array `match`), `StarlightPageFrame.astro` (appends the shared
  `SiteFooter` outside `<main>`, sets `[data-longform]` on blog/kb pages,
  `[data-docs]` on docs pages — the per-surface CSS seams).
- **Surface treatments:** `src/styles/site-blog-kb.css` (KB + blog), `site-docs.css`
  (docs titles, Sections card grid on the docs landing, TOC/pager/table restyles) —
  landing via PR #84 (with review fixes: derived/tested section counts, comp's
  actual `.site-h1` values).
- **Nav manifest:** `src/data/nav.json` + `src/lib/nav.ts` — ALL chrome links flow
  from it. A unified `/changelog` page (release sidebar + scroll-sync) is landing
  from the docs-shape team; `/releases` will redirect to it.
- **Conventions:** lowercase mono labels; sodium amber `#ffb000` is the only accent;
  Conventional Commits ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;
  `git checkout -- src/data/changelog.md` before every commit (prebuild dirties it);
  tests via `npm test` (node --test; suite ≥182 — never reduce), `npm run build`
  must stay green, `npx astro check` must add zero net-new errors (baseline: 29,
  all in `src/pages/profiles.astro`).

## 2b. Surface inventory — every Starlight-rendered page type in scope

The theme must be verified page-type by page-type, not just "docs look right."
Blog IS in scope (it is a Starlight surface). Per-type comp reference and state:

| Page type | Route example | Comp reference | State → target |
| --- | --- | --- | --- |
| Docs landing | `/docs/getting-started/` | `08 Docs.html` landing view | Sections grid + Start-here cards land in #84; sidebar/aside/code theming from items 3.1–3.3 |
| Docs section index | `/docs/concepts/` (404 today) | `08 Docs.html` category view (`.plist`/`.prow`) | Missing entirely — item 3.4 creates them |
| Docs article | `/docs/concepts/slots/` | `08 Docs.html` article view | Title/TOC/pager themed in #84; asides, code wells, tables, version stamp → items 3.2/3.3/3.8 |
| Docs reference w/ data | `/docs/reference/model-roster-benchmark/` | `08 Docs.html` article + `ModelRoster` component | Component styles itself; verify aside/code theming doesn't fight it (it uses scoped styles) |
| KB landing | `/kb/` | `04 Blog and KB.html` KB landing | DONE (PR #70) — pixel-frozen, do not touch |
| KB article | `/kb/hardware-notes/…` | `04 Blog and KB.html` KB article | DONE — pixel-frozen invariant, verify only |
| Blog index | `/blog/` | `04 Blog and KB.html` blog index | PARTIAL: date-column list + RSS via CSS (#70); the comp's index header (h1 + intro + inline RSS) still can't render — starlight-blog hides the title panel and its `Blog.astro` isn't overridable. Item 3.9 takes one more honest swing |
| Blog post | `/blog/<slug>/` | `04 Blog and KB.html` post view | Mostly done (#70/#84: 68ch prose, mono title, byline, forum link); verify TOC stickiness + both themes |
| Blog tag/author pages | `/blog/tags/…`, `/blog/authors/…` | (no comp — inherit blog idiom) | Untouched stock starlight-blog — item 3.9 restyles to match the index |
| Changelog (unified) | `/changelog` | KB shape per operator spec | Landing from the docs-shape team (release sidebar + scroll-sync); verify against its PR, don't rebuild |
| Search modal | overlay on all Starlight pages | `01 Unified Chrome.html` ⌘K palette | Stock Pagefind → item 3.5 |
| Mobile drawer | <1000px, all Starlight pages | `01 Unified Chrome.html` drawer | Stock → item 3.6 |
| 404 page | any bad route | (no comp) | Stock Starlight — restyle minimally with tokens + mono, one line + link home; keep it boring |

Non-Starlight pages (landing, /profiles, /benchmarks, /contributing) are NOT in
this handoff's scope except for item 3.7's theme-toggle QA pass across them.

## 3. Work items (the plan)

Ordered by value/effort. Each lands as its own commit (or small PR if you split).

### 3.1 Sidebar (cheap, high visibility)
Stock Starlight sidebar with recolored tokens today. Target per `08 Docs.html`:
mono uppercase group labels (`.label` idiom, 11px, `--fg-3`), tighter row density,
amber active item with a 2px inset rail (match the KB sidebar and the drawer's
`.on` treatment in `site.css`), collapse carets subdued. Implement as a
`[data-docs]`-era global stylesheet section (Starlight sidebar sits outside the
content pane — scope via `.sidebar-pane`/`#starlight__sidebar` selectors in a new
`site-starlight.css`, imported from `global.css`; do NOT fork Sidebar components).

### 3.2 Expressive Code blocks + terminal wells
Code blocks should read as the comp's `.well`: sunken bg (`--hal0-bg-sunken`),
1px `--hal0-border`, mono 12.5px, amber ONLY on actionable tokens. Use Starlight's
Expressive Code theming hooks (`astro.config.mjs` → `expressiveCode` option:
`themes`, `styleOverrides` — codeBackground, borderColor, frames titlebar) rather
than fighting emitted CSS. Keep copy-button behavior; restyle to `.iconbtn` idiom.

### 3.3 Asides, badges, tabs
Map Starlight asides onto the status tokens from `tokens.css` (`--hal0-warn`
caution per the comp's docs article, `--hal0-info` note, `--hal0-err` danger,
`--hal0-ok` tip) with soft fills + line tints (the `-soft`/`-line` variants exist
in both themes). Badges/tabs: mono lowercase, 3px radius chips per `01 Unified
Chrome.html`'s chip row.

### 3.4 Category listing pages (`.plist`/`.prow`)
The comp's numbered row list (ordered pages, description, filename) for each docs
section. Starlight has no per-section index seam, so create `index.mdx` per
section (concepts/guides/operate/reference) rendering a shared Astro component
`<SectionPageList section="guides" />` that derives rows from
`getCollection('docs')` — never hand-maintained lists (PR #84's review already
burned one hardcoded-count claim; there is a count test to extend in
`scripts/test/`). NOTE: section landing URLs currently 404 by design when no
index page exists (`/docs/concepts/` → 404) — this item fixes that too. Check the
`/docs` redirect in `astro.config.mjs` still makes sense after.

### 3.5 Search (the big one)
Target: `01 Unified Chrome.html`'s ⌘K palette — mono result rows, source tag on
the right (docs/kb/blog for now; bench/profiles/forum are future indexes). Two
tiers, pick based on effort budget:
- **Tier A (do this):** restyle Starlight's Pagefind modal in place — dialog
  surface to `--hal0-bg-elevated` + `--shadow-menu`, mono input/rows, amber
  selected row (`--accent-soft` fill + inset rail), kbd hints. Pure CSS on
  `site-starlight.css`; keep Pagefind's behavior.
- **Tier B (only if A lands clean and time remains):** a Search component
  override adding source tags per result (Pagefind exposes the page URL — derive
  the tag from the path prefix: /docs→docs, /kb→kb, /blog→blog). Do not attempt
  cross-surface index federation (bench/profiles/forum) — that is a separate
  future workstream; leave a comment marking the seam.
Keyboard: ensure ⌘K/Ctrl+K opens it (Starlight default `/` also fine to keep).

### 3.6 Mobile Starlight menu
Starlight's mobile drawer is stock and — known gap — carries no site-level links
below 56rem (docnav hidden). Bring it to the SiteHeader drawer idiom
(`site.css` `.drawer`): full-width mono rows, amber inset active rail, site links
(flattened manifest, same list as the docnav) appended above Starlight's own page
tree, GitHub/Discord icon row at the foot. Implement via CSS + (if needed) a
`MobileMenuFooter`/`SiteTitle`-adjacent override — check Starlight 0.39's
overridable components list before choosing the seam; prefer the smallest one.
Reuse `visibleHeader` from `src/lib/nav.ts` — no hardcoded links.

### 3.7 Theme toggle unification
Starlight has a working light/dark toggle; marketing pages hardcode
`data-theme="dark"`. Unify: marketing pages read the persisted Starlight
preference (localStorage key `starlight-theme`) via a tiny inline script in
`MarketingLayout.astro` head (set attribute before paint to avoid flash), and the
light values are already AA-complete in `tokens.css`. QA both themes on: landing,
/profiles, /benchmarks, a docs page, a KB page, /blog, /changelog. The comp
README's rule: light is "a real theme, not an afterthought" — if any marketing
surface reads broken in light, fix the surface, don't re-hardcode dark (escalate
only if a surface needs real redesign).

### 3.9 Blog completion pass
Close the remaining blog gaps within the no-fork rule:
- Index header: starlight-blog's `Blog.astro` hides Starlight's title panel and
  isn't in the plugin's overridable-component exports (verified in PR #70 — check
  whether the CURRENT plugin version changed this before re-accepting the gap).
  If still closed, extend the existing progressive-enhancement route
  (`public/js/blog-rss-button.js` precedent): inject the comp's h1 + intro line
  above the post list from a small script, no-JS = current state. Document
  honestly either way.
- Tag and author listing pages (`/blog/tags/*`, `/blog/authors/*`): stock today;
  restyle to the blog index idiom (mono headings, date-column rows, chips for
  tags) via `[data-blog]`-scoped CSS — these routes render through the same
  PageFrame, confirm they receive `data-blog` (the current attribute logic keys
  on entry id prefix `blog/`; tag/author virtual routes may need the detection
  widened — check `Astro.url.pathname` fallback).
- Both themes + mobile pass on all blog page types.

### 3.8 Version stamp (small, needs content seam)
Comp's article view shows "applies to v0.5.x". Add optional `appliesTo` frontmatter
to the docs schema (`src/content.config.ts`, `z.string().optional()` — follow the
`reviewed`/`kbCategory` precedent) rendered as a mono stamp next to the title when
present. Do NOT backfill content — pages adopt it organically.

## 4. Hard constraints

- **LAYOUT BASELINE (operator mandate, 2026-08-09): every page on the site fits
  the KB page's width/layout system at minimum.** Same content measure,
  container widths, and gutter rhythm site-wide; sidebars/TOCs are arranged per
  page type but hang off the same grid — no bespoke per-page frames. Data
  surfaces (/benchmarks, /profiles) may exceed the reading measure for tables,
  but their page frame (header block, gutters, alignment) must match the KB
  geometry. When auditing any surface, put it side-by-side with a KB article in
  the browser; if it reads as a different layout system, it fails.

- **KB pages stay pixel-frozen** (the standing invariant since PR #70/#84): after
  every commit, verify built `dist/kb/**` is byte-identical (normalize hashed
  asset filenames) against a pre-change build. Same discipline PR #84's review used.
- No plugin forks (starlight-blog, Starlight internals). Component overrides via
  `astro.config.mjs` only; check the overridable-components list for your Starlight
  version before adding one.
- Everything token-driven; if a comp value has no token, add a `--hal0-*` token to
  `tokens.css` (both themes) rather than hardcoding — EXCEPT documented deliberate
  hexes (the bench lane graph hues rocm `#7fb8ff` / vulkan `#f9d884`, which
  intentionally diverge from `--hal0-dev-*`).
- Don't touch: `/benchmarks` page internals (`bench-island.ts`/`bench-view.mjs`),
  `workers/`, `src/pages/index.astro` hero, nav.json link SET (styling yes,
  contents no), the dev-preview worktree.
- Coordinate: PR #84 (docs-shape fixes) and the unified `/changelog` PR may still
  be landing — branch from master AFTER they merge, or rebase over them; they own
  `site-docs.css` / `site-blog-kb.css` / `StarlightPageFrame.astro` seams you'll
  extend.

## 5. Verification bar (every commit)

1. `npm run build` green (67+ pages).
2. `npm test` green (≥ current master count; add tests for any new pure logic —
   e.g. SectionPageList derivation, per the repo's node --test convention).
3. `npx astro check` — zero net-new errors vs master baseline.
4. KB byte-parity check (section 4).
5. Visual pass against the comp files on the local dev server (`npm run dev`),
   both themes, plus mobile width (<1000px) for 3.6.
6. Screenshot the before/after for the PR body (the repo has Playwright as a
   devDependency; a tiny script or manual capture both fine).

## 6. Delivery

One PR per coherent slice is fine (suggested: 3.1–3.3 together as "starlight
surface theming"; 3.4; 3.5; 3.6+3.7; 3.9 blog pass; 3.8 rides with any). PR bodies list
comp-fidelity gaps honestly — the review loop on this repo checks claims against
the comp CSS directly and has rejected invented values before. Do not merge
without a review pass; report PRs to the operator.

## 7. Context pointers

- Spec: `docs/superpowers/specs/2026-08-09-community-platform-design.md`
  (section 0 = unified design system; revision notes matter).
- Prior art to imitate: PR #62 (chrome v2), #70 (KB), #84 (docs shape) — read
  their diffs for the established seam patterns.
- Live dev preview (operator's): http://localhost:4322 tracks master — useful to
  compare your worktree's dev server against current production look.
- The Discourse theme repo (`Hal0ai/hal0-discourse-theme`) syncs tokens/nav from
  this repo via its `scripts/sync-from-hal0-web.mjs` — if you add tokens, note in
  the PR that the theme sync picks them up automatically (generated SCSS), no
  action needed there.
