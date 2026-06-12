# CONTENT_BRIEF

> Source of truth for the hal0.dev marketing + docs site.
> Cite this file rather than re-reading the hal0 repo. All numbers and
> claims have a repo citation, or are marked `[TODO: verify]`.

## One-liner

**hal0 — open-source homelab AI inference platform for tinkerers and devs.**

## Elevator pitch (3 sentences)

hal0 is a homelab AI inference platform: the Linux box you already
have in the rack, running real OpenAI-compatible inference. It manages
model **slots** as podman containers under per-slot systemd units with
a typed lifecycle state machine, exposes an **OpenAI-compatible
`/v1/*` API**, and ships with a React **dashboard** plus a **prewired
OpenWebUI** chat tab. One command installs on any modern Linux box —
Strix Halo iGPU, AMD discrete, NVIDIA, or CPU — and it's happy in a
privileged Proxmox LXC with GPU/NPU passthrough, behind your Traefik.

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
curl -fsSL https://hal0.dev/install.sh | bash
```

From `hal0/installer/README.md` line 9. Idempotent, non-interactive.
Repo fallback: `sudo bash installer/install.sh` from a clone.

**Proxmox VE one-liner (added 2026-05-26).** On a Proxmox host:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Hal0ai/hal0/main/scripts/proxmox-ve/hal0.sh)"
```

Creates an unprivileged Debian 13 LXC and runs the standard bootstrap
inside it. `--advanced` opens whiptail prompts; every parameter has
an env-var override (`CTID`, `RAM_MB`, `STORAGE`, `NET_CONFIG`, …).
Hardware-agnostic — Strix Halo iGPU/NPU passthrough still needs the
privileged-LXC recipe documented in the main hal0 repo.
Source of truth: `Hal0ai/hal0:scripts/proxmox-ve/hal0.sh`.

Overrides (env vars, from `installer/install.sh`):
`HAL0_PREFIX`, `HAL0_PORT` (default 8080), `HAL0_USER`, `HAL0_PYTHON`,
`HAL0_NO_PROBE`, per-backend `HAL0_TOOLBOX_IMAGE_*`.

Status caveat: the installer is real and produces a running
`hal0-api`. All six toolbox images —
`vulkan`, `rocm`, `flm`, `moonshine`, `kokoro`, `comfyui` — are
published to `ghcr.io/hal0ai/` and pinned by sha256 digest in
`hal0/manifest.json` (`toolbox_images.*.digest`). Slots run as
**podman containers** under per-slot `hal0-slot@<name>.service`
systemd units, orchestrated by hal0-api; container images and tuned
flags come from slot profiles. FLM chat + embed are surfaced in the
picker when XDNA hardware and the local toolbox image are both present.
APIs may shift before v1.0.

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
- **`hal0` lands on PATH automatically** — the CLI install step drops
  an idempotent symlink at `/usr/local/bin/hal0 → ${VENV_DIR}/bin/hal0`
  (`installer/install.sh:229–233`); override with `HAL0_PATH_LINK`,
  skipped in `--dev`, removed by `uninstall.sh`. Commit `523e4c1`.
  Operators no longer need `source /etc/profile.d/hal0.sh` after
  install.
