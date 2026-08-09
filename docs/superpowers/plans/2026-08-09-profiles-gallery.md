# Profiles Gallery + Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/profiles` on hal0.dev — a gallery of community profiles ingested from the `Hal0ai/hal0-profiles` repo at build time, with filters, a deep-linkable detail drawer, and bench metrics joined from the first-party roster data.

**Architecture:** A prebuild sync script (mirroring `scripts/sync-changelog.mjs`) fetches `profiles/*.toml` from GitHub, parses them with `smol-toml`, and writes a committed snapshot `src/data/profiles.json` (build still succeeds offline). A plain-ESM join module (`src/lib/profiles-join.mjs`, testable under `node --test`) matches each profile's models against `ROSTER` rows to produce headline metrics — a profile card only ever shows numbers its own models produced (spec: "a join, not a field"; omit the metric row when the join is empty). The page is a static Astro route using the `.site` chrome + `site-data.css` primitives, with a small vanilla island for filtering and the drawer (all 8 drawers pre-rendered, toggled client-side, `?p=<slug>` deep link).

**Tech Stack:** Astro 6, `smol-toml`, vanilla JS islands (repo has no client framework — keep it that way), `node --test`.

## Global Constraints

- Visual source of truth: `docs/design/2026-08-09-community-comps/03 Profiles.html` (card anatomy, drawer sections, filter bar) and its inline styles; shared primitives (`fpill`, `chip`, `dtable`, `well`, `btn`) come from `src/styles/site-data.css` — this page is its first consumer.
- Bench numbers are NEVER stored or invented: they come only from `ROSTER` rows (`src/data/model-roster.ts` — fields `id`, `dec`, `pf`, `gb`, `measured`) whose `id` matches the profile's `model.id`/`model.compatible`. Roster has no TTFT → the card shows decode + prefill only; when no roster row matches, omit the metric row entirely.
- Profile record shape (from `hal0-profiles`, already validated upstream): `{ schema, profile: { slug, title, summary, intent, author, first_party? }, runner: { kind, lane, min_build?, image? }, model: { id, quant?, compatible? }, args: { raw }, requires?, history: [{ v, date, note }, …newest first] }`.
- Community submission copy: "submit a profile" links to `https://github.com/Hal0ai/hal0-profiles/blob/main/CONTRIBUTING.md` (the doors aren't built).
- Nav: unhide the `profiles` entry in `src/data/nav.json` (it already exists with `hidden: true`). The chrome-consistency hidden-entry test currently asserts `/profiles` absent — update it: `forum.hal0.dev` stays absent, `/profiles` now must be PRESENT in the header of both surfaces.
- Intent chips lowercase; families derived from model ids by prefix: `qwen3-coder`, `qwen3`, `chadrock`, `qwopus`, `gemma`, `hermes` (first prefix match wins, `qwen3-coder` before `qwen3`; unmatched → `other`).
- `npm run build && npm test` green after every task; run `git checkout -- src/data/changelog.md` before commits (build side effect).
- Branch: `feat/profiles-gallery` from `origin/master`.

## File Structure

- `scripts/sync-profiles.mjs` — created. Fetch + parse + snapshot writer.
- `src/data/profiles.json` — created (committed snapshot, refreshed on prebuild).
- `src/lib/profiles-join.mjs` — created. `familyOf(modelId)`, `benchFor(profile, roster)`.
- `src/pages/profiles.astro` — created. Gallery + drawers + filter island.
- `src/data/nav.json` — modified (unhide profiles).
- `package.json` — modified (smol-toml dep; prebuild chain gains sync-profiles).
- `scripts/test/profiles-sync.test.mjs`, `scripts/test/profiles-join.test.mjs` — created.
- `scripts/test/chrome-consistency.test.mjs` — modified (profiles now visible).

---

### Task 1: Sync script + committed snapshot

**Files:** create `scripts/sync-profiles.mjs`, `src/data/profiles.json`, `scripts/test/profiles-sync.test.mjs`; modify `package.json`.

**Interfaces:**
- Produces: `src/data/profiles.json` — `{ synced: "<ISO date>", profiles: ProfileRecord[] }` sorted by slug; ProfileRecord is the parsed TOML object shape from Global Constraints (TOML dates serialized `YYYY-MM-DD`).
- Produces: `parseProfileToml(source, filename)` exported from `scripts/sync-profiles.mjs` for tests — returns the ProfileRecord or throws with filename context.

- [ ] Step 1: `npm install smol-toml` (runtime dep). Write `scripts/test/profiles-sync.test.mjs`: feed `parseProfileToml` a minimal valid TOML string (the strix-mtp-max example from the hal0-profiles README) and assert slug/intent/history[0].v and that `history[0].date` serializes as `"2026-06-19"` (string, not Date). Second test: malformed TOML throws with the filename in the message. Run → fail (module missing).
- [ ] Step 2: implement `scripts/sync-profiles.mjs` following the structure and comment style of `scripts/sync-changelog.mjs`: list `https://api.github.com/repos/Hal0ai/hal0-profiles/contents/profiles` (10s timeout, `Accept: application/vnd.github+json`), fetch each `download_url`, `parse()` via smol-toml, convert TomlDate values to `YYYY-MM-DD` strings recursively, sort by slug, write `{ synced, profiles }` to `src/data/profiles.json`. On any fetch failure: log a warning and keep the committed snapshot (exit 0). Export `parseProfileToml` for tests; only run main when executed directly (`import.meta.url` check, same as sync-changelog if it does this — else `process.argv[1]` comparison).
- [ ] Step 3: run `node scripts/sync-profiles.mjs` once → real snapshot with 8 profiles. Add to package.json: `"sync:profiles": "node scripts/sync-profiles.mjs"` and extend `"dev"` and `"prebuild"` to run it after sync-changelog (`node scripts/sync-changelog.mjs && node scripts/sync-profiles.mjs`).
- [ ] Step 4: `npm test` green (new tests + existing 17). `npm run build` green. Commit `feat: prebuild sync of hal0-profiles into committed snapshot`.

### Task 2: Bench join module

**Files:** create `src/lib/profiles-join.mjs`, `scripts/test/profiles-join.test.mjs`.

**Interfaces:**
- Consumes: ProfileRecord (Task 1), roster rows `{ id, dec, pf, gb, measured }`.
- Produces: `familyOf(modelId: string) → string` (prefix rules from Global Constraints). `benchFor(profile, rosterRows) → { headline: { modelId, dec, pf } | null, runs: Array<{ modelId, dec, pf, gb }> }` — `runs` = measured roster rows whose id is in `[model.id, ...(model.compatible ?? [])]`, sorted by dec desc; `headline` = first of runs or null. `familiesOf(profile) → string[]` (unique families across its model ids).

- [ ] Step 1: write tests: profile with two matching measured rows → runs sorted desc, headline is the max-dec row; profile whose models match nothing → `{ headline: null, runs: [] }`; unmeasured rows (measured:false or dec null) excluded; `familyOf("qwen3-coder-next-q4kxl") === "qwen3-coder"`, `familyOf("qwen3.5-9b-q4kxl") === "qwen3"`, `familyOf("weird-model") === "other"`. Run → fail.
- [ ] Step 2: implement (pure functions, no imports beyond nothing — keep dependency-free so node --test loads it directly). Run → pass.
- [ ] Step 3: Commit `feat: profile bench join and family derivation`.

### Task 3: /profiles page — gallery + filters

**Files:** create `src/pages/profiles.astro`; modify `src/data/nav.json`, `scripts/test/chrome-consistency.test.mjs`.

**Interfaces:**
- Consumes: `profiles.json` (Task 1), `benchFor`/`familyOf`/`familiesOf` (Task 2), `ROSTER` from `src/data/model-roster.ts`, `MarketingLayout` (has SiteHeader/SubNav/SiteFooter), `src/styles/site-data.css`.

- [ ] Step 1: unhide profiles in nav.json (delete the `"hidden": true` line on that entry). Update chrome-consistency test: hidden-entry test now asserts only `forum.hal0.dev` absent, and asserts `href="/profiles"` IS present in the header of both surfaces. Run `npm run build && npm test` → green.
- [ ] Step 2: build the page inside `MarketingLayout` (`title="profiles — hal0"`, description from the comp intro): page header per comp `03 Profiles.html` (eyebrow `shared configs · hal0-profiles`, h1 `profiles`, 60ch intro copy verbatim from the comp, ghost `how profiles work` → CONTRIBUTING.md, primary `submit a profile` → CONTRIBUTING.md), filter bar (family pills derived from the data, intent pills, lane pills, all with counts; `N of 8 profiles` readout), card grid. Card markup per the comp's `Card` component and on-page anatomy spec: slug (mono), title, intent chip (amber), summary, flags string in a clipped `.well`-style block with expand toggle, `benched with` model list (first two + count), metric row (decode + prefill from `benchFor`, omitted when `headline === null`, with the mono footnote naming the model the numbers came from), attribution (GitHub avatar via `https://github.com/<author>.png?size=32` or amber `first-party` chip when `first_party`), version `v<history[0].v>`. Port the comp page's inline styles (`.pgrid`, `.pcard`, `.flags`, etc.) into the Astro component's `<style>` block, adapted to `--hal0-*`-aliased vars (the page body already carries `.site`). Import `../styles/site-data.css` from the page frontmatter (first consumer).
- [ ] Step 3: filtering island — inline `<script>` (no framework): each card carries `data-intent`, `data-lane`, `data-families` (space-separated), pills toggle `hidden` on cards (AND across facets, OR within), counts on pills are static full-corpus counts, readout updates. All profiles render server-side; filtering is display-only (SEO + no-JS gets the full gallery).
- [ ] Step 4: `npm run build && npm test` green; grep `dist/profiles/index.html` for a known slug (`strix-mtp-max`) and the absence of any invented ttft value. Commit `feat: profiles gallery page with filters`.

### Task 4: Profile drawer + deep link

**Files:** modify `src/pages/profiles.astro`.

**Interfaces:** consumes Task 3's page; comp drawer reference is `ProfileDrawer` in `03 Profiles.html` + `.drawer-run`/`.toml` styles from the comp's inline CSS.

- [ ] Step 1: render one `<aside class="drawer-run" role="dialog" aria-label="profile detail" hidden data-profile="<slug>">` per profile plus one shared `.scrim`, ported from the comp: header (eyebrow `profile · v<v> · <updated>`, slug, title, close button), actions (`copy flags` with 1.4s "copied" swap; `install with hal0` ghost linking to the repo file), install `.well` (`hal0 profile install <slug>`), the raw flags string, the TOML rendered from the actual profile record (server-side syntax tinting like the comp's `Toml` component — comment/header/key/value spans), **runs produced by this config** table (`benchFor().runs`: model · decode · prefill · gb in a `.dtable`; section omitted when empty with the comp's "no measured runs yet" fallback line), version history rows (`v · date · note`).
- [ ] Step 2: island wiring — card click opens its drawer (sets `hidden` false, adds body scroll-lock, pushes `?p=<slug>` via `history.pushState`); scrim click / ✕ / Escape closes (and `history.back()` if we pushed); on load, `?p=<slug>` opens that drawer (deep link). `aria-expanded` not needed (dialog role); move focus to the drawer's close button on open and restore on close.
- [ ] Step 3: `npm run build && npm test`; grep dist for `data-profile="strix-mtp-max"` and the install command string. Commit `feat: profile detail drawer with bench join and deep links`.

### Task 5: Verification pass + PR

- [ ] Step 1: full `npm run build && npm test`; `npx astro check` introduces no NEW errors (4 pre-existing in content.config.ts).
- [ ] Step 2: dist greps — `/profiles` in header nav of `dist/index.html` AND `dist/blog/index.html`; profiles page footer identical (`data-site-footer` present); no `forum.hal0.dev` anywhere; 8 `data-profile` drawers.
- [ ] Step 3: push branch, open PR titled `feat: profiles gallery ingesting hal0-profiles with first-party bench join`, body summarizing per repo convention, watch checks, squash-merge.
