#!/bin/bash
# Placement engine primitive: page dimensions in PDF points + px at a DPI.
# Usage: pagesize.sh <pdf> <page> [dpi=600]
set -euo pipefail
PDF="$1"; PAGE="$2"; DPI="${3:-600}"
SIZE=$(pdfinfo -f "$PAGE" -l "$PAGE" "$PDF" | awk '/Page +[0-9]+ size:/ {print $4, $6}')
W_PT=$(echo "$SIZE" | cut -d' ' -f1); H_PT=$(echo "$SIZE" | cut -d' ' -f2)
W_PX=$(python3 -c "print(round($W_PT * $DPI / 72))")
H_PX=$(python3 -c "print(round($H_PT * $DPI / 72))")
echo "page $PAGE: ${W_PT}x${H_PT} pt · ${W_PX}x${H_PX} px @${DPI}dpi (base frame = points; px→pt divide by $(python3 -c "print($DPI/72)"))"
