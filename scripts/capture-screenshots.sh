#!/usr/bin/env bash
# Run scripts/capture-screenshots.mjs inside the Playwright container.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: HAL0_BOX_IP=<ip> scripts/capture-screenshots.sh [shot-name ...]

Captures dashboard screenshots into public/screenshots/ from the hal0 box at
HAL0_BOX_IP, reached as http://hal0.local:8080 (so no private hostname lands
in the pixels). With no shot names, every non-skipped shot runs.

Review every PNG for private hostnames, keys, and personal slot/model names
before committing.
USAGE
}

case "${1:-}" in -h|--help) usage; exit 0 ;; esac
if [ -z "${HAL0_BOX_IP:-}" ]; then
  echo "error: HAL0_BOX_IP is required" >&2
  usage >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# HAL0_ADMIN_KEY (optional) signs the capture browser in on a LAN-gated box;
# it is passed through from the caller's environment, never written down.
exec docker run --rm --ipc=host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e HAL0_DASHBOARD_URL=http://hal0.local:8080 \
  -e HAL0_ADMIN_KEY \
  -e HAL0_CHROMIUM_ARGS \
  --add-host "hal0.local:${HAL0_BOX_IP}" \
  -v "${ROOT}:${ROOT}" -w "${ROOT}" \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -c 'npm i --no-save playwright@1.64.0 && node scripts/capture-screenshots.mjs "$@"' _ "$@"
