import { describe, expect, it } from 'vitest'
import { worldPx } from './paintedMapPicture'
import { PAINTED_FIT_MAX_ZOOM, PAINTED_FIT_PAD, PAINTED_MAX_ZOOM, PAINTED_POINT_ZOOM, PAINTED_WIDE_VIEW, clampView, paintedFitView, paintedOpeningView, worldPoint } from './paintedMapView'

/** A made-up site north of San Antonio. */
const GATE = { lat: 29.55, lng: -98.3 }
const YARD = { lat: 29.5512, lng: -98.2985 }
const FAR = { lat: 29.62, lng: -98.21 }
const BOX = { width: 600, height: 400 }

describe('worldPoint', () => {
  it('is worldPx the other way, at any zoom', () => {
    for (const zoom of [4, 12, 18, 21]) {
      const back = worldPoint(worldPx(GATE, zoom), zoom)
      expect(back.lat).toBeCloseTo(GATE.lat, 9)
      expect(back.lng).toBeCloseTo(GATE.lng, 9)
    }
  })
})

describe('paintedFitView', () => {
  it('has no view of nothing', () => {
    expect(paintedFitView([], BOX)).toBeNull()
  })

  it('draws one point, or several on top of each other, at the point zoom', () => {
    expect(paintedFitView([GATE], BOX)).toEqual({ center: GATE, zoom: PAINTED_POINT_ZOOM })
    expect(paintedFitView([GATE, { ...GATE }], BOX)).toEqual({ center: GATE, zoom: PAINTED_POINT_ZOOM })
  })

  it('holds every point inside the box with room around it', () => {
    const view = paintedFitView([GATE, YARD, FAR], BOX)!
    const mid = worldPx(view.center, view.zoom)
    for (const p of [GATE, YARD, FAR]) {
      const at = worldPx(p, view.zoom)
      expect(Math.abs(at.x - mid.x)).toBeLessThanOrEqual(BOX.width / 2 - PAINTED_FIT_PAD + 0.001)
      expect(Math.abs(at.y - mid.y)).toBeLessThanOrEqual(BOX.height / 2 - PAINTED_FIT_PAD + 0.001)
    }
  })

  it('is the closest zoom that holds them: one step in, something is cut', () => {
    const view = paintedFitView([GATE, FAR], BOX)!
    expect(view.zoom).toBeLessThan(PAINTED_FIT_MAX_ZOOM)
    const a = worldPx(GATE, view.zoom + 1)
    const c = worldPx(FAR, view.zoom + 1)
    const fitsCloser = Math.abs(c.x - a.x) <= BOX.width - 2 * PAINTED_FIT_PAD && Math.abs(a.y - c.y) <= BOX.height - 2 * PAINTED_FIT_PAD
    expect(fitsCloser).toBe(false)
  })

  it('goes no closer than the photograph is sharp, however short the line', () => {
    // Two corners a few feet apart. Google's own fit would open at its deepest zoom.
    const view = paintedFitView([GATE, { lat: GATE.lat + 0.00001, lng: GATE.lng + 0.00001 }], BOX)!
    expect(view.zoom).toBe(PAINTED_FIT_MAX_ZOOM)
  })

  it('centres on the flat map, so the two ends sit the same distance from the middle', () => {
    const view = paintedFitView([GATE, FAR], BOX)!
    const mid = worldPx(view.center, view.zoom)
    const a = worldPx(GATE, view.zoom)
    const c = worldPx(FAR, view.zoom)
    expect(mid.x - a.x).toBeCloseTo(c.x - mid.x, 6)
    expect(a.y - mid.y).toBeCloseTo(mid.y - c.y, 6)
  })

  it('still frames in a box that has not been measured, or is smaller than its own room', () => {
    expect(paintedFitView([GATE, FAR], { width: 0, height: 0 })).not.toBeNull()
    const tiny = paintedFitView([GATE, FAR], { width: 60, height: 50 })!
    expect(tiny.zoom).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(tiny.center.lat)).toBe(true)
  })

  it('moves out as the box gets smaller', () => {
    const wide = paintedFitView([GATE, FAR], { width: 1200, height: 800 })!
    const phone = paintedFitView([GATE, FAR], { width: 360, height: 260 })!
    expect(phone.zoom).toBeLessThan(wide.zoom)
  })
})

describe('paintedOpeningView', () => {
  it('keeps the spot the painter was on when the map under it changes', () => {
    const carried = { center: YARD, zoom: 20 }
    expect(paintedOpeningView({ carried, points: [GATE, FAR], start: GATE, box: BOX })).toEqual(carried)
  })

  it('frames everything on the map when nothing was carried', () => {
    expect(paintedOpeningView({ points: [GATE, FAR], start: YARD, box: BOX })).toEqual(paintedFitView([GATE, FAR], BOX))
  })

  it('opens a map with nothing on it at its address, close', () => {
    expect(paintedOpeningView({ points: [], start: GATE, box: BOX })).toEqual({ center: GATE, zoom: PAINTED_POINT_ZOOM })
  })

  it('opens on the country with no address either', () => {
    expect(paintedOpeningView({ points: [], start: null, box: BOX })).toEqual(PAINTED_WIDE_VIEW)
  })
})

describe('clampView', () => {
  it('hands on a whole zoom that both canvases can draw', () => {
    expect(clampView({ center: GATE, zoom: 18.6 })).toEqual({ center: GATE, zoom: 19 })
    expect(clampView({ center: GATE, zoom: 23 }).zoom).toBe(PAINTED_MAX_ZOOM)
    expect(clampView({ center: GATE, zoom: 0 }).zoom).toBe(1)
  })
})
