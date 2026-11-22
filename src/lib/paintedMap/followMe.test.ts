import { describe, expect, it } from 'vitest'
import { FOLLOW_EDGE, followStep, pointInBox } from './followMe'
import { paintedViewBounds, type PaintedMapView } from './paintedMapView'

const BOX = { width: 390, height: 520 }
const MID = { lat: 29.4272, lng: -98.4848 }
const VIEW: PaintedMapView = { center: MID, zoom: 18 }

describe('pointInBox', () => {
  it('puts the middle of the view in the middle of the box, and its corners at the corners', () => {
    expect(pointInBox(MID, VIEW, BOX)).toEqual({ x: 195, y: 260 })
    const shown = paintedViewBounds(VIEW, BOX)
    const topLeft = pointInBox({ lat: shown.north, lng: shown.west }, VIEW, BOX)
    expect(topLeft.x).toBeCloseTo(0, 3)
    expect(topLeft.y).toBeCloseTo(0, 3)
    const bottomRight = pointInBox({ lat: shown.south, lng: shown.east }, VIEW, BOX)
    expect(bottomRight.x).toBeCloseTo(BOX.width, 3)
    expect(bottomRight.y).toBeCloseTo(BOX.height, 3)
  })
})

describe('followStep', () => {
  const shown = paintedViewBounds(VIEW, BOX)
  // The margin is a quarter of the shorter side, 97.5 px here, on every side.
  const lngAt = (x: number) => shown.west + ((shown.east - shown.west) * x) / BOX.width
  const latAt = (y: number) => {
    // Near enough flat over a box this small.
    return shown.north - ((shown.north - shown.south) * y) / BOX.height
  }

  it('leaves the map alone while the walker is in its middle', () => {
    expect(followStep({ me: MID, view: VIEW, box: BOX })).toBeNull()
    expect(followStep({ me: { lat: latAt(260), lng: lngAt(110) }, view: VIEW, box: BOX })).toBeNull()
    expect(followStep({ me: { lat: latAt(410), lng: lngAt(195) }, view: VIEW, box: BOX })).toBeNull()
  })

  it('slides to the walker when they near any edge, by the shorter side’s quarter', () => {
    expect(BOX.width * FOLLOW_EDGE).toBe(97.5)
    const left = { lat: latAt(260), lng: lngAt(90) }
    const right = { lat: latAt(260), lng: lngAt(300) }
    const top = { lat: latAt(90), lng: lngAt(195) }
    const bottom = { lat: latAt(430), lng: lngAt(195) }
    for (const me of [left, right, top, bottom]) expect(followStep({ me, view: VIEW, box: BOX })).toEqual(me)
  })

  it('slides to a walker who has left the picture', () => {
    const me = { lat: MID.lat + 0.01, lng: MID.lng }
    expect(followStep({ me, view: VIEW, box: BOX })).toEqual(me)
  })

  it('slides to them on a map that has not settled, and in a box with no size', () => {
    expect(followStep({ me: MID, view: null, box: BOX })).toEqual(MID)
    expect(followStep({ me: MID, view: VIEW, box: { width: 0, height: 0 } })).toEqual(MID)
  })

  it('hands back the spot alone, without the reading’s margin', () => {
    const me = { lat: MID.lat + 0.01, lng: MID.lng, accuracyM: 6 }
    expect(followStep({ me, view: VIEW, box: BOX })).toEqual({ lat: me.lat, lng: me.lng })
  })
})
