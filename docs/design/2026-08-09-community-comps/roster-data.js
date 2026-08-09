/* hal0 bench corpus.
 * ROSTER rows are the real measured sweep (bench/build_data.py output,
 * ROSTER_DATE 2026-06-19, 26/26 measured). Everything the new API adds —
 * lanes, workloads, config variants, TTFT, telemetry, history, evals — is
 * derived here deterministically so the mockups have plausible cells to
 * render. Derived fields are marked `synthetic: true`. */

window.ROSTER_DATE = "2026-06-19";
window.HARDWARE = [
  ["SoC", "AMD Ryzen AI Max+ 395 — Strix Halo (Zen 5, 16C/28T)"],
  ["iGPU", "Radeon 8060S — RDNA 3.5, gfx1151 · Vulkan-capable"],
  ["NPU", "AMD XDNA — amdxdna driver"],
  ["Memory", "128 GB unified LPDDR5X · ~96 GB GTT · UMA"],
  ["Host", "Proxmox LXC · Ubuntu 24.04 · kernel 7.0.6"],
  ["Model store", "/mnt/ai-models · ZFS"],
];
window.BINARY = [
  ["hal0", "v0.5.0a1 · llama-server provider (OpenAI /v1/*)"],
  ["Container", "ghcr.io/hal0ai/amd-strix-halo-toolboxes:rocm-7.2.4-rocmfp4-server"],
  ["llama.cpp", "build b9219-1faa48eef · rocmfp4 fork (draft-mtp speculative)"],
  ["ROCm", "7.2.4"],
];

/* id, hfRepo, caps, params, kv, spec, gb, dec, pf, acc */
const R = [
  ["chadrock-35b-ace-saber", "jcbtc/chadrock-35b-ace-saber-rocmfp4-mtp", ["mtp", "vision"], "35B-A3B", "f16", "draft-mtp", 19.0, 100.5, 902.9, 83.1],
  ["chadrock3-6-35b-uncensored-mtp-strix-lean", "", ["mtp"], "35B MoE", "q4", "draft-mtp", 19.0, 102.1, 889.6, 86.0],
  ["qwen3.6-35b-a3b-crown-halo-mtp-dynamic", "jcbtc/qwen3.6-35b-a3b-crown-halo-mtp-dynamic", ["mtp", "vision"], "35B-A3B", "f16", "draft-mtp", 22.6, 84.4, 872.5, 90.9],
  ["qwopus3-5-4b-coder-mtp-q6-k", "", ["mtp"], "4B", "q4", "draft-mtp", 3.6, 85.0, 889.2, 76.7],
  ["qwen3-zero-coder-v2-0.8b-f16", "DavidAU/Qwen3-Zero-Coder-Reasoning-V2-0.8B-NEO-EX-GGUF", ["coding"], "0.8B", "q4", "none", 1.6, 76.3, 4827.2, null],
  ["qwen3.5-0.8b", "unsloth/Qwen3.5-0.8B-GGUF", [], "0.8B", "q4", "none", 0.6, 169.8, 6248.1, null],
  ["qwen3-coder-reap-25b-a3b-q5km", "bartowski/cerebras_Qwen3-Coder-REAP-25B-A3B-GGUF", ["coding"], "25B MoE", "q4", "none", 17.7, 54.7, 1367.6, null],
  ["qwen3.5-4b-q4kxl", "unsloth/Qwen3.5-4B-GGUF", [], "4B", "q4", "none", 2.9, 52.7, 1695.2, null],
  ["qwen3-4b-q4-k-m", "", [], "4B", "q4", "none", 2.5, 61.9, 1849.4, null],
  ["qwen3.5-9b-deepseek-v4-flash-mtp", "Jackrong/Qwen3.5-9B-DeepSeek-V4-Flash-MTP-GGUF", ["mtp"], "9B", "q4", "draft-mtp", 7.6, 51.3, 613.4, 69.7],
  ["qwen3.6-35b-a3b-q4kxl", "unsloth/Qwen3.6-35B-A3B-GGUF", [], "35B MoE", "q4", "none", 22.4, 46.1, 1299.8, null],
  ["qwopus3-5-9b-coder-mtp-q6-k", "", ["mtp"], "9B", "q4", "draft-mtp", 7.6, 44.6, 617.5, 56.0],
  ["gemma-4-26b-a4b-it-q4kxl", "unsloth/gemma-4-26B-A4B-it-GGUF", [], "26B MoE", "q4", "none", 17.1, 40.9, 1335.7, null],
  ["qwen3-coder-next-q4kxl", "unsloth/Qwen3-Coder-Next-GGUF", ["coding"], "—", "q4", "none", 49.6, 37.8, 716.0, null],
  ["chadrock3.6-27b-pi-agent-rocmfp4-mtp", "jcbtc/chadrock3.6-27b-pi-agent-rocmfp4-mtp", ["mtp", "tools"], "27B dense", "q8", "draft-mtp", 14.8, 35.5, 301.4, 79.8],
  ["chadrock3-6-27b-pi-agent-mtp-rocmfp4-strix-lean", "", ["mtp"], "27B", "q4", "draft-mtp", 14.8, 34.9, 307.7, 79.8],
  ["qwen3.5-9b-q4kxl", "unsloth/Qwen3.5-9B-GGUF", [], "9B", "q4", "none", 6.0, 33.0, 1044.7, null],
  ["qwopus3-6-27b-v2-mtp-bf16-to-rocmfp4-strix-lean", "", ["mtp"], "27B dense", "q4", "draft-mtp", 14.8, 31.6, 310.3, 70.3],
  ["qwen3-coder-next-reap-40b-a3b-q4kxl", "lovedheart/Qwen3-Coder-Next-REAP-40B-A3B-GGUF", ["coding"], "40B MoE", "q4", "none", 28.5, 26.8, 755.5, null],
  ["gemma-4-12B-agentic-fable5", "yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2-GGUF", ["tools"], "12B dense", "q4", "none", 7.4, 22.7, 688.5, null],
  ["gemma-4-12b-it", "unsloth/gemma-4-12b-it-GGUF", [], "12B", "q4", "none", 7.4, 22.7, 686.6, null],
  ["gemma4-v2-q4-k-m", "", [], "—", "q4", "none", 7.4, 22.6, 679.8, null],
  ["hermes-4-14b-q5km", "bartowski/NousResearch_Hermes-4-14B-GGUF", ["tools"], "14B", "q4", "none", 10.5, 20.3, 613.6, null],
  ["Qwopus3.6-27B-Coder-MTP", "Jackrong/Qwopus3.6-27B-Coder-MTP-GGUF", ["mtp", "tools"], "27B", "q4", "draft-mtp", 22.4, 19.8, 224.5, 60.5],
  ["qwen3.6-27b-heretic-q4km", "DavidAU/Qwen3.6-27B-Heretic-Uncensored-FINETUNE-NEO-CODE-Di-IMatrix-MAX-GGUF", ["vision", "coding"], "27B", "q4", "none", 16.9, 11.6, 294.7, null],
  ["qwen3.6-27b", "unsloth/Qwen3.6-27B-GGUF", ["reasoning"], "27B", "q4", "none", 20.0, 10.1, 299.6, null],
];

