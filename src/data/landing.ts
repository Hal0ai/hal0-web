/**
 * Copy and structured data for the landing page's sections.
 *
 * The page is written for someone setting up a first local AI server: plain
 * words first, product vocabulary only where a term is introduced, and the
 * technical layer left to the docs, the forum and the "Want the details?" band.
 *
 * Every sentence traces to the hal0 repository at its latest tagged release
 * (CHANGELOG.md, README.md, docs/getting-started/beginners-guide.mdx and the
 * pages it links). Standing limits on what may be said:
 *   - a fresh install seeds its slots empty apart from one small helper model;
 *   - how many models stay loaded depends on memory, and a slot reloads when
 *     its model changes;
 *   - a render takes the graphics chip, so chat models on it step aside;
 *   - the bundled agents cannot call an MCP server the user installed;
 *   - the dashboard, the chat app and the image editor have no sign-in by
 *     default;
 *   - nothing is claimed that is not in a tagged release.
 *
 * FAQ answers stay plain text because the same strings feed the FAQPage schema.
 */

/** The hero picture: five jobs, each with its own slot. `by` is who is asking. */
export const HERO_TEAM: { icon: string; job: string; what: string; by: string }[] = [
  { icon: 'lucide:message-circle', job: 'Chat', what: 'your everyday assistant', by: 'Open WebUI' },
  { icon: 'lucide:code', job: 'Code', what: 'help inside your editor', by: 'your editor' },
  { icon: 'lucide:brain', job: 'Memory', what: 'remembers between chats', by: 'Hermes' },
  { icon: 'lucide:file-search', job: 'Documents', what: 'searches your files', by: 'Open WebUI' },
  { icon: 'lucide:mic', job: 'Voice', what: 'listens and speaks', by: 'Open WebUI' },
];

export const USES: { icon: string; title: string; body: string }[] = [
  {
    icon: 'lucide:message-circle',
    title: 'Chat',
    body: 'A full chat app opens in your browser, on any device on your home network.',
  },
  {
    icon: 'lucide:code',
    title: 'Code',
    body: 'Point your editor or coding assistant at your own box instead of a cloud service.',
  },
  {
    icon: 'lucide:bot',
    title: 'Agents',
    body: 'Hand a task to an agent that can use tools and work in steps. Risky actions wait for your OK.',
  },
  {
    icon: 'lucide:image',
    title: 'Images',
    body: 'Describe a picture and it is generated at home, on a supported AMD graphics chip.',
  },
  {
    icon: 'lucide:mic',
    title: 'Voice',
    body: 'Speech to text and text to speech, without sending audio anywhere.',
  },
];

export const SLOT_WINS: { title: string; body: string }[] = [
  {
    title: 'Nothing to juggle',
    body: 'Give each slot a model once. It stays loaded, so you never unload one thing to use another.',
  },
  {
    title: 'The right model for each job',
    body: 'A small quick one for everyday questions, a bigger one for hard problems, a specialist for code. Each has its own settings.',
  },
  {
    title: 'Upgrade without rewiring',
    body: 'A better model came out? Pick it from the slot’s menu. Your apps talk to the slot, so they carry on as before.',
  },
];

export const SLOT_NOTE =
  'How many models fit at once depends on your machine’s memory. hal0 checks before it loads anything, and a slot reloads for a moment when you change its model.';

export const WIRED: { icon: string; name: string; product: string; body: string }[] = [
  {
    icon: 'lucide:message-circle',
    name: 'The chat app',
    product: 'Open WebUI',
    body: 'Shows your chat slots and your agent in its model menu. Voice, document search and image generation connect as soon as those slots have a model.',
  },
  {
    icon: 'lucide:bot',
    name: 'The agent',
    product: 'Hermes',
    body: 'Uses whichever model sits in your agent slot, shares the same memory, and asks before it does anything risky.',
  },
  {
    icon: 'lucide:brain',
    name: 'The memory',
    product: 'Hindsight',
    body: 'One memory for the chat app and the agents. What one of them learns, the others can use.',
  },
  {
    icon: 'lucide:plug',
    name: 'Your own tools',
    product: 'anything that speaks the OpenAI API',
    body: 'One address for everything. Use a slot’s name where an app asks for a model.',
  },
];

export const AGENT_POINTS: { term: string; text: string }[] = [
  {
    term: 'It uses the model you choose.',
    text: 'Hermes runs on whichever model you put in the agent slot. Change the model and the agent uses the new one.',
  },
  {
    term: 'It asks first.',
    text: 'Actions marked as risky wait in the dashboard until you approve or deny them.',
  },
  {
    term: 'It has a task board.',
    text: 'Queue work on the Operator Board, watch it move, and step in when it asks.',
  },
  {
    term: 'It takes work from your other tools.',
    text: 'A coding assistant on your laptop, such as Claude Code, can hand Hermes a task and get the result back, using a key you create and can revoke.',
  },
];

