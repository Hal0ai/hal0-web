# hal0-web — Website Navigation Index

**Purpose:** token-saving "where to look / where to edit" map for agents managing the hal0
marketing + docs website at `/home/halo/dev/hal0-web`. Per page/section: the source file, what
it controls, and a `graphify` query to surface it.

**Synthesised:** 2026-06-07 (WEB-SYNTH, Opus) from the WA1 content map + WA2 quality audit,
cross-verified against the `/home/halo/dev/hal0` backend graph and source.

**Graph commands** (READ-ONLY — never run `graphify update`):
- Website graph: `(cd /home/halo/dev/hal0-web && graphify query "<q>")`
- Backend graph: `(cd /home/halo/dev/hal0 && graphify query "<q>")`
- Cross-repo: `graphify query "<q>" --graph /home/halo/.graphify/global-graph.json`

> **README caveat:** the repo `README.md` "Layout" section is itself STALE — it lists components
> (`HeroSection`, `FeatureGrid`, `FeatureCard`, `HardwareMatrix`, `RoadmapColumn`, `RoadmapCard`,
> `ComparisonTable`) that **do not exist**. Trust the *Components* table below (verified against
> the filesystem), not the README, when deciding where to edit.

---

## 1. Site shape (one-paragraph orientation)

Astro 6 + Starlight 0.39 + Tailwind v4, deployed on Vercel at `hal0.dev`. Two layers:

- **Marketing** — a single 2082-line hand-authored `src/pages/index.astro` rendered through
  `src/layouts/MarketingLayout.astro`. All hero/feature/compare/roadmap copy + data live in
  `const` arrays in that file's frontmatter.
- **Docs** — a Starlight content collection at `src/content/docs/docs/`. The sidebar is
  **auto-generated from directory structure** (`astro.config.mjs:38-63`, `autogenerate`).
  **To add a docs page: drop a `.mdx`/`.md` file into `docs/<section>/`; order it via the
  `sidebar.order` frontmatter key. No config edit needed.** Six sections:
  getting-started, hardware, slots, api, operate, reference.
- **Edge** — `functions/_middleware.ts` (Cloudflare Pages fn) proxies the `releases.hal0.dev`
  GitHub releases manifest. `astro.config.mjs` holds Starlight config + sitemap + dev allowedHosts.

Copy-of-record lives in `CONTENT_BRIEF.md` (verified perf numbers — cite from here) and design
rationale in `NOTES.md`.

---

## 2. Marketing / landing — `src/pages/index.astro`

Single file; everything is a `const` array in the frontmatter. **To change landing copy/data,
edit the matching array — not the markup below it.**

| What you want to change | Edit (file:line) | graphify query |
|---|---|---|
| Version string in hero | `index.astro:13` (`const version`) | `graphify query "landing version hero"` |
| Schema.org JSON-LD (SoftwareApplication) | `index.astro:18` | `graphify query "schema.org SoftwareApplication JSON-LD"` |
| Feature cards (6) | `index.astro:36` (`features[]`) | `graphify query "feature cards landing"` |
| Provider matrix rows (5) | `index.astro:69` (`providers[]`) | `graphify query "provider stack matrix landing"` |
| Hardware tier cards (6) | `index.astro:107` (`tiers[]`) | `graphify query "hardware tiers landing"` |
| Loadout tabs (7 sets) | `index.astro:186` (`loadoutData`) | `graphify query "loadout tabs coding chat voice rag"` |
| vs-alternatives table (10 rows) | `index.astro:252` (`compareRows[]`) | `graphify query "comparison ollama LM Studio OpenAI"` |
| Roadmap themes (6) | `index.astro:272` (`themes[]`) | `graphify query "roadmap themes shipped soon future"` |
| "Shipping now" highlights (4) | `index.astro:378` (`shipNowHighlights[]`) | `graphify query "shipping now highlights"` |
| Perf numbers (258 tok/s etc.) | `index.astro:462,466,477` | `graphify query "verified performance tok/s dispatch"` |
| Install one-liner block | `index.astro:427` | `graphify query "one-line installer curl"` |
| CTA footer pills (no-telemetry, Apache-2.0) | `index.astro:27,840` | `graphify query "CTA footer pills license telemetry"` |

