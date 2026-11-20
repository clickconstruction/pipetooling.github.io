import { describe, expect, it } from 'vitest'
import { haversineMeters } from '../jobTravelEstimate'
import { areaEdgeStroke, circleRing, poorRunStroke, sureRunStrokes } from './paintedGoogleShapes'

const LOOK = { ink: '#111827', paint: '#ff5a1f' }

describe('sureRunStrokes', () => {
  it('draws a dark edge under the paint, wider than it', () => {
    const [edge, paint] = sureRunStrokes('walked', LOOK)
    expect(edge).toEqual({ strokeColor: LOOK.ink, strokeOpacity: 0.9, strokeWeight: 8, zIndex: 1 })
    expect(paint.strokeWeight).toBeLessThan(edge.strokeWeight)
    expect(paint.zIndex).toBeGreaterThan(edge.zIndex)
  })

  it('paints a walked line solid', () => {
    const [, paint] = sureRunStrokes('walked', LOOK)
    expect(paint).toEqual({ strokeColor: LOOK.paint, strokeOpacity: 1, strokeWeight: 5, zIndex: 2 })
  })

  it('dashes a line drawn by hand, 14 on and 7 off, as the Leaflet canvas does', () => {
    const [edge, paint] = sureRunStrokes('drawn', LOOK)
    // The edge stays solid under the dashes.
    expect(edge.icons).toBeUndefined()
    // The line itself is not drawn. The dash stands for it.
    expect(paint.strokeOpacity).toBe(0)
    const dash = paint.icons![0]!
    // Two units long, scaled by 7: 14 px. One every 21 px leaves 7 off.
    expect(dash.icon.path).toBe('M 0,-1 0,1')
    expect(dash.icon.scale * 2).toBe(14)
    expect(dash.repeat).toBe('21px')
    expect(dash.icon.strokeWeight).toBe(5)
    expect(dash.icon.strokeColor).toBe(LOOK.paint)
    expect(dash.icon.strokeOpacity).toBe(1)
  })

  it('keeps a dash inside the 22 px square Google allows a drawing on a line', () => {
    const [, paint] = sureRunStrokes('drawn', LOOK)
    expect(paint.icons![0]!.icon.scale * 2).toBeLessThanOrEqual(22)
  })
})

describe('poorRunStroke', () => {
  it('draws a stretch the phone was not sure of as faint dots, never a solid line', () => {
    const stroke = poorRunStroke(LOOK)
    expect(stroke.strokeOpacity).toBe(0)
    const dot = stroke.icons![0]!
    // A disc 2 px in radius every 11 px: 2 on, 9 off.
    expect(dot.icon.scale).toBe(2)
    expect(dot.repeat).toBe('11px')
    expect(dot.icon.fillColor).toBe(LOOK.paint)
    expect(dot.icon.fillOpacity).toBe(0.85)
    expect(dot.icon.strokeOpacity).toBe(0)
  })
})

describe('a rough reading’s area', () => {
  it('has a dashed edge, 6 on and 6 off and 2 px wide, as the Leaflet canvas draws it', () => {
    const edge = areaEdgeStroke('#2563eb')
    // The line itself is not drawn. The dash stands for it.
    expect(edge.strokeOpacity).toBe(0)
    const dash = edge.icons![0]!
    expect(dash.icon.scale * 2).toBe(6)
    expect(dash.repeat).toBe('12px')
    expect(dash.icon.strokeWeight).toBe(2)
    expect(dash.icon.strokeColor).toBe('#2563eb')
  })

  it('runs its edge round the circle, every point the radius away, and closes it', () => {
    const centre = { lat: 29.55, lng: -98.3 }
    const ring = circleRing(centre, 3200)
    expect(ring).toHaveLength(73)
    expect(ring[72]).toEqual(ring[0])
    for (const p of ring) expect(haversineMeters(centre, p)).toBeCloseTo(3200, 0)
  })
})
