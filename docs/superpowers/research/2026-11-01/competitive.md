# hal0 competitive landscape (research date: 2026-11-01)

Method: WebSearch-class tooling (Tavily search/extract) on vendor docs, GitHub READMEs/issues, and third-party reviews. Every factual claim carries a source tag `[Sn]`; the URL list is at the bottom. Where I could not confirm a fact it says **unverified**. Third-party/competitor-authored sources are flagged where they matter.

**Tooling gap:** Semrush keyword volumes were attempted and failed (`no_api_units` on the account). Section D therefore has no search-volume/difficulty numbers — phrases are derived from how the field words itself (taglines, repo topics, titles). Treat volume as unverified.

**Reading guide:** "Q1..Q12" = the 12 questions from the brief:
Q1 concurrent models · Q2 stable alias/route · Q3 hot-swap/unload timers · Q4 profiles/presets · Q5 MCP host/catalog · Q6 memory · Q7 agent · Q8 voice/image bundled · Q9 AMD ROCm/Strix Halo/NPU · Q10 telemetry · Q11 license/company · Q12 tagline.

---

## A. Comparison tables

### A1. Questions 1–6 (serving behaviour + built-ins)

| Product | Q1 Concurrent models | Q2 Stable alias/route | Q3 Hot-swap / unload | Q4 Profiles/presets | Q5 MCP host/catalog | Q6 Memory |
|---|---|---|---|---|---|---|
| **Ollama** | Yes: `OLLAMA_MAX_LOADED_MODELS` default 3×GPUs (3 on CPU) *if they fit*; per-model parallel default 1; GPU models must fit fully in VRAM [S1] | No dedicated alias layer found (**unverified**). Named variants via Modelfile/`create` [S7] | Load on request; `keep_alive` default 5 min, per-request override, `-1` pin, `0` unload [S1] | Modelfile `PARAMETER`/`SYSTEM` per model [S7]; server tuning is global env vars [S1] | No built-in MCP host found (**unverified**). Web-search API + MCP server for it [S9] | None found (**unverified**) |
| **LM Studio** | Yes. JIT-loaded models: Auto-Evict (default on) keeps 1; manually loaded models are not evicted; 0.4.0 adds parallel requests per model [S14][S12] | Partial: custom `--identifier` set at load time [S15]; not a route decoupled from the model | JIT load on request, per-load `--ttl`, Auto-Evict [S13][S14][S15] | Config Presets = system prompt + inference params, shareable via Hub [S17] | MCP **host** since 0.3.17 (`mcp.json`) [S16] | None found (**unverified**); doc RAG ("chat with documents") [S85] |
| **LocalAI** | Yes: `--max-active-backends=N` with LRU eviction; default is keep-loaded-once-used [S25]. Plus distributed/P2P across nodes [S24] | Requests select by configured model name [S25]; separate alias/route layer **unverified** | LRU + idle watchdog (e.g. 15 m) [S25] | Per-model config files (**not verified this session**) | Yes: MCP tool loop server- or client-side, agents UI [S24][S26] | Only an MCP "memory" server example [S26]; built-in vector memory **unverified** |
| **Jan** | Router mode since v0.8.0 (one unified llama.cpp router that loads/unloads on demand) [S30]; how many stay resident in Jan: **unverified** (upstream router default is 4 [S36]) | Local API `model` must match an available model ID [S32]; alias **not found** | On-demand load/unload [S30]; idle timer **unverified** | "Custom assistants" (prompt presets) [S29]; engine settings per model [docs: troubleshooting] | MCP client + inline approval [S29][S30]; catalog **unverified** | Per-conversation only (third-party claim, [S78]) |
| **llama-swap** | Yes: `groups` with `swap:false`, and a `matrix` DSL for allowed concurrent sets [S33][S34]; default behaviour swaps | **Yes: `aliases` per model**, optional alias listing in `/v1/models` [S33][S34]; "profiles" switch model-ID routing at runtime [S33] | Load on request; `ttl` per model, `globalTTL` default 0 = never unload; `hooks.on_startup.preload` [S34] | Per-model `cmd` + `macros`; request `filters`/`setParams` [S33] | No | No |
| **llama.cpp `llama-server` router** | Yes: `--models-max` default 4 [S36] | Routes by `model` name; names come from cache/`--models-dir`/preset INI [S36][S37]; extra alias layer **unverified** | Autoload on by default (`--no-models-autoload`); load/unload endpoints; preset `stop-timeout`/`load-on-startup` [S36][S37]; idle-TTL unload **unverified** | `--models-preset` INI: global defaults + per-model overrides [S37] | No (built-in web UI only; **unverified** beyond that) | No |
| **vLLM** | One model per server process is the standard design (**primary doc not re-checked**); "Sleep Mode" is the multi-model workaround [S39] | `--served-model-name` exists (**not verified this session**) | Sleep L1/L2: 18–200× faster than reload, keeps process/CUDA graphs [S39] | Engine args only; named profiles **not found** | No | No |
| **AMD Lemonade** | Yes: `max_loaded_models` per type (LLM, embedding, reranking, transcription, image); **default 1 per type**; `-1` unlimited; LRU [S43]. NPU is exclusive across backends [S43] | Model name as registered; router/classifier policies exist [S43]; stable alias **unverified** | LRU eviction, pinning, opt-in dynamic VRAM management, idle/VRAM-pressure eviction [S43] | Per-model settings (ctx_size, llamacpp args, backend) [S43]; reusable named profiles **unverified** | MCP is a repo topic [S45]; built-in MCP host **unverified**; app marketplace [S45] | None found |
| **Open WebUI** | Front-end, not an engine; multi-model chats (parallel answers) [S49] | Workspace "Models" = preset wrapped around a base model; request fails if base inaccessible; optional fallback [S50] — alias only inside this UI | Delegated to backend | Yes: system prompt, tools, knowledge, parameter overrides per workspace model [S50] | MCP, MCPO, OpenAPI tool servers [S49] | Yes: per-user model-managed memory [S53]; RAG over 9 vector DBs [S49] |
| **LiteLLM proxy** | Gateway: fronts any number of backends; does not host models [S55] | **Yes — core feature** (model_name → provider/model, fallbacks, load balancing; "switching providers without code changes") [S58] | n/a (no model loading) | Per-deployment params (**not re-verified**) | MCP gateway (repo topic `mcp-gateway`, `mcp_servers.json`) [S55] | No |
| **text-generation-webui / "TextGen"** | **Unverified** (backends: llama.cpp, ik_llama.cpp, Transformers, ExLlamaV3, TensorRT-LLM) [S59] | Unverified | Unverified | Samplers, character cards, personas [S60] | Tool-calling API [S59]; MCP **unverified** | No |
| **KoboldCpp** | One process can hold LLM + image + embedding + TTS + Whisper (starter pack) [S88]; multiple LLMs **unverified** | n/a | Single launch config; `.kcppt` templates [S88] | `.kcppt` launch templates [S88] | "Integrated agent" [S61]; MCP **unverified** | Story memory/world info in Lite UI [S88] |
| **Msty Studio** | Manages Ollama, llama.cpp, MLX engines; "Split Chats" compare models [S64] | **Unverified** | Engine-level | Persona/Prompt/Skills Studios [S63] | "Toolbox" MCP client (limited on Free) [S63] | "User Memories" + Knowledge Stacks RAG [S63] |
| **GPT4All** | **Unverified** | n/a | n/a | n/a | No (MCP/agents "No" per competitor table [S66]) | LocalDocs RAG [S68] |
| **AnythingLLM** | Front-end; 40+ providers [S66] | **Unverified** | Delegated | Workspaces (per-workspace settings **unverified**) | Agents + MCP tools [S66]; MCP in Docker build [skywork review] | Built-in vector DB workspaces [S66] |
| **Newcomers** (Gufo, Halogen, GAIA) | Gufo: serves "a whole stable" of models [S70][aifinitee]; Halogen: one model family on one GPU [S72] | No | No | No | GAIA: agent SDK on Lemonade [S48] | No |

