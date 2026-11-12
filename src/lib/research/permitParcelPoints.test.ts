import { describe, expect, it } from 'vitest'
import {
  fillPoints,
  hasPoint,
  idBatches,
  parcelIdsToAsk,
  parcelPointsOf,
  pointOfRings,
  travisParcelQuery,
  TRAVIS_PARCEL_POINTS,
  withoutPointColumns,
} from '../../../supabase/functions/_shared/permitParcelPoints'
import { TRAVIS_PARCELS } from '../../../supabase/functions/_shared/permitParcels'
import { AUSTIN_READER, PERMIT_CITIES, permitRowFromAustin } from '../../../supabase/functions/_shared/permitCities'
import type { PermitRow } from '../../../supabase/functions/_shared/permitFeed'

// Every id, street, number and shape here is made up.
let serial = 0
function row(over: { tcad_id?: unknown; latitude?: string; longitude?: string } = {}): PermitRow {
  serial++
  const made = permitRowFromAustin({
    permittype: 'BP',
    permit_type_desc: 'Building Permit',
    permit_number: `2026-${String(serial).padStart(6, '0')} BP`,
    permit_class_mapped: 'Commercial',
    work_class: 'New',
    issue_date: '2026-11-05T00:00:00.000',
    original_address1: `${serial} SAMPLE LN`,
    ...over,
  })
  if (!made) throw new Error('the made-up record is not a kept permit')
  return made
}

/** A lot's corners a thousandth of a degree apart, set down in Austin: `[lng, lat]`, as a map layer writes them. */
const AT = { lng: -97.75, lat: 30.25 }
function lot(...corners: Array<[number, number]>): number[][] {
  return corners.map(([x, y]) => [AT.lng + x / 1000, AT.lat + y / 1000])
}
function at(x: number, y: number): { lat: number; lng: number } {
  const round = (v: number) => Math.round(v * 1e6) / 1e6
  return { lat: round(AT.lat + y / 1000), lng: round(AT.lng + x / 1000) }
}
const answer = (...features: Array<{ id: unknown; rings?: number[][][] | null }>) => ({
  features: features.map((f) => ({ attributes: { geo_id: f.id }, geometry: f.rings === null ? null : { rings: f.rings ?? [] } })),
})

describe('which parcels to ask about', () => {
  it('asks for the rows with no point that carry an id, each id once', () => {
    const rows = [
      row({ tcad_id: '0000000001' }),
      row({ tcad_id: '0000000002', latitude: '30.27', longitude: '-97.74' }),
      row({ tcad_id: '0000000001' }),
      row({}),
      row({ tcad_id: '  0000000003 ' }),
      row({ tcad_id: '   ' }),
    ]
    expect(parcelIdsToAsk(TRAVIS_PARCEL_POINTS, rows)).toEqual(['0000000001', '0000000003'])
  })
  it('reads a point as both numbers, never one', () => {
    expect(hasPoint({ lat: 30.27, lng: -97.74 })).toBe(true)
    expect(hasPoint({ lat: 30.27, lng: null })).toBe(false)
    expect(hasPoint({ lat: null, lng: null })).toBe(false)
  })
  it('cuts the ids into the lists one request carries', () => {
    const ids = Array.from({ length: 205 }, (_, i) => String(i).padStart(10, '0'))
    const batches = idBatches(TRAVIS_PARCEL_POINTS, ids)
    expect(batches.map((b) => b.length)).toEqual([100, 100, 5])
    expect(batches.flat()).toEqual(ids)
    expect(idBatches(TRAVIS_PARCEL_POINTS, [])).toEqual([])
  })
})

describe('the question put to Travis County', () => {
  it('asks by geo_id for the shapes, in degrees', () => {
    const q = travisParcelQuery(['0000000001', '0000000002'])
    expect(q.get('where')).toBe("geo_id IN ('0000000001','0000000002')")
    expect(q.get('outFields')).toBe('geo_id')
    expect(q.get('returnGeometry')).toBe('true')
    expect(q.get('outSR')).toBe('4326')
    expect(q.get('f')).toBe('json')
  })
  it('doubles a quote inside an id, and asks for nothing with no ids', () => {
    expect(travisParcelQuery(["00'1"]).get('where')).toBe("geo_id IN ('00''1')")
    expect(travisParcelQuery([]).get('where')).toBe('1 = 0')
  })
  it('is the layer the owner of record is read from, and carries a hundred ids a request', () => {
    expect(TRAVIS_PARCEL_POINTS.queryUrl).toBe(TRAVIS_PARCELS.queryUrl)
    expect(TRAVIS_PARCEL_POINTS.idsPerRequest).toBe(100)
  })
  it('reads the id off the city record the row keeps', () => {
    expect(TRAVIS_PARCEL_POINTS.idOf(row({ tcad_id: '0000000001' }))).toBe('0000000001')
    expect(TRAVIS_PARCEL_POINTS.idOf(row({ tcad_id: 12345 }))).toBe('12345')
    expect(TRAVIS_PARCEL_POINTS.idOf(row({}))).toBeNull()
    expect(TRAVIS_PARCEL_POINTS.idOf(row({ tcad_id: null }))).toBeNull()
  })
})

