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

Status caveat: the installer is real (Phase 2 done) and produces a
running `hal0-api`; FLM / Moonshine / Kokoro toolbox images are **not
yet published** to `ghcr.io/hal0ai/` (`docs/handoff-2026-05-15-autonomous.md`
lines 146–157, PLAN §17 risks row).

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

## Features list (8–10 items, grounded in PLAN.md)

1. **OpenAI-compatible `/v1/*` API** — chat, completions, embeddings,
   rerank, audio transcriptions, audio speech, models. Drop-in for any
   OpenAI SDK. (PLAN §1)
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

## Built-in slots

The four always-present slots (`BUILTIN_SLOTS` in
`src/hal0/slots/manager.py:135`; cannot be deleted via the UI):

| Slot | What it does | Default backend |
|---|---|---|
| `primary` | Chat / general LLM (`/v1/chat/completions`, `/v1/completions`) | llama.cpp (Vulkan) |
| `embed`   | Embeddings (`/v1/embeddings`) and rerank (`/v1/rerankings`) | llama.cpp (Vulkan) |
| `stt`     | Speech-to-text (`/v1/audio/transcriptions`) | Moonshine |
| `tts`     | Text-to-speech (`/v1/audio/speech`) | Kokoro |

User-defined slots (e.g. `npu`, `vision`) can be added on top.

## Provider matrix (v1)

From `hal0/PLAN.md` §1 + `src/hal0/providers/`:

| Provider | Hardware | What it serves |
|---|---|---|
| **llama.cpp** | Vulkan (default) / ROCm (opt-in) | chat, embed, rerank, vision |
| **FLM** | AMD XDNA NPU (opt-in) | chat / embed / ASR multiplex |
| **Moonshine** | CPU / Vulkan | STT (`/v1/audio/transcriptions`) |
| **Kokoro** | CPU / Vulkan | TTS (`/v1/audio/speech`) |

All four are first-class in v1. Each provider is a class with
`build_env() / start_cmd() / health() / infer()` — stateless, swappable
(`ARCHITECTURE.md` §Key boundaries).

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

### Shipped (Phase 1 done 2026-05-15, per PLAN §15)

- Slot manager + dispatcher port from haloai
- Four providers (llama.cpp, FLM, Moonshine, Kokoro) wired
- `/v1/*` and `/api/slots/*` end-to-end through real httpx client
- Slot lifecycle state machine + single-flight + adaptive cold-boot
- Pydantic-validated TOML config + atomic env writes
- Installer that produces a runnable venv + systemd units
- 353 unit tests passing, integration tier on Vulkan-CPU + Qwen 0.5B

### Soon (v0.2, deferred from v1; PLAN §1 "v0.2 deferred")

- Memory subsystem
- MCP support
- Kyuzo image generation (ComfyUI provider)
- Benchmarks UI + Presets UI
- AUR PKGBUILD + Ubuntu PPA
- Caddy reverse proxy + auth + `hal0.local` mDNS
- Light mode toggle

### Exploring

- `[TODO: verify]` Anything beyond v0.2 isn't in PLAN.md.

### Remaining gaps for v1.0 cut (`docs/handoff-2026-05-15-autonomous.md`)

- `POST /api/models/{id}/pull` (HF streaming download) is still 501
- FLM / Moonshine / Kokoro / ROCm toolbox image builds not yet
  published to `ghcr.io/hal0ai/`
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

Curated starting points, not gospel — mix, match, and tweak. The slot
system happily takes a different model per slot whenever you change your
mind. Sizes are published GGUF Q4_K_M / Q8_0 file sizes summed; no tok/s
numbers here (see the perf table for the only verified ones).

### Coding — small / mid / large

- **Small** (~3 GB) — `primary`: `Qwen2.5-Coder-3B-Instruct-Q8_0`. Fits anywhere with a few GB to spare; great for inline completion.
- **Mid** (~10 GB) — `primary`: `Qwen2.5-Coder-14B-Instruct-Q4_K_M` (~9 GB); `embed`: `nomic-embed-text-v1.5-Q4_K_M` (~140 MB) for repo-aware search.
- **Large** (~35 GB) — `primary`: `Qwen2.5-Coder-32B-Instruct-Q8_0`; `embed`: `bge-large-en-v1.5-Q8_0` (~670 MB). Strix Halo unified pool eats this happily; over the line for single 24 GB discrete cards.