### A2. Questions 7–12 (built-ins, hardware, privacy, business)

| Product | Q7 Agent | Q8 Voice / image gen | Q9 AMD ROCm / Strix Halo / NPU | Q10 Telemetry / phone-home | Q11 License / company | Q12 Own tagline |
|---|---|---|---|---|---|---|
| **Ollama** | No own agent; `ollama launch` wires Claude Code/OpenCode/Codex to local or cloud models [S8] | Not found (**unverified**) | Linux ROCm v7; `gfx1151 Ryzen AI Max+ 395` in official list [S2]. Field reports: ROCm page-faults on 0.17.8-rc1 with Vulkan workaround [S10]; native gfx1151 works on 0.18 per one user [S11]. NPU: not found | Policy: no prompts/responses collected locally; cloud models processed transiently; account + limited usage metadata for cloud [S5]. Maintainer: "No telemetry" [S6] | MIT [S3]; **Ollama Inc.**, commercial cloud offering [S5][S4] | "Ollama is the most popular way to build with open models." [S4]; GitHub: "Get up and running with Kimi, GLM, MiniMax, DeepSeek, gpt-oss, Qwen, Gemma and other models." [S3] |
| **LM Studio** | **Bionic**: "LM Studio's agent for open models" (closed product) [S20] | Bionic: local real-time voice transcription [S20]; image gen not found | llama.cpp ROCm + Vulkan runtimes. On gfx1151/Linux the bundled ROCm runtime crashed ("Exit code: null"), Vulkan workaround [S21]; Windows unified-memory detection bug [S22]. NPU: not found | Vendor: processes data only for update checks, model search/download, email, cloud requests [S19]; "the app still does not snoop on you" [S18]. Third parties: update checks send version/OS/IP [S23]; one competitor-authored claim of default-on analytics [S78] — **conflicting** | **Closed source**, free for home *and* work since Jul 2025 [S18]; **Element Labs, Inc.**, enterprise plan [S85][S23] | Homepage now: "Go Bionic. Bionic is LM Studio's agent for open models. Natively local." [S20] |
| **LocalAI** | Yes: agents with MCP tools created from the UI [S24] | Yes: TTS, STT, image, video, vision, embeddings [S24] | Auto-detects NVIDIA/AMD/Intel/Vulkan [S24]; hipblas image verified for llama.cpp on Radeon 8060S/gfx1151 (ROCm 7.11); whisper/vllm/transformers on AMD **not verified** [S27]. NPU: not found | **Unverified** (not found) | MIT [S28]; "created by Ettore Di Giacinto and maintained by the LocalAI team" [S28]; company status **unverified** | "LocalAI is the open-source AI engine. Run any model - LLMs, vision, voice, image, video - on any hardware. No GPU required." [S28] |
| **Jan** | "Custom assistants" only [S29]; autonomous agent **not found** | Not found | llama.cpp; **AMD ROCm/HIP on Linux added in v0.8.2 (2026-06-01)** [S31]; NPU not found | Collects nothing until first-launch choice; if allowed, active-user/retention counts with random ID via PostHog (EU) [S23]; "opts you out by default" [S78] | Apache 2.0 per README [S29] (one review says Apache variant + attribution ask [S82]; another says AGPLv3 [S81] — **conflicting**, README wins); Menlo Research, no paid tier [S82] | "Jan is an open source alternative to ChatGPT that runs 100% offline on your computer." [S29] |
| **llama-swap** | No | Unified container bundles llama-server, ik-llama-server, stable-diffusion.cpp, whisper.cpp, audio.cpp behind the proxy [S33] | Backend-agnostic; image tags: CUDA 12/13, **Vulkan for AMD** [S33]; ROCm users run their own llama-server cmd [S83]. NPU: no | No telemetry found (**unverified**); exposes Prometheus `/metrics` [S33] | MIT [S33]; individual maintainer, no company found | "Reliable model swapping for any local OpenAI/Anthropic compatible server - llama.cpp, vllm, etc" [S33] |
| **llama-server router** | No | Not bundled in server (**unverified**) | Releases ship prebuilt ROCm and Vulkan builds incl. gfx1151 kernels (secondary source) [S86]. NPU: no | No telemetry found (**unverified**) | MIT (llama.cpp) [S62]; commercial owner **unverified** | n/a (**unverified**) |
| **vLLM** | No | No | gfx1151 **not in upstream supported list**; feature request closed "not planned"/stale [S41]; community patched toolbox [S42]; Lemonade lists experimental `vllm:rocm` on gfx1151 [S44] | **Collects anonymous usage stats by default**; opt out via `VLLM_NO_USAGE_STATS` / `DO_NOT_TRACK` / file [S40] | Apache-2.0 [S38]; community-led, company **unverified** | "A high-throughput and memory-efficient inference and serving engine for LLMs" [S38] |
| **AMD Lemonade** | Not bundled; AMD's separate **GAIA** agent framework (MIT) builds on Lemonade [S48] | **Yes**: chat, vision, image gen, speech gen, transcription, embeddings [S45][S46] | **Best AMD story in the field**: gfx1151 ROCm on Windows+Ubuntu [S45]; NPU via FastFlowLM (Linux) and Ryzen AI SW (Windows hybrid) [S44]; experimental vLLM-ROCm on gfx1151 [S44]. NPU backends are mutually exclusive [S43] | "Transparent, zero telemetry" [S46]; OTLP tracing exists, `enabled=false` default [S47] | Apache-2.0, AMD-sponsored, AMD engineers contribute [S45] | "Lemonade: Local AI for Text, Images, and Speech" [S46]; GitHub: "serving optimized LLMs right from their own GPUs and NPUs" [S45] |
| **Open WebUI** | "Models & Agents" = wrapped presets; plugins incl. Skills [S49]; autonomous built-in agent **unverified** | Image gen/edit via ComfyUI, A1111, OpenAI, Gemini [S49]; voice via optional STT/TTS engines [S81] | Backend-dependent (n/a) | No phone-home found in 0.5.x audit [S81]; OTEL opt-in, "no data is ever sent to us" [S54] | **"Open WebUI License" = BSD-3 + branding clause since v0.6.6; not OSI-approved**; copyright **Open WebUI Inc.**; enterprise licence [S51][S52] | "User-friendly AI Interface (Supports Ollama, OpenAI API, ...)" [S49] |
| **LiteLLM proxy** | No | No | Hardware-agnostic; fronts vLLM etc. [S55] | Off by default ("with neither set, nothing is recorded"); enabling is an enterprise feature [S56] | MIT core + paid Enterprise (SSO, RBAC, audit) by **BerriAI** [S58][S57] | "The fastest, litest AI Gateway… Call 100+ LLM APIs in OpenAI (or native) format" [S55] |
| **TextGen (oobabooga)** | No | Image gen (diffusers) + TTS/voice via extensions (secondary) [S87] | CUDA-centric loaders (ExLlamaV3, TensorRT-LLM) [S59]; AMD **unverified** | "Zero telemetry" per third party [S87] | AGPL-3.0, no company [S59]; renamed TextGen Apr 2026, Electron app [S59][S60] | n/a (**unverified**) |
| **KoboldCpp** | "An integrated agent" [S61] | **Yes**: image, video, Whisper STT, TTS, music [S61] | Vulkan is the recommended AMD path; ROCm build for Linux [S62] | **Unverified** | AGPL-3.0, solo dev "LostRuins" [S62] | "Run GGUF AI models locally with a KoboldAI UI. One File. Zero Install." [S61] |
| **Msty Studio** | Agent Mode [S63] | Media Studio [S63]; voice **unverified** | **Unverified** | "No telemetry" is policy only — closed source, unverifiable [S64] | **Closed source**; Free / Aurum $149/yr or $349 lifetime / Teams (5-seat min) [S63] | "Private AI workspace" [S63] |
| **GPT4All** | No | No [S66] | CPU, Metal, compatible GPUs [S68]; NPU no | Opt-in; datalake off by default [S68] | MIT; **Nomic AI** [S68]. Last release v3.10.0 Feb 2025, little activity since (competitor-authored source [S66]; corroborated "development has slowed" [S67]) | n/a (**unverified**) |
| **AnythingLLM** | Yes: agents, scheduled jobs [S66] | Voice in/out, on-device meeting transcription [S66]; image gen **unverified** | n/a (front-end) | **PostHog telemetry on by default**; opt out `DISABLE_TELEMETRY=true` or in-app Privacy [S69] | MIT core [S66]; **Mintplex Labs** (hosted cloud too) [S69] | "Stop renting your intelligence. Own it with AnythingLLM." [S69] |
| **Gufo** | — | LLM + ASR/TTS; image/vision "work in progress" [aifinitee] | **Strix-Halo-only** HIP engine; "Fewer models, done well" [S70][S71] | n/a | MIT, community (910★) [S70] | "The Open Source Strix Halo AI engine." [S71] |
| **Halogen** (Peonist) | — | Small NPU models alongside [S72] | **gfx1151-only**, one model family (Qwen3.8-Flash-Next) [S72][S73] | n/a | **Proprietary binary**, free EULA incl. commercial; Peonist, LLC [S72][S73] | "Local inference that behaves like a frontier API" [S72] |

