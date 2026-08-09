# Handoff: hal0.dev community platform

## Overview

hal0.dev is expanding from a release/docs site into a community platform: a live
benchmarks section, a shared profile (config) registry, a blog + knowledge base,
and a Discourse forum at `forum.hal0.dev`. This package contains the design for
all of it, plus the unified chrome every surface shares.

The single non-negotiable: **one site, not four.** Landing, docs, blog, KB,
benchmarks, profiles and the forum share identical header, footer, nav, colour,
typography and logo usage. The chrome is authored once (`site-chrome.jsx`) and
reused verbatim by every page in this bundle — do the same in the real build.

Implementation target is the existing stack: **Astro 6 + Starlight + Tailwind v4**,
static-first, with client-hydrated islands for the interactive data surfaces.
The forum is **Discourse**, themed — not rebuilt.

## About the design files

The files in this bundle are **design references written in HTML/CSS/React-via-Babel**.
They are prototypes showing intended look and behaviour, not production code to
copy. The task is to **recreate these designs in the hal0-web codebase** using its
established patterns: Astro components, Starlight layouts, Tailwind v4 utilities and
the `--sl-color-*` / `--hal0-*` token bridge already in `src/styles/global.css`.

Two things in the bundle are already grounded in that repo and should be treated as
source of truth rather than re-derived:

- Capability glyphs, decode-speed buckets and the roster legend are lifted verbatim
  from `src/components/ModelRoster.astro`.
- The homepage hero panel mirrors `src/components/landing/LiveArtifact.astro` —
  same slots, states, ports, animation cadence and memory bar.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, states and copy. Recreate the
UI closely, using the codebase's existing tokens and components where they exist.
The one exception is section 4 of the original brief (the submission flow), which was
not built — see *Not designed yet*.

---

## Design tokens

All values resolve to CSS custom properties. Dark is default; light is a real theme,
not an afterthought — every component was contrast-checked in both.

### Colour — dark (default)

| Token | Value | Use |
|---|---|---|
| `--accent` | `#ffb000` | sodium amber. Live / primary / actionable. Never decoration. |
| `--accent-hover` | `#ffc533` | hover goes *lighter*, never darker |
| `--accent-muted` | `#7a5500` | low-emphasis amber |
| `--accent-soft` | `rgba(255,176,0,0.10)` | fill behind amber chips, active pills |
| `--accent-line` | `rgba(255,176,0,0.34)` | amber border |
| `--accent-glow` | `rgba(255,176,0,0.18)` | selection, glow |
| `--bg` | `#0a0a0a` | page |
| `--bg-1` | `#141414` | cards, panels, header fill |
| `--bg-2` | `#161616` | row hover |
| `--bg-3` | `#1c1c1c` | tracks, wells |
| `--bg-sunken` | `#050505` | terminal wells, footer |
| `--fg` | `#f5f5f4` | primary text |
| `--fg-2` | `#c8c2bd` | secondary |
| `--fg-3` | `#a3a09c` | tertiary / labels (AA floor for small text) |
| `--fg-4` | `#5c5c58` | quaternary — **decorative only, never small body text** |
| `--fg-5` | `#3d3d3a` | separators-as-text |
| `--line` | `#262626` | default hairline |
| `--line-soft` | `#1c1c1c` | inner dividers |
| `--line-strong` | `#3a3a3a` | hover border |

Status: `--ok #6FCF97` · `--warn #E8B94E` · `--err #EF6B6B` · `--info #7FB8FF`,
each with a 10 % soft fill and 30 % line tint.

Device / lane hues (load-bearing — a lane reads the same colour in a chip, a table
cell and a chart legend): `--dev-rocm #D76B6B` · `--dev-vulkan #7FB8FF` ·
`--dev-npu #C896FF` · `--dev-cpu #9C9C95`.

Decode buckets (from `ModelRoster.astro`): `--fast #3fb950` · `--mid` = the amber
accent · `--slow #f85149`.

Memory-map palette is Okabe–Ito, colour-blind safe: `--mem-slot-1…8`.

### Colour — light overrides

Applied on `[data-theme="light"] .site`:

