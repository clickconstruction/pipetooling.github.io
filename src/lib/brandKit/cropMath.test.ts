import { describe, expect, it } from 'vitest'
import { clampCrop, dragCrop, stagePlacement, zoomCrop } from './cropMath'

const portrait = { w: 400, h: 600 }

describe('placing a photo in its ring by hand', () => {
  it('holds the middle point where the ring stays covered', () => {
    const top = clampCrop({ fx: 0.1, fy: 0, zoom: 1 }, portrait)
    expect(top.fx).toBeCloseTo(0.5, 9)
    expect(top.fy).toBeCloseTo(1 / 3, 9)
    const bottom = clampCrop({ fx: 0.9, fy: 1, zoom: 1 }, portrait)
    expect(bottom.fx).toBeCloseTo(0.5, 9)
    expect(bottom.fy).toBeCloseTo(2 / 3, 9)
  })
  it('holds the zoom between 1 and 3', () => {
    expect(clampCrop({ fx: 0.5, fy: 0.5, zoom: 0.2 }, portrait).zoom).toBe(1)
    expect(clampCrop({ fx: 0.5, fy: 0.5, zoom: 9 }, portrait).zoom).toBe(3)
  })
  it('moves the picture with the finger', () => {
    const start = { fx: 0.5, fy: 0.5, zoom: 2 }
    const after = dragCrop(start, 60, 0, portrait, 240)
    expect(after.fx).toBeCloseTo(0.5 - (60 / 240) * 0.5, 6)
    expect(after.fy).toBe(0.5)
  })
  it('stops at the picture’s edge instead of leaving a gap', () => {
    const after = dragCrop({ fx: 0.5, fy: 0.5, zoom: 1 }, 0, 5000, portrait, 240)
    expect(after.fy).toBeCloseTo(1 / 3, 6)
    const at = stagePlacement(after, portrait, 240)
    expect(at.y).toBeCloseTo(0, 6)
    expect(at.y + at.h).toBeGreaterThanOrEqual(240)
  })
  it('keeps the same point in the middle when the zoom changes', () => {
    const z = zoomCrop({ fx: 0.4, fy: 0.45, zoom: 2 }, 3, portrait)
    expect(z).toEqual({ fx: 0.4, fy: 0.45, zoom: 3 })
  })
  it('pulls the middle point back in when zooming out would leave a gap', () => {
    const z = zoomCrop({ fx: 0.2, fy: 0.2, zoom: 3 }, 1, portrait)
    expect(z.fx).toBeCloseTo(0.5, 9)
    expect(z.fy).toBeCloseTo(1 / 3, 9)
    expect(z.zoom).toBe(1)
  })
  it('covers the stage at every crop', () => {
    for (const crop of [{ fx: 0, fy: 0, zoom: 1 }, { fx: 1, fy: 1, zoom: 2.5 }, { fx: 0.5, fy: 0.4, zoom: 1.7 }]) {
      const at = stagePlacement(crop, portrait, 240)
      expect(at.x).toBeLessThanOrEqual(1e-9)
      expect(at.y).toBeLessThanOrEqual(1e-9)
      expect(at.x + at.w).toBeGreaterThanOrEqual(240 - 1e-9)
      expect(at.y + at.h).toBeGreaterThanOrEqual(240 - 1e-9)
    }
  })
})
