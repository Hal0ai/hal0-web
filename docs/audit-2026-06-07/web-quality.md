# hal0-web Quality & OSS-Readiness Audit — 2026-06-07

**Auditor:** WA2 (Sonnet 4.6)
**Scope:** `/home/halo/dev/hal0-web` — Astro/Starlight marketing + docs site
**Cross-referenced against:** `/home/halo/dev/hal0` backend (HEAD on `chore/graphify-codebase-map`)
**Total findings:** 18

---

## CRITICAL / HIGH (must fix before next public release)

---

### H1 — Auth & Caddy docs describe features removed in v0.3 (ADR-0012)

**Files:**
- `src/content/docs/docs/operate/auth.mdx` (entire file)
- `src/content/docs/docs/getting-started/install.mdx:213-227`

**Evidence:**
- `install.mdx` lines 213–227 document `--auth=basic` installer flag, Caddy install, Let's Encrypt cert, and Bearer tokens. This flag does not exist in the installer (`installer/install.sh` has no `--auth` flag).
- `auth.mdx` documents Caddy basic_auth, TLS, Bearer token generation, and middleware as live features.
- `CHANGELOG.md` lines 351–353: *"Caddy is gone. The installer no longer installs Caddy or renders a Caddyfile."*
- `ARCHITECTURE.md` line 78: *"ADR-0012 removed `auth/` + `api/auth/` + `api/middleware/auth.py` — hal0-api binds `0.0.0.0:8080` open"*

**Action:** Delete `auth.mdx`. Replace `install.mdx:213-227` with a note that auth is out of scope and delegate to an upstream reverse proxy (Traefik/Caddy). Link to a new "Securing hal0" page that covers the reverse-proxy pattern.

---

### H2 — Entire slot architecture docs describe pre-Lemonade architecture (v0.1 era)

**Files:**
- `src/content/docs/docs/getting-started/install.mdx:137-148` (install step 5)
- `src/content/docs/docs/slots/what-is-a-slot.mdx`
- `src/content/docs/docs/reference/config-schema.mdx`
- `src/content/docs/docs/reference/provider-matrix.mdx`

**Evidence:**
- `install.mdx` line 139 says the installer drops `hal0-slot@.service` template. The installer source explicitly notes: *"hal0-slot@.service template removed in PR-9 (v0.2 retires per-modality toolbox containers — see docs/internal/adr/0008-lemonade-adoption.md)"*. The actual running slot manager is `lemond` (Lemonade daemon).
- Web docs describe five provider classes (`llama.cpp`, `flm`, `moonshine`, `kokoro`, `comfyui`) as "first-class slot backends." The actual backend provider enum (`SlotProvider`) has: `llama-server`, `flm`, `moonshine`, `kokoro`. The config schema validator (`_VALID_PROVIDERS` frozenset in `src/hal0/config/schema.py:89`) has: `lemonade`, `llama-server`, `flm`, `moonshine`, `kokoro`. Neither `"llama.cpp"` nor `"comfyui"` are valid today.
- The word "Lemonade" appears **zero times** in the entire web docs site.

**Action:** This is a full-section rewrite. The slots docs must be updated to reflect the Lemonade-backed architecture: `lemond` manages slot processes, slots are TOML descriptors + provider tags, the `hal0-slot@.service` template is gone. The provider names must match `SlotProvider` enum values. This is the highest-effort fix.

---

### H3 — Wrong provider names in CLI examples (invalid `--provider` values)

**Files:**
- `src/content/docs/docs/hardware/amd-discrete.mdx:69`
- `src/content/docs/docs/hardware/nvidia.mdx:160`
- `src/content/docs/docs/reference/config-schema.mdx:50`

**Evidence:**
- `amd-discrete.mdx:69`: `hal0 slot swap primary --provider llama-cpp-rocm` — `"llama-cpp-rocm"` is not in `SlotProvider` enum.
- `nvidia.mdx:160`: `hal0 slot swap primary --provider llama-cpp` — `"llama-cpp"` is not valid; correct value is `"llama-server"`.
- `config-schema.mdx:50`: `provider = "llama.cpp"` with comment `# one of: llama.cpp, flm, moonshine, kokoro, comfyui` — `"llama.cpp"` is not valid (should be `"llama-server"`); `"comfyui"` is not in the schema validator.

