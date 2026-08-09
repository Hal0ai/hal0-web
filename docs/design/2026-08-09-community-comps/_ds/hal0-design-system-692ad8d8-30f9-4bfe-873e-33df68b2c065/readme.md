# hal0 — Design System

> **sodium amber on graphite.** The brand system for **hal0**, an open-source,
> self-hosted home AI inference platform. This project is the single source of
> truth for building hal0-branded interfaces, decks, and marketing assets —
> design tokens, fonts, logos, reusable React primitives, and full-screen UI
> kit recreations of the real product.

Consumers link one file — [`styles.css`](./styles.css) — which `@import`s every
token, font, and component style.

---

## What hal0 is

hal0 is a **homelab AI inference platform**: the Linux box you already have in
the rack, running real OpenAI-compatible inference. It manages model **slots**
as systemd units with a typed lifecycle state machine, exposes an
OpenAI-compatible `/v1/*` API, and ships with a Vue/React **dashboard** plus a
prewired OpenWebUI chat tab. One command installs on any modern Linux box —
Strix Halo iGPU, AMD discrete, NVIDIA, or CPU — and it's happy in a privileged
Proxmox LXC with GPU/NPU passthrough.

The tagline lockup is `[AGENTS][MODELS][MEDIA-GEN][MEMORY]`, designed for an
AMD **Strix Halo** (Ryzen AI Max+ 395, 128 GB unified memory, iGPU + XDNA NPU)
server on bare-metal or Proxmox.

**Core concepts the design must speak fluently:**

- **Slots** — the unit of work. Five built-ins: `primary` (chat), `embed`,
  `stt` (Moonshine), `tts` (Kokoro), `img` (ComfyUI). Plus user slots (`npu`,
  `vision`). Each has a typed **lifecycle**: offline → pulling → starting →
  warming → ready → serving ↔ idle → unloading; `error` sideband.
- **Backends / devices** — every slot runs on a backend with a stable colour:
  GPU **Vulkan** (default, blue), GPU **ROCm** (red), **NPU**/FLM (violet),
  **CPU** (grey).
- **Unified memory** — the headline Strix Halo feature; the dashboard's memory
  map shows co-resident models sharing one pool.
- **Operator, not end-user** — the dashboard is for *running the box*, not
  chatting. Dense, technical, glanceable.

### Products represented

| Surface | What it is | Source |
|---|---|---|
| **Dashboard** (`ui/`) | React/JSX operator console — Slots, Models, Logs, Settings, MCP, Agent/Memory, Connections, FirstRun. The primary UI kit. | `Hal0ai/hal0` → `ui/` |
| **Marketing + docs site** | `hal0.dev` — Astro landing + Starlight docs. | `Hal0ai/hal0-web` |

---

## Sources (explore these to go deeper)

This system was reverse-engineered from the real codebases. If you have access,
read them to build with higher fidelity:

