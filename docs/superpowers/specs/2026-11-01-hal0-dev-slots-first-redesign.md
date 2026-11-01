# hal0.dev slots-first redesign — design

Date: 2026-11-01. Status: draft for operator approval. Mockups accompany this
document (landing page and releases page, published as artifacts).

Research inputs, committed under `docs/superpowers/research/2026-11-01/`:
`product-inventory.md` (product facts at hal0 `f44fdb7`, stable v1.7.1),
`dashboard-tokens.md` (dashboard CSS at the same commit), `site-audit.md`
(content + SEO audit of hal0.dev at `46d1411`; its B7 table is the source for
every title and description), `competitive.md` (field survey, 80+ sources; its
section A is the source for every compare-table cell). The screenshot
feasibility report stays out of the repo because it names lab hosts; its
usable findings are in section 10.

Mockups: https://claude.ai/artifact/Wq42dwFGgAdYsvvLa4Nax2 (landing page,
with `releases.html` for the releases page). The mockup copy is the first
draft of the site copy; the implementer takes it as the brief and keeps its
structure. The mockup source (`index.html`, `releases.html`, `hal0-site.css`)
is attached to that artifact as files.

## 1. Intent

The forum now carries the technical reference, so hal0.dev narrows to one job:
make the case for hal0 to someone who owns or is buying a capable Linux box
(Strix Halo first) and wants local AI that is private, current, and already
wired to the tools they use. The page argues for a way of running local AI
(several specialised models in named slots, swapped from a dropdown, clients
never reconfigured), shows the product doing it with fresh screenshots, and
routes readers to the forum for depth, to `/benchmarks` for numbers, and to
`/releases` for what changed.

Tone: professional, specific, promotional without hype. Written by people who
run the thing. No "unleash", "seamless", "revolutionary", "supercharge". No
headline built on "not X, but Y". No em-dash asides. Every claim traceable to
the product repo; where the product is only partly there, the copy says what
is there.

## 2. Goals

1. Landing page leads with the philosophy (specialised models in slots, not
   one giant model), then the slot-as-model advantage, then privacy, then
   wiring and memory, then proof (console, hardware, comparison, benchmarks,
   releases), then an FAQ, then get-it.
2. Every claim verified against hal0 at stable. Nightly-only features are
   either omitted or labelled "preview".
3. New screenshot set from CT150 showing the current UI: slot cards with
   pickers, the slot drawer with the resolved command, Open WebUI's model
   picker listing slots, memory bank, MCP page, agents, stacks, image gen,
   settings/security, the dock.
4. Styling stays the current system (sodium amber, Geist body, JetBrains
   Mono display, dark-first) and adopts the dashboard's component
   refinements (one card recipe, correct status-dot semantics, sunken bars,
   chips, 10px radius, accent-bg selections).
5. SEO becomes deliberate: per-page titles and descriptions, a JSON-LD graph,
   a visible FAQ with FAQPage markup, breadcrumb and dataset markup, per-profile
   static pages, lighter images, a slimmer releases page, GA4 live.
6. Clear links from every page: forum, docs (forum Docs category),
   benchmarks, releases.

## 3. Non-goals and anti-goals

- Not a docs site. No install walkthrough, CLI reference, systemd directive
  list, or runner build pins on the landing page. The runner catalogue moves
  off the landing page (it stays reachable on the forum).
- No version numbers in marketing copy (standing rule since 2026-10-15).
  The hero eyebrow and releases page read the latest tagged stable from data.
- No fabricated or re-dated benchmark numbers. The June sweep stays labelled.
- No claims the product inventory marked NOT BACKED: a content-aware router,
  third-party MCP servers flowing to agents, profiles being "picked up" by
  clients, sandboxed agents, n8n, vLLM, multi-box.
- No redesign of the brand. Same wordmark, palette, type.
- No change to the forum theme beyond the header mirror (section 9).

## 4. Facts that shape the copy (from `product-inventory.md`)

Use these as the source for every sentence on the landing page.

Backed, say plainly:
- One OpenAI-compatible `/v1` on `:8080` serves chat, embeddings, rerank,
  speech-to-text, text-to-speech and images; each capability runs in its own
  container on a loopback port.
- `GET /v1/models` lists each bound chat slot by its slot name (`agent`,
  `coder`, ...). `model: "agent"` is rewritten to whatever model the slot
  holds. Hermes defaults to `hal0/agent`, pi to `agent`, Hindsight memory
  extraction to `hal0/memory`. Open WebUI lists slots in its picker within
  seconds of a change.
