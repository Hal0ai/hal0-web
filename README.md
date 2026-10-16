<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/brand/logo-halo-dark.svg">
  <img src="./public/brand/logo-halo-light.svg" alt="hal0" width="220">
</picture>

### hal0.dev — marketing site + docs

[hal0.dev](https://hal0.dev) · [hal0 product repo](https://github.com/Hal0ai/hal0)

</div>

---

Source for [hal0.dev](https://hal0.dev), the marketing site for the
[hal0](https://github.com/Hal0ai/hal0) homelab AI inference platform.
Product documentation and the knowledge base live on
[forum.hal0.dev](https://forum.hal0.dev); this repo links out to them.

Built with **Astro 7 + Starlight 0.41 + Tailwind v4**, **Geist Variable**
for body, **JetBrains Mono** for code/display, all fonts self-hosted.
Deployed on Vercel at `hal0.dev`.

Licensed **Apache-2.0** (matches the upstream hal0 product repo).

## Pages

| Path                 | Source                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `/`                  | `src/pages/index.astro` (landing page)                                 |
| `/changelog`         | `src/pages/changelog.astro`, rendered from the synced product `CHANGELOG.md` |
| `/benchmarks`        | `src/pages/benchmarks.astro`, model roster leaderboard                 |
| `/profiles`          | `src/pages/profiles.astro`, community profile gallery                  |
| `/profiles/submit`   | `src/pages/profiles/submit.astro`, in-browser validated submission     |
| `/profiles/submitted`| `src/pages/profiles/submitted.astro`                                   |
| `/contributing`      | `src/pages/contributing.astro`                                         |
| `/blog`              | starlight-blog, posts under `src/content/docs/blog/`                   |

`src/pages/api/auth/*` and `src/pages/api/forum/*` are the DiscourseConnect
SSO and forum-notification endpoints. `workers/bench-api` is the separate
benchmark API worker (its own README).

Marketing pages render through `src/layouts/MarketingLayout.astro`.

## Redirects

`astro.config.mjs` sends these to `forum.hal0.dev` (or elsewhere on-site):

- `/docs` and `/docs/<section>/<page>` to the forum Docs category, from
  `src/data/docs-redirects.json`.
- `/kb` and `/kb/<category>/<page>` to the forum knowledge base, from
  `src/data/kb-redirects.json`.
- `/first-run-guide` to the forum's Getting started category.
- `/releases` to `/changelog`.

`scripts/patch-vercel-docs-redirects.mjs` runs as `postbuild` and makes the
forum redirects match with and without a trailing slash.

## Data sync scripts

Each runs as part of `prebuild` (and `npm run dev`) and falls back to a
committed snapshot if the network fetch fails, so a build never breaks on an
unreachable source.

| Script                      | Writes                                              | Fallback                  |
| --------------------------- | --------------------------------------------------- | ------------------------- |
| `scripts/sync-changelog.mjs`| `src/data/changelog.md`, `src/data/release-tags.json` | committed copies          |
| `scripts/sync-bench.mjs`    | `src/data/bench-snapshot.json` (bench API)          | committed snapshot        |
| `scripts/sync-profiles.mjs` | `src/data/profiles.json` (`Hal0ai/hal0-profiles`)   | committed snapshot        |

Run them individually with `npm run sync:changelog`, `sync:bench`,
`sync:profiles`.

## OG images

`scripts/build-og.mjs` (satori + resvg, no browser) renders the 1200x630
social cards into `public/og/` at `prebuild`. `npm run build:og` runs it alone.

## Screenshots

`public/screenshots/` is captured from a live hal0 dashboard with
`npm run capture:screenshots`, which runs inside the Playwright container.
The header comment of `scripts/capture-screenshots.mjs` has the usage and
environment variables. `scripts/audit-screens.mjs` is a related audit helper.

## Design system

See [`NOTES.md`](./NOTES.md) for the full rationale.

- **Accent**: sodium amber `#FFB000`.
- **Body**: Geist Variable (`@fontsource-variable/geist`).
- **Mono / display**: JetBrains Mono with slashed-zero on.
- **Tokens**: CSS custom properties in `src/styles/`, bridged into Tailwind
  via `@theme`.
- **Dark-first**, with a light theme override.

## Commands

```sh
npm install              # install deps
npm run dev              # sync scripts, then dev server at http://localhost:4321
npm run build            # prebuild (sync + OG) then static/Vercel build -> ./dist and .vercel/output
npm run preview          # serve the build for smoke-testing
npm test                 # node:test suites in scripts/test/
npx astro check          # type check (known errors in profiles.astro and workers/bench-api; add no new ones)
```

Several tests inspect built output (`dist/`) and skip with a hint if you
have not run `npm run build` first.

## Release manifest proxy (`releases.hal0.dev`)

The hal0 self-updater fetches per-channel manifests from
`https://releases.hal0.dev/{stable|preview|nightly}.json` (schema
`hal0.releases.v1`; field reference in the product repo's release-manifest docs).

`releases.hal0.dev` is a Cloudflare Pages host. Its middleware,
`functions/_middleware.ts`, proxies each manifest live from the most recent
GitHub Release on `Hal0ai/hal0` that carries an asset of that name, so a new
tag appears there with no hal0-web deploy. Other paths on that host are
rewritten to `/releases/*`. `public/releases/{stable,preview,nightly}.json` are
placeholder backstops served if the GitHub API is unreachable; they are
sentinel files, not real manifests. `scripts/test/releases-proxy.test.mjs`
pins the channel list.

```sh
curl -s https://releases.hal0.dev/stable.json | jq .
```

## Deploy

The site ships to **Vercel** on every push to `master`. Previews come up on
`hal0-web-*.vercel.app`.

## Conventions

- **Self-hosted fonts only.** No `fonts.googleapis.com` requests at runtime.
- **No telemetry.** Astro telemetry is disabled at the project level.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, ...).
- **Source of truth is the hal0 product repo.** Verify product claims and
  numbers there, not from copies. Keep the product checkout read-only from here.
- Public copy stays version-neutral: no hard-coded release numbers.