A user copy-pasting any of these examples will get a validation error.

**Action:** Replace all three with valid `SlotProvider` values. For ROCm hardware: the correct provider is `"llama-server"` with a `[model.extra_args]` ROCm flag, not a separate provider name. Add a note that provider selection is `"lemonade"` (Lemonade-managed) or explicit backend for legacy installs.

---

### H4 — Version staleness: landing page and two docs pages show v0.1/v0.2 as current

**Files:**
- `src/pages/index.astro:13` — `const version = 'v0.2.0-alpha.3'`
- `src/content/docs/docs/index.mdx` (status block) — `"v0.1.0-alpha.1 (tagged 2026-05-21)"`
- `src/content/docs/docs/operate/updates.mdx:14` — `"The current release (as of 2026-05-22) is v0.1.0-alpha.1"`

**Evidence:** Backend is at `0.3.2-alpha.1` (confirmed via `git describe` on `/home/halo/dev/hal0`). The landing page and docs index reference releases from 2 major milestones ago.

**Action:** Automate version injection via a `versions.json` build step or a single constant pulled from the GitHub releases API at build time. In the meantime update all three manually to `v0.3.2-alpha.1`.

---

### H5 — Private homelab IPs and domains in public-facing docs

**Files:**
- `src/content/docs/docs/operate/auth.mdx:31,331,337` — `*.thinmint.dev` + `10.0.1.230`
- `src/content/docs/docs/operate/openwebui.mdx:79,81` — `*.thinmint.dev`
- `astro.config.mjs:93` — `allowedHosts: ['hal0-web.thinmint.dev', 'localhost', '.thinmint.dev']`

**Detail:**
- `auth.mdx` already captured under H1 (entire file should be deleted, taking the IPs/domains with it).
- `openwebui.mdx:79,81` uses `hal0.thinmint.dev` as the example URL in a code block. This is the author's private LAN domain — public users will be confused when they see a domain they don't own. Replace with `hal0.local` or `hal0.homelab.example`.
- `astro.config.mjs:93` commits the private `thinmint.dev` domain into the Vite dev server `allowedHosts`. This is a dev-mode config (not rendered to users), but it identifies the author's private network in the OSS repository. Replace with `localhost` only or a comment explaining how to configure for custom hostnames.

**Action:** Delete `auth.mdx` (H1), fix `openwebui.mdx` to use placeholder hostnames, replace `astro.config.mjs:93` allowedHosts with generic values.

---

## MEDIUM (accuracy/usability issues, fix before the page is relied on)

---

### M1 — Slot lifecycle diagram omits the `starting` state

**File:** `src/content/docs/docs/slots/what-is-a-slot.mdx`

**Evidence:** The lifecycle diagram shows: `offline → pulling → warming → ready → serving ↔ idle → unloading`. The backend `SlotState` enum (`src/hal0/slots/models.py`) has a `STARTING` state between `PULLING` and `WARMING`. Users reading the docs and watching the dashboard will see a state the diagram doesn't explain.

**Action:** Add `starting` between `pulling` and `warming` in the diagram and add a brief description ("the backend process has launched and is loading weights").

---

### M2 — Model path `/mnt/ai-models` presented as the default; actual default is `/var/lib/hal0/models/`

**Files:**
- `src/content/docs/docs/slots/what-is-a-slot.mdx:110-111`
- `src/content/docs/docs/slots/model-registry.mdx:13`
- `src/content/docs/docs/slots/huggingface-pulls.mdx:59-60`

**Evidence:** All three pages describe `/mnt/ai-models` as where weights live. The actual `models_dir()` function in `src/hal0/config/paths.py:120` returns `/var/lib/hal0/models/`. `/mnt/ai-models` is the author's LXC-specific ZFS NFS mount. The install guide correctly says `--models-dir=/srv/models` overrides are optional — but the slots docs imply `/mnt/ai-models` is stock.

