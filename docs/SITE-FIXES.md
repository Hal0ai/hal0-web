# hal0-web — Site Fix Tracker

> **Living task list** for bringing the website back in sync with the backend (v0.3.2-alpha.1).
> Source: website↔backend drift pass, 2026-06-07 → `~/.graphify/crosslink/DRIFT-REPORT.md` (+ `crosslink-edges.json`).
> **Progress: 0 / 62 items — last updated 2026-06-07** (36 drift fixes · 13 content-adds · 13 website self-audit)

## How to work this list (cross-session)
- This committed file **is** the tracker — any session reads it, does fixes, checks items, and **commits**. Git history = the multi-day record.
- Mark done: `- [x]` and append ` ✓ <YYYY-MM-DD> <note/commit>`.
- **⛔ BLOCKED** items wait on a *backend* decision (backend code↔docs disagree) — do **not** edit the site to match either side until the backend reconciles. Don't penalise the site for matching live code.
- Each item carries the website `file:line`. Use `cd ~/dev/hal0-web && graphify query "<topic>"` (or the `graphify-web` MCP lens via Hermes) to locate, and `graphify query "<topic>"` in `~/dev/hal0` to confirm backend truth before editing.
- Re-run the drift pass after a batch: it regenerates `DRIFT-REPORT.md`; reconcile against this tracker.
- Add a line to the **Session log** at the bottom each working session.

---

## 🔴 HIGH — wrong / broken, fix first
- [ ] **Dashboard framework wrong** — "Vue 3" → **React 18 + TypeScript + Vite** · `src/pages/index.astro:64`
- [ ] **Version eyebrow 1–2 minors stale** → `0.3.2-alpha.1` (sweep ALL version strings; ideally template from release manifest) · `src/pages/index.astro:13`, `src/content/docs/docs/index.mdx:16`, `src/content/docs/docs/operate/updates.mdx:13`
- [ ] **Caddy / `--auth=basic` / auto-HTTPS = broken install** — entire auth/TLS subsystem retired (ADR-0012; API binds `0.0.0.0:8080` open). Delete/rewrite to the honest `no-auth-default` story · `src/pages/index.astro:361`, `src/content/docs/docs/operate/auth.mdx:228,288`
- [ ] **Per-slot toolbox containers / `hal0-slot@.service` / 6 published images** — superseded by the single `lemond` runtime; slots are logical name→model mappings. Rewrite slot + provider-matrix docs · `getting-started/install.mdx:154`, `reference/provider-matrix.mdx:31`, `slots/what-is-a-slot.mdx:53`, `custom-slots.mdx:65`
- [ ] **Provider matrix = pre-Lemonade set** (Moonshine/ComfyUI/Kokoro first-class) — rewrite around Lemonade-unified runtime · `reference/provider-matrix.mdx:12,39,62,76,90,99,110`, `api/audio.mdx:15`
- [ ] **Hermes-Agent labelled "(roadmap: soon)" but SHIPPED** — promote to shipped; document install + dashboard chat surface · `src/pages/index.astro:346`

## ⛔ BLOCKED — backend must reconcile code↔docs first (do NOT edit site yet)
- [ ] **Image gen: ComfyUI vs sd-cpp** — route code calls `get_provider("comfyui")` (`v1.py:1054,1076`) but README says `sd-cpp`/Flux-2-Klein-9B. Backend decides which truly serves `/v1/images/generations`, then align site · `api/images-generation.mdx:35,51,57`
- [ ] **Slot port range 8081–8099** — `CONTEXT.md` says unused; code still wires it (`slots/manager.py:1131,1138`). Backend removes/documents, then update site · `slots/what-is-a-slot.mdx:53`, `custom-slots.mdx:65`