describe('a point inside a parcel', () => {
  it('is the middle of a plain lot, closed or not', () => {
    expect(pointOfRings([lot([0, 0], [4, 0], [4, 2], [0, 2])])).toEqual(at(2, 1))
    expect(pointOfRings([lot([0, 0], [4, 0], [4, 2], [0, 2], [0, 0])])).toEqual(at(2, 1))
    // Drawn the other way round, as a map layer draws an outline.
    expect(pointOfRings([lot([0, 0], [0, 2], [4, 2], [4, 0], [0, 0])])).toEqual(at(2, 1))
  })
  it('is the middle by area, not the average of the corners', () => {
    // Three corners crowd one end; the lot is still a 4 by 2 box.
    expect(pointOfRings([lot([0, 0], [4, 0], [4, 2], [0, 2], [0, 1.5], [0, 1], [0, 0.5])])).toEqual(at(2, 1))
  })
  it('holds its place on a small lot far from zero', () => {
    // Thirty metres across: summed in whole degrees the middle drifts off the lot.
    const small = [
      [-97.7431, 30.2672],
      [-97.7428, 30.2672],
      [-97.7428, 30.2675],
      [-97.7431, 30.2675],
      [-97.7431, 30.2672],
    ]
    expect(pointOfRings([small])).toEqual({ lat: 30.26735, lng: -97.74295 })
  })
  it('moves onto the lot when a bent lot has its middle outside itself', () => {
    // An L: the middle by area sits in the notch, so the point is the middle of the leg beside it.
    const p = pointOfRings([lot([0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4])])
    expect(p).toEqual(at(0.5, 9.5 / 7))
  })
  it('stays out of a hole', () => {
    const outline = lot([0, 0], [4, 0], [4, 4], [0, 4])
    const hole = lot([1, 1], [1, 3], [3, 3], [3, 1])
    expect(pointOfRings([outline, hole])).toEqual(at(0.5, 2))
  })
  it('takes the biggest ring of a lot in two parts, whichever comes first', () => {
    const sliver = lot([10, 0], [10.2, 0], [10.2, 0.2], [10, 0.2])
    const main = lot([0, 0], [4, 0], [4, 2], [0, 2])
    expect(pointOfRings([sliver, main])).toEqual(at(2, 1))
    expect(pointOfRings([main, sliver])).toEqual(at(2, 1))
  })
  it('gives the average of the corners for a shape with no area', () => {
    expect(pointOfRings([lot([0, 0], [2, 0], [4, 0])])).toEqual(at(2, 0))
  })
  it('gives no point for no shape, a broken shape, or a shape outside Texas', () => {
    expect(pointOfRings([])).toBeNull()
    expect(pointOfRings(null)).toBeNull()
    expect(pointOfRings('rings')).toBeNull()
    expect(pointOfRings([lot([0, 0], [4, 0])])).toBeNull()
    expect(pointOfRings([[['a', 'b'], [1], null]])).toBeNull()
    expect(
      pointOfRings([
        [
          [0, 0],
          [0.001, 0],
          [0.001, 0.001],
          [0, 0.001],
        ],
      ]),
    ).toBeNull()
  })
})

