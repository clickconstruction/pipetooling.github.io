import { describe, expect, it } from 'vitest'
import { pointInBox } from './followMe'
import { GLASS_ASK_AGAIN_MS, GLASS_SIZE, GLASS_ZOOM_IN, SNAP_MAX_METERS, SNAP_PX, glassPictureScale, glassSpot, glassView, settlePoint, snapReachMeters, spotAtBox, withLive, type PaintedLive } from './handPlacing'
import { metersPerPixel, type SnapTarget } from './paintedLine'
import { PAINTED_SNAP_METERS } from './paintedMap'
import type { PaintedMapView } from './paintedMapView'

const AT = { lat: 39.5, lng: -98.35 }
const GATE: SnapTarget = { id: 'gate', lat: 39.5001, lng: -98.3499, label: 'Truck gate' }

describe('snapReachMeters', () => {
  it('is 14 px of ground at the zoom a line is drawn at', () => {
    expect(snapReachMeters(18, AT.lat)).toBeCloseTo(SNAP_PX * metersPerPixel(18, AT.lat), 6)
    expect(snapReachMeters(18, AT.lat)).toBeGreaterThan(PAINTED_SNAP_METERS)
    expect(snapReachMeters(18, AT.lat)).toBeLessThan(SNAP_MAX_METERS)
  })

  it('never reaches further than 15 m, however wide the view', () => {
    expect(snapReachMeters(12, AT.lat)).toBe(SNAP_MAX_METERS)
  })

  it('never reaches less than the painted map’s own snap, however close the view', () => {
    expect(snapReachMeters(21, AT.lat)).toBe(PAINTED_SNAP_METERS)
  })
})

describe('settlePoint', () => {
  it('lands on a target the point is near on the screen, and says which', () => {
    const near = { lat: GATE.lat + 0.00002, lng: GATE.lng }
    // 0.00002 of a degree north is a little over 2 m, inside the 6 m or so a catch reaches at this zoom.
    expect(snapReachMeters(18, near.lat)).toBeGreaterThan(5)
    expect(settlePoint(near, [GATE], 18)).toEqual({ point: { lat: GATE.lat, lng: GATE.lng }, caught: GATE })
  })

  it('lands where the finger is when nothing is near, or there is nothing to catch', () => {
    const far = { lat: GATE.lat + 0.001, lng: GATE.lng }
    expect(settlePoint(far, [GATE], 18)).toEqual({ point: far, caught: null })
    expect(settlePoint(GATE, [], 18)).toEqual({ point: GATE, caught: null })
  })

  it('catches from further away on a wider view, since the reach is on the screen', () => {
    const off = { lat: GATE.lat + 0.00009, lng: GATE.lng }
    expect(settlePoint(off, [GATE], 19).caught).toBeNull()
    expect(settlePoint(off, [GATE], 16).caught).toBe(GATE)
  })
})

describe('withLive', () => {
  const A = { lat: 1, lng: 1 }
  const B = { lat: 2, lng: 2 }
  const C = { lat: 3, lng: 3 }
  const P = { lat: 9, lng: 9 }
  const live = (over: Record<string, unknown>): PaintedLive => ({ point: P, caught: null, ...over }) as PaintedLive

  it('hands the corners back as they are with no finger down, and for a dot', () => {
    const points = [A, B]
    expect(withLive(points, null)).toEqual(points)
    expect(withLive(points, null)).not.toBe(points)
    expect(withLive(points, live({ kind: 'dot' }))).toEqual(points)
  })

  it('moves a corner, makes one in a leg, and adds one at the end', () => {
    expect(withLive([A, B, C], live({ kind: 'move', index: 1 }))).toEqual([A, P, C])
    expect(withLive([A, B, C], live({ kind: 'insert', after: 0 }))).toEqual([A, P, B, C])
    expect(withLive([A, B], live({ kind: 'add' }))).toEqual([A, B, P])
  })
})