- **Platform + dashboard:** <https://github.com/Hal0ai/hal0> — the operator
  console lives in [`ui/`](https://github.com/Hal0ai/hal0/tree/main/ui)
  (`ui/src/dashboard.css` is the canonical stylesheet; `ui/src/dash/*.jsx` are
  the views; `ui/src/dash/chrome.jsx` holds the `Wordmark` + `Icons` set).
- **Marketing site + docs + brand:** <https://github.com/Hal0ai/hal0-web> —
  `CONTENT_BRIEF.md` is the source of truth for product copy and verified
  numbers; `public/brand/` holds the logos; `src/styles/` holds the tokens.
- **Wiki / agent memory pattern:** <https://github.com/Hal0ai/hal0-wiki>

The token values, the icon set, and the component classes here are lifted
directly from those repos — not approximated.

---

## CONTENT FUNDAMENTALS

How hal0 writes. The voice is a **terminal that respects you**: precise,
technical, lowercase, never hyped.

- **Casing — lowercase by default.** The product name is **always `hal0`**,
  never "Hal0", "HALO", or "hal0.dev" mid-sentence. Slot names, states, device
  tags, chips, and labels are lowercase mono (`primary`, `gpu-vulkan`,
  `serving`, `coresident`). UPPERCASE is reserved for *section labels* with
  wide tracking (`RUNTIME`, `SLOT SNAPSHOT`).
- **Person — second person, imperative.** Talk to the operator: "Pick a
  bundle", "Restart lemond", "Free at least 38 GB to resume". The system
  reports facts about itself in third person ("lemond is offline", "3 slots
  queued to load"). Rarely "we"; never "I".
- **Identifiers stay literal.** Models, paths, flags, endpoints, and ports are
  written exactly (`Qwen3-Coder-30B-A3B-Instruct-Q4_K_M`,
  `/var/lib/hal0/models`, `--parallel 1`, `/v1/chat/completions`, `:8080`) and
  always set in mono. Never paraphrase an identifier.
- **Numbers are verified, never invented.** Real perf figures only — e.g.
  "258 tok/s", "280 ms round-trip", "verified on Ryzen AI Max iGPU + Vulkan".
  Unknown numbers are marked, not guessed.
- **Tone — confident, dry, a little hacker-proud.** "small touch, big
  personality." "Loadouts are starting points. Every real install ends up
  tweaked." Wry but never jokey; no exclamation marks in product UI.
- **Error copy — cause then recovery.** State what happened, why, and the next
  action: *"Disk full — downloads paused. Only 2.1 GB free on /var. Free at
  least 38 GB to resume."* Always offer an action button.
- **Eyebrows classify.** Most surfaces carry a tiny uppercase eyebrow naming
  the subsystem and severity: `Runtime · critical`, `Lemonade · nuclear evict`,
  `HuggingFace · gated repo`.
- **No emoji.** None in the product UI. The only "emoji-like" marks are the
  status dot and the amber `●` update bullet. (The marketing README uses a
  rocket once; the product never does.)
- **Units & syntax.** `GB` not "gigabytes", `tok/s`, `Q4_K_M` quant suffixes,
  `q4_k_m` lowercased inside model ids, `·` (middot) as the inline separator,
  `→` for "leads to / navigate", `↗` for external links.

**Examples to imitate:**

> Welcome back, **halo**. system steady on `strix-halo-01`
> steady · 6 slots up · lemond up

> No models configured yet — hal0 is ready, but no slot has a model loaded.
> Pick a bundle to get going, or configure slots one at a time.

> Swapping NPU chat: gemma3:1b → llama-3.2-3b-npu. Voice + embed paused for
> ~14s while FLM restarts. Coresident slots will resume automatically.

---

## VISUAL FOUNDATIONS

The whole system is one idea: **a dark rack console lit by a single sodium-amber
lamp.** Everything follows from that.

### Colour
- **One accent, rationed.** Sodium amber `#FFB000` (`--accent`) means *live /
  primary / actionable* — the one solid-fill button, the active nav rail, a
  serving slot's tok/s, focus rings, selection. It is never decoration. Hover
  goes *lighter* (`#FFC533`), not darker.
- **Graphite neutrals do everything else.** A near-black surface ramp
  (`--bg #0A0A0A` → `--bg-4 #232323`) and a warm-white text ramp
  (`--fg #F5F5F2` → `--fg-5 #3D3D3A`). Five steps each, tuned for contrast on a
  dark field.
- **Semantic status:** ok `#6FCF97`, warn `#E8B94E`, err `#EF6B6B`, info
  `#7FB8FF` — each with a 10%-fill + 30%-line tint pair for chips/banners.
- **Device hues are load-bearing:** vulkan `#7FB8FF`, rocm `#D76B6B`, npu
  `#C896FF`, cpu `#9C9C95`. A slot reads the *same colour* in a chip, the
  snapshot, and the memory map.
- **Memory map** uses a colourblind-safe Okabe–Ito 8-colour set so co-resident
  models stay distinguishable.
- **Default theme is dark.** A light theme exists on the marketing site
  (amber darkens to `#B87800` for AA), but the dashboard is dark-only.

### Type
- **Monospace-forward.** JetBrains Mono (`--jbm`) carries the UI: every
  identifier, number, state, label, route, and metric. Geist (`--geist`) is
  reserved for prose — paragraphs, descriptions, message bodies, help.
- **Monomaniac One** draws *only* the wordmark "hal".
- **Dense scale.** Base body 13.5px, dense rows 12.5px, mono labels 10–11px,
  view titles 22px, hero/first-run clamps to ~52px. Weight tops out at **600** —
  emphasis comes from colour and mono, not bold.
- **Numerals are tabular + slashed-zero** wherever they tick (`.num`,
  `font-feature-settings: "zero" 1, "tnum" 1`). Geist runs `cv11`/`ss01`.

### Shape, line & elevation
- **Thin 1px hairlines everywhere.** `--line #262626` default;
  `--line-strong #3A3A3A` on hover; `--line-soft #1C1C1C` for inner dividers.
  Structure is drawn with lines, not shadows.
- **Small radii.** Tags ~3px, buttons/fields 4–6px, cards 10px, feature cards
  14px. True pills (999px) only for status pills, filter toggles, and the
  wordmark "0".
- **Flat panels.** Cards sit on the graphite with a border and *no shadow*.
  Shadow appears only on genuinely floating layers — menus, drawers, toasts,
  the footer log pane — as a deep soft black (`--shadow-menu` etc.).
- **Amber glow is a *light*, not a shadow.** `box-shadow: 0 0 8px var(--ok)` on
  a live dot reads as an LED, not elevation.

### Backgrounds & texture
- Solid near-black; **no gradients** in the product UI (the marketing FirstRun
  "kit" card uses one subtle radial amber wash — the single exception).
- A couple of textures appear as *function*: a 45° amber hatch on image-gen
  placeholders, a diagonal-stripe "off" state on timelines, a skeleton shimmer
  for loading. No photographic or illustrative backgrounds.
- Log/terminal wells go even darker (`--bg-sunken #070707`).

### Motion
- One signature easing: `cubic-bezier(0.22, 1, 0.36, 1)` (soft ease-out, no
  overshoot). Durations are short: 0.12 / 0.18 / 0.22s.
- **Pulse** (opacity 1↔0.4, 1.2s) is the *only* looping animation, reserved for
  "live" state dots (serving, warming) and active client pips.
- Drawers slide in 0.22s; the footer pane lifts with a translateY+fade. No
  bounces, no springs, no decorative loops.

### Interaction states
- **Hover:** ghost/secondary elements lighten their border to `--line-strong`
  and pick up `--bg-2`; the primary amber button brightens (`filter:
  brightness(1.06)`); rows get a faint `--bg-2` wash; mono links go amber.
- **Press:** primary button nudges down 0.5px. Restrained.
- **Focus:** a 2px amber outline with 2–3px offset (keyboard nav matters);
  inputs also get a 3px amber-soft ring.
- **Selection:** amber background, near-black text — "small touch, big
  personality."
- **Active nav:** amber-bg fill + a 2px amber rail on the left edge.

### Layout
- App shell is a CSS grid: 52px topbar / 232px sidebar / 1fr main / 52px
  footer. Main content maxes at 1600px and stays dense.
- Sidebar and footer are fixed chrome; the footer doubles as a live journal
  ribbon that expands into a log pane.
- Cards compose in 50/50 and `1fr / 320px` splits; nesting stays one level deep.

---

## ICONOGRAPHY

hal0 ships its **own** icon family — do not substitute a third-party set.

- **The set:** a custom thin-line family defined inline as SVG in the dashboard
  (`ui/src/dash/chrome.jsx`, the `Icon`/`Icons` object). **16×16 viewBox, 1.5
  stroke, round caps + joins, `fill: none`, drawn at `currentColor`.** ~30
  glyphs: `dashboard, slots, models, hardware, backends, logs, connections,
  agent, settings, bell, search, send, attach, mic, chev, chevR, close, menu,
  check, warn, plus, ext, download, restart, unload, start, edit, more, cpu,
  flame, chat`.
- **Recreated faithfully here** as the [`Icon`](./components/core/Icon.jsx)
  component — `<Icon name="slots" />`. Colour is inherited; tint by setting
  `color` on a wrapper, never by editing the SVG. `ICON_NAMES` exports the list.
- **No icon font, no sprite, no PNG icons.** Everything is inline stroke SVG so
  it scales and recolours cleanly.
- **No emoji as icons.** The status **dot** (a coloured/glowing circle) and a
  few unicode marks used as *glyphs* — `→`, `↗`, `·`, `●`, `⌃`, `⌘K` — are the
  only non-SVG marks, and they're typographic, not iconographic.
- **The wordmark "0"** is itself an icon: an amber toggle-switch capsule (a
  power switch). It appears as the favicon and app glyph.
- **Logos** live in [`assets/`](./assets/): `wordmark.svg` (horizontal lockup,
  "hal" = `currentColor`), `wordmark-light.svg` / `wordmark-dark.svg`
  (pre-coloured for `<img>` use on dark / light backgrounds), `logo-halo-{dark,
  light}.svg/png` (square app marks), `favicon.svg`.

---

## Index / manifest

```
styles.css                  ← consumers link THIS (an @import manifest only)
tokens/
  fonts.css                 @import of Geist · JetBrains Mono · Monomaniac One (Google Fonts)
  colors.css                surfaces, foreground, accent, status, device, memory-map
  typography.css            families, scale, weights, line-heights, tracking
  spacing.css               spacing, radii, borders, shadows, motion, layout chrome
components/
  components.css            component styles lifted from the product
  core/
    Icon        Wordmark    Button   Chip   StatusDot
    Input       Card        Banner   Kbd    AgentCard
    (each: .jsx + .d.ts + .prompt.md; *.card.html are the Design-System-tab specimens)
guidelines/                 foundation specimen cards (Colors · Type · Spacing)
ui_kits/
  dashboard/                full-screen operator-console recreation (index.html + JSX)
assets/                     wordmark + logo SVG/PNG, favicon
SKILL.md                    Agent-Skills entry point (downloadable)
```

**Components** (`window.Hal0DesignSystem_692ad8.*`): `Icon`, `Wordmark`,
`Button`, `Chip`, `StatusDot`, `Input`, `Card`, `Banner`, `Kbd`, `AgentCard`.

**UI kits:** `ui_kits/dashboard/` — an interactive recreation of the operator
console (sidebar, topbar, dashboard overview, slots, memory map, composer).

See each component's `.prompt.md` for usage, and the Design System tab for live
specimen cards.

---

## Caveats / substitutions

- **Fonts** are loaded from **Google Fonts** (`tokens/fonts.css`) rather than
  the self-hosted `.woff2` bundles the product ships. Identical families
  (Geist, JetBrains Mono, Monomaniac One). Drop in local `@font-face` + binaries
  if you need a fully offline, pinned build.
- The compiler reports **0 fonts** because the faces come via Google's remote
  CSS rather than local `@font-face` rules — expected with the CDN approach.
