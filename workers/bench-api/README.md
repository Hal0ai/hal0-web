# hal0-bench-api

Cloudflare Worker that ingests `hal0 bench` result bundles (tar.gz) and serves
the published benchmark roster/records to the site and CLI.

## Architecture

An admin-authenticated `POST /v1/bundles` upload is untarred in-worker, the
manifest and `records.jsonl`/`profiles`/`evals` payloads are validated
(schema, cell-key format, finite/positive metrics, plausibility flags), then
the original tar.gz is written to R2 and the parsed rows are batch-inserted
into D1 as a single atomic write (bundle, records, profiles, evals all get
`status = 'published'`). Duplicate bundle ids short-circuit with the existing
record count; a `(cell_key, run_id)` collision against a different bundle is
rejected outright so two uploads can never silently overwrite each other's
published numbers. `DELETE /v1/bundles/:id` is a soft delete — it flips
`status` to `'deleted'` on the bundle and all of its dependent rows rather
than removing anything, so R2 objects and history stay intact and the
`current_cells` view (which only selects `status = 'published'`, newest `seq`
per `cell_key`) simply stops surfacing them. The `status` column doubles as
the future moderation gate (`pending`/`rejected`) and the `uploader` column
is carried on every bundle row so non-admin submission (P4) is schema-free to
add later.

Unpublish is reversible: re-uploading the exact same bundle (same content
hash / `bundle_id`) after a `DELETE` flips its `status` and its dependent
rows' `status` back to `'published'` instead of re-validating and
re-inserting — the response is `{bundle_id, republished: true, records: N}`.
Note that `(cell_key, run_id)` collision checking is not status-scoped:
records belonging to a `'deleted'` bundle still block *other* bundles from
publishing the same `(cell_key, run_id)` pair.

## Local dev

Run `npm run dev` to start `wrangler dev` against the local/miniflare D1 and
R2 bindings declared at the top of `wrangler.toml` (`hal0_bench_dev` /
`hal0-bench-bundles-dev`). Run the test suite with `npx vitest run` (or
`npm test`); `npx tsc --noEmit` checks types without emitting. Tests apply
migrations against an in-memory D1 via `test/apply-migrations.ts` so no
Cloudflare credentials are needed to run them locally or in CI.

## P4 note: cell_key is trusted, not recomputed

Admin uploads are validated for `cell_key` *format* (`CELL_RE` in
`src/validate.ts`) but the value itself is taken as-is from
`records.jsonl` — the worker never recomputes it from the identity fields.
That's fine for the current trusted-admin-only upload path, but P4
(non-admin/self-serve submission) must re-raise this: either recompute and
verify `cell_key` server-side from the identity payload, or otherwise ensure
an untrusted uploader cannot forge collisions/overwrites by hand-crafting the
key.

## One-time environment setup

Run once per environment, in order. `wrangler d1 create` and
`wrangler r2 bucket create` print the resource id/name to paste into
`wrangler.toml`.

```bash
wrangler d1 create hal0_bench_staging      # paste id into wrangler.toml [env.staging]
wrangler d1 create hal0_bench              # paste id into [env.production]
wrangler r2 bucket create hal0-bench-bundles-staging
wrangler r2 bucket create hal0-bench-bundles
wrangler d1 migrations apply hal0_bench_staging --env staging --remote
wrangler d1 migrations apply hal0_bench --env production --remote
wrangler secret put ADMIN_TOKEN --env staging     # openssl rand -hex 32
wrangler secret put ADMIN_TOKEN --env production  # different token
wrangler deploy --env staging
# custom domain api.hal0.dev binds automatically from wrangler.toml on production deploy
```

Production deploys are manual-only (`workflow_dispatch` with
`environment: production` in `.github/workflows/bench-api.yml`) until the
staging path has burned in. Staging redeploys automatically on every push to
`master` that touches `workers/bench-api/**`.

## Ops: rate limiting

`POST /v1/bundles` is admin-token gated but has no in-worker rate limit.
Add a Cloudflare dashboard rate rule on `POST api.hal0.dev/*` (e.g. 10
req/min/IP) after the production custom domain is live, to blunt brute-force
token guessing and accidental retry storms.

## Verifying an end-to-end deploy

Against staging, upload a real bundle with the CLI and confirm it shows up
in the roster:

```bash
HAL0_BENCH_API_BASE=https://hal0-bench-api-staging.<account>.workers.dev \
HAL0_BENCH_TOKEN=<staging token> \
  hal0 bench upload some-run.hal0bench.tar.gz
curl -s "$HAL0_BENCH_API_BASE/v1/roster" | jq .
```
