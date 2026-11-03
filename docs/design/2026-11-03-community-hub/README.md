# Community hub: Discourse-native benchmarks, profiles and stacks

Status: **draft for review** (H0-154). Nothing described here has been built or removed.
Author: Hal0 Web Lead. Reviewer: Alex.

## Summary

forum.hal0.dev becomes the place where people running Strix Halo, Gorgon Halo and XDNA NPU
hardware post what worked for them: benchmark results, profiles and full stacks. Each one is a
forum topic with a fixed layout and a machine-readable block. The hal0 CLI posts it and installs
it. hal0.dev/benchmarks and /profiles stop having their own store and read the forum instead.

The Cloudflare bench-api Worker, its D1 database and its R2 bucket retire. As far as we can tell
they were never deployed, so no published results are lost. The figures on /benchmarks today come
from a committed file, `src/data/model-roster.ts`. Those 26 first-party results become the first
verified Benchmark topics.

**Decisions this doc needs from Alex** are collected at the end, in [Decisions for review](#decisions-for-review).

### Sources

Everything below is grounded in two fact briefs and a spot check of hal0 source:

- H0-156, the forum brief (Hal0 Forum Engineer). Discourse `2026.11.0-latest` at `7519f88a0c`,
  hal0-discourse-theme at `77b5e92`, plus anonymous reads of the live forum.
- H0-157, the inventory brief (Hal0 Web Engineer). hal0-web at `fcf3efa`, hal0-profiles at
  `0ae8856`, and hal0 at `cf8b518`.
- hal0 at `5184be7`, checked for this doc: `ProfileConfig` is one `[profile.<name>]` entry in
  `profiles.toml` (`src/hal0/config/schema.py`). The portable profile envelope has kind
  `hal0.profile` (`src/hal0/profiles/portable.py:28`), and the stack envelope has kind `hal0.stack`
  (`src/hal0/stacks/portable.py:45`). The import routes are `POST /api/profiles/import`
  (`src/hal0/api/routes/profiles.py:415`) and `POST /api/stacks/import`
  (`src/hal0/api/routes/stacks.py:510`).

## What exists today

| Piece | State |
|---|---|
| bench-api Worker | Built, never deployed. `wrangler.toml` still has `REPLACE_AFTER_wrangler_d1_create_*` database ids, and `api.hal0.dev` fails TLS. Uploads need one shared admin token, so there is no per-user identity. |
| `hal0 bench upload` | Posts a tar.gz bundle to `api.hal0.dev` with `HAL0_BENCH_TOKEN` (`src/hal0/bench/cli.py:748-810`). The docs say it is for maintainers only. |
| /benchmarks | Shows `model-roster.ts` (26 models, dated 2026-06-19). The runtime fetch to the Worker always fails and falls back to that file. |
| /profiles | Built from the 8 TOML files in hal0-profiles. Submitting opens a GitHub PR. The repo has had no PRs. |
| hal0-profiles schema | Its own TOML shape (`[args] raw`). Nothing in hal0 reads it, and there is no converter to `ProfileConfig`. |
| Forum structure | Profiles & Benchmarks (id 9) has the "Runner profile" and "Benchmark run" form templates. Hardware (id 5) has "Hardware report". Both categories have zero topics, and so do all six content-model tag groups. |
| Stacks | hal0 exports and imports `.hal0stack.json`. Neither the site nor the forum shows stacks. |

hal0 already owns the profile and stack formats, with checksums and import code. The forum
already has form templates, tag groups and the TOML download button. The missing pieces are the
glue between them: a way to post from the CLI, a layout the CLI and the browser share, and a read
path for hal0.dev.

## Information architecture

The hub covers AMD's AI hardware, homelabs, self-hosting and building on hal0. With almost no
topics yet, the forum stays flat: one category per kind of conversation. Platform and lane are
**tags**, not subcategories, so a Strix Halo thread and a Gorgon Halo thread can sit in the same
category and still filter cleanly.

| Category | Slug | What goes there | Change |
|---|---|---|---|
| Announcements | `announcements` | Releases and hub news, staff only | keep |
| Benchmarks | `benchmarks` | One topic per shared result. Template: Benchmark | **new** |
| Profiles | `profiles` | One topic per profile. Template: Profile | rename id 9 from "Profiles & Benchmarks" and keep the slug |
| Stacks | `stacks` | One topic per stack. Template: Stack | **new** |
| Hardware & Tuning | `hardware` | Strix Halo, Gorgon Halo and XDNA NPU: BIOS, kernel, ROCm, memory split, power. Template: Hardware report | rename id 5 |
| Models & Runners | `models-runners-and-binaries` | Models built or quantized for Halo hardware, runner images, llama.cpp builds | rename id 25 and fold the empty `models` subcategory (26) into it |
| Homelab & Self-hosting | `homelab` | Proxmox, LXC and Incus, storage, networking, running hal0 next to everything else | **new** |
| Building on hal0 | `dev` | The `/v1` API, MCP servers, agents, apps that use hal0 | **new** |
| Help & Support | `help` | hal0 problems. Solved is on | keep |
| Knowledge Base | `kb` | Guides, staff-written and community-written | keep. Open topic creation to TL2 |
| Docs | `docs` | Synced reference docs | keep, read-only |
| Site / Meta | `site-meta` | The forum itself | keep |

Each new or renamed category lands as code in `scripts/push-content-model.py`, so the forum can be
rebuilt from the repo. The README's "Forum content model" table in hal0-discourse-theme is already
out of date (`README.md:382-386`) and gets rewritten in the same PR.

**Tags.** The six existing groups stay: Intent, Lane, Model Family, Workload, Platform and Quant.
One group is new:

- **Status** (staff-only, visible to everyone): `verified`. Only staff can add or remove it
  (`lib/discourse_tagging.rb:74,86-90`). It is never offered in a form template.

`max_tags_per_topic` goes from 5 to 8. A Profile carries Intent, Lane, Model Family, Quant,
Platform and `verified`, which is six. At 5, Discourse silently drops the sixth
(`lib/discourse_tagging.rb:937`).

**Required tags.** Discourse enforces `required_tag_groups` on the server, including for API
posts. That makes it the one structural rule a hand-made API post can't skip. Benchmarks require
one Platform, one Lane and one Quant tag. Profiles require one Lane. Stacks require one Platform.

## The three post types

All three use the same shape:

1. **A title the CLI generates**, unique and at least 15 characters (`min_topic_title_length`).
2. **Form fields rendered as `### Label` sections.** This is how Discourse serialises a form
   template into the post body (`form-template-validation.js:56-65`). The CLI writes the same
   layout, so a CLI post and a browser post look identical.
3. **Exactly one machine block**: a fenced ` ```json ` block that holds a hal0 envelope with a
   `kind` and a `checksum`. The block is the record. Tags and headings make it findable, and the
   thread is where people talk about it.

Envelopes, rather than TOML, are the machine format because hal0 already defines and checks them
(`hal0.profile`, `hal0.stack`) and its import code reads them. A second hand-maintained format is
what hal0-profiles turned into. This changes the starting direction in the issue, which proposed a
canonical TOML block. The theme's download button gets extended from ` ```toml ` to these
` ```json ` blocks.

Nothing needs an attachment. TL0 users can't attach files (`newuser_max_attachments = 0`), and
JSON and tarballs aren't allowed extensions. A post body holds up to 32,000 characters
(`max_post_length`), which is enough for one run or one stack. The CLI refuses anything bigger
and says why.

### Benchmark

One topic is one run on one box. Reproductions are replies in the same thread, each with its own
block.

| Field | Form element | Becomes |
|---|---|---|
| Result | textarea, required | the `hal0.bench-share` block |
| Platform | tag-chooser, Platform | tag (required) |
| Lane | tag-chooser, Lane | tag (required) |
| Quant | tag-chooser, Quant | tag (required) |
| Model family | tag-chooser, Model Family | tag |
| What I changed | textarea | body text: BIOS, kernel, memory split, anything non-default |

Title: `<model> <quant> on <platform>, <lane>: <decode> tok/s decode (<date>)`.

`hal0.bench-share` is a new envelope. hal0 owns it, so its exact shape is for the hal0 squad to
settle. As a starting point it is the existing bench bundle minus the files that can't go in a
post:

- `kind`, `schema_version`, `hal0_version`, `created_at`, `checksum`
- `host`: the bundle manifest's host object. The hostname is always redacted, which is already
  supported (`src/hal0/bench/bundle.py:140-141`).
- `records`: the `records.jsonl` rows. Each row has model id, quant, lane, kind, depth, config
  label, the six metrics and caps.
- `profile`: the `hal0.profile` envelope the run used, inline, so a reader can install exactly
  what produced the number.
- `evals`: optional.
- No artifacts. A run's raw artifacts stay on the box that made them.

### Profile

| Field | Form element | Becomes |
|---|---|---|
| Profile | textarea, required | the `hal0.profile` envelope, as `hal0 profile export` writes it |
| Intent, Lane, Model family, Quant, Platform | tag-choosers | tags (Lane required) |
| What it's for | textarea | body text |
| Tested on | textarea | body text: hardware, hal0 version |

Benchmark topics link to a profile topic when their embedded profile has the same checksum. The
profile page lists those results, so numbers are never typed into a profile post. That matches the
rule hal0-profiles already follows (bench numbers are joined, never stored).

### Stack

| Field | Form element | Becomes |
|---|---|---|
| Stack | textarea, required | the `hal0.stack` envelope, as `/api/stacks/{slug}/export` writes it |
| Intent (multiple), Platform | tag-choosers | tags (Platform required) |
| What it sets up | textarea | body text: which slots, which models, how much memory it needs |
| Tested on | textarea | body text |

A stack envelope already embeds its profiles and model metadata and never contains weights,
secrets or host paths (H0-157 §6).

### Profiles and stacks change by new version, not by wiki

The starting direction proposed a wiki first post. A wiki lets any TL1 user change the flags in a
profile that other people then install, so this design leaves wiki off. The author edits until the
topic is verified. After that a change is a new reply with a new block, and staff verify that
version. `hal0 profile install` takes the newest verified block in the thread.

## Submitting

### From the CLI (hal0 squad)

```bash
hal0 forum login                       # once per box: Discourse User API Key device flow
hal0 bench share                       # the newest run; shows the post, asks before sending
hal0 bench share --run <run_id> --reply-to <topic-url>   # a reproduction
hal0 profile share <name>
hal0 stack share <slug>
hal0 forum logout                      # revokes the key on the forum
```

- **Sign-in** uses the User API Key device flow (`POST /user-api-key/device`, then poll), which
  the live forum serves. The user approves on any device with a browser. The forum returns the key
  encrypted to a keypair the CLI generated, and the CLI keeps it in a file only the hal0 user can
  read.
- **Scope.** Core Discourse has no scope narrower than `write`, and `write` can do anything the
  user can do on the forum. The CLI says that plainly at login. A narrower `hal0:share` scope needs
  a custom plugin and a rebuild, so it's deferred until volume justifies it.
- **What `share` does:** it builds the title, the `### Label` sections, the tags and the block,
  then runs the same plausibility bands hal0.dev uses and warns on any flag. It prints the whole
  post and sends it only after the user confirms. `--print` writes the post to stdout and sends
  nothing.
- **Limits a new account hits** (defaults; the live values need an admin key to confirm): 3 new
  topics on the first day, 15 seconds between topics, 2 links per post at TL0. The CLI reports the
  forum's error message as-is when it hits one.
- `hal0 bench upload`, the `api.hal0.dev` default and `HAL0_BENCH_TOKEN` are removed.

### From the browser

The form templates are the browser path. The machine block still comes from hal0:
`hal0 bench share --print`, `hal0 profile share --print` and `hal0 stack share --print` output the
block, and the user pastes it into the required field. The Profile and Stack blocks are also
available from the hal0 dashboard's export buttons. Someone without a hal0 box has nothing to
share, so there is no hand-written path.

Discourse only checks a form template in the browser. The server never validates it, so an API
post can skip it. Checking the block is therefore done where it's read: by hal0.dev and by the
installer.

### Installing

```bash
hal0 profile install https://forum.hal0.dev/t/<slug>/<id>
hal0 stack import https://forum.hal0.dev/t/<slug>/<id>
```

These are anonymous reads (`/raw/<id>`), with no sign-in. The CLI pulls the newest verified block,
checks the `kind` and the checksum, shows what will change on the box and asks before calling the
existing import route. An unverified topic needs `--allow-unverified`, and the CLI says who posted
it and that nobody has checked it.

A profile or stack from the forum is configuration someone else wrote, running on your box. Before
`install <url>` ships, the hal0 squad confirms two things against source and adds any missing
check:

1. Profile import rejects managed and hardware flags in `flags`. The `ProfileConfig.flags`
   description says these must never be there, but a description doesn't enforce anything.
2. Stack import rejects runner images that aren't in hal0's runner catalog.

## The leaderboard and the hal0.dev views

hal0.dev reads the forum on the server and caches the result. The browser never talks to the
forum API.

- **Query.** One Data Explorer query per view (benchmarks, profiles, stacks). It joins topics,
  first posts and replies, tags and authors in those categories, and pulls the ` ```json ` block
  out of `posts.raw`. Data Explorer has no anonymous access, and its default limit is 1000 rows
  (configurable up to 10,000) with a 10-second timeout.
- **Key.** A granular API key with the `data_explorer:run_queries` scope, bound to those query
  ids, so it can run nothing else (`plugin.rb:153-161`). It lives as a Vercel environment
  variable. This is a credential, so Alex creates it and approves the merge that uses it.
- **Function.** A Vercel function returns `benchmarks.json`, `profiles.json` and `stacks.json`
  with a five-minute cache. That keeps forum load to one query per view per five minutes, well
  under `max_data_explorer_api_reqs_per_10_seconds = 2`. The forum sends `no-store` on its own
  JSON, so caching has to happen on our side. If the forum is down, the pages serve the last good
  snapshot, which is the same fallback `/benchmarks` uses today.
- **Checks, in one module.** The Worker's checks move to `src/lib/bench-checks.mjs` in hal0-web.
  That covers envelope `kind` and `schema_version`, the checksum, `outcome == "ok"`, finite and
  positive metrics, at least one throughput metric, and the plausibility bands. The bands are
  decode 0.05–5000 tok/s, prefill 0.5–100,000 tok/s and TTFT p50 0.1–600,000 ms
  (`workers/bench-api/src/validate.ts:80-84,192-205`). A failed check drops the record. A band hit
  keeps it with a flag, as the Worker did. The CLI ships the same bands, so honest submitters hear
  about it before they post.
- **Grouping.** Rows group by model id, quant, lane, Platform tag, kind and depth, computed from
  the record. The submitted `cell_key` isn't trusted, which removes the Worker's unsolved "P4"
  problem. If the same `run_id` shows up in two topics, the earliest post counts and the later one
  is flagged as a duplicate.
- **What the page shows.** The layout from the August comps (`2026-08-09-community-comps/02
  Benchmarks.html`) stays. There are two views:
  - **Verified** (default) shows topics tagged `verified`. A cell shows the median decode across
    its verified results and how many results there are.
  - **Community** adds every unflagged result. Flagged results appear with their flag.

  Every row links to its forum thread, and the run drawer shows the block's records and host.
- **/profiles and /stacks** list topics with their tags, Topic Voting count and verified state.
  Each card has an "Install" line with the `hal0 profile install <url>` or `hal0 stack import
  <url>` command, plus results linked by profile checksum. Discussion stays on the forum. A
  Stacks page and nav entry are new. They are a shared-chrome change, so the hal0-web change lands
  first and the theme sync follows.

## Trust and moderation

| Mechanism | Applies to | Why |
|---|---|---|
| `verified` tag (Status group, staff only) | all three | The one trust mark. Readable from topic lists and Data Explorer. Non-staff users can't add or remove it. |
| Lock post when verifying | all three | The tag doesn't stop an author from editing the numbers afterwards. Locking the first post (or the verified reply) does. |
| Approval queue for every new topic | Profiles, Stacks | People install these. Volume will be low at first, so staff can read each one. We revisit if the queue gets busy. |
| No approval queue | Benchmarks | Numbers can't harm a box. Unverified results only show in the Community view. |
| Required tag groups | all three | The one rule the server enforces on API posts. |
| Topic Voting | Profiles, Stacks | Sort by what people found useful. Benchmarks are ranked by their numbers, not by votes. |
| Flags, slow mode, rate limits | everywhere | Discourse defaults. |
| "Verified submitter" badge | users | For people with several verified posts. Recognition only; the badge confers nothing. |

**When staff verify.**

- A **benchmark** is verified when it passes every check with no band flag, and either a staff
  bench box or another user reproduces decode within 10%. The 10% is a starting threshold.
- A **profile or stack** is verified when staff have read it, installed it on a Halo box and it
  loaded.

The steps for staff: add `verified`, lock the post, and reply with what was checked.

**hal0-profiles retires** rather than becoming the verified tier. Nothing in hal0 reads it, it
uses a schema hal0 doesn't, and it has never had a PR. Keeping it would mean two places that both
claim to be the verified profile list. Its 8 profiles get converted to `ProfileConfig` by hand,
checked against `src/hal0/config/schema.py`, and reposted as verified Profile topics. After that
the repo is archived.

## Migration off the Worker

**What happens to existing published results:** as far as we can tell there are none. Alex should
confirm with Cloudflare access before anything is deleted:

```bash
cd workers/bench-api
npx wrangler d1 execute hal0_bench --remote --command "select status, count(*) from bundles group by status"
npx wrangler d1 execute hal0_bench --remote --command "select count(*) from records"
```

The R2 bucket `hal0-bench-bundles` should also be empty in the dashboard. If either command finds
rows, the import below takes them too.

**The order.** Nothing is removed until the replacement is live.

1. Forum structure, templates, tags and the theme changes land (see the breakdown below).
2. The leaderboard function reads an empty Benchmarks category. /benchmarks keeps showing
   `model-roster.ts` as its fallback, so nothing visible changes.
3. The 26 first-party results get posted as Benchmark topics from a hal0 staff account and tagged
   `verified`. The first-party roster becomes the first page of the leaderboard. This needs
   `hal0 bench share`. If the CLI work runs late, a one-off script in hal0-web can post from the
   same source data (`bench/build_data.py`) using the same layout.
4. The 8 hal0-profiles profiles are reposted as verified Profile topics.
5. /benchmarks and /profiles switch to forum data, and `model-roster.ts`, `bench-snapshot.json`,
   `profiles.json`, `scripts/sync-bench.mjs`, `scripts/sync-profiles.mjs` and the GitHub-PR submit
   flow are deleted. /profiles/submit now points to the forum.
6. `workers/bench-api/` and `.github/workflows/bench-api.yml` are deleted.
7. Alex deletes the Cloudflare Worker, both D1 databases, both R2 buckets, the `api.hal0.dev`
   record and the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. Alex also
   archives hal0-profiles.

After step 7, Cloudflare is DNS and proxy only (plus Pages for `releases.hal0.dev` until H0-155
moves it).

## Issue breakdown

Ordered. Each row is one issue and one PR. **No issue is filed until Alex approves this doc.**

| # | Owner | Issue | Needs | Merge gate |
|---|---|---|---|---|
| 0 | Alex | Confirm the Worker data is empty (commands above) | — | — |
| F1 | Forum Engineer | `push-content-model.py`: read credentials from the environment, upsert categories, send tag-group permissions | — | Reviewer |
| F2 | Forum Engineer | The categories, Status tag group, required tag groups, `max_tags_per_topic = 8`, Profiles and Stacks approval queues, KB at TL2, Topic Voting on Profiles and Stacks. All of it as code through F1, plus the README content-model rewrite | F1 | Reviewer |
| F3 | Forum Engineer | Form templates Benchmark, Profile and Stack, replacing "Benchmark run" and "Runner profile". The script never deletes, so the old two are removed by hand | F2 | Reviewer |
| F4 | Forum Engineer | Theme: download button for ` ```json ` hal0 envelopes, named `<slug>.hal0profile.json` and `<slug>.hal0stack.json`. An install-command line on Profile and Stack topics, a verified badge in topic lists, and a result card that renders the block's numbers on Benchmark topics | F3 | Reviewer |
| F5 | Forum Engineer | The three Data Explorer queries, tested against seeded topics in a staff-only category | F3 | Reviewer |
| A1 | Alex | Create the granular `run_queries` key bound to the F5 query ids and add it to Vercel | F5 | — |
| H1 | hal0 squad | `hal0 forum login` / `logout` (User API Key device flow) | — | hal0 squad |
| H2 | hal0 squad | `hal0.bench-share` envelope and `hal0 bench share` (`--run`, `--reply-to`, `--print`, plausibility bands). Remove `bench upload` and the `api.hal0.dev` default, and update `docs/reference/model-roster-benchmark.mdx` | H1 | hal0 squad |
| H3 | hal0 squad | `hal0 profile share` / `install <url>`, including the managed-flag check | H1 | hal0 squad |
| H4 | hal0 squad | `hal0 stack share` / `import <url>`, including the runner-catalog check | H1 | hal0 squad |
| W1 | Web Engineer | `src/lib/bench-checks.mjs` ported from `validate.ts`, with its tests | — | Reviewer |
| W2 | Web Engineer | Vercel function serving `benchmarks.json` / `profiles.json` / `stacks.json` from Data Explorer, with fallback snapshots | W1, A1 | **Alex** (credential, server function) |
| W3 | Web Engineer | /benchmarks and /profiles read W2, a new /stacks page, and the Stacks nav entry in `nav.json`, followed in series by the theme nav sync (Forum Engineer) | W2 | Reviewer, then theme sync |
| W4 | Web Engineer | Seed: post the 26 roster results and the 8 converted profiles as verified topics | H2 + H3, or the one-off script | Reviewer |
| W5 | Web Engineer | Delete `workers/bench-api`, its workflow, the sync scripts, static data and the PR submit flow | W3, W4, 0 | **Alex** (CI, bench infrastructure) |
| A2 | Alex | Delete the Cloudflare resources, DNS record and secrets, and archive hal0-profiles | W5 | — |
| C1 | Web Lead | The launch post for the hub in Announcements, as a draft until Alex approves | W3 | Alex |

These can run in parallel: F1–F5, H1–H4 and W1. W2 waits on A1, and everything from W3 on runs in
order. No VPS host action or plugin install is needed, because every plugin this design uses is
already enabled.

## Decisions for review

1. **hal0-profiles retires** and is not kept as the verified tier. *Recommended.*
2. **The machine format is hal0's own JSON envelopes**, not a TOML block. *Recommended*, because
   it gives one owner, a checksum and the import code hal0 already has.
3. **No wiki first posts.** New versions are posted as replies and verified again. *Recommended.*
4. **The CLI key has `write` scope.** It's the narrowest scope core Discourse offers. The
   alternative is a custom plugin and a launcher rebuild. *Recommended for v1.*
5. **The category list** in [Information architecture](#information-architecture), including the
   two new discussion categories (Homelab & Self-hosting, Building on hal0) and the renames.
6. **Approval queues on Profiles and Stacks** for everyone at launch.
7. **The verification threshold** for benchmarks: a reproduction within 10% on decode.

## Open items

- The forum brief couldn't read per-category group permissions, the live `approve_*` and
  new-user limit values, or Admin → Plugins, because there's no admin key on the agent runtime.
  F2 confirms them first.
- Extracting the block from `posts.raw` in SQL within the 10-second timeout is untested. F5
  proves it. If it's too slow, the fallback is a staff-run Automation that copies the block into a
  hidden reply, or a small plugin that stores it as a topic custom field. The plugin needs a
  rebuild.
- The CLI config path for the forum key, and whether `hal0 forum` is the right command group, are
  for the hal0 squad to decide.
