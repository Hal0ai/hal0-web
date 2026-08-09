# Design handoff prompt — hal0.dev unified community platform

Copy everything below the line into a Claude design session. Companion to
`2026-08-09-community-platform-design.md`.

---

You are designing the next generation of **hal0.dev** — the home for the Strix
Halo / NPU / Gorgon Halo local-AI ecosystem. The site is expanding from a
release/docs site into a community platform: benchmarks with community
submissions, a shared profile (config) registry, a blog/knowledge base, and a
Discourse forum at forum.hal0.dev. Your job is **pages, component mockups, and
wireframes** — high-fidelity HTML/CSS mockups where possible, wireframes where
flows need exploring. No production code, no backend.

## Non-negotiable: one site, not four

Every surface — landing, docs, blog, KB, benchmarks, profile gallery, and the
forum — must share **identical header, footer, nav contents, colors, typography,
and logo usage**. The single biggest failure mode is the platform feeling like
four sites stuck together. Design the unified chrome FIRST and reuse it in every
subsequent mockup verbatim.

## Brand system (already decided — do not redesign)

- **Accent:** sodium amber `#FFB000` (vacuum-tube / server-LED glow). Hover
  `#FFC533`, muted/dim `#7A5500`. Amber is the only accent — no blues/purples.
- **Background:** dark-first, near-black `#0a0a0a` family. Light mode exists via
  toggle but dark is default and the flagship look.
- **Type:** Geist Variable for body/UI, JetBrains Mono for code, numbers, data,
  and anything terminal-flavored. Benchmarks and profile data should lean Mono —
  the mental model is terminal / firmware / debugger.
- **Logo:** "hal0" wordmark with a slashed-zero glyph; the slashed-zero doubles
  as the mark-only icon. Amber slashed-zero on dark.
- **Tone:** hardware-real, precise, understated. Server-rack indicator lights,
  not SaaS gradient glow.

## Deliverables

### 1. Unified chrome (do this first — everything else inherits it)

- **Header:** wordmark left; nav: Docs, Benchmarks, Profiles, Blog, Forum;
  right: GitHub + Discord icons, theme toggle, search. Show active-section
  state (works across domains — Forum is highlighted when on forum.hal0.dev).
  Desktop + mobile (drawer) states.
- **Footer:** identical on every surface. Nav links, community links (GitHub,
  Discord, Forum), license/credits line. Design once, byte-for-byte reuse.
- **Forum variant:** same header, but Discourse-native controls (search, user
  avatar/menu, notifications) integrated into the right cluster. Mock a forum
  topic-list page wearing this chrome so we can verify it doesn't feel bolted on.
- Deliver as a component sheet: header (desktop/mobile/forum variants), footer,
  buttons, cards, filter pills, status badges, table styles.

### 2. Benchmarks section

Community-submitted benchmark data (one JSON file per run, merged via PR,
rebuilt on merge). Design:

- **Benchmarks index:** expanded charts with a filter bar — hardware (e.g.
  Strix Halo 395, 370), model, runner (llama.cpp, ONNX, FLM...), backend
  (ROCm / Vulkan), quant. Charts + sortable results table (Mono numerals:
  tokens/sec, TTFT, memory). Show which results are community-submitted vs
  first-party (subtle attribution: GitHub avatar + username).
- **Per-model comparison page:** one model across hardware/runner/backend/quant
  combos. "What does Qwen3-32B do on my box" is the core question.
- **"Share your results" entry point:** visible on the index. Leads to the
  submission flow (section 4).

### 3. Profile registry + gallery

Profiles = versioned config files (llama.cpp args, slot configs, quant choices)
living in a `hal0-profiles` repo, submitted via PR. Design:

- **Gallery/list page:** browsable cards, filter by hardware, model family,
  runner, quant. Card shows: profile name, target hardware, runner, author
  (GitHub avatar), version, and a headline bench number if linked.
- **Profile detail page:** the config itself (Mono, syntax-highlighted,
  copy button), install command (`hal0 profile install <name>`), version
  history, author, and — the killer feature — **linked benchmark runs**:
  "this config produced these numbers" with the actual runs joined by profile
  slug. Design this join prominently; it ties the whole platform together.
- **Share/submit entry point** consistent with benchmarks (section 4).

