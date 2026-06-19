# hal0-web overhaul — state note (2026-06-19)

Map produced before changes, plus what this pass added. Branch:
`docs/overhaul-v0.5.1`.

## Versions (truth from product repo, derived at build time)

- **Latest line:** `v0.7.3-beta.1` (2026-06-19) — hal0's *first beta*. The
  build-time changelog sync (`scripts/sync-changelog.mjs`) pulls this from
  `hal0ai/hal0@main`, so the site auto-tracks the real latest. (The original
  overhaul prompt assumed v0.3; the local `~/dev/hal0` checkout was stale at
  v0.5.1 — neither is current.)
- **Last stable:** `v0.2.0`. Everything since carries a pre-release tag.
- **Positioning (decided):** front the current dev line as **pre-release**,
  mark `v0.2.0` as last stable. Encoded in `src/lib/changelog.js#isPrerelease`.

## Structure

- Astro 6 + Starlight 0.39. Apex = `src/pages/index.astro` (MarketingLayout
  chrome). Docs = 36 `.mdx` under `src/content/docs/docs/` (Diátaxis 4-group).
- **Updater manifest is untouched:** `functions/_middleware.ts` +
  `public/releases/{stable,nightly}.json` (machine surface for
  releases.hal0.dev). Verified byte-stable. The new `/releases` page is a
  separate human surface — do not conflate.
- No `CONTENT_BRIEF.md` exists anymore (the prompt's instruction to read it is
  stale).

## What was already done (prior commit `5fadf96`, 2026-06-19)

- **Docs correctness (WS A):** all 36 pages swept to the v0.5.1 reality —
  ADR-0012 reverse-proxy security model (no Caddy/auth), podman-container-per-
  slot, lemond removed, NPU/FLM slots, profile-card dashboard. ⚠️ The prompt's
  A2 ("Lemonade single unified runtime") is itself stale vs. current code;
  following it literally would *regress* the docs, so it was NOT applied.
- **Screenshots (WS E):** 32 dark-mode shots at 1440×900, host masked to
  `hal0.local`, wired into docs.

## What this pass added (the genuinely-missing pieces)

- **WS C — /changelog + /releases:** derived from `CHANGELOG.md` via a
  build-time sync + parser (`src/lib/changelog.js`). Newest-first, grouped by
  version, sections preserved, pre-release/stable badges. `/releases` shows
  latest stable vs. current dev line + install/upgrade commands. Both wired
  into nav; neither routes through the updater manifest.
- **WS D — Blog:** `starlight-blog` (nests in the Starlight docs instance →
  `/blog`, leaving the marketing apex untouched). RSS at `/blog/rss.xml`,
  authors/tags, and a seed post drawn from the v0.7 beta changelog, labelled
  pre-release.
- **WS E — capture script:** `scripts/capture-screenshots.mjs` (Playwright,
  env-configurable host, no private data) makes the screenshots regenerable.
  Existing shots are current, so not re-captured. The first-run wizard is now
  a terminal TUI (`hal0 setup`) — there is no web wizard to screenshot.
- **WS B/F — polish:** Contributing stub (`/contributing`), apex drift fixed
  (version now derived; "Vue 3" → "React 18"), footer version derived, nav/IA
  = docs · blog · changelog · releases · roadmap · github, `/docs` redirect to
  getting-started (was a long-standing 404).

## Decisions (surfaced, answered by the user)

1. **Scope:** build the missing pieces + light docs verification (not a full
   re-execution that would overwrite correct work).
2. **Positioning:** v0.x current dev line as pre-release; v0.2.0 last stable.
3. **Contribution:** honest early-stage stub.

## Verification

- `npm run build` green — 47 pages. Internal links resolve. Sitemap includes
  all new pages. `hal0-docs` lint CLEAN (no private-data/banned-term hits).
- Updater manifest (`public/releases/*`, `functions/`) byte-stable.

## Blog-impl choice (one line)

`starlight-blog` over an Astro content collection: it slots into the existing
Starlight docs instance for free (RSS, tags, authors, dark chrome) without
touching the marketing apex — cleanest fit for this apex/Starlight split.
