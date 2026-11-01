# hal0 dashboard → hal0.dev: design-token and component research

Read-only research. No repo was modified. Written 2026-11-01.

**Source checkout used:** `/home/mint/projects/hal0` (`main`, HEAD `f44fdb7a`, 2026-11-01 00:18 -0400).
`/mnt/mintdev/repos/hal0` is older (`b4407ed1`, 2026-10-30 20:31 -0400), so it was ignored.

**Not done:** no screenshots were taken. Everything below is read from CSS/JSX. If the owner has a specific
"latest elements" screen in mind, confirm against a live capture (screenshots need CT150 + the Playwright container).

---

## 1. Stack

- Dashboard UI lives in **`/home/mint/projects/hal0/ui/`** (package `hal0-ui` v1.7.1). The Python side
  (`src/hal0/dashboard/`) only has a `__pycache__`.
- **React 19** + **Vite 7** + **TypeScript 7**; **zustand** (state), **TanStack Query** (data), **d3-force** (memory graph),
  Sentry. Tests: vitest + happy-dom, Playwright e2e.
- Mix of `.jsx` and `.tsx`/`.ts` under `ui/src/dash/`. Fonts: `@fontsource-variable/geist` + `@fontsource/jetbrains-mono`.
- **Tailwind 4 is installed (`@tailwindcss/vite`) but the dashboard is NOT styled with utilities.** All styling is hand-written
  global CSS: `ui/src/dashboard.css` (4068 lines, the token source of truth) plus per-feature sheets in `ui/src/dash/`:
  `overhaul.css` (1900), `engine-panes.css` (1611, slot cards + inference/NPU panes), `npu.css`, `connections.css`,
  `memory-v2.css`, `stacks.css`, `slot-rail.css`, `dock/dock.css`, `overview/overview.css`, `board/board.css`,
  `image/*.css`, `agents/agent-cards.css`.
- Key components: `dash/inference-pane.jsx` (slot cards `SlotCards`), `dash/rich-select.jsx` (+ `rich-select-core.ts`),
  `dash/slot-modals.jsx` (slot drawer), `dash/model-drawer.jsx`, `dash/profiles.jsx`, `dash/command-palette.jsx`,
  `dash/primitives.jsx` (Modal/Drawer/DrawerDock/Menu/Banner/PillToggle), `dash/chrome.jsx` (topbar/sidebar),
  `dash/dock/*` (status dock), `dash/overview/*` (Overview v2).

**Key finding:** the dashboard and the website already share a design language. `dashboard.css` line ~1170 says:
*"Unified-chrome shared primitives — Same vocabulary as hal0.dev's site chrome (icon buttons, search trigger, filter pills,
terminal well, data table)"* (commit `74f1b47a`, 2026-08-09, "unify dashboard chrome with the hal0.dev design-system pack").
Raw token values are near-identical (see §5). The real gap is **component-level treatment**: card anatomy, state vocabulary,
hover behaviour, and a few hardcoded values on the landing page.

---

## 2. Dashboard design tokens (`ui/src/dashboard.css` `:root`)

```css
/* Brand */
--hal0-accent:       #FFB000;  --hal0-accent-hover: #FFC533;
--hal0-accent-muted: #7a5500;  --hal0-accent-glow:  rgba(255,176,0,0.18);

/* Surfaces (darkest → lightest) */
--bg-sunken: #070707;  --bg: #0a0a0a;  --bg-1: #111111;  --bg-2: #161616;  --bg-3: #1c1c1c;  --bg-4: #232323;

/* Text tiers */
--fg: #f5f5f2;  --fg-2: #c8c8c2;  --fg-3: #8a8a85;  --fg-4: #5c5c58;  --fg-5: #3d3d3a;

/* Lines */
--line: #262626;  --line-soft: #1c1c1c;  --line-strong: #3a3a3a;

/* Accent shorthands */
--accent: var(--hal0-accent);
--accent-soft: rgba(255,176,0,0.10);   /* fill behind amber chips / hover wash */
--accent-line: rgba(255,176,0,0.34);   /* amber border */
--accent-bg:   #2a1d00;                /* solid dark-amber wash: selected rows, active nav, "current" option */
--accent-glow: var(--hal0-accent-glow);

/* Status (each has -soft 0.10 and -line 0.30 variants) */
--ok:   #6fcf97;  --warn: #e8b94e;  --err: #ef6b6b;  --info: #7fb8ff;
/* overhaul.css adds: --warming: var(--warn); --warming-glow: rgba(232,185,78,.35); --ok-glow: rgba(111,207,151,.35); */

/* Device lanes (a lane is the same hue in a chip, table cell, chart legend) */
--dev-rocm:#d76b6b; --dev-vulkan:#7fb8ff; --dev-cpu:#9c9c95; --dev-cuda:#8fce6f; --dev-npu:#c896ff; --dev-img:#3c6597;

/* Engine accents (scoped; ComfyUI blue, Inference sodium-yellow, NPU purple) */
--comfy:#5ea4f9; --comfy-hi:#8cc0ff; --comfy-soft:rgba(94,164,249,.10); --comfy-line:rgba(94,164,249,.34);
--comfy-bg:#0c1622; --comfy-glow:rgba(94,164,249,.20);
--yellow:#e5b84f; --yellow-hi:#f2ce74; --yellow-bg:#1b1605;

/* Memory-map palettes */
--mem-tenant-1:#b89060; --mem-tenant-2:#8a7848; --mem-tenant-3:#695830;
--mem-slot-1..8: #5b9bd5 #e69f00 #009e73 #cc79a7 #f0e442 #d55e00 #56b4e9 #b39ddb   /* Okabe-Ito, colour-blind aware */

/* Type */
--geist: "Geist","Geist Variable",system-ui,...;   --jbm: "JetBrains Mono","JetBrains Mono Variable",ui-monospace,...;

/* Radii */
--rad-xs:3px; --rad-sm:4px; --rad:6px; --rad-lg:10px; --rad-xl:14px; --rad-pill:999px;

/* Motion */
--ease: cubic-bezier(.22,1,.36,1);  --dur-fast:.12s;  --dur:.18s;  --dur-slow:.22s;

/* Elevation */
--shadow-menu:   0 8px 24px rgba(0,0,0,0.45);
--shadow-toast:  0 12px 36px -12px rgba(0,0,0,0.6);
--shadow-drawer: -24px 0 80px -20px rgba(0,0,0,0.7);   /* (the live .drawer actually uses -20px 0 60px -16px rgba(0,0,0,.6)) */

/* Layout */
--topbar-h:52px; --sidebar-w:232px; --sidebar-w-collapsed:56px; --footer-h:90px;
```

Base: `html,body { font-family: var(--geist); font-size: 13.5px; line-height: 1.5; font-feature-settings:"cv11" 1,"ss01" 1; }`.
`.mono { font-family: var(--jbm); font-feature-settings:"zero" 1,"ss02" 1,"calt" 0 }`. `:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px }`.
Scrollbar 6px, thumb `--line`.

