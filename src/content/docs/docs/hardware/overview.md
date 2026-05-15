---
title: Hardware overview
description: The four hardware tiers hal0 targets — Strix Halo, AMD discrete, NVIDIA, CPU-only — and how to pick.
sidebar:
  order: 1
---

hal0 runs on four classes of home hardware in v1. The
[one-line installer](/docs/getting-started/install/) detects which
class you're on and picks the right backend automatically — this page
is for figuring out where you land before you commit.

## The tiers

| Tier | Hardware | Status | Path |
|---|---|---|---|
| **First-class** | AMD Strix Halo (Ryzen AI Max+ 395, Radeon 8060S, XDNA NPU, 64–128 GB unified) | Reference platform | Vulkan llama.cpp on the iGPU + FLM-on-NPU (NPU pending) |
| **Supported** | AMD discrete (RX 7900 XT/XTX, Radeon Pro) | Vulkan today, ROCm queued | Vulkan llama.cpp; ROCm toolbox pending |
| **Supported** | NVIDIA discrete (RTX 3080 / 4080 / 4090 / 5090) | Vulkan today, CUDA queued | Vulkan llama.cpp; CUDA toolbox pending |
| **Fallback** | CPU-only x86_64 (no GPU) | CI smoke target | Vulkan-CPU (lavapipe) |

Linux + systemd is required for all tiers.

## How to pick

- **You're shopping for a home AI box.** Get a 128 GB
  [Strix Halo](/docs/hardware/strix-halo/) machine. That's the whole
  premise of v1 — unified memory means you run the big models that
  discrete cards can't, in a single quiet SFF chassis.
- **You already have a high-end NVIDIA card.** Use it. The
  [NVIDIA](/docs/hardware/nvidia/) page covers what works today (Vulkan)
  and what's queued (CUDA toolbox). A 4090 / 5090 on chat tok/s
  outperforms an iGPU on small models; you trade headroom for
  throughput.
- **You already have an AMD discrete card.** Same story.
  [AMD discrete](/docs/hardware/amd-discrete/) — Vulkan today, ROCm
  toolbox queued.
- **You have a CPU-only box and want to try hal0.**
  [CPU-only](/docs/hardware/cpu-only/) walks through the fallback path.
  Smoke-test it; don't expect to chat through it all day.

## Where the perf numbers come from

Every measured number on this site comes from the **Strix Halo
reference deployment** (Ryzen AI Max+ 395 + Vulkan llama.cpp). See
the [Strix Halo page](/docs/hardware/strix-halo/#measured-performance)
for the verbatim table. Numbers from other hardware tiers will be
added as they're measured at publish quality.
