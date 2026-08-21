import { describe, expect, it } from 'vitest'
import { placeTourCard, spotlightHole } from './spotlightTourPlacement'

const viewport = { width: 1000, height: 700 }
const card = { width: 400, height: 150 }

describe('placeTourCard', () => {
  it('prefers below the anchor, centered', () => {
    const p = placeTourCard({ top: 100, left: 300, width: 400, height: 80 }, viewport, card)
    expect(p.side).toBe('below')
    expect(p.top).toBe(192) // 100 + 80 + 12
    expect(p.left).toBe(300) // centered: 300 + 200 - 200
  })

  it('flips above when there is no room below', () => {
    const p = placeTourCard({ top: 500, left: 300, width: 400, height: 150 }, viewport, card)
    expect(p.side).toBe('above')
    expect(p.top).toBe(338) // 500 - 12 - 150
  })

  it('pins to the bottom edge when it fits on neither side', () => {
    const p = placeTourCard({ top: 40, left: 0, width: 1000, height: 620 }, viewport, card)
    expect(p.top).toBe(700 - 150 - 8)
  })

  it('clamps horizontally to the viewport edges', () => {
    const leftEdge = placeTourCard({ top: 100, left: 0, width: 100, height: 50 }, viewport, card)
    expect(leftEdge.left).toBe(8)
    const rightEdge = placeTourCard({ top: 100, left: 950, width: 40, height: 50 }, viewport, card)
    expect(rightEdge.left).toBe(1000 - 400 - 8)
  })

  it('never places the card off the left edge on narrow viewports', () => {
    const p = placeTourCard({ top: 100, left: 10, width: 300, height: 50 }, { width: 375, height: 700 }, { width: 360, height: 200 })
    expect(p.left).toBe(8)
  })
})

describe('spotlightHole', () => {
  it('pads the anchor and clamps to the viewport', () => {
    expect(spotlightHole({ top: 100, left: 200, width: 300, height: 80 }, viewport)).toEqual({ top: 94, left: 194, width: 312, height: 92 })
    const clamped = spotlightHole({ top: 2, left: 2, width: 998, height: 100 }, viewport)
    expect(clamped.top).toBe(0)
    expect(clamped.left).toBe(0)
    expect(clamped.width).toBe(1000)
  })
})
