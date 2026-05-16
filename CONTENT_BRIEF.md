# CONTENT_BRIEF

> Source of truth for the hal0.dev marketing + docs site.
> Cite this file rather than re-reading the hal0 repo. All numbers and
> claims have a repo citation, or are marked `[TODO: verify]`.

## One-liner

**hal0 — open-source home AI inference platform.**

(Verbatim from `hal0/README.md` line 3.)

## Elevator pitch (3 sentences)

hal0 is a polished, reliable inference platform for running LLMs at home
on Linux. It manages model **slots** with a real lifecycle state machine,
exposes an **OpenAI-compatible API**, and ships with a built-in
**dashboard** and a **prewired OpenWebUI** chat interface. One command
installs the lot on any modern Linux box — Strix Halo iGPU, AMD discrete
GPU, NVIDIA GPU, or CPU.

(Synthesised from `hal0/README.md` lines 1–24 and `hal0/PLAN.md` §1.)

## Verified perf numbers (do not invent)

Use **only** these. The citation phrase to attach is:
**"verified on Ryzen AI Max iGPU + Vulkan."**

| Model | Quant | Measurement | Notes |
|---|---|---|---|
| Phi-3 Mini | Q4 | **2.39 GB** HF download in **~10s**; chat round-trip **280 ms** at **71 tok/s** | Strix Halo iGPU via Vulkan llama.cpp (per task brief; matches `curated.py` size_gb=2.4) |
| Qwen 0.5B | Q4_K_M | **217–413 tok/s** | Strix Halo iGPU; the CI smoke model (`tests/slots/test_integration.py` uses `Qwen/Qwen2.5-0.5B-Instruct-GGUF`) |
| primary + embed concurrent | — | both slots, **~258 tok/s**, **<200 ms** dispatch | iGPU at ~9 GB GTT (`docs/handoff-2026-05-15-autonomous.md` line 142) |

Anything else (vs. ollama benchmarks, NPU numbers, etc.) is
`[TODO: verify]` — do not put it on the site.

## Install command

```sh
curl -fsSL https://hal0.dev/install | bash
```

From `hal0/installer/README.md` line 9. Idempotent, non-interactive.
Repo fallback: `sudo bash installer/install.sh` from a clone.

Overrides (env vars, from `installer/install.sh`):
`HAL0_PREFIX`, `HAL0_PORT` (default 8080), `HAL0_USER`, `HAL0_PYTHON`,
`HAL0_NO_PROBE`, per-backend `HAL0_TOOLBOX_IMAGE_*`.

Status caveat: the installer is real (Phase 2+ done) and produces a
running `hal0-api`. As of 2026-05-15 the **vulkan / rocm / moonshine /
kokoro / comfyui** toolbox images are pinned by sha256 digest in
`hal0/manifest.json` `toolbox_images.*.digest`; only **flm** (the AMD
XDNA NPU toolbox) is still unpublished — `manifest.json` shows
`toolbox_images.flm.digest = null`. CI builds the flm image
successfully, but the post-publish manifest-patch step is not yet
auto-PR'd.

### Installer overhaul (2026-05-15)

The installer was hardened end-to-end this cycle. Highlights, with
repo citations:

- **ASCII banner + step counter + spinners** — `installer/lib/ui.sh`
  (`banner`, `ui_step`, `spinner`, `box_*` helpers; sourced from
  `installer/install.sh` line 24 onward).
- **Extracted, re-runnable pre-flight** —
  `installer/lib/preflight.sh` is sourced by `install.sh` and also
  shelled out by `hal0 doctor`. Public functions: `preflight_systemd`,
  `preflight_python`, `preflight_docker`, `preflight_disk`,
  `preflight_ports`, `preflight_all`.
- **`hal0 doctor` subcommand** — re-runs `preflight_all` post-install
  against the live host
  (`src/hal0/cli/doctor_commands.py`; wired in `src/hal0/cli/main.py`
  line 30/52).
- **Disk + port gates** — `preflight_disk 20 "${VAR_DIR}"` and
  `preflight_ports "${HAL0_PORT}" 3001` run before any apt/pip work
  (`installer/install.sh` lines 183–184). `preflight_disk` walks up
  to the deepest existing ancestor so a fresh `/var/lib/hal0` doesn't
  trip the check (commit `a34293d`).
- **Hardware cards + slot pre-population** — after the venv lands, an
  inline `python` block runs `HardwareProbe().probe()`, writes
  `/etc/hal0/hardware.json`, prints four `format_cards()` lines, then
  renders `slots/primary.toml` via `recommend_primary_slot()` if no
  primary file exists. Sources: `src/hal0/hardware/probe.py:530`
  (`format_cards`) and `src/hal0/hardware/recommend.py` (`_PRIMARY_TIERS`
  picks the largest curated chat model that fits). The TOML is written
  with a header that explains the backend + model rationale and
  `enabled = false` so the operator pulls a model and flips it on
  (`installer/install.sh` lines 549–589).