### 2026 newcomer scan (Strix Halo / "multi-model homelab AI OS")
- **Gufo** (MIT, vertical Strix Halo engine) [S70], **Halogen** (closed single-model engine) [S72], community **toolbox** containers for llama.cpp/vLLM on gfx1151 [S42][S77], **AMD GAIA** agent SDK [S48]. All are *engines or SDKs*, not slot/profile/MCP/memory/agent platforms.
- **Lemonade** is the closest "AMD-first, multi-modality server" [S45]; **LocalAI** is the closest "everything in one binary" (agents+MCP+all modalities) [S24].
- I found **no other project bundling named slots + reusable profiles + MCP host + memory + agent + image/voice for Strix Halo**. Search was not exhaustive — phrase as "we didn't find", not "no one has".
- Name collisions to be aware of: AMD sells a "Ryzen AI Halo" box (video dated 2026-07-14, [S89]); "Halogen" is a competing engine [S72].
- Strix Halo caveat that affects *every* ROCm stack: stable only with recent firmware (avoid 20251125), kernel ≥ 6.18.4, ROCm 7.2+/nightlies [S77].

---

## B. Honest differentiators for hal0 (plain statements)

1. **Clients address a slot name; the model behind it can change.** Competitors tie the client-visible ID to a model: Ollama names are Modelfile-derived models [S7], LM Studio's identifier is set per load [S15], Lemonade/LocalAI use registered model names [S43][S25]. Closest peer: llama-swap `aliases` [S33] — but that is a hand-edited YAML over process commands, and Open WebUI's alias layer works only inside Open WebUI and fails without its base model [S50]. hal0's slot is a typed contract (`llm|embedding|reranking|transcription|tts|image`, device, autoload, eviction priority) [S75]. *Do say: "like llama-swap aliases, but typed, dashboard-managed, and covering embed/STT/TTS/image."*