- **`--models-dir=PATH` install flag** — point the install at an
  existing model store at provisioning time. Resolution order: explicit
  flag → `HAL0_MODELS_DIR` env → interactive prompt on a tty →
  `/var/lib/hal0/models` default. Must be absolute (die check at
  `installer/install.sh:157–158`). Persisted as `[models].pull_root`
  and auto-included in `[models].roots` so a fresh install scans the
  existing tree on first boot (`installer/install.sh:64–93`,
  `installer/install.sh:142–160`, `installer/install.sh:263–292`).

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
3. **systemd-managed podman containers** — each slot runs as a podman
   container under a `hal0-slot@<name>.service` unit; container images
   and tuned flags come from slot profiles. The API process never holds
   a model in its own memory. An exclusive GPU arbiter swaps the iGPU
   between LLM serving and ComfyUI image generation. The NPU runs a
   single FastFlowLM container serving chat + ASR + embeddings.
   (`ARCHITECTURE.md` §Process model)
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
7. **React 18 + TypeScript + Vite dashboard** — 9 views: Dashboard,
   Slots, Models, Hardware, Logs, Settings, Providers, FirstRun, plus
   error shell. Dark mode default; SSE for status + log tail. (PLAN §6)
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
    The dashboard operates ComfyUI as a containerized generation
    engine with a gated inference ⇄ generation iGPU switchover
    (hal0 PRs #686/#690, 2026-06-11 — see "Image generation" below).
12. **Trusted-LAN default — no built-in auth** — hal0-api binds
    `0.0.0.0:8080` with no network gate (ADR-0012; Caddy / `--auth=basic`
    removed in v0.3). Deploy behind your own Traefik/nginx/Cloudflare
    Tunnel when you need authentication or TLS. The Origin allowlist
    and HMAC session cookie still gate the chat-proxy WebSocket path.
    (`src/hal0/api/routes/agents/_auth.py`)
13. **Proxmox host-pressure segment (LXC deployments)** — drop a
    read-only `PVEAuditor` API token into Settings → "Proxmox
    integration" and the dashboard's unified-memory bar shows the
    physical host's DIMM total + a muted "Proxmox host" segment for
    other-tenant + ZFS ARC + kernel pressure instead of just the
    LXC's cgroup slice. Token is sensitive and stored 0600 at
    `/etc/hal0/proxmox.json`; the API redacts it on read (only
    `token_value_set: bool`). Bare-metal installs leave the panel off
    and the dashboard stays quiet. Token-rot signalled by persistent
    pills on Dashboard + FooterBar plus a one-shot
    `system.proxmox_unreachable` event on the ok→broken transition
    (PR #103, `src/hal0/hardware/pve.py`,
    `src/hal0/api/routes/proxmox.py`).

## Built-in slots

The five always-present slots (`BUILTIN_SLOTS` in
`src/hal0/slots/manager.py:135`; cannot be deleted via the UI):

| Slot | What it does | Default backend |
|---|---|---|
| `primary` | Chat / general LLM (`/v1/chat/completions`, `/v1/completions`) | llama-server (Vulkan) |
| `embed`   | Embeddings (`/v1/embeddings`) and rerank (`/v1/rerankings`) | llama-server (Vulkan) |
| `stt`     | Speech-to-text (`/v1/audio/transcriptions`) | Moonshine |
| `tts`     | Text-to-speech (`/v1/audio/speech`) | Kokoro |
| `img`     | Image generation (`/v1/images/generations`) | ComfyUI (ROCm) |

User-defined slots (e.g. `npu`, `vision`) can be added on top.

The capabilities layer also creates one **auto-managed non-builtin
slot** on first use: `embed-rerank` for the embed.rerank child
(`src/hal0/capabilities/orchestrator.py:50`). Default model
`bge-reranker-v2-m3-q4_k_m`, default port `8086`, requires
`defaults.extra_args = "--reranking"` in the slot TOML so llama-server
exposes `/v1/rerankings` instead of the chat surface. The
orchestrator's `_ensure_slot_exists()`
(`src/hal0/capabilities/orchestrator.py:446`) synthesises the TOML
from the operator's selection on first enable and `_next_free_slot_port()`
(`:510`) picks a non-8081 port to avoid collision with `primary`.

## Capability slots layer (dashboard overlay)

The flat slot layer above is what runs; the dashboard groups it into
**capability cards** so an operator picks "embed" or "voice" without
needing to know about systemd templates. State lives in
`/etc/hal0/capabilities.toml` (path resolved by
`capabilities_toml_path()` in `src/hal0/capabilities/config.py:83`).

- **Capability → child → slot bridge** — hardcoded in
  `_CHILD_TO_SLOT` (`src/hal0/capabilities/orchestrator.py:48–54`):
  embed → {embed, rerank → `embed-rerank`}, voice → {stt, tts},
  img → {img}. Legal capability set is
  `LEGAL_SLOTS = ("embed", "voice", "img")`
  (`src/hal0/capabilities/orchestrator.py:62`).
- **Catalog (picker rows)** — `models_for_capability()` in
  `src/hal0/capabilities/catalog.py:511` returns model-first grouped
  rows (`id`, `capabilities`, `size_gb`, `backends[]`) per child, so
  the dashboard offers one model dropdown and narrows the backend
  dropdown to that model's legal options. Replaces the older flat
  per-(model, backend) shape that let operators pick incompatible
  pairs (`backend=npu` + a llama.cpp GGUF) which then crashed the slot
  at start-up.
- **Backend rollup** — `available_backends()`
  (`src/hal0/capabilities/catalog.py:110`) orders backends NPU → GPU
  (Vulkan) → GPU (ROCm) → CPU. NPU is only advertised when XDNA is
  present AND the FLM toolbox image is locally available
  (`_flm_image_present()`, `src/hal0/capabilities/catalog.py:79`).
- **NPU backend card** — rolls up every NPU-capable model across
  chat / embed slots in one disclosure (`catalogs_by_slot()` includes
  a `chat` bucket explicitly for this card to walk — see
  `src/hal0/capabilities/catalog.py:636–660`). Vue components in
  `ui/src/components/capabilities/{EmbedCard,VoiceCard,ImgCard,
  NPUBackendCard,CapabilityToggle,CapabilitiesSection}.vue`.
- **API routes** — `src/hal0/api/routes/capabilities.py`. `GET
  /api/capabilities` returns `{backends, catalogs, selections}`;
  `POST /api/capabilities/{slot}/{child}` accepts a partial
  `{backend, provider, model, enabled}` body and reconciles slot
  lifecycle (typed `BadRequest` envelopes for unknown slot / child /
  field keys).
- **Lifecycle dispatch** — `CapabilityOrchestrator.apply()`
  (`src/hal0/capabilities/orchestrator.py:268`) shallow-merges the
  partial, validates the (model, backend) pair against the catalog
  (`_validate_model_in_catalog`, `:387`), then flips the underlying
  slot: off→on calls `load()`, on→off calls `unload()`, hot-swaps
  call `swap()`. Non-builtin children (`embed-rerank`) auto-create
  their slot TOML on first enable via `_ensure_slot_exists()`
  (`:446`), picking the next free port in 8081–8099.
- **CLI** — `hal0 capabilities migrate [--dry-run]`
  (`src/hal0/cli/capabilities_commands.py:82`) walks
  `capabilities.toml` and snaps illegal (backend, model) pairs to the
  model's first legal backend; selections whose model is gone get
  cleared. Idempotent.

## Provider matrix (v1)

From `hal0/PLAN.md` §1 + `src/hal0/providers/`:

| Provider | Hardware | What it serves |
|---|---|---|
| **llama.cpp** (llama-server) | Vulkan (default) / ROCm (opt-in) | chat, embed, rerank, vision |
| **FLM** | AMD XDNA NPU (opt-in) | chat / embed / ASR multiplex — one FastFlowLM container serves all three |
| **Moonshine** | CPU only | STT (`/v1/audio/transcriptions`) |
| **Kokoro** | CPU / Vulkan | TTS (`/v1/audio/speech`) |
| **ComfyUI** | ROCm (Strix Halo iGPU class) | Image gen (`/v1/images/generations`) — exclusive GPU arbiter swaps iGPU between inference and generation |

All five are first-class in v1. Every slot runs as a **podman container**
under a `hal0-slot@<name>.service` unit; container images + tuned flags
come from profiles. Each provider is a class with
`build_env() / start_cmd() / health() / infer()` — stateless, swappable
(`ARCHITECTURE.md` §Key boundaries).

**Provider name in TOML**: use `llama-server` (not `llama.cpp`) in slot
TOML files — `_VALID_PROVIDERS` = `{llama-server, flm, moonshine, kokoro}`
(`src/hal0/config/schema.py:89`).

### FLM NPU (AMD XDNA) deep-dive

FLM is live as the NPU provider — opt-in, surfaced in the picker only
when XDNA hardware AND a local toolbox image are both present.

- **Provider** — `src/hal0/providers/flm.py:105` (`FLMProvider`). Health
  probe REQUIRES a real `/v1/chat/completions` round-trip with
  `max_tokens=1`, not just a populated `/v1/models` list — Tier-1 fix
  for the haloai-era latent-failure bug
  (`src/hal0/providers/flm.py:108–111`).
- **Self-contained toolbox image** — `ghcr.io/hal0ai/hal0-toolbox-flm:v1`
  (`src/hal0/providers/flm.py:45`). The image bundles FLM at
  `/opt/fastflowlm/` (binary, libs, xclbins, share assets) and
  symlinks `/usr/local/bin/flm` — no host bind-mount of the FLM tree
  is required, ENTRYPOINT runs the in-image `flm` via tini and the
  `container_spec` only supplies the subcommand + args
  (`src/hal0/providers/flm.py:48–60`). Default port `8086`
  (`src/hal0/providers/flm.py:129`).
- **Model namespace** — FLM has its own model registry; it can't run
  arbitrary GGUFs. Available tags come from
  `flm list -j` against the bundled
  `/opt/fastflowlm/share/flm/model_list.json`
  (`src/hal0/providers/flm.py:246`, probed by `_probe_flm_catalog()`
  at `:414` and lifted into hal0 capability shape by
  `flm_served_models()` at `:460`).
- **Per-(backend, model) validation** — the catalog reshape emits one
  row per `(model, backend)` and the orchestrator rejects illegal
  pairs with `capability.illegal_backend_model_pair`
  (`src/hal0/capabilities/orchestrator.py:432–444`). `hal0
  capabilities migrate` retroactively cleans up pre-reshape selections
  (`src/hal0/cli/capabilities_commands.py:82`).
- **Pull path** — FLM tags are now first-class in
  `POST /api/models/{id}/pull` (PR #89). `is_flm_tag()` detects the
  Ollama-style `family:size` ids the toolbox owns; `run_flm_pull()`
  shells `flm pull <tag>` inside the toolbox image, parses the
  `Downloading: …%` progress lines, and writes an HF-shaped registry
  entry on completion. `pullable=True` on NPU rows so the dashboard
  button is live (`src/hal0/capabilities/catalog.py`,
  `src/hal0/registry/pull.py`, `src/hal0/providers/flm.py`).
- **Perf** — no measured tok/s yet. `[TODO: verify]`.

## Image generation

### ComfyUI generation engine + iGPU switchover (dashboard, 2026-06-11)

The dashboard now treats ComfyUI as **one containerized "generation
engine"**, not per-model slot cards. The slots page splits into
**Inference | Image Gen** tabs (hal0 PR #686); the Image-Gen tab
renders an engine pane backed by the read-only
`GET /api/comfyui/status` aggregator — container state, which mode
owns the iGPU, live GTT/RAM gauges with memory-pressure warning,
render-queue depth, and **verified** model-inventory counts from the
share (never invented numbers).

The pane's **inference ⇄ generation switchover** is real (hal0
PR #690): a blast-radius confirm dialog (messaging bots go dark,
background memory extraction pauses), then
`POST /api/comfyui/switchover` runs the root-owned script pair on the
runtime host in the background behind a `202`; the `switchover` block
on `/status` drives the "switching…" UI. Dropping a busy render queue
requires explicit `force`; the whole write path is opt-in per host via
`HAL0_COMFYUI_SWITCHOVER_ENABLED` (`501` when off). On a single-iGPU
box (Strix Halo) the LLM stack and ComfyUI are mutually exclusive —
this is the supported way to hand the GPU back and forth.

Site copy guidance: pitch as "run Wan 2.2 / Qwen-Image / SDXL on the
same box that serves your LLMs — flip the GPU from the dashboard."
Cite hal0 PRs #686 and #690. `[TODO: screenshot of the Image-Gen pane
via the γ-suite harness]`

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
hal0 model pull <ref>                # HF streaming pull + tqdm progress
hal0 model rm <ref>
hal0 model assign <ref> --slot S

hal0 config show
hal0 config edit                     # $EDITOR
hal0 config validate
hal0 config migrate

hal0 update [--channel stable|nightly] [--check] [--rollback]
hal0 uninstall [--keep-data] [--force] [--dev]
                                     # thin wrapper over installer/uninstall.sh

hal0 capabilities migrate [--dry-run]   # snap illegal (backend, model)
                                        # pairs in capabilities.toml
hal0 doctor                             # re-run preflight against the
                                        # live host (post-install)
```

(The installer flag `install.sh --models-dir=<abs path>` lives in
shell, not the Typer app — see "Installer overhaul" above.)

Implementation status: every command above hits real endpoints.
`hal0 model pull` streams from Hugging Face with a tqdm-style progress
bar; `hal0 uninstall` exec's `installer/uninstall.sh` (the script is the
source of truth and inherits the live TTY for its DELETE prompt).

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

