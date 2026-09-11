/**
 * Floaty's real edge (v2.3282). The ring game collides the ring's two end
 * points against the sprite's actual silhouette — an alpha mask sampled at
 * its on-screen size — rotated and mirrored the way the sprite is drawn.
 * `loadSpriteMask` is the one IO call (canvas); everything else is pure.
 */

import type { Flight } from './easterEggRing'

export type SpriteMask = { w: number; h: number; solid: Uint8Array }

/** Alpha above this counts as body; the sprite has a soft drop-shadow edge to ignore. */
const ALPHA_SOLID = 60

/** The sample offsets that give the ring point a little thickness. */
const DILATION: ReadonlyArray<readonly [number, number]> = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]

/**
 * World point → sprite-local pixel for the flight transform
 * `translate(centre) rotate(spin) scaleX(facing) scale(scale)` about the box centre.
 */
export function spriteLocalPoint(px: number, py: number, f: Pick<Flight, 'x' | 'y' | 'spin'>, facing: 1 | -1, scale: number, w: number, h: number): [number, number] {
  const dx = px - f.x
  const dy = py - f.y
  const r = (-f.spin * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [w / 2 + (dx * c - dy * s) / (facing * scale), h / 2 + (dx * s + dy * c) / scale]
}

/** Is this sprite-local pixel body? Without a mask, an ellipse about his size stands in. */
export function maskSolid(mask: SpriteMask | null, lx: number, ly: number, w: number, h: number): boolean {
  if (!mask) return ((lx - w / 2) / (w * 0.45)) ** 2 + ((ly - h / 2) / (h * 0.46)) ** 2 <= 1
  const x = Math.round(lx)
  const y = Math.round(ly)
  if (x < 0 || y < 0 || x >= mask.w || y >= mask.h) return false
  return mask.solid[y * mask.w + x] === 1
}

/** The `touching` callback `stepFlight` wants: does the world point sit inside his outline? */
export function makeTouching(mask: SpriteMask | null, w: number, h: number, facing: (f: Flight) => 1 | -1, scale: (f: Flight) => number) {
  return (px: number, py: number, f: Flight): boolean => {
    const fc = facing(f)
    const sc = scale(f)
    for (const [ox, oy] of DILATION) {
      const [lx, ly] = spriteLocalPoint(px + ox, py + oy, f, fc, sc, w, h)
      if (maskSolid(mask, lx, ly, w, h)) return true
    }
    return false
  }
}

/** Build a mask from raw RGBA pixels (what a canvas returns) — pure, so it's testable. */
export function maskFromRgba(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): SpriteMask {
  const solid = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) solid[i] = (rgba[i * 4 + 3] ?? 0) > ALPHA_SOLID ? 1 : 0
  return { w, h, solid }
}

/** IO: draw the sprite at w×h on a canvas and read its alpha. Resolves null when anything is missing (no canvas, tainted image). */
export function loadSpriteMask(src: string, w: number, h: number): Promise<SpriteMask | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const g = canvas.getContext('2d')
          if (!g) return resolve(null)
          g.drawImage(img, 0, 0, w, h)
          resolve(maskFromRgba(g.getImageData(0, 0, w, h).data, w, h))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = src
    } catch {
      resolve(null)
    }
  })
}
