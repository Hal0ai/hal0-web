# hal0.dev site audit: content + SEO (read-only)

Audited 2026-11-01. Repo: `thinmintdev/east-city` worktree at commit `46d1411` (clean). Production fetched live from https://hal0.dev (Cloudflare in front of Vercel). Raw production HTML is saved next to this file under `research/prod/` and `research/prod-home.html` for re-checking.

Nothing in the repo was modified. All word counts for the landing page come from the rendered production HTML (visible text, scripts/styles/SVG stripped), so they include UI strings such as table cells and chips.

---

## 0. Context that changes what to do

- **PR #128 is already open** (`thinmintdev/beautiful-pediatrician`, commit `26cbcc3`, "feat(seo): wire Google Analytics 4, fix social cards, add response headers"). It already covers: GA4 (env-gated by `PUBLIC_GA_MEASUREMENT_ID`, no ID set yet, so nothing renders), absolute `og:image` + `twitter:image` on Starlight pages, `noindex` on `/profiles/submitted` plus sitemap `filter`, and a `vercel.json` with security headers, `/install.sh` content type and screenshot/brand/og/agents cache headers. Those items are marked **[in PR #128]** below and are not repeated in the fix list. Do not duplicate that work; rebase onto it.
- This branch has no `Analytics.astro`, no `noindex`, no `hreflang`, no manifest anywhere in `src/`, `public/`, `scripts/`, `functions/` (grep confirmed).
- Production matches the source at HEAD (same h1, same sections, same meta), so the production HTML is a valid proxy for the build.
- **Latest release**: `gh` works. Latest stable is **v1.7.1** (published 2026-10-27T18:37Z, flagged Latest). Previous: v1.7.0 (2026-10-26), v1.6.5 (2026-10-24). The five newest entries from `gh release list --limit 5` are all nightlies (`v1.7.1-nightly.20261031112620` newest, 2026-10-31). Repo has **84 stars**. Repo description: "Open-source self-hosted home AI inference platform for AMD Strix Halo — multi-backend slots, OpenAI-compatible gateway, Vue 3 + FastAPI + systemd."
- **The site is one patch behind**: production eyebrow and JSON-LD `softwareVersion` say **1.7.0**. Production was built 2026-10-29 19:24 GMT (Last-Modified), after v1.7.1 shipped on 2026-10-27. `src/data/release-tags.json` in git is stale (`fetched_at` 2026-10-16, newest tag v1.4.0) and is regenerated at prebuild, so the lag is either the changelog not yet having a v1.7.1 section or the tag fetch missing it. Worth a look at `scripts/sync-changelog.mjs`.
- Production headers: HTTP/2 200, `server: cloudflare`, `x-vercel-cache: HIT`, `x-vercel-id: cle1::…`, `cf-cache-status: DYNAMIC` (HTML is not cached at the Cloudflare edge; Vercel serves it), `cache-control: public, max-age=0, must-revalidate`, `strict-transport-security: max-age=63072000`, `speculation-rules: "/cdn-cgi/speculation"` (Cloudflare Speed Brain). The response came from a real Cloudflare edge (`cf-ray …-IAD`), not a local wildcard.

---

## Part A. Content audit

### A1. Landing page `/` (`src/pages/index.astro`, 1643 lines; template lines 195-684, CSS after)

Layout: `MarketingLayout` with `navTone` default (solid). Imports: `MarketingLayout`, `LiveArtifact`, `HermesCard`, `ForumTopics`, `FeaturedProfiles`, `LatestWriting`, `BenchHighlights`, `rawChangelog` + `releaseTags` + `parseChangelog` (for the version), `site-data.css`. `CTA.astro` is **not** used on the landing page (it is used by `/changelog` and `/contributing`).

Total visible words about 2,660. Sections in page order:

