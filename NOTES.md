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
