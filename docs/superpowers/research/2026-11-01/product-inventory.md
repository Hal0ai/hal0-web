# hal0 product inventory for the hal0.dev rewrite

Read-only research. All paths are relative to the product checkout unless stated.

## 0. Source, version, and how far to trust this

**Checkout used:** `/home/mint/projects/hal0` at `f44fdb7a` (2026-11-01 00:18 -0400, "fix(logging): never print traceback frame locals to the journal (#3185)"). This is the newer of the two.
`/mnt/mintdev/repos/hal0` is at `b4407ed1` (2026-10-30), and its listing has no `ui/` directory.

**Runner images:** `/mnt/mintdev/repos/hal0-runner-images` at `6996d850` (2026-10-11).

**hal0-mono:** `/mnt/mintdev/repos/hal0-mono` is not a git repo. It is a workspace folder of independent repos and worktrees and adds no product facts.

### Stable versus nightly: the most important caveat for the site

- Latest stable tag: **v1.7.1** (commit dated 2026-10-27). `pyproject.toml:13` still says 1.7.1.
- HEAD is `v1.7.1-nightly.20261031112620-8-gf44fdb7a`, 30 non-merge commits past v1.7.1.
- `CHANGELOG.md:31-69` holds an `[Unreleased]` section. It refers to "1.8.0" in passing, so that is the likely next version.

Checked with `git cat-file -e v1.7.1:<path>`. These are **not in stable v1.7.1**:

| Feature | Missing from v1.7.1 |
|---|---|
| Agent bridge, `hal0-agents` MCP server, `hal0 bridge` | `src/hal0/bridge/`, `src/hal0/mcp/agents.py`, ADR-0043 |
| Overview "briefing" page | `ui/src/dash/overview/OverviewView.jsx`, ADR-0044 |
| Per-slot `[tune]` overrides, Tune block | `ui/src/dash/slot-tune-block.jsx`, ADR-0045 |

Also unreleased per the changelog: Hindsight engine 1.1.0, and "shared memory by default" for Hermes profiles (`CHANGELOG.md:31-69`, shared memory at `:57`).

The dock and slot rail **are** in v1.7.1. The README at HEAD already says "three MCP servers" (`README.md:540`), which is ahead of stable.

**Site rule to consider:** anything marked NIGHTLY below is not on a default `curl | sudo bash` install until the next tag. Either wait for the tag or label it.

### Evidence levels

- **[code]** I read the implementation.
- **[docs]** taken from the repo's docs or README, not independently traced.
- Nothing was run against a live box and no tests were run. Screenshots should confirm UI claims.
- Third-party components (Open WebUI, Hermes, Hindsight, ComfyUI, FLM) were not audited internally.

**One disclosure:** I ran one Python import of `hal0.mcp.admin` from the repo venv to count tools. It executed app boot code, including a loopback probe to Hindsight. `git status` is clean, and `find` over `/etc/hal0`, `/var/lib/hal0` and `~/.hal0` shows nothing changed in the last 40 minutes. Counts were then redone with `ast`.

### Vocabulary traps

- **"Profile" means three things.** An inference **profile** (tune), a **Hermes profile** (an agent identity), and a **persona** (the hal0-brain or Hermes prompt/policy file). The owner's "custom PROFILES" means inference profiles. Do not let the "new Hermes profile gets wired in two minutes" fact bleed into inference-profile copy.
- **"Unified memory" means two things.** The UMA hardware pool, and the shared agent memory (`[memory].unified_bank`). Keep them apart on the page.
- **"Agent" is both a slot name and a kind of thing.** Slot names are `agent`, `coder`, and so on; agents are Hermes and pi.
- **"Brain" is both a slot and a persona.** `docs/concepts/brain.mdx:17-29` draws the line.

---

## 1. Slots

**What exists**
- A slot is one model in one podman container under `hal0-slot@<name>.service`, on a loopback port (`docs/concepts/slots.mdx:15-21,41-51`) [docs].
- Slot `type`: `llm | embedding | reranking | transcription | tts | image`. Slot `device`: `gpu-rocm | gpu-vulkan | gpu-cuda | cpu | npu` (`README.md:466-468`, `docs/concepts/slots.mdx:395-397`). **There is no slot kind called agent, brain or memory.** Those are seeded *names*.
- Ten seeded slots: `agent, brain, coder, embed, flm, img, qwen3tts, rerank, tts, utility` (`README.md:469-471`). Custom slots: `hal0 slot create NAME --type TYPE --model MODEL` (`README.md:474`).
- Lifecycle states: `offline, pulling, starting, warming, ready, serving, idle, unloading, error`, plus a crash-loop breaker (`docs/concepts/slots.mdx:198-208,234-244`) [docs].

**Slot-as-model addressing** [code]
- `GET /v1/models` emits each bound LLM slot as one entry whose `id` is the **slot name** and whose `name` is `"<slot> · <model display name>"`. Chat model ids are suppressed so "a chat slot is represented exactly once, by its alias", and cold slots are advertised too (`src/hal0/api/routes/v1.py:1010-1032,1098`; builder `src/hal0/api/__init__.py:408`).
- `model: "agent"` is rewritten to the bound model id by `hal0_chat_slot_alias_map` (`src/hal0/api/__init__.py:500-525`; `src/hal0/api/routes/v1.py:361-406`).
- `hal0/<slot>` virtual names also resolve, including custom ones like `hal0/research` (`docs/concepts/slots.mdx:404-412`).
- Caveat: `docs/reference/api/slot-as-model.mdx:11-15` describes direct slot-name lookup as a last-resort step, but the chat route's alias rewrite happens first. For chat, slot naming is first-class. For non-chat paths, the request path picks the slot (see section 4).

**Hot swap** [code]
- `POST /api/slots/{name}/swap` with `{"model_id": ...}`, CLI `hal0 slot swap`, MCP `model_swap`. It is an *autonomous* write for agents (`src/hal0/api/routes/slots.py:1447-1457`; `src/hal0/mcp/admin.py:547`).
- **It is unload-then-load with a container restart** (`src/hal0/slots/manager.py:2222-2223`), not zero-downtime. During the load, requests get a structured `slot.loading` 503 with `Retry-After` (`docs/concepts/slots.mdx:212-215`).
- A fit guard runs before the swap, and a bad id 404s with the slot untouched (`src/hal0/api/routes/slots.py:1450-1457,1489-1490`).