- **Contextual ERR-trap recovery hints** — a single `trap` at
  `installer/install.sh:115–134` dispatches on `${CURRENT_STEP}` to
  give a step-specific recovery line on failure (Pre-flight, Python
  environment, Service start, Auth, Hardware probe).
- **Post-auth round-trip self-test** — with `--auth=basic`, after
  Caddy is up, `installer/install.sh:645–656` issues a real
  `https://${HAL0_HOSTNAME}/api/health` request and reports
  `basic_auth round-trip OK` or a `journalctl -u hal0-caddy -n 60`
  hint.
- **Optional finish polish** — at the end of a successful install:
  a live "hello" prompt streamed through the freshly-spawned slot
  (`installer/install.sh:709–795`), a QR code rendered with
  `qrencode -t ANSIUTF8` pointing at `DASHBOARD_URL` when `qrencode`
  is present (silent soft-skip otherwise; lines 798–806), and a
  reachability summary printed in a UI box. Commit `f10c99d`.

## Quick API usage example

API binds `0.0.0.0:8080` (or `HAL0_PORT`). OpenAI-compatible
`/v1/*` surface, routed by the dispatcher to whichever slot owns the
model.

```sh
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-0.5b-instruct-q4_k_m",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Endpoints (verified in `src/hal0/api/routes/v1.py`):

- `GET  /v1/models`
- `GET  /v1/models/{model_id}`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/embeddings`
- `POST /v1/rerankings`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/speech`

OpenWebUI ships prewired to `OPENAI_API_BASE_URLS=http://127.0.0.1:8080/v1`
on `:3001` (`hal0/PLAN.md` §8).

`POST /v1/images/generations` (ComfyUI, ROCm) is also exposed — see
the "Image generation" section below for body shape, response shape,
and curated models.

## Features list (10–12 items, grounded in PLAN.md)

1. **OpenAI-compatible `/v1/*` API** — chat, completions, embeddings,
   rerank, audio transcriptions, audio speech, **image generations**,
   models. Drop-in for any OpenAI SDK. (PLAN §1)
2. **Slot lifecycle state machine** — every inference workload has a
   typed state and atomic transitions (offline → pulling → starting →
   warming → ready → serving ↔ idle → unloading; error sideband).
   Persisted to `state.json`, streamed over SSE. (PLAN §5 Tier 3,
   `src/hal0/slots/state.py`)
3. **systemd-managed containers** — each slot is an instance of the
   `hal0-slot@.service` template unit. The API process never holds a
   model in its own memory. (`ARCHITECTURE.md` §Process model)
4. **Hardware-aware probe** — detects GPU / NPU / unified memory (UMA
   pool on Strix Halo), writes `/etc/hal0/hardware.json`, surfaces
   VRAM/RAM fit warnings inline in the slot form. (PLAN §6,
   `src/hal0/hardware/probe.py`)
5. **Dispatcher with single-flight + decision logging** — registry-aware
   routing, cold-cache prefetch, upstream fallback, request coalescing
   so a thundering herd of identical prefetches becomes one HTTP call.
   (PLAN §5 Tier 3, `src/hal0/dispatcher/`)
6. **Bundled prewired OpenWebUI** — chat UI on `:3001`, zero config:
   the installer writes `openwebui.env` pointing at the local hal0 API.
   (PLAN §8)
7. **Vue 3 + Tailwind 4 dashboard** — 9 views: Dashboard, Slots,
   Models, Hardware, Logs, Settings, Providers, FirstRun, plus error
   shell. Dark mode default; SSE for status + log tail. (PLAN §6)
8. **Atomic self-update with rollback** — `hal0 update --channel
   stable|nightly`; cosign-verified tarballs swap a
   `/usr/lib/hal0/current` symlink; `--rollback` reverts. (PLAN §9,
   `docs/release-manifest.md`)
9. **External LLM upstreams** — OpenRouter, Anthropic, OpenAI, and
   custom OpenAI-compatible endpoints fall through the same `/v1/*`
   surface. (PLAN §1, `src/hal0/upstreams/`)
10. **Reliability bar** — atomic env file writes, schema-validated TOML
    config, structured error envelopes (`{"error":{"code":"slot.not_ready",...}}`),
    adaptive cold-boot health probes (PLAN §5 Tier 1+2).
