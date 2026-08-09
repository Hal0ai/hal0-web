/* hal0-bench-data — placeholder corpus shaped like the real merged JSON.
 * One object per run, exactly what a `hal0 bench --share` PR adds to
 * hal0-bench-data/runs/. Figures are plausible for the hardware, not measured. */
window.BENCH_RUNS = [
  // Qwen3-32B — dense 32B, q4_k_m ≈ 19.8 GB
  { id: "r-8841", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 9.4, ttft: 310, gb: 19.8, ctx: 8192, user: "kyuz0", date: "2026-07-31", profile: "qwen3-32b-rocm-longctx" },
  { id: "r-8839", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 8.1, ttft: 402, gb: 19.6, ctx: 8192, first: true, date: "2026-07-30" },
  { id: "r-8802", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q4_k_m", hw: "Ryzen AI Max 385", mem: "64 GB", runner: "llama.cpp b4771", backend: "vulkan", tps: 7.2, ttft: 560, gb: 19.6, ctx: 4096, user: "lhl", date: "2026-07-24" },
  { id: "r-8790", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q4_k_m", hw: "Radeon RX 7900 XTX", mem: "24 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 26.8, ttft: 140, gb: 19.8, ctx: 8192, user: "deadbeef7", date: "2026-07-22" },
  { id: "r-8771", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q4_k_m", hw: "EPYC 7402P", mem: "256 GB", runner: "llama.cpp b4780", backend: "cpu", tps: 2.1, ttft: 2410, gb: 20.1, ctx: 4096, user: "ratchet", date: "2026-07-19" },
  { id: "r-8768", model: "Qwen3-32B", family: "qwen3", size: "32B", quant: "q5_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 8.2, ttft: 330, gb: 23.4, ctx: 8192, user: "kyuz0", date: "2026-07-18" },

  // Qwen3-30B-A3B — MoE, 3B active
  { id: "r-8836", model: "Qwen3-30B-A3B", family: "qwen3", size: "30B-A3B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 48.6, ttft: 240, gb: 18.2, ctx: 16384, user: "kyuz0", date: "2026-07-30", profile: "qwen3-moe-coder" },
  { id: "r-8834", model: "Qwen3-30B-A3B", family: "qwen3", size: "30B-A3B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 44.2, ttft: 300, gb: 18.0, ctx: 16384, first: true, date: "2026-07-30" },
  { id: "r-8811", model: "Qwen3-30B-A3B", family: "qwen3", size: "30B-A3B", quant: "q4_k_m", hw: "Ryzen AI 9 HX 370", mem: "32 GB", runner: "llama.cpp b4771", backend: "vulkan", tps: 31.5, ttft: 520, gb: 18.0, ctx: 8192, user: "nx-void", date: "2026-07-26" },
  { id: "r-8805", model: "Qwen3-30B-A3B", family: "qwen3", size: "30B-A3B", quant: "q4_k_m", hw: "Radeon RX 7900 XTX", mem: "24 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 96.4, ttft: 95, gb: 18.2, ctx: 8192, user: "deadbeef7", date: "2026-07-25" },
  { id: "r-8798", model: "Qwen3-30B-A3B", family: "qwen3", size: "30B-A3B", quant: "q4_0", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "flm 0.4.2", backend: "npu", tps: 22.4, ttft: 610, gb: 16.8, ctx: 4096, user: "donutloop", date: "2026-07-23" },

  // GPT-OSS-20B
  { id: "r-8843", model: "GPT-OSS-20B", family: "gpt-oss", size: "20B", quant: "mxfp4", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 52.1, ttft: 210, gb: 12.4, ctx: 16384, user: "kyuz0", date: "2026-08-01" },
  { id: "r-8842", model: "GPT-OSS-20B", family: "gpt-oss", size: "20B", quant: "mxfp4", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 47.8, ttft: 265, gb: 12.3, ctx: 16384, first: true, date: "2026-08-01" },
  { id: "r-8820", model: "GPT-OSS-20B", family: "gpt-oss", size: "20B", quant: "mxfp4", hw: "Ryzen AI 9 HX 370", mem: "32 GB", runner: "llama.cpp b4771", backend: "vulkan", tps: 33.9, ttft: 470, gb: 12.3, ctx: 8192, user: "mrpotato", date: "2026-07-27" },
  { id: "r-8817", model: "GPT-OSS-20B", family: "gpt-oss", size: "20B", quant: "mxfp4", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "vllm 0.7.2", backend: "rocm", tps: 58.3, ttft: 180, gb: 14.9, ctx: 8192, user: "sirrus", date: "2026-07-27" },

  // Llama-3.3-70B
  { id: "r-8788", model: "Llama-3.3-70B", family: "llama", size: "70B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 4.6, ttft: 720, gb: 42.5, ctx: 8192, user: "lhl", date: "2026-07-21", profile: "llama70b-unified-mem" },
  { id: "r-8786", model: "Llama-3.3-70B", family: "llama", size: "70B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 4.1, ttft: 880, gb: 42.3, ctx: 8192, first: true, date: "2026-07-21" },
  { id: "r-8763", model: "Llama-3.3-70B", family: "llama", size: "70B", quant: "q4_k_m", hw: "EPYC 7402P", mem: "256 GB", runner: "llama.cpp b4780", backend: "cpu", tps: 1.2, ttft: 3900, gb: 43.1, ctx: 4096, user: "ratchet", date: "2026-07-16" },

  // Gemma3-12B
  { id: "r-8828", model: "Gemma3-12B", family: "gemma", size: "12B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 17.9, ttft: 260, gb: 8.6, ctx: 8192, user: "nx-void", date: "2026-07-29" },
  { id: "r-8826", model: "Gemma3-12B", family: "gemma", size: "12B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 15.4, ttft: 320, gb: 8.5, ctx: 8192, first: true, date: "2026-07-29" },
  { id: "r-8814", model: "Gemma3-12B", family: "gemma", size: "12B", quant: "q4_k_m", hw: "Ryzen AI 9 HX 370", mem: "32 GB", runner: "llama.cpp b4771", backend: "vulkan", tps: 12.1, ttft: 430, gb: 8.5, ctx: 8192, user: "mrpotato", date: "2026-07-26" },
  { id: "r-8809", model: "Gemma3-12B", family: "gemma", size: "12B", quant: "q4_0", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "flm 0.4.2", backend: "npu", tps: 9.8, ttft: 540, gb: 7.9, ctx: 4096, user: "donutloop", date: "2026-07-25" },

  // Qwen3-8B
  { id: "r-8845", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 29.4, ttft: 150, gb: 5.4, ctx: 32768, user: "kyuz0", date: "2026-08-02", profile: "qwen3-8b-embed-coresident" },
  { id: "r-8844", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "vulkan", tps: 26.1, ttft: 190, gb: 5.3, ctx: 32768, first: true, date: "2026-08-02" },
  { id: "r-8831", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_k_m", hw: "Ryzen AI 9 HX 370", mem: "32 GB", runner: "llama.cpp b4771", backend: "vulkan", tps: 19.8, ttft: 240, gb: 5.3, ctx: 8192, user: "nx-void", date: "2026-07-29" },
  { id: "r-8825", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_0", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "flm 0.4.2", backend: "npu", tps: 16.2, ttft: 300, gb: 4.8, ctx: 4096, user: "donutloop", date: "2026-07-28", profile: "qwen3-8b-npu-idle" },
  { id: "r-8823", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_k_m", hw: "Radeon RX 7900 XTX", mem: "24 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 88.2, ttft: 60, gb: 5.4, ctx: 8192, user: "deadbeef7", date: "2026-07-28" },
  { id: "r-8818", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q8_0", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "llama.cpp b4780", backend: "rocm", tps: 18.6, ttft: 170, gb: 9.1, ctx: 16384, user: "sirrus", date: "2026-07-27" },
  { id: "r-8812", model: "Qwen3-8B", family: "qwen3", size: "8B", quant: "q4_k_m", hw: "Ryzen AI Max+ 395", mem: "128 GB", runner: "onnxruntime 1.20", backend: "npu", tps: 14.7, ttft: 340, gb: 5.9, ctx: 4096, user: "mrpotato", date: "2026-07-26" },
];