### 4. Submission flow (two doors, one queue)

Users never need to understand PRs. Both doors end as a PR in an org data repo
(`hal0-bench-data` / `hal0-profiles`) reviewed by CI + maintainer.

- **Door A — CLI:** `hal0 bench --share` / future `hal0 profile share`. Design
  the web touchpoints only: the "success" landing page a user hits after the CLI
  opens their PR (PR link, what happens next, review status).
- **Door B — web upload:** wireframe the full flow: "Sign in with GitHub" →
  drag-and-drop the JSON file the CLI already wrote → instant client-side schema
  validation (design both the pass state and actionable error states — bad
  schema, missing machine profile, implausible numbers) → confirm → "PR opened
  on your behalf" confirmation with link and expected review timeline.
- **Status affordance:** how a submitter sees where their submission is
  (validating / awaiting review / merged / changes requested). Can be as simple
  as linking the PR, but design what the site shows.

### 5. Blog / knowledge base

- **Blog:** dated posts (existing starlight-blog), index + post page wearing the
  unified chrome. RSS affordance.
- **KB:** a separate evergreen section — guides, hardware notes, explainers,
  tool reviews — docs-style pages in the sidebar, NOT dated posts. Design the
  KB landing (categories) and how blog vs KB vs docs are visually distinguished
  yet obviously the same site.
- Include OG/social-card template design: one template used by blog, KB, bench,
  and profile pages so any shared hal0.dev link looks identical.

### 6. Homepage integration

Update the landing page to surface the community: latest forum topics strip
(degrades to hidden if the forum API is unreachable — design without it too),
headline bench stats, featured profiles, latest blog post. Keep the existing
marketing hero character.

## Working notes

- Astro + Starlight + Tailwind v4 is the implementation target; keep mockups
  buildable in that world (no exotic layout tricks).
- Mobile matters for reading surfaces (blog/KB/forum); data surfaces
  (bench tables, profile detail) may prioritize desktop but must degrade sanely.
- Real-ish placeholder data: Strix Halo hardware names, actual model names
  (Qwen3, Llama, GPT-OSS), plausible tokens/sec figures — no lorem ipsum.
- Deliver each section as its own artifact/page; start with section 1 and get
  the chrome right before fanning out.

## Addendum — exact values from the implementation (match these)

**Full token palette** (dark, default — use these literal values):

```css
--hal0-accent: #ffb000;        --hal0-accent-hover: #ffc533;
--hal0-accent-muted: #7a5500;  --hal0-accent-glow: rgba(255,176,0,0.18);
--hal0-bg: #0a0a0a;            --hal0-bg-elevated: #141414;
--hal0-bg-sunken: #050505;     --hal0-fg: #f5f5f4;
--hal0-fg-muted: #c8c2bd;      --hal0-fg-dim: #a3a09c;
--hal0-border: #262626;        --hal0-border-strong: #3a3a3a;
```

Light mode accent is `#b87800` (AA on light backgrounds), bg `#fafaf9`,
text `#1c1917`.

**Nav conventions:**
- Labels are lowercase JetBrains Mono everywhere: `docs`, `benchmarks`,
  `profiles`, `blog`, `forum` — never Capitalized.
- Target header set (design for this): docs · benchmarks · profiles · blog ·
  forum, then right cluster: github, discord icons, theme toggle, search.
- Footer set: docs, blog, changelog, releases, contributing, roadmap,
  hello@hal0.dev, github, discord — plus wordmark and a mono
  `Apache-2.0 · v<version>` line, on the sunken background (`#050505`) with a
  top border.
- Active nav link renders in accent amber (`#ffb000`) with `aria-current`.

**Wordmark construction:** "hal" set in Monomaniac One + slashed "0" in
JetBrains Mono, amber zero on dark. The slashed-zero alone is the mark-only
glyph. Don't redraw; treat as a fixed asset.

**Existing header signature (keep it):** sticky nav, frosted near-black
(`rgba(10,10,10,0.85)` + 12px blur) with a 1px "filament" line along the
bottom edge — a gradient that brightens to sodium amber at center, plus a
faint amber under-glow. On the landing page the nav starts transparent and
promotes to solid past the fold. This is the "the rack is on" motif; carry it
to every surface including the forum chrome.