11. **Image generation via ComfyUI** — `POST /v1/images/generations`
    (OpenAI-shaped), curated SDXL Turbo / SD 1.5 / Flux Schnell,
    workflow translation owned by hal0 (commits `1a8a480`, `76b7f8b`;
    `src/hal0/providers/comfyui.py`, `src/hal0/api/routes/v1.py:259`).
12. **Optional Caddy reverse proxy with basic_auth + Bearer token POC**
    — `install.sh --auth=basic` provisions Caddy, writes a hashed
    `basic_auth`, mints a Bearer token, and round-trips a self-test
    against `https://${HAL0_HOSTNAME}/api/health` before exiting
    (commits `ba79427`, `f62902c`; install.sh lines 294+ and 645+).
    Trusted-LAN posture remains the default (`--auth=off`).

## Built-in slots

The five always-present slots (`BUILTIN_SLOTS` in
`src/hal0/slots/manager.py:135`; cannot be deleted via the UI):

| Slot | What it does | Default backend |
|---|---|---|
| `primary` | Chat / general LLM (`/v1/chat/completions`, `/v1/completions`) | llama.cpp (Vulkan) |
| `embed`   | Embeddings (`/v1/embeddings`) and rerank (`/v1/rerankings`) | llama.cpp (Vulkan) |
| `stt`     | Speech-to-text (`/v1/audio/transcriptions`) | Moonshine |
| `tts`     | Text-to-speech (`/v1/audio/speech`) | Kokoro |
| `img`     | Image generation (`/v1/images/generations`) | ComfyUI (ROCm) |

User-defined slots (e.g. `npu`, `vision`) can be added on top.

## Provider matrix (v1)

From `hal0/PLAN.md` §1 + `src/hal0/providers/`:

| Provider | Hardware | What it serves |
|---|---|---|
| **llama.cpp** | Vulkan (default) / ROCm (opt-in) | chat, embed, rerank, vision |
| **FLM** | AMD XDNA NPU (opt-in) | chat / embed / ASR multiplex |
| **Moonshine** | CPU / Vulkan | STT (`/v1/audio/transcriptions`) |
| **Kokoro** | CPU / Vulkan | TTS (`/v1/audio/speech`) |
| **ComfyUI** | ROCm (Strix Halo iGPU class) | Image gen (`/v1/images/generations`) |

All five are first-class in v1. Each provider is a class with
`build_env() / start_cmd() / health() / infer()` — stateless, swappable
(`ARCHITECTURE.md` §Key boundaries).

## Image generation

Image generation landed in commit `1a8a480 feat(image-gen): ship
ComfyUI provider + /v1/images/generations + curated SD models`,
merged to main via `76b7f8b` (Team K).

- **Endpoint**: `POST /v1/images/generations` (OpenAI-shaped).
  Request body: `model`, `prompt`, optional `n`, `size`, `response_format`
  (`url` | `b64_json`), plus hal0 `extra_body` keys `seed`, `steps`,
  `cfg`, `negative_prompt`. Source: `src/hal0/api/routes/v1.py:259`
  onward.
- **Response**: standard OpenAI shape with `data[].url` (served from
  `/api/images/cache/<uuid>.png`) or `data[].b64_json`, plus a
  `_hal0` debug field carrying the workflow translator's metadata.
- **Provider**: `ComfyUIProvider` in `src/hal0/providers/comfyui.py`.
  hal0 owns the OpenAI ↔ ComfyUI translation (workflow templates in
  `src/hal0/providers/workflows/{sdxl_turbo_simple,sd15_simple}.json`)
  — the upstream is treated as a black box that speaks `POST /prompt`,
  `GET /history/<id>`, `GET /view`.
- **Toolbox image**: `ghcr.io/hal0ai/hal0-toolbox-comfyui:v1`, pinned
  by sha256 in `hal0/manifest.json` `toolbox_images.comfyui.digest`
  (commit `3449b2c`).
- **Slot**: `img` (now part of `BUILTIN_SLOTS` in
  `src/hal0/slots/manager.py:135`).
- **Hardware**: ROCm-capable AMD GPU. Strix Halo's iGPU is the v1
  first-class target — the unified memory pool comfortably holds an
  SDXL-Turbo checkpoint alongside a primary chat model.

### Curated image-gen models (`src/hal0/registry/curated.py`)

| Id | Family | On-disk | Min VRAM | License |
|---|---|---|---|---|
| `sdxl-turbo` | SDXL distilled | ~6.5 GB | 8 GB | SAI Non-Commercial Research Community (research only) |
| `sd-1.5-pruned-emaonly` | SD 1.5 | ~4.3 GB | 4 GB | CreativeML Open RAIL-M |
| `flux-schnell` | FLUX.1 [schnell] | ~23.8 GB | 24 GB | Apache-2.0 |