**Dashboard pickers** [code]
- The slot card has a real model dropdown that calls swap (`ui/src/dash/inference-pane.jsx:664-720`, `useSlotSwap` at `:35,:1158`).
- It also has a profile dropdown. Picking a profile goes through a consequence confirm rather than applying immediately (`ui/src/dash/inference-pane.jsx:273-300`).
- The edit drawer is at `#slots/<name>`. It has Auto-Load, Pinned, and a **Resolved command** panel that labels each flag base/model/profile/slot (`docs/guides/manage-slots-dashboard.mdx:33-50`; `docs/concepts/slots.mdx:148-151`).

**Per-slot memory accounting** [docs]
- `GET /api/stats/hardware` has a `memory` block with `gpu.this_box: [{slot, gb, state}]`, `other_guests_gb`, `free_gb`, RAM, and `render_free_gb`, polled every 2.5 s (`docs/reference/api/memory-budget.mdx:10-40`; ADR-0039).
- CLI: `hal0 slot capacity`, `hal0 slot metrics`. Slot rail: state dot, device chip, tok/s, model, loaded memory (`README.md:246-249`).

**Parallelism, with its limits**
- Multiple slots run concurrently, each with its own container and flags. The README quotes chat + embed concurrent at ~258 tok/s aggregate (`README.md:446`) [docs].
- **Image mode unloads every GPU LLM slot** while a render runs and for ~10 s after. A chat arriving mid-render waits up to 120 s. NPU and CPU slots are unaffected (`docs/guides/generate-images.mdx:21-37`; `docs/concepts/slots.mdx:292-312`).
- One NPU LLM anchor only (`docs/concepts/slots.mdx:316-320`).
- Eviction by `priority` under memory pressure (`README.md:1151-1153`).
- Everything shares one memory pool, so what actually fits is bounded by the box.

**Status:** shipped. Sparse per-slot `[tune]` is NIGHTLY.

**Owner claims**
| Claim | Verdict |
|---|---|
| Multiple models in defined slots, running in parallel | **TRUE**, with the image-mode exception above |
| Clients reference the slot, not the model | **TRUE for chat** on `/v1`, Hermes, pi and Hindsight. **Partial for Open WebUI's non-chat wiring** (section 7) |
| Swap "instantly" | **PARTIALLY TRUE.** The rewire is instant and the client config does not change. The model still has to unload and load, and that takes real time. Say "without reconfiguring clients", not "instantly" |
| "Changing model = dropdown" | **TRUE** |
| Agent / memory / research / coding slots | **PARTIAL.** `agent` and `coder` are seeded. There is **no `memory` slot**: the engine uses `[memory.graph].extraction_slot`, default `utility`, through virtual id `hal0/memory`. There is **no `research` slot**; you can create one |

---

## 2. Profiles

**What exists** [docs, config]
- A profile is a reusable, device-agnostic tune: `flags`, `ctx_size`, `enable_thinking`, `reasoning_effort`, `reasoning_budget`, `vision`, `speculation` (`auto|off|ngram`), optional `runner`, `intent`, `cloned_from`. It has no placement and no image (`docs/concepts/capabilities-and-profiles.mdx:70-90`; `docs/concepts/slots.mdx:71-75`).
- Ownership rule, the "model = facts / profile = tune / slot = placement" split, is enforced at every write path with named errors (`slot.tuning_key_denied`) (`docs/concepts/slots.mdx:95-107`; ADR-0029).
- Workload-keyed seeds: `chat, agent, utility, coding, embedding, reranking, cpu-chat, flm, kokoro, qwen3-tts, moonshine, comfyui, brain` (`docs/concepts/capabilities-and-profiles.mdx:122-134`). Seeds are immutable; clone them to customize.
- Slot TOMLs confirm `agent`→`agent`, `coder`→`coding`, `brain`→`brain`, `utility`→`utility` (`installer/etc-hal0/slots/*.toml`).
- CLI verbs: `hal0 profile list|show|create|edit|migrate` (`src/hal0/cli/profile_commands.py`). There is no CLI delete or import. MCP: `profile_list/status/create/update/delete/import/export/generate`.
- Import/export: checksummed `.hal0profile.json` through dashboard **Profiles → Import** and `POST /api/profiles/import` (`docs/reference/profile-addons.mdx:153-175`).
- Dashboard: `#models/profiles`.

**Community and addons**
- First-party addons: `chat-long-context, dense, moe, thinking` in `community/addons/` with `index.json` (`docs/reference/profile-addons.mdx:36-41`).
- Install is manual: paste or upload the envelope. I found no one-click addon browser in the UI.
- **`Hal0ai/hal0-profiles` is not wired into the product.** A grep across `src`, `ui/src`, `docs`, `installer`, `scripts` and the README finds no reference. Its README (seen in the hal0-mono copy, last commit 2026-08-09) says "the future `hal0 profile install`".
- Its TOML format (`[runner] image`, `lane`, `[args] raw`) does not match the product's JSON envelope, and it still references the old `amd-strix-halo-toolboxes` image. It has 8 profiles. **Do not claim the community repo installs into hal0.**

**Stale README warning:** `README.md:632,644,650-654` names `dense`, `moe`, `thinking`, `chat-long-context` as seeds and says `agent` ships on `dense`. The slot TOMLs and addon docs contradict this. Use the docs list.

**Owner claim, "custom profiles":** **TRUE.**

---

## 3. Stacks

**What exists** [docs]
- A named, portable bundle of slot rows with embedded copies of the profiles and models they reference, stored in `/etc/hal0/stacks.toml` (`docs/concepts/stacks.mdx:10-18,38-62`).
- Apply is plan-and-commit, then converge. **Every dispatchable slot the stack does not mention gets unloaded** (`docs/concepts/stacks.mdx:80-100`).
- Drift states including `clean`, `degraded`, `modified` (`docs/concepts/stacks.mdx:126-131`).
- Export/import through a checksummed `.hal0stack.json` with a dry run that classifies models as present/pullable/unresolvable; a live config can be snapshotted (`docs/concepts/stacks.mdx:133-140`; `src/hal0/stacks/portable.py:130`).
- Seed stacks: `saber`, `forge`, `pi` (immutable) (`docs/concepts/stacks.mdx:64-75`). Note the seed stack called `pi` is unrelated to the pi agent.
- **No `hal0 stack` CLI**: dashboard, `/api/stacks` and MCP `stack_*` only (`docs/concepts/stacks.mdx:33-35`).
- The repo's own docs call it "hal0's youngest major subsystem" (`docs/concepts/stacks.mdx:22`).
- Dashboard: `#slots/stacks`.

**Status:** shipped, self-described as still hardening. Avoid implying it is the most mature feature.

---

