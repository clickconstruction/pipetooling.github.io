#!/usr/bin/env python3.11
"""T1 vector-cluster census (Class B sets: no text layer, SHX stroke soup).

Pipeline per page:
  1. Interpret the content stream (q/Q/cm + m/l/c/re + paint ops), applying
     the CTM so every stroke lands in page space. Capture width per path.
  2. Split: long strokes (linework: pipes, walls, leaders) vs short strokes
     (glyph/symbol soup).
  3. Union-find short strokes into connected components (grid-bucketed,
     endpoint gap threshold).
  4. Component identity = md5 of its stroke set normalized to the component
     origin and quantized — the same SHX character/symbol hashes identically
     everywhere it appears.
  5. Emit JSON: shapes {hash: count, bbox, sample}, placements per page.

Usage: vector_census.py plans.pdf 31,32,33 out.json
"""
import hashlib
import json
import math
import re
import sys
from collections import defaultdict

from pypdf import PdfReader

NUM = b"-+.0123456789"
TOKEN_RE = re.compile(rb"[-+]?\d*\.?\d+|/[^\s/\[\]()<>{}%]+|[A-Za-z'\"*]+")

GAP = 0.25         # pt: strokes closer than this cluster together
LONG_SEG = 14.0    # pt: single segments longer than this are linework
QUANT = 0.15       # pt: geometry quantization for shape hashing


def mat_mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a*A + b*C, a*B + b*D, c*A + d*C, c*B + d*D,
            e*A + f*C + E, e*B + f*D + F)


def tx(ctm, x, y):
    a, b, c, d, e, f = ctm
    return (a*x + c*y + e, b*x + d*y + f)


def parse_paths(data):
    """Yield (points, width) per painted path; points = [(x,y), ...] with
    curve control points flattened in (good enough for hashing/rendering)."""
    ctm = (1, 0, 0, 1, 0, 0)
    stack = []
    width = 1.0
    pend = []
    pts = []
    paths = []
    for t in TOKEN_RE.findall(data):
        if t[:1] in NUM:
            pend.append(t)
            continue
        op = t
        try:
            if op == b"q":
                stack.append((ctm, width))
            elif op == b"Q":
                if stack:
                    ctm, width = stack.pop()
            elif op == b"cm" and len(pend) >= 6:
                ctm = mat_mul(tuple(float(x) for x in pend[-6:]), ctm)
            elif op == b"w" and pend:
                width = float(pend[-1])
            elif op in (b"m", b"l") and len(pend) >= 2:
                pts.append(tx(ctm, float(pend[-2]), float(pend[-1])))
            elif op == b"c" and len(pend) >= 6:
                n = [float(x) for x in pend[-6:]]
                pts.append(tx(ctm, n[0], n[1]))
                pts.append(tx(ctm, n[2], n[3]))
                pts.append(tx(ctm, n[4], n[5]))
            elif op == b"v" and len(pend) >= 4:
                n = [float(x) for x in pend[-4:]]
                pts.append(tx(ctm, n[0], n[1]))
                pts.append(tx(ctm, n[2], n[3]))
            elif op == b"re" and len(pend) >= 4:
                x, y, w, h = (float(v) for v in pend[-4:])
                pts.extend([tx(ctm, x, y), tx(ctm, x+w, y),
                            tx(ctm, x+w, y+h), tx(ctm, x, y+h), tx(ctm, x, y)])
            elif op in (b"S", b"s", b"f", b"F", b"B", b"b", b"n"):
                if len(pts) >= 2 and op != b"n":
                    paths.append((pts, width))
                pts = []
        except ValueError:
            pass
        pend.clear()
    return paths


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


class DSU:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, i):
        while self.p[i] != i:
            self.p[i] = self.p[self.p[i]]
            i = self.p[i]
        return i

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


def cluster(short_paths):
    """Union-find on a point grid: paths sharing a GAP-cell neighborhood merge."""
    dsu = DSU(len(short_paths))
    grid = defaultdict(list)
    cell = GAP
    for i, (pts, _w) in enumerate(short_paths):
        for x, y in pts:
            grid[(int(x / cell), int(y / cell))].append(i)
    for (cx, cy), members in grid.items():
        first = members[0]
        for m in members[1:]:
            dsu.union(first, m)
        for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
            other = grid.get((cx + dx, cy + dy))
            if other:
                dsu.union(first, other[0])
    comps = defaultdict(list)
    for i in range(len(short_paths)):
        comps[dsu.find(i)].append(i)
    return list(comps.values())


def shape_hash(paths_pts):
    """Normalize a component's strokes to its bbox origin, quantize, hash."""
    allpts = [p for pts in paths_pts for p in pts]
    x0, y0, _, _ = bbox(allpts)
    strokes = sorted(
        tuple((round((x - x0) / QUANT), round((y - y0) / QUANT))
              for x, y in pts)
        for pts in paths_pts)
    return hashlib.md5(repr(strokes).encode()).hexdigest()[:12]


def census_page(pg):
    contents = pg["/Contents"].get_object()
    if isinstance(contents, list):
        data = b"".join(c.get_object().get_data() for c in contents)
    else:
        data = contents.get_data()
    paths = parse_paths(data)
    short, linework = [], []
    for pts, w in paths:
        x0, y0, x1, y1 = bbox(pts)
        if max(x1 - x0, y1 - y0) > LONG_SEG and len(pts) <= 3:
            linework.append((pts, w))
        else:
            short.append((pts, w))
    comps = cluster(short)
    out = []
    for members in comps:
        pts_sets = [short[i][0] for i in members]
        allpts = [p for pts in pts_sets for p in pts]
        x0, y0, x1, y1 = bbox(allpts)
        geom = [[(round(x - x0, 2), round(y - y0, 2)) for x, y in pts]
                for pts in pts_sets]
        out.append({
            "hash": shape_hash(pts_sets),
            "x": round((x0 + x1) / 2, 2), "y": round((y0 + y1) / 2, 2),
            "w": round(x1 - x0, 2), "h": round(y1 - y0, 2),
            "strokes": len(members),
            "geom": geom,
        })
    return out, len(paths), len(linework)


def main():
    pdf_path, pages_arg, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    reader = PdfReader(pdf_path)
    result = {"pages": {}, "shapes": {}}
    for pno in (int(p) for p in pages_arg.split(",")):
        comps, npaths, nline = census_page(reader.pages[pno - 1])
        result["pages"][str(pno)] = comps
        for c in comps:
            s = result["shapes"].setdefault(c["hash"], {
                "count": 0, "w": c["w"], "h": c["h"],
                "strokes": c["strokes"],
                "sample": {"page": pno, "x": c["x"], "y": c["y"]},
                "geom": c["geom"]})
            s["count"] += 1
            del c["geom"]
        print(f"page {pno}: {npaths} paths, {nline} linework, "
              f"{len(comps)} components", file=sys.stderr)
    print(f"distinct shapes: {len(result['shapes'])}", file=sys.stderr)
    with open(out_path, "w") as fh:
        json.dump(result, fh)


if __name__ == "__main__":
    main()
