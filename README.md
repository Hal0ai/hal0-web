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
│   ├── StarlightSiteTitle.astro
│   ├── CodeBlock.astro
│   ├── HermesCard.astro
│   ├── ModelRoster.astro
│   ├── CTA.astro
│   └── landing/            ← LiveArtifact.astro, LoadoutCard.astro
├── content/docs/
│   ├── docs/               ← Starlight docs (served at /docs/*, five sidebar groups)
│   │   ├── getting-started/
│   │   ├── concepts/       ← Strix Halo crown jewel page lives here
│   │   ├── guides/
│   │   ├── operate/
│   │   └── reference/      ← reference/api/ nests as a collapsible subgroup
│   └── blog/               ← starlight-blog posts (served at /blog/*)
├── layouts/MarketingLayout.astro
├── pages/
│   ├── index.astro         ← landing page — hero + why + features + hardware +
│   │                          roadmap + … as anchor sections on one page
│   ├── changelog.astro
│   ├── releases.astro
│   └── contributing.astro
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
| `/`                                | MarketingLayout — `src/pages/index.astro`. `/install`, `/hardware`, and `/roadmap` are anchor sections on this page, not standalone routes; `/roadmap` 302s here via `public/_redirects` for old links |
| `/changelog`                      | MarketingLayout — `src/pages/changelog.astro`, rendered from the synced product-repo `CHANGELOG.md` |
| `/releases`                       | MarketingLayout — `src/pages/releases.astro` |
| `/contributing`                   | MarketingLayout — `src/pages/contributing.astro` |
| `/docs/`                          | Starlight — redirects to `/docs/getting-started/` (the docs root has no index page) |
| `/docs/getting-started/*`         | Starlight — "Start here" sidebar group |
| `/docs/concepts/*`                | Starlight — "Concepts" sidebar group (incl. `/docs/concepts/strix-halo`) |
| `/docs/guides/*`                  | Starlight — "Guides" sidebar group |
| `/docs/operate/*`                 | Starlight — "Operate" sidebar group |
| `/docs/reference/*`               | Starlight — "Reference" sidebar group |
| `/blog/*`                         | starlight-blog — posts under `src/content/docs/blog/` |

Marketing pages render through `MarketingLayout.astro`. Anything under
`/docs/*` (including `/blog/*`) goes through Starlight's default sidebar + TOC chrome.

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
npm test               # Node built-in middleware contract tests
npm run astro -- check # Astro/TypeScript diagnostics
npm run build          # static site → ./dist/
npm run preview        # serve ./dist/ for smoke-testing
```

## Hosting surfaces

The marketing site and docs are built as an Astro static site. The release
resolver in `functions/_middleware.ts` is a Cloudflare Pages Function intended
for the separate `releases.hal0.dev` machine hostname. These are distinct
hosting responsibilities. Hosting account, project, DNS, and deployment
ownership are external configuration and are not established by this repository.

A release-resolver deployment is not ready merely because the Function builds.
Its Cloudflare environment must provide the `RELEASE_POINTERS` KV namespace
binding described below. Do not deploy or change that binding as part of normal
source preparation.

## Release manifest hosting (`releases.hal0.dev`)

The installer and updater use these machine endpoints:

```text
https://releases.hal0.dev/stable.json
https://releases.hal0.dev/stable.json.bundle
https://releases.hal0.dev/preview.json
https://releases.hal0.dev/preview.json.bundle
https://releases.hal0.dev/nightly.json
https://releases.hal0.dev/nightly.json.bundle
```

Only exact `GET` and `HEAD` requests for those paths are machine routes. They
never fall back to static files or marketing HTML. Unsupported methods return
405. Missing channels return JSON 404; resolver/configuration and upstream
failures return JSON 502 or 503. All error responses are `no-store`.

The served JSON uses schema `hal0.releases.v1`. Its exact sibling
`.json.bundle` authenticates the manifest bytes. The mirrored
[`public/install.sh`](public/install.sh) therefore requires both `jq` and
Cosign support for signed bundles before it can trust or parse a manifest.
`public/install.sh` is source preparation only: changing it does not deploy the
installer.

### Explicit KV pointer contract

The Function has no automatic "latest" or recent-release discovery. It reads
exactly one key, `release-pointers.v1`, from the Cloudflare KV namespace bound
as `RELEASE_POINTERS`. The document is strict: no unknown top-level, channel,
or record fields are accepted.

```text
{
  "_schema": "hal0.release-pointers.v1",
  "generation": <positive-integer>,
  "channels": {
    "stable":  { "tag": "<exact-final-tag>",   "mode": "paired" },
    "preview": { "tag": "<exact-final-or-alpha-beta-rc-tag>", "mode": "paired" },
    "nightly": { "tag": "<exact-nightly-tag>", "mode": "paired" }
  }
}
```

Channels may be omitted to freeze them closed. Tags are immutable GitHub tags:
`stable` accepts only `vX.Y.Z`; `preview` accepts that final form or
`vX.Y.Z-alpha.N`, `-beta.N`, or `-rc.N`; `nightly` accepts
`vX.Y.Z-nightly.YYYYMMDDhhmmss`. The resolver requests only
`repos/Hal0ai/hal0/releases/tags/<exact-tag>`, rejects drafts and tag
mismatches, and never lists releases or calls a `latest` endpoint.

In `paired` mode, `<channel>.json` and `<channel>.json.bundle` must both exist
on that same release before either is served. Downloads use each asset's GitHub
API URL, preserve the response as an `ArrayBuffer`, and include source, tag,
channel, and pointer-generation headers. If `GITHUB_TOKEN` is configured, it is
sent to both GitHub API calls; use only a token suitable for public-repository
read access.

`legacy-json` exists only to freeze an already-served stable or nightly JSON
pointer during migration. It is forbidden for preview, and its bundle endpoint
returns an explicit JSON 404. **Never use `legacy-json` for a new pointer
advancement.** Once a channel has a remotely authorized signed pair, all later
advancements use `paired`.

### Two-phase advancement runbook

Pointer publication is an explicit final authorization step, not an automatic
consequence of a tag, GitHub Release, package upload, web commit, or deploy.
For each advancement:

1. **Prepare immutable artifacts.** Produce the exact channel manifest and its
   signed sibling bundle on one non-draft GitHub Release at the intended tag.
2. **Authorize remotely.** Verify the GitHub tag/release identity, both exact
   assets and their bytes/signature. For stable and preview releases, also
   verify the intended distribution exists on PyPI and is installable under
   release policy. Nightly has no PyPI publication gate.
3. **Prepare the next document.** Start from the currently read KV document,
   change only authorized channel records, select `paired`, and increase
   `generation` monotonically. A final release may point both stable and
   preview at the same exact final tag, but each channel's signed asset pair
   must exist on that release.
4. **Advance atomically.** After review, write the complete document to the one
   fixed KV key. Do not edit partial per-channel keys. This KV mutation is an
   operator action outside source changes and outside this repository's local
   test/build workflow.
5. **Verify without auto-repair.** Check GET and HEAD status, byte identity,
   content type, channel/tag/generation headers, and signed-bundle verification.
   On failure, stop and repair or restore an explicitly reviewed complete
   document; never scan for or silently promote a newer release.

For the one-time migration, first capture ("freeze") any intentionally retained
stable/nightly exact tags into reviewed `legacy-json` records. It is valid to
omit a channel instead, which makes it fail closed. Do not invent a preview
placeholder, store a pointer document in this repository, or infer a tag from
checked-in static manifests. Migrate a frozen legacy record to `paired` only
after the remote authorization gates above pass.

The files under `public/releases/` are non-operational schema examples available
on the marketing site's `/releases/` path. They are not resolver fallback or KV
pointer values and must not be used as evidence that a machine channel advanced.

## Build state

`npm run build` currently produces **57 static pages** across marketing, docs,
blog, and the 404, plus a sitemap (`/sitemap-index.xml`), a pagefind search index
for docs, `robots.txt`, and a default OG image. Lighthouse scores ≥95
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
  maintained against it directly; verify claims and numbers there, not from a
  copy doc. (`CONTENT_BRIEF.md` was retired — it had drifted from the
  product.) `src/content/docs/docs/**` mirrors one-way into `Hal0ai/hal0:docs/**`
  on every `master` push via `.github/workflows/mirror-docs.yml` — edit docs
  here, never in the product repo.
- [NOTES.md](./NOTES.md) — design rationale (accent, type stack).
- Upstream hal0 repo: `/home/halo/dev/hal0/` (do not edit).
