# hal0-web Content & Concept Map
**Audit date:** 2026-06-07  
**Auditor role:** WA1 — Content & Concept Map  
**Repo:** /home/halo/dev/hal0-web  
**Site:** https://hal0.dev

---

## 1. Site Architecture Overview

The site is an **Astro + Starlight** project (`astro.config.mjs:L1`).

- **Marketing layer** — a single hand-crafted `src/pages/index.astro` using `MarketingLayout.astro`.  
- **Docs layer** — a Starlight-managed content collection at `src/content/docs/`, auto-generating sidebar navigation across 6 sections and 32 `.mdx/.md` pages.  
- **Edge middleware** — `functions/_middleware.ts` proxies the GitHub Releases manifest and handles auth headers for the `releases.hal0.dev` CDN.

---

## 2. Pages & Routes

### 2.1 Marketing / Landing

| Route | Source file | What it covers |
|-------|-------------|----------------|
| `/` | `src/pages/index.astro:L1` | Hero, perf strip, feature cards, provider stack, hardware tiers, loadout tabs, comparison table, roadmap, CTA footer |

The landing page is a single 2082-line Astro file. It is the primary marketing surface for hal0.  
Key data structures inside the file (all `const` declarations in the frontmatter):

- `features[]` — 6 feature cards (`src/pages/index.astro:L36`)
- `providers[]` — 5-row provider matrix (`src/pages/index.astro:L69`)
- `tiers[]` — 6 hardware tier cards (`src/pages/index.astro:L107`)
- `loadoutData` — 7 loadout tab sets (`src/pages/index.astro:L186`)
- `compareRows[]` — 10-row vs-alternatives table (`src/pages/index.astro:L252`)
- `themes[]` — 6 roadmap themes (`src/pages/index.astro:L272`)
- `shipNowHighlights[]` — 4 "shipping now" highlights (`src/pages/index.astro:L378`)

Canonical URL is `https://hal0.dev/` and a `SoftwareApplication` schema.org JSON-LD block is embedded (`src/pages/index.astro:L18`).

---

### 2.2 Docs — Getting Started

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/` | `src/content/docs/docs/index.mdx:L1` | — | Docs root; orientation card grid linking to Install, Strix Halo, Slot Architecture, API reference |
| `/docs/getting-started/install/` | `src/content/docs/docs/getting-started/install.mdx:L1` | 1 | One-line installer, pre-flight checks, HAL0_* env overrides, Proxmox VE LXC helper script, `hal0 status` post-install check |
| `/docs/getting-started/first-model/` | `src/content/docs/docs/getting-started/first-model.mdx:L1` | 2 | FirstRun wizard (8 linear steps), primary slot, model selection, hardware probe |
| `/docs/getting-started/first-chat/` | `src/content/docs/docs/getting-started/first-chat.mdx:L1` | 3 | Opening OpenWebUI on `:3001`, picking a model, sending first chat |

---

### 2.3 Docs — Hardware

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/hardware/overview/` | `src/content/docs/docs/hardware/overview.md:L1` | 1 | Four hardware tiers: Strix Halo, AMD discrete, NVIDIA, CPU-only; deployment shapes (LXC, bare metal, VM) |
| `/docs/hardware/strix-halo/` | `src/content/docs/docs/hardware/strix-halo.mdx:L1` | 2 | AMD Ryzen AI Max+ 395 reference platform; Radeon 8060S iGPU; XDNA NPU; 128 GB UMA; measured tok/s; Proxmox LXC passthrough; recommended loadouts |
| `/docs/hardware/amd-discrete/` | `src/content/docs/docs/hardware/amd-discrete.mdx:L1` | 3 | AMD RX 7900 XT/XTX; ROCm vs. Vulkan paths; rough edges |
| `/docs/hardware/nvidia/` | `src/content/docs/docs/hardware/nvidia.mdx:L1` | 4 | CUDA path for RTX 30/40/50 series; what works in v1; queued items |
| `/docs/hardware/cpu-only/` | `src/content/docs/docs/hardware/cpu-only.mdx:L1` | 5 | Fallback Vulkan-CPU path; small models; CI smoke tests |

---

