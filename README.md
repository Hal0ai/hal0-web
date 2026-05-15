# hal0-web

Source for [hal0.dev](https://hal0.dev) — the marketing site + docs
for the [hal0](https://github.com/hal0ai/hal0) home AI inference
platform.

Built with **Astro 6 + Starlight 0.39 + Tailwind v4**, all fonts
self-hosted. No GitHub remote yet, no production deploy. Local-only
during initial buildout.

## Layout

```
src/
├── assets/wordmark.svg     ← header logo (JetBrains Mono "hal0")
├── components/             ← shared marketing components
│   ├── Wordmark.astro
│   ├── HeroSection.astro
│   ├── FeatureGrid.astro / FeatureCard.astro
│   ├── HardwareMatrix.astro
│   ├── RoadmapColumn.astro / RoadmapCard.astro
│   ├── CodeBlock.astro
│   ├── ComparisonTable.astro
│   └── CTA.astro
├── content/docs/
│   ├── docs/               ← Starlight docs (served at /docs/*)
│   │   ├── index.mdx
│   │   ├── getting-started/
│   │   ├── hardware/       ← Strix Halo crown jewel page lives here
│   │   ├── slots/
│   │   ├── api/
│   │   ├── operate/
│   │   └── reference/
│   └── (other prefixes never used — keep root clear for the 404 route)
├── layouts/MarketingLayout.astro
├── pages/index.astro       ← landing page (placeholder until task #3)
└── styles/
    ├── fonts.css           ← @fontsource self-hosted bundles
    └── global.css          ← design tokens + Starlight overrides
public/
└── favicon.svg
NOTES.md                    ← design rationale (accent color, type stack)
CONTENT_BRIEF.md            ← copy + perf numbers source of truth (researcher)
```

## URL structure

| Path                              | Owner          |
| --------------------------------- | -------------- |
| `/`                               | MarketingLayout — `src/pages/index.astro` (task #3) |
| `/install`                        | MarketingLayout — task #4 |
| `/hardware`                       | MarketingLayout — task #4 |
| `/roadmap`                        | MarketingLayout — task #5 |
| `/docs/`                          | Starlight — `src/content/docs/docs/index.mdx` |
| `/docs/getting-started/*`         | Starlight — task #6 |
| `/docs/hardware/*`                | Starlight — task #6 (incl. `/docs/hardware/strix-halo`) |
| `/docs/slots/*`                   | Starlight — task #7 |
| `/docs/api/*`                     | Starlight — task #7 |
| `/docs/operate/*`                 | Starlight — task #7 |
| `/docs/reference/*`               | Starlight — task #7 |

Marketing pages render through `MarketingLayout.astro`. Anything under
`/docs/*` goes through Starlight's default sidebar + TOC chrome.

## Design system

See [`NOTES.md`](./NOTES.md) for the full rationale.

- **Accent**: sodium amber `#FFB000` — hardware semantics, AA-contrast
  against the `#0a0a0a` surface.
- **Body**: Geist Variable (self-hosted via `@fontsource-variable/geist`).
- **Mono / display**: JetBrains Mono with slashed-zero on (`font-feature-settings: 'zero' 1`).
- **Tokens**: defined in `src/styles/global.css` as CSS custom properties,
  bridged into Tailwind via `@theme` (`bg-hal0-bg`, `text-hal0-accent`, …).
- **Dark-first**, with a light theme override for users who flip the
  Starlight toggle.

## Commands

```sh
npm install            # install deps
npm run dev            # dev server at http://localhost:4321
npm run build          # static site → ./dist/
npm run preview        # serve ./dist/ for smoke-testing
```

## Build state

`npm run build` produces 10 static pages, a sitemap (`/sitemap-index.xml`),
and a pagefind search index for docs. The one noisy log line —
`Entry docs → 404 was not found.` — is Starlight 0.39 probing for a
user-supplied custom 404 entry; the build succeeds and falls back to
Starlight's built-in 404 page. Suppressing the line would require a
Starlight component override (`src/components/Starlight404.astro` via
the integration's `components` slot) — left to the verify pass.

## Conventions

- **No GitHub remote.** Local-only during buildout. Do not push.
- **No deploy.** Don't wire Vercel, Netlify, or anything else.
- **Self-hosted fonts only.** No `fonts.googleapis.com` requests at
  runtime — `@fontsource*` bundles the `.woff2` files into the build.
- **No telemetry.** Astro telemetry is disabled at the project level
  via the `.astro-cache` opt-out the user already set.
- **Multiple semantic commits**, not one mega-commit. Match the
  existing history: `chore:`, `style:`, `feat:`, `feat(ui):`, `docs:`.
- **Do not touch `/home/halo/dev/hal0/`** — that's the upstream repo,
  read-only reference.

## Cross-references

- [CONTENT_BRIEF.md](./CONTENT_BRIEF.md) — verified copy + perf numbers.
  Cite from here, not from the hal0 repo directly.
- [NOTES.md](./NOTES.md) — design rationale (accent, type stack).
- Upstream hal0 repo: `/home/halo/dev/hal0/` (do not edit).
