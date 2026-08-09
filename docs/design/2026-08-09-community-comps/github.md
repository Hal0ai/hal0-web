repo: Hal0ai/hal0-web
branch: master

## Last sync
date: 2026-08-09T14:41:21Z

### Updated in this project
- Read `src/content/docs/docs/**` — the docs sidebar, section names, page order and the getting-started / slot-lifecycle content are taken from the real MDX tree.
- Read `src/components/ModelRoster.astro` — capability glyph paths, labels, tints and the decode buckets (incl. light-mode `#1a7f37` / `#cf222e`) are lifted verbatim, legend included.
- Read `src/components/landing/LiveArtifact.astro` — the homepage hero panel matches its slot rows, states, tok/s animation, memory bar and dispatch block.
- Unified chrome authored once in `site-chrome.jsx` from `src/styles/global.css` tokens and reused by all eight surfaces.

## Screen map
| Screen | Built from |
| --- | --- |
| 01 Unified Chrome.html | src/styles/global.css, src/styles/fonts.css, src/assets/wordmark.svg |
| 02 Benchmarks.html | src/components/ModelRoster.astro, src/data/model-roster.ts, bench/build_data.py |
| 03 Profiles.html | src/data/model-roster.ts, src/components/ModelRoster.astro |
| 04 Blog and KB.html | src/content/docs (blog structure), src/styles/global.css |
| 05 OG Card Template.html | public/og-default.png, scripts/build-og.sh |
| 06 Homepage.html | src/components/landing/LiveArtifact.astro, src/pages/index.astro, public/install.sh |
| 07 Forum.html | src/components/SiteHeader.astro, src/components/SubNav.astro (chrome parity) |
| 08 Docs.html | src/content/docs/docs/** (sidebar tree, getting-started/index.mdx, reference/slot-lifecycle.mdx) |
| roster-data.js | src/data/model-roster.ts |
| hal0-site.css, site-chrome.jsx | src/styles/global.css |
