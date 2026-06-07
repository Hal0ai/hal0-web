# hal0-web — Prioritized Backlog

**Synthesised:** 2026-06-07 (WEB-SYNTH, Opus). Cross-references the WA1 content map + WA2 quality
audit, each load-bearing claim re-verified against the `/home/halo/dev/hal0` backend source.
Backend at `v0.3.2-alpha.1` (`git describe` → `v0.3.2-alpha.1-151-g5a77ff1`).

**Legend:** `[effort S/M/L]` `[impact H/M/L]`. Effort = author time; impact = user/OSS harm if unfixed.

**Verification notes that changed the audit:**
- `SlotState` lives in `src/hal0/slots/state.py` (audit M1 cited `models.py` — wrong file). All 9
  states incl. `STARTING` at L63 confirmed.
- The `hal0-slot@.service` template is **confirmed removed from the installer**:
  `installer/install.sh:655` — *"hal0-slot@.service template removed in PR-9 (v0.2 retires
  per-modality toolbox containers)"*. Installer ships `hal0-api` + `hal0-lemonade` +
  `hal0-openwebui` (+ `hal0-agent@`). The `unit_template.py` source file and the `uninstall.sh:207`
  cleanup line are **vestigial** — they do NOT mean slot@ ships. H2/M7 stand. The *slot
  state-machine concept* is still live; only "slot = one `hal0-slot@` unit" is stale.
- `_VALID_PROVIDERS` = `{lemonade, llama-server, flm, moonshine, kokoro}`
  (`src/hal0/config/schema.py:89`). No `llama.cpp`, no `comfyui`. H3 confirmed.
- HF pull is fully implemented (`src/hal0/api/routes/models.py` pull machinery). M4 (501 stale) confirmed.
- 9 docs pages carry "Coming soon" stubs (audit said "at least 3").
- README "Layout" section lists 7 nonexistent components — stale (new finding, B7).

---

## HIGH — fix before next public release

### B1 — Delete the auth/Caddy page; it documents a feature removed in v0.3
`[effort M][impact H]`
- **Files:** `src/content/docs/docs/operate/auth.mdx` (entire file); `getting-started/install.mdx:213-227`
- Caddy/basic_auth/`--auth=basic` removed in ADR-0012 (v0.3). The installer has no `--auth` flag.
- **Action:** Delete `auth.mdx`. Replace `install.mdx:213-227` with "auth is out of scope; front
  with an upstream reverse proxy (Traefik/Caddy)." Optionally add a short "Securing hal0" page.

### B2 — Scrub private homelab IPs + `thinmint.dev` domain from public repo
`[effort S][impact H]`
- **Files:** `operate/auth.mdx:31,331,337` (`10.0.1.230`, `*.thinmint.dev` — gone with B1);
  `operate/openwebui.mdx:79,81` (`hal0.thinmint.dev`); `astro.config.mjs:93`
  (`allowedHosts: [...'.thinmint.dev']`)
- **Action:** openwebui.mdx → `hal0.local` / `hal0.homelab.example`. astro.config.mjs:93 →
  `localhost` only (or comment how to add a custom host). Deleting auth.mdx (B1) removes the rest.

### B3 — Correct invalid `--provider` / `provider =` values in copy-paste examples
`[effort S][impact H]`
- **Files:** `hardware/amd-discrete.mdx:69` (`llama-cpp-rocm`), `hardware/nvidia.mdx:160`
  (`llama-cpp`), `reference/config-schema.mdx:50` (`provider = "llama.cpp"` + bad comment listing
  `comfyui`)
- Valid set is `{lemonade, llama-server, flm, moonshine, kokoro}` (`schema.py:89`). Every cited
  value errors on validation. ROCm is `llama-server` + a backend/`extra_args` flag, not a provider.
- **Action:** Replace all three with valid values; note `lemonade` is the v0.2+ default provider.

### B4 — Sweep stale version strings (backend is v0.3.2-alpha.1)
`[effort S][impact H]`
- **Files:** `src/pages/index.astro:13` (`v0.2.0-alpha.3`) AND prose at `index.astro:364`
  (v0.1.1), `index.astro:809` ("as v0.2 lands"); `docs/index.mdx` (v0.1.0-alpha.1);
  `operate/updates.mdx:14` (v0.1.0-alpha.1); `reference/provider-matrix.mdx` ("as of v0.1.0-alpha.1")
- **Action:** Update all to `v0.3.2-alpha.1`. Longer-term: build-time inject from a single
  `versions.json` / GitHub releases API so this can't drift again (see B12).

### B5 — Rewrite slot docs from the "one `hal0-slot@` unit" model to the lemond-managed model
`[effort L][impact H]`
- **Files:** `slots/what-is-a-slot.mdx`; `getting-started/install.mdx:137-148`;
  `reference/config-schema.mdx`; `reference/provider-matrix.mdx`
- The word "Lemonade" appears **zero times** in the web docs, yet `lemond`
  (`hal0-lemonade.service`) manages slot child processes. The `hal0-slot@.service` template is
  removed (`install.sh:655`). The slot *state machine concept* remains valid — keep it; rewrite
  only the "slot = one systemd unit" claim and the provider class list.
- **Action:** Largest item. Reframe: slots are TOML descriptors + provider tags; `lemond` runs the
  processes; provider names match `_VALID_PROVIDERS`. Pair with B3/B6/B8.

---

## MEDIUM

### B6 — Remove `hal0-slot@.service` from install step 5
`[effort S][impact M]`
- **File:** `getting-started/install.mdx:137-148` (line 139 lists it as a dropped unit)
- `install.sh:655` confirms the template was removed in PR-9. Installer writes
  `hal0-api` + `hal0-lemonade` + `hal0-openwebui` (+ `hal0-agent@`).