export const AGENT_NOTE =
  'Treat the agent like someone you have given the keys to the box. Its terminal tool is off unless you turn it on, and the security notes say what it can reach.';

export const MEMORY_POINTS: { term: string; text: string }[] = [
  {
    term: 'Shared where it helps.',
    text: 'Your chat app and your agents use one memory, with a private notebook for each agent.',
  },
  {
    term: 'Yours to read and edit.',
    text: 'Every remembered fact is on a page you can search, correct or delete.',
  },
  {
    term: 'Stored at home.',
    text: 'The memory lives on your box, beside the models that use it.',
  },
];

export const MEMORY_NOTE =
  'Memory uses one of your chat models to pick out the facts, so it starts working once a chat slot has a model.';

export const PRIVACY_FACTS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'lucide:house',
    title: 'It runs at home',
    body: 'The models run on your machine. Your chats, files and voice are processed there.',
  },
  {
    icon: 'lucide:user-x',
    title: 'No account',
    body: 'Nothing to sign up for and no licence to buy. hal0 is free and open source.',
  },
  {
    icon: 'lucide:eye-off',
    title: 'No tracking',
    body: 'hal0 sends no usage data and no crash reports.',
  },
  {
    icon: 'lucide:cloud-off',
    title: 'Online only when you choose',
    body: 'It downloads models and updates when you ask, and looks for new releases while the dashboard is open. A cloud model is used only if you add one yourself.',
  },
];

export const PRIVACY_NOTE =
  'Out of the box the dashboard, the chat app and the image editor have no password, so anyone on your home network can open them. Keep the box off the public internet. You can add a sign-in for the dashboard and the API; the guide also covers the other two.';

export const MODEL_KINDS: { title: string; body: string; examples: string }[] = [
  {
    title: 'Chat and coding models',
    body: 'Search Hugging Face from the dashboard and download what you like. hal0 marks each model fits, tight or won’t fit for your machine.',
    examples: 'Qwen · Gemma · other models published as GGUF',
  },
  {
    title: 'Images and speech',
    body: 'An image catalogue with a recommended starter for your hardware, plus speech-to-text and text-to-speech models.',
    examples: 'SDXL · Stable Diffusion 1.5 · Qwen-Image · Whisper · Kokoro',
  },
  {
    title: 'A cloud model, if you want one',
    body: 'Add a provider and tick the models you allow. They appear beside your local ones, at the same address.',
    examples: 'OpenRouter · OpenAI · Anthropic · any OpenAI-compatible service',
  },
];

/** A dashboard capture placed in a section. `name` is the file stem in public/screenshots/. */
export type LandingShot = { name: string; alt: string; caption: string };

/**
 * The captures beside the copy. Each must carry no performance figures
 * ("none" in src/data/screenshots.json): they sit next to claims, not in the tour.
 */
export const SHOT_CONNECTED: LandingShot = {
  name: 'services-page',
  alt: 'The Services page of the hal0 dashboard: Open WebUI, ComfyUI, Hermes and Hindsight each shown as running, with Open WebUI’s chat, voice, documents, images, agents and MCP connections marked on',
  caption: 'The Services page on a running box: chat app, image engine, agent and memory, all up and already connected.',
};

export const SHOT_MEMORY: LandingShot = {
  name: 'closeup-memory-health',
  alt: 'The Memory page of the hal0 dashboard on its Health tab, reading "Nothing needs attention", with the memory engine and its two banks listed below',
  caption: 'The Memory page tells you in a sentence whether anything needs you.',
};

export const SHOT_MODELS: LandingShot = {
  name: 'closeup-model-catalog-rows',
  alt: 'The model catalogue in the hal0 dashboard: chat, coding, embedding and speech models listed with their sizes and the slot each one is loaded in, with search and filters above',
  caption: 'The model catalogue: what is in use, what is installed and what you can add.',
};

export type TourStop = {
  key: string;
  label: string;
  title: string;
  body: string;
  points: string[];
  link: { label: string; href: string };
  shot: string;
  alt: string;
};

/**
 * The dashboard tour. Several of these captures carry sample readings
 * ("illustrative" in the manifest), which is why the tour sits away from the
 * benchmark figures and ends with TOUR_NOTE.
 */