The curated catalogue spans the licensing spectrum on purpose — the
picker UI surfaces the badge so operators pick consciously. The Flux
entry is catalogued for completeness but the default
`sdxl_turbo_simple` workflow won't load its T5 text encoder; a
Flux-specific workflow is `[TODO: verify]` follow-up before promoting
Flux in the picker UI (per the `notes` field on the curated entry).

## CLI subcommands

Built with Typer (`src/hal0/cli/main.py`). All non-`serve` commands talk
to the local daemon on `127.0.0.1:8080`.

```
hal0 status                          # system + slot summary (real)
hal0 probe                           # re-run hardware detection (real)
hal0 serve [--host] [--port] [--reload]   # daemon mode

hal0 slot list
hal0 slot load <name> [--model M]
hal0 slot unload <name>
hal0 slot restart <name>
hal0 slot swap <name> --model M
hal0 slot logs <name> [--follow]     # SSE tail of journalctl

hal0 model list
hal0 model pull <ref>                # 501 today; staged with FirstRun
hal0 model rm <ref>
hal0 model assign <ref> --slot S

hal0 config show
hal0 config edit                     # $EDITOR
hal0 config validate
hal0 config migrate

hal0 update [--channel stable|nightly] [--check] [--rollback]
hal0 uninstall [--keep-data]         # not implemented yet
```

Implementation status verified against `docs/handoff-2026-05-15-autonomous.md`
"What landed" section. `hal0 model pull` and `hal0 uninstall` are stubs
returning `NOT_IMPLEMENTED`; the rest hit real endpoints.

## Slot lifecycle states

Canonical enum in `src/hal0/slots/state.py` (StrEnum, wire-stable):

| State | Meaning |
|---|---|
| `offline` | No systemd unit active. |
| `pulling` | Model files downloading / verifying. |
| `starting` | systemd unit up; container booting. |
| `warming` | Container live; model loading into VRAM/GTT. |
| `ready` | Passed health probe (non-empty `/v1/models` + sentinel completion). |
| `serving` | Inference request in-flight. |
| `idle` | Ready but no traffic past the idle timeout — unload candidate. |
| `unloading` | Graceful stop in progress. |
| `error` | Failed; details in `state.json` + journald. |

Transitions are atomic, validated against `LEGAL_TRANSITIONS`, persisted
to `/var/lib/hal0/slots/<name>/state.json`, and streamed over SSE so the
dashboard reflects reality (not just `systemctl is-active` snapshots).

## Differentiators (honest comparisons)

- **vs. ollama** — hal0 isn't an inference engine; it's the
  orchestration + lifecycle + multi-modal surface around llama.cpp,
  FLM, Moonshine, and Kokoro. systemd-managed slots survive `hal0-api`
  restarts; OpenAI-compatible API includes embeddings, rerank, **and**
  STT/TTS, not just chat. Hardware probe + slot fit warnings are
  first-class.
- **vs. LM Studio** — Linux-first, headless-first, one-line install,
  no GUI required. Prewired OpenWebUI is the chat surface; dashboard
  is for operating the box, not chatting.
- **vs. raw llama.cpp / llama-server** — hal0 owns the lifecycle:
  health probes, atomic env file writes, cold-boot grace, single-flight
  prefetch, structured errors, signed self-update with rollback. The
  things you'd otherwise script around `llama-server` by hand.
- **vs. cloud (OpenAI / Anthropic)** — your hardware, your data, your
  models. External upstreams (OpenRouter, Anthropic, OpenAI, custom)
  can be configured as fallbacks behind the same `/v1/*` surface, so
  you can mix local + remote per-model in one config.

## Roadmap

### Shipped (Phase 1+ as of 2026-05-15, per PLAN §15)

- Slot manager + dispatcher port from haloai
- Five providers (llama.cpp, FLM, Moonshine, Kokoro, **ComfyUI**) wired
- `/v1/*` and `/api/slots/*` end-to-end through real httpx client
- `/v1/images/generations` with curated SDXL Turbo + SD 1.5 + Flux
  (commits `1a8a480` + `76b7f8b`)
- Slot lifecycle state machine + single-flight + adaptive cold-boot
- Pydantic-validated TOML config + atomic env writes
- Installer overhaul: pre-flight + hardware cards + `hal0 doctor` +
  ERR-trap hints + post-auth round-trip + live-hello / QR / reachability
  finish (commits `c392859`, `c16422b`, `13a0764`, `686294e`, `f10c99d`)
- Caddy reverse proxy + basic auth + Bearer token POC (`--auth=basic`,
  commits `ba79427` + `f62902c`; Team J)