- **Action:** Replace with the real unit set; note `hal0-lemonade.service` (lemond) manages slots.
  (Sub-item of B5, called out for the install page specifically.)

### B7 — Add the `starting` state to the lifecycle diagram
`[effort S][impact M]`
- **File:** `slots/what-is-a-slot.mdx` (lifecycle diagram)
- `SlotState` (`src/hal0/slots/state.py:63`) has `STARTING` between `PULLING` and `WARMING`. Diagram
  shows `pulling → warming`. Users will see a dashboard state the docs never explain.
- **Action:** Insert `starting` ("backend process launched, loading weights"). Note: the full
  `reference/slot-lifecycle.mdx` already lists all 9 — only `what-is-a-slot.mdx` is short.

### B8 — Fix default model path `/mnt/ai-models` → `/var/lib/hal0/models/`
`[effort S][impact M]`
- **Files:** `slots/what-is-a-slot.mdx:110-111`, `slots/model-registry.mdx:13`,
  `slots/huggingface-pulls.mdx:59-60`
- `models_dir()` (`src/hal0/config/paths.py:120-121`) returns `/var/lib/hal0/models/`.
  `/mnt/ai-models` is the author's LXC-specific NFS mount, not stock.
- **Action:** Replace in all three; add "(or `--models-dir` override)".

### B9 — Mark `HAL0_OPENWEBUI_PORT` as dev-only, not a production override
`[effort S][impact M]`
- **File:** `getting-started/install.mdx:109,194`
- `installer/README.md:82-88`: the var is honored only by `scripts/dev-bootstrap.sh`; the installed
  `hal0-openwebui.service` hardcodes `:3001`.
- **Action:** Annotate the override-table row as dev-mode only.

### B10 — Update HF-pull status table (501 is stale; pull is implemented)
`[effort S][impact M]`
- **File:** `slots/huggingface-pulls.mdx`
- Backend has full HF pull (`src/hal0/api/routes/models.py` — `_run_pull_with_events`,
  `_resolve_pull_source`, etc.). 501 was a v0.1 placeholder.
- **Action:** Verify live endpoint behavior, then drop the 501 stub from the status table.

### B11 — Agents/MCP featured on the landing roadmap with no docs pages → 404 risk
`[effort M][impact M]`
- **Files:** `src/pages/index.astro` (roadmap/agents section); missing `docs/agents/`, `docs/mcp/`,
  `docs/operate/approvals/` (confirmed absent — `docs/` has only api/getting-started/hardware/
  operate/reference/slots)
- **Action:** Either add stub pages ("Coming soon") or have the roadmap link to GitHub
  milestones/issues instead of implying docs exist. Don't link to nonexistent routes.

---

## LOW — polish, OSS-readiness, SEO

### B12 — No single source of truth for version → introduce one
`[effort M][impact L]`
- **Files:** all of B4's targets
- **Action:** Build-time inject version from `versions.json` or the GitHub releases API. Prevents
  the recurring drift B4 fixes by hand.

### B13 — Stale README "Layout" section lists components that don't exist
`[effort S][impact L]`
- **File:** `README.md:28-61`
- Lists `HeroSection`, `FeatureGrid`, `FeatureCard`, `HardwareMatrix`, `RoadmapColumn`,
  `RoadmapCard`, `ComparisonTable` — none exist (only 7 real components; see WEBSITE-NAVIGATION §4).
  Also states version "as of v0.1.0-alpha.1" (L131).
- **Action:** Regenerate the Layout tree from the real filesystem; bump the version reference.

### B14 — 9 "Coming soon" stub pages indexed by search engines
`[effort M][impact L]`
- **Files:** `docs/index.mdx`, `slots/model-registry.mdx`, `slots/custom-slots.mdx`,
  `slots/huggingface-pulls.mdx`, `api/audio.mdx`, `operate/config.mdx`, `operate/logs.mdx`,
  `operate/openwebui.mdx`, `reference/config-schema.mdx`
- (Audit estimated "at least 3"; grep found 9.)
- **Action:** Flesh out or add `noindex` to genuinely empty stubs; consider consolidating.

### B15 — Most docs pages lack per-page OG/Twitter/JSON-LD metadata
`[effort M][impact L]`
- **Files:** most `src/content/docs/docs/**/*.mdx` frontmatter
- `install.mdx` has a `TechArticle` JSON-LD block (good template). Site-wide OG defaults exist in
  `astro.config.mjs:72-85`, but per-page social cards are thin.
- **Action:** Ensure every page has a `description`; add JSON-LD to the 5-10 highest-traffic pages
  (install, strix-halo, first-model, first-chat).

### B16 — Orphaned screenshots not referenced anywhere
`[effort S][impact L]`
- **Files:** `public/screenshots/agent-inbox.png`, `public/screenshots/agent-inbox@2x.png`
- `grep -rn "agent-inbox" src/` → no hits.
- **Action:** Link from a relevant page or delete.

### B17 — `HAL0_USER` default column wrong in the overrides table
`[effort S][impact L]`
- **File:** `getting-started/install.mdx:195`
- Table says default `hal0`; installer runs as `root` and writes `User=hal0` into units
  (`installer/README.md:40`). Minor operator confusion.
- **Action:** Clarify `HAL0_USER` = service user; installer itself runs as root.

---

## Suggested execution order

1. **One sweep, high impact, low effort:** B2, B3, B4, B8, B9, B17 (all S, mostly find/replace).
2. **Deletions/structural:** B1 (+B6), B7, B10, B16.
3. **Big content rewrite:** B5 (slots → lemond model) — pull B3/B6/B8 into it.
4. **Followups:** B11, B12, B13, B14, B15.
