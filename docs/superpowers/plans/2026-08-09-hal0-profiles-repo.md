# hal0-profiles Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `Hal0ai/hal0-profiles` repo — the community profile registry: one TOML per profile, schema validation, PR-based CI that validates exactly the changed files, and eight seed profiles from the design handoff's real data.

**Architecture:** Single TOML file per profile at `profiles/<slug>.toml` (append-mostly; conflicts only within one profile). A Node validator (`smol-toml` parse → `ajv` JSON-Schema validation → cross-checks: slug/filename match, history ordering, unique slug) runs via `node --test` locally and via a GitHub Actions workflow that validates changed files on PRs and everything on pushes to main. hal0-web later ingests this repo at build time; merges trigger a Cloudflare Pages deploy hook.

**Tech Stack:** Node 22+, `smol-toml`, `ajv` + `ajv-formats`, `node --test`, GitHub Actions.

## Global Constraints

- Repo: `Hal0ai/hal0-profiles`, public, Apache-2.0, default branch `main`.
- Profile file format (schema = 1), exactly this shape — field names are load-bearing for hal0-web's gallery and the future `hal0 profile install`:

```toml
schema = 1

[profile]
slug = "strix-mtp-max"            # ^[a-z0-9][a-z0-9-]{2,63}$ ; must equal filename stem
title = "Speculative decode, everything on"
summary = "draft-mtp with an f16 KV cache. The fastest tokens this box produces, at the cost of 19 GB resident and no room for a second big slot."
intent = "chat"                   # chat | coding | agent | vision | draft | moe | embedding
author = "hal0-ci"                # github handle, no leading @
first_party = true                # optional, default false

[runner]
kind = "llama-server"             # llama-server | flm | onnx | vllm
lane = "rocm"                     # rocm | vulkan_radv | default | npu
min_build = "b9219"               # optional
image = "ghcr.io/hal0ai/amd-strix-halo-toolboxes:rocm-7.2.4-rocmfp4-server"  # optional

[model]
id = "chadrock3-6-35b-uncensored-mtp-strix-lean"   # primary model id (roster id form)
quant = "q4_k_xl"                                  # optional
compatible = ["chadrock-35b-ace-saber", "qwen3.6-35b-a3b-crown-halo-mtp-dynamic"]  # optional

[args]
raw = "-ngl 99 -c 2048 -fa 1 -ctk f16 -ctv f16 --parallel 1 -b 512 --draft-max 4 --draft-min 1 --mtp on"

[requires]                        # optional table
gtt_gb = 24
exclusive = false

[[history]]                       # newest first; history[0].v is the current version
v = 4
date = 2026-06-19
note = "pin build b9219 — draft-mtp accept regressed on b9101"
```

- Bench numbers are NEVER stored in profile files — they join from first-party bench data by slug at hal0-web build time (spec section 3).
- Validator messages must be actionable: file, field path, expected vs got.
- All commits Conventional Commits. `npm test` green after every task.
- Seed data comes verbatim from `docs/design/2026-08-09-community-comps/profiles-data.js` in hal0-web (real sweep-derived profiles) — do not invent content.

## File Structure

```
hal0-profiles/
  README.md                     # what a profile is, layout, install pointer
  CONTRIBUTING.md               # submission guide (manual PR now; doors later)
  LICENSE                       # Apache-2.0
  package.json                  # smol-toml, ajv, ajv-formats; "test", "validate"
  schema/profile.schema.json    # JSON Schema (draft 2020-12) for the parsed TOML
  lib/validate.mjs              # parse + schema + cross-checks; exports validateFile, validateAll
  scripts/validate.mjs          # CLI: validate file args, or all profiles with none
  scripts/test/validate.test.mjs
  scripts/test/fixtures/        # valid + each invalid case
  profiles/<slug>.toml          # 8 seed profiles
  .github/workflows/validate.yml
  .github/pull_request_template.md
```

---

### Task 1: Repo scaffold + schema + validator (TDD)

**Files:** create the repo and everything except seeds + workflow.

**Interfaces:**
- Produces: `lib/validate.mjs` exporting `validateFile(path) → { ok: true, profile } | { ok: false, errors: string[] }` and `validateAll(dir) → { ok, errors, count }` (cross-file: duplicate slugs). Errors are strings `"<file>: <field-path>: <message>"`.
- Produces: `schema/profile.schema.json` — draft 2020-12, `additionalProperties: false` everywhere, enums exactly as the Global Constraints table, `history` minItems 1 with `v` (integer ≥1), `date` (format `date`), `note` (non-empty string); slug pattern `^[a-z0-9][a-z0-9-]{2,63}$`.

