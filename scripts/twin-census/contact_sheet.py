#!/usr/bin/env python3.11
"""Render a labeled contact sheet of census shapes for one-shot classification.

Usage: contact_sheet.py census.json out.png [--min-count N] [--min-strokes N]
       [--min-size PT] [--max-size PT] [--limit N] [--start N]
Shapes sorted by count desc; each cell shows the shape scaled up, its short
hash, count, and true size in points.
"""
import json
import sys

from PIL import Image, ImageDraw

CELL = 110
PAD = 8
COLS = 10


def main():
    census_path, out_path = sys.argv[1], sys.argv[2]
    opts = dict(zip(sys.argv[3::2], sys.argv[4::2]))
    min_count = int(opts.get("--min-count", 1))
    min_strokes = int(opts.get("--min-strokes", 1))
    min_size = float(opts.get("--min-size", 0))
    max_size = float(opts.get("--max-size", 1e9))
    limit = int(opts.get("--limit", 100))
    start = int(opts.get("--start", 0))

    d = json.load(open(census_path))
    shapes = [
        (h, s) for h, s in d["shapes"].items()
        if s["count"] >= min_count and s["strokes"] >= min_strokes
        and min_size <= max(s["w"], s["h"]) <= max_size
    ]
    shapes.sort(key=lambda kv: -kv[1]["count"])
    shapes = shapes[start:start + limit]
    if not shapes:
        print("no shapes match filters")
        return

    rows = (len(shapes) + COLS - 1) // COLS
    img = Image.new("RGB", (COLS * CELL, rows * CELL), "white")
    draw = ImageDraw.Draw(img)
    for i, (h, s) in enumerate(shapes):
        cx = (i % COLS) * CELL
        cy = (i // COLS) * CELL
        draw.rectangle([cx, cy, cx + CELL - 1, cy + CELL - 1],
                       outline="#cccccc")
        w = max(s["w"], 0.01)
        ht = max(s["h"], 0.01)
        avail = CELL - 2 * PAD - 24
        scale = min(avail / w, avail / ht)
        ox = cx + (CELL - w * scale) / 2
        oy = cy + PAD + (avail - ht * scale) / 2
        for pts in s["geom"]:
            xy = [(ox + x * scale, oy + (ht - y) * scale) for x, y in pts]
            if len(xy) == 1:
                draw.ellipse([xy[0][0]-1, xy[0][1]-1, xy[0][0]+1, xy[0][1]+1],
                             fill="black")
            else:
                draw.line(xy, fill="black", width=2)
        label = f"{i + start}|x{s['count']}|{max(s['w'], s['h']):.1f}pt"
        draw.text((cx + 4, cy + CELL - 16), label, fill="#3355bb")
    img.save(out_path)
    print(f"{len(shapes)} shapes -> {out_path} "
          f"({img.width}x{img.height}); index range {start}-{start+len(shapes)-1}")


if __name__ == "__main__":
    main()
