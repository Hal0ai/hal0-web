# hal0.dev Community Platform — Phase 1 Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Forum launch, community benchmark submissions, profile registry + gallery, blog/KB restructure.

## Vision

hal0.dev evolves from a release/docs site into the home for the Strix Halo / NPU /
Gorgon Halo ecosystem: benchmarks, shared configs, runner discussion, and durable
knowledge. Discord stays the chat; the platform becomes the searchable, persistent
layer.

## Architecture overview

Three repos plus one service. hal0.dev remains a static Astro/Starlight site on
Cloudflare Pages.

| Component | Role |
| --- | --- |
| `hal0-web` (existing) | Marketing, docs, blog/KB, bench charts, profile gallery. Static build ingests the data repos. |
| `hal0-bench-data` (new) | Community benchmark results. Git is the canonical store and moderation surface. |
| `hal0-profiles` (new) | Versioned runner/model profiles with schema CI. Feeds the site gallery and, later, `hal0 profile install`. |
| Discourse (new service) | Stock install at `forum.hal0.dev` on a cloud VPS. Identity hub for the community. |

Merges to the data repos trigger a Cloudflare Pages rebuild via webhook, so charts
and the gallery stay current without manual deploys.

## 0. Unified design system (cross-cutting, strict)

The platform must read as one site, not four stitched together. Every surface —
landing, docs, blog, KB, bench charts, profile gallery, and the Discourse forum —
shares identical header, footer, nav contents, colors, and typography.

- **Single source of truth.** hal0-web owns a small shared artifact:
  `src/styles/tokens.css` (colors from NOTES.md — sodium amber `#FFB000`,
  near-black backgrounds, accent hover/muted — plus Geist / JetBrains Mono and
  spacing) and `src/data/nav.json` (the exact header/footer link set, order, and
  icons). No surface hardcodes its own copy.
- **Branding assets are part of the artifact.** Canonical logo set lives in
  hal0-web (`src/assets/brand/`): full wordmark, mark-only glyph (slashed-zero),
  monochrome/inverse variants, favicon, touch icons, and OG/social-card
  template. Discourse logo slots (logo, mobile logo, favicon, large icon,
  OG image) are filled from these same files — never redrawn or approximated.
  Blog/KB post cards, bench pages, and the profile gallery use the same OG
  template so shared links look identical regardless of which surface they
  point to.
- **Astro surfaces** (landing, docs, blog, KB, bench, gallery) all render through
  the shared Starlight/site chrome. Bench and gallery pages use the same layout
  wrapper as the rest of the site — no one-off page shells.