**Shared marketing chrome:** `src/layouts/MarketingLayout.astro` (head, sticky nav, footer,
scroll-aware navbar tone). `<head>` OG/meta for `/` lives here.

---

## 3. Docs sections — `src/content/docs/docs/`

Each row = a page. `graphify query` column surfaces it in the website graph.

### Getting started (`docs/getting-started/`, sidebar group "Getting started")
| Page | File | Controls |
|---|---|---|
| `/docs/getting-started/install/` | `getting-started/install.mdx` | One-line installer, preflight, **HAL0_\* override table** (lines ~109,194), Proxmox LXC helper, install step list (~137-148), **auth section (~213-227)** |
| `/docs/getting-started/first-model/` | `getting-started/first-model.mdx` | FirstRun wizard (8 steps), primary slot, hardware probe |
| `/docs/getting-started/first-chat/` | `getting-started/first-chat.mdx` | OpenWebUI on `:3001`, first chat |

`graphify query "install one-liner preflight HAL0 overrides"`

### Hardware (`docs/hardware/`)
| Page | File | Controls |
|---|---|---|
| `/docs/hardware/overview/` | `hardware/overview.md` | 4 tiers + deployment shapes |
| `/docs/hardware/strix-halo/` | `hardware/strix-halo.mdx` | **Crown-jewel page** — Ryzen AI Max+ 395, 8060S iGPU, XDNA NPU, 128 GB UMA, measured tok/s, LXC passthrough |
| `/docs/hardware/amd-discrete/` | `hardware/amd-discrete.mdx` | RX 7900; ROCm/Vulkan. **Has invalid `--provider llama-cpp-rocm` at :69** |
| `/docs/hardware/nvidia/` | `hardware/nvidia.mdx` | CUDA RTX 30/40/50. **Has invalid `--provider llama-cpp` at :160** |
| `/docs/hardware/cpu-only/` | `hardware/cpu-only.mdx` | Vulkan-CPU fallback, CI smoke |

`graphify query "strix halo hardware tier passthrough"`

### Slots (`docs/slots/`)
| Page | File | Controls |
|---|---|---|
| `/docs/slots/what-is-a-slot/` | `slots/what-is-a-slot.mdx` | Slot concept, **lifecycle diagram (missing `starting` state)**, single-flight; `/mnt/ai-models` path (~110-111, stale) |
| `/docs/slots/built-in-slots/` | `slots/built-in-slots.mdx` | 5 built-in slots + embed-rerank |
| `/docs/slots/custom-slots/` | `slots/custom-slots.mdx` | Additional slots (STUB — "Coming soon") |
| `/docs/slots/huggingface-pulls/` | `slots/huggingface-pulls.mdx` | HF pulls; **501 status claim is stale** (~59-60 path stale) |
| `/docs/slots/model-registry/` | `slots/model-registry.mdx` | registry.toml; `/mnt/ai-models` (~13, stale) (STUB) |
| `/docs/slots/loadouts/` | `slots/loadouts.mdx` | Curated loadouts by tier |

`graphify query "slot lifecycle built-in providers registry"`

### API (`docs/api/`)
| Page | File | Controls |
|---|---|---|
| `/docs/api/openai-compat/` | `api/openai-compat.mdx` | All `/v1/*`; structured errors (~146) |
| `/docs/api/slot-as-model/` | `api/slot-as-model.mdx` | `model` field = slot name or registry ref |
| `/docs/api/streaming/` | `api/streaming.mdx` | SSE streaming |
| `/docs/api/audio/` | `api/audio.mdx` | STT/TTS endpoints (STUB) |
| `/docs/api/images-generation/` | `api/images-generation.mdx` | `/v1/images/generations`, ComfyUI |

`graphify query "openai compatible v1 endpoints streaming"`