export const TOUR: TourStop[] = [
  {
    key: 'overview',
    label: 'Overview',
    title: 'One page that tells you how the box is doing',
    body: 'The dashboard opens on a briefing: what is running, what needs you, and who is working.',
    points: [
      'A memory bar shows which model is using what',
      'Anything waiting for your approval is at the top',
      'Agents and the tasks handed to them are listed beside it',
    ],
    link: { label: 'Tour the dashboard', href: '/docs/guides/dashboard-and-settings/' },
    shot: 'dashboard-overview',
    alt: 'The Overview page of the hal0 dashboard: a memory bar split by model, an approval waiting in the Needs-you inbox, a chart and table of what each slot is serving, and the Agents card with delegated tasks',
  },
  {
    key: 'slots',
    label: 'Slots',
    title: 'Every slot, with its model on a menu',
    body: 'Each slot is a card. Pick its model from the menu, start or stop it, and see at a glance which ones are answering.',
    points: [
      'Change a slot’s model without touching your apps',
      'Each entry in the menu says whether it fits this machine',
      'A rail down the side lists every slot by the chip it runs on',
    ],
    link: { label: 'Manage slots', href: '/docs/guides/manage-slots/' },
    shot: 'slots-inference',
    alt: 'The Slots page of the hal0 dashboard: gauges across the top, a memory bar, slot cards each with a model menu, and a rail listing every slot by device',
  },
  {
    key: 'agents',
    label: 'Agents',
    title: 'A task board for your agent',
    body: 'The Operator Board is where work for Hermes is queued, picked up and finished, with a clear flag when a task is waiting on you.',
    points: [
      'Queue tasks and watch them move across the board',
      'Blocked tasks are called out at the top',
      'Pi, a coding agent for the terminal, is one command to add',
    ],
    link: { label: 'The Operator Board', href: '/docs/guides/operator-board/' },
    shot: 'operator-board',
    alt: 'The Operator Board in the hal0 dashboard: a kanban with Triage, To-do, Scheduled and Ready columns holding task cards for the Hermes agent',
  },
  {
    key: 'memory',
    label: 'Memory',
    title: 'Read what it remembers',
    body: 'The Memory page lists the facts hal0 has kept, where each came from, and when. Search them, add your own, or remove what should not be there.',
    points: [
      'Filter by kind, by date or by tag',
      'Ask a question across everything it knows',
      'A health tab says whether anything needs attention',
    ],
    link: { label: 'The Memory page', href: '/docs/guides/memory-workspace/' },
    shot: 'memory-bank',
    alt: 'The Memory page of the hal0 dashboard on its Facts tab: a memory bank with its source documents, a filterable list of facts, an activity timeline and a tag map',
  },
  {
    key: 'images',
    label: 'Images',
    title: 'Pick an image model that fits',
    body: 'The image catalogue lists what you can install, with a meter that shows how each model fits your machine before you download it.',
    points: [
      'A recommended starter for your hardware',
      'Generate from the dashboard or from the chat app',
      'The full ComfyUI editor is there for custom workflows',
    ],
    link: { label: 'Generate images', href: '/docs/guides/generate-images/' },
    shot: 'models-image',
    alt: 'The image model catalogue in the hal0 dashboard: installed and available image models with their sizes, and a meter showing how the selected one fits this machine’s memory',
  },
  {
    key: 'stacks',
    label: 'Stacks',
    title: 'Save the whole setup as a stack',
    body: 'A stack bundles a set of slots with their settings and models. Apply one and the box switches to that setup in a single step.',
    points: [
      'Keep one setup for everyday use and another for a project',
      'Export a stack to move it to another machine',
      'See which models a stack still needs',
    ],
    link: { label: 'About stacks', href: '/docs/concepts/stacks/' },
    shot: 'stacks-tab',
    alt: 'The Stacks tab of the hal0 dashboard showing the active "Daily driver" stack with its chat, coding, embedding and image slots and the model in each',
  },
];

export const TOUR_NOTE =
  'These captures show the dashboard on sample data. The readings in them are not measurements.';

export const HARDWARE: { tier: string; name: string; body: string; best?: true }[] = [
  {
    tier: 'Built for',
    name: 'AMD Strix Halo',
    body: 'Ryzen AI Max+ 395 mini PCs with up to 128 GB of shared memory: room for several large models at once, plus a low-power AI chip for small ones.',
    best: true,
  },
  {
    tier: 'Also supported',
    name: 'Other AMD machines',
    body: 'Ryzen AI Max 385 and 390 with 64 GB, and Radeon RX 7000 graphics cards with 16 to 24 GB.',
  },
  {
    tier: 'Works too',
    name: 'NVIDIA or no GPU',
    body: 'NVIDIA RTX cards are experimental. With no graphics chip it runs small models on the processor.',
  },
];

export const STEPS: { title: string; body: string }[] = [
  {
    title: 'Run the installer',
    body: 'One line in a terminal. It checks your machine and sets everything up. A first install takes several minutes, mostly downloads.',
  },
  {
    title: 'Open the dashboard',
    body: 'From any device on your network. A small model is already loaded, so you can say hello straight away.',
  },
  {
    title: 'Choose your models',
    body: 'Give each slot a model. hal0 shows what fits your machine, and the chat app and agent start using them.',
  },
];

