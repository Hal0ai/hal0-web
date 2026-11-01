# hal0.dev slots-first redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild hal0.dev's landing page around named slots, add a `/releases` page, align the styling with the dashboard, generate per-profile pages, make SEO deliberate, and refresh the screenshots, as a set of independently mergeable PRs.

**Architecture:** Astro 7 static site (`output: 'static'`, Vercel adapter for API routes only). Marketing pages render through `src/layouts/MarketingLayout.astro`; landing sections become focused components under `src/components/landing/` with their data in `src/data/`. Each lane below is one branch, one worktree, one PR; lanes B and D land before C (C consumes their tokens and the Highlights helper), E2 lands after C (it converts C's figures), F and G are independent.

**Tech Stack:** Astro 7.2, Starlight 0.41, Tailwind v4 (token bridge only), Node 22 test runner (`node --test` with type stripping), `sharp` (already a dependency) for image derivatives, Playwright in the `mcr.microsoft.com/playwright:v1.64.0-noble` container for captures.

**Spec:** `docs/superpowers/specs/2026-11-01-hal0-dev-slots-first-redesign.md`. Research under `docs/superpowers/research/2026-11-01/`. Mockup (copy source for lane C): https://claude.ai/artifact/Wq42dwFGgAdYsvvLa4Nax2.

## Global Constraints

- Marketing copy is version-neutral: no "1.x", "rc", "GA", "new in" in `src/pages/*.astro`, `src/components/**`, `README.md`. Versions come from `parseChangelog(...).latestTagged`.
- Forbidden words anywhere in site copy: "unleash", "seamless", "revolutionary", "supercharge", "instantly" (for the swap), "sandboxed" (for agents), "never leak". No em-dash asides in new copy.
- Claims follow `docs/superpowers/research/2026-11-01/product-inventory.md` section 4 of the spec: no content-aware router, third-party MCP servers do not reach agents, pi needs a restart for new slots, image generation pauses GPU chat slots, LAN-open by default.
- Every internal href resolves to a built page or a redirect in `astro.config.mjs`; every `/screenshots/<name>.png` referenced exists in `public/screenshots/` or the element carries a `<!-- TODO(shots): <name> -->` comment.
- `src/styles/tokens.css` changes are add-only: no existing value changes (the forum theme copies the file).
- `scripts/sync-*.mjs` never fail the build; a failed fetch keeps the committed snapshot and prints one warning line.
- Node 22 (`.node-version`), `npm ci && npm run build && npm test` must pass; `npx astro check` has 87 pre-existing errors on master and a lane must not raise that count.
- Conventional Commits, one concern per commit, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer on every commit, PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Branch per lane, worktree under `/mnt/mintdev/worktrees/hal0-web/<branch-slug>/`, base `origin/master` at lane start, rebase before PR.

## Review Focus

1. Latest tagged release has no `### Highlights` and no bullets at all → the releases card and landing teaser show version, date and GitHub link only, never an empty list or a crash. Pinned in Task D1.
2. Visitor with JavaScript off or `prefers-reduced-motion` → the slot board renders complete at rest (models named, dots static, no hidden text), pickers are plain buttons that do nothing harmful. Pinned in Task C1.
3. Old deep links `/changelog#<slug>` → after the 301 to `/releases`, the same entry ids exist so the fragment still lands. Pinned in Task D2.
4. A `profiles.json` record missing `summary`, `author` or `history` → its page still builds with the fields omitted, not an undefined in the HTML. Pinned in Task F1.
5. Phone width (390px) on `/` and `/releases` → no horizontal overflow; no element declares `min-width` above 360px and every wide table sits in an `overflow-x: auto` wrapper. Pinned in Tasks C4 and D3 (static CSS assertion) plus the lead's visual pass.

---

## Lane B — tokens, shared card recipe, layout `jsonLd` prop

Branch `chore/style-align-dashboard`. Model: sonnet. Lands first.

### Task B0: `jsonLd` prop on MarketingLayout

**Files:**
- Modify: `src/layouts/MarketingLayout.astro` (Props interface and `<head>`)
- Test: `scripts/test/marketing-layout.test.mjs` (create)

**Interfaces:**
- Produces: `MarketingLayout` prop `jsonLd?: Record<string, unknown>[]`. When non-empty, the layout renders exactly one `<script type="application/ld+json">` in `<head>` whose content is `{"@context":"https://schema.org","@graph":[...jsonLd]}`. Lanes C and E pass their objects through it; nothing renders its own ld+json script any more.

- [ ] **Step 1: Write the failing test** — `marketing-layout.test.mjs` reads `src/layouts/MarketingLayout.astro` as text and asserts: it contains `jsonLd?:` in the Props interface, contains `'@graph'`, and contains `type="application/ld+json"` exactly once.
- [ ] **Step 2: Run** `node --experimental-strip-types --disable-warning=ExperimentalWarning --test scripts/test/marketing-layout.test.mjs` → FAIL (no `jsonLd`).
- [ ] **Step 3: Implement** the prop (default `[]`), build the graph object in frontmatter, render with `set:html={JSON.stringify(graph)}` only when `jsonLd.length > 0`. Keep every existing head element.
- [ ] **Step 4: Run the test** → PASS. Run `npm run build` → succeeds.
- [ ] **Step 5: Commit** `feat(layout): add a jsonLd prop that renders one @graph script`.

### Task B1: add-only tokens

**Files:**
- Modify: `src/styles/tokens.css` (both `:root` and `[data-theme='light']`), `src/styles/site.css` (alias block)
- Test: `scripts/test/tokens.test.mjs` (create)

**Interfaces:**
- Produces custom properties, dark / light: `--hal0-accent-bg: #2a1d00 / #fdf3d7`, `--hal0-rad-xs: 3px`, `--hal0-dur: 0.18s`, `--hal0-dur-slow: 0.22s`, `--hal0-shadow-hover: 0 6px 20px rgba(0,0,0,0.28) / 0 6px 20px rgba(0,0,0,0.10)`, `--hal0-ok-glow: rgba(111,207,151,0.35)`, `--hal0-warn-glow: rgba(232,185,78,0.35)`. Aliases in `.site`: `--accent-bg`, `--rad-xs`, `--dur`, `--dur-slow`, `--shadow-hover`.

- [ ] **Step 1: Write the failing test** — `tokens.test.mjs` parses `tokens.css` text; asserts each new property appears in the `:root` block and (`--hal0-accent-bg`, `--hal0-shadow-hover`) also in the `[data-theme='light']` block; asserts a frozen list of 12 existing tokens (`--hal0-accent`, `--hal0-bg`, `--hal0-bg-elevated`, `--hal0-fg`, `--hal0-fg-dim`, `--hal0-border`, `--hal0-rad`, `--hal0-rad-sm`, `--hal0-rad-lg`, `--hal0-ok`, `--hal0-warn`, `--hal0-err`) still carry their current values (copy the values from the file into the test).
- [ ] **Step 2: Run** the test → FAIL on the missing properties.
- [ ] **Step 3: Implement** the additions in both files.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat(tokens): add accent-bg, rad-xs, dur, shadow-hover and glow tokens`.

### Task B2: shared interactive-card recipe and chip fills

**Files:**
- Modify: `src/styles/site-data.css` (`.card-hover` recipe near `.chip`), `src/components/landing/FeaturedProfiles.astro`, `src/components/landing/BenchHighlights.astro`, `src/components/landing/LatestWriting.astro`, `src/components/landing/ForumTopics.astro`
- Test: `scripts/test/tokens.test.mjs` (extend)

**Interfaces:**
- Produces class `.card-hover` in `site-data.css`: `transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;` and on `:hover` `border-color: var(--line-strong); transform: translateY(-1px); box-shadow: var(--shadow-hover);` with a `prefers-reduced-motion: reduce` block that removes the transform. Lane C's cards use it.

- [ ] **Step 1: Extend the test** — asserts `site-data.css` contains `.card-hover` and `translateY(-1px)`; asserts the four landing components contain no `translateY(-2px)` and no literal `#6fcf97`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the recipe; replace each component's own hover rule with `class:list={['card-hover', ...]}` and token colours; amber chips in these components use `accent-soft` + `accent-line` instead of `accent-glow`.
- [ ] **Step 4: Run** test and `npm run build` → PASS.
- [ ] **Step 5: Commit** `refactor(ui): one card hover recipe and token colours in landing components`.

### Task B3: command palette polish

**Files:**
- Modify: `src/styles/site.css` (`dialog.pal`, `.pal-row.on`), `src/styles/site-starlight.css` (Pagefind modal equivalents), `public/js/site-search.js` (add the key-hint footer markup)
- Test: `scripts/test/tokens.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — `site.css` contains `.pal-foot` and `rgba(255, 176, 0, 0.05)` (amber ring) and `.pal-row.on` uses `top: 4px` / `bottom: 4px` on its stripe pseudo-element; `site-search.js` renders a `pal-foot` element with the text `↑↓ navigate · ↵ open · esc close`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (enter animation `translateY(-10px) scale(.985)` over `.18s`, guarded by reduced motion). **Step 4: Run** test + build → PASS.
- [ ] **Step 5: Commit** `feat(search): palette ring, inset active stripe and key-hint footer`. Open PR B, request review, merge on green.

---

## Lane D — releases page

Branch `feat/releases-page`. Model: sonnet. Lands before C.

### Task D1: Highlights fallback and recent/archive split

**Files:**
- Modify: `src/lib/changelog.js`
- Test: `scripts/test/changelog-version.test.mjs` (extend)

**Interfaces:**
- Produces `releaseHighlights(version: ChangelogVersion, max = 3): string[]` returning the inner `<li>` HTML strings of the `highlights` section's list, else the first bullets of the sections titled added, changed, fixed in that order, up to `max`; `[]` when none. Produces `splitReleases(versions: ChangelogVersion[], recent = 8): { recent: ChangelogVersion[], archive: ChangelogVersion[] }` where `recent` is the first `recent` tagged entries (untagged entries stay in `recent` ahead of them) and `archive` is the rest.

- [ ] **Step 1: Write failing tests** — build a changelog string with three entries: `[9.9.0]` with `### Highlights` (two bullets) and `### Fixed` (three bullets); `[9.8.1]` with only `### Fixed` (four bullets); `[9.8.0]` with an intro paragraph and no lists. Assert `releaseHighlights` returns 2 items for 9.9.0, 3 for 9.8.1 (the first three Fixed bullets), `[]` for 9.8.0; assert `splitReleases` with `recent = 2` on twelve generated entries returns 2 + 10.
- [ ] **Step 2: Run** `node --test scripts/test/changelog-version.test.mjs` → FAIL (functions undefined).
- [ ] **Step 3: Implement** both exports; extract bullets with a regex over `section.html` for `<li>…</li>` (the sections are already rendered HTML).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(changelog): highlights fallback and recent/archive split helpers`.

### Task D2: route `/releases`, redirect flip, navigation

**Files:**
- Rename: `src/pages/changelog.astro` → `src/pages/releases.astro` (git mv)
- Modify: `astro.config.mjs` (`redirects`: remove `'/releases': '/changelog'`, add `'/changelog': '/releases'`), `src/data/nav.json` (header gains `{ "label": "releases", "href": "/releases", "match": "/releases" }` between `profiles` and `forum`; footer `learn` column: `changelog` → `releases`, drop the GitHub releases line; `footerBase` changelog entry → `/releases`; `data` column `/#whats-new` → `/#releases`), every `href="/changelog"` in `src/` (grep), `README.md` pages table
- Test: `scripts/test/nav.test.mjs` (expected header list becomes `['home','docs','benchmarks','profiles','releases','forum']`, match list adds `releases`), `scripts/test/vercel-docs-redirects.test.mjs` if it asserts the old direction, new `scripts/test/releases-page.test.mjs`

- [ ] **Step 1: Write the failing tests** — update nav expectations; `releases-page.test.mjs` (build-dependent, skip when `dist/client/releases/index.html` is absent) asserts: the built file exists, `dist/client/changelog/index.html` does not exist as a page (Astro emits a redirect page containing `http-equiv="refresh"` or none), every `id="v…"` present in the committed `changelog.md`'s first eight tagged entries appears in the built HTML (same slug function as `parseChangelog`), and the file size is below 250 000 bytes.
- [ ] **Step 2: Run** `npm test` → nav tests FAIL on the header list.
- [ ] **Step 3: Implement** the rename, config, nav and link changes. `isActive` for `releases` works through `match`.
- [ ] **Step 4: Run** `npm run build && npm test` → PASS (releases-page size test may still fail until D3; that is expected, note it).
- [ ] **Step 5: Commit** `feat(releases): /releases is the canonical changelog route`.

### Task D3: page structure

**Files:**
- Modify: `src/pages/releases.astro`
- Test: `scripts/test/releases-page.test.mjs` (extend)

**Interfaces:**
- Consumes `releaseHighlights`, `splitReleases` (D1), `jsonLd` prop (B0).

- [ ] **Step 1: Extend the test** — built HTML contains one element with `data-latest-release` whose text includes `latestTagged.version`; contains exactly `min(8, tagged count)` `<details class="rel-entry"` elements; contains an `id="archive"` section listing every remaining version as a link to `releaseTagUrl(version)`; contains a `BreadcrumbList` in the ld+json graph; title is `hal0 Changelog: Release Notes for the Local AI Server` and meta description is the B7 text; no `min-width:` above 360px in the page's `<style>`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** per spec section 7 and the mockup `releases.html`: latest card (chip `latest stable`, version, date, Highlights or fallback bullets, Breaking block when a `breaking` section exists, install and `sudo hal0 update` boxes, GitHub link), channel chips line, `<details>` entries for `recent` with Highlights first then other sections, archive link grid, "unreleased" badge preserved for untagged entries. Reuse `.card-hover`, `.chip`, `.install*` classes.
- [ ] **Step 4: Run** `npm run build && npm test` → PASS including the size assertion.
- [ ] **Step 5: Commit** `feat(releases): latest card, eight recent entries, archive list`.

### Task D4: version lag and snapshot refresh

**Files:**
- Modify: `scripts/sync-changelog.mjs` (warning line on fallback: `[sync-changelog] <url> failed (<status or error>); using committed snapshot`), `src/data/changelog.md`, `src/data/release-tags.json`
- Test: `scripts/test/changelog-version.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — with `HAL0_RELEASES_URL` pointed at an unreachable port, running the sync's exported fetch function resolves to the committed data and the captured stderr contains `using committed snapshot`.
- [ ] **Step 2: Run** → FAIL (no such message). **Step 3: Implement** the message; then run `GITHUB_TOKEN=$(gh auth token) npm run sync:changelog` and commit the refreshed snapshot and tags (latest tagged must now be `v1.7.1` or newer).
- [ ] **Step 4: Run** `npm run build && npm test` → PASS; the footer shows the refreshed version.
- [ ] **Step 5: Commit** `fix(sync): warn loudly on fallback and refresh the changelog snapshot`. Open PR D, review, merge on green.

---

## Lane C — landing page rewrite

Branch `feat/landing-slots-first`. Model: opus. Starts after B and D merge (rebase onto master first).

### Task C1: `SlotBoard` component

**Files:**
- Create: `src/components/landing/SlotBoard.astro`, `src/data/slot-board.ts`
- Delete: `src/components/landing/LiveArtifact.astro`
- Test: `scripts/test/landing-page.test.mjs` (create; text assertions on the component source plus build-dependent assertions)

**Interfaces:**
- `slot-board.ts` exports `BOARD_SLOTS: { name: 'agent'|'coder'|'embed'|'img'; port: number; device: 'rocm'|'vulkan'; state: 'serving'|'ready'; profile: string; ctx?: string; models: { name: string; gb: number; note: string }[] }[]` and `BOARD_CLIENTS: { name: string; target: string }[]` (Open WebUI → `agent`, `coder`; Hermes → `hal0/agent`; pi → `agent`; Hindsight → `hal0/memory`). Model names must be real catalogue or public Hugging Face names (use the seeded defaults: `Qwen3.8 27B (UD Q4_K_XL)`, `LFM2.5 2.6B (Q8_0)`, `Qwen3.5 0.8B (UD Q4_K_XL)`, `gemma3 1B`, plus two more public GGUF names the implementer verifies on huggingface.co).
- `SlotBoard.astro` renders the board from the mockup: four `.scard` cards (dashboard recipe: 2px state stripe, sunken head and foot bars, metric row), working pickers on `agent` and `coder`, the client strip, the `/v1/models` readout, and the inline script (vanilla, no framework) implementing: toggle listbox, select option → warming dot for 1500 ms (50 ms under reduced motion) → previous state, footer text `… · clients unchanged`, readout line `same ids as before the swap`, flash `✓ no client reconfigured`.

- [ ] **Step 1: Write the failing test** — `landing-page.test.mjs` source assertions: `SlotBoard.astro` exists and `LiveArtifact.astro` does not; the component contains `.sdot.serving` styled with `var(--hal0-ok)` and `.sdot.ready` with `var(--hal0-accent)`; every `<button class="rsel"` carries `aria-haspopup="listbox"`; the script checks `prefers-reduced-motion`; no `#6fcf97` literal. Build-dependent: the built landing contains the four slot names inside `data-slot` attributes and the text `GET /v1/models`.
- [ ] **Step 2: Run** `node --test scripts/test/landing-page.test.mjs` → FAIL.
- [ ] **Step 3: Implement** the data file and component (styles scoped in the component; tokens only).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(landing): interactive slot board replaces the live artifact`.

### Task C2: section data and components

**Files:**
- Create: `src/data/landing.ts` (exports `IDEA_COLUMNS`, `ENDPOINT_MAP`, `CLIENT_DEFAULTS`, `PRIVACY_FACTS`, `WIRED_TILES`, `MEMORY_POINTS`, `CONSOLE_SHOTS`, `HARDWARE_TIERS`, `COMPARE_COLUMNS`, `COMPARE_ROWS`, `FAQ`), `src/components/landing/CompareTable.astro`, `src/components/landing/Faq.astro`, `src/components/landing/ReleaseTeaser.astro`
- Test: `scripts/test/landing-page.test.mjs` (extend)

**Interfaces:**
- `FAQ: { q: string; a: string }[]` with exactly the seven questions from spec section 6 item 12, answers from the mockup. `Faq.astro` renders `<details>` per item with `<summary>` = `q`; it also exports nothing; the page builds the `FAQPage` object from `FAQ` (so markup and schema cannot drift).
- `COMPARE_ROWS: { label: string; cells: [string, string, string, string, string] }[]` with the mockup's nine rows and the columns `['hal0','Ollama','LM Studio','llama-swap','Lemonade']`; each cell must be traceable to `competitive.md` section A (the implementer leaves a `// source: S<n>` comment per row).
- `ReleaseTeaser.astro` consumes `parseChangelog(...).latestTagged` and `releaseHighlights(latestTagged, 3)`; renders version, date, up to three bullets, link to `/releases`; renders only the version, date and link when the helper returns `[]`.
- `CONSOLE_SHOTS: { file: string; alt: string; caption: string; todo?: true }[]`; a `todo` entry renders a placeholder frame and the `<!-- TODO(shots): file -->` comment.

- [ ] **Step 1: Extend the test** — `FAQ.length === 7`; every FAQ answer is under 420 characters; `COMPARE_ROWS.length === 9` and each `cells.length === 5`; forbidden-word scan over `landing.ts` and the three components (list in Global Constraints) finds nothing; build-dependent: the built landing's ld+json graph contains one `FAQPage` whose `mainEntity` names equal the seven `<summary>` texts in order.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** → PASS (build-dependent parts pass after C3).
- [ ] **Step 5: Commit** `feat(landing): section data, compare table, faq and release teaser components`.

### Task C3: `index.astro` rewrite

**Files:**
- Modify: `src/pages/index.astro` (replace everything between the imports and the closing `</MarketingLayout>`; the `<style is:global>` block shrinks to the sections that remain page-specific: hero, idea, swap, privacy, wired, memory, console, hardware, cta)
- Test: `scripts/test/landing-page.test.mjs` (extend), `scripts/test/chrome-consistency.test.mjs` (keep passing)

**Interfaces:**
- Consumes `SlotBoard`, `CompareTable`, `Faq`, `ReleaseTeaser`, `BenchHighlights`, `ForumTopics`, `FeaturedProfiles`, `LatestWriting`, `HermesCard` (kept, with the "unattended for hours" line removed from `HermesCard.astro`), `jsonLd` prop.
- Page title `hal0: Self-Hosted Local AI Server for AMD Strix Halo`; meta description from `site-audit.md` B7; `jsonLd` = `[softwareApplication, faqPage]` where `softwareApplication` adds `image`, `screenshot` (absolute URLs of the console shots that exist), `featureList`, `softwareRequirements: 'Linux x86_64, Python 3.12+, systemd, podman'`, `releaseNotes: 'https://hal0.dev/releases/'`, `installUrl: 'https://hal0.dev/install.sh'`, `publisher: { '@id': 'https://hal0.dev/#org' }`, `softwareVersion` from `latestTagged`.

- [ ] **Step 1: Extend the test** — build-dependent: exactly one `<h1>` with text `Own Your Inference`; section ids present in order: `idea, swap, privacy, wired, memory, console, hardware, compare, benchmarks, releases, faq, get`; every `/screenshots/*.png` referenced exists on disk or the HTML contains `TODO(shots)` for that name; no `href="/changelog"`; the page contains the strings `one API, one slot per medium`-equivalent heading `One giant model is the wrong shape for a home box.` and `Swap the model, keep the name.`; word count of visible text between 1 600 and 2 400; no `min-width:` above 360px in inline styles.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the page per spec section 6 and the mockup, section by section; copy comes from the mockup with these edits: remove the review notes and banner; "research" appears only as an example custom slot; the hardware row and compare table are components. The runner catalogue, six hardware cards, feature grid, use-case cards, agent tiles and the what's-new grid are deleted along with their CSS.
- [ ] **Step 4: Run** `npm run build && npm test` → PASS; `npx astro check` error count ≤ 87.
- [ ] **Step 5: Commit** `feat(landing): rewrite the page around named slots`.

### Task C4: responsive and motion pass

**Files:**
- Modify: `src/pages/index.astro`, `src/components/landing/SlotBoard.astro`
- Test: `scripts/test/landing-page.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — every `grid-template-columns: repeat(` rule in the landing CSS has a matching rule inside a `@media (max-width:` block that sets a smaller count or `1fr`; the compare table wrapper has `overflow-x: auto`; the page contains a `@media (prefers-reduced-motion: reduce)` block.
- [ ] **Step 2: Run** → FAIL on any gap. **Step 3: Implement** the breakpoints (1080px, 720px, 560px as in the mockup). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `fix(landing): phone layouts and reduced-motion guards`. Open PR C; reviewer on opus checks every claim against `product-inventory.md`; merge on green.

---

## Lane E1 — SEO foundation (non-landing pages)

Branch `feat/seo-foundation`. Model: sonnet. Independent of C (rebase on master before PR).

### Task E1.1: titles and descriptions

**Files:**
- Modify: `src/pages/benchmarks.astro`, `src/pages/profiles.astro`, `src/pages/profiles/submit.astro`, `src/pages/contributing.astro`, `src/pages/404.astro` (if present; else the Starlight 404 via config), `src/content/docs/blog/*.mdx` (add `description:`; shorten `title:` so `title | hal0` ≤ 60 chars), `astro.config.mjs` (Starlight `description` for the blog)
- Test: `scripts/test/seo.test.mjs` (create, build-dependent)

- [ ] **Step 1: Write the failing test** — for every `dist/client/**/index.html` outside `/profiles/submitted/`: `<title>` length ≤ 60, `<meta name="description">` present, length 50..155, and not equal to `Local AI for your home. Strix Halo native.`; blog post descriptions differ from each other.
- [ ] **Step 2: Run** `npm run build && node --test scripts/test/seo.test.mjs` → FAIL. **Step 3: Implement** with the B7 values. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(seo): per-page titles and descriptions`.

### Task E1.2: site-wide structured data and head hygiene

**Files:**
- Modify: `src/layouts/MarketingLayout.astro` (Organization `@id https://hal0.dev/#org` with `logo` `/brand/logo-halo-dark.png`, `sameAs` GitHub org, Discord invite from `nav.json`, forum; WebSite; both always prepended to the `@graph`; `<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">`; `og:locale`; `theme-color` with `media` for light and dark), `src/pages/benchmarks.astro` (Dataset via `jsonLd`, `dateModified` = `ROSTER_DATE`, `BreadcrumbList`), `src/pages/profiles.astro`, `src/pages/contributing.astro`, `src/pages/releases.astro` (BreadcrumbList each)
- Test: `scripts/test/seo.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — every marketing page's ld+json parses; its `@graph` contains an `Organization` with three `sameAs` entries and a `WebSite`; inner pages contain a `BreadcrumbList` with two items; benchmarks contains a `Dataset` whose `dateModified` equals `ROSTER_DATE`; every page head has the RSS alternate link.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(seo): organization, website, breadcrumb and dataset markup`.

### Task E1.3: icons, manifest, llms.txt

**Files:**
- Create: `scripts/build-icons.mjs` (sharp: `public/favicon.svg` → `public/icons/apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`; runs in `prebuild`), `public/site.webmanifest`, `public/llms.txt`
- Modify: `package.json` (`prebuild` chain), `src/layouts/MarketingLayout.astro` and `astro.config.mjs` head (apple-touch-icon → the 180px file; `<link rel="manifest">`)
- Test: `scripts/test/seo.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — the three icon files exist after build with the expected pixel sizes (read the PNG header); `site.webmanifest` parses and names both icons; `llms.txt` mentions `hal0.dev/releases`, `forum.hal0.dev`, `/benchmarks`, `/profiles`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`llms.txt` content: product summary in six lines, key URLs, docs pointer). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(seo): icon set, web manifest and llms.txt`. Open PR E1, review, merge.

## Lane E2 — image pipeline

Branch `feat/seo-images`. Model: sonnet. Starts after C merges.

### Task E2.1: derivatives and `Shot` component

**Files:**
- Create: `scripts/build-images.mjs` (sharp: for every `public/screenshots/*.png` and `public/agents/hermes.png`, write `.avif` and `.webp` siblings when missing or older than the PNG; resize `hermes.png` to 744px wide into `hermes-744.png` plus derivatives), `src/components/Shot.astro`
- Modify: `package.json` (`prebuild`), `.gitignore` (derivatives are build artefacts, not committed), `src/pages/index.astro` and `src/content/docs/blog/*.mdx` figures → `<Shot name="…" alt="…" width height caption />`
- Test: `scripts/test/images.test.mjs` (create)

**Interfaces:**
- `Shot.astro` props `{ name: string; alt: string; width?: number; height?: number; caption?: string; loading?: 'lazy'|'eager' }` renders `<figure class="shot">` with `<picture>` (avif, webp, png sources with `1x, 2x` descriptors when the `@2x` PNG exists) and an optional `<figcaption>`.

- [ ] **Step 1: Write the failing test** — after build, for each landing screenshot the `.avif` and `.webp` exist and are smaller than the PNG; the built landing HTML contains `<picture>` for every console shot and no bare `<img src="/screenshots/` outside `<picture>`; `hermes-744.png` width is 744.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** `npm run build && npm test` → PASS.
- [ ] **Step 5: Commit** `perf(images): avif and webp derivatives through a Shot component`. Open PR E2, review, merge.

---

## Lane F — per-profile pages

Branch `feat/profile-pages`. Model: sonnet. Independent.

### Task F1: `/profiles/<slug>/`

**Files:**
- Create: `src/pages/profiles/[slug].astro`
- Modify: `src/pages/profiles.astro` (h2 `Community profiles for Strix Halo and local LLMs` above the grid; card title links to the page; `?p=` deep links keep opening the drawer), `scripts/build-og.mjs` (no change if cards already exist per slug; verify)
- Test: `scripts/test/profile-pages.test.mjs` (create)

**Interfaces:**
- `getStaticPaths` from `profilesSnapshot.profiles` using `record.profile.slug`; page title `<profile.title> · llama.cpp profile | hal0` trimmed to 60; description from `profile.summary` trimmed to 155 or a generated sentence when absent; `ogImage` `/og/profiles/<slug>.png` when that file exists else the index card; content: title, intent chip, model id and compatible list, runner lane and min build, raw args in a code block, history list, author, links to the gallery and the submit page; `jsonLd` = `[BreadcrumbList, SoftwareSourceCode]`.

- [ ] **Step 1: Write the failing test** — build-dependent: for every slug in `profiles.json` the page exists; title ≤ 60; description present; canonical `https://hal0.dev/profiles/<slug>/`; sitemap lists each; plus a unit test that renders the description helper with a record lacking `summary`, `author` and `history` and gets a string with no `undefined`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(profiles): a static page per community profile`. Open PR F, review, merge.

---

## Lane G — screenshot pipeline and capture

Branch `chore/screenshot-pipeline`. Model: sonnet for G1; the lead runs G2.

### Task G1: script updates

**Files:**
- Modify: `scripts/capture-screenshots.mjs` (`--out <dir>` flag overriding `OUT_DIR`; per-shot optional `url` so a shot can target Open WebUI on `:3001`; selector fixes: `dashboard-overview` → `.ov-mem-seg`, `unified-memory-hero` → clip `.ov-now`, `image-gen-comfyui` → `image-gen-pane`; retire `mtp-control`, `requests-latency-widget`; add `openwebui-picker`, `openwebui-chat`, `image-gen-models`, `image-gen-generate`, `approvals-inbox`, `dock-gpu`, `overview-now`, `memory-reflect`, `settings-doctor` per spec section 10 with the routes there), `scripts/capture-screenshots.sh` (`--network host`, pass `--out`)
- Test: `scripts/test/capture-screenshots.test.mjs` (extend)

- [ ] **Step 1: Extend the test** — `SHOTS` contains the new ids and not the retired ones; every shot has `route` or `url`, `file`, and `expect`; `parseArgs(['--out','/tmp/x'])` returns `{ out: '/tmp/x' }`; no two shots share a `file`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `chore(shots): out flag, per-shot urls, new surfaces, selector fixes`. Open PR G1, review, merge.

### Task G2: capture (lead, gated on the operator bringing CT150 up on stable with the public-safe seed)

- [ ] **Step 0 (operator only, Proxmox host):** CT150 is stopped with its memory still set to 108000 MB (raised from 49152 on 2026-10-30); the host has 124 GB with about 90 GB in use while CT150 is down, and the last start at 108 GB was followed by a host hard reset 46 s later. Before starting it: `pct set 150 -memory 49152` (or lower) and check `free -g` on the pve host. Agents never run `pct`. Ping the hal0 orchestrator session before the start so it can quiesce its test lanes.
- [ ] **Step 1:** verify the box: `ssh` alias reachable, `hal0 --version` is the stable tag, slots loaded per spec section 10, no private names in `#slots/stacks`, `#benchmarks`, `#memory/bank`, `#mcp`.
- [ ] **Step 2:** run `scripts/capture-screenshots.sh --out <scratch dir>` with `HAL0_ADMIN_KEY` from the box's service environment (never printed), review every PNG by eye for hostnames, keys, model, stack and tag names.
- [ ] **Step 3:** copy approved PNGs into `public/screenshots/`, replace each `TODO(shots)` in `src/pages/index.astro`, `src/data/landing.ts` and the blog, delete unreferenced retired files, run `npm run build && npm test`.
- [ ] **Step 4:** Commit `feat(shots): re-capture the console on the current stable`, PR, review, merge.

---

## Lane H — forum theme header mirror

Repo `/home/mint/projects/hal0-discourse-theme`, branch `feat/header-releases`. Model: sonnet. Starts after D merges.

### Task H1: add `releases`

- [ ] **Step 1:** find the header list mirror (`grep -rn "benchmarks" --include=*.js --include=*.hbs --include=*.json --include=*.scss`), add `releases` → `https://hal0.dev/releases` between `profiles` and `forum`, and copy hal0-web's `src/styles/tokens.css` over the theme's copy (add-only diff expected).
- [ ] **Step 2:** run the theme's test or lint command if one exists; build if applicable.
- [ ] **Step 3:** Commit `feat(header): add releases to the shared navigation`, PR, review, merge; note the deploy step for the operator if the theme is not auto-deployed.

---

## Lane S — dependency security bump (Wave 0, parallel with B and D)

Branch `chore/deps-security`. Model: sonnet.

- [ ] **Step 1:** `npm audit --json` in the root and in `workers/bench-api`; list the advisories (undici, vite, devalue, fast-uri, svgo, astro ≤ 7.3.2, vitest/@vitest/mocker, extract-zip).
- [ ] **Step 2:** bump through `overrides` in `package.json` only where a direct bump is not possible; `npm install`, then `npm run build && npm test` in root and `npx vitest run` in `workers/bench-api`.
- [ ] **Step 3:** `npm audit` shows zero critical and zero high; commit `chore(deps): resolve dependabot advisories`, PR, review, merge on green.

---

## Order of merges

S, B, D (parallel) → C (rebased on B + D) and E1, F, G1 (parallel with C) → E2 and H (after C and D respectively) → G2 when the box is ready. Final: lead's visual pass at 1440 and 390 widths on `/`, `/releases`, `/benchmarks`, `/profiles/<slug>/` from the Playwright container, Lighthouse spot check, then a blog post lane if the operator wants it.
