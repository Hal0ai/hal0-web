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
docs for the [hal0](https://github.com/Hal0ai/hal0) homelab AI inference
platform.

Built with **Astro 6 + Starlight 0.39 + Tailwind v4**, **Geist Variable**
for body, **JetBrains Mono** for code/display, all fonts self-hosted.
Deployed on Vercel at `hal0.dev`.

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

The marketing site + docs ship to **Vercel** on every push to `master`.
Apex `hal0.dev` is wired through Vercel; previews come up on
`hal0-web-*.vercel.app`.

```sh
vercel --prod          # ad-hoc prod ship (CI handles the normal path)
```

## Release manifest hosting (`releases.hal0.dev`)

The hal0 self-updater (`src/hal0/updater/updater.py`) fetches per-channel
release manifests from:

```
https://releases.hal0.dev/{stable|nightly}.json
```

Schema: `hal0.releases.v1` — see
[`hal0/docs/release-manifest.md`](https://github.com/hal0ai/hal0/blob/main/docs/release-manifest.md)
for the full field reference. The schema's `cert_url` field is
**required** — cosign 3.x keyless `verify-blob` needs `--certificate`,
so the manifest carries the URL to the `.crt` artifact alongside
`url` (tarball) and `sig_url` (signature).

### How it works (as of v0.1.0-alpha.1, 2026-05-21)

`releases.hal0.dev` is **fully operational** and serves the live
manifest. The subdomain lives on a small Cloudflare Pages project
whose middleware proxies the canonical asset off the latest GitHub
Release on `hal0ai/hal0`:

1. Tag `vX.Y.Z` on `hal0ai/hal0` triggers `.github/workflows/release.yml`.
2. The workflow builds `hal0-X.Y.Z.tar.gz`, computes its sha256, signs
   it with cosign keyless against the GH Actions OIDC identity, and
   uploads tarball + `.sig` + `.crt` to the GH Release alongside the
   generated `stable.json` (manifest schema `hal0.releases.v1`).
3. The CF Pages middleware on `releases.hal0.dev` fetches
   `stable.json` from the latest GH Release and serves it with a short
   cache (~60s). A `v*` tag propagates end-to-end within about a
   minute — **no hal0-web deploy required**.
4. Updater clients verify the tarball with `cosign verify-blob
   --certificate <cert_url> --signature <sig_url> …` against the
   `signer_identity` regex in the manifest.

Updater clients should point at `https://releases.hal0.dev/stable.json`
(or `…/nightly.json`). The old GitHub-direct URL form is not used; the
canonical asset name is `stable.json`, not `latest.json`.

### Static fallback in this repo

```
public/releases/
├── stable.json      ← static backstop (not the primary source)
└── nightly.json     ← static backstop (not the primary source)
```

`public/` is copied verbatim into `dist/` by Astro, so the files also
land at `https://hal0.dev/releases/{stable,nightly}.json`. They're
kept as a backstop and as a schema example; the live manifest is
whatever the CF Pages middleware on `releases.hal0.dev` returns.

### Verify

```sh
curl -s https://releases.hal0.dev/stable.json | jq .
curl -sI https://releases.hal0.dev/stable.json | grep -i cache-control
```

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

- **Self-hosted fonts only.** No `fonts.googleapis.com` requests at
  runtime — `@fontsource*` bundles the `.woff2` files into the build.
- **No telemetry.** Astro telemetry is disabled at the project level.
- **Semantic commits.** Match the existing history: `chore:`, `style:`,
  `feat:`, `feat(ui):`, `docs:`.
- **Do not touch `/home/halo/dev/hal0/`** — that's the upstream
  product repo, read-only reference.

## Cross-references

- **Source of truth = the hal0 codebase** (`hal0` repo, `src/hal0`). Docs are
  generated/maintained against it via the `hal0-docs` skill; verify claims and
  numbers there, not from a copy doc. (`CONTENT_BRIEF.md` was retired — it had
  drifted from the product.)
- [NOTES.md](./NOTES.md) — design rationale (accent, type stack).
- Upstream hal0 repo: `/home/halo/dev/hal0/` (do not edit).
