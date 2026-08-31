#!/usr/bin/env python3.11
"""T2 path-census: traced pipe footage from vector plan sets.

Validated mechanics (TSAOG core/shell set, 2026-08-31): pen inventory,
chaining, and symbol/margin filters produce per-run footage that matches
the drawn runs on visual overlay for four decoded pens (sanitary, CW
water, fire, storm/RD). The reference-ratio gate (0.85-1.1 vs a human
takeoff) is still pending a scope-matched reference — the first TSAOG
attempt exposed a scope mismatch instead (the fetched set was core/shell;
the human priced the tenant fit-out), which is its own protocol lesson:
line-compare reference tags against the fetched set at unseal.

Workflow:
  1. `inventory` — bucket every stroked path by (gray, width); print
     footage per bucket. CAD pens are consistent per discipline, so pipe
     systems separate cleanly by pen.
  2. Overlay one sheet (render at 72dpi so 1px = 1pt, paint a bucket,
     look) to decide which pen is which system. One look per set.
  3. `chains` — union-find the chosen bucket's strokes on endpoint
     proximity, then drop non-pipe chains: symbol-sized clusters
     (keynote hexagons ~11ft of ink each), margin/title-block chains,
     and page-border strokes.
  4. Footage = sum of surviving chain lengths / pt-per-ft.

Scale: calibrate from grid-label text spacing (pdftotext -bbox positions
of consecutive grid bubbles vs the stated bay size), or 12*72/scale_denom
for a stated scale on a full-size sheet (1/8" = 1'-0" on 30x42 -> 9
pt/ft). Half-size prints halve it — always confirm against a known bay.

Usage:
  path_census.py inventory plans.pdf 84 [ptperft]
  path_census.py chains plans.pdf 84 <gray> <width> [ptperft] [minrunft]
"""
import math
import re
import sys
from collections import defaultdict

from pypdf import PdfReader

NUM = b"-+.0123456789"
TOKEN_RE = re.compile(rb"[-+]?\d*\.?\d+|/[^\s/\[\]()<>{}%]+|[A-Za-z'\"*]+")

SYMBOL_BOX = 25.0   # pt: chains whose bbox fits in this square are symbols
MARGIN_FRAC = 0.93  # chains living entirely past this fraction of the
                    # long axis sit in the notes/title margin


def mat_mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a*A + b*C, a*B + b*D, c*A + d*C, c*B + d*D,
            e*A + f*C + E, e*B + f*D + F)


def tx(ctm, x, y):
    a, b, c, d, e, f = ctm
    return (a*x + c*y + e, b*x + d*y + f)


def parse(data):
    """Stroked paths with graphics state: [(points, width, gray)]."""
    ctm = (1, 0, 0, 1, 0, 0)
    stack = []
    width = 1.0
    gray = 0.0
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
                stack.append((ctm, width, gray))
            elif op == b"Q":
                if stack:
                    ctm, width, gray = stack.pop()
            elif op == b"cm" and len(pend) >= 6:
                ctm = mat_mul(tuple(float(x) for x in pend[-6:]), ctm)
            elif op == b"w" and pend:
                width = float(pend[-1])
            elif op == b"G" and pend:
                gray = float(pend[-1])
            elif op == b"RG" and len(pend) >= 3:
                r, g, b = (float(x) for x in pend[-3:])
                gray = round(0.299*r + 0.587*g + 0.114*b, 3)
            elif op == b"K" and len(pend) >= 4:
                c, m, y, k = (float(x) for x in pend[-4:])
                gray = round(1 - min(1, k + 0.3*(c + m + y)), 3)
            elif op in (b"m", b"l") and len(pend) >= 2:
                pts.append(tx(ctm, float(pend[-2]), float(pend[-1])))
            elif op == b"c" and len(pend) >= 6:
                n = [float(x) for x in pend[-6:]]
                pts.append(tx(ctm, n[4], n[5]))
            elif op == b"re" and len(pend) >= 4:
                x, y, w, h = (float(v) for v in pend[-4:])
                pts.extend([tx(ctm, x, y), tx(ctm, x+w, y),
                            tx(ctm, x+w, y+h), tx(ctm, x, y+h), tx(ctm, x, y)])
            elif op in (b"S", b"s"):
                if len(pts) >= 2:
                    paths.append((pts, width, gray))
                pts = []
            elif op in (b"f", b"F", b"B", b"b", b"n"):
                pts = []
        except ValueError:
            pass
        pend.clear()
    return paths