### Operate (`docs/operate/`)
| Page | File | Controls |
|---|---|---|
| `/docs/operate/updates/` | `operate/updates.mdx` | Cosign self-update; **version stale (~14)** |
| `/docs/operate/logs/` | `operate/logs.mdx` | journald + SSE tail (STUB) |
| `/docs/operate/config/` | `operate/config.mdx` | TOML config, capabilities overlay (STUB) |
| `/docs/operate/openwebui/` | `operate/openwebui.mdx` | Bundled OWUI; **private `thinmint.dev` domain (~79,81)** (STUB) |
| `/docs/operate/auth/` | `operate/auth.mdx` | **REMOVED-FEATURE PAGE** — Caddy/basic_auth gone in v0.3 (ADR-0012); private IP `10.0.1.230` + `thinmint.dev` |

`graphify query "operate updates logs config auth openwebui"`

### Reference (`docs/reference/`)
| Page | File | Controls |
|---|---|---|
| `/docs/reference/cli/` | `reference/cli.mdx` | Full `hal0` CLI |
| `/docs/reference/config-schema/` | `reference/config-schema.mdx` | hal0.toml + capabilities.toml; **invalid `provider = "llama.cpp"` (~50)** (STUB) |
| `/docs/reference/provider-matrix/` | `reference/provider-matrix.mdx` | 5 providers; **version + provider names stale** |
| `/docs/reference/slot-lifecycle/` | `reference/slot-lifecycle.mdx` | Full state machine + transitions |

`graphify query "cli reference config schema provider matrix"`

---

## 4. Components (VERIFIED against filesystem — supersedes README)

| Component | File | Purpose |
|---|---|---|
| `MarketingLayout` | `src/layouts/MarketingLayout.astro` | Chrome for `/`: head, nav, footer |
| `Wordmark` | `src/components/Wordmark.astro` | Inline SVG wordmark (amber `#feaf00`) |
| `StarlightSiteTitle` | `src/components/StarlightSiteTitle.astro` | Overrides Starlight logo so glyphs inherit currentColor |
| `LiveArtifact` | `src/components/landing/LiveArtifact.astro` | Hero animated dashboard preview |
| `LoadoutCard` | `src/components/landing/LoadoutCard.astro` | Landing loadout card |
| `CTA` | `src/components/CTA.astro` | Generic CTA button (not confirmed used on current landing) |
| `CodeBlock` | `src/components/CodeBlock.astro` | Styled code block |

`graphify query "components wordmark layout landing"`

---

## 5. Config / infra files

| File | Role | graphify query |
|---|---|---|
| `astro.config.mjs` | Starlight + sidebar (autogen, L38-63) + sitemap + dev `allowedHosts` (L93 has private `thinmint.dev`) | `graphify query "astro config starlight sidebar"` |
| `src/content.config.ts` | docs collection schema (`docsSchema()`) | `graphify query "content collection config schema"` |
| `functions/_middleware.ts` | CF Pages fn — proxies releases.hal0.dev manifest | `graphify query "middleware releases manifest proxy"` |
| `CONTENT_BRIEF.md` | Copy + perf numbers source-of-truth | `graphify query "content brief perf numbers"` |
| `NOTES.md` | Design rationale (accent, type stack) | `graphify query "design notes accent fonts"` |
| `src/styles/global.css` | Design tokens + Starlight overrides | — |

---

## 6. How to edit — quick rules

- **Landing copy/data:** edit the `const` array in `src/pages/index.astro` frontmatter, not the markup.
- **New docs page:** drop a file in `src/content/docs/docs/<section>/`; set `sidebar.order` frontmatter. Sidebar regenerates automatically.
- **Version bump:** sweep `index.astro` (L13 AND prose at L364, L809), `docs/index.mdx`, `operate/updates.mdx`, `reference/provider-matrix.mdx`. There is no single source of truth today (see BACKLOG).
- **Verify a product claim:** query the backend graph — `(cd /home/halo/dev/hal0 && graphify query "<feature>")` — before changing docs copy. The `_VALID_PROVIDERS` frozenset (`src/hal0/config/schema.py:89`) and `SlotState` enum (`src/hal0/slots/state.py`) are the load-bearing truth sources for slot/provider docs.
- **Never edit `/home/halo/dev/hal0/`** — upstream product repo, read-only reference.
