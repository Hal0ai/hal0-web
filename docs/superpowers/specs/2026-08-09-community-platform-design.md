# hal0.dev Community Platform — Phase 1 Design

**Date:** 2026-08-09 (revised same day: community bench submissions dropped)
**Status:** Approved
**Scope:** Forum launch, first-party benchmarks surface, community profile
registry + gallery, blog/KB restructure.

> **Revision note (2026-08-09):** public/community benchmark submission is
> cancelled. Benchmarks are first-party only (the hal0 reference box, served
> by `api.hal0.dev/v1/bench` + build-time snapshot). Community contribution
> happens through the profile registry. `hal0-bench-data` is not built.

## Vision

hal0.dev evolves from a release/docs site into the home for the Strix Halo / NPU /
Gorgon Halo ecosystem: benchmarks, shared configs, runner discussion, and durable
knowledge. Discord stays the chat; the platform becomes the searchable, persistent
layer.

## Architecture overview

Two repos plus one service. hal0.dev remains a static Astro/Starlight site on
Cloudflare Pages.

| Component | Role |
| --- | --- |
| `hal0-web` (existing) | Marketing, docs, blog/KB, benchmarks surface, profile gallery. Static build ingests `hal0-profiles` and the bench snapshot. |
| `hal0-profiles` (new) | Community-submitted versioned runner/model profiles with schema CI. Git is the canonical store and moderation surface. Feeds the site gallery and, later, `hal0 profile install`. |
| Discourse (new service) | Stock install at `forum.hal0.dev` on a cloud VPS. Identity hub for the community. |

Bench data is first-party: the main hal0 repo's bench system publishes a
read-only JSON feed at `api.hal0.dev/v1/bench`; hal0-web keeps a build-time
snapshot and upgrades live client-side. Merges to `hal0-profiles` trigger a
Cloudflare Pages rebuild via webhook, so the gallery stays current without
manual deploys.

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

## 2. Benchmarks (first-party)

All benchmark data comes from the hal0 reference box, produced by the main
repo's bench system. No community submissions.

- **Feed:** `api.hal0.dev/v1/bench`, read-only JSON. The run record follows the
  design-handoff README's Data section (identity, results, host, telemetry,
  history, evals, provenance).
- **Site rendering:** the benchmarks page renders a build-time snapshot first
  and upgrades client-side when the API answers — there is always a table on
  screen. Freshness badge flips between live and snapshot states. Leaderboard +
  evals tabs, run drawer with deep-linkable `?run=<id>`, per the comp.
- **Refresh:** new sweeps update the snapshot via a rebuild trigger; the live
  feed covers the gap between sweeps.

## 3. Profile registry + gallery (the community pillar)

- `hal0-profiles` repo: community-submitted versioned profile TOMLs
  (llama.cpp args, slot configs, quant choices) with schema CI. Git is the
  canonical store; the PR list is the moderation queue.
- **Two submission doors** (users never need to understand PRs):
  - **CLI:** `hal0 profile share`. GitHub device-flow auth, then the CLI forks,
    branches, and opens the PR against `hal0-profiles` via the GitHub API.
  - **Web upload:** page on hal0.dev: "Sign in with GitHub" → paste/upload the
    profile TOML → client-side schema validation → a Cloudflare Worker backed
    by a GitHub App opens the PR on the user's behalf (user credited as
    author).
- **Review queue = the PR list.** CI validates schema, slug uniqueness, known
  models/lanes. Green CI + returning submitter → bot auto-merge; first-time
  submitter or CI flags → held for operator review. The automated reviewer can
  later be upgraded to an agent without changing the queue shape.
- Astro gallery page with filters (model family, intent, lane) per the comp.
- Each profile card shows metrics **joined from first-party bench runs** on
  profile slug — the card only ever shows a number one of that profile's own
  runs produced; if the join is unavailable at build time, the metric row is
  omitted rather than stale or borrowed.
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

1. ~~Design tokens + nav manifest extraction~~ (done — PR #61)
2. ~~Chrome v2 design-comp adoption~~ (done — PR #62)
3. `hal0-profiles` repo + TOML schema + CI + seed profiles
4. hal0-web: profiles gallery + drawer (joined to first-party bench snapshot)
5. hal0-web: benchmarks page (snapshot-first + live upgrade from
   `api.hal0.dev/v1/bench`); bench feed work lands in the main hal0 repo
6. Profile submission doors (`hal0 profile share` CLI + web upload
   Worker/GitHub App) — needs the submission-flow wireframes
7. Discourse VPS launch + brand theme component (forum ships already unified)
8. Blog/KB restructure + OG template + homepage community layer

## Error handling & operational notes

- Malformed profile submissions fail CI with actionable messages; the web door
  rejects bad TOML before a PR is ever opened.
- Discourse outage does not affect hal0.dev (build-time fetch degrades to a
  hidden strip; client refresh fails silently).
- Bench API outage degrades to the build-time snapshot with an amber freshness
  badge; the homepage forum strip is omitted entirely when unreachable.
- Profiles-repo webhook failures self-heal on the next merge or manual rebuild.
- VPS backups (Discourse + uploads) to R2 nightly; the profiles repo is
  inherently backed up by git.

## Design comps (visual source of truth)

The complete high-fidelity handoff is vendored at
`docs/design/2026-08-09-community-comps/` — nine screens (unified chrome,
benchmarks, profiles, blog + KB, OG card template, homepage, forum, docs,
profile submission) plus `README.md`, the authoritative implementation
reference (tokens incl. required light-theme AA overrides for device/status
hues, chrome spec, per-screen behavior, state/data contracts, and the
Discourse split of responsibility: header/footer/palette as a theme
component, topic rows restyled via Discourse CSS variables,
composer/moderation/search native). The comp `.site` ramp matches shipped
`tokens.css` values exactly; chrome v2 adoption shipped in PR #62. The
**profile** submission flow now has wireframes (section 9, `09 Profile
Submission.html`): web upload/paste with the four validation states (pass,
schema error, missing required fields, unknown model/lane warning),
PR-opened confirmation, and CLI success landing. Only the **BENCH-RUN**
submission flow remains undesigned — community bench dropped, so no
wireframes are needed for it.

Handoff details that supersede earlier assumptions (and one the revision
supersedes back):

- Footer base line reads `Apache-2.0 · hal0 v<app> · <release>` — versions
  must match `BINARY` in `src/data/model-roster.ts`, never invented.
- Benchmarks sub-nav: leaderboard · evals · hardware · methodology · profiles
  (the handoff's `share your results` item is dropped with community bench;
  bench pages lose the "share your results" primary button and two-door
  explainer; the footer data column drops "share a run"). Learn sub-nav gains
  `knowledge base` when the KB ships.
- Leaderboard attribution: first-party only — the community GitHub-avatar
  attribution in the bench comp no longer applies (it remains correct on
  profile cards).
- OG cards: one 1200×630 template, five fills, generated at build time
  (`scripts/build-og.sh`); only bench/profile fills carry the amber figure.
- Homepage community layer order: feature cards → headline bench figures +
  top-5 table → latest forum topics (omitted entirely when API unreachable) →
  featured profiles → latest blog/KB.
- Bench run record schema (identity/results/host/telemetry/history/evals/
  provenance) is enumerated in the README's Data section — it is the contract
  for the first-party `api.hal0.dev/v1/bench` feed and the build-time
  snapshot.

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