- Toolbox image digests pinned for vulkan, rocm, moonshine, kokoro,
  comfyui (`hal0/manifest.json`)
- 353 unit tests passing, integration tier on Vulkan-CPU + Qwen 0.5B

### Soon (v0.2, deferred from v1; PLAN §1 "v0.2 deferred")

- Memory subsystem
- MCP support
- Benchmarks UI + Presets UI
- AUR PKGBUILD + Ubuntu PPA
- `hal0.local` mDNS auto-discovery
- Light mode toggle

### Exploring

- `[TODO: verify]` Anything beyond v0.2 isn't in PLAN.md.

### Remaining gaps for v1.0 cut (`docs/handoff-2026-05-15-autonomous.md`)

- `POST /api/models/{id}/pull` (HF streaming download) is still 501
- `flm` toolbox image not yet published — `manifest.json`
  `toolbox_images.flm.digest` is `null`
- `hal0 uninstall` not implemented

## Hardware targets

| Tier | Hardware | Status |
|---|---|---|
| **First-class** | AMD Ryzen AI Max ("Strix Halo") with iGPU + XDNA NPU + unified memory | Reference deployment. The perf numbers above all come from this box. UMA-aware memory probe; FLM provider for NPU. |
| **Supported** | AMD discrete GPU (ROCm), NVIDIA GPU (CUDA) | Vulkan path works today; ROCm toolbox is on the build list. NVIDIA is in PLAN §1 target list but not the day-1 dev box. |
| **Fallback** | CPU-only x86_64 / Vulkan-CPU | CI runs on Vulkan-CPU with Qwen 0.5B (`tests/slots/test_integration.py`). Usable for tiny models / smoke tests, not the headline experience. |

Linux + systemd is required (`installer/install.sh:86`). macOS/Windows
are not in scope for v1.

## Recommended loadouts

Curated starting points, not gospel. Mix, match, tweak — the slot system
takes a different model per slot whenever you change your mind. Sizes
are published GGUF Q4_K_M / Q8_0 file sizes (verified on Hugging Face,
May 2026); no tok/s numbers here. Picks are refreshed to the **latest
open-weight releases as of 2026-05-15** — each entry keeps a previous
fallback in parens for users on existing setups.

**Headline target: the 128 GB Strix Halo SKU** — Ryzen AI Max+ 395 with
128 GB LPDDR5X-8000 unified memory. The iGPU carveout is BIOS-tunable
up to ~96 GB, and some configs report ~110 GB usable for the GPU when
paged through GTT. Q4 70B fits with massive headroom; Q4 MoE 100B+ on a
17B–22B active path becomes feasible; mid-class loadouts leave 100+ GB
free for context, KV cache, embed + audio slots, and multi-tab usage.

**64 GB Strix Halo SKUs** (Ryzen AI Max 385/390) are still well-served
by every small + mid tier below, plus a tight Q4 70B / Llama-4 Scout
with shorter context windows.

### Strix Halo loadouts

#### Coding — small / mid / large