### 2.4 Docs — Slots

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/slots/what-is-a-slot/` | `src/content/docs/docs/slots/what-is-a-slot.mdx:L1` | 1 | Slot definition: one inference workload, one systemd unit, one port on 127.0.0.1; lifecycle state machine; single-flight dispatch |
| `/docs/slots/built-in-slots/` | `src/content/docs/docs/slots/built-in-slots.mdx:L1` | 2 | The five built-in slots (primary, embed, stt, tts, img); default backends |
| `/docs/slots/custom-slots/` | `src/content/docs/docs/slots/custom-slots.mdx:L1` | 3 | Defining additional slots; second chat model scenario; NPU alongside iGPU; FLM/ComfyUI/vision slots |
| `/docs/slots/model-registry/` | `src/content/docs/docs/slots/model-registry.mdx:L1` | 5 | registry.toml on-disk index; `/var/lib/hal0/registry/`; model pull + verify; registry vs. server_models.json |
| `/docs/slots/huggingface-pulls/` | `src/content/docs/docs/slots/huggingface-pulls.mdx:L1` | 4 | POST /api/models/{id}/pull; FLM tag pulls; HF repo pulls (501 stub); SHA-256 atomic install |
| `/docs/slots/loadouts/` | `src/content/docs/docs/slots/loadouts.mdx:L1` | 6 | Curated starting loadouts by hardware tier: 128 GB Strix Halo, 64 GB SKU, 24 GB discrete, CPU-only; model size table |

---

### 2.5 Docs — API

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/api/openai-compat/` | `src/content/docs/docs/api/openai-compat.mdx:L1` | 1 | All /v1/* endpoints; curl examples; model listing; embeddings; rerank; STT; TTS; image gen; external upstreams; structured errors |
| `/docs/api/slot-as-model/` | `src/content/docs/docs/api/slot-as-model.mdx:L1` | 2 | `model` field addressing: slot name vs. registry ref; dispatcher routing |
| `/docs/api/streaming/` | `src/content/docs/docs/api/streaming.mdx:L1` | 3 | SSE streaming for /v1/chat/completions and /v1/completions; OpenAI protocol compatibility |
| `/docs/api/audio/` | `src/content/docs/docs/api/audio.mdx:L1` | 4 | /v1/audio/transcriptions (Moonshine STT); /v1/audio/speech (Kokoro TTS); OpenAI Audio shape |
| `/docs/api/images-generation/` | `src/content/docs/docs/api/images-generation.mdx:L1` | 5 | POST /v1/images/generations; ComfyUI provider; SDXL Turbo, SD 1.5, Flux Schnell; workflow templates |

---

### 2.6 Docs — Operate

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/operate/updates/` | `src/content/docs/docs/operate/updates.mdx:L1` | 1 | Cosign-verified atomic self-update; symlink swap; rollback; stable + nightly channels; releases.hal0.dev |
| `/docs/operate/logs/` | `src/content/docs/docs/operate/logs.mdx:L1` | 2 | journald logging; unit names; SSE log tail in dashboard; `journalctl` CLI access |
| `/docs/operate/config/` | `src/content/docs/docs/operate/config.mdx:L1` | 3 | Atomic TOML config under /etc/hal0; schema-validated; hot-reload; hal0.toml + capabilities.toml |
| `/docs/operate/openwebui/` | `src/content/docs/docs/operate/openwebui.mdx:L1` | 4 | Bundled OpenWebUI on :3001; prewired to hal0 API; why bundled |
| `/docs/operate/auth/` | `src/content/docs/docs/operate/auth.mdx:L1` | 5 | Default open posture (LAN); Caddy with basic_auth; Bearer tokens for API; automatic HTTPS (Let's Encrypt / internal CA) |

---

### 2.7 Docs — Reference

| Route | Source file | Sidebar order | Covers |
|-------|-------------|---------------|--------|
| `/docs/reference/cli/` | `src/content/docs/docs/reference/cli.mdx:L1` | 1 | Full CLI reference — every `hal0` subcommand grouped by area; Typer-based; talks to daemon on 127.0.0.1:8080 |
| `/docs/reference/config-schema/` | `src/content/docs/docs/reference/config-schema.mdx:L1` | 2 | Config schema: hal0.toml (API, paths, upstreams, update) and capabilities.toml (embed/voice/img/NPU) |
| `/docs/reference/provider-matrix/` | `src/content/docs/docs/reference/provider-matrix.mdx:L1` | 3 | All 5 providers (llama.cpp, FLM, Moonshine, Kokoro, ComfyUI); workloads; hardware targets; provider ABC interface |
| `/docs/reference/slot-lifecycle/` | `src/content/docs/docs/reference/slot-lifecycle.mdx:L1` | 4 | Complete slot state machine; legal transitions; LEGAL_TRANSITIONS; state.json persistence; SSE streaming |

---

## 3. Components

| Component | File | Purpose |
|-----------|------|---------|
| `MarketingLayout` | `src/layouts/MarketingLayout.astro:L1` | Shared chrome for `/` and marketing pages: `<head>`, sticky nav, footer, scroll-aware navbar tone |
| `Wordmark` | `src/components/Wordmark.astro:L1` | Inline SVG wordmark (Monomaniac One "hal" + JBM "0", amber #feaf00); used in nav + footer |
| `StarlightSiteTitle` | `src/components/StarlightSiteTitle.astro:L1` | Overrides Starlight's default `<img>` logo with inline SVG so "hal" glyphs inherit currentColor in dark mode |
| `LiveArtifact` | `src/components/landing/LiveArtifact.astro:L1` | Hero right-column animated dashboard preview; vanilla JS sparklines + tick counter; mirrors real dashboard slot grid |
| `LoadoutCard` | `src/components/landing/LoadoutCard.astro:L1` | Landing-only slot loadout card with title, size badge, slot list, optional accent tone |
| `CTA` | `src/components/CTA.astro:L1` | CTA button component (generic; not confirmed used on current landing) |
| `CodeBlock` | `src/components/CodeBlock.astro:L1` | Styled code block component |

---

## 4. Content Collections

| Collection | Config | Schema | Content root |
|------------|--------|--------|--------------|
| `docs` | `src/content.config.ts:L5` | Starlight `docsSchema()` | `src/content/docs/` |

All 32 `.mdx/.md` files live under `src/content/docs/docs/` and are auto-generated into sidebar sections by `astro.config.mjs:L38–L63`.

---

## 5. Distinct Concepts Conveyed by the Site

### 5.1 Product Identity & Positioning

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C01 | hal0 product identity | `src/pages/index.astro:L15` | Open-source homelab AI inference platform; "not another llama-server wrapper"; Apache-2.0; Linux + systemd |
| C02 | One-line installer | `src/pages/index.astro:L427` | `curl -fsSL https://hal0.dev/install.sh | bash`; idempotent; non-interactive; Proxmox VE helper variant |
| C03 | Free / zero cost | `src/pages/index.astro:L261` | $0 + electricity model; compare-table highlight vs. cloud pricing |
| C04 | No telemetry | `src/pages/index.astro:L840` | "no telemetry by default" pill in CTA; privacy emphasis |
| C05 | Apache-2.0 license | `src/pages/index.astro:L27` | Schema.org + CTA pills; permissive, open-source |

### 5.2 API & Integration

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C06 | OpenAI-compatible /v1/* API | `src/pages/index.astro:L39` | Drop-in replacement at :8080/v1; works with Python `openai`, `openai-node`, LangChain, Cursor, Aider, LiteLLM unmodified |
| C07 | External upstream dispatcher | `src/pages/index.astro:L50` | Routes to OpenRouter, Anthropic, OpenAI, custom endpoints from one /v1/* surface |
| C08 | SSE streaming | `src/content/docs/docs/api/streaming.mdx:L1` | Server-Sent Events for /v1/chat/completions; matches OpenAI streaming protocol exactly |
| C09 | Slot-as-model addressing | `src/content/docs/docs/api/slot-as-model.mdx:L1` | `model: "primary"` picks whatever is in the slot; registry refs address exact GGUF files |
| C10 | Structured API errors | `src/content/docs/docs/api/openai-compat.mdx:L146` | Consistent error shape with type + message + slot context |
| C11 | MCP tool annotations | `src/pages/index.astro:L392` | 22 admin tools + 4 memory tools ship with MCP hint annotations (readOnly, destructive, idempotent, openWorld) |

### 5.3 Slot Architecture

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C12 | Slot concept | `src/content/docs/docs/slots/what-is-a-slot.mdx:L1` | One inference workload = one systemd unit + one port + one lifecycle state machine |
| C13 | Slot lifecycle state machine | `src/pages/index.astro:L45` | 9 states: offline → pulling → starting → warming → ready ↔ serving ↔ idle → unloading → offline, plus error; atomic transitions persisted to state.json + SSE-streamed |
| C14 | Five built-in slots | `src/content/docs/docs/slots/built-in-slots.mdx:L1` | primary (chat), embed (embeddings + rerank), stt (speech-to-text), tts (text-to-speech), img (image generation) |
| C15 | Custom slot definition | `src/content/docs/docs/slots/custom-slots.mdx:L1` | Arbitrary additional slots (second chat model, NPU slot, vision, ComfyUI) |
| C16 | Single-flight routing / dispatcher | `src/pages/index.astro:L49` | Cold-cache prefetch coalesces thundering-herd requests into one HTTP call; registry-aware |
| C17 | Embed-rerank built-in slot | `src/content/docs/docs/slots/built-in-slots.mdx:L1` | Auto-created bge-reranker-v2-m3 at :8086 with --reranking; /v1/rerankings separate from chat |
| C18 | Model registry | `src/content/docs/docs/slots/model-registry.mdx:L1` | /var/lib/hal0/registry/registry.toml; on-disk TOML index; persists across updates; auto-regenerates on mutation |
| C19 | HuggingFace model pulls | `src/content/docs/docs/slots/huggingface-pulls.mdx:L1` | POST /api/models/{id}/pull; FLM tags via `flm pull`; SHA-256 atomic install; streamed progress |
| C20 | Capability slots overlay | `src/content/docs/docs/operate/config.mdx:L1` | User-facing embed/voice/img/NPU rollup controlled by /etc/hal0/capabilities.toml; one-click capability ops in dashboard |

### 5.4 Inference Providers

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C21 | llama.cpp provider | `src/content/docs/docs/reference/provider-matrix.mdx:L37` | Vulkan (default), ROCm, CUDA; handles chat, embed, rerank, vision |
| C22 | FLM / AMD XDNA NPU provider | `src/content/docs/docs/reference/provider-matrix.mdx:L60` | FastFlowLM toolbox (`ghcr.io/hal0ai/hal0-toolbox-flm:v1`); chat + embed on XDNA NPU; only surfaced when XDNA hardware present |
| C23 | Moonshine STT provider | `src/content/docs/docs/reference/provider-matrix.mdx:L73` | Edge real-time ASR; CPU-only; /v1/audio/transcriptions; OpenAI Audio shape |
| C24 | Kokoro TTS provider | `src/content/docs/docs/reference/provider-matrix.mdx:L89` | 82M model; 54 voices; 8 languages; CPU + Vulkan; /v1/audio/speech |
| C25 | ComfyUI image generation provider | `src/content/docs/docs/reference/provider-matrix.mdx:L97` | OpenAI-compatible /v1/images/generations; ROCm; SDXL Turbo / SD 1.5 / Flux Schnell workflows |
| C26 | Provider ABC interface | `src/content/docs/docs/reference/provider-matrix.mdx:L109` | `build_env() / start_cmd() / health() / infer()` — stateless, swappable; picker only shows backends the slot can honour |

### 5.5 Hardware Tiers

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C27 | Strix Halo reference platform | `src/content/docs/docs/hardware/strix-halo.mdx:L1` | Ryzen AI Max+ 395; Radeon 8060S iGPU; XDNA NPU; 128 GB LPDDR5X-8000 UMA; reference deployment; verified perf: 258 tok/s |
| C28 | UMA-aware hardware probe | `src/pages/index.astro:L53` | Detects iGPU, XDNA NPU, and unified memory pool; slot-fit warnings; writes /etc/hal0/hardware.json |
| C29 | Proxmox LXC deployment | `src/pages/index.astro:L166` | Privileged LXC with iGPU + XDNA passthrough; AppArmor unconfined; PVEAuditor token for memory bar host pressure |
| C30 | AMD discrete GPU (RX 7000) | `src/content/docs/docs/hardware/amd-discrete.mdx:L1` | 16–24 GB VRAM; Vulkan today; ROCm in build queue; chat + embed |
| C31 | NVIDIA GPU (RTX 30/40/50) | `src/content/docs/docs/hardware/nvidia.mdx:L1` | CUDA llama.cpp; 10–32 GB VRAM; same slot lifecycle; higher tok/s on small models |
| C32 | CPU-only fallback | `src/content/docs/docs/hardware/cpu-only.mdx:L1` | Vulkan-CPU; 0.5–4B practical model size; CI runs Qwen 0.5B; smoke tests |
| C33 | Ryzen AI Max 385/390 (64 GB SKU) | `src/pages/index.astro:L121` | Same install path; 64 GB UMA; Q4 70B fits with tighter context |

### 5.6 Recommended Loadouts

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C34 | Coding loadouts | `src/pages/index.astro:L187` | Three tiers: Qwen2.5-Coder-7B (5 GB), Qwen3-Coder-30B-A3B MoE (19 GB), Qwen3-Coder-Next-80B-A3B (47 GB) |
| C35 | Chat loadouts | `src/pages/index.astro:L201` | Three tiers: Qwen3-4B (2.5 GB / 1M ctx), Qwen3-30B-A3B MoE (19 GB, Strix daily-driver), Llama-4-Scout-17B MoE (50 GB, 10M ctx) |
| C36 | Voice mode loadout | `src/pages/index.astro:L215` | Qwen3-4B + Moonshine base + Kokoro-82M; ~3 GB total; hands-free streaming |
| C37 | RAG loadout | `src/pages/index.astro:L222` | Qwen3-30B-A3B + bge-m3 embed + bge-reranker; /v1/rerankings; long-context retrieval |
| C38 | Image generation loadout | `src/pages/index.astro:L229` | sdxl-turbo (6.5 GB) + sd-1.5 alt + flux-schnell (23.8 GB, Apache-2.0) |
| C39 | Agentic loadout | `src/pages/index.astro:L236` | Hermes-4-70B + bge-m3 + /mcp/admin + /mcp/memory; Cognee-backed memory; tool-use + MCP |
| C40 | Minimal / privacy-first loadout | `src/pages/index.astro:L243` | gemma-3-1b-it (0.7 GB) + nomic-embed-text-v2-moe; CPU OK |

### 5.7 Operations & Management

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C41 | Vue 3 + Tailwind 4 admin dashboard | `src/pages/index.astro:L64` | Dark-by-default operator console; SSE-backed status + log tail; capability cards; not a chat UI |
| C42 | Cosign-signed self-update | `src/pages/index.astro:L59` | `hal0 update --channel stable|nightly`; atomic symlink swap at /usr/lib/hal0/current; --rollback reverts; GitHub OIDC keyless verification |
| C43 | hal0 CLI | `src/content/docs/docs/reference/cli.mdx:L1` | Single `hal0` binary (Typer); all non-serve subcommands talk to daemon; `hal0 doctor` re-runs preflight |
| C44 | Configuration (TOML) | `src/content/docs/docs/operate/config.mdx:L1` | Atomic writes; schema-validated; hot-reload; /etc/hal0/hal0.toml + capabilities.toml |
| C45 | journald logging + SSE log tail | `src/content/docs/docs/operate/logs.mdx:L1` | All units log to system journal; dashboard tails over SSE; stable unit name set |
| C46 | Authentication & HTTPS | `src/content/docs/docs/operate/auth.mdx:L1` | Default open on LAN; `--auth=basic` brings Caddy with basic_auth, Bearer tokens, HTTPS (Let's Encrypt / internal CA), Avahi mDNS |
| C47 | OpenWebUI bundled chat | `src/content/docs/docs/operate/openwebui.mdx:L1` | Prewired on :3001; zero config; points at local hal0 API; installer wires it automatically |
| C48 | Live TTFT dashboard | `src/pages/index.astro:L383` | Per-slot time-to-first-token sampled in dispatcher; sparkline HUD on SlotCard; 60-second window |
| C49 | KV-cache % gauge | `src/pages/index.astro:L387` | Synthesised kv_cache_usage = max(n_prompt_tokens) / n_ctx, clamped 1.0; uses /slots fallback when Prometheus gauge absent |
| C50 | Proxmox host-pressure segment | `src/pages/index.astro:L328` | PVEAuditor token → memory bar shows DIMM total + muted host segment for other-tenant + ZFS ARC pressure |

### 5.8 Install & Distribution

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C51 | Installer overhaul | `src/content/docs/docs/getting-started/install.mdx:L1` | ASCII banner + step counter; preflight.sh; `hal0 doctor`; disk + port gates; hardware cards + slot pre-population; live-hello + QR |
| C52 | FirstRun wizard | `src/content/docs/docs/getting-started/first-model.mdx:L1` | 8 linear steps (password → hardware → primary model → capabilities → HF token → license → install → done); guarded route at /firstrun |
| C53 | Proxmox VE install script | `src/content/docs/docs/getting-started/install.mdx:L1` | One-liner on PVE host creates unprivileged Debian 13 LXC; --advanced for whiptail prompts; env-var overrides |
| C54 | Signed release pipeline | `src/pages/index.astro:L309` | releases.hal0.dev/stable.json via Cloudflare middleware; v* tag → GH release → manifest in ~60s; cosign 3.x keyless |
| C55 | Toolbox container images | `src/pages/index.astro:L281` | 6 images: vulkan, rocm, flm, moonshine, kokoro, comfyui; `ghcr.io/hal0ai/`; pinned by sha256 in manifest.json |

### 5.9 Agents, Memory & MCP (Roadmap)

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C56 | MCP host + server (roadmap) | `src/pages/index.astro:L347` | hal0 speaks MCP both directions; compose tools across local slots + external MCP services; dashboard discovery |
| C57 | Cognee-backed memory (roadmap) | `src/pages/index.astro:L347` | SQLite + LanceDB + Kuzu; shared default + X-hal0-Private:1 for per-client namespace |
| C58 | Bundled Hermes agent app (roadmap) | `src/pages/index.astro:L345` | Installable from dashboard; prewired to local OpenAI API + MCP servers |
| C59 | Approval inbox + bell | `src/pages/index.astro:L342` | Destructive tool calls gate through header bell + modal inbox; CLI parity via `hal0 agent approvals` |
| C60 | ChatOps adapters (roadmap) | `src/pages/index.astro:L349` | Slack + Matrix bridges as extensions |

### 5.10 Roadmap Themes

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C61 | Inference + providers roadmap | `src/pages/index.astro:L275` | Shipped: full /v1/* surface, 5-provider stack, image gen, FLM NPU; Future: LoRA hot-swap, per-model rate limits |
| C62 | Slot lifecycle roadmap | `src/pages/index.astro:L290` | Shipped: state machine, capability overlay, embed-rerank slot, live metrics, drift reconcile; Soon: benchmarks + presets UI |
| C63 | Install + distribution roadmap | `src/pages/index.astro:L308` | Shipped: signed pipeline, cosign update, installer overhaul, --models-dir flag, version SSoT; Soon: extensions framework, AUR/PPA |
| C64 | Hardware + observability roadmap | `src/pages/index.astro:L322` | Shipped: UMA probe, Proxmox pressure, KV-cache gauge, live TTFT; Future: multi-host federation |
| C65 | Agents + memory + MCP roadmap | `src/pages/index.astro:L337` | Shipped: MCP annotations, approval inbox; Soon: Hermes agent, Cognee memory, MCP host; Future: ChatOps |
| C66 | Security + UX roadmap | `src/pages/index.astro:L355` | Shipped: bundled OpenWebUI, Caddy+auth, first-run wizard; Soon: STT/TTS curated picks; Future: voice mode end-to-end |

### 5.11 Competitive Positioning

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C67 | hal0 vs. ollama comparison | `src/pages/index.astro:L252` | 10-row comparison: API surface, concurrent slots, state machine, UMA probe, NPU, dispatcher, update signing, headless-first |
| C68 | hal0 vs. LM Studio comparison | `src/pages/index.astro:L252` | Same 10-row table: LM Studio requires GUI; no slot lifecycle; no UMA probe; no NPU |
| C69 | hal0 vs. OpenAI cloud comparison | `src/pages/index.astro:L252` | Cost: $0 vs. $0.50–$60/M tokens; your data on your hardware; no federation or lifecycle concept cloud-side |

### 5.12 Verified Performance Numbers

| # | Label | Page (file:line) | Description |
|---|-------|------------------|-------------|
| C70 | 258 tok/s concurrent | `src/pages/index.astro:L462` | primary + embed concurrent on Strix Halo iGPU at ~9 GB GTT |
| C71 | <200 ms dispatch latency | `src/pages/index.astro:L466` | Both slots hot, single-flight; verified Strix Halo |
| C72 | Phi-3 Mini first-token latency | `src/pages/index.astro:L477` | 2.39 GB pull in ~10s; 71 tok/s; 280 ms RTT; Strix Halo iGPU via Vulkan llama.cpp |
| C73 | Qwen 0.5B CI baseline | `src/pages/index.astro:L158` | 217–413 tok/s on Strix Halo; CI smoke model |

---

## 6. Edge / Infrastructure

| File | Role |
|------|------|
| `functions/_middleware.ts:L1` | Cloudflare Pages function; proxies `releases.hal0.dev` GitHub releases manifest; adds auth headers; annotates fallthrough |
| `astro.config.mjs:L1` | Astro site config; Starlight integration; tailwindcss vite plugin; sitemap; allowedHosts for dev server |

---

## 7. Summary Statistics

- **Pages/routes total:** 19 (1 marketing + 1 docs root + 17 docs content pages)
- **Distinct concepts:** 73 (C01–C73)
- **Content collections:** 1 (`docs`)
- **Astro components:** 7 (3 layout/shared, 4 landing-specific)
- **Source markdown files:** 32 (.mdx + .md under src/content/docs/)
