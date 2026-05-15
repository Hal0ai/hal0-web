#!/usr/bin/env bash
# build-og.sh — render public/og-default.png (1200×630).
#
# Composes the hal0 wordmark + halo companion mark over the brand
# dark surface, with the tagline. Output is the default OG / Twitter
# card referenced from astro.config.mjs `head`.
#
# Reproducibility:
#   The wordmark text needs a JetBrains Mono TTF. Resolution order:
#     1. $HAL0_OG_FONT          — explicit override
#     2. ./tools/JetBrainsMono.ttf
#     3. /mnt/repos/manifold/mani/assets/fonts/JetBrainsMono[wght].ttf
#     4. fontconfig lookup for "JetBrains Mono"
#   On any modern Linux box you can grab the OFL TTF from
#     https://github.com/JetBrains/JetBrainsMono/releases
#   and drop it at ./tools/JetBrainsMono.ttf to make the build offline-safe.
#
# Usage:
#   scripts/build-og.sh
#
# Tooling: ImageMagick 7+ (`magick`) with the freetype/svg delegates.

set -euo pipefail

cd "$(dirname "$0")/.."

resolve_font() {
    if [[ -n "${HAL0_OG_FONT:-}" && -f "$HAL0_OG_FONT" ]]; then
        echo "$HAL0_OG_FONT"; return
    fi
    if [[ -f "./tools/JetBrainsMono.ttf" ]]; then
        echo "./tools/JetBrainsMono.ttf"; return
    fi
    local manifold="/mnt/repos/manifold/mani/assets/fonts/JetBrainsMono[wght].ttf"
    if [[ -f "$manifold" ]]; then
        echo "$manifold"; return
    fi
    if command -v fc-match >/dev/null 2>&1; then
        local match
        match=$(fc-match -f '%{file}' 'JetBrains Mono:weight=bold' 2>/dev/null || true)
        if [[ -n "$match" && "$match" != *"NotoSans"* && "$match" != *"DejaVu"* ]]; then
            echo "$match"; return
        fi
    fi
    return 1
}

FONT=$(resolve_font) || {
    cat >&2 <<EOF
build-og: could not find a JetBrains Mono TTF.

Drop the OFL TTF at:    ./tools/JetBrainsMono.ttf
Or set the env var:     HAL0_OG_FONT=/path/to/JetBrainsMono.ttf
Or fontconfig-install:  https://github.com/JetBrains/JetBrainsMono/releases
EOF
    exit 1
}

OUT="public/og-default.png"
echo "build-og: font   = $FONT"
echo "build-og: output = $OUT"

# Canvas + wordmark constants.
#   Halo and text dimensions were chosen so the wordmark dominates the
#   safe-zone (the centre 1200×600 patch that Twitter actually shows)
#   while the halo gives it room to breathe at the top.
WIDTH=1200
HEIGHT=630
BG="#0a0a0a"
ACCENT="#ffb000"
FG="#f5f5f4"
MUTED="#a8a29e"

# Layout (all in canvas-pixel coordinates):
#   pointsize 240 — JBM Bold glyph advance ≈ 144px → "hal0" ≈ 576px wide.
#   Wordmark centered at x=600 → "hal" starts x=312, "0" starts x=744.
#   Wordmark baseline y=420 — leaves 120px under the type for the tagline.
#   Halo: cx=600 cy=216 rx=220 ry=28, tilted -3°, stroke 7px. Sits 12px
#     above the cap-line at the wordmark's vertical centre.
#   Tagline: pointsize 36 at y=540, ~64px wide bottom margin both sides.

magick -size "${WIDTH}x${HEIGHT}" "xc:${BG}" \
    -stroke "${ACCENT}" -strokewidth 7 -fill none \
    -draw "translate 600,216 rotate -3 ellipse 0,0 220,28 0,360" \
    -font "${FONT}" -pointsize 240 \
    -fill "${FG}"    -stroke none -annotate +312+420 "hal" \
    -fill "${ACCENT}" -stroke none -annotate +744+420 "0" \
    -font "${FONT}" -pointsize 36 \
    -fill "${MUTED}" -gravity south -annotate +0+50 "Local AI for your home. Strix Halo native." \
    -strip \
    "${OUT}"

echo "build-og: done — $(stat -c%s "${OUT}") bytes"