## 4. Routing and delegation

**Be precise: there is no content-aware router.** Nothing in hal0 reads a prompt and picks a slot.

**What the dispatcher does** [code]: `src/hal0/dispatcher/router.py:1-31`. It resolves the request's `model` field in order: pinned upstream, registry binding, passthrough, cold-cache prefetch, then capability/path routing. "Capability" here means path and name heuristics (`/embeddings`→`embed`, `/rerank`→`rerank`, `/audio/speech`→`tts`, `/images/*`→`img`, name hints, `SLOT_ALIASES`) (`docs/reference/api/slot-as-model.mdx:36-65`). A request with no `model` on a chat path goes to `agent`. It reads no message content.

**What can delegate between models**
1. **Medium routing by endpoint** [code, docs]. Different `/v1` paths land on the right specialized slot. This is the honest version of "mediums".
2. **OmniRouter** [code]. 8 tools (`generate_image, edit_image, text_to_speech, transcribe_audio, analyze_image, embed_text, rerank_documents, route_to_chat`; `src/hal0/omni_router/tool_definitions.json`).
   - **Strictly opt-in per request:** only when the body carries `"omni": true` (`src/hal0/api/routes/v1.py:1343-1382`; `src/hal0/api/__init__.py:2348-2352`).
   - I found nothing in `ui/src`, `src/hal0` or `installer` that sends it by default.
   - The *calling LLM* chooses the tool, and only when its model has `tool-calling` (`src/hal0/omni_router/filter.py:1-20`).
   - `route_to_chat` is one-shot, one level deep, no self-delegation, no NPU↔NPU (`src/hal0/omni_router/route_to_chat.py:1-23,42`).
3. **hal0-brain steward tool reroute** [docs]. Chat stays on the small model; tool rounds reroute to `[brain_chat] tool_model` (default `hal0/agent`) when the chat model emits a tool call, a garbled call, or an ungrounded answer about box state (`docs/concepts/brain.mdx:109-123`). This is real but narrow, and on a fresh box the `agent` slot has no model, so that first reroute reports no target (`docs/concepts/brain.mdx:125-131`).
4. **Hermes `delegate_task`** [docs]. Children run on one configured slot, `[hermes] delegation_slot`, default `agent`. There is no CLI or dashboard writer for it; you edit a root-owned file (`docs/guides/run-agents.mdx:240-258`).
5. **Virtual `hal0/memory`** [code]. Resolves to the configured extraction slot or upstream on each call, without an engine restart (`src/hal0/api/routes/v1.py:343-350`).

**Owner claim, "a router-type system delegates tasks/inputs/mediums to the appropriate specialized smaller model":** **PARTIALLY TRUE, and the wording as written would mislead.**
- Backed: endpoint-based medium routing; an opt-in model-driven tool loop; a steward that hands tool work to a bigger slot.
- Not backed: automatic task classification or intelligent routing of plain chat traffic.
- Suggested copy: "Each medium has its own slot, and one API routes to it", plus "tool-calling models can hand off to other slots".

---

## 5. Memory

**What exists**
- Engine: **Hindsight** (`hindsight-api.service`, loopback :9177), behind an engine-neutral provider layer. On a fresh install `[memory].enabled` defaults true (`docs/concepts/memory.mdx:71-79,93-114`).
- If the daemon is unreachable, hal0 falls back to a **volatile in-memory** provider: writes are lost on restart (`docs/concepts/memory.mdx:74-79`). `mem0` is accepted by config but not implemented.
- Two surfaces over one provider: `/api/memory/*` REST and `/mcp/memory` MCP (`docs/concepts/memory.mdx:24-28`).
- MCP tools, 26 on `hal0-memory`: `memory_add/search/recall/list/delete`, `memory_reflect`, `memory_curate`, `memory_history`, `memory_mental_model_*` (6), `memory_directive_*` (5), `memory_operation_*` (4), `memory_tags_list`, `memory_bank_stats`, `memory_bank_consolidate` (`docs/concepts/memory.mdx:30-58`).
- Directives are standing instructions injected into an agent's prompt each turn. Mental models are standing questions with kept-refreshed answers (`docs/concepts/memory.mdx:186-215`).
- Namespaces: `shared` and `private:<client_id>` (`docs/concepts/memory.mdx:124-157`). Coding memory per repo goes in `coding-agent::<repo>` banks.
- Dashboard: `#memory` overview, `#memory/bank` workspace (fact list, curate, force-directed graph, directives, mental models) (`docs/guides/memory-workspace.mdx`).
- Graph extraction: `[memory.graph]` `enabled` defaults false, but it is a reporting and routing gate; Hindsight extracts either way (`docs/concepts/memory.mdx:243-251`).

**Who can reach it**
- Hermes (every profile) and pi get `hal0-memory` written into their config automatically (`src/hal0/agents/pi_coder/driver.py:80-83`; `docs/guides/open-webui.mdx:105-125`).
- Any MCP client can connect at `http://<box>:8080/mcp/memory/mcp`. With auth off this needs no key; with auth on it needs the client or admin key. NIGHTLY adds per-agent bridge keys with write attribution (`docs/guides/connect-mcp.mdx:263-267,301-316`).
- hal0-brain is limited to `memory_add/search/list`, shared dataset (`docs/concepts/brain.mdx:205-231`).

**Agent-to-agent**
- **Shared notes:** agents writing to the `shared` bank can read each other's facts, tagged `agent:<id>`. This is real asynchronous knowledge sharing and it is the strongest honest claim.
- **Delegation:** NIGHTLY `hal0-agents` lets a *remote* agent (Claude Code, Codex, CI) hand a task to Hermes, wait, answer and steer, and teach it memory and skills. 16 tools (`CHANGELOG.md:48`; `docs/guides/delegate-to-agents.mdx:1-30`).
  - It is one-directional, remote to Hermes. It is **not** wired into Hermes or pi on the box (`src/hal0/agents/pi_coder/driver.py:78-79`).
  - Hermes's A2A plugin was explicitly rejected as the first step (`docs/adr/0043-agent-bridge-and-bridge-keys.md:402,412-416`).
- There is **no general agent-to-agent messaging bus** and no direct Hermes↔pi channel.

**Caveats worth respecting** (`CHANGELOG.md:57,63`, unreleased section)
- `memory_reflect` "is not yet filtered for visibility: it runs over the whole unified bank".
- In the unified bank, "private" is a tag, not a separate store.
- A non-bridge caller's `X-hal0-Agent` identity is not authenticated. The changelog states that this "is not a boundary between non-bridge callers".