- **Small** (~5 GB) — `primary`: `Qwen2.5-Coder-7B-Instruct-Q4_K_M`. No Qwen3-Coder small variant has shipped yet; the 7B Qwen2.5 stays the best small dedicated coder until that lands.
- **Mid** (~19 GB) — `primary`: `Qwen3-Coder-30B-A3B-Instruct-Q4_K_M` (~18.6 GB, MoE with only 3B active params — runs near 3B speeds, reasons like a 30B); `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB) for repo-aware search. *(fallback: `Qwen2.5-Coder-32B-Instruct-Q4_K_M` ~20 GB)*
- **Large** (~42 GB) — `primary`: `Hermes-4-70B-Q4_K_M` (~42.5 GB) for hybrid reasoning + tool-friendly coding. Alt: `Llama-4-Scout-17B-16E-Instruct-Q4_K_M` (~50 GB, MoE with 17B active and a 10M-token context). No dedicated 70B+ coder exists in GGUF, so the convention is to fall back on a top-tier general/reasoning model for hard problems. 128 GB headroom keeps both the 30B-A3B coder and a 70B reasoning model hot in separate slots. *(fallback: `Llama-3.3-70B-Instruct-Q4_K_M`)*

#### General chat — small / mid / large

- **Small** (~2.5 GB) — `primary`: `Qwen3-4B-Instruct-2507-Q4_K_M` (Aug 2025 release, 1M-token context). Snappy on any modern box. *(fallback: `Llama-3.2-3B-Instruct-Q4_K_M`)*
- **Mid** (~19 GB) — `primary`: `Qwen3-30B-A3B-Instruct-2507-Q4_K_M` (~18.6 GB, MoE 3B active). Smaller-RAM alt: `gemma-3-12b-it-Q4_K_M` (~6.6 GB) for a 6 GB footprint. *(fallback: `Meta-Llama-3.1-8B-Instruct-Q4_K_M`)*
- **Large** (~50 GB) — `primary`: `Llama-4-Scout-17B-16E-Instruct-Q4_K_M` (~50 GB, MoE 17B active, 10M context). On 128 GB you also get the embed slot hot at the same time and headroom for STT/TTS — none of which 64 GB SKUs comfortably do simultaneously. *(fallback: `Llama-3.3-70B-Instruct-Q4_K_M` ~42 GB or `Qwen2.5-72B-Instruct-Q4_K_M` ~47 GB)*

#### Voice mode (~3 GB total)

- `primary`: `Qwen3-4B-Instruct-2507-Q4_K_M` (~2.5 GB) — low-latency reply. *(fallback: `Llama-3.2-3B-Instruct-Q4_K_M`)*
- `stt`: Moonshine base (~190 MB) via the `moonshine` toolbox — built for edge real-time. Higher-accuracy alt: `whisper-large-v3-turbo` (~1.6 GB). 2025 SOTA: `Canary-Qwen-2.5B` (Open ASR Leaderboard leader, 5.63% WER).
- `tts`: `Kokoro-82M v1.0` (~330 MB, 8 languages / 54 voices, Jan 2025) via the `kokoro` toolbox. Voice-cloning alt: `F5-TTS`.
- 128 GB leaves the entire rest of the budget free for a large embed or a second chat model warm in another slot.

#### Creative / fun writing (~42 GB)

- `primary`: `Hermes-4-70B-Q4_K_M` (~42.5 GB, Aug 2025 — hybrid-mode reasoning + creative strength). Lighter alt: `Hermes-4-14B-Q4_K_M` (~9 GB, Qwen-3-14B base). *(fallback: `Mistral-Small-24B-Instruct-2501-Q4_K_M` ~14 GB)*

#### Privacy-first / minimal footprint (<1 GB)

- `primary`: `gemma-3-1b-it-Q4_K_M` (~0.7 GB) — text-only, March 2025. *(fallback: `Phi-3-mini-4k-instruct-q4.gguf` ~2.4 GB, the curated default; or `Qwen2.5-0.5B-Instruct-Q4_K_M` ~400 MB, the CI smoke model)*
- `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB, multilingual MoE — 137M params).
- Runs comfortably on CPU-only fallback boxes; smallest viable hal0 install.

#### RAG / knowledge-base (~19 GB)

- `primary`: `Qwen3-30B-A3B-Instruct-2507-Q4_K_M` (~18.6 GB) for synthesis. *(fallback: `Qwen2.5-14B-Instruct-Q4_K_M` ~9 GB)*
- `embed`: `bge-m3` (~600 MB Q8, multilingual, multi-vector, 8192-token context, top retrieval R@1 in 2026 benchmarks). Lower-footprint alt: `nomic-embed-text-v2-moe` (~140 MB). *(fallback: `bge-large-en-v1.5-Q8_0` ~670 MB)*
- The embed slot also serves rerank via `/v1/rerankings`. 128 GB extra: huge room for KV cache → long-context retrieval (64k+) without paging.

#### Image generation (~6.5 GB primary)

- `img`: `sdxl-turbo` (~6.5 GB FP16 safetensors, SAI Non-Commercial
  Research Community license). Single-file checkpoint, runs the
  `sdxl_turbo_simple` workflow (4 steps, cfg ≈ 1.0).
- Lower-VRAM alt: `sd-1.5-pruned-emaonly` (~4.3 GB,
  CreativeML Open RAIL-M).
- High-end alt: `flux-schnell` (~23.8 GB, Apache-2.0) — fits the
  128 GB unified pool comfortably, but the picker UI surfaces a
  follow-up note: the default `sdxl_turbo_simple` workflow can't load
  Flux's T5 text encoder, so day-1 inference needs a Flux-specific
  workflow `[TODO: verify]`.
- Lines up with the v1 image-gen ship (commit `1a8a480`,
  toolbox `ghcr.io/hal0ai/hal0-toolbox-comfyui:v1` with pinned digest).

#### Agentic tool-use (~42 GB)

- `primary`: `Hermes-4-70B-Q4_K_M` (~42.5 GB) — Nous's hybrid-reasoning model is explicitly tuned for tool-call faithfulness and format adherence. Lighter alt: `Hermes-4-14B-Q4_K_M` (~9 GB). *(fallback: `Qwen2.5-32B-Instruct-Q4_K_M` ~20 GB)*
- `embed`: `bge-m3` (~600 MB) or `nomic-embed-text-v2-moe` (~140 MB) for retrieval-augmented routing.
- Lines up with the v0.2 agents / MCP roadmap (PLAN §1 "v0.2 deferred").

