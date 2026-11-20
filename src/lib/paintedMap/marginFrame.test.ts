import { describe, expect, it } from 'vitest'
import { haversineMeters } from '../jobTravelEstimate'
import { fromPlane, type PaintedBounds, type PaintedPoint } from './paintedLine'
import { MARGIN_FRAME_FAR_ZOOM, MARGIN_FRAME_PADDING_PX, MARGIN_FRAME_ZOOM, areaBox, marginFrameStep, type PaintedCanvasMe } from './marginFrame'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })
const spot = (eastM = 0, northM = 0, accuracyM: number | null = 5): PaintedCanvasMe => ({ ...at(eastM, northM), accuracyM })
const area = (eastM = 0, northM = 0, accuracyM: number | null = 3200): PaintedCanvasMe => ({ ...at(eastM, northM), accuracyM, area: true })
/** A view that reaches this far each way from the origin. */
const view = (m: number): PaintedBounds => {
  const sw = at(-m, -m)
  const ne = at(m, m)
  return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng }
}
const STREET = view(60)
const JOB = [at(40, 10), at(90, 10)]

describe('the box an area fills', () => {
  it('is the whole circle, a margin each way from its middle', () => {
    const box = areaBox(area(), [])!
    expect(haversineMeters({ lat: box.south, lng: ORIGIN.lng }, ORIGIN)).toBeCloseTo(3200, 0)
    expect(haversineMeters({ lat: box.north, lng: ORIGIN.lng }, ORIGIN)).toBeCloseTo(3200, 0)
    expect(haversineMeters({ lat: ORIGIN.lat, lng: box.west }, ORIGIN)).toBeCloseTo(3200, 0)
    expect(haversineMeters({ lat: ORIGIN.lat, lng: box.east }, ORIGIN)).toBeCloseTo(3200, 0)
  })

  it('takes in the map’s own lines and places, so the job stays in the picture', () => {
    const far = at(5000, 0)
    const box = areaBox(area(), [...JOB, far])!
    expect(box.east).toBeCloseTo(far.lng, 6)
    expect(box.west).toBeCloseTo(areaBox(area(), [])!.west, 6)
    // Points inside the circle change nothing.
    expect(areaBox(area(), JOB)).toEqual(areaBox(area(), []))
  })

  it('is nothing for a reading with no margin, or a broken one', () => {
    expect(areaBox(area(0, 0, null), JOB)).toBeNull()
    expect(areaBox(area(0, 0, 0), JOB)).toBeNull()
    expect(areaBox({ lat: 0, lng: 0, accuracyM: 3200, area: true }, JOB)).toBeNull()
    expect(areaBox({ lat: Number.NaN, lng: -98, accuracyM: 3200, area: true }, JOB)).toBeNull()
  })
})

describe('an area reaches the frame', () => {
  it('is fitted the moment the readings turn rough, from a first reading or from a spot', () => {
    for (const framed of ['none', 'spot'] as const) {
      const step = marginFrameStep({ framed, me: area(), points: JOB, zoom: 18, view: STREET })
      expect(step).toEqual({ framed: 'area', move: { kind: 'area', box: areaBox(area(), JOB) } })
    }
  })

  it('is fitted on the first rough reading even when the view already holds it, so the circle is seen to scale', () => {
    const step = marginFrameStep({ framed: 'none', me: area(), points: [], zoom: 4, view: view(2_000_000) })
    expect(step.move).toEqual({ kind: 'area', box: areaBox(area(), []) })
  })

  it('is left alone on a later reading the view already holds: a person who pulled back further stays there', () => {
    const step = marginFrameStep({ framed: 'area', me: area(30, -20, 3300), points: JOB, zoom: 11, view: view(4000) })
    expect(step).toEqual({ framed: 'area', move: null })
  })

  it('is fitted again when a later reading reaches past the view', () => {
    const moved = area(9000, 0)
    const step = marginFrameStep({ framed: 'area', me: moved, points: JOB, zoom: 11, view: view(4000) })
    expect(step).toEqual({ framed: 'area', move: { kind: 'area', box: areaBox(moved, JOB) } })
    // A wider one, in the same place.
    expect(marginFrameStep({ framed: 'area', me: area(0, 0, 8000), points: JOB, zoom: 11, view: view(4000) }).move?.kind).toBe('area')
  })

  it('is fitted when the canvas cannot say what it shows', () => {
    expect(marginFrameStep({ framed: 'area', me: area(), points: JOB, zoom: null, view: null }).move?.kind).toBe('area')
    const broken = { south: Number.NaN, west: 0, north: 0, east: 0 }
    expect(marginFrameStep({ framed: 'area', me: area(), points: JOB, zoom: 11, view: broken }).move?.kind).toBe('area')
  })

  it('moves nothing, and forgets nothing, on an area with no margin', () => {
    for (const framed of ['none', 'spot', 'area'] as const) {
      expect(marginFrameStep({ framed, me: area(0, 0, null), points: JOB, zoom: 18, view: STREET })).toEqual({ framed, move: null })
    }
  })
})

describe('a spot reaches the frame', () => {
  it('brings the map in to the person after an area', () => {
    const me = spot(12, 30)
    const step = marginFrameStep({ framed: 'area', me, points: JOB, zoom: 11, view: view(4000) })
    expect(step).toEqual({ framed: 'spot', move: { kind: 'person', at: { lat: me.lat, lng: me.lng }, zoom: 18 } })
    expect(MARGIN_FRAME_ZOOM).toBe(18)
  })

  it('brings the map in after an area however weak the signal, since a weak reading is still a spot', () => {
    expect(marginFrameStep({ framed: 'area', me: spot(0, 0, 300), points: JOB, zoom: 11, view: view(4000) }).move?.kind).toBe('person')
  })

  it('brings a map that opened far out in to the person on the first reading of all', () => {
    expect(MARGIN_FRAME_FAR_ZOOM).toBe(16)
    for (const zoom of [4, 12, 15.99]) expect(marginFrameStep({ framed: 'none', me: spot(), points: [], zoom, view: null }).move, `zoom ${zoom}`).toEqual({ kind: 'person', at: ORIGIN, zoom: 18 })
  })

  it('leaves a map that opened on the job where it is', () => {
    for (const zoom of [16, 18, 21]) expect(marginFrameStep({ framed: 'none', me: spot(), points: JOB, zoom, view: STREET }), `zoom ${zoom}`).toEqual({ framed: 'spot', move: null })
    // A canvas that cannot say how far in it is is left alone too.
    expect(marginFrameStep({ framed: 'none', me: spot(), points: JOB, zoom: null, view: null })).toEqual({ framed: 'spot', move: null })
  })

  it('moves nothing from one spot to the next: the view is the person’s own, even pulled far back', () => {
    for (const zoom of [4, 12, 18]) expect(marginFrameStep({ framed: 'spot', me: spot(200, 0), points: JOB, zoom, view: STREET })).toEqual({ framed: 'spot', move: null })
  })

  it('moves nothing for a broken reading, and remembers what came before', () => {
    for (const framed of ['none', 'area', 'spot'] as const) {
      expect(marginFrameStep({ framed, me: { lat: 0, lng: 0, accuracyM: 5 }, points: JOB, zoom: 4, view: null })).toEqual({ framed, move: null })
    }
  })
})

describe('the room around an area', () => {
  it('is 28 dots a side', () => {
    expect(MARGIN_FRAME_PADDING_PX).toBe(28)
  })
})