`--bg #fafaf9` · `--bg-1 #ffffff` · `--bg-2 #f3f2f0` · `--bg-3 #ebe9e6` ·
`--bg-sunken #f0eeea` · `--fg #1c1917` · `--fg-2 #44403c` · `--fg-3 #6b6660` ·
`--line #e7e5e4` · `--line-strong #cfccc8` · `--accent #b87800` (AA on white) ·
`--fast #1a7f37` · `--slow #cf222e` · `--ok #1a7f37` · `--warn #8a5a00` ·
`--err #cf222e` · `--info #1f5fbf` · `--dev-rocm #a32e2e` · `--dev-vulkan #1f5fbf` ·
`--dev-npu #6b3fbf` · `--dev-cpu #5c5c58`.

The dark device/status hues are tuned for a dark field and fail AA on white — the
light overrides above are required, not optional.

### Typography

- `--jbm` JetBrains Mono — every identifier, number, state, label, route, metric,
  nav item, and all display/title type.
- `--geist` Geist Variable — prose only: paragraphs, descriptions, card summaries.
- Geist runs `cv11`/`ss01`; mono runs `zero`/`ss02`; anything that ticks gets
  `font-variant-numeric: tabular-nums` + `"zero" 1, "tnum" 1`.
- Weight tops out at **600**. Emphasis comes from colour and mono, not weight.