## 🟡 MEDIUM
- [ ] **`/mcp/admin` shipped, labelled "soon"** — split the claim: inbound `/mcp/admin` shipped, *outbound* MCP host still roadmap (501 stub) · `src/pages/index.astro:351`
- [ ] **Cognee memory: present-but-gated, not "soon"** — describe as "present, opt-in via `HAL0_MEMORY_ENABLED=1`" · `src/pages/index.astro:348`
- [ ] **MCP tool counts "22 admin + 4 memory" unverified/stale** — verify vs live catalog or soften wording · `src/pages/index.astro:342`
- [ ] **Dashboard "9 views" stale** — re-enumerate vs `ui/src/dash/*` (22 files; "Providers"→Connections) · `CONTENT_BRIEF.md:197`
- [ ] **STT = Moonshine** → whisper.cpp via Lemonade · `api/audio.mdx:15`, `reference/provider-matrix.mdx:76`
- [ ] **NVIDIA "Vulkan-only, CUDA not published"** — backend has CUDA via Lemonade; rewrite · `hardware/nvidia.mdx:23,24,51`
- [ ] **KV-cache gauge synthesis (b9279)** — GPU slots show `—`; KV% is NPU-only in v0.3 · `src/pages/index.astro:386`
- [ ] **Installer: picks CUDA backend / writes systemd / needs Docker** — Docker is now a *soft* dep; backend via Lemonade · `getting-started/install.mdx:24,116,121`
- [ ] **Dashboard "docker cgroup memory" / per-slot TTFT metric source** — metrics now from Lemonade (Proxmox segment is fine) · `src/pages/index.astro:298,382`
- [ ] **Rerank `:8086 --reranking` standalone-server framing** — it's a Lemonade `reranking`-type slot; drop `:8086` detail (endpoint + model name are correct) · `api/openai-compat.mdx:25`, `src/pages/index.astro:296`
- [ ] **"5 built-in slots" vs backend seeds 6** (rerank is its own slot) · `slots/built-in-slots.mdx:12`
- [ ] **`hf-pull` still "501"** — `POST /api/models/{id}/pull` now returns 202 async job · `huggingface-pulls.mdx:17`

## 🟢 LOW
- [ ] **"Installer being overhauled — relaunching soon" hero** — installer is functional; update/remove banner · `src/pages/index.astro:424`
- [ ] **`flm-npu-provider` "default port 8086 / toolbox :v1"** — FLM runs via `flm serve` (one process, `--asr 1 --embed 1`); fix to the trio model · `reference/provider-matrix.mdx:62`

## ➕ ADD — shipped backend features with NO website coverage
_(Most marketing-worthy first. Each is real + user-facing.)_
- [ ] **OmniRouter** — opt-in `omni:true`, 8 tools incl. `route_to_chat` · backend `omni_router/tool_definitions.json`, `v1.py:686`
- [ ] **Per-persona spending caps** — Budget + append-only BudgetLedger, REST · `agents/budget.py`
- [ ] **Bundle-tier first-run picker** — Lite/Default/Pro/Max/LMX-Omni, RAM-gated · `api/routes/bundles.py:46-82`
- [ ] **NPU FLM trio** — agent + stt-npu + embed-npu from one `flm serve` · `CONTEXT.md:115-136`
- [ ] **Bundled pi-coder agent** (single-pick with Hermes) · `agents/pi_coder.py`
- [ ] **Lemonade admin panel** — `GET/POST /api/lemonade/config` · `api/routes/lemonade_admin.py:297`
- [ ] **Prometheus metrics endpoint** · `api/routes/health.py:112`
- [ ] **Merged journal SSE** — `/api/journal` + `/stream` + Lemonade log proxy · `api/routes/journal.py:203`
- [ ] **HMAC session cookie** for agents chat proxy (HttpOnly, SameSite=Lax, 8h) · `api/agents/_auth.py`
- [ ] **Silent-eviction dispatcher recovery** — retry-once on mid-stream 502 · `CHANGELOG.md:112-117`
- [ ] **HF search proxy** — `GET /api/hf/search` · `api/routes/hf.py:156`
- [ ] **User-defined slot creation** — `hal0 slot create … --type --model` · `api/routes/slots.py:552`
- [ ] **OpenRouter OAuth callback** (501 scaffold, ADR-0020 Phase 0 — mark as roadmap) · `api/openrouter/auth.py:22-49`

---

