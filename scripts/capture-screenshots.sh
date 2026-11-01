#!/usr/bin/env bash
# Run scripts/capture-screenshots.mjs inside the Playwright container.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: HAL0_BOX_IP=<ip> scripts/capture-screenshots.sh [--out <dir>] [shot-name ...]

Captures dashboard screenshots from the hal0 box at HAL0_BOX_IP, reached as
http://hal0.local:8080 (so no private hostname lands in the pixels). Open WebUI
shots load HAL0_OPENWEBUI_URL, default http://hal0.local:3001. With no shot
names, every non-skipped shot runs.

  --out <dir>   write the PNGs to <dir> instead of public/screenshots/ (created
                if missing). Use a scratch directory to review a sweep before
                copying anything into the site.

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

# --out <dir> / --out=<dir>: the container sees only what is mounted, so make
# the directory on the host, resolve it to an absolute path, mount it at the
# same path and hand the script that path.
ARGS=()
MOUNTS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out|--out=*)
      if [ "$1" = "--out" ]; then
        [ "$#" -ge 2 ] || { echo "error: --out needs a directory" >&2; exit 2; }
        dir="$2"
        shift 2
      else
        dir="${1#--out=}"
        shift
      fi
      case "$dir" in ""|--*) echo "error: --out needs a directory" >&2; exit 2 ;; esac
      mkdir -p "$dir"
      dir="$(cd "$dir" && pwd)"
      ARGS+=(--out "$dir")
      # Inside the repo it is already mounted; mounting it again can collide.
      case "$dir/" in
        "$ROOT"/*) ;;
        *) MOUNTS+=(-v "${dir}:${dir}") ;;
      esac
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

# --network host: on the capture box the default bridge network has no egress,
# which `npm i playwright` inside the container needs. --add-host still maps
# hal0.local to the box in /etc/hosts.
# HAL0_ADMIN_KEY (optional) signs the capture browser in on a LAN-gated box;
# it is passed through from the caller's environment, never written down.
# HAL0_OPENWEBUI_URL (optional) overrides where the Open WebUI shots load.
exec docker run --rm --ipc=host --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e HAL0_DASHBOARD_URL=http://hal0.local:8080 \
  -e HAL0_ADMIN_KEY \
  -e HAL0_OPENWEBUI_URL \
  -e HAL0_CHROMIUM_ARGS \
  --add-host "hal0.local:${HAL0_BOX_IP}" \
  -v "${ROOT}:${ROOT}" ${MOUNTS[@]+"${MOUNTS[@]}"} -w "${ROOT}" \
  mcr.microsoft.com/playwright:v1.64.0-noble \
  bash -c 'npm i --no-save playwright@1.64.0 && node scripts/capture-screenshots.mjs "$@"' _ ${ARGS[@]+"${ARGS[@]}"}