**Owner claim, "unified memory with agent-to-agent communication via custom MCP servers":** **PARTIALLY TRUE.** Unified shared memory over MCP is true. "Agent-to-agent communication" is true only as shared notes (stable) and remote-to-Hermes delegation (nightly). Suggested copy: "One memory your agents share" rather than "agents talk to each other".

---

## 6. MCP

**hal0 as MCP server** [code + docs]
- Three streamable-HTTP mounts: `/mcp/admin` (`hal0-admin`), `/mcp/memory` (`hal0-memory`), `/mcp/agents` (`hal0-agents`, NIGHTLY). The URL ends in `/mcp` (`docs/guides/connect-mcp.mdx:190-203,301-307`).
- `hal0-admin` tool classification at HEAD: **189 tools: 108 autonomous read, 24 autonomous write, 57 gated** (`src/hal0/mcp/admin.py:374,539,595`, counted with `ast`). hal0.dev previously said 182. Avoid hard-coding the number, or generate it.
- Gated calls return `pending_approval` and wait in the dashboard inbox or `hal0 agent approvals` (`docs/guides/connect-mcp.mdx:456-496`).

**hal0 as MCP host: the big gap** [code]
- `hal0 mcp install` accepts OCI, npm, uvx, git, or an HTTP manifest URL. Each server persists as `/etc/hal0/mcp-servers/<id>.toml` with tool policy `hal0 mcp allow|gate|block` (`docs/guides/connect-mcp.mdx:17-30,127-137`).
- **No installed server can reach any agent today.** `AGENT_CALL_PATH_ENFORCED = False` (`src/hal0/mcp/installed.py:76`), so `hal0 mcp expose --hermes/--brain` returns `409 mcp.exposure_policy_unenforced` (`src/hal0/mcp/hermes_join.py:220-233`; `docs/adr/0015-mcp-supervisor-and-exposure.md:8-20`; `docs/guides/connect-mcp.mdx:144-156`). The block is deliberate and principled: tool policy would not be enforced on the agent's call path. It stays until #2303.
- `stdio` servers have no supervisor: start/stop/restart return `501 mcp.supervisor_unavailable`, and exposing one returns `409 mcp.exposure_needs_supervisor` (`docs/guides/connect-mcp.mdx:74-75,173-180`).
- `openwebui` and `opencode` exposure flags are reserved and return `501 mcp.exposure_unsupported` (`docs/guides/connect-mcp.mdx:173-175`; `src/hal0/api/routes/mcp.py:93`).
- MCP catalog: a static curated list of 8: `filesystem, memory, sequential-thinking, playwright, everything, exa-search, kubernetes, todoist` (`src/hal0/api/routes/mcp.py:130-225`). `hal0 mcp catalog list`. Installable, but subject to the block above.

**What `mcp_client_list` is** [code]
- **An audit-derived list of clients recently seen calling**, not a list of configured clients. `role` is a string heuristic on the client id (`src/hal0/api/routes/mcp.py:655-664`; `src/hal0/mcp/admin.py:3463`).
- It does not show, and does not imply, auto-configuration of anything.

**Who gets wired, and how**
| Client | How | Auto? |
|---|---|---|
| Hermes default + every named profile | hal0 writes `hal0-admin` + `hal0-memory` into `config.yaml` with identity `hermes__<profile>`; a sweep every 120 s (`src/hal0/api/__init__.py:1375,1594-1608`; `src/hal0/agents/hermes_upstreams.py:195-219`) | Yes |
| pi | Driver upserts both servers into `~/.pi/agent/mcp.json` at install/upgrade (`src/hal0/agents/pi_coder/driver.py:12-22,80-83`) | At install, not continuously |
| hal0-brain | In-process call to the admin core (`docs/concepts/brain.mdx:239-245`) | Built in |
| Open WebUI | **None.** No tool-server wiring in `src/hal0/openwebui/env_writer.py`. It reaches hal0's tools only if you pick a Hermes profile as the model | No |
| Claude Code, Codex, Cursor, others | **hal0 never writes their config.** NIGHTLY `hal0 bridge add` prints `claude mcp add` lines to paste; stable has `/etc/hal0/MCP-CLIENTS.md` examples (`docs/guides/connect-mcp.mdx:215-245,433-435`) | No |

So auto-wiring is both of the things the brief asked about: hal0 **writes configs** for its own bundled agents, and it **exposes endpoints** for everyone else to point at.

**Owner claim, "add a model/slot/profile and all the agents and apps pick up the model and attached MCP servers":** see section 7. "Attached MCP servers" is **NOT BACKED.** There is no concept of attaching an MCP server to a slot, model or profile, and third-party servers cannot currently reach agents at all.

---

## 7. Client integrations

**Open WebUI** [code]
- hal0 installs and runs it: container `hal0-openwebui.service`, LAN `:3001`, digest-pinned (`packaging/systemd/hal0-openwebui.service:64-72`). The installer starts it (`README.md:158-159`); `HAL0_SKIP_OPENWEBUI=1` skips.
- Env written by hal0 (`src/hal0/openwebui/env_writer.py:165-184`). Chat base URL points at hal0 `/v1`, so **slots appear automatically** as `agent`, `coder` and so on via `/v1/models`, within seconds of a change (`src/hal0/api/__init__.py:244`).
- Voice always wired. Document RAG wired when an embed slot is bound. Images wired when the `img` capability has a renderable model. Web search: "none ships today" (`docs/guides/open-webui.mdx:15-22`).
- Hermes profiles appear in the picker next to slots: `hermes-agent` plus one id per profile (`docs/guides/open-webui.mdx:105-120`; ADR-0035).
- **Partial slot-addressing gaps:**
  - `AUDIO_STT_MODEL=whisper-v3:turbo` and `AUDIO_TTS_MODEL=kokoro-v1` are fixed defaults, though the endpoint path pins the slot.
  - `RAG_EMBEDDING_MODEL` and `IMAGE_GENERATION_MODEL` are written as model ids and re-rendered on change, with a restart of a running Open WebUI for image changes (`docs/guides/open-webui.mdx:46-56,76-78`).
- **`WEBUI_AUTH=False`**, so there is no login by default (`src/hal0/openwebui/env_writer.py:184`), and hal0's auth does not cover this second listener (`README.md:766-767`).

