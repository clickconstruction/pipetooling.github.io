#!/bin/bash
# Substrate extractor structure-pass primitive (docs/twins/EXTRACTOR.md).
# Renders a low-DPI rotated overview of one page for region location.
# Usage: overview.sh <pdf> <page> <out.png> [dpi=40]
set -euo pipefail
PDF="$1"; PAGE="$2"; OUT="$3"; DPI="${4:-40}"
TMP=$(mktemp -d)
pdftoppm -png -r "$DPI" -f "$PAGE" -l "$PAGE" "$PDF" "$TMP/ov"
sips -r 90 "$TMP"/ov-*.png --out "$OUT" >/dev/null
rm -rf "$TMP"; echo "wrote $OUT (overview @${DPI}dpi, rotated 90cw)"