**Observed scales** (tally across the dashboard CSS):
- **Font sizes** (most used): 10px (61×), 11px (60×), 12px (38×), 12.5px (22×), 10.5px (21×), 11.5px, 9px, 13px; display sizes only
  at 15 / 18 / 22px. Micro-labels are 9–10px mono UPPERCASE `letter-spacing: 0.08–0.1em`.
- **Radii**: `--rad-sm` 4px (52×) is the workhorse (buttons, inputs inset, icon buttons); `50%` dots; `--rad-lg` 10px (cards, panels, menus-lg);
  `--rad` 6px (inputs, rich-select, menus, toasts, banners); 3px for chips/kbd/tags; `999px` for filter pills, count badges, switches.
- **Borders**: always 1px solid. `--line` for card/control edges, `--line-soft` for internal dividers, `--line-strong` for hover and floating surfaces.
  Accent state = `--accent-line` border + `--accent-soft` fill. 2px is reserved for state stripes, active tab underline, toast left border.
- **Spacing**: no spacing tokens; common values 4/6/8/10/12/14/16/18/22px. Card padding 10–12px (slot card), 14–16px (profile card, panels);
  drawer body `18px 22px`; gaps 6/8/12px.
- **Transitions**: `--dur-fast` (.12s) + `--ease` for colour/border/background; cards use `0.15s ease` for `border-color, transform, box-shadow`.
  Drawers `.22s cubic-bezier(.22,1,.36,1)`; command palette in `.18s` with the same curve. One looping animation: `pulse` (opacity 1 → .4) on live dots.
  Everything honours `prefers-reduced-motion`.

---

## 3. Component treatments (with excerpts)

### 3.1 Slot card (`.scard`, `engine-panes.css` ~944–1200; markup `inference-pane.jsx` ~860)

Anatomy: **header strip → body → (profile row) → metric row → sunken full-bleed footer bar**, with a **2px left state stripe**.

```css
:is(.infer-pane,.npu-pane) .scard {
  position: relative; border: 1px solid var(--line); border-radius: var(--rad-lg);
  background: var(--bg-1); overflow: hidden;
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.scard::before { content:''; position:absolute; left:0; top:0; bottom:0; width:2px;
  background: var(--bk, transparent); opacity:.85; z-index:1; }          /* state stripe */
.scard:hover { border-color: var(--line-strong); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.28); }
.scard:hover::before { opacity:1; box-shadow: 0 0 12px var(--bk); }       /* stripe glows on hover */
.scard.ready/.serving { --bk: var(--dev-vulkan) }  .scard.warming { --bk: var(--warn) }  .scard.error { --bk: var(--err) }
.scard.dim { opacity: .55 }                                               /* stopped slot */
.infer-pane .scard.serving { animation: breathe 3.4s ease-in-out infinite; }  /* box-shadow 0 0 22px -10px var(--comfy-glow) at 50% */
.scard-h { display:flex; align-items:center; gap:9px; padding:10px 12px; border-bottom:1px solid var(--line-soft); background:var(--bg-1); }
.scard-h .snm { font: 500 13px var(--jbm); color: var(--fg); }
.sport { margin-left:auto; font: 11px var(--jbm); color: var(--fg-4); }   /* ":8081" replaces the old status pill */
.scard-b { padding:10px 12px; display:flex; flex-direction:column; gap:9px; }
.scard-foot { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin:auto -12px -10px; padding:8px 11px;
  border-top:1px solid var(--line-soft); background: var(--bg); }        /* full-bleed sunken action bar */
```

**Metric row incl. memory** (`.scard-meta`, 3 columns: tok/s · ttft · mem):

```css
.scard-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding-top:9px; border-top:1px solid var(--line-soft); }
.scard-meta .m .l { font:8px var(--jbm); text-transform:uppercase; letter-spacing:.05em; color:var(--fg-4); margin-bottom:2px; }
.scard-meta .m .v { font:13px var(--jbm); color:var(--fg); }   /* .acc → var(--comfy)/yellow when live; .muted → --fg-5 for "—" */
```
The `mem` cell renders `"{memGb} GB"` at 12px (inline style), `—` muted when null. The older `.slot-metrics` variant in `dashboard.css`
(4 columns, 15px values, `border-top/bottom: 1px solid var(--line-soft)`, cells split by `border-right: 1px solid var(--line-soft)`) is the previous take.

**Joined device|profile tag + pickers.** The card has two RichSelects (model picker, profile pill):

```css
.rsel-trigger.model-picker { width:100%; padding:7px 10px; border:1px solid var(--line-strong); border-radius:var(--rad-sm);
  background:var(--bg-1); font:11.5px var(--jbm); transition:border-color var(--dur-fast) var(--ease); }
.rsel-trigger.model-picker:hover { border-color: var(--comfy-line); }   /* accent-tinted hover (yellow in infer-pane, purple in npu-pane) */
.dchip { display:inline-flex; gap:6px; padding:2px 7px; border-radius:3px; font:10px var(--jbm); border:1px solid var(--line); background:var(--bg-1); color:var(--fg-2); }
.dchip .sw { width:8px; height:8px; border-radius:var(--rad-xs); background:var(--dev-*); }   /* SQUARE swatch = category */
.prov { display:inline-flex; align-items:stretch; }                                          /* [ device | PROFILE ] joined tag */
.prov .dchip { border-top-right-radius:0; border-bottom-right-radius:0; }
.rsel-trigger.profile-pill { padding:2px 7px; border:1px solid var(--line); border-left:none; border-radius:0 3px 3px 0;
  background:var(--bg-2); color:var(--fg-3); font:9.5px var(--jbm); text-transform:uppercase; letter-spacing:.04em; }
.rsel-trigger.profile-pill:hover { color:var(--comfy); border-color:var(--comfy-line); }
.tag-chip { padding:2px 7px; border-radius:3px; font:9.5px var(--jbm); color:var(--fg-4); border:1px solid var(--line); background:var(--bg-1); }  /* "32k ctx" */
```
Rule stated in CSS comments: **round = status (dot), square = device/category (swatch).** Model-edit pencil is a fixed-square `.sctrl` sibling.
Drag-to-reorder grip: dotted tab hanging off top-centre, 32×13px, `border-radius: 0 0 4px 4px`, `opacity:.4` → 1 on card hover.

### 3.2 RichSelect (`dashboard.css` ~3477–3560; `rich-select.jsx`)

