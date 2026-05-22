# hal0-web — design notes

Decisions made during scaffolding. Update inline as the design evolves;
don't bury rationale in commits alone.

## Accent color: **sodium amber `#FFB000`**

| Option              | Hex       | Why not picked                            |
| ------------------- | --------- | ----------------------------------------- |
| Amber               | `#F59E0B` | Generic Tailwind amber-500; reads softer  |
| Electric blue       | `#3B82F6` | Saturated; same blue as every dev tool    |
| **Sodium amber**    | `#FFB000` | **Picked**                                |
| Muted teal          | `#2DD4BF` | Pleasant but no hardware semantics        |
| Magenta             | `#D946EF` | Trendy; reads as consumer not hardware    |

### Why sodium amber

1. **Hardware semantics.** `#FFB000` is the color of vacuum-tube glow,
   sodium-vapor lamps, and old amber CRTs. It signals "this thing runs
   on real silicon" instantly. Strix Halo is a hardware story; the
   palette should agree.
2. **Differentiation.** Vercel, Stripe, OpenAI, HuggingFace, Linear,
   Cursor — all blue / blue-green / purple. Amber is open territory.
3. **Dark-mode native.** `#FFB000` on a near-black background has the
   contrast ratio of a server-rack indicator LED. AA-contrast against
   `#0a0a0a` is ~12:1.
4. **Pairs with JetBrains Mono.** Mono + amber reads as terminal /
   firmware / debugger — the exact mental model hal0 wants.

Used for:

- `--sl-color-accent` (links, current sidebar item, focus rings)
- Hero CTA, copy-button hover, slot-status "ready" pill
- Slashed-zero `0` in the wordmark glyph

Accent hover: `#FFC533` (lighter, +8% L*).
Accent muted:  `#7A5500` (for subtle borders / dim states).

## Body font: **Geist Variable**

| Option       | Why not picked                                         |
| ------------ | ------------------------------------------------------ |
| Inter        | Safest but humanist; clashes slightly with Mono `g`    |
| **Geist**    | **Picked**                                             |

### Why Geist

1. **Geometric, pairs with JetBrains Mono.** Both fonts share open
   apertures and a similar `g` construction. Inter's two-storey `g`
   fights Mono's single-storey.
2. **Technical voice.** Geist is Vercel's house font, designed for
   developer tools — same audience as hal0.
3. **Slashed zero available.** `font-feature-settings: 'zero' 1`
   activates the slashed `0` in Geist too, so the wordmark `0`,
   inline `0`s in copy, and code blocks all read consistently.
4. **Variable file is small.** Single `.woff2` covers 100–900 weight.

## Type stack

```css
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
--font-body: 'Geist Variable', 'Geist', system-ui, -apple-system, sans-serif;
--font-display: var(--font-mono); /* wordmark + hero numerals */
```

Slashed-zero rule applied via `font-feature-settings: 'zero' 1;` on:

- `.wordmark` (any "hal0" rendering)
- `code`, `pre`, `kbd`
- `.tabular` (data tables, perf numbers)

## Fonts are self-hosted

All `@fontsource*` packages bundle `.woff2` files locally. No
`<link rel="preconnect" href="fonts.googleapis.com">` anywhere. The
build must never make a runtime request to a Google CDN.

## Theme tokens

Defined in `src/styles/global.css` as CSS custom properties, exposed
to Tailwind via the `@theme` block. Dark mode is the default —
Starlight's `data-theme="light"` override flips the surface tokens but
keeps `--accent` constant.

## Layouts

- `/docs/*` — Starlight default (`StarlightPage` + sidebar)
- `/` (landing), `/install`, `/hardware`, `/roadmap` — custom
  `MarketingLayout.astro`, which reuses Starlight's `<head>` and
  theme tokens but drops the docs chrome.

## Future tweaks

- Once content lands, sanity-check accent against amber-blind users
  (~5% of male population have red-green CVD). Sodium amber is in the
  safe zone but verify with a simulator before launch.
- Add a `prefers-contrast: more` override that raises accent to `#FFD27A`
  for low-vision users.

## v0.2 auth landed (2026-05-15)