#### Maxed-out single model (~50–75 GB)

The biggest realistic single-model loadout that still fits a 128 GB
Strix Halo with room to breathe. Pick one:

- `primary`: `Llama-4-Scout-17B-16E-Instruct-Q4_K_M` (~50 GB) — 10M context, MoE 17B active. The current best balance of size and capability.
- `primary`: `Hermes-4-70B-Q8_0` (~75 GB) — 70B at Q8 instead of Q4, trading size for quant headroom.
- `primary`: `Mistral-Large-Instruct-2411-Q4_K_M` (123B, ~73 GB) — older but still excellent for raw single-model quality.

Hard ceiling: `Qwen3-235B-A22B-Instruct-2507-Q4_K_M` (~142 GB)
does **not** fit even on the 128 GB SKU; `Llama-4-Maverick-Q4_K_M`
(~230 GB) and `Mistral-Large-3-Q4` (675B / 41B active, ~340 GB) are
both well over the line. That's where you start needing dual GPUs or a
bigger box.

### Discrete GPU & CPU loadouts

For NVIDIA the path is CUDA-backed llama.cpp; for AMD discrete it's the
ROCm toolbox image. Both go through the same slot lifecycle as Strix
Halo — what changes is dedicated VRAM vs the unified pool.

#### NVIDIA RTX 5090 (32 GB VRAM)

- `primary`: `Qwen3-Coder-30B-A3B-Instruct-Q4_K_M` (~18.6 GB) or any Q4 ~30B chat — comfortable with a 16–32k context.
- `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB) co-resident.
- Q4 70B (`Hermes-4-70B` / `Llama-3.3-70B`) is feasible but tight with partial CPU offload; expect lower tok/s than VRAM-resident inference.
- Trade vs Strix Halo: no headroom for a hot STT/TTS slot alongside a 30B primary.

#### NVIDIA RTX 4090 / 3090 (24 GB VRAM)

- `primary`: `Qwen3-30B-A3B-Instruct-2507-Q4_K_M` (~18.6 GB) fits with shorter context, or `gemma-3-12b-it-Q4_K_M` (~6.6 GB) for a longer window.
- `embed`: small Q4 embed only (`nomic-embed-text-v2-moe` ~140 MB).
- Q4 70B requires partial CPU offload — works, but drops well below VRAM-resident speeds.
- Trade vs 5090: tighter context budgets at the same model size.

#### NVIDIA RTX 4080 / 4080 Super (16 GB VRAM)

- `primary`: `gemma-3-12b-it-Q4_K_M` (~6.6 GB) or `Hermes-4-14B-Q4_K_M` (~9 GB).
- `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB) leaves several GB for a ~16k context.
- Q4 32B class (Qwen3-30B-A3B) is offload-only here — workable occasionally, not as a daily driver.
- Trade vs 24 GB cards: keep the primary at ~13B class for a smooth experience.

#### NVIDIA RTX 3080 / AMD RX 7900 XT / XTX (10–24 GB VRAM)

- `primary`: a 4–14B Q4 — `Hermes-4-14B-Q4_K_M`, `gemma-3-12b-it-Q4_K_M`, or `Qwen3-4B-Instruct-2507-Q4_K_M` (~2.5 GB) for low-latency.
- `embed`: small Q4 embed if the card has 16 GB+; skip on 10–12 GB cards.
- AMD route is `hal0-toolbox-rocm`; NVIDIA stays on the CUDA llama.cpp build.
- Trade: one slot at a time is the norm — no simultaneous primary + embed + audio.

#### CPU-only (32–64 GB system RAM, no GPU)

- `primary`: `gemma-3-1b-it-Q4_K_M` (~0.7 GB) or `Qwen3-4B-Instruct-2507-Q4_K_M` (~2.5 GB) for a snappier feel. *(fallback: `Phi-3-mini-4k-instruct-q4.gguf` ~2.4 GB, the curated default)*
- `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB) — runs fine on CPU.
- No `stt` / `tts` slots — Moonshine and Kokoro are technically CPU-capable but streaming audio at usable latency wants at least an iGPU.
- Expect: a few tok/s on chat, fine for occasional Q&A and dev smoke; not the streaming experience.

Strix Halo's unified pool is what unlocks the 70B Q4 and large/agentic
tiers; on discrete cards you trade ceiling for raw tok/s on smaller
models. hal0 picks the right provider automatically based on probe
(`hal0/hardware/probe.py` → `/etc/hal0/hardware.json` → slot defaults).

Loadouts are starting points. Every real install ends up tweaked.

## License status

**Apache 2.0.** Settled 2026-05-15 (PLAN §16). `LICENSE` file is at
the hal0 repo root; the README's "License" section
(`hal0/README.md:81`) now reads "Apache 2.0. See `LICENSE`." — fully
consistent with this brief.

## Repo location

- **Code**: `https://github.com/hal0ai/hal0`
- **Web (this site)**: `https://github.com/hal0ai/hal0.dev`
- **Toolbox images**: `ghcr.io/hal0ai/hal0-toolbox-{vulkan,rocm,flm,moonshine,kokoro,comfyui}`.
  As of 2026-05-15 all are published and pinned by sha256 in
  `hal0/manifest.json` **except** `flm`, whose digest is still `null`
  pending the manifest-patch CI step.