## First-run wizard (8 linear steps)

`ui/src/views/FirstRun.vue:1–60` (state in
`ui/src/components/firstrun/useFirstRun.js`). Replaces the legacy
5-step picker and three competing IA prototypes that lived in
`components/firstrun-proto/` (all deleted). Sequence:

1. Password (optional; auto-skips when
   `/api/auth/status.password_set` is already true).
2. Detected hardware + model storage directories.
3. Primary chat model — curated picker, hardware-aware.
4. Capabilities — embed / voice.stt / voice.tts / img with smart
   defaults; rerank is a sub-disclosure inside the embed row, locked
   off-by-default.
5. HF token — **conditional**; only rendered when at least one
   selected model is gated (`s.needsHfToken`).
6. License acceptance — aggregated across every selected model.
7. Install — parallel pulls + capability registration with
   retry-per-row.
8. Done — links to dashboard, OpenWebUI chat, settings.

Step transitions live in `goNext()` at `ui/src/views/FirstRun.vue:79`;
the HF-token skip mirrors on Back so the user can retreat from
License to Capabilities without snapping through token entry.

## Models scan preview overhaul

`POST /api/models/scan/preview`
(`src/hal0/api/routes/models.py:148`) is inspection-only — no
registry mutation, no event emission. The UI uses it to populate the
"Scan directory" preview table where the operator edits backends +
capabilities + id before committing through `POST /api/models/scan`
with a `rows` body (`src/hal0/api/routes/models.py:270`, commit path
`_commit_scan_rows()` at `:326`).