2. **Several different models are resident at once as the normal case, with priority eviction that protects in-flight requests.** Defaults elsewhere lean to one-at-a-time: LM Studio Auto-Evict keeps one JIT model [S14]; llama-swap's default group swaps [S34]; Lemonade defaults to one model *per type* [S43]; Ollama parallelism defaults to 1 per model [S1]. hal0 ships ten curated slots (`agent`, `brain`, `coder`, `embed`, …) and "a serving slot cannot be evicted out from under a streaming request" [S75]. Measured: primary + embed concurrent 258 tok/s on the reference box [S76]. (Those other tools can be configured for concurrency; the difference is defaults and the slot model.)

3. **Profiles are bench-tuned runtime flag bundles, separate from models and from sampler presets.** LM Studio presets are system prompt + inference params [S17]; Ollama Modelfiles are per-model [S7]; llama.cpp preset INIs are per-model [S37]. hal0 profiles are device-agnostic tune templates that supply a floor of launch flags, backed by a public leaderboard of 26 measured models [S75].

4. **MCP, memory, and an agent ship inside the same install.** hal0 bundles `/mcp/admin` and `/mcp/memory` MCP servers and the Hermes/pi agents with dashboard approvals [S75]. Ollama, llama-swap, llama-server, vLLM have none of these [S8][S33][S36]; Lemonade's agent story is a separate AMD project (GAIA) [S48]; LM Studio's agent (Bionic) is closed-source and desktop [S20]. Nearest feature peer: LocalAI (agents + MCP + all modalities) [S24].

