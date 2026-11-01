/**
 * Demo state for the landing page's slot board.
 *
 * Ports, profiles and context windows are the product's seeds
 * (installer/etc-hal0/slots/*.toml, src/hal0/config/data/seed_profiles.toml).
 * The `coding` and `comfyui` profiles set no window, so those cards show none.
 * Device is a per-slot choice and the seeds default to ROCm; the demo mixes ROCm
 * and Vulkan to show that the choice is per slot.
 *
 * Model names are real: hal0's curated catalogue (src/hal0/registry/curated.py,
 * src/hal0/comfyui/catalog.py) or public GGUF repos named in the note, checked
 * on huggingface.co on 2026-11-01. Sizes use the dashboard's unit (GiB, labelled
 * GB) so the board and its screenshots agree: 17.56 GB on disk reads 16.4 here.
 *
 * Deliberately no tok/s or latency: nothing on a static page is measuring
 * anything, and the only published numbers are the dated /benchmarks sweep.
 */
export type BoardModel = { name: string; gb: number; note: string };

export type BoardSlot = {
  name: 'agent' | 'coder' | 'embed' | 'img';
  port: number;
  device: 'rocm' | 'vulkan';
  state: 'serving' | 'ready';
  profile: string;
  ctx?: string;
  models: BoardModel[];
};

const QWEN3_30B: BoardModel = {
  name: 'Qwen3 30B A3B (Q4_K_M)',
  gb: 17.3,
  note: 'Hugging Face · unsloth/Qwen3-30B-A3B-GGUF',
};

export const BOARD_SLOTS: BoardSlot[] = [
  {
    name: 'agent',
    port: 8081,
    device: 'rocm',
    state: 'serving',
    profile: 'agent',
    ctx: '64k',
    models: [
      { name: 'Qwen3.8 27B (UD Q4_K_XL)', gb: 16.4, note: 'hal0 default · vision · tool calling' },
      { name: 'LFM2.5 2.6B (Q8_0)', gb: 2.7, note: 'seeded for brain · tool calling' },
      QWEN3_30B,
    ],
  },
  {
    name: 'coder',
    port: 8082,
    device: 'vulkan',
    state: 'ready',
    profile: 'coding',
    models: [
      { name: 'Qwen3.5 9B (Q8_0)', gb: 8.9, note: 'Hugging Face · unsloth/Qwen3.5-9B-GGUF' },
      QWEN3_30B,
      { name: 'Qwen3.5 0.8B (UD Q4_K_XL)', gb: 0.5, note: 'hal0 catalogue · small and quick' },
    ],
  },
  {
    name: 'embed',
    port: 8083,
    device: 'vulkan',
    state: 'ready',
    profile: 'embedding',
    ctx: '4k',
    models: [
      {
        name: 'Qwen3 Embedding 0.6B (Q8_0)',
        gb: 0.6,
        note: 'feeds Open WebUI document search and memory',
      },
    ],
  },
  {
    name: 'img',
    port: 8188,
    device: 'rocm',
    state: 'ready',
    profile: 'comfyui',
    models: [{ name: 'SDXL Turbo · ComfyUI', gb: 6.9, note: 'POST /v1/images/generations' }],
  },
];

export const BOARD_CLIENTS: { name: string; target: string }[] = [
  { name: 'Open WebUI', target: 'agent, coder' },
  { name: 'Hermes', target: 'hal0/agent' },
  { name: 'pi', target: 'agent' },
  { name: 'Hindsight', target: 'hal0/memory' },
];

/** What `GET /v1/models` answers on the demo box. It never changes on a swap. */
export const BOARD_MODEL_IDS = ['agent', 'coder', 'brain', 'utility'];
