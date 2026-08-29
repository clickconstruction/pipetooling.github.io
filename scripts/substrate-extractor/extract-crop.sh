#!/bin/bash
# Substrate extractor crop-pass primitive (proven on LIVSTE 2026-08-28; see docs/twins/SUBSTRATE.md)
# Usage: extract-crop.sh <pdf> <page> <x> <y> <w> <h> <out.png> [dpi]
# Coords are PIXELS at the render DPI on the RAW (pre-rotation) page; output is rotated 90 CW for reading.
set -euo pipefail
PDF="$1"; PAGE="$2"; X="$3"; Y="$4"; W="$5"; H="$6"; OUT="$7"; DPI="${8:-600}"
TMP=$(mktemp -d)
pdftoppm -png -r "$DPI" -f "$PAGE" -l "$PAGE" -x "$X" -y "$Y" -W "$W" -H "$H" "$PDF" "$TMP/crop"
sips -r 90 "$TMP"/crop-*.png --out "$OUT" >/dev/null
rm -rf "$TMP"; echo "wrote $OUT"