5. **The platform's own admin plane is an MCP server.** hal0 exposes slot/model/config/hardware/log admin as `hal0-admin` MCP tools, tier-gated, with destructive calls approval-gated [S75]. I did not find a competitor exposing its admin surface this way (not exhaustive).

6. **Strix Halo first, with an NPU slot and a UMA-aware probe.** ROCm default plus FastFlowLM NPU runner on XDNA 2 [S74]. Generic stacks have rough edges on gfx1151: LM Studio's ROCm runtime crash [S21], Ollama's ROCm page-faults on some releases [S10], vLLM upstream lacks gfx1151 [S41]. Caveat: Lemonade is also AMD-first and has gfx1151 + NPU support [S45][S44] — differentiate on *orchestration*, not "AMD support".

7. **Apache-2.0, no telemetry by default, cosign-signed releases** [S74][S76]. Contrast: vLLM and AnythingLLM collect by default (opt-out) [S40][S69]; LM Studio and Msty are closed source [S18][S64]; Open WebUI is no longer OSI-approved since v0.6.6 [S51]. "No telemetry" alone is *not* unique (Ollama, Lemonade, Jan opt-in [S6][S46][S23]); lead with "auditable + signed + zero by default".

8. **Declarative, rollback-able operations.** Stacks apply model/slot layouts atomically with drift detection and rollback; cosign-verified self-update with one-flag rollback [S75]. Competitors expose env vars (Ollama [S1]), YAML (llama-swap [S34]) or app settings.

---

## C. Where competitors are ahead / what hal0 lacks (keep copy honest)

