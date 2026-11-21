import { describe, expect, it } from 'vitest'
import { paintedFitView, paintedViewBounds } from './paintedMapView'
import { sketchSpot, sketchStrokes } from './paintedWaitSketch'

// Made-up ground: a park and a plaza a few blocks apart.
const A = { lat: 29.42585, lng: -98.48615 }
const B = { lat: 29.42775, lng: -98.48985 }
const MID = { lat: 29.4271, lng: -98.4875 }
const BOX = { width: 390, height: 560 }

describe('sketchSpot', () => {
  it('puts the middle of the view in the middle of the box', () => {
    const view = { center: A, zoom: 17 }
    expect(sketchSpot(A, view, BOX)).toEqual({ x: 195, y: 280 })
  })

  it('puts the corners of what the view shows on the corners of the box', () => {
    const view = { center: MID, zoom: 16 }
    const b = paintedViewBounds(view, BOX)
    const topLeft = sketchSpot({ lat: b.north, lng: b.west }, view, BOX)
    const bottomRight = sketchSpot({ lat: b.south, lng: b.east }, view, BOX)
    expect(topLeft.x).toBeCloseTo(0, 6)
    expect(topLeft.y).toBeCloseTo(0, 6)
    expect(bottomRight.x).toBeCloseTo(BOX.width, 6)
    expect(bottomRight.y).toBeCloseTo(BOX.height, 6)
  })

  it('moves a point two pixels for one when the map is a zoom closer', () => {
    const far = sketchSpot(B, { center: A, zoom: 16 }, BOX)
    const near = sketchSpot(B, { center: A, zoom: 17 }, BOX)
    expect(near.x - 195).toBeCloseTo((far.x - 195) * 2, 6)
    expect(near.y - 280).toBeCloseTo((far.y - 280) * 2, 6)
  })

  it('keeps everything a fitted view frames inside the box, with the room the fit leaves', () => {
    const view = paintedFitView([A, B, MID], BOX)!
    for (const p of [A, B, MID]) {
      const at = sketchSpot(p, view, BOX)
      expect(at.x).toBeGreaterThanOrEqual(39)
      expect(at.x).toBeLessThanOrEqual(BOX.width - 39)
      expect(at.y).toBeGreaterThanOrEqual(39)
      expect(at.y).toBeLessThanOrEqual(BOX.height - 39)
    }
  })

  it('sits north above south and west left of east', () => {
    const view = { center: MID, zoom: 16 }
    const a = sketchSpot(A, view, BOX)
    const b = sketchSpot(B, view, BOX)
    expect(b.y).toBeLessThan(a.y)
    expect(b.x).toBeLessThan(a.x)
  })
})

describe('sketchStrokes', () => {
  const view = { center: MID, zoom: 16 }

  it('draws a walked line as one sure stroke through every point', () => {
    const strokes = sketchStrokes([{ points: [B, MID, A], poorParts: [], how: 'walked' }], view, BOX)
    expect(strokes).toHaveLength(1)
    expect(strokes[0]!.look).toBe('sure')
    expect(strokes[0]!.d.match(/[ML]/g)).toEqual(['M', 'L', 'L'])
    expect(strokes[0]!.d.startsWith('M')).toBe(true)
  })

  it('draws a line made by hand dashed', () => {
    const strokes = sketchStrokes([{ points: [B, A], poorParts: [], how: 'drawn' }], view, BOX)
    expect(strokes.map((s) => s.look)).toEqual(['drawn'])
  })

  it('draws a stretch the phone was not sure of as its own faint stroke, joined to its neighbours', () => {
    const C = { lat: 29.4265, lng: -98.4868 }
    const strokes = sketchStrokes([{ points: [B, MID, C, A], poorParts: [[1, 2]], how: 'walked' }], view, BOX)
    expect(strokes.map((s) => s.look).sort()).toEqual(['poor', 'sure', 'sure'])
    const poor = strokes.find((s) => s.look === 'poor')!
    const at = sketchSpot(MID, view, BOX)
    expect(poor.d.startsWith(`M${Math.round(at.x * 10) / 10} ${Math.round(at.y * 10) / 10}`)).toBe(true)
  })

  it('draws nothing in a box that has not been measured', () => {
    expect(sketchStrokes([{ points: [B, A], poorParts: [], how: 'walked' }], view, { width: 0, height: 0 })).toEqual([])
  })

  it('draws nothing for a map with no line', () => {
    expect(sketchStrokes([], view, BOX)).toEqual([])
  })
})
