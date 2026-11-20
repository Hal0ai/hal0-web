/**
 * Copy and structured data for the landing page's sections.
 *
 * Every sentence traces to docs/superpowers/research/2026-11-01/product-inventory.md
 * through section 4 of the redesign spec. Standing limits on what may be said:
 * no content-aware router, third-party MCP servers do not reach agents, pi needs
 * a restart to see new slots, image generation pauses GPU chat slots, the box is
 * open on the LAN by default, and a swap reloads the slot.
 *
 * Text in backticks renders as code through `codeSpans`. The FAQ stays plain text
 * because its strings also feed the FAQPage schema.
 */

/** Turns `code` spans into markup. Input is first-party constants from this file. */
export const codeSpans = (text: string) => text.replace(/`([^`]+)`/g, '<code>$1</code>');

export const IDEA_COLUMNS: { key: string; title: string; body: string; examples: string }[] = [
  {
    key: 'slot = placement',
    title: 'A name, a device, a port',
    body: 'One model in its own container behind the API, with a type (chat, embedding, rerank, speech, image), a device (ROCm, Vulkan, NPU, CPU), a priority and a name your apps use. Custom slots are one command.',
    examples: 'agent · coder · brain · embed · rerank · stt · tts · img · custom: research',
  },
  {
    key: 'profile = tune',
    title: 'The whole tune, reusable',
    body: 'Context length, thinking, vision, speculation, runner and flags live in a named profile. Clone a seed, change it, point any slot at it. The slot drawer shows the resolved command with every flag labelled by owner.',
    examples: 'chat · agent · coding · embedding · brain · flm · comfyui',
  },
  {
    key: 'model = facts',
    title: 'The file and nothing else',
    body: 'What is true about the file: size, quantisation, context ceiling, what it can do. Pull from Hugging Face with a fit check, keep several quants, and let update checks tell you when the repo changed.',
    examples: 'GGUF · drafters for speculation · HF update checks',
  },
];

export const ENDPOINT_MAP: { path: string; slot: string }[] = [
  { path: '/v1/chat/completions', slot: 'agent, coder, brain' },
  { path: '/v1/embeddings · /v1/rerank', slot: 'embed, rerank' },
  { path: '/v1/audio/transcriptions', slot: 'stt (NPU or CPU)' },
  { path: '/v1/audio/speech', slot: 'tts' },
  { path: '/v1/images/generations', slot: 'img (ComfyUI)' },
];

export const ROUTING_NOTE =
  'One API, one slot per medium. hal0 routes by endpoint and model name, and it never reads a prompt to choose a slot.';

export const PARALLEL_NOTE =
  'Slots run in parallel as far as the memory pool allows; hal0 checks fit before loading and evicts by priority under pressure. Image generation borrows the GPU while it renders, so GPU chat slots pause until it finishes.';

export const CLIENT_DEFAULTS: { client: string; detail: string }[] = [
  {
    client: 'Open WebUI',
    detail: 'model picker lists every chat slot as `agent · Qwen3.8 27B`, updated within seconds of a change',
  },
  { client: 'Hermes', detail: 'defaults to `hal0/agent` and discovers every other slot' },
  { client: 'pi', detail: 'defaults to `agent`; sees new slots after a restart' },
  {
    client: 'Hindsight',
    detail: 'extracts memory through `hal0/memory`, which resolves to the slot you choose',
  },
  {
    client: 'your code',
    detail: 'any OpenAI client with `model: "coder"` and `base_url: http://halo:8080/v1`',
  },
];

export const SWAP_STEPS: string[] = [
  '`GET /v1/models` returns one entry per chat slot, named after the slot.',
  '`model: "agent"` is rewritten to whatever the slot holds right now.',
  'Swap from the card, the CLI or MCP. A fit check runs first; a bad id leaves the slot untouched. Requests during the reload get a 503 with Retry-After.',
];

export const PRIVACY_LEDE = {
  before: 'Chats, files, embeddings, voice, and ',
  aside: 'the million-dollar idea you brainstormed at 2 a.m.',
  after:
    ' are processed on hardware you own, and they stay there unless you connect an upstream. hal0 sends no telemetry and needs no account.',
};

