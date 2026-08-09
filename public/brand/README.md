# hal0 brand assets — canonical set

Single source for logos across hal0.dev, the Discourse theme, and any
future surface. Never redraw or approximate; reference these files (they
are served at `https://hal0.dev/brand/<name>`).

| File | Use |
| --- | --- |
| `logo-halo-dark.svg` / `.png` | Full logo on dark surfaces (site header contexts, Discourse logo slot) |
| `logo-halo-light.svg` / `.png` | Full logo on light surfaces (Discourse light-scheme logo slot) |
| `logo-halo-dark-favico.svg` / `.png` | Mark-only glyph, dark (favicon, touch icon, Discourse large icon) |
| `logo-halo-light-favico.svg` / `.png` | Mark-only glyph, light |
| `/favicon.svg` (site root) | Browser favicon |
| `/og-default.png` (site root) | Default OG/social card (1200×630) |

Related sources: the inline wordmark component is `src/components/Wordmark.astro`
(brand mark: Monomaniac One "hal" + JetBrains Mono slashed "0"); design tokens
are `src/styles/tokens.css`; nav contents are `src/data/nav.json`.

Discourse theme slots map: logo → `logo-halo-dark`, mobile logo →
`logo-halo-dark-favico`, favicon → `/favicon.svg`, large icon →
`logo-halo-dark-favico.png`, default OG image → `/og-default.png`.