**Hermes** [code + docs]
- A **third-party** agent: `NousResearch/hermes-agent` (`docs/adr/0032-hermes-install-posture.md:82`), pinned to reviewed commit v0.22.4 `4d043038` (`README.md:577-580`). hal0 "doesn't build its own agent runtime" (`docs/concepts/agents.mdx:10-16`).
- Runs as `hal0-agent@hermes.service`, installed by default by the installer (`README.md:158-163`); `HAL0_SKIP_HERMES=1` skips. **The build needs network access.**
- `model.default = hal0/agent` under live-resolve, the default, with `discover_models` so it sees every slot (`src/hal0/agents/hermes_provision.py:1726-1752`). Slot swap triggers a context-file refresh (`src/hal0/agents/hermes_refresh.py:1-9`).
- A new Hermes profile gets its key, its `/v1` upstream and its MCP wiring within two minutes (`docs/guides/open-webui.mdx:120`; `src/hal0/api/__init__.py:1375`). **Chat is Hermes's own dashboard or `/v1`**; hal0 removed its proxy (`README.md:318-320`). Non-default profile chat needs `hermes-gateway` running (`README.md:338-340`).
- The site's `HermesCard.astro` "Ghost Relay" copy (Telegram/Discord) rests on Hermes's own gateway platforms (`docs/concepts/agents.mdx:44-45`). I did not verify a tested end-to-end flow.

**pi / pi-coder** [code]
- Third-party CLI/TUI coding agent, `earendil-works/pi`, formerly `badlogic/pi-mono` (`src/hal0/agents/pi_coder/driver.py:1-9`). The name in code is `pi`; "pi-coder" is the driver directory and an old bundle name (`docs/concepts/agents.mdx:22-25`). Use "pi" on the site.
- **Opt-in**: `sudo hal0 agent install pi`, pinned `@earendil-works/pi-coding-agent@1.2.0` (`installer/agents/pi.sh:31`). Needs npm. Not a service.
- `defaultModel = "agent"`, a slot name (`src/hal0/agents/pi_coder/driver.py:518-519`).
- **Does not pick up new slots live.** "The provider's model list is fixed at load; picking up newly-loaded slots still needs a restart/respawn" (`src/hal0/agents/pi_coder/plugins/hal0-provider/index.ts:5-10`).

**Other services** [code]
- The Services registry has **exactly four** entries: `openwebui, comfyui, hermes, hindsight` (`src/hal0/services/registry.py:102-160`; `docs/operate/services.mdx:3`).
- **The README's "n8n" claims are stale** (`README.md:104,522,1163`). The only trace in `ui/src` is an icon and comments; `src/hal0` has no matches. Do not advertise n8n.
- Agents page cards: Hermes and pi are live. "Qwen and opencode sit behind a grey 'Coming soon' mask and do nothing yet" (`docs/guides/agents-view.mdx:11-12`).

**ComfyUI** [docs]
- One container in the `img` slot, ROCm, runs as the `hal0` account. Tabs: Generate, Models, Engine. Catalog with fit meter. Editor on LAN at `:8188` (`docs/guides/generate-images.mdx:12-48`; `README.md:250-254`).
- `/v1/images/generations` and `/v1/images/edits` exist. **Video, edit and upscale models install, but "run in the ComfyUI editor"** rather than from the API (`docs/guides/generate-images.mdx:67,232`).

**Voice** [docs]
- STT: Moonshine (CPU) or whisper-v3:turbo on NPU (FLM). No GPU STT engine.
- TTS: Kokoro (CPU) or Qwen3-TTS (ROCm, about 10 GB, opt-in) (`docs/guides/voice-stt-tts.mdx:13-20,85-92`; hal0-runner-images `images.json:116`).
- Moonshine and Qwen3-TTS weights are operator-staged, not one-click (`docs/guides/voice-stt-tts.mdx:117-120`).

**Realtime** [docs]
- `WS /v1/realtime` is enabled by default. An OpenAI-Realtime-shaped subset with server VAD and barge-in, chaining local STT, chat and TTS (`docs/reference/api/realtime.mdx:9-45`).

**Owner claim, "everything wired automatically and continuously":** **PARTIALLY TRUE.**
| Piece | Reality |
|---|---|
| New slot → Open WebUI picker | True, automatic |
| New slot → Hermes | True, discovery |
| New slot → pi | **Needs a restart** |
| New inference profile → any client | **Irrelevant.** Profiles are not client-visible; they change how a slot runs |
| New Hermes profile → wired in ≤2 min | True, Hermes only |
| Attached/third-party MCP servers → agents | **Not backed** |
| "More to come" | Only "Coming soon" cards exist, for Qwen and opencode |

---

## 8. Agents

- **Bundled:** `BUNDLED_AGENTS = ("hermes", "pi")`. The Hermes daemon is single-pick among daemon agents, and pi can sit alongside it (`docs/concepts/agents.mdx:21-25`; `docs/adr/0004-bundled-agents.md:38-40`).
- **hal0-brain steward:** a built-in persona, not a third-party agent. Top-bar **Agent Chat** and `hal0 chat --brain`, over `POST /api/brain/chat` (`docs/concepts/brain.mdx:30-35`). Seeded model `lfm2.5-2.6b`, 2.87 GB (`README.md:147-149`).
  - **`[brain_chat] read_only` ships `true`**, so out of the box it reads and answers but cannot change the box until an operator flips it (`docs/concepts/brain.mdx:96,199-203`).
- **Skills:** `installer/agent-skills/`: `hal0-admin, hal0-agents, hal0-bench, hal0-bench-autopilot, hal0-bridge, hal0-memory, hal0-service-management, hal0-tune`. OAuth skills via **Connected Accounts** (`docs/guides/agent-oauth-skills.mdx`).
- **Runs, steer, answer:** bridge tools `agent_run`, `agent_run_wait`, `agent_run_status`, `agent_run_events`, `agent_run_answer`, `agent_run_steer`, `agent_run_stop`, `agent_runs_list`, plus `hal0 bridge runs` and a **Delegated** tab on the Hermes card. **NIGHTLY** (`CHANGELOG.md:48`).
- **Inbox/approvals:** header bell and modal, `hal0 agent approvals list|approve|deny`. Per-persona tool policy with a `POLICY_NO_LOOSEN` floor (`README.md:552-555,560-564`).
- **Operator Board:** `#board`, labelled **Kanban** in the sidebar Services zone, ⌘B (`ui/src/dash/chrome.jsx:520-521`; `ui/src/dash/main.jsx:232-234`). CLI `hal0 board list|show|add|move`. hal0 owns board state; execution goes through an optional seam (`src/hal0/board/dispatch.py:1-30`), with a Hermes executor that registers only when Hermes is configured (`src/hal0/board/hermes_executor.py:1-10`). An earlier screenshot was held back for showing no tasks.
- **Budgets:** per-persona spending budget (`docs/guides/run-agents.mdx:461`).
- **Hermes's terminal tool is off by default**, an explicit opt-in (`SECURITY.md:18-23`).

