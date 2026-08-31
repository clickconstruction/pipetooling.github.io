#!/usr/bin/env python3.11
"""Detect hexagon keynote callouts geometrically (merge-proof).

Validated on MPH LIVSTE 2026-08-31: 106/106 detections dead-center at
600dpi, zero false positives (chairs, room boxes, grid bubbles all
rejected).

Why geometry, not shape hashing: callout hexagons merge with leader lines
and their inner text into unique clusters, so exact-hash census misses
them. But every hexagon contributes exactly 4 short diagonal edge strokes
forming two V-corner tips (pointy top/bottom in page space), and diagonal
micro-strokes are rare in an orthogonal drawing.

Pipeline:
  1. Collect 2-point strokes with length 2.0-3.6pt and slope ratio
     0.4-0.78 (rejects 45-degree chair/table diagonals, ratio ~1.0).
  2. Pair diagonals sharing an endpoint (0.4pt tolerance) into corners.
     A corner's tip direction comes from the AVERAGE of its two edge
     vectors (each edge alone is more horizontal than vertical - per-edge
     dominance misclassifies). Mixed-side pairs at shared tips of stacked
     hexagons are rejected (dy1*dy2 > 0 required).
  3. Pair an up-tip with a down-tip 4.2-7.0pt below it, x-aligned within
     1.2pt -> one hexagon per tip pair. Stacked callout pairs touch
     tip-to-tip and still resolve to two separate hexagons.

Hex dimensions this targets: ~4.7pt wide x ~5.5pt tip-to-tip (Enfinity /
AutoCAD SHX keynote style). Tune SPAN/DIAG constants for other sets.

Usage: hex_detect.py plans.pdf 31,32,33 out.json
Output: {"<page>": [{"x":..,"y":..}, ...]} in PDF points (y up).
Read the tag text by cropping a 600dpi render at each position.
"""
import json
import math
import sys
from collections import defaultdict

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from vector_census import PdfReader, parse_paths  # noqa: E402

TIP_TOL = 0.4              # pt: endpoint coincidence tolerance
DIAG_MIN, DIAG_MAX = 2.0, 3.6   # pt: hex diagonal edge length
RATIO_MIN, RATIO_MAX = 0.4, 0.78  # slope ratio window (45deg noise ~1.0)
SPAN_MIN, SPAN_MAX = 4.2, 7.0   # pt: tip-to-tip hexagon height


def page_data(pg):
    contents = pg["/Contents"].get_object()
    if isinstance(contents, list):
        return b"".join(c.get_object().get_data() for c in contents)
    return contents.get_data()


def detect(paths):
    diags = []
    for pts, _w in paths:
        if len(pts) != 2:
            continue
        (x1, y1), (x2, y2) = pts
        dx, dy = abs(x2 - x1), abs(y2 - y1)
        if dx < 0.5 or dy < 0.5:
            continue
        length = math.hypot(dx, dy)
        ratio = min(dx, dy) / max(dx, dy)
        if DIAG_MIN <= length <= DIAG_MAX and RATIO_MIN <= ratio <= RATIO_MAX:
            diags.append(((x1, y1), (x2, y2)))

    grid = defaultdict(list)
    for i, (a, b) in enumerate(diags):
        for pi, p in enumerate((a, b)):
            grid[(int(p[0] / TIP_TOL), int(p[1] / TIP_TOL))].append((i, pi, p))

    corners, seen = [], set()
    for cell, members in grid.items():
        near = list(members)
        cx, cy = cell
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                if (ddx, ddy) != (0, 0):
                    near += grid.get((cx + ddx, cy + ddy), [])
        for i, pi, p in members:
            for j, pj, q in near:
                if j <= i:
                    continue
                if math.hypot(p[0] - q[0], p[1] - q[1]) > TIP_TOL:
                    continue
                key = (i, j)
                if key in seen:
                    continue
                seen.add(key)
                apex = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
                o1, o2 = diags[i][1 - pi], diags[j][1 - pj]
                dy1, dy2 = o1[1] - apex[1], o2[1] - apex[1]
                dx1, dx2 = o1[0] - apex[0], o2[0] - apex[0]
                ax, ay = (dx1 + dx2) / 2, (dy1 + dy2) / 2
                if abs(ay) > 1.0 and abs(ax) < 0.8 and dy1 * dy2 > 0:
                    corners.append((apex[0], apex[1], "up" if ay < 0 else "down"))

    hexes, used = [], set()
    ups = [(i, c) for i, c in enumerate(corners) if c[2] == "up"]
    downs = {j: c for j, c in enumerate(corners) if c[2] == "down"}
    for i, (x1, y1, _) in ups:
        for j, (x2, y2, _) in downs.items():
            if j in used:
                continue
            if abs(x2 - x1) < 1.2 and SPAN_MIN <= y1 - y2 <= SPAN_MAX:
                used.add(i)
                used.add(j)
                hexes.append({"x": round((x1 + x2) / 2, 2),
                              "y": round((y1 + y2) / 2, 2)})
                break
    return hexes, len(diags), len(corners)


def main():
    pdf_path, pages_arg, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    reader = PdfReader(pdf_path)
    result = {}
    for pno in (int(p) for p in pages_arg.split(",")):
        pg = reader.pages[pno - 1]
        hexes, ndiag, ncorner = detect(parse_paths(page_data(pg)))
        result[str(pno)] = hexes
        print(f"page {pno}: {ndiag} diagonals, {ncorner} corners, "
              f"{len(hexes)} hexagons", file=sys.stderr)
    with open(out_path, "w") as fh:
        json.dump(result, fh)


if __name__ == "__main__":
    main()