```css
.rsel-trigger { display:flex; align-items:center; gap:10px; width:100%; background:var(--bg); border:1px solid var(--line);
  font:13px var(--geist); padding:8px 11px; border-radius:var(--rad); }
.rsel-trigger:focus-visible, .rsel-trigger[aria-expanded="true"] { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-soft); outline:none; }
.rsel-trigger[aria-expanded="true"] .rsel-trigger-caret { transform:rotate(180deg); color:var(--accent); }
.rsel-trigger.rsel-err { border-color:var(--err-line); }  /* + focus ring 0 0 0 3px var(--err-soft) */
.rsel-listbox { position:absolute; top:calc(100% + 4px); z-index:30; background:var(--bg-2); border:1px solid var(--line-strong);
  border-radius:var(--rad); box-shadow:var(--shadow-menu); max-height:320px; overflow-y:auto; padding:4px 0; }
.rsel-option { display:flex; flex-direction:column; gap:3px; padding:8px 12px; border-bottom:1px solid var(--line-soft); }  /* TWO-LINE rows */
.rsel-option-row { display:flex; justify-content:space-between; gap:10px; font-size:12.5px; color:var(--fg); }   /* name left, chips right */
.rsel-option-desc { font-size:10.5px; color:var(--fg-4); line-height:1.35; }                                     /* muted second line, "·" separated */
.rsel-option:hover,.rsel-option[data-active="true"] { background:var(--bg-3); }
.rsel-option[aria-selected="true"] { background:var(--accent-bg); }  /* + row text → var(--accent) */
```
Option rows carry chips: quant, runtime (`.chip.dev-*`), fit chip (`.chip.fit-chip`, compact + icon), and **bare modality glyphs** after the name
(`.modality-icon` eye = `--info`, drafter bolt, thinking = `--dev-npu`; no chip box). The "✎ Edit slot…" row is ruled off with `border-top:1px solid var(--line-strong)` and muted.
Input focus idiom is the same everywhere: `.input:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-soft) }`.

### 3.3 Edit drawers (slot / model / profile)

Shared `<Drawer>` (`dashboard.css` ~3010–3165):

```css
.drawer { position:fixed; top:0; right:0; bottom:0; z-index:95; background:var(--bg-1); border-left:1px solid var(--line-strong);
  box-shadow:-20px 0 60px -16px rgba(0,0,0,.6); transform:translateX(100%); transition:transform .22s cubic-bezier(.22,1,.36,1); }
.drawer-backdrop { background:rgba(0,0,0,.45); transition:opacity .18s ease; }
.drawer-h { padding:18px 22px 14px; border-bottom:1px solid var(--line); background:var(--bg); }          /* sunken header */
.drawer-h h2 { font-size:18px; font-weight:500; letter-spacing:-.02em; }
.drawer-h .modal-h-eye { font-size:10px; color:var(--accent); text-transform:uppercase; letter-spacing:.1em; margin-bottom:4px; }  /* amber eyebrow */
.drawer-title-input { background:transparent; border:1px solid transparent; ... }  /* inline-editable title: border appears on hover/focus (accent-line) */
.drawer-h .modal-close { width:28px; height:28px; border:1px solid var(--line); border-radius:var(--rad-sm); color:var(--fg-3); }
.drawer-body { padding:18px 22px; overflow-y:auto; }
.drawer-foot { padding:14px 22px; border-top:1px solid var(--line); background:var(--bg); font-size:11px; color:var(--fg-4); }   /* sunken footer bar */
.drawer--docked { right:var(--drawer-dock,0px); box-shadow:-14px 0 40px -18px rgba(0,0,0,.55); }  /* slot drawer 560px + model drawer 600px side by side ≥1200px */
```
- Form rows: `.form-row { grid-template-columns:160px 1fr; gap:14px; padding:12px 0; border-bottom:1px solid var(--line-soft) }`;
  section heads `.form-section { font:10px var(--jbm); uppercase; letter-spacing:.1em; color:var(--fg-4); border-bottom:1px solid var(--line) }`.