## 🔍 Website self-audit (B-series) — from `docs/audit-2026-06-07/WEBSITE-BACKLOG.md`
_New items beyond the drift report. Full detail + verification notes in the backlog doc._

### 🔴 HIGH — OSS / broken copy-paste
- [ ] **B2 — Scrub private IPs/domains from the website repo** · `astro.config.mjs:93` (`allowedHosts ['.thinmint.dev']` → localhost) · `operate/openwebui.mdx:79,81` (`hal0.thinmint.dev` → `hal0.local`) · `operate/auth.mdx:31,331,337` (`10.0.1.230` — goes away with B1)
- [ ] **B3 — Fix invalid `--provider` / `provider =` examples (they error on validation)** · valid set `{lemonade,llama-server,flm,moonshine,kokoro}` · `hardware/amd-discrete.mdx:69`, `hardware/nvidia.mdx:160`, `reference/config-schema.mdx:50`

### 🟡 MEDIUM
- [ ] **B6 — Remove `hal0-slot@.service` from install step 5** (template removed PR-9) · `getting-started/install.mdx:137-148`
- [ ] **B7 — Add `starting` state to the lifecycle diagram** · `slots/what-is-a-slot.mdx`
- [ ] **B8 — Default model path `/mnt/ai-models` → `/var/lib/hal0/models/`** · `slots/what-is-a-slot.mdx:110`, `model-registry.mdx:13`, `huggingface-pulls.mdx:59`
- [ ] **B9 — Mark `HAL0_OPENWEBUI_PORT` dev-only** (installed unit hardcodes :3001) · `getting-started/install.mdx:109,194`
- [ ] **B11 — Roadmap links to nonexistent `docs/agents`,`docs/mcp` → 404 risk** — add stubs or link to GitHub · `src/pages/index.astro`

### 🟢 LOW — polish / SEO / OSS
- [ ] **B12 — Single source of truth for version** (build-time inject; prevents recurring version drift)
- [ ] **B13 — README "Layout" lists 7 nonexistent components** · `README.md:28-61`
- [ ] **B14 — 9 "Coming soon" stubs indexed by search** — flesh out or `noindex`
- [ ] **B15 — Thin per-page OG/Twitter/JSON-LD metadata** — add to top pages (install, strix-halo, first-chat)
- [ ] **B16 — Orphaned screenshots** (`public/screenshots/agent-inbox*.png`) — link or delete
- [ ] **B17 — `HAL0_USER` default column wrong** (installer runs as root, writes `User=hal0`) · `getting-started/install.mdx:195`

> Overlaps already tracked above: B1≈Caddy/auth · B4≈version sweep · B5≈slot-docs rewrite · B10≈hf-pull-501.
> **Suggested first sweep** (all low-effort find/replace): **B2, B3, B4, B8, B9, B17.**

## Notes
- **39 claims ALIGNED** (correct) — left untouched: OpenAI-compat endpoint surface, slot-as-model routing, SSE+single-flight, cosign self-update/rollback, OpenWebUI on :3001, Proxmox overlay, `no-auth-default`, bge-reranker model name, 258 tok/s Strix Halo perf, Apache-2.0, and the correctly-roadmapped items (LoRA, multi-host, OIDC).
- **Reference docs:** full website audit in `docs/audit-2026-06-07/` (`WEBSITE-NAVIGATION.md` = where-to-edit index, `WEBSITE-BACKLOG.md` = verified backlog, `web-content-map.md`, `web-quality.md`). Cross-repo drift detail in `~/.graphify/crosslink/DRIFT-REPORT.md`.

## Session log
- **2026-06-07** — Tracker created from the cross-link drift report (15 overclaim · 9 contradiction · 14 stale · 13 undocumented · 39 aligned). 36 fixes + 13 content-adds queued.
- **2026-06-07** — Folded in the website self-audit (B-series, 13 items incl. B2 private-IP leak in `astro.config.mjs`, B3 broken `--provider` examples). hal0-web graph enriched with 74 content concepts (now queryable via Hermes `graphify-web`). 62 items total, none started.