Team J shipped Caddy + basic_auth + bearer tokens + automatic HTTPS
to `hal0/main` (PR'd as one commit on its worktree). Docs updated:

- **New page** — `src/content/docs/docs/operate/auth.mdx` ("Authentication
  & HTTPS"). Covers the `--auth=basic` flag, browser vs programmatic
  auth paths, automatic HTTPS via Caddy's internal CA (`.local`) or
  ACME / Let's Encrypt (real domains), token CRUD, scopes, public-route
  allowlist, mDNS setup, and rollback.
- **Updated** — `getting-started/install.mdx` adds a callout pointing
  at `--auth=basic`.
- **Updated** — `api/openai-compat.mdx` and `operate/openwebui.mdx`
  swap the "v0.2 deferred" notes for live links to the new auth page.

### Landing page + marketing follow-ups (TODO before launch)

Positioning decision (2026-05-15): auth is a **capability bullet**,
not the headline. The inference story stays primary; auth gets a card
in the v1-features grid as a "safe to expose" signal. Don't rewrite
the hero.

1. **`pages/index.astro` "What ships in v1" grid** — DONE 2026-05-15.
   Added a 9th `FeatureCard` ("Auth + HTTPS, one flag", icon
   `shield-check`), bumped the grid from `columns={4}` (two rows of
   four) to `columns={3}` (three rows of three) so the new card lands
   in a clean grid. The card links through to `/docs/operate/auth/`.
   Hero copy intentionally left alone.
2. **`pages/install.astro`** — TODO. Surface the `--auth=basic` flag
   in the one-liner picker. Two tabs: "Trusted LAN" (default `curl |
   bash`) and "Public-facing" (the flag + a short note about HTTPS
   being automatic).
3. **`ComparisonTable.astro`** — TODO. There's a row about deployment
   flexibility; update the cells to reflect that hal0 now ships with
   real auth, not just "OpenWebUI's own login."
4. **OG card / share image** — SKIP. The current `og-default.png`
   says "trusted-LAN home AI" which is still accurate as the default
   posture under capability-bullet positioning. Regenerate only if we
   later decide auth IS the headline.
5. **Roadmap card** — TODO. The "v0.2 deferred" tile listing Caddy +
   auth needs to flip to "shipped" or move out of the deferred column.
   See `src/components/RoadmapColumn.astro` and
   `src/pages/roadmap.astro`.

### Copy direction for the landing-page mention

Capability-bullet posture: don't lead with auth. The card copy reads
"Off by default for trusted-LAN installs. `--auth=basic` brings up
Caddy with basic_auth at the edge, bearer tokens for the OpenAI API,
and automatic HTTPS — internal CA for `.local`, Let's Encrypt for
real domains. Zero certbot." That signals maturity (it's there when
you need it) without overclaiming (we're not pitching as a
multi-tenant cloud).

The differentiator vs. Ollama / LM Studio: **automatic HTTPS** out of
the box. Most homelab inference stacks make you wire up nginx +
certbot + some auth proxy yourself. hal0 ships that whole pipeline
behind a single installer flag — the card surfaces it without making
it the lead.

## Halo companion mark

A flattened ellipse, outlined in sodium amber `#FFB000`, sitting above
the wordmark like a halo over the type. Origin: user noticed that "the
0 in hal0 is already a halo" — making it explicit by floating a real
halo over the type ties the wordmark to the product story (Strix
**Halo**, hal**0**).

### Reproducible geometry

Halo dimensions, expressed as ratios of the wordmark width `W` so the
mark scales cleanly between favicon (32 px), header logo (~120 px), and
OG card (1200 px):

| Parameter              | Value                  | Notes                                          |
| ---------------------- | ---------------------- | ---------------------------------------------- |
| shape                  | ellipse, no fill       | classic halo iconography                       |
| stroke colour          | `#FFB000` sodium amber | matches the accent and the slashed `0`          |
| stroke width           | ~1.5 % of `W`          | crisp at 16 px, doesn't break up at 1200 px    |
| `vector-effect`        | `non-scaling-stroke`   | keeps stroke crisp under any transform         |
| rx (horizontal radius) | ~0.38 `W`              | narrower than the wordmark; reads as *over*    |
| ry (vertical radius)   | ~0.045 `W`             | aspect ≈ 8 : 1 → reads as halo seen from below |
| rotation               | -3° to -4°             | gives motion; -3° at 16 px, -4° elsewhere       |
| gap above cap-line     | ~0.06 `W`              | breathing room, not stuck to the type           |

### Concrete dimensions per asset

| Asset                          | Canvas        | Halo (cx, cy, rx, ry) | Stroke | Tilt |
| ------------------------------ | ------------- | --------------------- | ------ | ---- |
| `src/assets/wordmark.svg`      | 96 × 38       | (35, -3, 28, 2.5)     | 1.6    | -4°  |
| `src/components/Wordmark.astro`| em-scaled SVG | (50, 6, 46, 3.6) at vbox 100×12, width 1.85 em | 1.6 | -4° |
| `public/favicon.svg`           | 32 × 32       | (16, 7, 10, 1.8)      | 2.2    | -3°  |
| `public/og-default.png`        | 1200 × 630    | (600, 216, 220, 28)   | 7      | -3°  |

### Slides / decks

To reproduce in Figma, Keynote, etc.: draw an ellipse, set its width to
~76 % of the wordmark width and its height to ~9 % of the wordmark width
(aspect 8 : 1), stroke 1.5 % of wordmark width in `#FFB000`, no fill,
tilt -4°, place ~6 % of wordmark width above the cap-line. Done.

### OG card

Generated by `scripts/build-og.sh` (ImageMagick + JetBrains Mono TTF).
The script resolves the font in this order:

1. `$HAL0_OG_FONT` env var
2. `./tools/JetBrainsMono.ttf`
3. `/mnt/repos/manifold/mani/assets/fonts/JetBrainsMono[wght].ttf` (this dev box)
4. fontconfig lookup

The TTF is not committed; either drop a copy at `./tools/` or grab one
from the [JetBrainsMono GitHub release](https://github.com/JetBrains/JetBrainsMono/releases)
before re-running the script. JBM is OFL-licensed so redistribution is
fine — we just keep the repo lean.