/* deterministic jitter so every reload renders the same numbers */
function h32(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }
const j = (s, spread) => 1 + (h32(s) - 0.5) * spread;

const LANES = { rocm: 1, vulkan_radv: 0.82, default: 0.94 };
const LANE_PF = { rocm: 1, vulkan_radv: 0.71, default: 0.93 };
const VARIANTS = { default: 1, b1024: 1.04, "kv-q8": 0.97, "mtp-off": 0.62 };
const DEPTHS = [512, 2048, 8192, 16384];
const WORKLOADS = ["tg", "pp", "chat", "batch", "embed", "rerank", "reuse"];
const EVAL_TASKS = ["tool-calling", "json-mode", "multi-turn", "code-edit", "retrieval"];

const RUNS = [];
R.forEach(([id, hf, caps, params, kv, spec, gb, dec, pf, acc]) => {
  Object.keys(LANES).forEach((lane) => {
    Object.keys(VARIANTS).forEach((variant) => {
      if (variant === "mtp-off" && spec === "none") return;
      if (lane !== "rocm" && variant !== "default") return;
      DEPTHS.forEach((depth) => {
        if (lane !== "rocm" && depth !== 2048) return;
        if (variant !== "default" && depth !== 2048) return;
        const k = id + lane + variant + depth;
        const depthPenalty = 1 - Math.log2(depth / 512) * 0.045;
        const d = dec * LANES[lane] * VARIANTS[variant] * depthPenalty * j(k, 0.04);
        const p = pf * LANE_PF[lane] * depthPenalty * j(k + "p", 0.05);
        const ttft = Math.round((depth / p) * 1000 + 60 * j(k + "t", 0.4));
        const temp = Math.round(68 + h32(k + "temp") * 17);
        RUNS.push({
          id: id + "@" + lane + "/" + variant + "/d" + depth,
          model: id, hf, caps, params, kv, spec, gb,
          lane, variant, depth, workload: "tg",
          dec: +d.toFixed(1), decSd: +(d * 0.017 * j(k + "sd", 0.6)).toFixed(2),
          pf: +p.toFixed(1),
          ttftP50: ttft, ttftP95: Math.round(ttft * (1.28 + h32(k + "95") * 0.2)),
          acc: spec === "none" || variant === "mtp-off" ? null : acc,
          reps: 3, vram: +(gb * 1.02 * j(k + "v", 0.02)).toFixed(1), gtt: +(gb + 2.2 * j(k + "g", 0.3)).toFixed(1),
          temp, watt: Math.round(46 + h32(k + "w") * 46), throttled: temp >= 83,
          exclusive: true, synthetic: true,
          history: [0, 1, 2, 3, 4, 5].map((n) => {
            const dip = h32(id) > 0.86 && n === 4 ? 0.81 : 1;
            return +(d * (0.94 + h32(k + "h" + n) * 0.09) * dip).toFixed(1);
          }),
        });
      });
    });
  });
});

window.BENCH = RUNS;
window.MODELS = R.map(([id, hf, caps, params, kv, spec, gb, dec, pf, acc]) => ({
  id, hf, caps, params, kv, spec, gb, dec, pf, acc,
  evals: acc == null && !caps.includes("tools") && !caps.includes("coding")
    ? null
    : EVAL_TASKS.map((t) => ({
        task: t,
        score: +Math.min(0.98, Math.max(0.12, (acc ? acc / 100 : 0.55) * (0.8 + h32(id + t) * 0.45))).toFixed(2),
      })),
}));
window.WORKLOADS = WORKLOADS;
window.DEPTHS = DEPTHS;
window.VARIANT_NAMES = Object.keys(VARIANTS);
window.LANE_NAMES = Object.keys(LANES);
window.EVAL_TASKS = EVAL_TASKS;

/* decode-speed buckets, carried over from the ModelRoster idiom */
window.bucket = (d) => (d >= 60 ? "fast" : d >= 25 ? "mid" : "slow");
