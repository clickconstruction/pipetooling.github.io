#!/usr/bin/env python3.11
"""T3 template-match counter (Class C raster sets) — pure numpy NCC.

Usage:
  template_match.py harvest page.png cx cy half out-template.png
  template_match.py match page.png template.png threshold out-prefix
     -> prints peaks (x, y, score), writes circled verification image
"""
import sys

import numpy as np
from PIL import Image, ImageDraw


def load_gray(path, scale=1.0):
    img = Image.open(path).convert("L")
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)),
                         Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255.0
    return 1.0 - a  # ink = high


def ncc_map(page, tmpl):
    """Normalized cross-correlation via FFT (zero-mean template)."""
    th, tw = tmpl.shape
    t = tmpl - tmpl.mean()
    tnorm = np.sqrt((t * t).sum())
    ph, pw = page.shape
    fh, fw = ph + th, pw + tw
    Fp = np.fft.rfft2(page, s=(fh, fw))
    Ft = np.fft.rfft2(t[::-1, ::-1], s=(fh, fw))
    corr = np.fft.irfft2(Fp * Ft, s=(fh, fw))[th-1:th-1+ph-th+1, tw-1:tw-1+pw-tw+1]
    # local page energy via integral images
    ones = np.ones_like(t)
    Fo = np.fft.rfft2(ones[::-1, ::-1], s=(fh, fw))
    Fp2 = np.fft.rfft2(page * page, s=(fh, fw))
    s1 = np.fft.irfft2(Fp * Fo, s=(fh, fw))[th-1:th-1+ph-th+1, tw-1:tw-1+pw-tw+1]
    s2 = np.fft.irfft2(Fp2 * Fo, s=(fh, fw))[th-1:th-1+ph-th+1, tw-1:tw-1+pw-tw+1]
    n = th * tw
    var = np.maximum(s2 - s1 * s1 / n, 1e-6)
    return corr / (np.sqrt(var) * tnorm + 1e-9)


def nms(score, threshold, radius):
    peaks = []
    s = score.copy()
    while True:
        idx = np.unravel_index(np.argmax(s), s.shape)
        v = s[idx]
        if v < threshold or len(peaks) > 500:
            break
        peaks.append((int(idx[1]), int(idx[0]), float(v)))
        y0, y1 = max(0, idx[0]-radius), idx[0]+radius
        x0, x1 = max(0, idx[1]-radius), idx[1]+radius
        s[y0:y1, x0:x1] = -1
    return peaks


def main():
    mode = sys.argv[1]
    if mode == "harvest":
        page_path, cx, cy, half, out = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
        img = Image.open(page_path)
        img.crop((cx-half, cy-half, cx+half, cy+half)).save(out)
        print("template saved", out)
        return
    if mode == "match":
        page_path, tmpl_path, threshold, prefix = sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
        SCALE = 0.5  # work at half res for speed
        page = load_gray(page_path, SCALE)
        tmpl = load_gray(tmpl_path, SCALE)
        score = ncc_map(page, tmpl)
        th, tw = tmpl.shape
        peaks = nms(score, threshold, max(th, tw) // 2)
        print(f"{len(peaks)} peaks >= {threshold}")
        img = Image.open(page_path).convert("RGB")
        d = ImageDraw.Draw(img)
        inv = 1.0 / SCALE
        r = max(th, tw) * inv * 0.75
        for i, (x, y, v) in enumerate(peaks):
            # peak (x,y) is the top-left of template in scaled coords
            cx = (x + tw / 2) * inv
            cy = (y + th / 2) * inv
            d.ellipse([cx-r, cy-r, cx+r, cy+r], outline="#dd2222", width=8)
            d.text((cx - r, cy - r - 40), f"{i}:{v:.2f}", fill="#dd2222")
            print(f"  {i}: ({cx:.0f},{cy:.0f}) score={v:.3f}")
        img.thumbnail((1900, 1900))
        img.save(prefix + "-verify.png")
        print("verify image:", prefix + "-verify.png")


if __name__ == "__main__":
    main()
