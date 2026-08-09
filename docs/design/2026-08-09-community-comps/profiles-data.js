/* hal0-profiles — shared profile TOMLs. Each profile is a versioned config
 * submitted by PR; `runs` names the benchmark cells produced by this exact
 * config, which is the join between the two repos. Model ids match the roster. */
window.PROFILES = [
  {
    slug: "strix-mtp-max", intent: "chat", v: "4", updated: "2026-06-19", author: "hal0-ci", first: true,
    title: "Speculative decode, everything on",
    summary: "draft-mtp with an f16 KV cache. The fastest tokens this box produces, at the cost of 19 GB resident and no room for a second big slot.",
    flags: "-ngl 99 -c 2048 -fa 1 -ctk f16 -ctv f16 --parallel 1 -b 512 --draft-max 4 --draft-min 1 --mtp on",
    models: ["chadrock3-6-35b-uncensored-mtp-strix-lean", "chadrock-35b-ace-saber", "qwen3.6-35b-a3b-crown-halo-mtp-dynamic"],
    dec: 102.1, downloads: 1240, lane: "rocm",
    history: [
      { v: "4", date: "2026-06-19", note: "pin build b9219 — draft-mtp accept regressed on b9101" },
      { v: "3", date: "2026-05-22", note: "--draft-max 4 (was 8); shorter drafts accept more often here" },
      { v: "2", date: "2026-04-30", note: "f16 KV cache — q4 cache cost 9 % accept on this pair" },
      { v: "1", date: "2026-04-11", note: "initial" },
    ],
  },
  {
    slug: "coder-next-40b", intent: "coding", v: "2", updated: "2026-06-14", author: "lovedheart",
    title: "40B MoE coder, editor-attached",
    summary: "Sized for autocomplete rather than long generations: 28.5 GB resident, prefill above 750 tok/s so a whole file lands fast.",
    flags: "-ngl 99 -c 8192 -fa 1 -ctk q4_0 -ctv q4_0 --parallel 2 -b 1024",
    models: ["qwen3-coder-next-reap-40b-a3b-q4kxl", "qwen3-coder-reap-25b-a3b-q5km"],
    dec: 26.8, downloads: 903, lane: "rocm",
    history: [
      { v: "2", date: "2026-06-14", note: "-b 1024 and --parallel 2 — prefill +6 %, editor feels immediate" },
      { v: "1", date: "2026-05-09", note: "initial" },
    ],
  },
  {
    slug: "lean-9b-daily", intent: "chat", v: "6", updated: "2026-06-18", author: "kyuz0",
    title: "The everyday 9B",
    summary: "6 GB resident, leaves the pool free for embed, stt and image gen. What most boxes should run on the primary slot.",
    flags: "-ngl 99 -c 16384 -fa 1 -ctk q4_0 -ctv q4_0 --parallel 1 -b 512",
    models: ["qwen3.5-9b-q4kxl", "qwen3.5-9b-deepseek-v4-flash-mtp"],
    dec: 33.0, downloads: 2117, lane: "rocm",
    history: [
      { v: "6", date: "2026-06-18", note: "-c 16384 — fits alongside embed and stt on 96 GB GTT" },
      { v: "5", date: "2026-05-30", note: "drop --mlock; ZFS ARC was fighting it" },
      { v: "4", date: "2026-05-12", note: "q4_0 KV cache, 1.4 GB back" },
      { v: "3", date: "2026-04-27", note: "-fa 1" },
      { v: "2", date: "2026-04-15", note: "raise -ngl to 99" },
      { v: "1", date: "2026-03-28", note: "initial" },
    ],
  },
  {
    slug: "agent-27b-tools", intent: "agent", v: "3", updated: "2026-06-17", author: "jcbtc",
    title: "Tool-calling agent slot",
    summary: "q8 KV cache because tool traces are long and lossy cache breaks JSON. 79.8 % accept on draft-mtp.",
    flags: "-ngl 99 -c 8192 -fa 1 -ctk q8_0 -ctv q8_0 --parallel 1 -b 512 --draft-max 4 --mtp on",
    models: ["chadrock3.6-27b-pi-agent-rocmfp4-mtp", "chadrock3-6-27b-pi-agent-mtp-rocmfp4-strix-lean"],
    dec: 35.5, downloads: 618, lane: "rocm",
    history: [
      { v: "3", date: "2026-06-17", note: "q8 KV cache — tool traces stopped producing malformed JSON" },
      { v: "2", date: "2026-05-19", note: "-c 8192 for longer tool transcripts" },
      { v: "1", date: "2026-05-02", note: "initial" },
    ],
  },
  {
    slug: "vision-27b", intent: "vision", v: "2", updated: "2026-06-11", author: "nx-void",
    title: "Screenshots and PDFs",
    summary: "Vision projector loaded, 16.9 GB resident. Decode is slow — this slot reads, it does not chat.",
    flags: "-ngl 99 -c 4096 -fa 1 -ctk q4_0 -ctv q4_0 --mmproj mmproj-f16.gguf --parallel 1",
    models: ["qwen3.6-27b-heretic-q4km"],
    dec: 11.6, downloads: 274, lane: "rocm",
    history: [
      { v: "2", date: "2026-06-11", note: "mmproj at f16 — q8 projector blurred small text in screenshots" },
      { v: "1", date: "2026-05-24", note: "initial" },
    ],
  },
  {
    slug: "tiny-draft-0.8b", intent: "draft", v: "1", updated: "2026-06-19", author: "hal0-ci", first: true,
    title: "Draft model for speculative pairs",
    summary: "0.6 GB. Not a chat model — the draft half of a speculative pair, pinned so the big model never waits on it.",
    flags: "-ngl 99 -c 2048 -fa 1 -ctk q4_0 --parallel 1 -b 256 --draft-p-min 0.6",
    models: ["qwen3.5-0.8b", "qwen3-zero-coder-v2-0.8b-f16"],
    dec: 169.8, downloads: 441, lane: "rocm",
    history: [{ v: "1", date: "2026-06-19", note: "initial — shipped with the june sweep" }],
  },
  {
    slug: "vulkan-fallback", intent: "chat", v: "2", updated: "2026-06-16", author: "lhl",
    title: "When ROCm will not build",
    summary: "vulkan_radv lane, same models. Roughly 18 % slower decode and 29 % slower prefill, but it starts on a stock kernel.",
    flags: "-ngl 99 -c 2048 -fa 1 -ctk q4_0 -ctv q4_0 --parallel 1 -b 512 --device Vulkan0",
    models: ["qwen3.6-35b-a3b-q4kxl", "gemma-4-26b-a4b-it-q4kxl"],
    dec: 37.8, downloads: 507, lane: "vulkan_radv",
    history: [
      { v: "2", date: "2026-06-16", note: "--device Vulkan0 — stops radv picking the wrong node in an LXC" },
      { v: "1", date: "2026-06-02", note: "initial" },
    ],
  },
  {
    slug: "kv-q8-longctx", intent: "moe", v: "3", updated: "2026-06-19", author: "kyuz0",
    title: "16k context on a 35B MoE",
    summary: "q8 KV cache trades 3 % decode for context that actually holds a repo map. 22.4 GB resident at 16k.",
    flags: "-ngl 99 -c 16384 -fa 1 -ctk q8_0 -ctv q8_0 --parallel 1 -b 1024",
    models: ["qwen3.6-35b-a3b-q4kxl", "gemma-4-26b-a4b-it-q4kxl"],
    dec: 46.1, downloads: 866, lane: "rocm",
    history: [
      { v: "3", date: "2026-06-19", note: "-c 16384 at q8 cache — 22.4 GB resident, 3 % decode given up" },
      { v: "2", date: "2026-05-31", note: "-b 1024" },
      { v: "1", date: "2026-05-10", note: "initial" },
    ],
  },
];

window.PROFILE_TOML = (p) => `# hal0 profile · ${p.slug}
schema = 1
intent = "${p.intent}"
slot   = "primary"

[runner]
kind      = "llama-server"
lane      = "${p.lane}"
min_build = "b9219"
image     = "ghcr.io/hal0ai/amd-strix-halo-toolboxes:rocm-7.2.4-rocmfp4-server"

[model]
id    = "${p.models[0]}"
quant = "q4_k_xl"

[args]
raw = "${p.flags}"

[requires]
gtt_gb    = ${Math.max(8, Math.round(p.dec > 90 ? 24 : 16))}
exclusive = false
`;