What the preview pipeline now does (`src/hal0/registry/detect.py` +
`discover.py`):

- **Kind-driven gating** — `DetectionResult.kind` is one of
  `llama / moonshine / kokoro / flm / unknown`
  (`src/hal0/registry/detect.py:70–84`); the UI uses it to decide
  which backends and capability checkboxes to surface for each row.
- **Shared skip rules** — preview reuses `is_skippable()` from
  `src/hal0/registry/discover.py:308` so mmproj sidecars, multi-file
  shards, hex blobs, and HF/ComfyUI accessory dirs are filtered the
  same way as the on-disk auto-scan.
- **Per-row select checkbox** — the commit body shape is
  `{"rows": [...]}` with whichever rows the operator ticked
  (`src/hal0/api/routes/models.py:282–286`); user edits to
  `backends`/`capabilities`/`id`/`name`/`defaults` always win over
  the detection output.
- **Dedup** — resolved-path dedup (`seen: set[Path]`) handles
  HF blob-cache symlinks; a second pass dedups by
  `(suggested_name, size_bytes, kind)` to collapse multiple
  `snapshots/<rev>/` copies of the same repo
  (`src/hal0/api/routes/models.py:246–265`).
- **GGUF magic-byte detect** — `read_gguf_header()` is tried
  regardless of file extension so HF blob-cache content-hash
  filenames (no suffix) still classify as GGUF
  (`src/hal0/registry/detect.py:171–175`).
