import { describe, expect, it } from 'vitest'
import { FRAME_ME_EDGE, frameMeStep, meIsWellInside } from './frameMe'
import { PAINTED_FIT_MAX_ZOOM, PAINTED_POINT_ZOOM, paintedViewBounds, type PaintedMapView } from './paintedMapView'

const BOX = { width: 360, height: 360 }
// A made-up line on public ground, about 300 m long.
const LINE = [
  { lat: 29.4262, lng: -98.4862 },
  { lat: 29.4283, lng: -98.4835 },
]
const MID = { lat: 29.42725, lng: -98.48485 }

describe('frameMeStep', () => {
  it('frames the line and the reader together on the first reading, wherever the map is', () => {
    const me = { lat: 29.4301, lng: -98.4899 }
    const view: PaintedMapView = { center: MID, zoom: 17 }
    const step = frameMeStep({ framed: false, me, points: LINE, view, box: BOX })
    expect(step.framed).toBe(true)
    expect(step.move).not.toBeNull()
    const shown = paintedViewBounds(step.move as PaintedMapView, BOX)
    for (const p of [...LINE, me]) {
      expect(p.lat).toBeGreaterThan(shown.south)
      expect(p.lat).toBeLessThan(shown.north)
      expect(p.lng).toBeGreaterThan(shown.west)
      expect(p.lng).toBeLessThan(shown.east)
    }
  })

  it('frames a reader who is already in the picture on the first reading too, as the Leaflet canvas does', () => {
    const step = frameMeStep({ framed: false, me: MID, points: LINE, view: { center: MID, zoom: 17 }, box: BOX })
    expect(step.move).not.toBeNull()
  })

  it('leaves the map as the reader has it while their dot is well inside it', () => {
    const view: PaintedMapView = { center: MID, zoom: 17 }
    const step = frameMeStep({ framed: true, me: { lat: MID.lat + 0.0002, lng: MID.lng - 0.0002 }, points: LINE, view, box: BOX })
    expect(step).toEqual({ framed: true, move: null })
  })

  it('frames again when the dot walks into the outer edge of the picture, and when it leaves it', () => {
    const view: PaintedMapView = { center: MID, zoom: 17 }
    const shown = paintedViewBounds(view, BOX)
    const tall = shown.north - shown.south
    const nearTop = { lat: shown.north - tall * (FRAME_ME_EDGE / 2), lng: MID.lng }
    const justInside = { lat: shown.north - tall * (FRAME_ME_EDGE * 1.5), lng: MID.lng }
    const gone = { lat: shown.north + tall, lng: MID.lng }
    expect(frameMeStep({ framed: true, me: nearTop, points: LINE, view, box: BOX }).move).not.toBeNull()
    expect(frameMeStep({ framed: true, me: justInside, points: LINE, view, box: BOX }).move).toBeNull()
    const far = frameMeStep({ framed: true, me: gone, points: LINE, view, box: BOX }).move
    expect(far).not.toBeNull()
    const farShown = paintedViewBounds(far as PaintedMapView, BOX)
    expect(gone.lat).toBeLessThan(farShown.north)
    expect(LINE[0]?.lat).toBeGreaterThan(farShown.south)
  })

  it('frames a map that has not settled, which cannot say what it shows', () => {
    expect(frameMeStep({ framed: true, me: MID, points: LINE, view: null, box: BOX }).move).not.toBeNull()
  })

  it('goes no closer than the photograph is sharp for a reader standing on a short line', () => {
    const short = [
      { lat: 29.4262, lng: -98.4862 },
      { lat: 29.42621, lng: -98.48619 },
    ]
    const step = frameMeStep({ framed: false, me: { lat: 29.426205, lng: -98.486195 }, points: short, view: null, box: BOX })
    expect(step.move?.zoom).toBe(PAINTED_FIT_MAX_ZOOM)
  })

  it('draws a reader standing on a map that is one point at the point zoom', () => {
    const at = { lat: 29.4262, lng: -98.4862 }
    expect(frameMeStep({ framed: false, me: at, points: [at], view: null, box: BOX }).move).toEqual({ center: at, zoom: PAINTED_POINT_ZOOM })
  })

  it('still frames in a box that has not been measured', () => {
    const step = frameMeStep({ framed: false, me: MID, points: LINE, view: null, box: { width: 0, height: 0 } })
    expect(step.move).not.toBeNull()
  })
})

describe('meIsWellInside', () => {
  it('reads a box with no size as showing nothing', () => {
    expect(meIsWellInside(MID, { center: MID, zoom: 17 }, { width: 0, height: 0 })).toBe(false)
  })

  it('counts the edge on every side', () => {
    const view: PaintedMapView = { center: MID, zoom: 17 }
    const shown = paintedViewBounds(view, BOX)
    const wide = shown.east - shown.west
    expect(meIsWellInside({ lat: MID.lat, lng: shown.west + wide * 0.04 }, view, BOX)).toBe(false)
    expect(meIsWellInside({ lat: MID.lat, lng: shown.east - wide * 0.04 }, view, BOX)).toBe(false)
    expect(meIsWellInside({ lat: MID.lat, lng: shown.west + wide * 0.12 }, view, BOX)).toBe(true)
  })
})