---

## 9. Models

- **Registry:** SQLite per `README.md:1113`, though `docs/reference/model-roster-benchmark.mdx:16` says TOML files per model. These disagree, so don't state the storage format on the site. Rows hold file facts only (`docs/reference/model-roster-benchmark.mdx:20-40`).
- **HF pulls:** `hal0 model pull <repo>/<file>`, disk preflight, resumable via HTTP Range, `user.*` namespace (`README.md:227-230`). Add from Hugging Face lists quants and fit-checks drafter pairs (`README.md:353-363`).
- **Update checks:** compares stored sha256 with HF's LFS oid, TTL-cached one hour (`src/hal0/registry/update_check.py:1-18`; `src/hal0/api/routes/models.py:524`).
- **Speculative decoding:** drafters (LiLiCorr, DFlash, EAGLE-3), per-slot accept rate, one measured ~1.6× example on one box with identical output (`README.md:672-699`).
- **Upstreams:** OpenRouter, Anthropic, OpenAI, Google AI Studio, Ollama, MiniMax, DeepSeek, custom (`README.md:489-491`; `src/hal0/upstreams/integrations.py:87`).

**Runner images** (`manifest.json` `runners`, current tags)
| Key | Image | Tag | Runs |
|---|---|---|---|
| `standard` | ghcr.io/hal0ai/hal0-runner-standard | `b11840-rba99f5d` | llama.cpp, ROCm + Vulkan |
| `cpu` | hal0-runner-cpu | `b11840-rba99f5d` | llama.cpp CPU |
| `cuda` | ghcr.io/ggml-org/llama.cpp | `server-cuda-b11804` | llama.cpp NVIDIA (upstream image) |
| `flm` | hal0-runner-flm | `1.0.10-r1c3f49e` | FastFlowLM on XDNA NPU |
| `kokoro` | hal0-runner-kokoro | `0.4.9-re14329d` | TTS CPU |
| `moonshine` | hal0-runner-moonshine | `20251121-re14329d` | STT CPU |
| `qwen3tts` | hal0-runner-qwen3tts | `0.1.1-re14329d` | TTS ROCm |
| `comfyui` | hal0-runner-comfyui | `0.28.0-r6996d85` | Images, ROCm |

- **vLLM: not a product runner.** No match in `src/hal0/runners` or `manifest.json`. It appears only in the disconnected hal0-profiles schema.
- `images.json` in the runner-images repo has stale maintainer notes (FLM v0.9.44, b11510/b11552). Use `manifest.json`.

**Install and update**
- One line: `curl -fsSL https://hal0.dev/install.sh | sudo bash`. Bootstrap needs `jq` and `cosign`. It verifies the manifest, sha256 and Sigstore bundle (`README.md:119-127`).
- Channels: `stable` default, `preview`, `nightly` (`README.md:129-134`).
- `hal0 update`, `--check`, `--channel`, `--rollback`, `--restart-slots`. Cosign-verified swap of `/usr/lib/hal0/current` (`README.md:532-536,925-933`). **Config and state do not roll back** (`README.md:951-953`).
- Upgrade floor 1.5.0 (`README.md:258-259`).
- Proxmox one-liner (`README.md:186-198`).

---

## 10. Privacy and security

### Facts the site can state

- **Inference runs locally.** Chat, embeddings, rerank, speech and images run in local slot containers. Slot ports publish on `127.0.0.1` (`docs/concepts/slots.mdx:49-51`). Realtime has "no upstream OpenAI connection anywhere in this path" (`docs/reference/api/realtime.mdx:21-25`).
- **No upstream provider is required.** Remote routing happens only if you configure an upstream. I did not find seeded enabled upstreams, but I only grepped for this. Confirm on a fresh box before an absolute claim.
- **hal0 has no telemetry code that I could find.** `[telemetry] enabled` exists and defaults false (`src/hal0/config/schema.py:2013-2024`). The only consumers I found are the settings UI and apply table; `cfg.telemetry` is read only for `channel` (`src/hal0/api/routes/updater.py:130`). So it is an inert flag.
- **Crash reporting is opt-in and absent by default.** Sentry needs an extra package plus a DSN; the dashboard needs a DSN at build time; there is no default DSN; session replay is off (`docs/operate/sentry.mdx:10-13,81-94`; `ui/src/sentry.ts:1-36`). Stock install "sends nothing".
- **Benchmarks and diagnostics never leave on their own.** `hal0 bench upload` needs an admin token and an explicit command; `hal0 doctor bundle` never uploads (`README.md:454-457,968-972`; `docs/reference/model-roster-benchmark.mdx:219-224`).
- **Request hygiene:** `x-stainless-*` and client-identity headers are stripped before forwarding (`src/hal0/forwarded_headers.py:45-51`).

### Automatic outbound calls that exist: "no phone-home at all" would be FALSE

1. **Release manifest check.** `GET /api/updates/state` fetches `https://releases.hal0.dev/{channel}.json` (`src/hal0/api/routes/updater.py:549,586`; `src/hal0/updater/updater.py:518`). The **dock calls this on every dashboard page** (`ui/src/dash/dock/Dock.jsx:130-131`).
2. **Hugging Face model update check.** `GET /api/models/updates/check` calls `huggingface.co/api/models/<repo>/tree/main` once per unique pulled repo. The always-mounted notifications component polls every 30 minutes, server-side TTL one hour (`ui/src/api/hooks/useModels.ts:367-386`; `ui/src/dash/notifications.jsx:126`; `src/hal0/api/routes/models.py:524`). **This tells Hugging Face which repos you use.**

Both are triggered by the dashboard being open. I found no backend timer, but I did not trace every loop. Neither carries prompts or files.

Expected by-request outbound: image pulls from ghcr.io, model pulls from huggingface.co, installer and Hermes build (network required), `hal0 update`. If a user turns on upstreams, Hermes messaging platforms, OAuth skills or Sentry, data goes where they point it.

### Not audited

hal0 sets no telemetry env vars for its companions. A grep for `ANONYMIZED_TELEMETRY|SCARF_NO_ANALYTICS|DO_NOT_TRACK|HERMES_TELEMETRY|POSTHOG|OTEL_|HF_HUB_DISABLE_TELEMETRY` across `src/hal0`, `installer`, `packaging` and `scripts` returned nothing. **Open WebUI, Hermes, Hindsight, ComfyUI and FLM behaviour is unverified.** A universal "nothing ever leaves the box" claim would require a packet capture. Recommend running one before publishing.