- **GGUF `general.name` → suggested name** — pulled out of the
  header and used as `suggested_name`; fall back to
  `general.basename` then to `_hf_repo_name_from_path()` (an
  HF-cache repo-name fallback) when both are missing
  (`src/hal0/registry/detect.py:199–203`).
- **Pooling-type embed signal** — `pooling_type > 0` flips the
  capability to `embed`; filename embed-token fallback handles
  converters that drop the KV
  (`src/hal0/registry/detect.py:181–193`).

## Moonshine STT (CPU-only)

Moonshine is the default STT provider but stays on CPU: upstream
`useful-moonshine-onnx` ships an ONNX Runtime CPU EP only and there's
no Vulkan/ROCm EP in the wheel. The catalog reflects that — the
`moonshine` runtime fan-out is pinned to `("cpu",)` so the picker
never advertises a backend the slot can't honour
(`src/hal0/capabilities/catalog.py:65–70`).

The toolbox image was rebuilt 2026-05-20 to fix a `TypeError` against
`MoonshineOnnxModel(...)` — the constructor needs **both**
`models_dir=` (for local encoder/decoder paths) and `model_name=`
(used internally for the `if "tiny" in model_name` branch); passing
only `models_dir` raises (see comments at
`packaging/toolbox/moonshine/moonshine_server.py:122–141`).

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
- Toolbox image digests pinned for all six providers: vulkan, rocm,
  flm, moonshine, kokoro, comfyui (`hal0/manifest.json`)