export const PRIVACY_FACTS: { title: string; body: string }[] = [
  {
    title: 'Local inference',
    body: 'Every model runs in a container on your box. Chat, embedding and speech slots sit on loopback ports behind the API. Realtime voice chains local speech-to-text, chat and text-to-speech with no cloud hop.',
  },
  {
    title: 'No telemetry',
    body: 'hal0\'s own code has no telemetry. Crash reporting exists, is off, and needs a key you supply. Benchmark bundles and diagnostics never upload on their own.',
  },
  {
    title: 'No account',
    body: 'No sign-up and no licence server. Apache-2.0, with the source on GitHub.',
  },
  {
    title: 'Updates you trigger',
    body: 'Cosign-verified releases with one-flag rollback. While the console is open it checks for new releases and model updates; those checks carry no prompts or files.',
  },
];

export const LAN_NOTE =
  'The API, Open WebUI and the ComfyUI editor serve your network with no login and no TLS by default. Keep the box on your LAN, or turn on key auth and put a reverse proxy in front before you share it. Key auth covers the API only.';

export const WIRED_TILES: { tag: string; title: string; body: string }[] = [
  {
    tag: 'chat',
    title: 'Open WebUI',
    body: 'Installed and started on `:3001`, with every chat slot in its model picker. Voice is wired from the start; document search on hal0 embeddings and the ComfyUI image button switch on once embed and img have models.',
  },
  {
    tag: 'agent',
    title: 'Hermes',
    body: 'A third-party agent, pinned to a reviewed release and installed by default. Defaults to the agent slot and gets hal0\'s admin and memory tools. Risky tool calls wait for your approval.',
  },
  {
    tag: 'coding',
    title: 'pi',
    body: 'A third-party terminal coding agent, one command to add. Points at the agent slot with the same admin and memory tools.',
  },
  {
    tag: 'images',
    title: 'ComfyUI',
    body: 'Runs in the img slot. `POST /v1/images/generations` renders SDXL, SD 1.5 or Qwen-Image. The editor stays on the LAN for workflows the API does not cover.',
  },
];

export const WIRED_NOTE =
  'Bring your own MCP client: `/mcp/admin` and `/mcp/memory` are plain Streamable HTTP. Claude Code, Codex and Cursor connect by pasting one line. Destructive admin calls wait until a person says yes.';

export const MEMORY_POINTS: { term: string; text: string }[] = [
  { term: 'Directives', text: 'are standing instructions an agent sees every turn.' },
  { term: 'Mental models', text: 'are standing questions whose answers stay fresh as facts change.' },
  {
    term: 'The bank workspace',
    text: 'shows every fact, a graph of how they connect, and lets you curate or delete with an audit row.',
  },
];

export type ConsoleShot = {
  file: string;
  alt: string;
  /** The first sentence renders as the bold label. */
  caption: string;
  /** No usable capture yet: renders only a TODO comment, and stays out of the schema. */
  todo?: true;
  /** The capture is not 1440 by 900: fit it inside the frame rather than cropping it. */
  contain?: true;
  /** The capture is a strip (the dock): the frame takes the image's own shape instead of 1440 by 900. */
  natural?: true;
};

