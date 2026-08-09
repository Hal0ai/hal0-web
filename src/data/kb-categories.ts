/**
 * Single source of truth for the six /kb landing categories — consumed by
 * src/pages/kb/index.astro (card rendering) and scripts/test/kb.test.mjs
 * (asserts every src/content/docs/kb/**\/*.mdx maps to one of these slugs
 * and that its frontmatter `kbCategory` matches the category `label`).
 *
 * `slug` must equal the category's directory name under
 * src/content/docs/kb/ AND the matching sidebar group's `directory` in
 * astro.config.mjs. The four planned page titles per category are lifted
 * from the comp's KB array (docs/design/2026-08-09-community-comps/04
 * Blog and KB.html) so the card previews real planned IA, not placeholder
 * copy — only the first page per category is written yet (`href` set);
 * the rest are honest "planned" list items with no link (see kb/index.astro).
 */
export interface KbPage {
  title: string;
  href?: string;
}

export interface KbCategory {
  slug: string;
  label: string;
  icon: string;
  blurb: string;
  pages: KbPage[];
}

export const KB_CATEGORIES: KbCategory[] = [
  {
    slug: 'getting-started',
    label: 'getting started',
    icon: 'lucide:rocket',
    blurb: 'Install, first slot, first request. The path from a bare box to a working /v1/ endpoint.',
    pages: [
      { title: 'Your first slot', href: '/kb/getting-started/your-first-slot/' },
      { title: 'Talking to /v1/chat/completions' },
      { title: 'Picking a loadout' },
      { title: 'Install on a bare Linux box' },
    ],
  },
  {
    slug: 'hardware-notes',
    label: 'hardware notes',
    icon: 'lucide:cpu',
    blurb: 'What each machine can actually hold, and where the wall is.',
    pages: [
      { title: 'Unified memory is not VRAM', href: '/kb/hardware-notes/unified-memory-is-not-vram/' },
      { title: 'Strix Halo: 128 GB, ~96 GB addressable' },
      { title: 'HX 370 on 32 GB' },
      { title: 'Thermals and why decode drifts' },
    ],
  },
  {
    slug: 'runtime-and-backends',
    label: 'runtime & backends',
    icon: 'lucide:layers',
    blurb: 'ROCm, Vulkan, the NPU lane, and how to tell which one you are on.',
    pages: [
      { title: 'ROCm vs vulkan_radv', href: '/kb/runtime-and-backends/rocm-vs-vulkan-radv/' },
      { title: 'Building the rocmfp4 fork' },
      { title: 'XDNA and FastFlowLM today' },
      { title: 'When to pin a container digest' },
    ],
  },
  {
    slug: 'models-and-quants',
    label: 'models & quants',
    icon: 'lucide:boxes',
    blurb: 'Choosing a model that fits, and a quant that does not ruin it.',
    pages: [
      { title: 'Reading a quant name', href: '/kb/models-and-quants/reading-a-quant-name/' },
      { title: 'q4 vs q8 KV cache' },
      { title: 'MoE models on unified memory' },
      { title: 'Draft models for speculative pairs' },
    ],
  },
  {
    slug: 'operating-hal0',
    label: 'operating hal0',
    icon: 'lucide:activity',
    blurb: 'Running the box day to day: slots, eviction, logs, upgrades.',
    pages: [
      { title: 'Reading the memory map', href: '/kb/operating-hal0/reading-the-memory-map/' },
      { title: 'Co-resident slots without eviction' },
      { title: 'Upgrading without downtime' },
      { title: 'What the journal ribbon is telling you' },
    ],
  },
  {
    slug: 'tool-reviews',
    label: 'tool reviews',
    icon: 'lucide:plug-zap',
    blurb: 'Honest notes on the things people plug into hal0.',
    pages: [
      { title: 'OpenWebUI as the chat tab', href: '/kb/tool-reviews/openwebui-as-the-chat-tab/' },
      { title: 'Continue.dev against a coder slot' },
      { title: 'MCP servers worth running' },
    ],
  },
];
