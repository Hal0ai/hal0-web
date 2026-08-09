# Kickoff prompt

Paste this into a fresh implementation session, with this folder attached.

---

You are implementing the hal0.dev community platform in the `Hal0ai/hal0-web`
codebase (Astro 6 + Starlight + Tailwind v4, static-first, deployed on Vercel).

Attached is a design handoff. `README.md` in that folder is the specification —
read it fully before writing anything. The `.html` files are **design references**,
not code to copy: recreate them as Astro components and Starlight pages using the
repo's existing patterns and its `--hal0-*` / `--sl-color-*` token bridge in
`src/styles/global.css`. Interactive data surfaces are client-hydrated islands with a
server-rendered initial state; everything must render before hydration.

Two things already exist in the repo and are the source of truth — read them first and
reuse them rather than re-deriving:

- `src/components/ModelRoster.astro` — capability glyph paths, decode-speed buckets
  (fast ≥60 / mid ≥25 / slow <25), the legend wording, and the sortable-table idiom.
- `src/components/landing/LiveArtifact.astro` — the hero's live slot panel.

Build order, because everything inherits from the first item:

1. **Unified chrome** — header (site + forum variants, mobile drawer), footer,
   sub-nav, search. Authored once, reused byte-for-byte by every surface including the
   Discourse theme component. Reference: `01 Unified Chrome.html`.
2. **Benchmarks** — leaderboard, run drawer, evals tab, degraded/loading/empty states.
   Reference: `02 Benchmarks.html`.
3. **Profiles** — gallery and drawer, including the benchmark join on profile slug.
   Reference: `03 Profiles.html`.
4. **Blog + KB**, **docs polish**, **OG template**, **homepage community layer**.
   References: `04`, `08`, `05`, `06`.
5. **Forum theme** — theme component for chrome, CSS-variable restyle for topic rows
   and badges, nothing forked. Reference: `07 Forum.html`.

Hard constraints:

- Sodium amber `#ffb000` is the only accent. No other accent colour, no gradients as
  decoration, no new fonts, no emoji, no third-party icon set.
- One solid amber button per view; everything else is a ghost outline.
- Numbers are verified, never invented. A card or badge may only show a figure that a
  real run produced, and must name the run it came from.
- Meaning is never encoded in colour alone — pair with a glyph, a meter, or a label.
- Both themes must pass AA. The light-mode device and status hue overrides in
  `hal0-site.css` are required, not optional.
- Every surface must be reachable from every other surface through the shared chrome.

Not designed yet, and out of scope unless asked: the submission flow (CLI success
landing, web upload wireframes, validation states, PR confirmation, submission status).
Its entry points exist and should link to a placeholder route.

Start by reading `README.md`, then the two repo components above, then propose your
component breakdown for the chrome before implementing it.