describe('glassSpot', () => {
  const BOX = { width: 390, height: 590 }
  const half = GLASS_SIZE / 2

  it('rides above the finger when there is room', () => {
    expect(glassSpot({ x: 200, y: 400 }, BOX)).toEqual({ x: 200, y: 400 - 34 - half })
  })

  it('moves to the side with more of the map when the top is too near', () => {
    const right = glassSpot({ x: 300, y: 60 }, BOX)
    expect(right.x).toBe(300 - 34 - half - 24)
    expect(right.y).toBe(half + 4)
    const left = glassSpot({ x: 80, y: 120 }, BOX)
    expect(left.x).toBe(80 + 34 + half + 24)
    expect(left.y).toBe(110)
  })

  it('stays whole inside the box at every edge', () => {
    for (const finger of [{ x: 2, y: 500 }, { x: 388, y: 500 }, { x: 2, y: 2 }, { x: 388, y: 588 }]) {
      const at = glassSpot(finger, BOX)
      expect(at.x).toBeGreaterThanOrEqual(half + 4)
      expect(at.x).toBeLessThanOrEqual(BOX.width - half - 4)
      expect(at.y).toBeGreaterThanOrEqual(half + 4)
      expect(at.y).toBeLessThanOrEqual(BOX.height - half - 4)
    }
  })
})

describe('spotAtBox and glassView', () => {
  const VIEW: PaintedMapView = { center: AT, zoom: 18 }
  const BOX = { width: 390, height: 361 }

  it('reads the spot under a press: the box’s middle is the view’s middle', () => {
    const mid = spotAtBox({ x: 195, y: 180.5 }, VIEW, BOX)
    expect(mid.lat).toBeCloseTo(AT.lat, 9)
    expect(mid.lng).toBeCloseTo(AT.lng, 9)
  })

  it('is the way back from where a spot is in the box', () => {
    for (const press of [{ x: 10, y: 12 }, { x: 300, y: 340 }, { x: 195, y: 90 }]) {
      const back = pointInBox(spotAtBox(press, VIEW, BOX), VIEW, BOX)
      expect(back.x).toBeCloseTo(press.x, 4)
      expect(back.y).toBeCloseTo(press.y, 4)
    }
  })

  it('looks through the glass at the spot, two zoom steps in, so the ground is four times the size', () => {
    const spot = { lat: 39.5002, lng: -98.3498 }
    const through = glassView(spot, 18)
    expect(through).toEqual({ center: spot, zoom: 18 + GLASS_ZOOM_IN })
    // A place 10 px to the right of the spot on the map is 40 px right of the glass's middle.
    const size = { width: GLASS_SIZE, height: GLASS_SIZE }
    const neighbour = spotAtBox({ x: 205, y: 180.5 }, { center: spot, zoom: 18 }, BOX)
    const inGlass = pointInBox(neighbour, through, size)
    expect(inGlass.x - GLASS_SIZE / 2).toBeCloseTo(40, 3)
    expect(inGlass.y - GLASS_SIZE / 2).toBeCloseTo(0, 3)
  })
})

describe('glassPictureScale', () => {
  it('draws the picture as it is when the glass’s map gave the view asked for', () => {
    expect(glassPictureScale(21, 21)).toBe(1)
  })

  it('draws it larger only by the zoom steps the map held back', () => {
    // The photograph ends one step short of the view: twice the size, where it was four times.
    expect(glassPictureScale(21, 20)).toBe(2)
    // It ends at the big map's own zoom: four times the size, as before the glass asked for more.
    expect(glassPictureScale(21, 21 - GLASS_ZOOM_IN)).toBe(2 ** GLASS_ZOOM_IN)
    // A spot the map has not seen yet may be held back further than that for a moment.
    expect(glassPictureScale(23, 19)).toBe(16)
  })

  it('never draws it smaller, and takes a map that cannot say its zoom at its word', () => {
    expect(glassPictureScale(19, 21)).toBe(1)
    expect(glassPictureScale(19, null)).toBe(1)
    expect(glassPictureScale(19, undefined)).toBe(1)
    expect(glassPictureScale(19, Number.NaN)).toBe(1)
  })

  it('asks again a few times while the finger rests, sooner first, and then stops', () => {
    expect(GLASS_ASK_AGAIN_MS.length).toBeGreaterThan(0)
    expect(GLASS_ASK_AGAIN_MS.length).toBeLessThanOrEqual(4)
    expect([...GLASS_ASK_AGAIN_MS].sort((a, b) => a - b)).toEqual([...GLASS_ASK_AGAIN_MS])
  })
})
