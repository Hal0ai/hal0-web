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
npm test               # behavioural tests for functions/_middleware.ts
npm run astro check    # type check
npm run build          # static site → ./dist/
npm run preview        # serve ./dist/ for smoke-testing
```

`npm test` uses Node's built-in runner and type stripping — no dev
dependencies, no build step. It covers `functions/_middleware.ts`, which
decides which GitHub Release a hardened client's manifest *and* its
signature bundle come from; the same-release pairing rule it pins is a
security invariant, not a style preference. See
[Release manifest hosting](#release-manifest-hosting-releaseshal0dev).

`astro check` currently reports **5 pre-existing errors** (2 in
`src/content.config.ts` from starlight-blog's Zod `SchemaContext`, 3 implicit
`any` in `src/pages/changelog.astro`). They are unrelated to the middleware;
treat 5 as the baseline and anything above it as yours.

## Deploy

The marketing site + docs ship to **Vercel** on every push to `master`.
Apex `hal0.dev` is wired through Vercel; previews come up on
`hal0-web-*.vercel.app`.

```sh
vercel --prod          # ad-hoc prod ship (CI handles the normal path)
```

## Release manifest hosting (`releases.hal0.dev`)

The hal0 self-updater (`src/hal0/updater/updater.py`) and the one-line
installer (`installer/bootstrap.sh`) fetch per-channel release manifests —
**and the sibling Sigstore bundle that authenticates each one** — from:

```
https://releases.hal0.dev/{stable|preview|nightly}.json
https://releases.hal0.dev/{stable|preview|nightly}.json.bundle
```

Both halves of the pair are mandatory. Hardened clients cosign-verify the
exact manifest bytes against the bundle, using a client-pinned release
workflow OIDC identity, *before* parsing a single artifact URL out of the
manifest. A manifest served without its bundle is not consumable — the
client refuses it rather than trusting unauthenticated URLs.

Schema: `hal0.releases.v1` — see
[`hal0/docs/internal/release-manifest.md`](https://github.com/hal0ai/hal0/blob/main/docs/internal/release-manifest.md)
for the full field reference. The trust-carrying fields are `bundle_url`
(Sigstore bundle for the tarball), `digest_sha256`, `signer_identity`, and
`signer_issuer`. `sig_url`/`cert_url` are still emitted but are no longer
the verification path: the bundle embeds the Fulcio certificate, the
signature, and the Rekor inclusion proof + SET, so `cosign verify-blob
--bundle` keeps working after the short-lived cert expires.

### Channels

Which manifests a tag publishes is decided by hal0's
`src/hal0/release/policy.py` (`manifest_targets`), not by this repo:

| tag | manifests published |
|---|---|
| `v1.2.3` (final) | `stable.json`, `preview.json` |
| `v1.2.3-alpha.2` / `-beta.N` / `-rc.N` | `preview.json` |
| `v1.2.3-nightly.YYYYMMDD` | `nightly.json` |

So `preview` tracks the newest of (latest prerelease, latest final) — a
final tag lands on both channels — and `stable` only ever moves on a final
tag. `release.yml` uploads `<channel>.json` **and** `<channel>.json.bundle`
as a pair for every target.

### How it works

The subdomain lives on a small Cloudflare Pages project whose middleware
(`functions/_middleware.ts`) proxies the canonical assets off the newest
GitHub Release on `hal0ai/hal0` that carries them:

1. Tag `vX.Y.Z` on `hal0ai/hal0` triggers `.github/workflows/release.yml`.
2. The workflow builds `hal0-X.Y.Z.tar.gz`, computes its sha256, cosign
   keyless-signs it against the GH Actions OIDC identity, generates each
   target channel manifest, signs each manifest into a sibling `.bundle`,
   self-verifies both, and uploads the lot as Release assets.
3. The middleware on `releases.hal0.dev` resolves
   `/<channel>.json[.bundle]` from the newest non-draft release carrying
   `<channel>.json` and serves it with a short cache (~60s). A `v*` tag
   propagates end-to-end within about a minute — **no hal0-web deploy
   required**.
4. Clients verify the manifest against its bundle, then verify the tarball
   digest and publisher signature again as defence in depth.

Release selection is always driven by the **manifest** asset, never the
bundle, so a `.json` and a `.json.bundle` request resolve to the same
release even if a new tag lands between a client's two fetches. If the
selected release carries the manifest but not its bundle, the bundle
request fails closed (`x-hal0-proxy-failed: no-sibling:…`) rather than
pairing a manifest with an older release's signature.

Response headers worth probing: `x-hal0-source: github-release/<tag>`,
`x-hal0-channel`, `x-hal0-artifact: manifest|bundle`, and on any
fallthrough `x-hal0-proxy-failed: <reason>`.

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

There is deliberately **no static backstop for `.bundle`** — a placeholder
signature cannot verify, and a client that fetched one would read the
failure as tampering rather than as "not published yet". A bundle that
can't be proxied is an annotated 404.

### Verify

```sh
# manifest + its bundle must BOTH be 200 for a channel to be operational
for c in stable preview nightly; do
  for f in "$c.json" "$c.json.bundle"; do
    printf '%-24s %s\n' "$f" \
      "$(curl -so /dev/null -w '%{http_code}' "https://releases.hal0.dev/$f")"
  done
