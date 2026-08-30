#!/bin/bash
# Crop-pass automation (Waves 1.2 + 3.4): tile a region into a grid of readable crops
# in one call — the walk-the-drawing primitive for schedules and plan sheets.
# Usage: tiles.sh <pdf> <page> <x> <y> <w> <h> <cols> <rows> <outdir> [dpi=300] [overlap_px=60]
# Coords are RAW pre-rotation px at the render DPI (same frame as extract-crop.sh).
# Writes <outdir>/tile-rRcC.png + tiles.txt (tile → raw crop rect) so every read can be
# mapped back through the coordinate kernel (src/lib/takeoffPlacement.ts).
set -euo pipefail
PDF="$1"; PAGE="$2"; X="$3"; Y="$4"; W="$5"; H="$6"; COLS="$7"; ROWS="$8"; OUT="$9"
DPI="${10:-300}"; OV="${11:-60}"
mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"
TW=$(( (W + (COLS-1)*OV) / COLS ))
TH=$(( (H + (ROWS-1)*OV) / ROWS ))
: > "$OUT/tiles.txt"
for ((r=0; r<ROWS; r++)); do
  for ((c=0; c<COLS; c++)); do
    tx=$(( X + c*(TW-OV) )); ty=$(( Y + r*(TH-OV) ))
    f="tile-r${r}c${c}.png"
    "$HERE/extract-crop.sh" "$PDF" "$PAGE" "$tx" "$ty" "$TW" "$TH" "$OUT/$f" "$DPI" >/dev/null
    echo "$f x=$tx y=$ty w=$TW h=$TH dpi=$DPI" >> "$OUT/tiles.txt"
  done
done
echo "tiled page $PAGE into ${COLS}x${ROWS} → $OUT (tiles.txt has raw rects for the kernel)"
