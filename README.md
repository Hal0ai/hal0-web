<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/brand/logo-halo-dark.svg">
  <img src="./public/brand/logo-halo-light.svg" alt="hal0" width="220">
</picture>

### hal0.dev — marketing site + docs

[hal0.dev](https://hal0.dev) · [hal0 product repo](https://github.com/Hal0ai/hal0)

</div>

---

Source for [hal0.dev](https://hal0.dev) — the marketing site + Starlight
docs for the [hal0](https://github.com/Hal0ai/hal0) home AI inference
platform.

Built with **Astro 6 + Starlight 0.39 + Tailwind v4**, **Geist Variable**
for body, **JetBrains Mono** for code/display, all fonts self-hosted.
Deployed at [hal0-web.vercel.app](https://hal0-web.vercel.app); apex
domain `hal0.dev` to follow.

Licensed **Apache-2.0** (matches the upstream hal0 product repo).

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
├── pages/index.astro       ← landing page (hero + why + features + …)
└── styles/
    ├── fonts.css           ← @fontsource self-hosted bundles
    └── global.css          ← design tokens + Starlight overrides
public/
├── favicon.svg
├── og-default.png          ← 1200×630 social card (sodium amber)
└── robots.txt              ← allow-all + sitemap pointer
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
npm run astro check    # type check (must be 0 errors / 0 warnings)
npm run build          # static site → ./dist/
npm run preview        # serve ./dist/ for smoke-testing
```

## Deploy

Vercel — **manual, not configured yet.** When ready:

```sh
vercel link            # first time only
vercel --prod          # ship to hal0.dev
```

DNS for `hal0.dev` must be cut over to Vercel separately. Until the
user does both steps, the site is local-only.

## Release manifest hosting (`releases.hal0.dev`)

The hal0 self-updater (`src/hal0/updater/updater.py`) fetches per-channel
release manifests from:

```
https://releases.hal0.dev/{stable|nightly}.json
```

Schema: `hal0.releases.v1` — see
[`hal0/docs/release-manifest.md`](https://github.com/hal0ai/hal0/blob/main/docs/release-manifest.md)
for the full field reference.

### Where the JSON lives in this repo

```
public/releases/
├── stable.json      ← served at https://releases.hal0.dev/stable.json
└── nightly.json     ← served at https://releases.hal0.dev/nightly.json
```

`public/` is copied verbatim into `dist/` by Astro, so the files land at
`/releases/*.json` on whatever host serves the site. Both URL forms work:

| Form           | URL                                              |
| -------------- | ------------------------------------------------ |
| Path-based     | `https://hal0.dev/releases/stable.json`          |
| Subdomain      | `https://releases.hal0.dev/stable.json`          |

The two are wired up by:

- `public/_headers` — sets `Cache-Control: max-age=60` + permissive CORS
  on `/releases/*` so freshly-published tags propagate within a minute.
- `public/_redirects` — when the same Cloudflare Pages project is
  fronted by both `hal0.dev` and `releases.hal0.dev`, rewrites the
  subdomain's root to `/releases/` (`200` rewrite, no client redirect)
  so `https://releases.hal0.dev/stable.json` resolves to
  `dist/releases/stable.json` without polluting the site root.

### Cloudflare Pages + DNS setup (one-time)

1. **Pages project** — point Cloudflare Pages at this repo. Build
   command: `npm run build`. Output dir: `dist`. CF Pages auto-detects
   `_headers` and `_redirects`.
2. **Custom domains** — in the Pages project, add both:
   - `hal0.dev` (primary)
   - `releases.hal0.dev` (subdomain for the updater)
3. **DNS records** (Cloudflare DNS zone for `hal0.dev`):
   - `hal0.dev`              → CNAME → `<project>.pages.dev` (proxied)
   - `releases.hal0.dev`     → CNAME → `<project>.pages.dev` (proxied)
4. **Verify** — once DNS propagates:
   ```sh
   curl -s https://releases.hal0.dev/stable.json | jq .
   curl -sI https://releases.hal0.dev/stable.json | grep -i cache-control
   ```

### Publish workflow (how a tag updates `stable.json`)

The publisher is `release.yml` in
[hal0ai/hal0](https://github.com/hal0ai/hal0/tree/main/.github/workflows)
(not yet implemented — placeholder manifests live in this repo until it
ships). The intended flow:

1. Tag `vX.Y.Z` on `hal0ai/hal0` triggers `release.yml`.
2. Workflow builds `hal0-X.Y.Z.tar.gz`, computes its sha256, and signs
   it with cosign keyless against the GH Actions OIDC identity. Release
   assets (tarball + `.sig`) attach to the GH Release.
3. Workflow generates the new `stable.json` (or `nightly.json` on
   `main`) using the schema in `public/releases/*.json` as a template,
   filled in with real `version` / `digest_sha256` / `signer_identity`.
4. Workflow opens a PR against `hal0ai/hal0-web` (or commits directly
   on a `releases/` branch via a deploy key with write scope limited to
   `public/releases/`), updating only `public/releases/{channel}.json`.
5. Merge → CF Pages auto-deploys → updater clients see the new manifest
   on next `--check`.

The placeholder manifests currently in this repo (`_placeholder: true`,
all-zeros digest) will be schema-valid but will fail cosign verify if
anything tries to `apply()` them — intentional, until `release.yml`
exists.

## Build state

`npm run build` produces **32 static pages** (4 marketing + 27 docs +
the 404), a sitemap (`/sitemap-index.xml`), a pagefind search index for
docs, `robots.txt`, and a default OG image. Lighthouse scores ≥95
across performance / accessibility / best-practices / SEO on the five
key pages (verified 2026-05).

The harmless `Entry docs → 404 was not found.` log line is Starlight
0.39 probing for a user-supplied custom 404 entry; the build succeeds
and falls back to Starlight's built-in 404 page.

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