describe("the layer's answer", () => {
  it('gives each parcel its point by id', () => {
    const points = parcelPointsOf(
      answer({ id: '0000000001', rings: [lot([0, 0], [4, 0], [4, 2], [0, 2])] }, { id: '0000000002', rings: [lot([10, 10], [12, 10], [12, 12], [10, 12])] }),
      'geo_id',
    )
    expect([...points.keys()]).toEqual(['0000000001', '0000000002'])
    expect(points.get('0000000001')).toEqual(at(2, 1))
    expect(points.get('0000000002')).toEqual(at(11, 11))
  })
  it('gives one point for an id held under two features, from the bigger shape', () => {
    const points = parcelPointsOf(
      answer({ id: '0000000001', rings: [lot([10, 0], [10.2, 0], [10.2, 0.2], [10, 0.2])] }, { id: '0000000001', rings: [lot([0, 0], [4, 0], [4, 2], [0, 2])] }),
      'geo_id',
    )
    expect(points.size).toBe(1)
    expect(points.get('0000000001')).toEqual(at(2, 1))
  })
  it('passes a feature with no shape or no id', () => {
    const points = parcelPointsOf(answer({ id: '0000000001', rings: null }, { id: '0000000002', rings: [] }, { id: null, rings: [lot([0, 0], [4, 0], [4, 2], [0, 2])] }), 'geo_id')
    expect(points.size).toBe(0)
  })
  it("throws with the layer's words when it refused, and on an answer that is not the layer's", () => {
    expect(() => parcelPointsOf({ error: { code: 400, message: 'Unable to complete operation.' } }, 'geo_id')).toThrow(/Unable to complete operation/)
    expect(() => parcelPointsOf(null, 'geo_id')).toThrow(/refused the read/)
    expect(() => parcelPointsOf({}, 'geo_id')).toThrow(/refused the read/)
    expect(() => TRAVIS_PARCEL_POINTS.pointsOf({ error: { message: 'Invalid query' } })).toThrow(/Invalid query/)
  })
  it('is read by geo_id for Travis', () => {
    expect(TRAVIS_PARCEL_POINTS.pointsOf(answer({ id: '0000000001', rings: [lot([0, 0], [4, 0], [4, 2], [0, 2])] })).get('0000000001')).toEqual(at(2, 1))
  })
})

describe('the rows with their points filled', () => {
  const points = new Map([['0000000001', { lat: 30.251, lng: -97.748 }]])

  it('gives a row with no point its parcel point, and leaves the rest as they came', () => {
    const cameWithPoint = row({ tcad_id: '0000000001', latitude: '30.27', longitude: '-97.74' })
    const takes = row({ tcad_id: '0000000001' })
    const alsoTakes = row({ tcad_id: '0000000001' })
    const notHeld = row({ tcad_id: '0000000002' })
    const noId = row({})
    const out = fillPoints(TRAVIS_PARCEL_POINTS, [cameWithPoint, takes, alsoTakes, notHeld, noId], points, new Set())
    expect(out.filled).toBe(2)
    expect(out.unknown).toEqual([])
    expect(out.settled.map((r) => [r.permit_number, r.lat, r.lng])).toEqual([
      [cameWithPoint.permit_number, 30.27, -97.74],
      [takes.permit_number, 30.251, -97.748],
      [alsoTakes.permit_number, 30.251, -97.748],
      [notHeld.permit_number, null, null],
      [noId.permit_number, null, null],
    ])
    // The row handed in is not written on.
    expect(takes.lat).toBeNull()
  })
  it('sets apart a row whose parcel the layer did not answer for', () => {
    const takes = row({ tcad_id: '0000000001' })
    const notAnswered = row({ tcad_id: '0000000009' })
    const cameWithPoint = row({ tcad_id: '0000000009', latitude: '30.27', longitude: '-97.74' })
    const noId = row({})
    const out = fillPoints(TRAVIS_PARCEL_POINTS, [takes, notAnswered, cameWithPoint, noId], points, new Set(['0000000009']))
    expect(out.filled).toBe(1)
    expect(out.unknown.map((r) => r.permit_number)).toEqual([notAnswered.permit_number])
    expect(out.settled.map((r) => r.permit_number)).toEqual([takes.permit_number, cameWithPoint.permit_number, noId.permit_number])
  })
  it('writes a row whose point is not known without the two point columns', () => {
    const bare = withoutPointColumns(row({ tcad_id: '0000000009' }))
    expect('lat' in bare).toBe(false)
    expect('lng' in bare).toBe(false)
    expect(bare.city).toBe('Austin')
    expect(bare.raw['tcad_id']).toBe('0000000009')
  })
})

describe('which feeds fill a point', () => {
  it("is Austin's, from Travis County, and no other city's", () => {
    expect(AUSTIN_READER.fillPoint).toBe(TRAVIS_PARCEL_POINTS)
    const others = PERMIT_CITIES.flatMap((c) => [...c.feeds]).filter((f) => f.city !== 'Austin')
    expect(others.length).toBeGreaterThan(0)
    expect(others.every((f) => f.fillPoint === undefined)).toBe(true)
  })
})