export const CONSOLE_SHOTS: ConsoleShot[] = [
  {
    file: 'slot-model-picker-open',
    alt: 'Slot card on the hal0 console with the model picker open, showing models with fit chips',
    caption: 'Slot card, picker open. Each option shows size, fit and who else uses it.',
    contain: true,
  },
  {
    file: 'openwebui-picker',
    alt: 'Open WebUI model picker listing agent, coder and brain',
    caption: 'Open WebUI, same box. The picker shows slot names with the model behind each one.',
    todo: true,
  },
  {
    file: 'memory-bank',
    alt: 'hal0 memory bank workspace with a facts list and graph',
    caption: 'Memory bank. Facts, the graph, directives and mental models in one workspace.',
  },
  {
    file: 'slots-inference',
    alt: 'hal0 console slots page with slot cards, throughput and the memory ruler',
    caption: 'Slots. Each card carries a model picker, a profile picker, context and live memory.',
  },
  {
    file: 'slot-edit-drawer',
    alt: 'Slot drawer open over the slots page: model, profile and the tune block for the agent slot',
    caption: 'Slot drawer. Model, profile and the tune: context, thinking, effort, budget, vision and speculation, each marked profile or override. Per-slot tune is on nightly today.',
  },
  {
    file: 'model-edit-drawer',
    alt: 'Model drawer open over the slots page: file facts, runner compatibility and source paths for a GGUF',
    caption: 'Model drawer. The file and nothing else: quant, size, architecture, drafter, chat template, native context, where it runs.',
  },
  {
    file: 'dashboard-overview',
    alt: 'hal0 overview page with the memory pool, the slots serving now, agents and delegated runs',
    caption: 'Overview (preview). What each slot is serving, the memory pool, agents and delegated runs on one page. Nightly channel today.',
  },
  {
    file: 'image-gen-generate',
    alt: 'Image generation pane on the hal0 console with a prompt, size presets, a fit check and a finished render',
    caption: 'Image gen. Prompt, size, steps and a fit check before the render; results land beside it.',
    contain: true,
  },
  {
    file: 'image-gen-models',
    alt: 'Image model catalogue with a fit meter',
    caption: 'Image models. A fit meter shows what fits before you install.',
    todo: true,
  },
  {
    file: 'agents-overview',
    alt: 'Agents page with cards for Hermes, pi and a runtime on the roadmap',
    caption: 'Agents. Every agent in the runtime as a card: version, model, persona, approvals and health.',
  },
  {
    file: 'agent-card-console',
    alt: 'The Hermes agent card flipped to its console with restart, logs, persona and approval controls',
    caption: 'Card console. Flip a card for restart, logs, tool activity, persona and command approvals.',
  },
  {
    file: 'mcp-tab',
    alt: 'MCP page listing the bundled hal0 servers with their tool counts and the bridge clients that call them',
    caption: 'MCP. The bundled servers with their tool counts, and the bridge clients that call them. The bridge is on nightly today.',
    contain: true,
  },
  {
    file: 'memory-graph',
    alt: 'Memory bank in its web view: facts as a force-directed graph linked by meaning, time and shared entity, with a tag map beside it',
    caption: 'Memory graph. A bank as a web: related meaning, near in time, shared entity, with the tag map beside it.',
  },
  {
    file: 'approvals-inbox',
    alt: 'Approvals inbox with one pending tool call',
    caption: 'Approvals. Gated tool calls wait here until a person says yes.',
    todo: true,
  },
  {
    file: 'dock-gpu',
    alt: 'The dock with its GPU tab open',
    caption: 'Dock. GPU state, slot and service health, downloads and a merged event feed.',
    natural: true,
  },
];

export const HARDWARE_TIERS: { tier: string; name: string; note: string; reference?: true }[] = [
  {
    tier: 'reference',
    name: 'Ryzen AI Max+ 395',
    note: '128 GB unified · iGPU + NPU · all published numbers',
    reference: true,
  },
  { tier: 'first-class', name: 'Ryzen AI Max 385 / 390', note: '64 GB unified · same install path' },
  { tier: 'supported', name: 'Radeon RX 7000', note: '16 to 24 GB · ROCm or Vulkan' },
  { tier: 'experimental', name: 'NVIDIA RTX', note: 'opt-in CUDA runner · not in the release gate' },
  { tier: 'fallback', name: 'CPU only', note: 'small models, speech, smoke tests' },
  { tier: 'supported', name: 'Proxmox LXC', note: 'one script · GPU + NPU passthrough' },
];

export const COMPARE_COLUMNS = ['hal0', 'Ollama', 'LM Studio', 'llama-swap', 'Lemonade'];

/**
 * Cells trace to section A of docs/superpowers/research/2026-11-01/competitive.md
 * and describe defaults. "none found" and "not found" carry that file's
 * "unverified" and "not found" marks through to the reader.
 */