| # | Section (id) | Heading | One-line summary | Screenshots / media | Components | Links (href) | Words | Tone |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero (`header.hero`, `#install`) | h1 "Own Your Inference" | Tagline "All local. All yours."; lede: every modality from one OpenAI-compatible API on a Strix Halo box or any Linux machine; install one-liner; fake status ticker | none (animated `LiveArtifact` dashboard mock) | `LiveArtifact` | `https://forum.hal0.dev/t/hal0-documentation/19` ("Read the docs →"), `https://github.com/hal0ai/hal0` (rel=noopener); install text `curl -fsSL https://hal0.dev/install.sh | sudo bash` | 142 | Benefit. Ticker (`:8080`, `GTT 9.2 / 96 GB`, `probe strix-halo`) is decorative plumbing |
| 2 | Runners (`#stack`) | h2 "Six default runners, one /v1/* surface." | Table of 8 runner images with pinned upstream builds, hardware, endpoints | none | none | none | 223 | **Plumbing-heavy**: `llama.cpp b11596`, `FastFlowLM 0.9.44`, `pinned 0.4.9`, "Every tag is immutable and hardware-gated" |
| 3 | What's in the box (`#what`) | h2 "More than models. A whole AI stack." | 6 cards: agents, profiles, memory, voice, images, prewired | none | none | none | 322 | Mixed. "Model = facts, profile = tune, slot = placement" and "Hindsight engine bound to loopback" are plumbing; images/prewired cards are benefit |
| 4 | Use cases (`#use-cases`) | h2 "One box, three day jobs." + 3×h3 | Local coding stack, private knowledge & RAG, voice & image lab | none | none | none | 158 | **Benefit-heavy** (best section) |
| 5 | Bench strip | h2 "what this box does" | 3 headline figures + top-5 decode table from the June sweep | none | `BenchHighlights` | `/benchmarks` (whole strip is one `<a>`, plus "all 26 models · sweep 2026-06-19 →") | 58 | Benefit (numbers). Heading is vague and lowercase |
| 6 | Hardware (`#hardware`) | h2 "Strix Halo native. Not Strix-Halo-only." | 6 tier cards: Max+ 395 (128 GB), Max 385/390 (64 GB), NVIDIA RTX, Radeon RX 7000, CPU-only, Proxmox LXC | none | none | none | 345 | Mixed. "UMA-aware", "LPDDR5X-8000", "hal0-slot@<name> lifecycle", "PVEAuditor token", "ZFS ARC pressure" are plumbing |
| 7 | Compare (no id) | h2 "The orchestration layer around your inference engine." | 11-row × 4-col table: hal0 vs ollama vs LM Studio vs OpenAI cloud; snapshot disclaimer "as of October 2026" | none | none | none | 229 | **Plumbing-heavy**: "Slot lifecycle state machine", "Dispatcher with upstreams", "UMA-aware hardware probe", "component convergence". Also see claim-accuracy note below |
| 8 | Console (`#console`) | h2 "Slots, profiles and memory, one console." | 4 real dashboard screenshots with captions | `dashboard-overview.png` (hero, 1440×900), `slots-inference.png`, `profiles-tab.png`, `memory-graph.png` (each with `@2x`) | none | `#whats-new` | 138 | Benefit (visual). Sub says "SSE-backed" |
| 9 | Agents (`#agents`) | h2 "Agents that live on the box." + 3×h3 | Hermes agent (foil card), 4 bullets, tiles for hal0-brain, MCP, memory; auth/TLS note | `agents/hermes.png` (1488×1202, 1.95 MB) via card | `HermesCard` | `https://forum.hal0.dev/t/agents-hal0-docs/23` (button) and again inside the card ("Run agents →") | 447 | **Most plumbing-heavy**: bullet 2 lists `hal0-agent@hermes.service: NoNewPrivileges, ProtectSystem=strict, a pinned ReadWritePaths set`; "A validator keeps the gating tiers from overlapping"; "Streamable-HTTP servers"; "approval queue"; "26 memory tools" |
| 10 | What's new (`#whats-new`, plus empty `#roadmap` anchor) | h2 "What the latest releases changed." | 6 cards (runners, profiles, models, memory, open webui, updates), each linking to the changelog | none | none | 6× `/changelog`; `/changelog`; `/blog/whats-new-since-1-0/`; `https://forum.hal0.dev/t/hal0-documentation/19` | 231 | Mixed. "One pin table drives every runner image, each tag is immutable" is plumbing; "Writes that used to vanish now land" is benefit |
| 11 | Forum topics | h2 "what users are talking about" | Latest Discourse topics (build-time fetch; renders nothing if `DISCOURSE_URL` unset) | forum avatars (external) | `ForumTopics` | forum topic URLs (live in prod: `/t/i-just-got-my-strix-halo-box-start-here/14`, `/t/hal0-cli-reference/50`, `/t/update-and-roll-back/41`, `/t/hal0-1-7-release-…`), `https://forum.hal0.dev` | 68 | n/a (dynamic) |
| 12 | Featured profiles | h2 "optimized model & hardware recipes from the community" | Top 3 profiles by decode tok/s | GitHub avatars | `FeaturedProfiles` | `/profiles`, `/profiles?p=<slug>` ×3 | 146 | Benefit |
| 13 | Latest writing | h2 "latest from the blog" + h3/h4 teasers | 2 newest blog posts | none | `LatestWriting` | `/blog`, `/blog/whats-new-since-1-0/`, `/blog/whats-new-in-the-v0-8-line/` | 90 | Benefit |
| 14 | CTA (`.cta-section`, `#install-cta`) | h2 "Put the whole stack on your own box." | Install box again + pills (Apache-2.0, Linux + systemd, no telemetry by default, signed releases) | none | none | `https://forum.hal0.dev/t/hal0-documentation/19`, `https://github.com/hal0ai/hal0` | 67 | Benefit |

**Plumbing vs benefit verdict.** Sections 4, 5, 8, 12-14 and the hero are benefit-led. Sections 2, 7 and 9 are the plumbing-heavy ones and sit mid-page where a skimming visitor decides. Plumbing term counts in the template copy (lines 52-664): `llama.cpp` 10, `ROCm` 9, `XDNA` 7, `pinned` 6, `systemd` 5, `Vulkan` 5, `UMA` 6, `MTP` 4, `lifecycle` 3, `converge` 3, plus one each of `NoNewPrivileges`, `ProtectSystem`, `ReadWritePaths`, `hal0-slot@`, `Streamable-HTTP`, `GTT`, `loopback`, `state machine`, `validator`. Copy that most wants a benefit rewrite:

- Agents bullet 2 (systemd directives) → "Runs sandboxed: no root, read-only system, writes only to its own folder."
- Agents tile "A validator keeps the gating tiers from overlapping, so the catalog cannot drift quietly" → drop; keep "destructive calls wait for your approval."
- Compare rows "Slot lifecycle state machine / Dispatcher with upstreams / UMA-aware hardware probe / component convergence" → "Runs several models at once", "Falls back to OpenRouter/Anthropic/OpenAI when you want", "Knows your Strix Halo memory", "One-command signed updates, one-flag rollback".
- Runner table: keep it (SEO-useful, concrete) but move build pins to a hover/`<details>` and lead with "what it does for you".
- What's-new card "One pin table drives every runner image, each tag is immutable and hardware-gated" → "Runner images are now reproducible: same tag, same bits."
- Hardware tier notes: replace `hal0-slot@<name> lifecycle`, "segmented host-pressure overlay" with outcomes.