- 353 unit tests passing, integration tier on Vulkan-CPU + Qwen 0.5B
- Capability slots overlay (embed / voice / img cards + NPU backend
  rollup), `/etc/hal0/capabilities.toml`, `GET|POST
  /api/capabilities/*`, `hal0 capabilities migrate`
  (`src/hal0/capabilities/{catalog,orchestrator,config}.py`,
  `src/hal0/api/routes/capabilities.py`,
  `src/hal0/cli/capabilities_commands.py`)
- FLM NPU provider live with self-contained toolbox image, per-(backend,
  model) validation, and model-first grouped catalog
  (`src/hal0/providers/flm.py`,
  `src/hal0/capabilities/catalog.py:577`)
- First-run wizard rewrite: 8 linear steps with conditional HF-token
  step (`ui/src/views/FirstRun.vue`, legacy + prototypes deleted)
- `--models-dir=PATH` install flag + interactive prompt
  (`installer/install.sh:64–93`, `:142–160`)
- `embed-rerank` slot auto-managed by the capability orchestrator
  (`_ensure_slot_exists`, `src/hal0/capabilities/orchestrator.py:446`)
- Orchestrator drift fix: `apply()` now reconciles
  `capabilities.toml` ↔ `slots/*.toml` on every call rather than only
  on selection diff, so prior failed applies / manual edits /
  install-time seeds can't leave the two disagreeing
  (`src/hal0/capabilities/orchestrator.py:332–343`)
- Models scan preview overhaul: kind-driven gating, shared skip
  rules, per-row select, dedup, GGUF magic-byte detect, GGUF
  `general.name` → suggested name, HF-cache repo-name fallback
  (`src/hal0/api/routes/models.py:148`,
  `src/hal0/registry/detect.py:140`)
- Per-slot live metrics endpoint — `GET /api/slots/metrics` reads
  podman container cgroup memory + `ActiveEnterTimestampMonotonic` +
  scraped llama-server `/metrics`; falls back to the systemd unit's
  own `MemoryCurrent` for native-host slots
  (`src/hal0/api/routes/slots.py:376–467`)