done

curl -sI https://releases.hal0.dev/stable.json | grep -iE 'cache-control|x-hal0'

# end-to-end: authenticate the manifest exactly as a client does
curl -fsSLO https://releases.hal0.dev/preview.json
curl -fsSLO https://releases.hal0.dev/preview.json.bundle
cosign verify-blob --bundle preview.json.bundle \
  --certificate-identity-regexp '^https://github\.com/(Hal0ai|hal0ai)/hal0/\.github/workflows/release\.yml@refs/tags/v\d+\.\d+\.\d+(-(alpha|beta|rc)\.(0|[1-9]\d*))?$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  preview.json
```

(That identity regex is the `preview` admission pattern from
`installer/bootstrap.sh`; `stable` and `nightly` pin narrower ones. Keep the
copies in lockstep with bootstrap.sh and `updater.py` — they are the trust
root, not documentation.)

A channel only becomes operational once a tag has published *both* halves,
in the current manifest schema. Two things can hold a channel back, and
neither is fixable in this repo:

- **No bundle.** Releases cut before manifest-bundle signing carry
  `<channel>.json` with no `.bundle`. The serving layer cannot synthesise a
  missing signature, so `.bundle` stays 404 until the next tag.
- **Pre-hardening manifest fields.** The client's strict policy pass
  requires `release_kind` and `prerelease_stage`, and requires
  `signer_identity` to equal the exact per-release identity it derives
  itself. Manifests generated before those fields existed are rejected even
  when perfectly signed.

As of 2026-07-27 that means `stable` is **not** operational end-to-end: the
newest release carrying `stable.json` is `v0.9.8`, which has no
`stable.json.bundle` and whose manifest predates `release_kind`. `preview`
(from `v1.0.0-alpha.2`) satisfies both conditions. Both clear on the next
final tag cut by the current `release.yml`.

## One-line installer (`hal0.dev/install.sh`)

`public/install.sh` is a **byte-identical mirror** of
[`hal0:installer/bootstrap.sh`](https://github.com/hal0ai/hal0/blob/main/installer/bootstrap.sh)
— that file is the audited original and the trust boundary for
`curl https://hal0.dev/install.sh | bash`. Never hand-edit the copy here:
copy the canonical file over it wholesale, in the same PR as the hal0-side
change.

hal0's `Bootstrap parity (daily)` workflow
(`.github/workflows/bootstrap-parity.yml` →
`scripts/check-bootstrap-parity.sh`) fetches the live URL daily and does a
plain `diff -u` against the in-tree original: exit 0 in sync, 1 drift,
2 operational error. There is no normalisation, so a single byte of drift
fails it. Preview a sync locally from a hal0 checkout with:

```sh
HAL0_INSTALL_URL="file:///path/to/hal0-web/public/install.sh" \
  bash scripts/check-bootstrap-parity.sh
```

## Build state

`npm run build` produces **54 static pages** (4 marketing + 40 docs +
9 blog + the 404), a sitemap (`/sitemap-index.xml`), a pagefind search index for
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
  maintained against it directly; verify claims and numbers there, not from a
  copy doc. (`CONTENT_BRIEF.md` was retired — it had drifted from the
  product.) `src/content/docs/docs/**` mirrors one-way into `Hal0ai/hal0:docs/**`
  on every `master` push via `.github/workflows/mirror-docs.yml` — edit docs
  here, never in the product repo.
- [NOTES.md](./NOTES.md) — design rationale (accent, type stack).
- Upstream hal0 repo: `/home/halo/dev/hal0/` (do not edit).