**Action:** Replace `/mnt/ai-models` with `/var/lib/hal0/models/` in all three places. Add a parenthetical like "(or `--models-dir` override value)".

---

### M3 — `HAL0_OPENWEBUI_PORT` documented as a production override — it is dev-only

**File:** `src/content/docs/docs/getting-started/install.mdx:109,194`

**Evidence:** The install page lists `HAL0_OPENWEBUI_PORT` in the Overrides table (line 194) as a production knob. `installer/README.md` lines 82–88 clarifies: *"`HAL0_OPENWEBUI_PORT` is honored by `scripts/dev-bootstrap.sh` (the dev-mode launcher). The installed `hal0-openwebui.service` hardcodes `:3001`"*.

**Action:** Add a note to the table entry for `HAL0_OPENWEBUI_PORT` that it only applies to dev-mode (`dev-bootstrap.sh`). In a production install, modify `hal0-openwebui.service` directly.

---

### M4 — HF pulls status table says arbitrary pulls return 501; backend has full implementation

**File:** `src/content/docs/docs/slots/huggingface-pulls.mdx`

**Evidence:** The page's status table marks arbitrary HF repo pulls as returning 501 (Not Implemented). The backend pull flow in `src/hal0/slots/` implements full HuggingFace pull support. The 501 may have been accurate at v0.1 but is stale.

**Action:** Verify the current pull endpoint behavior against the live backend, then update the status table. Remove the 501 stub description if the feature is shipped.

---

### M5 — `provider-matrix.mdx` still references `v0.1.0-alpha.1`

**File:** `src/content/docs/docs/reference/provider-matrix.mdx`

**Evidence:** "All five are first-class as of v0.1.0-alpha.1" — two major versions out of date. Compounds H2 (provider list is also wrong).

**Action:** Update to current version once provider matrix is corrected per H2.

---

### M6 — Agents/MCP prominently featured on landing page with no corresponding docs

**File:** `src/pages/index.astro` (roadmap section), `src/content/docs/docs/` (missing pages)

**Evidence:** The landing page roadmap section highlights agents, MCP server catalog, and admin approvals as shipped or shipping features. There are no docs pages for `/docs/agents/`, `/docs/mcp/`, or `/docs/operate/approvals/`. Users following landing-page navigation will hit 404s.

**Action:** Either add stub pages with "Coming soon" for genuinely upcoming features, or link directly to the relevant GitHub issues/milestones. Do not reference features in the hero/roadmap without at least a placeholder docs page.

---

### M7 — `hal0-slot@.service` listed as a dropped unit in install step 5 — it no longer ships

**File:** `src/content/docs/docs/getting-started/install.mdx:137-148`

This is a sub-finding of H2 but worth calling out separately for the install page specifically, since it shapes new-user expectations about what systemd units they will see after install.

**Evidence:** `install.mdx` line 139: *"Drops `hal0-api.service`, `hal0-openwebui.service`, and the `hal0-slot@.service` template into `/etc/systemd/system/`"*. The installer comments explicitly note this template was removed in PR-9.

**Action:** Remove `hal0-slot@.service` from the install step list. Update to reflect that Lemonade (`lemond.service`) manages slot child processes.

---

## LOW (polish, OSS-readiness, SEO)

---

### L1 — Orphaned screenshots not referenced in any docs page

**Files:**
- `public/screenshots/agent-inbox.png`
- `public/screenshots/agent-inbox@2x.png`

**Evidence:** `grep -rn "agent-inbox" src/` returns no results. These images are in the public dir but not linked from any page. They will be served at a public URL but waste storage and can confuse maintainers.

**Action:** Either link them from a relevant page or delete them. If kept for future use, add a comment in the screenshots directory.

---

### L2 — Several "Coming soon — outline" stub pages offer no content to users or search engines

**Files:** Multiple pages under `src/content/docs/docs/` (confirmed at least 3 thin stubs)

**Evidence:** Pages with only a title and an Aside containing "Coming soon — outline" provide no value. Search engines will index and potentially rank these as low-quality pages.

**Action:** Either flesh out these pages or add `noindex` meta to the stub pages. Consider consolidating stubs into a single "Roadmap" page.