- Proxmox host-pressure segment for LXC deployments — optional PVE
  API token plumbed through `/api/settings/proxmox` → cached probe in
  `pve.py` → slim projection on `/api/stats/hardware`. Dashboard +
  Hardware views swap to the physical-host memory total when
  configured; token-rot fires `system.proxmox_unreachable` event and
  surfaces a persistent FooterBar pill (PR #103, 2026-05-21).

- Benchmarks UI + Presets UI
- AUR PKGBUILD + Ubuntu PPA
- `hal0.local` mDNS auto-discovery
- Light mode toggle

### Closed in v0.2 (Phase 8 — Agents, MCP, basic memory)

Settled via grilling 2026-05-22; ADRs in
`hal0/docs/internal/adr/0004-agents.md` +
`hal0/docs/internal/adr/0005-memory-engine-cognee.md`. Public API
docs at `hal0/docs/api/mcp.md` + `hal0/docs/api/agents.md`.

- **Bundled agent app** — `Hermes-Agent` (service; installed via
  hal0-owned `hal0-hermes` wrapper that env-file-injects HAL0_* into
  unmodified upstream `hermes`). Wizard step 7 offers install;
  CLI parity via `hal0 agent install hermes-agent`. install.sh stays
  non-interactive. (Second bundled agent — pi-coder — code is parked
  in-repo for v0.3 reactivation; not currently surfaced to users.)
- **Two MCP servers** — `/mcp/admin` wraps existing `/api/*` routes
  (slot, model, capability, config, hardware, log admin) and
  `/mcp/memory` wraps Cognee. Bearer auth reused from ADR-0001.
  Tool catalog is two-tier: routine ops autonomous, capital-D
  destructives (`model_pull`, `slot_delete`, `config_write`, bulk
  `memory_delete`, etc.) gated through the dashboard inbox.
- **Memory engine** — Cognee (Apache 2.0, embedded
  SQLite + LanceDB + Kuzu). Shared dataset by default; per-client
  `X-hal0-Private: 1` header promotes that client's writes to
  `private:<client_id>`. v0.2 exposes `memory_add` / `memory_search` /
  `memory_list` / `memory_delete`; graph extraction + Memify pipeline
  stay disabled until Phase 9.
- **Approval inbox UX** — header bell + modal canonical; inline
  pending chips on Models / Slots / Capabilities pages; pending
  forever (no auto-expire); no per-agent trust toggle (ADR-0004 §5);
  full CLI parity via `hal0 agent approvals {list,approve,deny}`.
- **Audit trail** — every MCP call enriched with the Bearer-derived
  `client_id`, routed through structlog and landing in journald on
  the `hal0-api` unit. Dashboard `/agent` Activity tab walks the same
  stream.
- **Track-latest with nightly smoke test** — the bundled agent
  tracks upstream latest (diverges from OWUI pin-per-release by
  intent); a nightly CI workflow at `.github/workflows/agent-shim-smoke.yml`
  exercises the `hal0-hermes` wrapper against current upstream and
  asserts an MCP round-trip.

### Exploring

- `[TODO: verify]` Anything beyond v0.2 isn't in PLAN.md.

### Closed before v0.1.0-alpha cut (2026-05-21)

All six toolbox images (`vulkan`, `rocm`, `flm`, `moonshine`, `kokoro`,
`comfyui`) are published with pinned sha256 digests in `manifest.json`.
The release.yml + cosign-keyless OIDC pipeline was smoke-tested
end-to-end via `v0.0.0-rc1` before tagging the alpha.

### Closed before v0.1.1 cut (2026-05-22)

The first-run wizard now completes end-to-end on non-Strix-Halo hosts:

- **Auth**: `POST /api/auth/password` issues a `hal0_session` cookie
  on the first-run leg so the wizard's writer calls (PUT
  `/api/config/models`, model pulls, capability registration)
  authenticate cleanly. The first-run claim allowlist also covers
  those writer routes for the "skip — leave open" path. Lockfile is
  consumed on `POST /api/install/complete` so the open-claim window
  closes when the wizard finishes.