export const DETAILS: { icon: string; title: string; body: string; link: string; href: string }[] = [
  {
    icon: 'lucide:terminal',
    title: 'One API',
    body: 'OpenAI-compatible endpoints for chat, embeddings, rerank, speech, transcription and images on a single address.',
    link: 'API reference',
    href: '/docs/reference/api/openai-compat/',
  },
  {
    icon: 'lucide:cable',
    title: 'MCP built in',
    body: 'hal0’s agent, memory and admin tools are MCP servers, so Claude Code, Codex and other MCP clients can connect with a key you can revoke. You can install extra MCP servers too; the built-in agents cannot call those yet.',
    link: 'Connect over MCP',
    href: '/docs/guides/connect-mcp/',
  },
  {
    icon: 'lucide:gauge',
    title: 'Benchmarks',
    body: 'Decode and prefill speeds per model, measured on the reference machine, with the date and build of the sweep.',
    link: 'See the leaderboard',
    href: '/benchmarks/',
  },
  {
    icon: 'lucide:boxes',
    title: 'How it is built',
    body: 'One container per slot, llama.cpp, FastFlowLM and ComfyUI underneath, and an arbiter that keeps jobs on the graphics chip from colliding.',
    link: 'Architecture',
    href: '/docs/concepts/architecture/',
  },
];

/** The plain comparison: [what, a typical local AI app, hal0]. The named table sits behind a disclosure below it. */
export const PLAIN_COMPARE: [string, string, string][] = [
  ['Models ready at once', 'Usually one, loaded when you ask', 'Several, each in its own slot'],
  ['Switching between jobs', 'Wait while one unloads and the next loads', 'Already loaded'],
  ['A chat app', 'Install and connect it yourself', 'Included and connected'],
  ['An agent with memory', 'Separate projects to wire together', 'Included, sharing one memory'],
  ['Trying a new model', 'Change the setting in every app', 'Pick it from the slot’s menu'],
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
    a: 'hal0 is free, open-source software that turns a Linux computer into a private AI server for your home. It runs chat, coding, speech and image models side by side in named slots, and it comes with a chat app, an agent and a memory that are already connected. Other apps reach it through an OpenAI-compatible API.',
  },
  {
    q: 'Do I need to be technical?',
    a: 'You need to be comfortable pasting one command into a terminal on a Linux machine. After that everything is in the dashboard, and the beginner’s guide explains each term as it comes up.',
  },
  {
    q: 'Do I need a Strix Halo machine?',
    a: 'No. hal0 is built for Strix Halo first, and it also runs on other AMD graphics hardware, on NVIDIA cards (experimental) and on a plain processor for small models. It needs a 64-bit Intel or AMD computer running Linux.',
  },
  {
    q: 'Can I run several models at once?',
    a: 'Yes, that is what slots are for. Each slot keeps its own model loaded, and how many fit depends on your machine’s memory. hal0 checks the fit before it loads anything. One exception: while an image is being generated, the chat models on the graphics chip step aside and come back a few seconds after it finishes.',
  },
  {
    q: 'Is it really private?',
    a: 'The models run on your machine, and hal0 needs no account and sends no usage data. It goes online to download models and updates when you ask, and it sends a request to a cloud service only if you add a provider yourself.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. hal0 is open source under the Apache-2.0 licence. You pay for the hardware and the electricity, and there is no bill per message.',
  },
  {
    q: 'Is hal0 an Ollama alternative?',
    a: 'Partly. Both run local models behind an OpenAI-style API. hal0 adds named slots that apps address, a dashboard, a chat app, an agent and a shared memory, all connected when you install it. If you want a single small program, or you use macOS or Windows, Ollama is the simpler choice.',
  },
  {
    q: 'Can I still use a cloud model sometimes?',
    a: 'Yes. Add a provider such as OpenRouter or OpenAI, choose which of its models to allow, and your apps reach them through the same address as your local models.',
  },
  {
    q: 'Is the API OpenAI-compatible?',
    a: 'Yes: /v1/chat/completions, /v1/embeddings, /v1/rerank, /v1/audio/speech, /v1/audio/transcriptions, /v1/images/generations and a realtime WebSocket. Any OpenAI client works; use a slot name as the model.',
  },
  {
    q: 'Which GPUs and NPUs work?',
    a: 'AMD Strix Halo graphics on ROCm or Vulkan, and its NPU through FastFlowLM or the optional xdna runner. AMD Radeon RX 7000 cards on the same runners. NVIDIA RTX cards through an opt-in CUDA runner, which is experimental. With no GPU, small models run on the processor.',
  },
  {
    q: 'What if I get stuck?',
    a: 'Ask on the forum. The documentation lives there too, starting with a beginner’s guide that goes from an empty machine to a working setup.',
  },
];