### Auth and exposure: what "never leak" must not gloss over

- **Open on the LAN by default.** API binds `0.0.0.0:8080`, no login, no key (`docs/concepts/security.mdx:26-32`; `installer/install.sh:263-279`).
- **Open WebUI on `:3001` has no login by default** and is outside hal0's auth (`src/hal0/openwebui/env_writer.py:184`; `README.md:766-767`). Anyone on the LAN can open it.
- Optional auth: `hal0 auth rotate admin`, `hal0 auth require on`. Tiers anon/client/admin; deny-by-default route classes with a CI ratchet (`docs/concepts/security.mdx:47-88`; `README.md:757-761`).
- **Admin gate:** once an admin key exists, a LAN-bound box gates ADMIN routes for off-box callers even with enforcement off (`docs/concepts/security.mdx:34-39`).
- **No TLS.** Bring a reverse proxy (`README.md:763-767`). **Do not expose to the internet**, per the project's own docs (`docs/concepts/security.mdx:17-22`).
- MCP has DNS-rebinding host/origin allowlists (`docs/concepts/security.mdx:141-172`).

### Systemd hardening: be careful with the wording

- `hal0-agent@.service`: `NoNewPrivileges=yes, ProtectSystem=strict, ProtectHome=yes, PrivateTmp=yes, ProtectKernelTunables=yes, ProtectKernelModules=yes, ProtectControlGroups=yes, RestrictSUIDSGID=yes, RestrictRealtime=yes`, plus `ReadWritePaths` (`installer/systemd/hal0-agent@.service:75-83,136`).
- **`hal0-api.service` sets none of these** (`SECURITY.md`, compensating-controls table). It runs as `User=hal0`.
- **`SECURITY.md:14-60` states "Treat the bundled agent as root-equivalent".** The `hal0` account is root-equivalent by design through sudo wrappers and rootful podman. With the terminal tool on, a prompt-injected agent "can reach every credential the box holds".
- Real positives: privileged operations go through an allow-listed root seam, never a free-form shell (`README.md:421-422`); the terminal tool is off by default; gated tools need human approval.
- **Do not market this as "sandboxed agents, so you're safe".**

### Owner claim, "privacy (everything local, chats/files never leak)": **PARTIALLY TRUE**

- True: local inference, no telemetry code, no required cloud, opt-in crash reports.
- Not supportable: an absolute "never leak". The LAN is open by default, Open WebUI has no login, the dashboard makes two automatic outbound metadata calls, upstreams and agent tools can send data out if configured, and third-party internals are unaudited.
- Suggested copy: "Your prompts and files stay on your box unless you connect an upstream. No telemetry. No accounts. Runs on your LAN, so keep it there or turn on auth."

---

## 11. Hardware

- **First-class:** Ryzen AI Max+ 395 (128 GB) and Max 385/390 (64 GB) (`README.md:717-718`).
- **Strix Halo specifics:** iGPU via ROCm or Vulkan, XDNA NPU via FLM, CPU; UMA-aware probe; fit warnings size against the real unified pool, not a BAR carve-out (`README.md:391-397`; `docs/concepts/strix-halo.mdx:16-34,128`).
- **NPU trio:** one `flm serve` process hosts chat + STT + embed concurrently, ~2 GB NPU memory, gemma3:1b at ~38.6 tok/s (`README.md:399-407`). Opt-in; a second NPU chat slot is rejected.
- **NVIDIA: experimental.** `cuda` runner via CDI, multi-GPU `gpu_index`, falls back to Vulkan without CDI, not in the release-gate matrix or fleet: "treat as unvalidated" (`README.md:719`; `docs/reference/support-matrix.mdx:337`).
- **AMD discrete:** README says "Supported" (`README.md:720`).
- **CPU-only:** valid, "usable for tiny models / smoke tests, not the headline experience" (`README.md:721`).
- **Platform:** Linux + systemd + podman only. Docker unsupported. Proxmox LXC supported. WSL2 experimental, CPU only. macOS and Windows not supported (`docs/reference/support-matrix.mdx:314-320`).
- **Multi-box: roadmap only.** "Multi-host federation" under Exploring (`README.md:1211-1212`). Federated memory under Soon (`README.md:1201-1202`). What exists today: upstreams can point at another OpenAI-compatible endpoint, and bridge clients can be remote. **No slot mesh.**
- **Proxmox integration:** optional read-only API token shows physical host memory (`README.md:771-781`).

---

## 12. Benchmarks

- `hal0 bench plan|run|status|worker|results|history|reindex|devices|publish|eval|bundle|upload` (`docs/reference/model-roster-benchmark.mdx:141-143`; `src/hal0/bench/cli.py:159-817`). Drives `llama-bench` and `llama-server`, with a dedup identity key, regression journaling and content-addressed bundles (`README.md:451-458`).
- Dashboard `#benchmarks`: **Roster, Runs, Evals, Run Queue** (`docs/reference/model-roster-benchmark.mdx:152-170`; `ui/src/dash/chrome.jsx:522-527`). The API only queues; `hal0 bench worker` drains.
- **First-party roster:** README cites 26 models on the reference box, 395 / 8060S / 128 GB, ROCm 7.2.4 (`README.md:426-430`), for example `qwen3.5-0.8b` 169.8 tok/s decode.
- **Data freshness:** project memory records that `api.hal0.dev` has no public DNS, so the public roster is the static 2026-06-19 data from hal0 v0.5.0a1 (hal0-web memory `hal0-web-1-4-refresh-facts.md:14`). Lookups from this box are misleading because local DNS answers for it, so I did not independently confirm the public record. **Do not present these as current-release numbers.** State the date and version, or re-run.
- **Screenshot caution:** the roster screenshot was previously reverted for exposing private model names.

---

## 13. Worth a screenshot or demo

