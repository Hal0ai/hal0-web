#!/usr/bin/env bash
# Regenerates test fixtures using the hal0 repo's bench CLI (P1).
# Requires: hal0 worktree with .venv at $HAL0_SRC (default below).
set -euo pipefail
HAL0_SRC=${HAL0_SRC:-/mnt/mintdev/worktrees/hal0/bench-bundle-upload}
OUT=$(cd "$(dirname "$0")/../test/fixtures" && pwd)
STATE=$(mktemp -d)
export HAL0_BENCH_STATE="$STATE"
PY="$HAL0_SRC/.venv/bin/python"

"$PY" - <<'EOF'
from hal0.bench.store import Store
store = Store()
def rec(run_id, model, kind, decode, cell):
    return {"run_id": run_id, "cell_key": cell, "suite": "roster", "trigger": "manual",
            "identity": {"model": {"id": model, "quant": "Q4_K_M"}, "lane": "rocm",
                         "workload": {"kind": kind, "depth": 2048}},
            "host": {"name": "fixture-box", "gpu": "AMD Strix Halo", "mem_gb": 128,
                     "hal0_version": "1.0.0"},
            "outcome": "ok",
            "summary": {"decode_ts_med": decode, "prefill_ts_med": 700.0,
                        "ttft_ms_p50": 120.0, "ttft_ms_p95": 180.0},
            "telemetry": {"vram_peak_mb": 30000, "gpu_power_avg_w": 90}, "schema": 2}
store.append_record(rec("2026-08-09T01:00:00Z-fix001", "qwen3-30b", "tg", 42.5,
                        "sha256:" + "a" * 64))
store.append_record(rec("2026-08-09T01:05:00Z-fix002", "qwen3-30b", "pp", 700.0,
                        "sha256:" + "b" * 64))
import json, pathlib
pathlib.Path(store.root, "evals.jsonl").write_text(
    json.dumps({"run_id": "ev1", "model": "qwen3-30b", "task": "tool-calling",
                "score": 0.87}) + "\n")
pathlib.Path(store.root, "chat.toml").write_text('[profile.chat]\nflags = "-fa 1"\n')
EOF

"$PY" -m hal0.bench.cli bundle \
  --profile "$STATE/chat.toml" \
  --title "fixture bundle" -o "$OUT/valid.hal0bench.tar.gz"
tar -xzf "$OUT/valid.hal0bench.tar.gz" -C "$OUT" manifest.json
mv "$OUT/manifest.json" "$OUT/valid-manifest.json"
rm -rf "$STATE"
echo "fixtures written to $OUT"