- [ ] Step 1: `gh repo create Hal0ai/hal0-profiles --public --description "Community model/runner profiles for hal0 — versioned TOML, PR-reviewed" --clone` into a work directory; `cd` in; add LICENSE (Apache-2.0 text), minimal README stub (expanded in Task 3), package.json:

```json
{
  "name": "hal0-profiles",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test 'scripts/test/**/*.mjs'",
    "validate": "node scripts/validate.mjs"
  },
  "dependencies": { "ajv": "^8.17.1", "ajv-formats": "^3.0.1", "smol-toml": "^1.3.1" }
}
```

- [ ] Step 2: write failing tests in `scripts/test/validate.test.mjs` against fixtures (create fixtures inline in this step): `valid.toml` (full example from Global Constraints), and invalid cases: `bad-slug-mismatch.toml` (slug ≠ filename), `bad-intent.toml` (intent "gaming"), `bad-missing-args.toml` (no `[args]`), `bad-history-order.toml` (history v ascending — must be newest-first / strictly descending), `bad-extra-field.toml` (unknown key `downloads`). Each test asserts `ok:false` and that the error string names the offending field. Plus `validateAll` duplicate-slug test with two fixture dirs. Run `npm test` → all fail (module not found).
- [ ] Step 3: implement `schema/profile.schema.json` and `lib/validate.mjs` (parse TOML with smol-toml; ajv with ajv-formats compiled once; cross-checks: filename-stem === profile.slug, history strictly descending `v`, schema === 1). `scripts/validate.mjs`: args = file paths → validateFile each; no args → validateAll('profiles'); exit 1 with all errors printed, exit 0 with `✓ N profiles valid`.
- [ ] Step 4: `npm test` → all pass. Commit `feat: profile schema and validator`.

### Task 2: Seed profiles + CI workflow

**Files:** `profiles/*.toml` (8), `.github/workflows/validate.yml`, `.github/pull_request_template.md`

**Interfaces:**
- Consumes: `scripts/validate.mjs` CLI (Task 1).

- [ ] Step 1: convert all eight profiles from hal0-web `docs/design/2026-08-09-community-comps/profiles-data.js` into `profiles/<slug>.toml` per the Global Constraints format. Mapping: `first: true` → `first_party = true`; `dec`/`downloads` are NOT copied (bench numbers live in bench data; downloads is synthetic); `models[0]` → `[model] id`, rest → `compatible`; comp history arrays copy verbatim (note strings unchanged); `[runner] kind = "llama-server"`, `lane` from `lane`; `image`/`min_build` only where the comp TOML generator implies them (rocm lanes: the ghcr rocm image + b9219). `intent = "moe"` maps as-is (it is in the enum).
- [ ] Step 2: `npm run validate` → `✓ 8 profiles valid`. Add a test asserting seed dir validates (`validateAll('profiles').ok === true`). `npm test` green.
- [ ] Step 3: `.github/workflows/validate.yml`:

```yaml
name: validate
on:
  pull_request:
  push:
    branches: [main]
jobs:
  profiles:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - name: Validate changed profiles (PR) or all (push)
        run: |
          if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
            CHANGED=$(git diff --name-only --diff-filter=ACMR origin/${GITHUB_BASE_REF}...HEAD -- 'profiles/*.toml')
            if [ -n "$CHANGED" ]; then npm run validate -- $CHANGED; else echo "no profile changes"; fi
          else
            npm run validate
          fi
```

- [ ] Step 4: PR template asking: what the profile trades, hardware tested on, how numbers were produced (`hal0 bench` invocation), checkbox "I ran `npm run validate`".
- [ ] Step 5: commit `feat: seed profiles and PR validation workflow`, push main, verify the push-triggered workflow is green (`gh run watch`).

### Task 3: Docs + hal0-web webhook note

**Files:** `README.md`, `CONTRIBUTING.md` (hal0-profiles); no hal0-web changes in this plan.

- [ ] Step 1: README — what a profile is (one paragraph, from spec section 3), the file format (the Global Constraints example verbatim), layout, "bench numbers are a join, not a field" rule, pointer to hal0.dev/profiles (future) and `hal0 profile install <slug>` (future).
- [ ] Step 2: CONTRIBUTING — manual submission path for now: fork → add `profiles/<your-slug>.toml` → `npm run validate` → PR; review policy from spec (CI green + returning submitter auto-mergeable; first-timers held for review); note the coming CLI/web doors so nobody builds against the manual flow as permanent.
- [ ] Step 3: commit `docs: readme and contributing guide`, push. Verify repo settings: squash-merge only, delete-branch-on-merge, branch protection on main requiring the `profiles` check (`gh api` or note for operator if permissions block it).
- [ ] Step 4: record follow-ups in the plan's tracking issue (create one issue in hal0-profiles): Cloudflare Pages deploy hook on merge (needs operator secret), bot auto-merge policy, submission doors.