| Surface | Route | Why | In stable? |
|---|---|---|---|
| Slot cards with model and profile dropdowns | `#slots` | The core story: swap behind a stable name | Yes |
| Slot rail | `#slots` | State, device, tok/s, loaded memory by device | Yes |
| Telemetry bar and memory ruler | `#slots` | Per-slot memory on the unified pool | Yes |
| Resolved command panel | `#slots/<name>` | Every flag labelled by owner. Rare and credible | Yes |
| Open WebUI picker showing `agent · <model>`, `coder · <model>`, Hermes profiles | `:3001` | **The single best proof of slot addressing.** Captures before and after a swap would tell the whole story | Yes |
| The dock, gpu and events tabs | any page | Live status strip with GPU arbiter | Yes |
| Image Gen, Models with fit meter | `#slots/image/models` | Fit check before install | Yes |
| Generate following the GPU switch | `#slots/image/generate` | Visible arbiter behaviour | Yes |
| Memory graph and bank | `#memory/bank` | Visually strong | Yes |
| Command palette | ⌘K | Fuzzy search over routes, slots, models, actions | Yes |
| Agents cards (flip) | `#agent` | Distinctive. Crop out "Coming soon" or note it | Yes |
| Approvals inbox | bell | Human-in-the-loop | Yes |
| Agent Chat drawer | top bar | Steward answering about the box | Yes |
| Stacks tab | `#slots/stacks` | Whole-lineup switching | Yes |
| Runner Images | `#slots/runner-images` | Pinned engines | Yes |
| Benchmarks | `#benchmarks` | Check for private model names first | Yes |
| Logs | `#logs` | Live per-slot journal | Yes |
| Doctor | `#settings/doctor` | Actionable diagnostics | Yes |
| Overview briefing | `#dashboard` | Needs-you band, serving now, usage, hardware | **NIGHTLY** version only |
| Bridge clients, Delegated tab | `#mcp`, Hermes card | Remote agents delegating | **NIGHTLY** |
| Tune block | `#slots/<name>` | Per-slot overrides | **NIGHTLY** |

Power stats: `GET /api/stats/power` (hwmon clock, temperature, power; `src/hal0/api/routes/power.py:1-7`). Throughput history: `GET /api/stats/throughput/history` (`src/hal0/api/routes/throughput.py:1-10`). Both surface in `telemetry-header.jsx`; throughput also surfaces in `overview/serving-now.jsx`.

There is **no dedicated Hardware page**. See the route notes below.

---

## Dashboard navigation

Hash routing, `ROUTES` at `ui/src/dash/main.jsx:63`. Sidebar at `ui/src/dash/chrome.jsx:495-546`.

| Sidebar | Route | Children |
|---|---|---|
| Overview | `#dashboard` | |
| Slots | `#slots` | `#slots/inference` (default), `#slots/image` (with `/generate`, `/models`, `/engine`), `#slots/endpoints`, `#slots/runner-images`, `#slots/stacks`, `#slots/<slot-name>` opens the drawer |
| Models | `#models` | `#models/inference`, `#models/image`, `#models/upstream`, `#models/profiles` |
| Benchmarks | `#benchmarks` | `#benchmarks/roster`, `/runs`, `/evals`, `/queue` |
| Agents | `#agent` | `#agent/overview`, `#memory` (with `#memory/bank`; hidden if memory is off), `#mcp` (also `#agent/mcp`, `#agents/mcp`) |
| Services | `#services` | |
| Logs | `#logs` | |
| Settings | `#settings` | see below |
| Kanban (sidebar Services zone) | `#board` | ⌘B |

**Settings** (`ui/src/dash/settings/SettingsNav.jsx:8-45`)
- General: `#settings/overview`, `/security`, `/network`, `/doctor`
- Models & Inference: `/slots` (Loaded Models), `/modeldefaults`, `/capabilities`
- System: `/hardware`, `/storage`, `/memory`, `/updates`, `/advanced`
- Integrations: `/secrets`, `/accounts`, `/agents` (Agent Chat), `/realtime`

**Route traps**
- `#hardware` is **not** in `ROUTES`, even though the command palette lists it (`ui/src/dash/command-palette.jsx:242`). Unknown heads fall back to the dashboard (`ui/src/dash/main.jsx:75`). Use `#settings/hardware`.
- Keyboard: ⌘K palette, ⌘B board, `n` on `#slots` (`ui/src/dash/main.jsx:222-234`).
- The Image Gen sub-tab defaults depend on state unless the URL names it, so capture with the full `#slots/image/<sub>` hash.

---

## Scorecard of the owner's brief

| Claim | Verdict | Say instead, if needed |
|---|---|---|
| Multiple models in defined slots | **TRUE** | |
| Custom profiles | **TRUE** | |
| Slots run in parallel | **TRUE**, except GPU LLM slots pause while an image renders | |
| Clients reference the slot, not the model | **TRUE** for chat; partial for Open WebUI's embedding and image settings | |
| Changing model = dropdown | **TRUE** | |
| Swap "instantly", no client reconfiguration | **PARTIAL**: no reconfiguration is true, instant is not | "Swap the model, keep the name" |
| Agent / memory / research / coding slots | **PARTIAL**: `agent`, `coder` seeded; research is custom; no memory slot | |
| Router delegates tasks/inputs/mediums | **PARTIAL**: path routing is real; no content router; OmniRouter opt-in; default is off | "One API, one slot per medium" |
| Privacy, chats/files never leak | **PARTIAL**: see section 10 | "Stays on your box unless you connect an upstream" |
| Unified memory | **TRUE** | "One memory your agents share" |
| Agent-to-agent via custom MCP | **PARTIAL**: shared notes (stable), remote→Hermes delegation (nightly), no messaging between local agents | |
| Add model/slot → all clients pick it up | **PARTIAL**: Open WebUI and Hermes yes, pi needs a restart | |
| Add profile → clients pick it up | **NOT BACKED** as written: inference profiles are not client-visible | |
| Attached MCP servers flow to all agents | **NOT BACKED**: `hal0-admin` and `hal0-memory` reach Hermes and pi; user-installed servers are blocked; Open WebUI gets none; nothing attaches to a slot | |
| "More to come" | Only "Coming soon" cards for Qwen and opencode | |

## Stale or conflicting sources to avoid copying from

- `README.md:104,522,1163`: n8n.
- `README.md:632,644,650-654`: profile seeds.
- `README.md:540`: "three MCP servers" is nightly-only.
- `README.md:1113` versus `docs/reference/model-roster-benchmark.mdx:16`: registry storage.
- `docs/concepts/slots.mdx:409` versus `src/hal0/agents/hermes_provision.py:1743`: whether `hal0/*` virtuals are listed in `/v1/models`. The route's docstring and builder say slot aliases are listed.
- `docs/guides/connect-mcp.mdx:199-200`: lists 5 memory tools where the server has 26.
- `/mnt/mintdev/repos/hal0-runner-images/images.json`: stale maintainer notes.
- `/mnt/mintdev/repos/hal0-mono/hal0-profiles`: stale format.
- `src/components/HermesCard.astro` in hal0-web: game-card ability copy ("Chains tool calls unattended for hours") has no specific backing in what I read.
