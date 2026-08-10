# This directory is GENERATED — do not edit it here

(Underscore-prefixed so Starlight's `docsLoader` skips it — its glob is
`**/[^_]*.{md,mdx}`, so this file is documentation for humans, not a page.)

`src/content/docs/docs/<section>/` is a mirror of `docs/<section>/` in the
product repo (`Hal0ai/hal0`). The sync is
[`.github/workflows/mirror-docs.yml`](https://github.com/Hal0ai/hal0/blob/main/.github/workflows/mirror-docs.yml)
over there, and it runs on every push to that repo's `main` touching those
paths.

It syncs with **`rsync --delete`**, for these five sections:

```
getting-started  concepts  guides  operate  reference
```

Which means, concretely:

- A file you add here that does not exist upstream **is deleted** on the next
  sync.
- An edit you make here to a file that does exist upstream **is overwritten**
  on the next sync.

There is no warning and no PR — the bot commits straight to `master`.

## This has already bitten us once

On 2026-08-10, mirror commit `845f6df` reverted three merged PRs in one shot:
it deleted the four section listing pages (#90), stripped the Sections cards
from the docs landing page (#84/#90), and dropped an `appliesTo` frontmatter
field from `concepts/slots.mdx` (#93). All four `/docs/<section>/` routes went
back to 404 and CI went red. Nothing was wrong with the workflow — it did
exactly what it is designed to do.

## Where to put things instead

**Documentation content** → author it upstream in `Hal0ai/hal0` under
`docs/<section>/`. The mirror copies `.mdx` verbatim and preserves Starlight
component imports, so `<Aside>`, `<Card>`, `<Steps>` and friends all work from
there.

**Web-only presentation** (listing pages, cards, layout chrome) → put it in
`src/pages/`, which the mirror does not touch. See
`src/pages/docs/concepts/index.astro` for the pattern: a static route beats
Starlight's `[...slug]`, and `<StarlightPage>` keeps the docs shell, so the URL
and the look are identical to a real collection entry.

**Frontmatter that is really product metadata** (e.g. `appliesTo`) → upstream,
next to the page it describes.