Other content flags:

- **Compare-table accuracy risk.** "Concurrent slots: ollama = one at a time, LM Studio = one at a time" is likely outdated (Ollama supports multiple loaded models via `OLLAMA_MAX_LOADED_MODELS`, and LM Studio can hold several). The table is a credibility and trust issue and a magnet for corrections in the forum. Verify each cell against current docs before leaving it in a section that is also the main "alternatives" SEO target.
- **Stack mismatch.** Console section says "one React operator console"; the GitHub repo description says "Vue 3 + FastAPI". One is wrong. Check.
- **GitHub repo description** (what Google shows next to the repo) is plumbing-first ("multi-backend slots", "Vue 3 + FastAPI + systemd"). It is the other top-ranking brand surface; rewrite it benefit-first and add topics (`local-llm`, `self-hosted`, `strix-halo`, `ryzen-ai-max`, `openai-compatible`, `llama-cpp`, `homelab`, `mcp`).
- No FAQ, no "what is hal0" definitional paragraph, no comparison of "who is this for" in plain words above the fold beyond the lede.

### A2. Other pages

**`/changelog` (`src/pages/changelog.astro`, 606 lines).** Purpose: the single release-history page (merged from the old `/releases`; `/releases` 301s here). Data: `src/data/changelog.md` (synced from the product repo `CHANGELOG.md` by `scripts/sync-changelog.mjs`) plus `src/data/release-tags.json` (GitHub tags), parsed by `src/lib/changelog.js`. UI: sticky left sidebar of versions with IntersectionObserver active state; "Get hal0" block (latest stable and pre-release cards, install one-liner via `CodeBlock`, three `hal0 update --channel` commands, rollback); one `cl-entry` per version with stable/pre-release/unreleased/GA-rc badges and kind badges (breaking/added/changed/fixed). Ends with `CTA` linking `/docs/getting-started/` (a 301 hop to the forum) and GitHub releases. **Weight**: 1,087,415 bytes of HTML (323 KB brotli), about 120,000 words, about 13,700 elements, 61 h2s (one per version).

**`/benchmarks` (`src/pages/benchmarks.astro`, 676 lines).** Purpose: model-roster leaderboard, 26 models measured on one Strix Halo box. Data: `src/data/model-roster.ts` (`ROSTER`, `ROSTER_DATE` 2026-06-19, `HARDWARE`, `BINARY`), optionally overridden by `src/data/bench-snapshot.json` from the live `/v1/roster` API at prebuild (currently null; `api.hal0.dev` has no DNS). UI: warning banner (snapshot is from an early build on the rocmfp4 fork, the Standard runner has since replaced it, new sweep planned), hardware and binary context panels, tabs leaderboard/evals (evals is API-only, empty until the API exists), mobile filter/sort toolbar, facet filters (workload, lane, capability pills), SSR table with `BucketMeter`/`CapGlyphs`, `RunDrawer`, `bench-island.ts`. Text content is server-rendered (about 840 words), so it is crawlable. Headings: h1 then h4 only.

**`/profiles` (`src/pages/profiles.astro`, 904 lines) plus `/profiles/submit` and `/profiles/submitted`.** Purpose: community profile gallery (flag strings with bench numbers). Data: `src/data/profiles.json` synced from `Hal0ai/hal0-profiles` by `scripts/sync-profiles.mjs`, joined to `ROSTER` via `src/lib/profiles-join.mjs`. UI: 9 cards in prod, family/intent/lane filter pills (AND across facets), click opens a detail drawer and pushes `?p=<slug>` (client-side only), TOML preview, submit CTA. `/profiles/submit` validates a TOML in-browser and opens a pre-filled GitHub PR. `/profiles/submitted` is the thank-you page. Own OG image `/og/profiles-index.png`. Headings: h1, 9×h3, 43×h4, no h2.

**`/contributing` (`src/pages/contributing.astro`, 62 lines).** Purpose: stub pointing to GitHub issues/PRs and forum architecture/slots topics. No data source. Static Tailwind-styled page (different visual idiom from the data pages), 225 words, h1 + 3 h2, `CTA` band whose secondary link `/docs/` is a redirect hop to the forum. Links: `https://github.com/hal0ai/hal0`, `/issues`, `/pulls`, `https://forum.hal0.dev/t/architecture-hal0-docs/24`, `https://forum.hal0.dev/t/slots-hal0-docs/28`, `/changelog`, Apache license.

**Blog** (Starlight + `starlight-blog`, `src/content/docs/blog/*.mdx`): three posts (`whats-new-since-1-0` 2026-10-15, `whats-new-in-the-v0-8-line` 2026-07-04, `whats-new-in-the-v0-7-line` 2026-06-19). Not in the header nav (footer only).

### A3. Header links (`src/data/nav.json` → `SiteHeader.astro`, `flatHeader`)

Centre nav (label → href):

- home → `/`
- docs → `https://forum.hal0.dev/c/docs/11` (external, ↗)
- benchmarks → `/benchmarks/` (match `/benchmarks`; sub-nav row on that section: leaderboard `/benchmarks/`, evals `/benchmarks/#evals`, methodology `https://forum.hal0.dev/t/model-roster-benchmarks-reference/55` external)
- profiles → `/profiles`
- forum → `https://forum.hal0.dev` (external, ↗)

