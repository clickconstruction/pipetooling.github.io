import { describe, expect, it } from 'vitest'
import { makeTouching, maskFromRgba, maskSolid, spriteLocalPoint } from './easterEggSilhouette'

/** A 10×20 sprite whose body is the middle 4 columns (x 3–6), full height. */
function pillarMask() {
  const w = 10
  const h = 20
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 3; x <= 6; x++) rgba[(y * w + x) * 4 + 3] = 255
  return { w, h, mask: maskFromRgba(rgba, w, h) }
}

describe('maskFromRgba / maskSolid', () => {
  it('reads alpha into a 1-bit body and ignores the soft shadow edge', () => {
    const { w, h, mask } = pillarMask()
    expect(maskSolid(mask, 4, 10, w, h)).toBe(true)
    expect(maskSolid(mask, 1, 10, w, h)).toBe(false)
    expect(maskSolid(mask, 4, 25, w, h)).toBe(false) // outside the box
    const faint = new Uint8Array(4)
    faint[3] = 30
    expect(maskSolid(maskFromRgba(faint, 1, 1), 0, 0, 1, 1)).toBe(false)
  })

  it('falls back to an ellipse about his size when no mask loaded', () => {
    expect(maskSolid(null, 55, 65, 110, 130)).toBe(true) // centre
    expect(maskSolid(null, 2, 2, 110, 130)).toBe(false) // corner of the box
  })
})

describe('spriteLocalPoint', () => {
  const f = { x: 500, y: 400, spin: 0 }
  it('maps the sprite centre to the box centre and offsets straight through at zero spin', () => {
    expect(spriteLocalPoint(500, 400, f, 1, 1, 110, 130)).toEqual([55, 65])
    expect(spriteLocalPoint(530, 410, f, 1, 1, 110, 130)).toEqual([85, 75])
  })

  it('mirrors x when facing left', () => {
    expect(spriteLocalPoint(530, 410, f, -1, 1, 110, 130)).toEqual([25, 75])
  })

  it('undoes a 90° clockwise spin', () => {
    // A world point 30px to the right of a sprite spun 90° cw sits 30px ABOVE the centre in sprite space.
    const [lx, ly] = spriteLocalPoint(530, 400, { ...f, spin: 90 }, 1, 1, 110, 130)
    expect(lx).toBeCloseTo(55)
    expect(ly).toBeCloseTo(35)
  })

  it('undoes scale', () => {
    expect(spriteLocalPoint(530, 400, f, 1, 0.5, 110, 130)).toEqual([115, 65])
  })
})

describe('makeTouching', () => {
  it('uses the real silhouette, rotated with the sprite, with a little dilation', () => {
    const { w, h, mask } = pillarMask()
    const touching = makeTouching(mask, w, h, () => 1, () => 1)
    const f = { x: 100, y: 100, vx: 0, vy: 0, spin: 0, prevY: 100, scored: false, t: 0 }
    expect(touching(100, 100, f)).toBe(true) // centre of the pillar
    expect(touching(104, 100, f)).toBe(true) // 4 right: body ends at +1.5, the 3px dilation reaches it
    expect(touching(108, 100, f)).toBe(false) // clear of the pillar
    // Spin 90°: the pillar now lies flat, so a point 8px to the right is inside it and 8px below is not.
    const spun = { ...f, spin: 90 }
    expect(touching(108, 100, spun)).toBe(true)
    expect(touching(100, 108, spun)).toBe(false)
  })
})