Site reading scale (added on top of the dashboard's dense scale):

| Class | Size / line-height | Use |
|---|---|---|
| `.site-h1` | `clamp(28px, 4vw, 38px)` / 1.12, `-0.03em`, mono | page titles |
| `.site-h2` | 22px / 1.2, `-0.02em`, mono | section titles |
| `.site-h3` | 16px / 1.3, 600, Geist | card titles |
| `.site-body` | 15px / 1.6, `--fg-2` | body copy |
| `.site-sm` | 13px / 1.55, `--fg-3` | secondary copy |
| `.eyebrow` | 10px mono, uppercase, `0.1em`, `--fg-3` | classifiers |
| `.label` | 11px mono, uppercase, `0.1em`, `--fg-3` | field/section labels |

Long-form prose (blog, KB, docs) steps up: 15.5–16px body, 1.68 line-height,
68–74ch measure. Homepage hero: `clamp(38px, 4.6vw, 60px)` mono at `-0.035em`.

### Spacing, radius, motion

- Spacing scale: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 40 · 56 px.
- Radii: 2 (tags) · 4 (buttons, fields) · 6 (inputs, menus) · 10 (cards) ·
  14 (feature cards) · 999 (status pills, filter pills only).
- Borders are always 1px hairlines. **Cards never carry shadow** — only genuinely
  floating layers do (menus `0 16px 48px -8px rgba(0,0,0,.7)`, drawers
  `-24px 0 64px -16px rgba(0,0,0,.6)`).
- Motion: one easing `cubic-bezier(0.22, 1, 0.36, 1)`; durations 0.12 / 0.18 / 0.22s.
  `pulse` (opacity 1↔0.4, 1.2s) is the only loop, reserved for live state dots.
- Layout container: `.wrap` max 1280px, `.wrap.wide` 1440px, `.wrap.read` 760px,
  24px gutters (16px under 640px).

---

## The unified chrome

`site-chrome.jsx` + the `.hdr` / `.ftr` / `.subnav` rules in `hal0-site.css`.
In Astro this is `SiteHeader.astro` / `SiteFooter.astro` / `SubNav.astro`, and a
Discourse **theme component** injecting the same markup into
`above-main-container` / `below-footer`.

### Header

56px tall, sticky, `rgba(10,10,10,0.85)` + 12px backdrop blur. Its signature is the
**filament**: a 1px bottom hairline that brightens to sodium amber at the centre
(`linear-gradient(90deg, transparent, --line 18%, mix(accent 70%, line) 50%, --line 82%, transparent)`)
with a faint amber under-glow `0 1px 14px rgba(255,176,0,0.09)`. On the landing page
the bar starts transparent (`.ontop`, filament at 35 % opacity) and promotes to solid
past 40px of scroll. Carry the motif to every surface, forum included.

- Left: inline-SVG wordmark at 19px (Monomaniac One "hal" + amber slashed "0"). Never
  an `<img>` screenshot of it. Links home.
- Nav: `learn · benchmarks · profiles · forum` — lowercase JetBrains Mono 12.5px,
  `--fg-3`, hover `--fg`. Active: `--accent` + `aria-current="page"` + a 2px amber
  rail sitting on the filament (`left/right: 11px`, `bottom: -1px`). Forum carries `↗`
  because it is another host, and still highlights when you are on it.
- Right (site): search button (30px, `--bg-1`, mono placeholder "search hal0", `⌘K`
  key cap), 1px separator, GitHub, Discord, theme toggle. Signed in via Discourse SSO
  adds a notification bell with an amber pip and a 22px avatar — **on hal0.dev too**,
  not only on the forum.
- Right (forum variant): the same shell, with Discourse's own controls — topic search
  (`/` key cap), GitHub, theme toggle, notifications, account avatar, `new topic`
  primary button. A mono `forum` slug sits beside the wordmark, separated by a 1px
  rule, so the host change is legible without breaking the lockup.
- Below 1000px: nav and desktop-only utilities hide, a burger appears, and the drawer
  slides down from the header — full-width rows at 15px mono, active row carrying an
  amber inset rail and `--accent-soft` fill, footer row with GitHub / Discord / theme /
  search.

Sub-nav: a second 42px bar under the header for sections with more than one surface.
`learn` → docs · knowledge base · blog · changelog. `benchmarks` → leaderboard ·
evals · hardware · methodology · profiles · share your results. Keep the top nav at
four items; everything else hangs off a sub-nav.

### Footer

Identical on every surface including the forum. `--bg-sunken` with a top hairline.
Brand column (wordmark, one-sentence description, GitHub/Discord/RSS icon buttons) +
three link columns — **learn** (docs, knowledge base, blog, changelog, releases),
**community** (forum ↗, discord ↗, github ↗, contributing, hello@hal0.dev), **data**
(benchmarks, profiles, share a run, hardware notes, roadmap). Base line in 11px mono:
`Apache-2.0 · hal0 v0.5.0a1 · 1.0.0-RC.3` on the left, a live status dot and
"all systems steady" on the right. Version strings must match `BINARY` in
`src/data/model-roster.ts` and the hero release pill — never invent one.

### Shared primitives

- **Buttons** `.btn`: 30px tall, 4px radius, mono 12px. One solid amber button per
  view (`background: --accent; color: #0a0a0a`); everything else `.ghost` (transparent,
  `--line` border, `--fg`). `.sm` 26px, `.lg` 36px, `.danger` for destructive.
  Hover brightens 1.06; press nudges down 0.5px. A link styled as a button must keep
  the near-black label — `.site a.btn { color: #0a0a0a }`.
- **Chips** `.chip`: 3px radius, lowercase mono 10px. Variants `amber`, `ok`, `warn`,
  `err`, `info`, and `dev-rocm` / `dev-vulkan` / `dev-npu` / `dev-cpu`.
- **Filter pills** `.fpill`: 26px, true pill, mono 11.5px, optional count in `--fg-4`.
  Active = `--accent-soft` fill + `--accent-line` border + amber text.
- **Status dots** `.dot`: 7px circle. `ready` solid green with an 8px glow,
  `serving`/`warming` add the pulse, `error` red, `offline` grey. Glow reads as an LED,
  not elevation.
- **Data table** `.dtable`: mono 12.5px, 40px rows, uppercase 10px headers on a
  1px rule, numeric columns right-aligned with tabular slashed-zero numerals, sorted
  header in amber with ▼/▲, row hover `--bg-2`, model column sticky-left.
- **Terminal well** `.well`: `--bg-sunken`, 1px border, mono 12.5px, amber only on the
  token you can act on (the `hal0` binary name).

---

## Screens

### 1. Unified chrome sheet — `01 Unified Chrome.html`

Not a product page: the component sheet. Header (default, active, landing-transparent,
forum, mobile collapsed, mobile drawer open), sub-nav, footer, ⌘K search palette,
buttons, filter pills, chips, status badges, attribution, the three card shapes, table
and terminal well. Use it as the acceptance reference for the chrome.

### 2. Benchmarks — `02 Benchmarks.html`

**Purpose:** "what does this model do on my box", answered from community + first-party
runs.

Layout, top to bottom:

1. Page header — eyebrow, `benchmarks` h1, 60ch intro, `methodology` (ghost) +
   `share your results` (primary).
2. Two context cards, 50/50: **hardware** and **binary** — `dl` grids at mono 11.5px,
   88px label column, values truncated with a `title`. Content comes from `HARDWARE`
   and `BINARY` in `src/data/model-roster.ts`.
3. Tabs: `leaderboard` / `evals`.
4. **Filter bar** — segmented controls, not a wall of pills: workload (tg · pp · chat ·
   batch · embed · rerank · reuse), depth (512 · 2048 · 8192 · 16384), variant
   (default · b1024 · kv-q8 · mtp-off), lane (best · rocm · vulkan_radv · default),
   plus capability filter pills and a model text filter. **The default view is
   opinionated: tg @ depth 2048, `default` variant, best lane per model** — one row per
   model, not every cell. A `reset to default view` button and a link to
   `api.hal0.dev/v1/bench` close the bar.
5. **Freshness badge** in the table header: live (`--ok` pulsing dot,
   "live · api.hal0.dev, 4 min ago") or snapshot (amber-warn pill, "snapshot from
   2026-06-19 · api unreachable"). The page renders the build-time snapshot first and
   upgrades when the API answers — there is always a table on screen.
6. **Leaderboard table** — columns: model (sticky, id + HF repo beneath), caps,
   params, kv · spec, lane chip, decode tok/s, prefill, ttft p50, p95, accept %, gb,
   trend sparkline. Every header sorts. Row click opens the run drawer.
   - **Capability glyphs** — lift the five `ICONS` paths verbatim from
     `ModelRoster.astro`: `mtp` filled bolt `M8.7 1 3 9h3.6l-1 6 6.4-8H9.1z`,
     `reasoning` filled sparkle `M8 1l1.5 4.3L14 7l-4.5 1.7L8 13l-1.5-4.3L2 7l4.5-1.7z`,
     `vision` / `tools` / `coding` as 1.4-stroke paths. Tints: `cap-mtp` amber,
     `cap-vision` `#6cb6ff`, the rest neutral. Each carries its label as a tooltip.
   - **Decode buckets** — fast ≥60, mid ≥25, slow <25, coloured `--fast` / amber /
     `--slow`, and *additionally* encoded as a three-segment meter (3/2/1 filled) plus a
     visually-hidden bucket word, so meaning is never colour-alone. Legend under the
     table uses the roster's own wording: "≥60 t/s · 25–60 · <25 · … · Click any header
     to sort."
   - **Sparkline** — 62×18 polyline of the last six sweeps, `--fg-4`, last point amber;
     a regression (any drop >10 % against the previous sweep) turns the line
     `--warn` and marks the dip.
7. **Run drawer** — recommended over a dedicated page, with a deep-linkable URL
   (`?run=<id>`) so it is shareable and server-renderable. 580px, right-anchored,
   scrim behind. Sections: four headline metrics; identity (engine, lane, variant,
   workload + depth, kv, speculative, llama.cpp build, image digest, GGUF sha256, reps
   ± sd); resolved flag string in a well with a copy button; host + telemetry (GPU,
   platform, ROCm, RAM, VRAM peak, GTT peak, max edge temp, avg power) with a
   **throttle banner** when the run throttled — "Numbers are a floor, not a ceiling";
   history sparkline at 480×72 with a regression note; provenance + actions (download
   profile TOML, download bundle, link to this run).
8. **Evals tab** — same table idiom: model, caps, decode (bucket meter), one column per
   task with a 64px score bar (green ≥0.75, red <0.40) and the 0–1 value, then the mean.
   Models with nothing to test read "not evaluated — no tool/coding claim to test".
   This is how a 105 tok/s model that fails tool-calling stays legible at a glance.
9. **States** — degraded/snapshot, loading skeleton (shimmering bars in real row
   geometry, inside a horizontal scroller so it cannot blow out its column), and empty
   ("No runs for this combination", naming what the sweep does cover, with a reset).
10. **Mobile** — recommendation is a pinned model column with the rest scrolling
    horizontally, **not** card collapse: comparing two models on one metric is the whole
    job. Filters collapse behind a `filters · 3` button and a `sort · decode` button.

### 3. Profiles — `03 Profiles.html`

**Purpose:** find the config for your model, install it, read what it trades.

- **Filter bar**: model family pills (derived from roster ids — qwen3, qwen3-coder,
  chadrock, qwopus, gemma, hermes), intent pills (chat · coding · agent · vision ·
  draft · moe), lane pills, and a **model-name search** ("qwen3.5-9b, gemma-4-26b").
  Empty state offers submission rather than a dead end.
- **Card** (the anatomy is specced on the page itself): eyebrow `profile · v4 · rocm`,
  intent chip, **21px mono slug**, one-line description, then `runs these models` —
  chips showing family in amber + shortened model name, first two plus a count. Below
  that three metrics — decode (with bucket meter), prefill, first token — and a mono
  footnote naming the exact model, depth and lane those numbers came from. Attribution
  and `config & flags →` close the card. A 2px filament along the bottom edge brightens
  on hover, matching the header and OG cards.
  - **The metrics are a join, not a field.** They are not in the TOML: they come from
    `hal0-bench-data` matched on profile slug, and the card must only ever show a number
    one of that profile's own runs produced. If the join is unavailable at build time,
    render the card without the metric row rather than with a stale or borrowed figure.
- **Drawer**: summary, actions (download TOML, copy flags, install with hal0), the
  install command in a well, the flag string, the syntax-highlighted TOML, **the runs
  this config produced** (the join, shown as a small table), and per-profile version
  history from real data — never a generic changelog.

### 4. Blog + knowledge base — `04 Blog and KB.html`

- **Blog index**: reverse-chronological, 132px date column, lead post at 30px, RSS
  button. Dated, authored, "what changed and when".
- **Post**: 68ch prose column + sticky TOC, byline with attribution and a
  "discuss on the forum ↗" link.
- **KB landing**: six category cards (getting started, hardware notes, runtime &
  backends, models & quants, operating hal0, tool reviews) with an icon, blurb and the
  first four page links. Evergreen — a *reviewed* stamp, never a post date.
- **KB article**: docs-style three columns (category sidebar, prose, TOC + related).
- **The distinction is specced on the page**: docs are versioned reference owned by
  maintainers; blog is dated and authored; KB is undated, reviewed and community-editable.
  Same chrome, same type — only the surface tag, the stamp and the shell differ.

### 5. OG card template — `05 OG Card Template.html`

One 1200×630 template, five fills (blog, KB, benchmark cell, profile, fallback).
Fixed 64/72px padding; wordmark top-left at 40px; amber eyebrow with a glowing dot
top-right; title in mono 62px dropping to 50px past ~28 characters (truncate, never
shrink further); Geist 26px subtitle at 44ch; mono meta bottom-left; a single amber
76px figure bottom-right that **only bench and profile cards fill** — blog and KB leave
it empty rather than inventing a metric; 4px filament along the bottom edge.
Generated at build time by `scripts/build-og.sh`; pages without a fill use
`/og-default.png`.

### 6. Homepage — `06 Homepage.html`

Keeps the existing marketing hero character: amber release pill, mono headline with
`/v1/*` in amber, body copy, `install.sh` terminal block with a copy button, primary +
ghost CTAs with an `Apache-2.0 · Linux · systemd` meta line, and the status ribbon.
The right column is the live slot panel — rebuild from `LiveArtifact.astro`, not from a
screenshot: six slots (agent, embed, rerank, stt, tts, img) with their real models and
ports, `serving` / `ready` / `idle` states, tok/s only when serving, an 18-bar
sparkline per row, the four-segment GTT bar with legend, and the dispatch p50 block —
all on the same 900 ms sine tick, disabled under `prefers-reduced-motion`.

Then the community layer, in order: the three existing feature cards; **headline bench
figures + top-5 table**; **latest forum topics**; **featured profiles**; **latest blog +
KB**. The forum strip degrades by being **omitted entirely** when the API is unreachable
at build time — no skeleton, no error card; the page closes up and the footer still
links the forum. A toggle on the page previews that state.

### 7. Forum — `07 Forum.html`

Three views, all wearing the chrome:

- **Topic list** — Discourse's control bar (all categories ▾, all tags ▾, latest · new ·
  unread · top · categories, + new topic), category filter pills, then rows: title with
  pinned/solved markers, category dot + tags beneath, overlapping poster avatars,
  replies (or an amber unread pill), views, activity. Sidebar pulls hal0.dev content in
  — latest post, a profile with its bench number, a KB page — plus categories and a
  "box of the week".
- **Categories index** — the classic two-column page: category rows with a 4px colour
  rail, description, subcategory dots and `N / month` + `x new`; Latest stream on the
  right.
- **Category** — colour rail header, description, stats, latest/top/unsolved tabs, tag
  filters, filtered list.
- **Topic** — post stream with 40px avatars, role chips (maintainer / original poster),
  markdown body with code blocks and quotes, per-post actions, and an accepted-answer
  treatment (green inset rail + tinted wash) that **derives from the topic's solved
  state** — unsolved threads read "no accepted answer yet". Right rail carries the
  Discourse timeline scrubber, participants, "referenced here" cross-links and suggested
  topics.

Split of responsibility, specced at the bottom of the page: header/footer/palette ship
as a **theme component**; topic rows, badges, tags, unread pills and avatars are
Discourse's own components restyled through its CSS variables; composer, notifications,
moderation, search and user cards stay **native** — that is where forks turn into
maintenance.

### 8. Docs — `08 Docs.html`

Starlight three-column shell. Sidebar mirrors `src/content/docs/docs/` exactly —
getting started (8) · concepts (8) · guides (12) · operate (3) · reference (9 + api 4).
Three views: landing (intro copy, "Start here" link cards, caution Aside, section
cards), category listing (ordered pages with descriptions and file names), and an
article (the slot-lifecycle reference: state table, ASCII diagram, transitions table,
caution Aside, pager, TOC, and a version stamp "applies to v0.5.x").

---

## Interactions & behaviour

- **Sorting** — any table header; toggles asc/desc, sorted header amber with ▼/▲.
  Numeric columns sort on the raw value, text via `localeCompare`.
- **Filtering** — AND across facets, OR within a facet. `best lane` reduces to one row
  per model by max decode. Counts on pills reflect the full corpus, not the filtered one.
- **Drawer** — opens on row click, closes on scrim click or ✕. Should own a URL so it is
  linkable and server-renderable.
- **Theme toggle** — sets `data-theme` on `<html>`; persist the choice.
- **Copy actions** — flag strings, install commands, the `install.sh` line. Button label
  swaps to "copied" for 1.4s.
- **Animation** — the hero panel ticks every 900 ms (tok/s jitter, sparkline heights,
  memory, dispatch p50) and is disabled entirely under `prefers-reduced-motion`.
- **Responsive** — chrome collapses at 1000px. Reading surfaces (blog, KB, forum, docs)
  are mobile-first; data surfaces prioritise desktop but degrade to a pinned-column
  scroller. Sidebars and TOCs drop out below 900–1180px.
- **Accessibility** — meaning is never colour-alone (bucket meter + hidden word, glyph +
  label, dot + text). Focus is a 2px amber outline at 3px offset. Small text never sits
  on `--fg-4`. Both themes were contrast-checked; the light device/status overrides above
  are required for AA.

## State

Per surface, all client-side and hydratable from a server-rendered initial state:

- Benchmarks: `{ workload, depth, variant, lane, caps[], q }`, `{ sortKey, sortDir }`,
  `openRun`, `freshness: live | snapshot`, `tab: leaderboard | evals`.
- Profiles: `{ intent, family, lane, q }`, `openProfile`.
- Forum: `view: list | catindex | category | topic`, `category`, `topic`.
- Docs / writing: `view` only — these are static pages in the real build.
- Global: `theme`, and the Discourse SSO session (avatar + notifications appear
  site-wide, not only on the forum).

## Data

Benchmarks read `api.hal0.dev` (read-only JSON) with a build-time snapshot fallback.
A run record carries: identity (model id, quant, GGUF sha256, engine, container image +
digest, llama.cpp build, lane, resolved argv, KV cache types, speculative/MTP config,
workload kind, context depth, sampler, concurrency, config variant), results (decode
median + stddev, prefill, TTFT p50/p95, MTP accept rate, per-rep raw values), host (GPU,
platform, kernel, ROCm, RAM, hal0 version, exclusive flag, hostname redacted), telemetry
(VRAM peak, GTT peak, max edge temp, avg power, throttled), history, eval scores, and
provenance (uploaded bundle + profile TOMLs).

In this bundle `roster-data.js` holds the real measured sweep from
`src/data/model-roster.ts` (26/26 models, ROSTER_DATE 2026-06-19) and derives the
lanes, variants, depths, TTFT, telemetry, history and evals the new API will supply —
derived fields are flagged `synthetic: true`. Replace the derivation with the API; keep
the real rows.

Profiles live in a `hal0-profiles` repo as versioned TOML, submitted by PR.
`profiles-data.js` carries eight, each with intent, flags, models, lane, author,
version and a real per-profile history.

## Not designed yet

Section 4 of the original brief — the **submission flow** (CLI success landing page,
web upload wireframes with client-side schema validation pass/error states, PR-opened
confirmation, and submission status) — was deferred and is not in this package. The
entry points to it are designed: "share your results" on the benchmarks index and
"submit a profile" on the profiles index, plus the two-door explainer on the benchmarks
page (CLI `hal0 bench --share`, or web upload). Both doors must end as a PR in an org
data repo reviewed by CI + a maintainer, and the user should never need to understand git.

## Assets

- Wordmark: inline SVG from the hal0 design system (`assets/wordmark.svg` in the DS,
  `public/brand/` in hal0-web). Monomaniac One "hal" + amber slashed "0"; the slashed
  zero alone is the mark-only glyph. Treat as a fixed asset — never redraw.
- Icons: hal0's own thin-line family (16×16, 1.5 stroke, round caps, currentColor),
  bundled in the design system as `Icon`. No third-party icon set, no icon font, no emoji.
- Capability glyphs: the five paths in `ModelRoster.astro`, reproduced in `bench-app.jsx`.
- GitHub / Discord / RSS marks are the only third-party glyphs, drawn as fill paths.
- Avatars in the mockups are deterministic monogram placeholders — swap for real GitHub
  avatars (`avatars.githubusercontent.com`).
- No photography, no illustration, no gradients-as-decoration. The one gradient in the
  system is the header filament and the hero's faint amber wash.

## Files

| File | What it is |
|---|---|
| `01 Unified Chrome.html` | component sheet — chrome + primitives |
| `02 Benchmarks.html` | leaderboard, evals, run drawer, states, mobile |
| `03 Profiles.html` | gallery, card anatomy, profile drawer |
| `04 Blog and KB.html` | blog index + post, KB landing + article |
| `05 OG Card Template.html` | 1200×630 social template, five fills |
| `06 Homepage.html` | hero + live panel + community layer |
| `07 Forum.html` | topic list, categories index, category, topic |
| `08 Docs.html` | docs landing, category, article |
| `site-chrome.jsx` | **the chrome** — Header, Drawer, Footer, SubNav, Fpill, Attribution |
| `hal0-site.css` | site tokens, chrome, tables, pills, shared component styles, light theme |
| `bench-app.jsx` | Cap/Caps, Decode buckets, Spark, Seg, RunDrawer, BucketLegend |
| `roster-data.js` | real 26-model sweep + derived API fields |
| `profiles-data.js` | eight profiles with flags, models, history, TOML generator |
| `github.md` | repo association + screen → source map |
| `_ds/` | the hal0 design system bundle (tokens, components, styles) |

Every page loads `_ds/…/styles.css` + `hal0-site.css` + `site-chrome.jsx`; the data
surfaces add `bench-app.jsx`. Open any page and the whole set is navigable — header,
footer and cross-links all resolve.