def page_data(pg):
    contents = pg["/Contents"].get_object()
    if isinstance(contents, list):
        return b"".join(c.get_object().get_data() for c in contents)
    return contents.get_data()


def polylen(pts):
    return sum(math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1])
               for i in range(len(pts)-1))


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


def chain(strokes, tol=3.0):
    """Union-find strokes whose endpoints come within tol pt."""
    dsu = DSU(len(strokes))
    grid = defaultdict(list)
    for i, (pts, _L) in enumerate(strokes):
        for p in (pts[0], pts[-1]):
            grid[(int(p[0]/tol), int(p[1]/tol))].append((i, p))
    for (cx, cy), members in grid.items():
        near = list(members)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (dx, dy) != (0, 0):
                    near += grid.get((cx+dx, cy+dy), [])
        for i, p in members:
            for j, q in near:
                if j != i and math.hypot(p[0]-q[0], p[1]-q[1]) <= tol:
                    dsu.union(i, j)
    comps = defaultdict(list)
    for i in range(len(strokes)):
        comps[dsu.find(i)].append(i)
    return list(comps.values())


def run_chains(paths, gray, width, page_w, page_h, ptperft, min_run_ft):
    sel = [(pts, polylen(pts)) for pts, w, g in paths
           if round(g, 2) == gray and round(w, 2) == width]
    runs = []
    for members in chain(sel):
        L = sum(sel[i][1] for i in members)
        allpts = [p for i in members for p in sel[i][0]]
        xs = [p[0] for p in allpts]
        ys = [p[1] for p in allpts]
        bw, bh = max(xs)-min(xs), max(ys)-min(ys)
        if bw <= SYMBOL_BOX and bh <= SYMBOL_BOX:
            continue  # keynote hex / symbol
        long_axis = max(page_w, page_h)
        lo = min(ys) if page_h >= page_w else min(xs)
        if lo > MARGIN_FRAC * long_axis:
            continue  # notes / title-block margin
        if (bw < 2 and bh >= page_h * 0.9) or (bh < 2 and bw >= page_w * 0.9):
            continue  # page border
        ft = L / ptperft
        if ft >= min_run_ft:
            runs.append((ft, len(members),
                         (min(xs), min(ys), max(xs), max(ys))))
    runs.sort(reverse=True)
    return runs


def main():
    mode, pdf, pno = sys.argv[1], sys.argv[2], int(sys.argv[3])
    r = PdfReader(pdf)
    pg = r.pages[pno-1]
    paths = parse(page_data(pg))
    mb = pg.mediabox
    if mode == "inventory":
        ptperft = float(sys.argv[4]) if len(sys.argv) > 4 else 9.0
        buckets = defaultdict(lambda: [0, 0.0])
        for pts, w, g in paths:
            b = buckets[(round(g, 2), round(w, 2))]
            b[0] += 1
            b[1] += polylen(pts)
        print(f"{'gray':>5} {'width':>6} {'n':>6} {'total_ft':>9}")
        for (g, w), (n, tot) in sorted(buckets.items(),
                                       key=lambda kv: -kv[1][1])[:24]:
            print(f"{g:5.2f} {w:6.2f} {n:6d} {tot/ptperft:9.1f}")
    elif mode == "chains":
        gray, width = float(sys.argv[4]), float(sys.argv[5])
        ptperft = float(sys.argv[6]) if len(sys.argv) > 6 else 9.0
        min_run = float(sys.argv[7]) if len(sys.argv) > 7 else 5.0
        runs = run_chains(paths, gray, width, float(mb.width),
                          float(mb.height), ptperft, min_run)
        tot = sum(ft for ft, _n, _bb in runs)
        for ft, n, bb in runs:
            print(f"  {ft:8.1f} ft  strokes={n:4d}  "
                  f"bbox=({bb[0]:.0f},{bb[1]:.0f})-({bb[2]:.0f},{bb[3]:.0f})")
        print(f"page {pno} pen(gray={gray},w={width}): "
              f"{len(runs)} runs, {tot:.1f} ft")


if __name__ == "__main__":
    main()