export const COMPARE_ROWS: {
  label: string;
  cells: [string, string, string, string, string];
}[] = [
  // source: S75, S7, S15, S33, S34, S43
  {
    label: 'Clients address',
    cells: [
      'a typed slot name; model swaps behind it',
      'a model name',
      'an identifier set at load',
      'aliases in hand-edited YAML',
      'a model name',
    ],
  },
  // source: S75, S1, S14, S34, S43
  {
    label: 'Models resident by default',
    cells: [
      'several, as memory fits, priority eviction',
      'up to 3 per GPU',
      'one on demand, auto-evict',
      'one; groups opt in',
      'one per type',
    ],
  },
  // source: S75, S7, S17, S33, S43
  {
    label: 'Reusable tune profiles',
    cells: [
      'named, forkable, device-agnostic',
      'per-model Modelfile',
      'prompt + sampler presets',
      'per-model command',
      'per-model settings',
    ],
  },
  // source: S75, S9, S16, S33, S45
  {
    label: 'Admin plane as MCP',
    cells: [
      'yes, with human approval for risky calls',
      'none found',
      'none found; hosts MCP tools',
      'no',
      'none found',
    ],
  },
  // source: S75, S85, S33
  {
    label: 'Memory bundled',
    cells: [
      'Hindsight, shared and private banks',
      'none found',
      'none found; document chat',
      'no',
      'none found',
    ],
  },
  // source: S75, S8, S20, S33, S48
  {
    label: 'Agent bundled',
    cells: [
      'Hermes, plus pi opt-in, with approvals',
      'no; wires external CLIs',
      'Bionic (closed)',
      'no',
      'no; GAIA is a separate project',
    ],
  },
  // source: S75, S20, S33, S45, S46
  {
    label: 'Voice + images, one API',
    cells: [
      'STT, TTS, images, realtime',
      'none found',
      'transcription via Bionic',
      'optional unified container',
      'yes',
    ],
  },
  // source: S74, S2, S21, S33, S83, S44, S45
  {
    label: 'Strix Halo + NPU',
    cells: [
      'ROCm or Vulkan, NPU via FastFlowLM',
      'ROCm listed; NPU not found',
      'ROCm or Vulkan; NPU not found',
      'bring your own server; no NPU',
      'ROCm + NPU',
    ],
  },
  // source: S74, S3, S5, S6, S18, S19, S33, S45, S46
  {
    label: 'Licence · telemetry',
    cells: [
      'Apache-2.0 · none; console checks updates',
      'MIT · none locally',
      'closed · update checks',
      'MIT · none found',
      'Apache-2.0 · none',
    ],
  },
];

export const COMPARE_NOTE =
  'From each project\'s published documentation as of 2026-11-01. "None found" means we looked and did not find it. Lemonade is also AMD-first; the difference is the slot and profile layer.';

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is hal0?',
    a: 'An open-source, self-hosted AI inference platform for Linux. It runs chat, embedding, rerank, speech and image models in named slots behind one OpenAI-compatible API, with a web console, a chat UI, agents, MCP servers and a memory engine. Apache-2.0.',
  },
  {
    q: 'Do I need a Strix Halo machine?',
    a: 'No. hal0 is built and benchmarked on the Ryzen AI Max+ 395 first, and it runs on other Linux boxes with an AMD GPU, an NVIDIA GPU (experimental) or only a CPU. Linux x86_64 with systemd and podman is the hard requirement.',
  },
  {
    q: 'Is hal0 an Ollama alternative?',
    a: 'Partly. Both serve local models over an OpenAI-style API. hal0 adds slots that clients address by name, reusable profiles, a console, agents, MCP servers and memory. If you want one binary, or you run macOS or Windows, Ollama is the simpler choice.',
  },
  {
    q: 'Can I run several models at once?',
    a: 'Yes. Each slot is its own container, and how many stay resident depends on your memory pool. hal0 checks fit before loading and evicts by priority under pressure. Image generation borrows the GPU while it renders, pausing GPU chat slots.',
  },
  {
    q: 'Does my data leave the machine?',
    a: 'Inference, chat history, uploaded documents and memory stay on the box unless you connect an upstream. No telemetry, no account. hal0 pulls models and runner images when you ask and checks for updates while the console is open.',
  },
  {
    q: 'Is the API OpenAI-compatible?',
    a: 'Yes: /v1/chat/completions, /v1/embeddings, /v1/rerank, /v1/audio/speech, /v1/audio/transcriptions, /v1/images/generations and a realtime WebSocket. Any OpenAI client works; use a slot name as the model.',
  },
  {
    q: 'Which GPUs and NPUs work?',
    a: 'AMD Strix Halo iGPU on ROCm or Vulkan, plus the XDNA NPU through FastFlowLM and, on the nightlies, through ggml-xdna, which runs any GGUF on the NPU. AMD Radeon RX 7000 on the same runner. NVIDIA through an opt-in CUDA runner, experimental. CPU-only for small models.',
  },
];
