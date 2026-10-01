/**
 * Trimming a drawn signature to its ink (v2.4335). The pad hands over its whole canvas — white
 * paper with the strokes somewhere in it — so a signature drawn in one corner printed small and
 * off to the side (job 650's waiver, Oct 1: the strokes filled the left half of a 400×160 box,
 * and the PDF placed the whole box). Cropping to the ink lets every page size the signature the
 * same way, sitting on the line.
 *
 * `inkBounds` is pure (tested on hand-made pixels); `trimSignatureInk` needs a browser canvas
 * and hands the picture back unchanged wherever it cannot run (tests, a decode error, a blank pad).
 */

export type InkBox = { left: number; top: number; right: number; bottom: number }

/**
 * The smallest box holding every ink pixel of RGBA data, or null when the paper is blank. A
 * pixel is ink when it is not transparent and not near-white (any channel under `threshold`).
 */
export function inkBounds(data: ArrayLike<number>, width: number, height: number, threshold = 235): InkBox | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3] ?? 0
      if (a < 16) continue
      const r = data[i] ?? 255
      const g = data[i + 1] ?? 255
      const b = data[i + 2] ?? 255
      if (r >= threshold && g >= threshold && b >= threshold) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  return right < 0 ? null : { left, top, right, bottom }
}

/** The box grown by `pad` pixels on each side, kept inside the picture. */
export function padInkBox(box: InkBox, width: number, height: number, pad: number): InkBox {
  return {
    left: Math.max(0, box.left - pad),
    top: Math.max(0, box.top - pad),
    right: Math.min(width - 1, box.right + pad),
    bottom: Math.min(height - 1, box.bottom + pad),
  }
}

/**
 * The drawn signature cropped to its ink plus a small margin, as a PNG data URL. Returns the
 * input as it was when there is no canvas to work with, the picture will not decode, or the pad
 * is blank — never worse than before.
 */
export async function trimSignatureInk(dataUrl: string, pad = 10): Promise<string> {
  try {
    if (typeof document === 'undefined' || !/^data:image\/png;base64,/i.test(dataUrl)) return dataUrl
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) return dataUrl
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0)
    const box = inkBounds(ctx.getImageData(0, 0, w, h).data, w, h)
    if (!box) return dataUrl
    const b = padInkBox(box, w, h, pad)
    const cw = b.right - b.left + 1
    const ch = b.bottom - b.top + 1
    if (cw >= w && ch >= h) return dataUrl
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    const octx = out.getContext('2d')
    if (!octx) return dataUrl
    // White paper behind the ink, like the pad's own canvas, so every viewer shows dark on white.
    octx.fillStyle = 'rgb(255, 255, 255)'
    octx.fillRect(0, 0, cw, ch)
    octx.drawImage(canvas, b.left, b.top, cw, ch, 0, 0, cw, ch)
    return out.toDataURL('image/png')
  } catch {
    return dataUrl
  }
}