- Swapping the model behind a slot is a dropdown on the slot card (or
  `hal0 slot swap`). Clients keep their config. The slot reloads; requests
  during the reload get a 503 with Retry-After. Copy says "swap the model,
  keep the name", never "instant".
- Model = facts, profile = tune, slot = placement, enforced on write. The
  slot drawer shows a resolved command with every flag labelled by owner.
- Ten seeded slots: `agent, brain, coder, embed, flm, img, qwen3tts, rerank,
  tts, utility`. Custom slots are one command. There is no seeded `memory`
  or `research` slot; use `agent`, `coder`, `embed`, `img`, `stt`/`tts` in
  examples and show `research` only as a custom slot.
- Several slots run side by side within the memory pool, with priority
  eviction. Image rendering takes the GPU exclusively and pauses GPU chat
  slots while it runs (copy: "image generation borrows the GPU while it
  renders").
- Routing is by endpoint and model name: `/embeddings` goes to `embed`,
  `/audio/speech` to `tts`, `/images/*` to `img`, chat with no model to
  `agent`. There is no content-aware router. Copy: "one API, one slot per
  medium". Tool-calling models can hand off to other slots (OmniRouter) only
  when a request opts in; mention at most as "optional".
- Memory: a local Hindsight engine on loopback, 26 MCP tools (recall,
  reflect, directives, mental models), shared and private namespaces, a
  bank workspace with a graph view. Hermes and pi are wired to it
  automatically. Any MCP client can connect to `/mcp/memory`. Copy: "one
  memory your agents share", not "agents talk to each other".
- MCP: hal0 exposes `/mcp/admin` (189 tools at HEAD, 57 gated behind human
  approval) and `/mcp/memory` as Streamable HTTP. Hermes (every profile) and
  pi are configured for both automatically. Other clients paste one line.
  Do not hard-code the tool count in copy; if shown, generate it.
- Bundled: Open WebUI (chat, voice, document RAG on hal0 embeddings, image
  button through ComfyUI), Hermes agent (third party, pinned), pi coding
  agent (opt-in, needs a restart to see new slots), ComfyUI, Hindsight.
  hal0-brain steward answers questions about the box; read-only by default.
- Privacy: inference local; no telemetry code; crash reports opt-in and off;
  bench and doctor bundles never upload on their own; no account. The
  dashboard, when open, checks releases.hal0.dev and Hugging Face for
  updates. The API and Open WebUI are open on the LAN by default; key auth
  is optional; no TLS. Copy: "Your prompts and files stay on your box unless
  you connect an upstream. No telemetry. No account. It serves your LAN, so
  keep it there or turn on key auth." The "million-dollar idea" line is
  allowed as a light aside inside that frame.
- Install: one line, cosign-verified; stable/preview/nightly channels;
  `hal0 update` with `--rollback`; digest-pinned runner images.
- Hardware: Ryzen AI Max+ 395 and 385/390 first-class; AMD discrete supported;
  NVIDIA experimental; CPU-only works for small models; Proxmox LXC
  supported; Linux + systemd + podman only.
- Security wording: privileged operations go through an allow-listed root
  seam; the agent's terminal tool is off by default; gated tools wait for a
  human. Never "sandboxed".

Nightly only (omit from copy and screenshots unless labelled "preview"):
agent bridge / `hal0-agents` MCP server, Overview briefing page, per-slot
tune overrides.

## 5. Information architecture

### 5.1 Header (every page)

`home · docs ↗ · benchmarks · profiles · releases · forum ↗`, plus search,
GitHub, Discord, theme. "releases" is new. "docs" keeps pointing at the forum
Docs category. Blog stays in the footer. The forum theme mirrors the header
(section 9).

### 5.2 Routes

| Route | Change |
|---|---|
| `/` | Rewritten per section 6 |
| `/releases` | New canonical for the changelog page (section 7). `/changelog` 301 → `/releases` (currently the reverse) |
| `/benchmarks` | Copy touch-ups, h2 structure, Dataset markup, honest date banner stays |
| `/profiles` | h2 added, description shortened; `/profiles/<slug>/` static pages added (section 8.4) |
| `/blog` | Per-post descriptions and titles ≤50 chars before the suffix |
| `/contributing` | Title/description only |

## 6. Landing page

Sections in order. Each entry gives the purpose, the content, and the visual.
Copy below is the direction; the mockup carries the first draft of the
actual words, and the implementer takes the mockup copy as the brief.

1. **Hero.** H1 stays "Own Your Inference" (operator decision, #127).
   Eyebrow: latest stable from data + Apache-2.0. Lede introduces the thesis
   in two sentences: several specialised models on one box, each in a named
   slot; apps and agents talk to the slot, so the model behind it changes
   from a dropdown and nothing else does. CTAs: "Read the docs" (forum),
   "Star on GitHub". Right column: the live slot board, rebuilt as an
   interactive demo "Swap the model, keep the name": slot cards for `agent`,
   `coder`, `embed`, `img`, each with a working model picker; a client strip
   (Open WebUI, Hermes, pi, Hindsight) that stays connected as the viewer
   swaps. Status dots use dashboard semantics (serving green pulse, ready
   amber). Installer row stays below the grid. The demo's model names must be
   real entries from the product's curated catalogue or public Hugging Face
   repos at build time (the mockup's names are illustrative); a swap shows
   the warming state for about 1.5 s and the "clients unchanged" line, and
   the `/v1/models` readout never changes.
2. **The idea.** Heading on the order of "One giant model is the wrong shape
   for a home box." Three columns: Slots (placement: a name, a device, a
   port), Profiles (tune: context, thinking, vision, flags; forkable),
   Models (facts: the file). Below, a one-line endpoint map: chat → agent,
   code → coder, embeddings → embed, speech → stt/tts, images → img. One
   sentence on parallelism with the image-mode caveat.
3. **Swap the model, keep the name.** The slot-as-model advantage. Left:
   copy with the client list and what each defaults to. Right: two
   screenshots stacked or side by side: the slot card with its picker open,
   and Open WebUI's model picker listing `agent · <model>`, `coder · <model>`
   (new capture). A small "how it works" strip: `/v1/models` lists slots;
   `model: "agent"` resolves to the bound model; swap reloads the slot in
   the background.
4. **Stays on your box.** Privacy section with four short facts (local
   inference, no telemetry, no account, opt-in crash reports) and the LAN
   note. The million-dollar-idea line sits in the lede.
5. **Wired on first boot.** Four tiles: Open WebUI, Hermes, pi, ComfyUI,
   each with what hal0 configures for it. A line under them: "Add a slot and
   it shows up in Open WebUI and Hermes within seconds. Any MCP client can
   point at `/mcp/admin` and `/mcp/memory`." No claim about third-party MCP
   servers reaching agents.
6. **One memory your agents share.** Hindsight on loopback, directives,
   mental models, shared and private banks, the graph. Screenshot: memory
   bank workspace.
7. **The console.** Hero screenshot (slots page) plus a 3×2 grid: slot
   drawer with resolved command, stacks, image gen with fit meter, agents
   cards, MCP page, settings/security. Captions name the surface.
8. **Hardware.** One compact row of tiers (chips with a one-line note), not
   six cards: Max+ 395 (reference), Max 385/390, Radeon RX 7000, NVIDIA
   (experimental), CPU-only, Proxmox LXC. One sentence: Linux + systemd +
   podman.
9. **Alongside the alternatives.** Compare table: hal0, Ollama, LM Studio,
   llama-swap, Lemonade. Rows: clients address a stable name; several
   models resident by default; reusable profiles; MCP server for the admin
   plane; bundled memory; bundled agent; voice + images behind one API;
   Strix Halo + NPU; license; telemetry default. Cells from
   `competitive.md` section A only; "by default" wording where competitors
   can be configured otherwise. Footnote with the research date.
10. **Benchmarks.** Existing BenchHighlights with its date label and the
    "sweep from <date>" note; link to `/benchmarks`.
11. **Releases.** Latest stable version and date from data, three highlight
    lines from that entry, link to `/releases`. Replaces the "what's new"
    card grid.
12. **FAQ.** Seven questions, visible, with FAQPage markup mirroring the
    text: What is hal0? Do I need a Strix Halo machine? Is hal0 an Ollama
    alternative? Can I run several models at once? Does my data leave the
    machine? Is the API OpenAI-compatible? Which GPUs and NPUs work?
13. **Community.** Forum topics, featured profiles, latest writing, compact.
14. **Get hal0.** Install box, docs and GitHub CTAs, chips (Apache-2.0,
    Linux + systemd, no telemetry, signed releases).

Removed from the landing page: the runner catalogue table, the six hardware
cards, the six "what's in the box" cards, the "what's new" grid, the agent
tiles with directive lists, the "three day jobs" use-case cards (their
content folds into sections 2 and 5).

## 7. Releases page (`/releases`)

- Top card: latest stable version, date, its Highlights block, the install
  one-liner and the upgrade command, link to the GitHub release. Channel
  note in one line (stable, preview, nightly).
- Then the most recent eight tagged versions rendered inline, each
  collapsible, Highlights first.
- Older versions under "Archive" as a list of version + date + GitHub link
  (not the full body), which brings the HTML from 1.09 MB to well under
  200 KB.
- Untagged headings keep the "unreleased" badge (existing version guard).
- Highlights fallback: when the latest tagged entry has no `### Highlights`
  (patch releases often do not), the card and the landing teaser show the
  first three bullets from Added, then Changed, then Fixed, in that order;
  with no bullets at all, just version, date and the GitHub link.
- Fix the one-patch version lag (production says 1.7.0, stable is 1.7.1):
  check `scripts/sync-changelog.mjs` tag fetch and the committed
  `release-tags.json`. A failed sync keeps the committed snapshot and must
  not fail the build (standing availability rule), but it logs a loud,
  single-line warning naming the failed URL and status, and the committed
  snapshot is refreshed in the same PR. Whether `GITHUB_TOKEN` is set in
  the Vercel build environment is an operator question (section 12).

## 8. SEO plan

### 8.1 Per-page head
Titles and descriptions from `site-audit.md` B7 (all verified ≤60 / ≤155).
Landing title "hal0: Self-Hosted Local AI Server for AMD Strix Halo". One
separator style everywhere. Blog posts get `description:` frontmatter.
`og:locale`, RSS autodiscovery, per-page `og:image:alt`, media-aware
`theme-color`.

### 8.2 Structured data
One `@graph` in `MarketingLayout`: Organization (`#org`, logo, sameAs:
GitHub, Discord, forum) and WebSite. Landing adds SoftwareApplication
(upgraded: image, screenshot, featureList, softwareRequirements,
releaseNotes, installUrl, publisher, softwareVersion from tagged stable) and
FAQPage. Inner pages add BreadcrumbList. `/benchmarks` adds Dataset. Blog
posts get image, dateModified and publisher via the Starlight Head override
from PR #128.

### 8.3 Performance
Screenshots and the Hermes card image served as AVIF/WebP through
`<picture>` (build step with `sharp`, already a dependency); Hermes image
resized to 2× its rendered size. Favicon set (180 apple-touch, 32/192/512
PNG, `favicon.ico`) and a small `site.webmanifest`. Releases page slimmed
(section 7). Operator action in Cloudflare: Browser Cache TTL "Respect
existing headers", and consider disabling Email Obfuscation.

### 8.4 Long-tail pages
`/profiles/<slug>/` static pages from `profiles.json` with their own title,
description and the already-built OG cards in `public/og/profiles/`.
`/profiles` gets an h2 and a 140-char description.

### 8.5 Measurement
PR #128 (GA4, env-gated; social cards; noindex; headers) merges first. The
operator supplies the GA4 measurement ID; it goes into the Vercel project as
`PUBLIC_GA_MEASUREMENT_ID` and into Discourse site settings. `public/llms.txt`
summarises the product and key URLs. Search Console and Bing ownership for
hal0.dev and forum.hal0.dev are operator steps.

### 8.6 Keyword themes
Landing: self-hosted local AI server, run several models at once, Strix
Halo / Ryzen AI Max+ 395, OpenAI-compatible local API, local MCP, Ollama
alternative. Benchmarks: Strix Halo LLM benchmarks, tokens per second.
Profiles: llama.cpp flags for Strix Halo. Avoid: "ChatGPT alternative",
"fastest", "100% offline", bare "Halo".

## 9. Styling alignment (from `dashboard-tokens.md`)

Apply in this order, each its own commit:
1. Tokens: add `--hal0-accent-bg`, `--hal0-rad-xs`, `--hal0-dur`,
   `--hal0-dur-slow`, `--hal0-shadow-hover` (with light values). Replace
   literal hex and px in `index.astro` with tokens.
2. Status dots: serving = `--hal0-ok` with glow and pulse; ready = solid
   accent; warming = `--hal0-warn`; offline = `--hal0-fg-ghost`. Applies to
   the hero board, ticker and any pill.
3. One interactive-card recipe: `translateY(-1px)`, border-strong,
   `--hal0-shadow-hover`, 150 ms; sunken `--hal0-bg` head/foot bars with
   `--hal0-border-soft` dividers. Apply to feature tiles, FeaturedProfiles,
   BenchHighlights, LatestWriting, screenshot frames.
4. Radius: cards and screenshot frames on `--hal0-rad-lg` (10px); pills
   only for chips meant as pills; chips use `.chip` from `site-data.css`
   with `accent-soft` + `accent-line`, not `accent-glow`.
5. Memory bar: 14px, radius 3px, track `--hal0-bg-3`, token colours, 1px
   dividers, dashed "free" swatch.
6. Tables: row hover `--hal0-bg-2`, inner dividers `--hal0-border-soft`,
   "us" column `accent-soft`.
7. Delete the dead `.btn` rules in `index.astro`.
8. Command palette: amber hairline ring, inset active stripe, key-hint
   footer, enter animation under reduced-motion guard.
9. Keep: `--hal0-fg-dim #a3a09c`, card surface `#141414`, the 15px reading
   scale, the header filament.

The forum theme (`hal0-discourse-theme`, checkout at
`/home/mint/projects/hal0-discourse-theme`) copies `tokens.css` verbatim, so
this work may only ADD tokens; no existing token value changes. The header
gains the "releases" entry there in a separate PR.

## 10. Screenshots

Pipeline state (checked 2026-11-01 from the devops box): Docker works and the
`mcr.microsoft.com/playwright:v1.64.0-noble` image is present; the container
needs `--network host` on this box because bridge networking has no egress.
The admin-key login works. The script has no output-directory flag (add
`--out <dir>`). The Overview was redesigned, so `dashboard-overview` must
clip `.ov-mem-seg` (was `.rd-mem-seg`), `unified-memory-hero` clips
`.ov-now`, `image-gen-comfyui` expects `image-gen-pane`, and `mtp-control`
is retired. The other 26 existing selectors still resolve.

Capture box: CT150 is stopped. The live fleet box (`hal0`, hal0 1.7.1, GPU
and NPU, the box the admin MCP points at) is not publishable as it stands: it
shows private stacks, private model names in the benchmark roster, private
MCP client ids, pending approvals, private memory tags, and a nightly version
string in the header, and its memory writes are degraded. So either CT150
comes back up on stable with a public-safe seed (recommended: seed slots
`agent`, `brain`, `embed`, `rerank`, `img`, `tts`, `stt`; shipped default
models only; a memory bank with a few public-safe facts; one `/v1` burst for
live numbers; Open WebUI with one chat), or the live box is cleaned first.
That is an operator decision (section 12). Nightly-only surfaces (tune
block, bridge clients, Overview briefing) are not captured unless the box
runs a tagged release that has them. Shot list (route, state):

| Shot | Route / state |
|---|---|
| dashboard-overview | `#dashboard` |
| slots-inference | `#slots/inference`, agent serving |
| slot-card | clip of the `agent` card |
| slot-model-picker-open | picker open on `agent` |
| slot-profile-picker-open | profile picker open |
| slot-drawer | `#slots/agent`, resolved command visible |
| openwebui-picker | Open WebUI `:3001`, model dropdown open (new) |
| openwebui-chat | Open WebUI chat on the `agent` slot (new) |
| profile-edit-drawer, model-edit-drawer | `#models/profiles`, `#models/inference` |
| stacks-tab | `#slots/stacks` |
| image-gen-models | `#slots/image/models`, fit meter (new) |
| image-gen-generate | `#slots/image/generate` (new) |
| memory-bank | `#memory/bank`, public-safe facts seeded |
| memory-graph | graph view |
| mcp-tab | `#mcp` |
| agents-overview | `#agent`, crop "Coming soon" cards |
| approvals-inbox | bell open with one pending item (new) |
| command-palette | ⌘K open |
| settings-security | `#settings/security` |
| dock-gpu | dock gpu tab clip (new) |
| overview-now | `#dashboard`, clip `.ov-now` (new) |
| memory-reflect | `#memory/bank`, reflect tab (new) |
| settings-doctor | `#settings/doctor` (new) |
| runner-images | `#slots/runner-images` |

Retire from the landing page: `slots-lifecycle`, `hardware-page`,
`hardware-metrics`, `capability-*`, `operator-board`, `services-page`,
`requests-latency-widget`, `benchmarks-roster` (private names),
`unified-memory-hero`, `mtp-control`. Files that a blog post still
references (`operator-board`, the v0.7 and v0.8 posts' shots) stay on disk;
only unreferenced files are deleted. Every PNG is reviewed for hostnames,
keys, model names, stack names and memory tags before commit. Retina
variants for every shot.

## 11. Execution plan (after approval)

One worktree and branch per PR under `worktrees/hal0-web/`. Conventional
commits, one concern each. Waves respect the 8-agent cap. Review by a
reviewer agent against this spec and the product repo before each merge.
Squash-merge, auto-merge after green CI, delete branch, prune worktree.

Wave 0:
- PR #128 (existing, branch `origin/thinmintdev/beautiful-pediatrician`,
  approved and mergeable, one CodeQL check red): fix the CodeQL finding,
  merge (sonnet). Every Wave 1 branch starts from master after this merge.
  `MarketingLayout` then gains a `jsonLd` prop (an array of objects rendered
  as one `@graph` script) so C and E compose structured data without
  duplicating script tags; that prop is the builder's design.
- C ships with the existing screenshots where a shot exists and the
  `TODO(shots)` placeholder convention where it does not (`openwebui-*`,
  `image-gen-*`, `dock-gpu`, `approvals-inbox`, `overview-now`); G2 swaps
  them in. C does not wait for G2.

Wave 1 (parallel):
- B. Styling alignment per section 9 (sonnet). Files: `tokens.css`,
  `site.css`, `site-data.css`, landing CSS block.
- C. Landing page rewrite per section 6, including the interactive hero
  board, FAQ, JSON-LD (opus; the copy is the product).
- D. Releases page per section 7 + redirect flip + nav/footer entries +
  version lag fix (sonnet).
- E. SEO infrastructure per 8.1 to 8.3 and 8.5: layout head, `@graph`,
  breadcrumbs, Dataset, blog frontmatter, picture pipeline, favicon set,
  manifest, llms.txt (sonnet).
- G1. Capture script update per section 10 shot list + Docker runner
  (sonnet).

Wave 2:
- F. Per-profile static pages + profiles page fixes (sonnet).
- G2. Capture on CT150, PNG review, wire new shots into C's sections and
  the blog (lead, gated on operator go and box state).
- H. Forum theme header mirror in `hal0-discourse-theme` (sonnet).
- Build, `astro check`, `npm test`, phone and desktop visual pass, Lighthouse
  spot check on `/`, `/releases`, `/benchmarks` (lead).

Wave 3 (optional):
- I. Blog post "Slots, not models" explaining the philosophy, linking the
  docs (sonnet draft, lead edit).

C depends on B's tokens (rebase C on B before merge). D and E are
independent. G2 depends on G1 and on the box.

## 12. Operator decisions

1. Hero H1: keep "Own Your Inference" (recommended) or switch to the
   alternative shown in the mockup.
2. `/releases` as the canonical URL with `/changelog` redirecting
   (recommended), or keep `/changelog`.
3. Adding "releases" to the shared header means a small PR to the forum
   theme. OK?
4. Capture box: bring CT150 up on stable v1.7.1 with the public-safe seed
   from section 10 (recommended), or clean the live fleet box first. The
   live box is private as it stands.
5. GA4 measurement ID: paste it and it goes into Vercel and Discourse. Also:
   is `GITHUB_TOKEN` set in the Vercel build environment? Without it the
   release-tag fetch runs unauthenticated and can silently fall back to
   the committed snapshot, which is the likely cause of the 1.7.0 lag.
6. Compare table columns: Ollama, LM Studio, llama-swap, Lemonade
   (recommended) instead of the current Ollama, LM Studio, OpenAI cloud.
7. Hermes foil card: keep (recommended) with the unverified "hours
   unattended" line removed.

## 13. Calls made without asking

- The runner catalogue, hardware cards and agent directive lists leave the
  landing page; the forum docs carry them.
- Copy uses the real seeded slot names. "research" appears only as an
  example of a custom slot.
- The compare table drops the "OpenAI cloud" column.
- The FAQ is seven questions, no more.
- Blog stays in the footer; "releases" is the only header addition.
- The million-dollar-idea line stays, phrased inside the honest privacy
  frame.
- Implementers assume the "recommended" option for every item in section 12
  until the operator says otherwise.
- Token changes are add-only (the forum theme copies the file).
- A failed changelog or tag sync never fails the build; it warns loudly and
  the committed snapshot is refreshed in the same PR.
- Patch releases without Highlights fall back to the first three bullets of
  Added, Changed, Fixed.
- The landing page merges with existing shots plus `TODO(shots)` markers;
  the capture PR replaces them.
