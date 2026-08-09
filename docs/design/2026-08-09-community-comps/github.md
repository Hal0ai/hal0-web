repo: Hal0ai/hal0-web
branch: master

## Last sync
date: 2026-08-09T12:51:43Z

### Updated in this project
- Read `src/data/model-roster.ts` — the real 26-model sweep (ROSTER_DATE 2026-06-19) now backs the benchmarks corpus, capability glyphs and decode buckets.
- Read `src/styles/global.css` + `fonts.css` for the live token values (sodium amber `#ffb000`, graphite ramp, Geist / JetBrains Mono).
- Rebuilt `/benchmarks` as leaderboard + evals + run drawer on the roster idiom; `/profiles` as gallery + card spec + profile drawer.
- Unified chrome (header, footer, sub-nav, search) authored once in `site-chrome.jsx` and reused by every surface.

## Screen map
| Screen | Built from |
| --- | --- |
| 01 Unified Chrome.html | src/styles/global.css, src/styles/fonts.css, src/assets/wordmark.svg |
| 02 Benchmarks.html | src/data/model-roster.ts, bench/build_data.py |
| 03 Profiles.html | src/data/model-roster.ts |
| roster-data.js | src/data/model-roster.ts |
| hal0-site.css, site-chrome.jsx | src/styles/global.css |