1. **Platforms.** hal0 is Linux x86_64 + systemd, Python ≥ 3.12 [S74]. LM Studio, Jan, Ollama, Msty, GPT4All run on Windows/macOS/Linux [S85][S29][S64][S68]; Lemonade covers Windows, Linux, macOS, Docker [S45]. No Mac/Windows story.
2. **NVIDIA and non-AMD GPUs.** CUDA is an opt-in runner and every published perf number comes from one Strix Halo box [S74]. Ollama, LM Studio, LocalAI, vLLM and llama-swap have mature CUDA paths [S3][S85][S24][S38][S33]. Don't imply NVIDIA parity.
3. **Ecosystem and model catalogue.** Ollama claims 9M+ monthly installs and 1B+ model downloads [S4] (183.7k★ [S3]); Open WebUI 156k★ [S49]; vLLM 96k★ [S38]; LocalAI 50k★ [S28]; Jan 44.8k★ [S29]. hal0 curates ten slots plus Hugging Face search [S75]; its adoption numbers are **unverified** here.
4. **Raw engine speed on Strix Halo.** hal0 says it is "not another llama-server wrapper — it's the orchestration around one" [S76]; speed equals its runners. Dedicated engines claim more: Halogen 1,424 tps prefill @32K (author's tweet) [S89b], Gufo 1,125 t/s prefill @250k [aifinitee]. And vLLM-style batching for many concurrent users is outside hal0's single-box scope [S39].
5. **Multi-host, fine-tuning, quotas are roadmap, not shipped.** "Exploring (v1.x+)": multi-host federation, LoRA hot-swap, per-model rate limits/budgets, ChatOps adapters [S75]. Today LocalAI ships distributed/P2P [S24], TextGen has a LoRA training tab [S59], LiteLLM has virtual keys/budgets/rate limits [S58].
6. **Team/enterprise controls.** SSO/RBAC/audit exist at LiteLLM Enterprise [S57], Msty Teams [S63], LM Studio enterprise [S23], Open WebUI group access control [S49]. hal0: **unverified** — don't claim.
7. **Polished chat UI / RAG.** Open WebUI (9 vector DBs, web search providers, arena) and AnythingLLM are far richer chat/RAG front-ends [S49][S66]; hal0 pairs with Open WebUI rather than replacing it [S75].
8. **Windows NPU/hybrid.** Ryzen AI SW hybrid NPU+GPU inference is Windows-only inside Lemonade [S44]; hal0's NPU lane is Linux FastFlowLM, opt-in [S74].

---

## D. Keywords: what the field says, what to target, what to avoid

*(No search-volume data — Semrush returned `no_api_units`. Ranking below is by how consistently the field uses the phrase and how well it fits hal0's verified facts.)*

**How the field words itself (evidence):**
- "run LLMs/AI models locally", "local AI", "local LLM" — Ollama ("complete privacy locally or in the cloud" [S4]), Lemonade ("Local AI for Text, Images, and Speech" [S46]), LM Studio ("Natively local" [S20]).
- "open source alternative to ChatGPT", "100% offline" — Jan [S29].
- "own it / stop renting your intelligence" — AnythingLLM [S69].
- "drop-in replacement for OpenAI", "no GPU required", "open-source AI engine" — LocalAI [S28][S24].
- "model swapping" — llama-swap [S33]; "router mode" — llama.cpp, Jan [S36][S30].
- "AI Gateway", "LLM gateway", "MCP gateway" — LiteLLM [S55].
- "Strix Halo AI engine", "vertical engine", "fastest" — Gufo, Halogen [S71][S72].
- "private AI workspace" — Msty [S63]; "self-hosted" + "user-friendly AI interface" — Open WebUI [S49].
- Strix Halo repo topics people search/tag with: `amd`, `gfx1151`, `llm`, `ryzen-ai`, `strix-halo` [S70]; also `rocm`, `radeon`, `llm-serving`, `local-llm`, `speculative-decoding` [S72].

**Target (fits verified hal0 facts; lower competition or hal0-specific):**
1. `Strix Halo LLM` / `Strix Halo inference` / `Strix Halo AI server`
2. `Ryzen AI Max+ 395 llama.cpp` · `Ryzen AI Max+ 395 Ollama alternative` · `gfx1151 ROCm` · `Strix Halo ROCm`
3. `AI homelab` / `homelab AI inference` / `self-hosted AI inference platform`
4. `OpenAI-compatible API` + `local` (every competitor uses it; pair with "multiple models at once")
5. `run multiple LLMs at the same time` / `multi-model` / `concurrent models` / `local LLM router`
6. `model hot-swap` + `llama-swap alternative` · `Ollama alternative` · `Lemonade alternative` (comparison pages; use only facts in section A)
7. `MCP server` + `local LLM` / `MCP host` / `local AI agent with memory`
8. `128GB unified memory LLM` · `AMD NPU Linux FastFlowLM` · `ComfyUI Strix Halo`
9. `private AI` + `self-hosted` (supporting, not headline — crowded)

**Avoid or use carefully:**
- `ChatGPT alternative` / `offline ChatGPT` — owned by Jan and others [S29]; hal0 isn't a chat app.
- `fastest`, `most popular`, `drop-in replacement for OpenAI`, `no GPU required`, `100% offline` — other products' claims [S28][S4][S55][S72][S29]; unsupported for hal0 (and hal0's own speed ≠ engine speed).
- `zero telemetry` as a headline — Lemonade already says it [S46]; use "no telemetry by default, Apache-2.0, signed releases" [S74].
- `AI OS` / `enterprise` / `NVIDIA` / `Windows` / `Mac` terms — contradicts section C.
- Bare `Halo` / `halo` queries — collide with AMD's "Ryzen AI Halo" box [S89], the Halogen engine [S72], and the Halo game franchise; keep "hal0" + "Strix Halo" together.
- `NPU` as a headline claim — it's an opt-in Linux FastFlowLM slot for supported models only [S74].

---

## Unverified / conflicting items (do not put on the site without checking)
- Ollama: built-in MCP host, memory, voice/image, NPU; alias mechanism beyond Modelfile.
- LocalAI: telemetry, alias layer, per-model config, built-in vector memory.
- Jan: how many models stay resident under router mode; idle timers; MCP catalog.
- vLLM: one-model-per-process in primary docs; `--served-model-name`.
- llama-server: idle-TTL unload; alias beyond preset names; telemetry.
- Lemonade: stable alias, built-in MCP host, named profiles.
- TextGen, KoboldCpp, Msty, GPT4All, AnythingLLM: multi-model/alias details, AMD paths, KoboldCpp telemetry.
- LM Studio telemetry: vendor says none beyond update checks [S19]; one competitor-authored source claims default-on analytics [S78]. Jan licence: Apache 2.0 (README) vs variant/AGPL (reviews).
- hal0 slot-name-as-model behaviour comes from the team brief; the README excerpts I read confirm slots/profiles/MCP/agents/telemetry but I did not re-verify the "clients send slot name as `model`" mechanic from a hal0 page.
- hal0 adoption numbers (stars/installs): not retrieved.

---

## Sources
- [S1] https://docs.ollama.com/faq
- [S2] https://docs.ollama.com/gpu
- [S3] https://github.com/ollama/ollama
- [S4] https://ollama.com
- [S5] https://ollama.com/privacy
- [S6] https://github.com/ollama/ollama/issues/11442
- [S7] https://docs.ollama.com/modelfile
- [S8] https://ollama.com/blog/launch
- [S9] https://docs.ollama.com/capabilities/web-search
- [S10] https://github.com/ollama/ollama/issues/13589
- [S11] https://github.com/ollama/ollama/issues/14855
- [S12] https://lmstudio.ai/blog/0.4.0
- [S13] https://lmstudio.ai/docs/developer/core/headless
- [S14] https://lmstudio.ai/docs/developer/core/ttl-and-auto-evict
- [S15] https://lmstudio.ai/docs/cli/load
- [S16] https://lmstudio.ai/docs/app/mcp
- [S17] https://lmstudio.ai/docs/app/presets
- [S18] https://lmstudio.ai/blog/free-for-work
- [S19] https://lmstudio.ai/app-privacy
- [S20] https://lmstudio.ai
- [S21] https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1502
- [S22] https://github.com/lmstudio-ai/lms/issues/589
- [S23] https://vdf.ai/blog/jan-vs-lm-studio
- [S24] https://localai.io/docs/overview
- [S25] https://localai.io/docs/advanced/vram-management
- [S26] https://localai.io/docs/features/mcp
- [S27] https://localai.io/docs/features/gpu-acceleration
- [S28] https://github.com/mudler/LocalAI
- [S29] https://github.com/janhq/jan
- [S30] https://www.jan.ai/changelog/2026-05-22-jan-v0.8.0
- [S31] https://github.com/janhq/jan/commit/0cd79b94b1098734f0e614879ffbce0672f41c6d
- [S32] https://docs.jan.ai/desktop/api-server
- [S33] https://github.com/mostlygeek/llama-swap
- [S34] https://github.com/mostlygeek/llama-swap/blob/main/docs/config.example.yaml
- [S35] https://github.com/mostlygeek/llama-swap/issues/643
- [S36] https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md
- [S37] https://soypetetech.substack.com/p/from-one-model-to-many-hosting-multiple
- [S38] https://github.com/vllm-project/vllm
- [S39] https://vllm.ai/blog/2025-10-26-sleep-mode
- [S40] https://docs.vllm.ai/en/stable/usage/usage_stats
- [S41] https://github.com/vllm-project/vllm/issues/16621
- [S42] https://github.com/kyuz0/amd-strix-halo-vllm-toolboxes
- [S43] https://lemonade-server.ai/docs/guide/configuration/multi-model
- [S44] https://lemonade-server.ai/docs/guide/faq
- [S45] https://github.com/lemonade-sdk/lemonade
- [S46] https://lemonade-server.ai
- [S47] https://lemonade-server.ai/docs/guide/telemetry
- [S48] https://github.com/amd/gaia
- [S49] https://github.com/open-webui/open-webui
- [S50] https://docs.openwebui.com/features/workspace/models
- [S51] https://docs.openwebui.com/license
- [S52] https://wz-it.com/en/blog/open-webui-license-branding-business
- [S53] https://docs.openwebui.com/features/chat-conversations/memory
- [S54] https://github.com/open-webui/open-webui/discussions/12344
- [S55] https://github.com/BerriAI/litellm
- [S56] https://docs.litellm.ai/docs/proxy/telemetry
- [S57] https://docs.litellm.ai/docs/enterprise
- [S58] https://www.respan.ai/market-map/litellm
- [S59] https://www.promptquorum.com/local-llms/text-generation-webui-review
- [S60] https://localaimaster.com/blog/text-generation-webui-guide
- [S61] https://github.com/lostruins/koboldcpp
- [S62] https://www.promptquorum.com/power-local-llm/koboldcpp-review
- [S63] https://msty.ai/pricing
- [S64] https://modelpiper.com/blog/local-ai-platforms-compared-mac
- [S65] https://www.agentsai.fyi/agents/msty
- [S66] https://anythingllm.com/alternatives/gpt4all (competitor-authored)
- [S67] https://www.agentsai.fyi/agents/gpt4all
- [S68] https://www.therundown.ai/tools/gpt4all
- [S69] https://github.com/mintplex-labs/anything-llm
- [S70] https://github.com/gufo-org/gufo
- [S71] https://gufo.blog
- [S72] https://github.com/peonist-ai/halogen-flash-server
- [S73] https://ai-tldr.dev/tools/halogen-flash-server
- [S74] https://hal0.dev
- [S75] https://github.com/Hal0ai/hal0
- [S76] https://huggingface.co/Hal0ai
- [S77] https://www.youtube.com/watch?v=Hdg7zL3pcIs
- [S78] https://innerzero.com/blog/best-private-ai-local-models-no-tracking-no-account (competitor-authored)
- [S79] https://www.promptquorum.com/power-local-llm/lemonade-review
- [S81] https://www.local-llm.net/blog/local-ai-privacy-audit
- [S82] https://www.promptquorum.com/power-local-llm/jan-review
- [S83] https://github.com/mostlygeek/llama-swap/discussions/209
- [S84] https://community.frame.work/t/gufo-the-all-in-one-strix-halo-inference-engine/85083
- [S85] https://www.promptquorum.com/power-local-llm/lm-studio-review
- [S86] https://openclawdc.com/blog/amd-rocm-setup-local-llm
- [S87] https://www.getopenclaw.ai/tools/text-generation-webui
- [S88] https://github.com/LostRuins/koboldcpp/wiki
- [S89] https://www.youtube.com/watch?v=sMacAPpgXhQ (AMD "Ryzen AI Halo", 2026-07-14)
- [S89b] https://x.com/TeksEdge/status/2099739998048198745 (Halogen prefill figure, third-party tweet)
- [aifinitee] https://aifinitee.com/gufo-open-source-engine-strix-halo
- [skywork] https://skywork.ai/blog/evaluation/anythingllm-review-2025-local-ai-rag-agents-setup
- [docs: troubleshooting] https://docs.jan.ai/desktop/troubleshooting
