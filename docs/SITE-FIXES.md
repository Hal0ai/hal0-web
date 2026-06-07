# hal0-web — Site Fix Tracker

> **Living task list** for bringing the website back in sync with the backend (v0.3.2-alpha.1).
> Source: website↔backend drift pass, 2026-06-07 → `~/.graphify/crosslink/DRIFT-REPORT.md` (+ `crosslink-edges.json`).
> **Progress: 0 / 36 fixes · 0 / 13 content-adds — last updated 2026-06-07**

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

## Notes
- **39 claims ALIGNED** (correct) — left untouched: OpenAI-compat endpoint surface, slot-as-model routing, SSE+single-flight, cosign self-update/rollback, OpenWebUI on :3001, Proxmox overlay, `no-auth-default`, bge-reranker model name, 258 tok/s Strix Halo perf, Apache-2.0, and the correctly-roadmapped items (LoRA, multi-host, OIDC).
- **Pending merge:** the hal0-web audit workflow (`wnu1g4unh`) will add a `WEBSITE-BACKLOG.md` (content gaps, structure, SEO, OSS polish) — fold its items in here when it lands.

## Session log
- **2026-06-07** — Tracker created from the cross-link drift report (15 overclaim · 9 contradiction · 14 stale · 13 undocumented · 39 aligned). 36 fixes + 13 content-adds queued. None started.