Right side: Search button (⌘K / Ctrl K, Pagefind over `/js/site-search.js`), GitHub icon `https://github.com/hal0ai/hal0`, Discord icon `https://discord.gg/7M4y6dcUyq`, theme toggle, hidden SSO bell + avatar (only shown when `/api/auth/session` reports signed-in), burger drawer under 1000 px with the same five links. External links carry `rel="noopener"` and a host `title`.

Observations: **Blog and Changelog are not in the header**, so the only crawlable internal links to `/blog` and `/changelog` from most pages are in the footer and the landing "what's new"/"latest writing" blocks. The nav uses `/profiles`, `/changelog`, `/blog`, `/contributing` without trailing slash while canonicals and sitemap use trailing slash (both URL forms return 200 with no redirect; canonical tag resolves the duplication).

### A4. Footer links (`SiteFooter.astro`)

Brand column: wordmark, tagline "Self-hosted AI inference for the Linux box you already own. Built and benchmarked by the Strix Halo community.", icon buttons GitHub, Discord, RSS (`/blog/rss.xml`).

- **learn**: docs `https://forum.hal0.dev/c/docs/11` ↗; knowledge base `https://forum.hal0.dev/c/kb/12` ↗; blog `/blog`; changelog `/changelog`; releases `https://github.com/Hal0ai/hal0/releases` ↗
- **community**: forum `https://forum.hal0.dev` ↗; discord `https://discord.gg/7M4y6dcUyq` ↗; github `https://github.com/hal0ai/hal0` ↗; contributing `/contributing`; `mailto:hello@hal0.dev`
- **data**: benchmarks `/benchmarks/`; profiles `/profiles`; submit a profile `/profiles/submit`; what's new `/#whats-new`
- Base row: "Apache-2.0 · {latest tagged version}" and changelog `/changelog`.

Footer column headings are `<h4>` with no preceding h3 (heading skip on every page). `hello@hal0.dev` goes through Cloudflare Email Obfuscation, which injects `email-decode.min.js` (twice on the landing page).

### A5. `astro.config.mjs`: redirects, sitemap, site