- **Discourse** gets a custom theme component (its own git repo, installed via
  Discourse's remote-theme mechanism) that imports the same tokens and renders
  the same header/footer markup. Discourse-native controls (search, user menu,
  notifications) sit inside that header where site nav affordances would be.
  This is a theme component, not a plugin — the "stock install" decision stands
  operationally.
- **Behavioral consistency:** identical link set and order everywhere;
  active-section highlighting works across domains (Forum on forum.hal0.dev,
  Docs on /docs, …); dark-first with the same theme-toggle behavior; footer
  identical on every surface.
- **Drift prevention:** token/nav changes land only in hal0-web; CI (or a sync
  script) rebuilds the Discourse theme from the shared artifact so the forum
  cannot silently diverge.

## 1. Discourse forum

- **Hosting:** 4 GB cloud VPS (Hetzner CX-class, ~€8–15/mo), official Docker
  install. Backups to R2/S3. Transactional mail via Resend or Postmark.
- **Auth:** GitHub OAuth primary, Discord OAuth secondary. Email/password left
  enabled as fallback. When custom site features arrive later, Discourse becomes
  the identity provider via DiscourseConnect SSO.
- **Stock install at launch** — no custom plugins beyond OAuth and the Discord
  bridge — but with the shared brand theme component from section 0 (header,
  footer, tokens) applied from day one. Heavy functional customization is
  deferred; the hybrid path (custom structured layers on hal0.dev authenticated
  against Discourse) is preserved by the SSO choice.
- **Launch categories:** Announcements, Strix Halo, NPU / XDNA, Runners &
  Backends, Benchmarks, Setups & Profiles, Gorgon Halo, Site / Meta.
- **Discord bridge:** announcements webhook in both directions. Discord remains
  real-time chat; the forum is the durable, searchable record.
- **Site integration:** Forum link in the hal0.dev header; latest-topics strip on
  the homepage (Discourse JSON API fetched at build time, refreshed client-side).

## 2. Community benchmark pipeline

### Data model

One file per benchmark run; machine profiles deduped per user:

```
results/
  <github-user>/
    machines/<machine-slug>.json                     # hardware profile, written once
    runs/<date>-<model-slug>-<runner>-<hash>.json    # one run each, references machine-slug
```

Rationale for per-run files: append-only (no merge conflicts between PRs), CI
validates exactly the files a PR touches, one bad result reverts as one commit,
and a user's history is simply their directory. Users choose what to share by
choosing what they submit.

Run schema includes: machine-slug reference, model (HF id + quant), runner +
version, backend (ROCm/Vulkan), profile slug (joins to `hal0-profiles`), metrics
(tps, ttft, memory), hal0 version, timestamp.

### Two submission doors, one review queue

Users never need to understand PRs; git stays canonical.

- **Door A — CLI:** `hal0 bench --share`. GitHub device-flow auth, then the CLI
  forks, branches, and opens the PR against `hal0-bench-data` via the GitHub API.
  One command, PR link back.
- **Door B — web upload:** page on hal0.dev: "Sign in with GitHub" → drop the
  JSON file `hal0 bench` already wrote → client-side schema validation → a
  Cloudflare Worker backed by a GitHub App opens the PR on the user's behalf
  (user credited as author).

**Review queue = the PR list.** CI validates schema plus sanity ranges
(tps plausibility for the stated hardware, known runner versions,
machine-profile consistency). Policy:

- Green CI + plausible + returning submitter → bot auto-merges.
- Anomalous result or first-time submitter → held for operator review.
- The automated reviewer can later be upgraded to an agent (e.g. Claude-powered
  GitHub Action) without changing the queue shape.

### Site rendering

The hal0-web build ingests merged data and renders expanded charts: filters by
hardware, model, runner, backend, quant; per-model comparison pages; live-ish via
merge-triggered rebuilds.

## 3. Profile registry + gallery

- `hal0-profiles` repo: versioned profile files (llama.cpp args, slot configs,
  quant choices) with JSON schema CI, same PR flow as benchmarks.
- Astro gallery page with filters (hardware, model family, runner, quant).
- Each profile card links to bench runs that used it (join on profile slug):
  "this config produced these numbers" is the feature that ties the pillars
  together.
- `hal0 profile install <name>` (CLI, main repo) may trail the gallery slightly.
- Runner **image** sharing (OCI registry hosting) is explicitly phase 2.

## 4. Blog / knowledge base

- Existing `starlight-blog` stays for dated posts (RSS included).
- New Starlight sidebar section for the KB: evergreen guides, hardware notes,
  explainers, tool reviews — docs-style pages, not dated posts.
- Blog posts that prove evergreen graduate into the KB.
- Seed content: 2–3 posts/pages at launch (e.g. Strix Halo tuning guide, quant
  selection explainer, bench methodology writeup).

## 5. Build order

1. Design tokens + nav manifest extraction in hal0-web (section 0 foundation)
2. Bench schema + `hal0-bench-data` repo + CI (everything references this schema)
3. Discourse VPS launch + brand theme component (forum ships already unified)
4. hal0-web: expanded bench charts consuming community data
5. `hal0 bench --share` (main hal0 repo) + web upload door (Worker + GitHub App)
6. `hal0-profiles` + gallery
7. Blog/KB restructure + seed posts

## Error handling & operational notes

- Malformed submissions fail CI with actionable messages; the web door rejects
  bad files before a PR is ever opened.
- Discourse outage does not affect hal0.dev (build-time fetch degrades to a
  hidden strip; client refresh fails silently).
- Data-repo webhook failures self-heal on the next merge or manual rebuild.
- VPS backups (Discourse + uploads) to R2 nightly; data repos are inherently
  backed up by git.

## Design comps (visual source of truth)

The complete high-fidelity handoff is vendored at
`docs/design/2026-08-09-community-comps/` — eight screens (unified chrome,
benchmarks, profiles, blog + KB, OG card template, homepage, forum, docs) plus
`README.md`, the authoritative implementation reference (tokens incl. required
light-theme AA overrides for device/status hues, chrome spec, per-screen
behavior, state/data contracts, and the Discourse split of responsibility:
header/footer/palette as a theme component, topic rows restyled via Discourse
CSS variables, composer/moderation/search native). The comp `.site` ramp
matches shipped `tokens.css` values exactly; chrome v2 adoption shipped in
PR #62. The submission flow (spec section 2's two doors) is explicitly **not
designed yet** — entry points exist; wireframes are a follow-up design ask.

Handoff details that supersede earlier assumptions:

- Footer base line reads `Apache-2.0 · hal0 v<app> · <release>` — versions
  must match `BINARY` in `src/data/model-roster.ts`, never invented.
- Benchmarks sub-nav: leaderboard · evals · hardware · methodology · profiles ·
  share your results. Learn sub-nav gains `knowledge base` when the KB ships.
- OG cards: one 1200×630 template, five fills, generated at build time
  (`scripts/build-og.sh`); only bench/profile fills carry the amber figure.
- Homepage community layer order: feature cards → headline bench figures +
  top-5 table → latest forum topics (omitted entirely when API unreachable) →
  featured profiles → latest blog/KB.
- Bench run record schema (identity/results/host/telemetry/history/evals/
  provenance) is enumerated in the README's Data section — use it as the
  starting point for the `hal0-bench-data` JSON schema.

Data contracts the comps establish for later workstreams:

- **Benchmarks:** runs keyed by workload (`tg`/…), depth, variant, lane
  (`rocm`/`vulkan_radv`/…); metrics `dec` (+sd), `pf`, `ttftP50/P95`, `acc`,
  `gb`, sparkline history. Page renders from a build-time snapshot and
  upgrades live from `api.hal0.dev/v1/bench`, with explicit degraded
  (amber snapshot badge) / loading (skeleton) / empty states. Mobile keeps the
  table with a pinned model column, not card collapse.
- **Profiles:** `slug` (CLI-installable), `intent` chip (chat · moe · coding ·
  agent · vision · draft · embedding), one-sentence summary, flag string in a
  clipped sunken well, benched-model list, headline decode, attribution
  (GitHub avatar or first-party chip), version history with per-version notes.
  Detail drawer: install command, TOML config, **runs produced by this config**
  (joined by profile slug — same cells as the leaderboard), version history.
- **Submission states** map to the PR pipeline: validating · awaiting review ·
  merged · changes requested.

## Out of scope (phase 2+)

- Runner image registry / OCI hosting
- Custom profile pages and structured community features on hal0.dev via
  DiscourseConnect SSO
- CLI direct-upload API (bypassing PRs)
- Discourse *functional* customization (plugins, custom features) — brand
  theming per section 0 IS in phase 1 scope
