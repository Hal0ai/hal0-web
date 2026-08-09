# Fixtures

`valid.hal0bench.tar.gz` is a real bundle produced by the hal0 bench CLI (P1) — two
`records.jsonl` entries for the same model on different lanes/kinds, one profile
(`profiles/chat.toml`), and one eval row (`evals.jsonl`). `valid-manifest.json` is that
bundle's `manifest.json`, extracted alongside it so tests can assert against the manifest
shape without unpacking the tarball.

Both files are generated, not hand-written. Do not hand-edit them, and do not commit
hand-corrupted variants — tests that need a broken bundle should derive one in-memory from
`valid.hal0bench.tar.gz` (e.g. truncate bytes, flip a manifest field) rather than checking in
a second binary fixture.

Regenerate with:

```bash
bash workers/bench-api/scripts/make-fixtures.sh
```

This requires a hal0 worktree with a populated `.venv` (default:
`/mnt/mintdev/worktrees/hal0/bench-bundle-upload`, override via `HAL0_SRC`).