Settled 2026-05-15 (PLAN §16, MEMORY entry `hal0ai_github_org`).
GitHub org is `hal0ai` — do not write `hal0-dev`, that's a stale
placeholder.

## Notable code / architectural facts worth surfacing

- **FHS-aligned layout** — `/usr/lib/hal0/current/` (atomic symlink to
  versioned dir), `/etc/hal0/` (config, preserved across updates),
  `/var/lib/hal0/` (models, registry, OpenWebUI state). `HAL0_HOME`
  overrides all of the above for dev installs. (PLAN §2)
- **systemd template units** — slots are `hal0-slot@<name>.service`
  instances (`packaging/systemd/hal0-slot@.service`), not per-slot
  hand-written units. One template, N instances, all rendered from
  config.
- **Atomic TOML config** — every config write is
  `NamedTemporaryFile(delete=False) + os.replace()`; a failed write
  leaves the prior file intact (PLAN §5 Tier 1).
- **Cosign-verified releases** — `hal0 update` fetches a release manifest
  (`docs/release-manifest.md` schema `hal0.releases.v1`), verifies the
  tarball against `signer_identity` + `signer_issuer` (GitHub OIDC),
  unpacks to `/usr/lib/hal0-<ver>/`, then swaps the `current` symlink.
- **Structured error envelopes** — every API response failure carries
  `{"error":{"code":"slot.not_ready","message":...,"details":{...}}}`
  with namespaced codes (`slot.*`, `model.*`, `dispatch.*`, `config.*`,
  `system.*`). (PLAN §5 Tier 1)
- **Slot ports** — 8081–8099, bound to `127.0.0.1` only. Only `:8080`
  (API) and `:3001` (OpenWebUI) bind public interfaces. (PLAN §2 Ports)
- **Three test tiers** — α unit (pytest, no daemons, ~3s), β integration
  (real systemd template + Vulkan-CPU + Qwen 0.5B in CI, ~10 min), γ
  release-gate (`make release-test` on the `hal0-test` LXC over SSH,
  full NPU+ROCm+Vulkan+STT+TTS+updater+OpenWebUI matrix).
  (`CONTRIBUTING.md`)
- **Telemetry is off by default** — endpoint `telemetry.hal0.dev/v1/ping`
  is plumbed but the toggle defaults off; opt-in surfaces hardware class,
  hal0 version, OS, slot count, daily ping — no model names, no IPs, no
  config contents (PLAN §14).

## Open questions / things to surface to the user before publishing

- **`hal0.dev/install` URL is aspirational** — currently the installer
  is fetched out of the repo. Need to confirm DNS / static-host plan
  for serving the raw `install.sh` over HTTPS at that URL before the
  one-liner on the landing page is real.
- **Public launch story** (PLAN §16 still open) — blog post? HN? AI
  subreddits? Affects what the landing page emphasises ("here it is" vs.
  "coming soon").
- **Contribution model** (PLAN §16 still open) — README says external
  contributions aren't being accepted until v0.2; should the site echo
  that or punt to GitHub?
- **Status badge** — pre-alpha banner on README. Do we want the same
  banner on the landing page, or is the v1 cut close enough to drop it?
- **NPU perf numbers** — none verified in repo yet (`flm` toolbox image
  digest still `null` in `manifest.json`); leave NPU claims as
  "supported, benchmarks TBD" until a real measurement lands.
- **Image-gen perf** — no measured tok-equivalent or s/image numbers
  are in the repo yet for ComfyUI on Strix Halo iGPU; the docs page
  should cite latencies as `[TODO: verify]` until a real run is logged.
- **Flux workflow** — `flux-schnell` is in the curated catalogue but
  the default `sdxl_turbo_simple` workflow can't load its T5 text
  encoder. Mark Flux as "catalogued, picker UI promotion pending a
  Flux workflow" wherever the site lists it.