- **Wizard UX**: chat-model selection optional ("Skip — no chat
  model"); image models filtered out of the chat picker;
  zero-item installs flow straight to the done coda.
- **Curated catalog**: 3 embed picks (nomic-embed-text-v1.5 Q8,
  bge-base-en-v1.5 Q4_K_M, embed-gemma:300m) + 2 rerank picks
  (bge-reranker-base Q4_K_M, bge-reranker-v2-m3 Q4_K_M) seed the
  capability dropdowns on a standalone install. STT/TTS deferred —
  moonshine + kokoro need a pull-layer extension.
- **Portable hardware probe**: real CPU/RAM/GPU on WSL 2 (with
  systemd), Proxmox VMs, and bare-metal Linux. New `platform` field
  (`wsl2` / `lxc` / `proxmox-kvm` / `kvm` / `strix-halo` /
  `bare-metal-{nvidia,amd,intel}-gpu` / `bare-metal-cpu-only` /
  `unknown`); UI labels memory as "unified" only when it actually is.
- **Uninstaller**: DELETE confirm prompt no longer prints literal
  `\033[...` escape sequences.

PR #111, tag `v0.1.1`.

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

#### Coding — small / mid / max

- **Small** (~5 GB) — `primary`: `Qwen2.5-Coder-7B-Instruct-Q4_K_M`. No Qwen3-Coder small variant has shipped yet; the 7B Qwen2.5 stays the best small dedicated coder until that lands.
- **Mid** (~19 GB) — `primary`: `Qwen3-Coder-30B-A3B-Instruct-Q4_K_M` (~18.6 GB, MoE with only 3B active params — runs near 3B speeds, reasons like a 30B); `embed`: `nomic-embed-text-v2-moe-Q4_K_M` (~140 MB) for repo-aware search. *(fallback: `Qwen2.5-Coder-32B-Instruct-Q4_K_M` ~20 GB)*
- **Max** (~47 GB) — `primary`: `Qwen3-Coder-Next-80B-A3B-Instruct-Q4_K_M` (~47 GB, MoE with 3B active — the Qwen3-Coder lineup's largest published variant, dedicated coder weights). Alts: `Hermes-4-70B-Q4_K_M` (~42.5 GB, hybrid reasoning + tool-friendly coding for problems where a general reasoner beats a coder) and `Qwen3.6-27B-A3B-MTP-Q4_K_M` (~18.8 GB, MoE with Multi-Token Prediction — fast reasoning fallback when the 80B is paged out). 128 GB headroom keeps the 30B-A3B coder hot alongside an 80B coder in separate slots. *(fallback: `Llama-3.3-70B-Instruct-Q4_K_M`)*

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

- **Code**: `https://github.com/Hal0ai/hal0`
- **Web (this site)**: `https://github.com/Hal0ai/hal0-web`
- **Toolbox images**: `ghcr.io/hal0ai/hal0-toolbox-{vulkan,rocm,flm,moonshine,kokoro,comfyui}` —
  all six published and pinned by sha256 in `hal0/manifest.json` as
  of v0.1.1.
- **Release manifest**: `https://releases.hal0.dev/{stable,nightly}.json`
  (live; CF Pages middleware proxies the asset off the latest GH
  Release on `hal0ai/hal0`; ~60s propagation).

Settled 2026-05-15 (PLAN §16, MEMORY entry `hal0ai_github_org`).
GitHub org is `Hal0ai` (capital H) — do not write `hal0-dev`, that's
a stale placeholder.

## Notable code / architectural facts worth surfacing

- **FHS-aligned layout** — `/usr/lib/hal0/current/` (atomic symlink to
  versioned dir), `/etc/hal0/` (config, preserved across updates),
  `/var/lib/hal0/` (models, registry, OpenWebUI state). `HAL0_HOME`
  overrides all of the above for dev installs. (PLAN §2)
- **systemd template units + podman containers** — slots are
  `hal0-slot@<name>.service` instances that each launch a **podman**
  container; not per-slot hand-written units and not Docker Compose.
  One template, N instances, all rendered from config. Container images
  and flags come from slot profiles managed by hal0-api.
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

- **Public launch story** (PLAN §16 still open) — blog post? HN? AI
  subreddits? Affects what the landing page emphasises now that
  v0.1.0-alpha is out.
- **Contribution model** (PLAN §16 still open) — README says external
  contributions aren't being accepted until v0.2; should the site echo
  that or punt to GitHub?
- **NPU perf numbers** — none verified in repo yet; leave NPU claims
  as "supported, benchmarks TBD" until a real measurement lands.
- **Image-gen perf** — no measured tok-equivalent or s/image numbers
  are in the repo yet for ComfyUI on Strix Halo iGPU; the docs page
  should cite latencies as `[TODO: verify]` until a real run is logged.
- **Flux workflow** — `flux-schnell` is in the curated catalogue but
  the default `sdxl_turbo_simple` workflow can't load its T5 text
  encoder. Mark Flux as "catalogued, picker UI promotion pending a
  Flux workflow" wherever the site lists it.