### General chat — small / mid / large

- **Small** (~2 GB) — `primary`: `Llama-3.2-3B-Instruct-Q4_K_M`. Snappy on any modern box.
- **Mid** (~5 GB) — `primary`: `Meta-Llama-3.1-8B-Instruct-Q4_K_M` or `Qwen3-4B-Instruct-Q8_0`. The everyday default.
- **Large** (~42 GB) — `primary`: `Llama-3.3-70B-Instruct-Q4_K_M`. Strix Halo or a multi-GPU rig; not feasible on a single 24 GB card.

### Voice mode (~3 GB total)

- `primary`: `Llama-3.2-3B-Instruct-Q4_K_M` (~2 GB) — low-latency reply
- `stt`: Moonshine base (~190 MB) via the `moonshine` toolbox
- `tts`: Kokoro-82M (~330 MB) via the `kokoro` toolbox
- Leaves headroom on the iGPU for the streaming pipelines; v1 reference target.

### Creative / fun writing (~14 GB)

- `primary`: `Mistral-Small-24B-Instruct-2501-Q4_K_M`. Long-form prose strength without going to a 70B. Lighter alternative: `Hermes-3-Llama-3.1-8B-Q4_K_M` (~5 GB).

### Privacy-first / minimal footprint (<2 GB)

- `primary`: `Qwen2.5-0.5B-Instruct-Q4_K_M` (~400 MB) — the CI smoke model
- `embed`: `nomic-embed-text-v1.5-Q4_K_M` (~140 MB)
- Runs on CPU-only fallback boxes; the smallest viable hal0 install.

### RAG / knowledge-base (~10 GB)

- `primary`: `Qwen2.5-14B-Instruct-Q4_K_M` (~9 GB) for synthesis
- `embed`: pick one — `bge-large-en-v1.5-Q8_0` (~670 MB, English-leaning) or `mxbai-embed-large-v1-Q4_K_M` (~340 MB, broader). The embed slot also serves rerank via `/v1/rerankings`.

### Agentic tool-use (~21 GB)

- `primary`: `Qwen2.5-32B-Instruct-Q4_K_M` (~20 GB) — strong tool-call reasoning, fits a single Strix Halo box without paging.
- `embed`: `nomic-embed-text-v1.5-Q4_K_M` (~140 MB) for retrieval-augmented routing.
- Lines up with the v0.2 agents / MCP roadmap (PLAN §1 "v0.2 deferred").

### Hardware fit summary

- **Strix Halo / Ryzen AI Max** — every loadout above, including 70B and 32B Q4 in the unified pool.
- **AMD discrete (ROCm) / NVIDIA (CUDA)** — small + mid loadouts fit a 16–24 GB card; large needs multi-GPU.
- **CPU fallback** — privacy-first only.

## License status

**Apache 2.0.** Settled 2026-05-15 (PLAN §16). LICENSE file is at the
hal0 repo root. The README still says "TBD — to be decided before v1.0"
(`hal0/README.md:65`) — slightly stale, but the canonical answer is
Apache 2.0.

## Repo location

- **Code**: `https://github.com/hal0ai/hal0`
- **Web (this site)**: `https://github.com/hal0ai/hal0.dev`
- **Toolbox images**: `ghcr.io/hal0ai/hal0-toolbox-{vulkan,rocm,flm,moonshine,kokoro}`
  (vulkan tag `:dev` exists today; the rest pending Phase 2 publish.)

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

- **README license line is stale** — says "TBD"; should we PR a fix into
  `hal0/README.md` before the site references the README directly?
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
- **NPU perf numbers** — none verified in repo yet (FLM toolbox image
  not built); leave NPU claims as "supported, benchmarks TBD" until a
  real measurement lands.
