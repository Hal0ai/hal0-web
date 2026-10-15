# hal0.dev 1.4 refresh — design

Date: 2026-10-15. Status: proposed, awaiting operator approval.

The site was last reframed for the 1.0 GA on 2026-08-29 (#120, #121). Four
product releases later (1.1, 1.2, 1.3, and the upcoming 1.4), most product
claims on the landing page are stale, several are wrong, the screenshots
predate the slot-card, slot-drawer, model-drawer and profile-drawer rework,
and the repo carries a large amount of dead content. This document is the
plan for the refresh. Research inputs (scratchpad, this session):
`product-delta.md`, `site-audit.md`, `shot-pipeline.md`.

## 1. Facts that shape the plan

- **v1.4.0 is not tagged.** Latest stable tag is v1.3.0. `CHANGELOG.md` on
  main already carries a `## [1.4.0] — 2026-10-08` heading plus a large
  `## [Unreleased]` section (runner system ADR-0028, profile-centric config
  ADR-0029, Qwen3.8 27B default, Hindsight 1.0, Hermes 0.19 with smart
  approvals, upgrade floor 1.3.0). Stable 1.4 = both sections. The last
  nightly was judged no-ship (#2657). The site must not say "1.4 shipping"
  before the tag exists.
- **The site derives its version from `versions[0]` of the synced
  changelog**, so an untagged heading becomes "stable {version}" the moment
  the prebuild sync runs. The committed snapshot `src/data/changelog.md`
  stops at rc.12.
- **Benchmarks data is from 2026-06-19 on hal0 v0.5.0a1** with the retired
  rocmfp4 fork. `api.hal0.dev` has no public DNS record, so the "live"
  roster sync always falls back to the committed snapshot (`roster: null`).
- **Screenshots cannot be re-shot on the operator's production box.** It
  shows private hostnames (`*.thinmint.dev`), personal slots and models,
  paid upstreams, and most slots are offline. A clean fleet box is needed.
- **`alpha-docs/` (44 MDX files) is not built by Astro at all.** It is the
  only consumer of most files in `public/screenshots/`.
- **`public/first-run-guide/` is orphaned** (no inbound link) and describes
  v0.9.2 (`rocmfpx`, old seed profiles, `capabilities migrate`).
- Wrong claims on the landing page today: `hal0-combined:0826` (now the
  **Standard** runner, `hal0-runner-standard`, llama.cpp b11596); "hal0
  ships no auth layer" (optional key auth, LAN admin gate, Remember me,
  `auth reset-key` all exist; still no TLS); "180 tools" (182 now);
  "per-device profiles" (profiles are workload-keyed and own the whole tune);
  "toolbox" (now "runner image"); Hindsight 0.8.4 (1.0.0); "what's next"
  list contains items that shipped or were dropped.
- `profiles.astro` tells readers to run `hal0 profile install <slug>`. That
  verb does not exist (`profile list|show|create|edit|migrate`).
- `src/data/changelog.md` mirrors product CHANGELOG lines that name the
  Lemonade baseline. That text is already public on GitHub; scrubbing the
  mirror alone hides nothing. Operator decision (see §7).

## 2. Goals

1. Every product claim on hal0.dev is true for 1.4 and sourced to the
   product repo.
2. The landing page tells the 1.4 story (runners, profiles, bigger default
   model, memory, wired OWUI, converging updates) without becoming a
   release-notes dump; the 1.0 "what 1.0 delivers / what's next" block goes.
3. Screenshots show the current slot cards (RichSelect model and profile
   pickers, metric row, ctx chip), the slot drawer, the model drawer (file
   facts), and the profile drawer.
4. The repo stops carrying content that nothing builds or links to.
5. The site cannot announce an untagged version as stable.
6. All existing tests stay green; `astro check` stays at 0/0.

Non-goals: new benchmark sweep (product-side work, tracked separately);
nav restructure (header is locked by tests and mirrored by the forum
theme); design-system changes.

## 3. Content plan by surface

### 3.1 Landing page `src/pages/index.astro`

Keep the page skeleton (hero, stack, what, use-cases, bench, perf,
hardware, compare, console, agents, community, CTA). Changes:

- **Hero.** Keep the H1 and lede. Eyebrow stays derived, but from the
  *latest tagged stable* (§5). Install box gets `sudo` to match the product
  README one-liner. Ticker stays (demo numbers, no private data).
- **`#stack` providers table.** Rewrite as the runner catalogue: Standard
  (llama.cpp ROCm + Vulkan, pinned upstream build), CPU, FLM (NPU), Kokoro,
  Moonshine, ComfyUI, with Qwen3 TTS and CUDA marked optional. Versions come
  from `manifest.json` runner pins, written as "pinned build bNNNNN", never
  as image tags that rot. Drop "digest-pinned" wording; say "immutable
  tag, hardware-gated".
- **`#what` features.** Six cards stay six. Replace the counts-heavy MCP card
  with "Model = facts, profile = tune, slot = placement" (ADR-0029). Keep
  agents, memory (Hindsight 1.0, extraction limits), voice, images, prewired
  (add RAG on hal0 embeddings and the OWUI image button). Numbers: remove
  "180"; if a count is kept anywhere it is 182 and lives in the agents tile
  only.
- **`#use-cases`.** Keep. Fix "ComfyUI on the iGPU" wording only if wrong.
- **BenchHighlights + `#perf`.** Keep BenchHighlights (it labels the sweep
  date). Drop the `#perf` strip: it duplicates BenchHighlights and pins
  "258 tok/s" and "100 tok/s" numbers from a v0.5 sweep on a retired runner.
- **`#hardware` tiers.** Keep the tier grid; remove the "258 tok/s" cell;
  update CPU-only (real CPU runner since 1.1), Proxmox (quick-start script
  builds a privileged GPU+NPU LXC), and NVIDIA (CUDA runner, optional tier,
  experimental).
- **Compare table.** Keep. Update the footnote date to the edit date, add a
  "Tune portability" row (named profiles you can fork, export, import) and
  fix "Cosign-signed updates" to "signed updates + component convergence".
- **`#console`.** Four shots become: dashboard overview, slots (new cards
  with pickers), profile drawer, memory graph. Captions rewritten.
- **`#agents`.** Hermes 0.19 with smart command approvals (your own
  `hal0/agent` model pre-screens shell commands); hal0-brain unchanged;
  MCP tile loses the per-area tool counts and states the two servers plus
  the approval queue; memory tile moves to Hindsight 1.0 and the "writes
  land or are refused honestly" story. Remove the claim that user-installed
  MCP servers are exposed to Hermes (suspended in 1.4).
- **`#roadmap` → `#whats-new`.** Delete the `themes` data (23 items, six
  rows, 300 lines of CSS), `shipNowHighlights`, `nextItems`, and the
  "twelve release candidates" headline. Replace with one compact section:
  eyebrow "/ what's new in 1.4", four to six cards (runner system,
  profile-centric config, Qwen3.8 27B default, memory, OWUI wired, updates
  that converge + upgrade floor), a link to `/changelog` and to the release
  blog post. Section id `whats-new`; keep an empty `id="roadmap"` anchor so
  old links land near it. Footer "roadmap" link → "what's new".
- **Security copy.** New sentence set: optional key auth off by default
  (trusted-LAN posture), admin gate for off-box callers once a key exists,
  no TLS (reverse proxy + `hal0 network public-url set`), signed updates,
  contained agent unit, audited memory ops, secret redaction. Never
  "no auth layer".
- **Meta.** `description`, `metaDescription`, JSON-LD `keywords` updated
  to the same vocabulary. `softwareVersion` from latest tagged stable.
- **Remove dead CSS** `.holding*`.

### 3.2 Changelog `src/pages/changelog.astro`

- Refresh the committed snapshot via `npm run sync:changelog`.
- Replace "hal0 1.0 is generally available…" with a version-neutral line
  that reads the latest stable from data.
- Render each release's `### Highlights` as a highlighted block at the top
  of that entry (small template change in the section renderer).
- Per-entry "on github" link uses the tag URL when a tag exists.
- Update stale header comments in `src/lib/changelog.js`.

### 3.3 Blog

- Add `src/content/docs/blog/whats-new-in-hal0-1-1-to-1-4.mdx`: the
  release post, themes from `product-delta.md` §F, with the new screenshots
  inline. Date = tag date; until then the post is on the branch, not master.
- Keep the two beta-line posts as archive (they carry the historical
  aside already). The blog index must keep building (tests depend on it).

### 3.4 Profiles `src/pages/profiles.astro`, `submit.astro`, `submitted.astro`

- Replace `hal0 profile install <slug>` with the real path: download the
  `.hal0profile.json` addon and import it (Profiles ▸ Import) or
  `hal0 profile create --from`. Verify the exact import command in the
  product CLI before writing it.
- Sample TOML in `submit.astro`: update `min_build` to the Standard pin and
  lane vocabulary (`gpu-rocm`).

### 3.5 Benchmarks `src/pages/benchmarks.astro`

- No data change. Add an honest banner: "Sweep from 2026-06-19 on hal0
  0.5 with the rocmfp4 fork; the Standard runner replaced it in 1.4. A new
  sweep is planned." Keep the row count and date so
  `benchmarks-page.test.mjs` passes.
- Separate follow-up (not this PR): deploy or retire the `api.hal0.dev`
  worker route; today it has no DNS record.

### 3.6 Contributing `src/pages/contributing.astro`

Minor: drop "process still forming" if the operator agrees; otherwise
untouched.

### 3.7 Removals

- `alpha-docs/` (unbuilt, 44 files).
- `public/first-run-guide/` (orphan, v0.9.2). Add redirect
  `/first-run-guide` → forum getting-started category in `astro.config.mjs`.
- `src/components/ModelRoster.astro`, `src/components/landing/LoadoutCard.astro`
  (no importers).
- `NOTES.md` "v0.2 auth landed" section (historical, references pages that
  no longer exist).
- Screenshots that nothing will reference after this pass (decided in
  §4 after the new set is captured).

### 3.8 README.md

Rewrite to match the tree: Astro 7 / Starlight 0.41, no in-repo docs, pages
list (`/`, `/changelog`, `/benchmarks`, `/profiles`, `/profiles/submit`,
`/contributing`, `/blog`), redirects to the forum, sync scripts, screenshot
pipeline, release-manifest proxy, tests. Drop `mirror-docs`, `/releases`,
`/docs/*` groups, "54 pages", "verified 2026-05".

## 4. Screenshots

### 4.1 Script changes `scripts/capture-screenshots.mjs`

- Fix `runner-images` expect selector → `[data-testid="ri-family-strip"]`.
- Retarget `mtp-control` to the profile drawer (`pf-select-mtp`); keep the
  filename.
- Add shots: `slot-card` (clip `infer-slot-agent`), `slot-profile-picker-open`
  (click `infer-profile-agent`, expect `.rsel-listbox`),
  `slot-model-picker-open` (click `infer-model-agent`, wait ~1 s for the
  feasibility call), `slot-drawer` (route `#slots/agent`, expect
  `slot-profile-preview` or `slot-profile`), `profile-edit-drawer`
  (`#models/profiles`, click `pf-btn-editcopy-agent`, expect
  `pf-drawer-preview`), `model-edit-drawer` (expect `model-facts`),
  `settings-security` (command approvals).
- `chromium.launch({ args })` from `HAL0_CHROMIUM_ARGS` so
  `--host-resolver-rules="MAP hal0.local <ip>"` works without root.
- Update the header comment (drop the `hal0 setup` line, document the
  Docker invocation).
- Landing `<img>` tags get `srcset` for the `@2x` files that already exist.

### 4.2 Capture environment

Host Chromium cannot start (missing system libs, no sudo). Run inside
`mcr.microsoft.com/playwright:v1.64.0-noble` with `--add-host
hal0.local:<box-ip>` and `HAL0_DASHBOARD_URL=http://hal0.local:8080`, after
`npm i --no-save playwright@1.64.0` inside the container. Exact command in
`shot-pipeline.md` §8.

### 4.3 Capture box (operator decision)

Recommended: **CT150** (`halo`, same GPU and NPU as production), fresh
install of the 1.4 build that will ship, seed slots only (`agent`, `brain`,
`embed`, `rerank`, `img`, `tts`, `stt`), public models only (the shipped
defaults: Qwen3.8 27B or the smaller seed, LFM2.5 brain, bge reranker,
sdxl-turbo), `public_url` unset, an `agents` memory bank with a few
public-safe memories for the graph shot, one `/v1` request burst for the
requests widget. Production CT105 slots must be unloaded first (shared
124 GB). Mock mode (`VITE_MOCK_HAL0=1`) is the fallback but its fixtures
predate ADR-0029.

Shots to produce: dashboard-overview, slots-inference, slots-lifecycle,
slot-card, slot-profile-picker-open, slot-model-picker-open, slot-drawer,
model-edit-drawer, profile-edit-drawer, profiles-tab, mtp-control,
runner-images, stacks-tab, endpoints-tab, image-gen-comfyui, agents-overview,
memory-graph, mcp-tab, settings-security, settings-page, npu-occupancy,
unified-memory-hero, requests-latency-widget.

Every PNG is reviewed for hostnames, keys, model names and slot names
before commit.

## 5. Version guard

`scripts/sync-changelog.mjs` fetches the GitHub releases list
(`https://api.github.com/repos/hal0ai/hal0/releases?per_page=100`, with
`GITHUB_TOKEN` when present) and writes `src/data/release-tags.json`
(`{ "tags": ["v1.3.0", ...], "fetched_at": ... }`), falling back to the
committed file. `parseChangelog` gains `latestTagged`: the first version
heading whose `vX.Y.Z` tag exists. Hero eyebrow, JSON-LD, ship banner and
footer use `latestTagged`. Untagged headings still render on `/changelog`
with an "unreleased" badge instead of "stable". Unit test in
`scripts/test/changelog-version.test.mjs`.

## 6. Execution plan (after approval)

Branch: this worktree (`potent-honey`), one PR, squash-merge. Commits are
one concern each. Waves respect the 8-agent cap.

Wave 1 (parallel, sonnet unless noted):
- A. Version guard + changelog snapshot refresh + changelog page copy and
  Highlights block (sonnet).
- B. Landing page rewrite per §3.1 (opus; the copy is the product).
- C. Removals + README + NOTES + profiles pages + benchmarks banner (sonnet).
- D. Capture-script changes per §4.1 and the Docker runner script (sonnet).
- E. Release blog post draft from `product-delta.md` §F (sonnet).

Wave 2:
- F. Build + `astro check` + `npm test`; fix fallout (lead).
- G. Review by `cavecrew-reviewer` / opus against the product repo: every
  claim traced (opus).
- H. Screenshot capture on the chosen box (lead, gated on §4.3), PNG review,
  wire new shots into landing, blog post, OG unchanged.

Wave 3:
- I. Vercel preview deploy, visual pass light and dark at phone and desktop
  widths (`scripts/audit-screens.mjs`), Lighthouse spot-check.
- J. PR; CI green; merge when v1.4.0 is tagged (the version guard makes an
  earlier merge safe, but the blog post date and "1.4" copy should wait).

## 7. Operator decisions needed

1. Capture box: CT150 fresh install as in §4.3, or mock fixtures?
2. First-run guide: delete + redirect (recommended) or rewrite for 1.4?
3. Lemonade mentions in the mirrored changelog: leave (already public in the
   product repo), or scrub there first and re-sync?
4. Merge timing: hold the PR until v1.4.0 is tagged (recommended), or merge
   early behind the version guard with the 1.4 copy phrased as "coming"?
5. Blog archive: keep the two beta-line posts (recommended) or delete?