- `site: 'https://hal0.dev'`; `adapter: vercel()` with default `output: 'static'` (only `src/pages/api/**` is on-demand). No `trailingSlash` or `build.format` set on purpose (documented in `scripts/patch-vercel-docs-redirects.mjs`).
- Redirects (all 301 via Astro/Vercel): `/releases` → `/changelog`; `/first-run-guide` → `https://forum.hal0.dev/c/docs/docs-getting-started/19`; `/roadmap` → `/#whats-new`; `/kb` → `https://forum.hal0.dev/c/kb/12`; `/docs` → `https://forum.hal0.dev/c/docs/11`; `/docs/getting-started|concepts|guides|operate|reference` → matching forum categories (19/20/21/22/23); plus spreads of `docs-redirects.json` (44 product docs) and `kb-redirects.json` (6 KB articles, only `/kb/*` keys) → forum topics. A postbuild script patches trailing-slash tolerance for the forum redirects.
- Sitemap: `@astrojs/sitemap` with **no options** on this branch. Produces `/sitemap-index.xml` → `/sitemap-0.xml`. Production has 18 URLs: `/`, `/benchmarks/`, `/blog/`, `/blog/authors/the-hal0-team/`, 6 `/blog/tags/*`, 3 blog posts, `/changelog/`, `/contributing/`, `/profiles/`, `/profiles/submit/`, `/profiles/submitted/`. No `<lastmod>`. (PR #128 filters out `/profiles/submitted`.)
- Starlight: sidebar empty, `sitemap`-adjacent `head` adds `og:image` (relative on this branch), `twitter:card`, `theme-color`, lightbox and RSS-button scripts; `starlight-blog` with `navigation: 'none'`.
- Docs strategy consequence: all product docs and the KB live on `forum.hal0.dev` (Discourse). `hal0.dev` therefore has about 5 substantive indexable pages (landing, benchmarks, profiles, changelog, 3 posts). Topical authority for docs queries accrues to the forum subdomain, not the apex.

---

## Part B. SEO audit

### B1. Head and meta, per page (production, 2026-11-01)

| URL | `<title>` (chars) | meta description (chars) | canonical | og:image |
|---|---|---|---|---|
| `/` | "hal0 — Strix Halo native AI inference, image gen & agents for homelabs." (**71**, over 60) | "Open-source homelab AI for AMD Strix Halo: one OpenAI-compatible /v1/* API, pinned runner images, named profiles, Hermes agent, Hindsight memory, Open WebUI." (**157**, over 155) | `https://hal0.dev/` | `https://hal0.dev/og-default.png` |
| `/benchmarks/` | "Benchmarks — hal0" (17) | "The hal0 model roster benchmark: decode/prefill throughput, MTP accept rate and memory footprint for 26 models measured end to end on one Strix Halo box." (153) | `/benchmarks/` | og-default |
| `/profiles/` | "profiles — hal0" (15, lowercase) | "A profile is the flag string that produced a number, versioned and downloadable. Find the one for your model, copy its flags into a profile of your own, or read the config and steal the parts you want." (**201**, truncated in SERPs) | `/profiles/` | `/og/profiles-index.png` |
| `/profiles/submit/` | "submit a profile — hal0" (23) | "Submit a hal0 profile — a TOML config validated in your browser, then opened as a pre-filled pull request on GitHub." (116) | `/profiles/submit/` | og-default |
| `/profiles/submitted/` | "submission received — hal0" | "Your hal0 profile submission — pull request status and what happens next." | `/profiles/submitted/` | og-default. **Indexable and in the sitemap** (fixed in PR #128) |
| `/changelog/` | "Changelog — hal0" (16) | "Every hal0 release, newest first, with the install and upgrade commands. Derived from the product CHANGELOG so it never drifts from what actually shipped." (154) | `/changelog/` | og-default |
| `/contributing/` | "Contributing — hal0" (19) | "How to contribute to hal0 — an open-source, self-hosted home AI inference platform. Apache-2.0. Issues, pull requests, and where to start." (138) | `/contributing/` | og-default |
| `/blog/` | "Blog \| hal0" (11) | "Local AI for your home. Strix Halo native." (42, site default) | `/blog/` | `/og-default.png` **relative** (absolute in PR #128) |
| `/blog/<post>/` (all 3) | "<post title> \| hal0" (e.g. since-1.0 post = **83**) | **same site default as the blog index**, not the post's `excerpt` | `/blog/<slug>/` | relative `/og-default.png`, no `twitter:image` (fixed in PR #128) |
| 404 | "404 \| hal0" | site default | `/404/` | relative |

Notes:

- Title separators are inconsistent: marketing pages use an em dash and lowercase ("profiles — hal0"), Starlight pages use a pipe ("Blog | hal0").
- `MarketingLayout.astro` is the only head partial for marketing pages: charset, viewport, `theme-color #0a0a0a` (static, ignores light theme), inline theme-init script, title, description, canonical (built from `Astro.url.pathname` against `site`, trailing slash), `icon` SVG, `apple-touch-icon` (`/brand/logo-halo-dark-favico.png`, **2000×2000 PNG**, 55 KB), `mask-icon`, 3 font preloads, `og:title/description/type=website/url/site_name/image/image:width/height/image:alt`, `twitter:card=summary_large_image`, `twitter:image`. Missing: `og:locale`, `twitter:title`/`twitter:description` (fall back to og, fine), `twitter:site`, RSS autodiscovery (`<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">` exists on Starlight pages only), per-page `og:image:alt`, `color-scheme`.
- Blog post frontmatter has `title`, `date`, `authors`, `excerpt`, `tags` and **no `description`** and no `cover`. `excerpt` feeds the blog index and the BlogPosting JSON-LD `description`, but Starlight's `<meta name="description">` falls back to the site description for every post. `blogSchema` already allows `cover`.
- `public/robots.txt`: `User-agent: * / Allow: /` + `Sitemap: https://hal0.dev/sitemap-index.xml`. Fine. `/api/**` (SSO + notifications proxy) is not disallowed (low risk, they are not linked).
- `noindex`: none on this branch (grep). `hreflang`: none (single English locale, `<html lang="en">`, not needed). `manifest`: none. Favicon set: `favicon.svg` + one 2000² apple-touch PNG + mask-icon. No `favicon.ico`, no 32/192/512 PNGs, no web manifest.
- Analytics: nothing on this branch (PR #128 adds GA4, env-gated, no measurement ID yet). So today there is no first-party measurement at all.
- `public/_headers` is Cloudflare Pages syntax and has no effect on Vercel (PR #128's `vercel.json` replaces it). `/install.sh` currently serves `application/x-sh`.
- OG pipeline (`scripts/build-og.mjs`, satori + resvg, runs in `prebuild`): renders `public/og/profiles/*.png` (8 per-profile cards) and `public/og/profiles-index.png`, plus a satori fallback `public/og/default.png` (41 KB). Only `profiles-index.png` is referenced by any page. **The 8 per-profile cards are never used** (profile detail is a client-side drawer on `?p=`, so every profile deep link shares the index card), `public/og/default.png` is unused (the live default is the ImageMagick `public/og-default.png`, 1200×630, 166 KB), and the blog/KB fills described in the file header are not wired.

### B2. Structured data

- Landing: one `SoftwareApplication` JSON-LD block (script in body): `name`, `applicationCategory: DeveloperApplication`, `operatingSystem: Linux`, long `description`, `url`, `downloadUrl`, `license`, `softwareVersion` (**1.7.0**, derived), `codeRepository`, long `keywords`, `offers` (0 USD), `author` Organization `hal0ai`. Missing: `image`, `screenshot`, `featureList`, `softwareRequirements`, `releaseNotes`, `installUrl`, `sameAs`, `publisher`/logo. `keywords` is ignored by Google and fine to leave.
- Blog index: `CollectionPage` + `Blog` (starlight-blog). Blog posts: `BlogPosting` (headline, datePublished, author Person "The hal0 team", `isPartOf` Blog, `description` from `excerpt`) + `BreadcrumbList`. No `image`, no `dateModified`, no `publisher`.
- No `Organization`, no `WebSite`, no `FAQPage`, no `BreadcrumbList` on marketing pages, no `Dataset`.

### B3. Landing heading hierarchy

- Exactly **one h1** ("Own Your Inference", two spans). Good.
- h2s (14): Six default runners…; More than models…; One box, three day jobs.; what this box does; Strix Halo native…; The orchestration layer…; Slots, profiles and memory…; Agents that live on the box.; What the latest releases changed.; what users are talking about; optimized model & hardware recipes from the community; latest from the blog; Put the whole stack on your own box. (Sections of the page, so they nest correctly under the h1.)
- h3s: 3 in use-cases, 3 in agents, 1 blog lead title. The second blog teaser is an **h4** next to an h3 sibling (inconsistent). Footer has 3 h4s with no h3/h2 above them. No missing-level jumps inside the main content other than the footer and the blog teaser.
- Keyword weakness: the h1 and h2s are brand/voice-led. No heading says "local LLM", "self-hosted AI", "OpenAI-compatible", "Ryzen AI Max+ 395" or "multiple models". "Strix Halo" appears only in two h2s. Three h2s are lowercase fragments ("what this box does", "what users are talking about").
- `/benchmarks` is h1 → h4 (no h2/h3). `/profiles` is h1 → h3 (cards) → h4, no h2. `/changelog` is h1 + 61 h2 (+3 h4).

### B4. Images on the landing page

- 4 screenshots + Hermes card image, all with **descriptive alt text** (100% coverage on content images; decorative avatars correctly use `alt=""`). No missing `alt` attributes.
- All have explicit `width`/`height` (1440×900 for screenshots, 1488×1202 for Hermes), `loading="lazy"`, `decoding="async"`. Screenshots use `srcset` with `1x, 2x` descriptors (`@2x` files are 2880×1800). Forum/GitHub avatars are 20/16 px with dimensions and `loading="lazy"`.
- No hero image; LCP is text (the h1 or the install block), which is good. No `fetchpriority` needed.
- Weights (PNG, no WebP/AVIF): `dashboard-overview` 115 KB / 260 KB @2x, `slots-inference` 166 / 397 KB, `profiles-tab` 104 / 248 KB, `memory-graph` 250 / **736 KB**, `agents/hermes.png` **1.95 MB** (1488×1202, rendered much smaller in a card). On a retina phone the landing page pulls about 1.64 MB of screenshots plus the 1.95 MB Hermes image if scrolled to. `public/screenshots` is 15 MB and 77 files; most are not used on the landing page.
- External link `rel`: header/footer/GitHub links have `rel="noopener"`; the five forum docs CTAs have none; no link uses `target="_blank"`, so `noopener` is moot and there is no `nofollow`/`ugc`/`sponsored` anywhere. That is correct for first-party links (forum, GitHub). Forum topic titles in `ForumTopics` are user-generated but point to the project's own forum; leaving them followed is fine.

### B5. Core Web Vitals risks

1. **`/changelog` is a 1.09 MB HTML document** (323 KB brotli, about 13,700 DOM elements, about 120k words). This is the worst page for INP, TBT, memory on mid-range phones, and it is mostly duplicate of GitHub's CHANGELOG.md.
2. `agents/hermes.png` 1.95 MB PNG (lazy, but a big payload when reached).
3. Screenshots are PNG only; 2x variants up to 736 KB. `sharp` is already a dependency, so AVIF/WebP via `<picture>` is cheap.
4. `/_astro/*` hashed assets and `/agents/*` are served `cache-control: public, max-age=14400, must-revalidate` (4 h) via Cloudflare. That is almost certainly Cloudflare's **Browser Cache TTL** overriding Vercel's `immutable` 1-year header (Lighthouse "efficient cache lifetimes"). PR #128's `vercel.json` sets 1-day SWR for images but cannot fix this for `/_astro`. Fix in Cloudflare: Browser Cache TTL = "Respect existing headers".
5. Render-blocking CSS: 3 stylesheets in head (`SiteFooter`, `index`, `site-data`: about 30.8 + 6.5 + 2.6 KB gzip). Acceptable. One tiny blocking inline theme script (intentional). `page.js` is a 2.5 KB module. `lightbox.js` and `site-search.js` are `defer`. Cloudflare injects two `email-decode.min.js`.
6. Fonts are handled well: 3 preloads (Geist variable 29 KB, JetBrains Mono 400/700) and a size-adjusted fallback in `fonts.css` (the layout comment says CLS was about 0.21 before this).
7. HTML is not edge-cached by Cloudflare (`cf-cache-status: DYNAMIC`); it is served from Vercel (`x-vercel-cache: HIT`, age 2.4 days). Fine for static; TTFB depends on Vercel region (cle1).
8. Landing HTML is 88 KB, profiles 126 KB, benchmarks 84 KB. Fine.
9. Apple-touch icon is a 2000×2000 PNG (55 KB) where 180×180 is needed.

### B6. Proposed keyword themes (per page)

Positioning facts to lean on: self-hosted AI inference server; OpenAI-compatible local API; many models in parallel ("slots", "as memory fits"); chat + embeddings + rerank + speech + images behind one API; AMD Strix Halo / Ryzen AI Max+ 395 first, NVIDIA/CPU supported; local MCP servers; memory that stays on the box; Apache-2.0; no telemetry. Competitor-intent queries to own: "ollama alternative", "LM Studio alternative for Linux headless".

| Page | Primary theme | Secondary / long-tail |
|---|---|---|
| `/` | self-hosted AI inference server for Strix Halo | local LLM server, run LLMs locally on Linux, OpenAI-compatible local API, homelab AI, private AI, run multiple models at once, ollama alternative, local MCP server, Ryzen AI Max+ 395 AI |
| `/benchmarks` | Strix Halo LLM benchmarks | Ryzen AI Max+ 395 tokens per second, llama.cpp Strix Halo performance, ROCm vs Vulkan Strix Halo, MTP / speculative decoding speed, 128 GB unified memory models |
| `/profiles` | llama.cpp profiles / flags for Strix Halo | best llama.cpp flags Qwen3 27B, Strix Halo model configs, local LLM config sharing, MTP flags |
| `/changelog` | hal0 release notes | hal0 changelog, hal0 update, self-hosted AI inference releases |
| `/blog` | self-hosted AI and Strix Halo release write-ups | what's new in hal0, running local LLMs at home |
| `/contributing` | contribute to open-source local AI server | hal0 GitHub, Apache-2.0 local AI project |

### B7. Proposed titles (≤60) and meta descriptions (≤155), lengths verified

| Page | Title | Chars | Meta description | Chars |
|---|---|---|---|---|
| `/` | hal0: Self-Hosted Local AI Server for AMD Strix Halo | 52 | Run LLMs, speech and images on your own hardware. Open-source, OpenAI-compatible local AI server for AMD Strix Halo (Ryzen AI Max+ 395) and Linux. | 145 |
| `/benchmarks` | Strix Halo LLM Benchmarks: 26 Models, Tokens/sec \| hal0 | 55 | Tokens per second for 26 local LLMs on one AMD Ryzen AI Max+ 395 (Strix Halo, 128 GB): decode, prefill, MTP accept rate and memory use per model. | 145 |
| `/profiles` | llama.cpp Profiles for Strix Halo & Local LLMs \| hal0 | 53 | Community-tested llama.cpp flag sets for local LLMs on AMD Strix Halo. Copy a model's context, runner and flags, or submit your own profile. | 140 |
| `/profiles/submit` | Submit a hal0 Profile \| llama.cpp Config Sharing | 48 | Share your llama.cpp config for a local LLM. Validate a hal0 profile TOML in your browser, then open it as a pre-filled GitHub pull request. | 140 |
| `/changelog` | hal0 Changelog: Release Notes for the Local AI Server | 53 | Every hal0 release, newest first: new features, fixes and breaking changes for the self-hosted AI inference server, with install and upgrade commands. | 150 |
| `/contributing` | Contribute to hal0, the Open-Source Local AI Server | 51 | Help build hal0, an Apache-2.0 self-hosted AI inference server for Strix Halo and Linux. File issues, open pull requests and find where to start. | 145 |
| `/blog` | hal0 Blog: Self-Hosted AI, Strix Halo & Releases | 48 | Release write-ups and field notes on running local LLMs, speech and image generation at home with hal0 on AMD Strix Halo and other Linux hardware. | 146 |
| `/blog/whats-new-since-1-0` (add as `description:` frontmatter; keep a short `title:` so the suffix fits) | What Changed in hal0 Since 1.0: Runners & Profiles | 50 | One name per runner, profiles that hold the whole tune, a 27B vision model as the default brain, and memory that never drops writes: hal0 since 1.0. | 148 |

For the two older posts, write equivalent `description:` lines (v0.7 first beta / v0.8 stacks + voice) and shorten titles to ≤50 chars before the ` | hal0` suffix. Keep `/profiles/submitted` titled as-is (it will be noindex).

### B8. Structured data to add

1. **Organization + WebSite** (site-wide, in `MarketingLayout`, one `@graph`): `Organization` with `@id https://hal0.dev/#org`, `name hal0`, `url`, `logo` (a square PNG ≥112 px, e.g. `/brand/logo-halo-dark.png`), `sameAs` [GitHub org, Discord invite, `https://forum.hal0.dev`]. `WebSite` with `@id`, `name`, `url`, `publisher` → org. Skip `SearchAction`: search is client-side Pagefind, there is no URL-addressable search.
2. **SoftwareApplication (upgrade existing)**: add `image` (the OG card), `screenshot` (the four landing screenshots, absolute URLs), `featureList` (chat, embeddings, rerank, STT, TTS, image gen, MCP servers, signed updates), `softwareRequirements` ("Linux x86_64, Python 3.12+, systemd"), `releaseNotes` (`https://hal0.dev/changelog/`), `installUrl`, `publisher` → the Organization `@id`, and drive `softwareVersion` from the real latest stable (currently 1.7.0 vs actual 1.7.1). Do not add `aggregateRating` or `review` without real data.
3. **FAQPage** on the landing page, **paired with a visible FAQ section** (markup must mirror on-page text). Suggested questions: What is hal0? / Do I need a Strix Halo machine? / Is hal0 an Ollama alternative? / Can I run several models at once? / Does my data leave the machine? / Is the API OpenAI-compatible? / Which GPUs and NPUs work? Honest note: Google limits FAQ rich results to a few site types since 2023, so the gain here is mostly content structure and AI-answer extraction, not a SERP feature.
4. **BreadcrumbList** on `/benchmarks`, `/profiles`, `/profiles/submit`, `/changelog`, `/contributing` (Home › Page). Blog posts already have it via starlight-blog.
5. **Dataset** on `/benchmarks`: the roster is real measured data (name, description, `dateModified` 2026-06-19, `measurementTechnique`, `variableMeasured` decode/prefill tok/s, accept rate, GB, `license`). Legitimate and rare in this niche.
6. **Article/BlogPosting enrichment** for blog: add `image` (from `cover` or per-post OG card), `dateModified`, `publisher` → Organization. starlight-blog already emits `BlogPosting`; extend it via the Starlight `Head` override that PR #128 introduces rather than writing a second block.
7. **CollectionPage/ItemList** on `/profiles` once per-profile pages exist (below), and `SoftwareSourceCode` or `TechArticle` on each profile page.

### B9. Prioritized fix list

Items already handled in PR #128 are excluded (GA4 wiring, absolute og:image/twitter:image on Starlight pages, `/profiles/submitted` noindex + sitemap filter, security/cache headers via `vercel.json`).

**P0: do first, small, high impact**

1. **Rewrite titles and descriptions** per B7. Landing title is 71 chars and description 157 (`src/pages/index.astro` lines 29-32 and 196); `/profiles` description is 201 chars (`src/pages/profiles.astro`); blog post titles reach 83 chars with the suffix. Unify the separator.
2. **Fix blog and 404 meta descriptions**: every blog page and 404 emits the site default "Local AI for your home. Strix Halo native." Add `description:` to the three posts, give the blog index its own description (Starlight `description` in the `starlight-blog` config or an index override), and set a distinct 404 description. Add `cover:` or wire the per-post satori OG fill that `build-og.mjs` already documents.
3. **Landing keyword layer without losing the brand H1**: keep "Own Your Inference" (deliberate, commit 945a975) but put the entity words in the eyebrow/lede ("self-hosted local LLM server", "OpenAI-compatible", "Ryzen AI Max+ 395") and rewrite the lowercase fragment h2s ("what this box does", "what users are talking about") into descriptive ones. Add a short visible "What is hal0?" paragraph and the FAQ (B8.3).
4. **Fix site staleness**: site shows 1.7.0 while v1.7.1 is the latest stable (published 2026-10-27); check `scripts/sync-changelog.mjs` and the `release-tags.json` refresh. JSON-LD and the eyebrow lag with it. Also the benchmarks data is dated 2026-06-19 (4+ months, superseded runner); the banner admits it, so schedule the new sweep (a stale number is the page's main SEO and trust weakness).

**P1: next**

5. **Per-profile static pages** `/profiles/<slug>/` generated from `profiles.json` (`getStaticPaths`), each with its own title/description/OG, using the 8 already-rendered, currently unused cards in `public/og/profiles/`. Today `?p=<slug>` drawers are not indexable and every profile shares one OG card. These are the best long-tail pages the site can have ("Qwen3 27B llama.cpp flags Strix Halo").
6. **Structured data**: Organization + WebSite, richer SoftwareApplication, BreadcrumbList on inner pages, Dataset on benchmarks (B8). FAQPage with the visible FAQ.
7. **Image weight**: convert the four landing screenshots and `agents/hermes.png` to AVIF/WebP via `<picture>` (build step with `sharp`); resize `hermes.png` to its rendered size ×2 (it is 1488×1202 for a small card); produce a 180×180 apple-touch icon, plus 32/192/512 PNGs, a `favicon.ico` fallback and a small `site.webmanifest`. Make `theme-color` media-aware (`#0a0a0a` dark / light value for light).
8. **Slim `/changelog`**: render the latest 8-10 versions inline and move older ones to an archive route (or `content-visibility: auto` per entry). Drops HTML from 1.09 MB toward under 150 KB and removes 50+ duplicate-of-GitHub h2s. Change the page's `CTA` `/docs/getting-started/` and the `/contributing` CTA `/docs/` to the direct forum URLs to avoid redirect hops.
9. **Heading hierarchy**: `/benchmarks` add h2 sections (hardware, binary, leaderboard, evals); `/profiles` add an h2 above the 9 h3 cards; footer column titles from `<h4>` to non-heading `<p class="label">` (or sr-only h2 "Site links" + h3s); make the second blog teaser on the landing an h3.

**P2: hygiene and infrastructure**

10. **Cloudflare Browser Cache TTL** → "Respect existing headers" (hashed `/_astro/*` currently 4 h `must-revalidate`; should be 1 y `immutable`). Consider disabling Email Obfuscation (saves two requests; the address is public anyway).
11. **Sitemap**: add `lastmod` (via `serialize`, e.g. from git date/ROSTER_DATE/changelog date), drop blog tag/author pages if they stay thin, and make internal links and nav use the same trailing-slash form as canonicals (`/profiles` vs `/profiles/`).
12. **RSS autodiscovery** `<link rel="alternate" type="application/rss+xml" href="/blog/rss.xml">` in `MarketingLayout`; add `og:locale`, `twitter:site` if a handle exists, per-page `og:image:alt`.
13. **Add Blog and Changelog to the header** (or a "Learn" entry) so crawl paths and users reach them from every page; today only the footer links there.
14. **Content accuracy**: re-verify the compare-table cells (Ollama / LM Studio concurrency), the React vs "Vue 3" stack claim between the site and GitHub, and rewrite the GitHub repo description/topics (84 stars) benefit-first.
15. **Optional/GEO**: `public/llms.txt` summarizing the product and key URLs (none exists); set the GA4 `PUBLIC_GA_MEASUREMENT_ID` after PR #128 merges, and verify Google Search Console and Bing Webmaster ownership for both `hal0.dev` and `forum.hal0.dev` (docs now live on the forum; submit its sitemap too).

### B10. What is fine (leave alone)

One h1; correct canonical on every page (query-string deep links like `/profiles?p=` canonicalise to `/profiles/`); `lang="en"`; real 404 status; HTTPS + HSTS; both slash forms return 200 with no redirect chain; all content images have alt text and dimensions; lazy-loading is correct for below-the-fold images; no hero image competing for LCP; font preloads and fallback metrics already tuned; robots.txt and sitemap are valid and discoverable; Hermes/console copy is genuinely differentiated; JSON-LD parses and has the right type for the landing page.