- **Slot drawer Tune block** (newest, 2026-10-31, #3173): rows `grid 96px 1fr`; segmented pill buttons:
  ```css
  .tune-seg { font-size:11.5px; padding:3px 9px; border-radius:999px; background:transparent; color:var(--fg-3); border:1px solid var(--line); }
  .tune-seg.profile { border-style:dashed; }          /* "value inherited from profile" */
  .tune-seg.on { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line); }
  .tune-dot { width:6px; height:6px; border-radius:50%; background:var(--accent); }   /* "overridden" marker beside the label */
  ```
- **Model drawer tune pills** (2026-09-02, #2215): `.fpill` + state modifiers — the colour is the diff:
  `.fpill-chg` warn, `.fpill-add` ok, `.fpill-deny` err, `.fpill-rm` dashed + line-through ghost.
- **Profile drawer** (`.pf-drawer`, 460px): header `18px 20px 14px`, eyebrow `10px var(--fg-4) .1em`, title 15px/500; rows `grid 130px 1fr`;
  switches (`.pf-switch`): 34×19 track `--bg-3` + `--line` border; on → `--accent-soft` track + 14px knob `--accent` with `box-shadow: 0 0 8px var(--accent)`;
  ok/err input states via `--ok-line`/`--err-line` border and a check glyph; footer `--bg` bar with a backend-tinted preview pill
  (`color-mix(in srgb, var(--bk) 10%, transparent)` fill, 34% border).
- **Profile card** (`.pf-card`): `padding 14px 16px 12px 18px`, radius-lg, `--bg-1`, 2px `.pf-accent` left stripe keyed to backend hue (`--bk`),
  hover `translateY(-1px)` + `0 6px 20px rgba(0,0,0,.28)` + stripe glow `0 0 12px var(--bk)`, entry `pf-rise` (translateY 10px, .4s).
  Big metric `.pf-tps` is 19px mono amber; chips `.pf-chip` are 999px pills (10px mono), backend chips use `color-mix(... var(--bk) 34% / 10%)`.

### 3.4 Memory bar

Two treatments:

```css
/* Inference pane (slots page) */
.infer-pane .membar { display:flex; height:14px; border-radius:3px; overflow:hidden; background:var(--bg-3); }   /* .tall = 17px / 2px radius */
.infer-pane .membar i { height:100%; transition:filter var(--dur-fast) var(--ease); }  .membar i:hover { filter:brightness(1.3); }
.membar i.free { background:transparent; }  .membar .seg-gap { box-shadow:inset -1px 0 0 var(--bg-1); }   /* 1px divider between segments */
.mem-legend { display:grid; grid-template-columns:repeat(auto-fill,minmax(168px,1fr)); gap:7px 20px; margin-top:14px; }
.mem-legend .sw { width:9px; height:9px; border-radius:2px; }  .mem-legend .sw.free { background:transparent; border:1px dashed var(--line-strong); }
.mtrack .mt-h { display:flex; justify-content:space-between; font:11px var(--jbm); margin-bottom:7px; } /* label left, "<b>used</b> / total" right */

/* Overview v2 (2026-10-29) — labelled unified-memory bar */
.ov-membar { display:flex; height:46px; border:1px solid var(--line); border-radius:5px; overflow:hidden; background:var(--bg-sunken); }
.ov-mem-seg { padding:0 9px; border-right:1px solid var(--bg); cursor:pointer; transition:filter .15s var(--ease); }  .ov-mem-seg:hover { filter:brightness(1.5); }
.ov-mem-seg.sys { background:repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in srgb, var(--dev-cpu) 16%, transparent) 3px 6px); }  /* striped = OS/system */
.ov-mem-seg .ov-nm { font:10.5px var(--jbm); }  .ov-mem-seg .ov-sb { font:9.5px var(--jbm); color:var(--ok); }
```
Segments are coloured from the Okabe-Ito `--mem-slot-N` set (one stable hue per loaded model). GPU gauge companion: 270° radial, `stroke: var(--yellow)`,
`filter: drop-shadow(0 0 6px rgba(229,184,79,.5))`, centre value 30px/500 mono, label 9.5px uppercase in `--dev-rocm`.
Throughput tile: `border:1px solid var(--line); radius:var(--rad); background:var(--bg); padding:12px 14px`, sparkbars `opacity:.45` with `.hot` at 1.

### 3.5 Badges / pills / status

```css
.chip { display:inline-flex; gap:5px; padding:2px 7px; border-radius:3px; font:10px var(--jbm); letter-spacing:.02em;
  background:var(--bg-2); color:var(--fg-3); border:1px solid var(--line); text-transform:lowercase; }
.chip.amber { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-line) }
.chip.ok / .warn / .err / .info  → var(--X-soft) fill, var(--X) text, var(--X-line) border
.chip.dev-rocm … → color:var(--dev-*); border rgba(…,.30); background rgba(…,.08)     /* .chip.outlined → transparent */
.default-badge { padding:2px 7px; border:1px solid var(--accent-line); border-radius:3px; font:9px var(--jbm); color:var(--accent); letter-spacing:.08em; text-transform:uppercase; }
.pf-chip { padding:2px 8px; border-radius:999px; … }          /* profile/tag chips are full pills */
.fpill { height:26px; padding:0 11px; border-radius:var(--rad-pill); border:1px solid var(--line); background:var(--bg-1); color:var(--fg-3); font:11.5px var(--jbm); }
.fpill:hover { border-color:var(--line-strong); color:var(--fg) }  .fpill.on { background:var(--accent-soft); border-color:var(--accent-line); color:var(--accent) }
```

**Status dot vocabulary — "ONE status vocabulary" (`.sdot`, overhaul.css + engine-panes.css; comment says card, endpoint row and list entry must never disagree):**

| State | Look |
|---|---|
| serving (processing a request now) | **green** `--ok` + `0 0 8px` glow + `pulse 1.4s` |
| ready (loaded, healthy, idle) | **solid amber** `--hal0-accent`, no glow, no animation |
| warming / starting / pulling | **orange** `--warn` + glow + pulse |
| error | red `--err` + glow, static |
| offline | grey `--fg-5`, no glow |
| paused (image mode) | hollow ring `1.5px solid var(--info)` |
| NPU serving | pulses `--dev-npu` instead of green |

Sizes: `.sdot` 8px; `.dot` 7px; sidebar/status mini-dots 5–6px with `box-shadow: 0 0 6px currentColor`.

### 3.6 Buttons

```css
.btn { display:inline-flex; align-items:center; gap:7px; padding:6px 12px; height:30px; background:var(--accent); color:#0a0a0a;
  font:600 12px var(--jbm); letter-spacing:-.005em; border-radius:var(--rad-sm); border:1px solid var(--accent); }
.btn:hover { filter:brightness(1.06) }   .btn:active { transform:translateY(.5px) }
.btn.ghost  { background:transparent; color:var(--fg); border-color:var(--line) }  .btn.ghost:hover { border-color:var(--fg-3); background:var(--bg-2) }
.btn.danger { background:transparent; color:var(--err); border-color:var(--err-line) }  .btn.danger:hover { background:var(--err-soft) }
.btn.sm { height:26px; padding:4px 9px; font-size:11px }   .btn.lg { height:36px; padding:8px 16px; font-size:13px }   .btn[disabled] { opacity:.4 }
.iconbtn { 30×30; radius:var(--rad-sm); border:1px solid transparent; color:var(--fg-3) }  .iconbtn:hover { color:var(--fg); background:var(--bg-2); border-color:var(--line) }
.tb-launch-btn { padding:5px 11px; border:1px solid var(--line); radius:var(--rad); background:var(--bg-2); font:11px var(--jbm) }
  /* hover: accent-line border + accent-soft bg; icon goes white→amber with drop-shadow glow; .on adds box-shadow 0 0 0 1px accent-line, 0 0 14px -4px var(--accent) */
```
"Secondary" = ghost. There is no separate secondary token. Segmented control `.mtp-seg` (Auto/On/Off): bordered 6px-radius group, `.on` = solid `--accent` with `#0a0a0a` text
(note: it references undefined `--border`/`--fg-1` — a dashboard quirk, don't copy).

### 3.7 Tabs / segmented controls

```css
.slot-tabs { display:flex; border-bottom:1px solid var(--line); margin-bottom:18px; }          /* underline tabs, no pills */
.slot-tab { padding:10px 16px; border-bottom:2px solid transparent; font:500 12.5px var(--jbm); color:var(--fg-3); transition:color .12s, border-color .12s; }
.slot-tab.on { color:var(--accent); border-bottom-color:var(--accent); }
.slot-tab .slot-tab-ct { font-size:10px; padding:1px 6px; background:var(--bg-2); border-radius:999px; }  /* count badge; transparent + accent when .on */
.slot-tab .slot-tab-dot.live { width:6px; height:6px; background:var(--comfy); box-shadow:0 0 8px var(--comfy); }
```
Filter/segment choices are `.fpill` (pill) rather than tabs. `.mem-tabs`/`.mdl-chip` follow the same `.on` accent idiom.

### 3.8 Tables

```css
.dtable { width:100%; border-collapse:collapse; font:12.5px var(--jbm); }
.dtable th { text-align:left; font:500 10px var(--jbm); text-transform:uppercase; letter-spacing:.1em; color:var(--fg-3); padding:9px 12px; border-bottom:1px solid var(--line); background:var(--bg); }
.dtable th.sorted { color:var(--accent) }   .dtable td { padding:10px 12px; border-bottom:1px solid var(--line-soft); color:var(--fg-2); white-space:nowrap; }
.dtable td.n { text-align:right; font-variant-numeric:tabular-nums }   .dtable tbody tr:hover td { background:var(--bg-2) }   .dtable td.lead { color:var(--fg) }   .dtable .hero { color:var(--accent) }
/* list-style variant: .mdl-row { grid; padding:10px 16px; border-bottom:1px solid var(--line-soft) }  :hover --bg-2  .sel --accent-bg
   .mdl-list-h { 10px uppercase .1em var(--fg-4); background:var(--bg) } */
```
Wrapped in a panel: `border:1px solid var(--line); radius:var(--rad-lg); overflow:hidden; background:var(--bg-1)`.

### 3.9 Command palette (`.cp-*`)

```css
.cp-backdrop { background:rgba(0,0,0,.55); backdrop-filter:blur(3px); padding:14vh 24px 24px; }
.cp-shell { max-width:640px; background:var(--bg-1); border:1px solid var(--line-strong); border-radius:var(--rad-lg);
  box-shadow:0 32px 96px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,176,0,.05);        /* faint amber hairline ring */
  animation:cp-shell-in .18s cubic-bezier(.22,1,.36,1);  /* from: opacity 0, translateY(-10px) scale(.985) */ }
.cp-input-row { padding:14px 18px; border-bottom:1px solid var(--line-soft) }  .cp-input { font:15px var(--jbm); letter-spacing:-.01em; background:transparent }
.cp-section { padding:12px 18px 6px; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--fg-4) }
.cp-item { display:grid; grid-template-columns:24px 1fr auto; gap:14px; padding:8px 18px; position:relative }
.cp-item:hover,.cp-item.active { background:var(--accent-soft) }
.cp-item.active::before { content:""; position:absolute; left:0; top:4px; bottom:4px; width:2px; background:var(--accent); border-radius:1px }   /* inset stripe */
.cp-item.active .cp-item-ic, .cp-item.active .cp-item-hint { color:var(--accent) }   .cp-highlight { color:var(--accent); font-weight:600 }   /* match highlight */
.cp-foot { border-top:1px solid var(--line-soft); background:var(--bg); padding:8px 18px; font-size:10.5px; color:var(--fg-4) }  /* sunken key-hint bar */
```

### 3.10 Toasts, banners, menus

```css
.hal0-toast { padding:10px 12px 10px 14px; background:var(--bg-2); border:1px solid var(--line-strong); border-radius:var(--rad);
  box-shadow:0 12px 32px -8px rgba(0,0,0,.55); font:12px var(--jbm); max-width:420px; animation:toast-in .18s ease; }   /* translateY(8px) → 0 */
.hal0-toast.info/.ok/.warn/.err { border-left:2px solid var(--X) }    .toast-dot { 6px; box-shadow:0 0 8px var(--X) }
.hal0-toast-stack { position:fixed; right:20px; bottom:calc(var(--footer-h) + 16px); flex-direction:column-reverse; gap:8px }

.banner { display:grid; grid-template-columns:28px 1fr auto; gap:14px; padding:12px 14px; border:1px solid; border-radius:var(--rad) }
.banner-warn { background:color-mix(in oklab, var(--warn-soft) 110%, transparent); border-color:var(--warn-line) }   /* err likewise; info = accent-soft/accent-line */
.banner-ic { 28×28; radius:4px; background:rgba(232,185,78,.18); color:var(--warn) }   .banner-eye { 10px uppercase .1em, tone colour }

.hal0-menu { min-width:200px; background:var(--bg-2); border:1px solid var(--line-strong); border-radius:var(--rad); box-shadow:0 16px 48px -8px rgba(0,0,0,.65); padding:4px }
.hal0-menu-item { padding:7px 10px; border-radius:4px; font:12px var(--jbm); color:var(--fg-2) }  :hover { background:var(--bg-3); color:var(--fg) }
```

### 3.11 Top nav / sidebar / dock

```css
.topbar { height:var(--topbar-h) /*52*/; padding:0 20px 0 18px; background:var(--bg); position:relative }
.topbar::after { /* "filament": 1px hairline, amber at centre, faint under-glow — shared with hal0.dev header */
  height:1px; background:linear-gradient(90deg, transparent 0%, var(--line) 18%, color-mix(in srgb, var(--accent) 70%, var(--line)) 50%, var(--line) 82%, transparent 100%);
  box-shadow:0 1px 14px rgba(255,176,0,.09); }
.tb-cmdk { padding:5px 9px; border:1px solid var(--accent-line); border-radius:var(--rad); font:11px var(--jbm); background:color-mix(in srgb, var(--bg-2) 78%, var(--accent-soft)); }
.tb-cmdk kbd, .kbd { font:10px var(--jbm); padding:1px 5px; border:1px solid var(--line); border-radius:3px; background:var(--bg-1); color:var(--fg-3) }
.tb-bell.on / .has → amber; .tb-bell-badge { 15px pill, bg var(--accent), color #1a1408, box-shadow 0 0 0 2px var(--bg-1) }

.sidebar { width:232px (--sidebar-w); border-right:1px solid var(--line); background:var(--bg); font-size:13px }
.sb-section { padding:14px 12px 6px; font:10px var(--jbm); letter-spacing:.1em; text-transform:uppercase; color:var(--fg-5) }
.sb-row { padding:7px 10px; border-radius:var(--rad); gap:11px; color:var(--fg-2) }   .sb-row:hover { background:var(--bg-2); color:var(--fg) }
.sb-row.active { background:var(--accent-bg); color:var(--fg) }  .sb-row.active::before { left:-8px; top:6px; bottom:6px; width:2px; background:var(--accent); border-radius:1px }
.sb-row .cnt { font:10px var(--jbm); padding:1px 5px; border-radius:3px; background:var(--bg-2) }  .sb-row.active .cnt { background:var(--accent-soft); color:var(--accent) }
.sb-row.sb-sub { padding-left:18px; font-size:12.5px; color:var(--fg-3) }   /* every page-tab is a sub-link (2026-10-24) with an accordion caret */
.sb-status { margin:12px; padding:12px; border:1px solid var(--line); border-radius:var(--rad); background:var(--bg-1); font:11px var(--jbm) }
.footer { border-top:1px solid var(--line); background:var(--bg-sunken) }   /* status dock, 90px = 46px status row + 2×22px ticker rows */
```
Slot rail (right of the Inference pane, 2026-10-26): `.slot-rail { border:1px solid var(--line); border-radius:8px; background:var(--bg-1) }`, group headers sticky,
rows `grid 12px 1fr auto`, `padding:6px 12px`, hover `--bg-2`, row flash `rail-flash` (ok-soft tint fade 1.6s) when the dock reports on a slot.

---

## 4. Recent refinements (`git log --since='2026-09-01' -- ui/src`: 113 commits touching `ui/src`)

Notable style-bearing commits (newest first):

| Date | PR | What changed stylistically |
|---|---|---|
| 2026-10-31 | #3173 | Slot-drawer **Tune block** (`.tune-seg` pill segments with dashed "inherited from profile" variant, `.tune-dot` override marker), tune glyphs on slot rows + model pickers (+19 CSS lines) |
| 2026-10-29 | #3155 | **Overview v2**: `overview.css` (`.ov-now`, `.ov-membar` 46px labelled bar with striped system segment, `.ov-inbox`/`.ov-att` attention rows with 4px state bar); **deleted `redesign.css` (−377 lines)** |
| 2026-10-26 | #3110 | **Status dock** (`dock/dock.css` +295, `slot-rail.css` +175): GPU segment with 3px state rule + 4px mini meter; `--footer-h:90px`; deleted `activity-log.css`, `image-status-line.css` |
| 2026-10-26 | #3093 | Removed unmounted SlotList card + memmap CSS (consolidates on `.scard`) |
| 2026-10-25 | #3078 | **Image Gen pane**: Generate/Models/Engine tabs, GPU status line, fit meters (`image/*.css`) |
| 2026-10-24 | #3033 | Sidebar: every page tab listed as a sub-link (`.sb-sub`, `.sb-caret` accordion) |
| 2026-10-18/19 | #2762, #2773 | Model pickers: compact fit chip, eye glyph, **two-line rows**, bare modality glyphs, runtime chip |
| 2026-09-02 | #2215 | Model drawer second pass: **tune pills** (`.fpill-chg/add/deny/rm`), rich selects, facts band, inline title (+34 CSS) |
| 2026-09-02 | #2208 | Slot drawer "Option B": task regroup, rich rows, GTT hints, inline pull (+92 CSS) |
| 2026-09-02 | #2194 | Profile overhaul: runtime-aware profile UI, new `--dev-cuda` token |
| earlier anchor | #2008 (08-22) | added `--rad-xs`, `--shadow-menu` |
| earlier anchor | #1768 (08-09) | **chrome unified with hal0.dev**: filament, `.iconbtn`, `.searchbtn`, `.fpill`, `.well`, `.dtable`, `--bg-sunken`, `--ease`, `--dur-*` |

**Takeaway:** no new colour tokens, no radius changes, no shadow-scale changes in the last two months. "Slightly improved styling" is component-level:
(1) sectioned cards with sunken header/footer bars and a **2px state stripe with hover glow**; (2) **hover lift** `translateY(-1px)` + soft drop shadow;
(3) RichSelect: 3px `accent-soft` focus ring, two-line rows, chips + glyphs; (4) the **joined `[device | profile]` tag** and square-vs-round semantics;
(5) pill-shaped tune/segment controls where state is shown by tint (accent = on/override, dashed = inherited, warn/ok/err = diff);
(6) labelled memory bar with hover brighten, striped "system" segment, dashed "free" swatch; (7) the status dock and slot rail.

---

## 5. Website vs dashboard — token comparison

Site files: `src/styles/tokens.css` (canonical `--hal0-*`), `global.css` (Starlight/Tailwind bridge, focus, selection), `site.css` (`.site` alias layer
`--bg`, `--bg-1` … → `--hal0-*`, header filament, search palette, drawer, footer), `site-data.css` (ported `.btn`, `.chip`, `.dot`, `.fpill`, `.dtable`; imported by `index.astro`,
`profiles*.astro`). Landing-specific CSS is a big `<style is:global>` block in `src/pages/index.astro` (L686–1643).

### 5.1 Raw token differences

| Token | Site (`tokens.css`) | Dashboard | Verdict |
|---|---|---|---|
| accent / hover / muted / glow | #ffb000 / #ffc533 / #7a5500 / .18 | identical | none |
| `bg` | #0a0a0a | #0a0a0a | none |
| card surface (`bg-1` / `bg-elevated`) | **#141414** | **#111111** | site slightly lighter; keep (see R-14) |
| `bg-2`, `bg-3` | #161616, #1c1c1c | #161616, #1c1c1c | none |
| `bg-sunken` | #050505 | #070707 | trivial |
| `bg-4` | — | #232323 | skip |
| `fg` | #f5f5f4 | #f5f5f2 | trivial |
| `fg-2` / muted | #c8c2bd | #c8c8c2 | trivial |
| `fg-3` / dim | **#a3a09c** | **#8a8a85** | **site is deliberately lighter (AA); keep.** |
| `fg-4` / faint, `fg-5` / ghost | #5c5c58, #3d3d3a | identical | none |
| borders | #262626 / #1c1c1c / #3a3a3a | identical | none |
| `accent-soft`, `accent-line` | .10, .34 | identical | none |
| **`accent-bg`** (solid #2a1d00 wash) | **missing** | used for selected/active rows (sidebar, rich-select current, model row `.sel`) | **add** |
| status ok/warn/err/info + soft/line | identical hex & alphas | identical | none |
| `ok-glow`, `warming-glow` | missing | .35 alphas | add (optional) |
| device rocm/vulkan/cpu/npu | identical | + `--dev-cuda #8fce6f`, `--dev-img #3c6597` | add if site shows these lanes |
| radii | rad 6 / sm 4 / lg 10 / pill 999 | + **`--rad-xs 3px`**, `--rad-xl 14px` | add `--hal0-rad-xs: 3px` |
| motion | `--hal0-ease`, `--hal0-dur-fast .12s` | + `--dur .18s`, `--dur-slow .22s` | add |
| `shadow-menu` | `0 16px 48px -8px rgba(0,0,0,.7)` | token `0 8px 24px rgba(0,0,0,.45)`; hardcoded menus use `0 16px 48px -8px rgba(0,0,0,.65)` | site matches the hardcoded form; fine |
| `shadow-drawer` | `-24px 0 64px -16px rgba(0,0,0,.6)` | `-20px 0 60px -16px rgba(0,0,0,.6)` | close; fine |
| `--shadow-toast` | — | `0 12px 36px -12px rgba(0,0,0,.6)` | n/a (no toasts on site) |
| memory palette `--mem-slot-1..8` | — | Okabe-Ito set | add if the memory bar adopts per-slot hues |
| fonts | JBM display+mono, Geist body | same | none |
| base font size | 15px body (`.site-body`), 13px small | 13.5px base | keep (reading scale vs console scale) |

### 5.2 Concrete deltas ("site uses X, dashboard uses Y, recommend Z")

**R-1 Status dot semantics are inverted on the landing page (highest priority, content-correctness).**
- Site hero artifact (`index.astro` ~L1008–1018): `.slot-name.ready .ring` = **green** `#6fcf97`; `.serving .ring` = **amber** with pulse; `.idle` = dim.
- Dashboard (`.sdot`): **serving = green + glow + pulse; ready = solid amber, static.**
- Recommend: swap — serving → `var(--hal0-ok)` + `0 0 8px` glow + `pulse 1.4s`; ready → `var(--hal0-accent)` static. Also `.slot-state.serving/.ready` text colours.
  Replace hardcoded `#6fcf97` (also in `.ticker .dot`, `.art-pulse`, `.pill.ok`) with `var(--hal0-ok)`.

**R-2 Left state stripe.** Site cards have none. Dashboard cards/profile cards carry a 2px left stripe keyed to state (`--bk`), `opacity:.85`, with `box-shadow: 0 0 12px var(--bk)` on hover.
- Recommend: use on `FeaturedProfiles` cards (backend hue via `--hal0-dev-*`) and the hero artifact slot rows; for plain feature cards leave off (decorative stripe on non-stateful cards dilutes the meaning).
  Existing `.tier.first-class::before` (top 2px amber bar) can stay; it is a different semantic ("featured").

**R-3 Card hover.** Site: `.uc-card:hover`/`.shot:hover` = `border-color: --hal0-border-strong` + `translateY(-2px)`, 200ms; `a.feat-link:hover` = amber border, `transition: border-color .15s`; `.feat-card`/`.tier` have no hover.
Dashboard: `border-color: var(--line-strong)` + `translateY(-1px)` + `box-shadow: 0 6px 20px rgba(0,0,0,.28)`, 150ms.
- Recommend: one shared hover recipe — `translateY(-1px)`, `--hal0-border-strong`, `0 6px 20px rgba(0,0,0,.28)`, `0.15s ease` — applied to every *interactive* card (uc-card, feat-link, FeaturedProfiles, BenchHighlights, LatestWriting). Keep amber-border hover for links-as-cards if desired but add the shadow. Keep the `prefers-reduced-motion` guard that `.shot` already has.

**R-4 Card anatomy: sunken header/footer bars.** Dashboard: `.scard-h` (`10px 12px`, `border-bottom: 1px solid line-soft`), `.scard-foot` / `.drawer-foot` / `.cp-foot` / `.dtable th` all use `background: var(--bg)` (darker than the `--bg-1` card) with a hairline.
Site: `.install-head`, `.art-head` use `border-bottom: --hal0-border` on the same surface; only `.art-foot` and `.matrix-row.head`/`.cmp-row.head` use `--hal0-bg`.
- Recommend: standardise "bars are `--hal0-bg` (page bg) inside a `--hal0-bg-elevated` card, hairline is `--hal0-border-soft` for internal dividers and `--hal0-border` only for outer edges". Concretely switch `.install-head`/`.art-head` to `background: var(--hal0-bg)` + `border-bottom-color: var(--hal0-border-soft)`; use `--hal0-border-soft` for `.slot-row` and `.matrix-row`/`.cmp-row` inner dividers (currently all `--hal0-border`).

**R-5 Radius consistency.** Site mixes 10px (`.install`, `.artifact`, `.feat-card`, `.tier`, `.matrix`, `.compare`, `.agent-tiles`), **12px** (`.uc-card`, `.shot-hero`), **8px** (`.shot`, lightbox img), 4px (buttons), 3px (`.pill`), 999px (`.eyebrow`, `.ep-chip`). Dashboard: strictly `lg 10px` panels/cards, `6px` controls, `4px` buttons/inset, `3px` chips, `999px` pills.
- Recommend: collapse 12px and 8px onto `--hal0-rad-lg` (10px) for cards/screenshots; keep 999px only for pills/eyebrow. Add `--hal0-rad-xs: 3px` and use `var(--hal0-rad-*)` instead of literals in `index.astro` (it currently hardcodes `10px`/`4px`/`3px`/`999px`).

**R-6 Pill/chip styling.**
- Site landing `.pill`: uppercase, `letter-spacing:.06em`, `10px`, radius 3px, `--hal0-bg-elevated` — dashboard `.chip`: **lowercase**, `letter-spacing:.02em`, `--bg-2` fill, same radius/size. Tag-like uppercase is reserved in the dashboard for `profile-pill`/`default-badge` (9–9.5px, `.04–.08em`).
- Site `.eyebrow` (landing): 999px pill with `background: var(--hal0-accent-glow)` (**.18** alpha) and `color-mix(accent 34%)` border; `.ep-chip` also uses `accent-glow` (.18). Dashboard amber chips use `--accent-soft` (**.10**) + `--accent-line` (.34).
- Recommend: use `.chip` / `.chip.amber` / `.chip.ok` from `site-data.css` (already ported) instead of landing `.pill`/`.ep-chip`; replace `accent-glow` fills with `--hal0-accent-soft` + `--hal0-accent-line`. Adopt "round = status dot, square = category swatch" for any device/runtime tag (`.dchip .sw` 8px, radius 2–3px).

**R-7 Buttons.** Landing `index.astro` redefines `.btn` (`padding 8px 14px`, `gap 8px`, `letter-spacing -0.01em`, no height). Because `.site .btn` in `site-data.css` has higher specificity (0,2,0 vs 0,1,0) and `<body class="site">`, the landing rule is dead code today — buttons already render the dashboard spec (30px, 12px/600, 4px radius, `brightness(1.06)` hover).
- Recommend: delete the duplicate `.btn`/`.btn.ghost`/`.copy-btn` rules from `index.astro`; add `.btn.sm` for copy button. No visual change; removes drift risk. Optionally add `.btn:focus-visible` handled by global ring (already is).

**R-8 Focus/field treatment.** Dashboard inputs/selects: `border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-soft)` on focus/expanded. Site's global `:focus-visible` is a 2px solid amber outline with 3px offset (matches the dashboard's keyboard ring). `profiles/submit.astro` (`.tin`, `.input`) ALREADY uses the dashboard's exact recipe (`border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-soft)`), so fields there are aligned. The only gap found is the search palette's input (`.pal-in input { outline: 0 }`, no ring of its own; the row has no focus affordance).
- Recommend: leave `profiles/submit` alone; optionally give `.pal-in` a `:focus-within` treatment (e.g. bottom border `var(--accent-line)`); keep the outline ring for buttons/links.

**R-9 Command palette (`dialog.pal`).** Site: 560px, `--hal0-shadow-menu`, backdrop `rgba(5,5,5,.55)` + `blur(2px)`, row active = `accent-soft` + `inset 2px 0 0 accent` (full-height stripe), `pal-in` 13.5px, `.pal-msg` section label. Dashboard: 640px, `0 32px 96px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,176,0,.05)` (faint amber ring), `blur(3px)`, active stripe is **inset** (`top:4px; bottom:4px; radius 1px`), input 15px, `.cp-foot` key-hint bar, `.cp-highlight` amber bold on match, enter animation (`translateY(-10px) scale(.985)`, .18s).
- Recommend: add the amber hairline ring to the shadow, inset the active stripe (4px top/bottom), add an enter animation guarded by `prefers-reduced-motion`, add a sunken `.pal-foot` with key hints (`↑↓ navigate · ↵ open · esc close`), keep 560px width. Apply the same to the Starlight Pagefind modal in `site-starlight.css` for parity.

**R-10 Nav active state.** Site header: bottom 2px amber bar with `box-shadow: 0 0 8px accent-glow` (nice, keep). Site mobile drawer row: `accent-soft` + inset 2px stripe. Dashboard sidebar: `--accent-bg` solid wash + external 2px bar.
- Recommend: keep the header; in `StarlightSidebar` and mobile drawer `.row.on`, use `background: var(--hal0-accent-bg)` (new token) + 2px stripe, matching the dashboard sidebar; sub-items 12.5px `--fg-3` with 18px indent (docs sidebar already similar).

**R-11 Memory bar (landing `.mem-bar`).** Site: 10px tall, radius 2px, track `--hal0-border-strong` (#3a3a3a), segments `a/b/c/d` with opacity hacks (`#6aa4ff` @.6, `#6fcf97` @.5, `fg-dim` @.4) — `#6aa4ff` is not a token. Dashboard: 14px (tall 17px), radius 3px, track `--bg-3`, 1px segment divider (`inset -1px 0 0 var(--bg-1)`), hover `brightness(1.3)`, legend swatch 9px radius 2px with dashed "free" swatch, header row `label ... <b>used</b> / total`; Overview variant has 46px labelled segments + striped system segment.
- Recommend: track `var(--hal0-bg-3)`, height 14px, radius 3px, 1px `bg-elevated` dividers, solid (no opacity) segment colours from tokens: slot A `--hal0-accent`, B `--hal0-dev-vulkan`, C `--hal0-ok`, D `--hal0-dev-cpu`; "free" legend swatch dashed `1px --hal0-border-strong`; add `transition: filter` hover brighten. Optional: striped OS segment (`repeating-linear-gradient(45deg…)`).

**R-12 Tables.** Site `.dtable` is a verbatim port of the dashboard's (identical). Landing `.matrix`/`.cmp-row` are grid divs: head `10px uppercase .1em var(--hal0-fg-dim)` on `--hal0-bg`, cell padding `16px 20px`, inner dividers `--hal0-border`, row hover `--hal0-bg` (darker!). Dashboard hover is `--bg-2` (lighter), cells `10px 12px`, inner dividers `--line-soft`.
- Recommend: row hover → `var(--hal0-bg-2)`; inner dividers → `--hal0-border-soft`; tighten padding to `12px 16px` (keep reading comfort; 10px 12px is dense-console). Mark the "us" column with `accent-soft` (not `accent-glow`).

**R-13 Section labels / eyebrows.** Site `.sec-tag`: 11px amber uppercase `.12em`. Dashboard section heads: `.sec h2` 12px `--fg-3` uppercase `.1em` + hairline rule filling the row (`.sec .rule`), and pane headings `.sec-label b` amber 500 uppercase `.1em` followed by dim `·` separators and 11px `--fg-4` meta segments.
- Recommend: keep amber `sec-tag` for page sections, but standardise tracking to `var(--hal0-ls-label)` (.1em, token exists, currently `.12em` hardcoded in `.eyebrow`, `.sec-tag`, `.tier-tag`) and optionally add the trailing hairline (`.sec .rule`) for in-page subsection heads.

**R-14 Card surface luminance.** Site cards `#141414`; dashboard `#111111`. Screens placed on the site (`shot-hero`) are `--hal0-bg-sunken` framed, so dashboard captures sit on #050505 outer / #0a0a0a / #111 inner. No change needed; if exact parity is wanted, set `--hal0-bg-elevated: #111111` — but this lowers card/page separation (#0a0a0a vs #111) which suits dense UI better than marketing. **Recommendation: leave at #141414.**

**R-15 Typography.** Dashboard micro-type: 9–10px mono uppercase labels (`.08–.1em`), values 13–15px mono `-0.02em`, display metrics 19–30px mono 500. Site equivalent already exists (`.eyebrow` 10px, `.tier-stat .v` 20px). No change except use `--hal0-ls-label` consistently (R-13). Use `font-variant-numeric: tabular-nums` + `"zero" 1` on numeric readouts (site `.num` exists; ensure `slot-toks`, `tier-stat .v`, `disp-val` carry it — dashboard `.num` does).

**R-16 Elevation.** Dashboard cards at rest have no shadow; only hover (`0 6px 20px rgba(0,0,0,.28)`), floating menus (`0 16px 48px -8px rgba(0,0,0,.65)`), and the palette's deeper shadow. Site's `.install-hero` (`0 18px 60px -24px accent@45%`) and `.shot-hero` (`0 30px 80px -40px accent-glow`) use amber-tinted ambient glows; fine as marketing emphasis, but keep to one hero element per page (amber glow = "live/primary").

**R-17 Dark-first and light mode.** Dashboard is dark-only. Site keeps a light theme (`[data-theme='light']`); any new token (`--hal0-accent-bg`, `--hal0-rad-xs`, `--hal0-dur`) needs a light value. Suggested `--hal0-accent-bg` light: `#fdf3d7`.

### 5.3 Suggested token additions to `tokens.css` (additive, non-breaking)

```css
:root {
  --hal0-accent-bg:   #2a1d00;               /* selected / active row wash (dashboard --accent-bg) */
  --hal0-rad-xs:      3px;                   /* chips, kbd, swatches */
  --hal0-dur:         0.18s;
  --hal0-dur-slow:    0.22s;
  --hal0-shadow-hover: 0 6px 20px rgba(0,0,0,0.28);   /* interactive card hover */
  --hal0-ok-glow:     rgba(111,207,151,0.35);
  --hal0-warn-glow:   rgba(232,185,78,0.35);
  --hal0-dev-cuda:    #8fce6f;               /* only if the site surfaces CUDA lanes */
}
[data-theme='light'] {
  --hal0-accent-bg:   #fdf3d7;
  --hal0-shadow-hover: 0 6px 20px rgba(0,0,0,0.10);
}
```
`site.css`'s alias block would then add `--accent-bg`, `--rad-xs`, `--dur`, `--shadow-hover`.

### 5.4 Suggested implementation order (smallest blast radius first)

1. Tokens (5.3) + replace hardcoded hex/px in `index.astro` with tokens (R-1 hex, R-5, R-6, R-13 tracking). No visible change except R-1's swap and `accent-glow` → `accent-soft`.
2. **R-1** status-dot semantics (landing hero artifact) — content-correctness.
3. R-7 delete dead `.btn` rules.
4. R-3/R-4 shared card recipe (hover lift + shadow, sunken header/footer) across landing cards and `FeaturedProfiles`/`BenchHighlights`/`LatestWriting`.
5. R-11 memory bar, R-12 table hover/dividers, R-6 chips.
6. R-9 palette, R-10 nav active, R-8 field focus.
7. R-2 state stripe on stateful cards only.

### 5.5 Things to avoid copying from the dashboard

- Undefined vars: `.mtp-seg*` uses `--border`, `--fg-1` (no definitions); `.tune-seg` falls back through `var(--line, var(--fg-4))`; `.hint.err` uses `var(--err, #ff6b6b)` with an off-token fallback.
- Scoped accent re-theming via `--comfy` inside `.infer-pane`/`.npu-pane` (the variable name is a misnomer after being repurposed for yellow/purple). The site needs only the amber accent.
- Mobile/density choices (13.5px base, 9px labels) — keep the site's reading scale (15px body, 13px small) per `site.css` "reading type scale (site only; console scale stays dense)".
- The dashboard's `.btn` has no `transition`; the site's version (with `filter/border-color/background` transitions) is better.
- Dashboard has a `--shadow-menu` token (`0 8px 24px .45`) that disagrees with the shadow its menus actually use (`0 16px 48px -8px .65`) — the site's token value matches the real menus.

---

## 6. File index (for the implementer)

- Dashboard token source: `/home/mint/projects/hal0/ui/src/dashboard.css` L1–140 (`:root`), L559 (sidebar), L1089 (`.btn`), L1116 (`.chip`), L1186 (`.iconbtn`/`.searchbtn`/`.fpill`/`.dtable`), L2814 (toast), L2866 (command palette), L3010 (drawer), L3477 (RichSelect), L3733 (profile drawer), L4054 (Tune block).
- Slot card: `/home/mint/projects/hal0/ui/src/dash/engine-panes.css` L944–1420 (+ memory bar L721–790, gauge L630); markup `dash/inference-pane.jsx` L860–975.
- Status dots: `dash/overhaul.css` L66–110 (`.sdot`); `dash/slot-rail.css`; `dash/dock/dock.css`.
- Overview v2: `dash/overview/overview.css`.
- Site: `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/site.css`, `src/styles/site-data.css`, landing CSS `src/pages/index.astro` L686–1643.
