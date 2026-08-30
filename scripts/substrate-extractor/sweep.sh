#!/bin/bash
# Substrate extractor automation (Wave 1.2): overview EVERY page in one call.
# Usage: sweep.sh <pdf> <outdir> [dpi=40] [first] [last]
# Writes <outdir>/ov-NNN.png per page + manifest.txt (page → file), so the structure
# pass (EXTRACTOR.md Pass 1) starts from a complete contact set instead of one-offs.
set -euo pipefail
PDF="$1"; OUT="$2"; DPI="${3:-40}"
PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/ {print $2}')
FIRST="${4:-1}"; LAST="${5:-$PAGES}"
mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"
: > "$OUT/manifest.txt"
for ((p=FIRST; p<=LAST; p++)); do
  n=$(printf '%03d' "$p")
  "$HERE/overview.sh" "$PDF" "$p" "$OUT/ov-$n.png" "$DPI" >/dev/null
  echo "$p ov-$n.png" >> "$OUT/manifest.txt"
done
echo "swept pages $FIRST..$LAST → $OUT (manifest.txt lists page → file)"