---

### L3 — SEO: most docs pages lack `twitter:title` / `twitter:description` / per-page OG metadata

**Files:** Most `src/content/docs/docs/**/*.mdx` frontmatter

**Evidence:** Starlight generates some meta from `title` and `description` frontmatter, but pages like `auth.mdx` and `index.mdx` lack social card metadata. The install page has a JSON-LD `TechArticle` block (good — use as template), but most pages don't.

**Action:** Add `description` to every page's frontmatter as a baseline. Consider adding `head` JSON-LD blocks for the 5-10 highest-traffic pages (install, hardware/strix-halo, first-model, first-chat).

---

### L4 — `HAL0_USER` default documented as `hal0`; installer defaults to `root`

**File:** `src/content/docs/docs/getting-started/install.mdx:195` (Overrides table)

**Evidence:** The table lists `HAL0_USER` default as `hal0`. The installer (`install.sh`) defaults `HAL0_USER` to `root` in the shebang environment, though the systemd units themselves declare `User=hal0`. This creates a minor confusion for operators trying to customize the service user.

**Action:** Clarify that `HAL0_USER` sets the *service user* (used in unit files), and the installer runs as root. Update the default column to match the actual installer default.

---

## Summary table

| ID | Severity | File(s) | One-line description |
|----|----------|---------|----------------------|
| H1 | HIGH | `operate/auth.mdx`, `install.mdx:213-227` | Auth/Caddy docs for feature removed in v0.3 |
| H2 | HIGH | `slots/*`, `install.mdx:137-148`, `reference/*` | Entire slot architecture docs describe pre-Lemonade v0.1 model |
| H3 | HIGH | `hardware/amd-discrete.mdx:69`, `nvidia.mdx:160`, `config-schema.mdx:50` | Invalid `--provider` values in CLI examples |
| H4 | HIGH | `index.astro:13`, `docs/index.mdx`, `updates.mdx:14` | Version staleness (v0.2 / v0.1 shown; backend is v0.3.2) |
| H5 | HIGH | `auth.mdx:31,331,337`, `openwebui.mdx:79,81`, `astro.config.mjs:93` | Private homelab IPs + `thinmint.dev` domain in public docs/config |
| M1 | MED | `what-is-a-slot.mdx` | Lifecycle diagram missing `starting` state |
| M2 | MED | `what-is-a-slot.mdx:110-111`, `model-registry.mdx:13`, `huggingface-pulls.mdx:59-60` | `/mnt/ai-models` presented as default path (actual: `/var/lib/hal0/models/`) |
| M3 | MED | `install.mdx:109,194` | `HAL0_OPENWEBUI_PORT` documented as production override (dev-only) |
| M4 | MED | `huggingface-pulls.mdx` | HF pull status table shows 501 — implementation may be shipped |
| M5 | MED | `provider-matrix.mdx` | References v0.1.0-alpha.1; also wrong provider list |
| M6 | MED | `index.astro` (roadmap), `docs/` (missing pages) | Agents/MCP featured on landing page with no docs pages — leads to 404s |
| M7 | MED | `install.mdx:139` | `hal0-slot@.service` listed as dropped unit — template removed in PR-9 |
| L1 | LOW | `public/screenshots/agent-inbox.png` (+@2x) | Orphaned screenshots not referenced anywhere |
| L2 | LOW | Multiple stub pages | "Coming soon — outline" stubs indexed by search engines |
| L3 | LOW | Most `docs/**/*.mdx` frontmatter | Missing per-page Twitter/OG/JSON-LD metadata |
| L4 | LOW | `install.mdx:195` | `HAL0_USER` default column incorrect |

---

*Generated by WA2 audit agent (Claude Sonnet 4.6) on 2026-06-07. Cross-references: `hal0/CHANGELOG.md`, `hal0/ARCHITECTURE.md`, `hal0/installer/install.sh`, `hal0/src/hal0/cli/slot_commands.py` (`SlotProvider` enum), `hal0/src/hal0/config/schema.py` (`_VALID_PROVIDERS`), `hal0/src/hal0/config/paths.py` (`models_dir()`).*
