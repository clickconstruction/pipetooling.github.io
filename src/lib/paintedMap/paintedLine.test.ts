import { describe, expect, it } from 'vitest'
import {
  boundsOfPoints,
  fromPlane,
  isPaintedPoint,
  legLengthsMeters,
  lineLengthMeters,
  lineRuns,
  metersPerPixel,
  nearestOnLine,
  partsAfterReplace,
  partsFromJson,
  pointAlongLine,
  pointsFromJson,
  pointsToJson,
  replaceStretch,
  simplifyLine,
  snapTarget,
  toPlane,
  trimLine,
  type PaintedPoint,
} from './paintedLine'

/** A made-up spot. Every point in these tests is so many metres east and north of it. */
const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
const at = (eastM: number, northM: number): PaintedPoint => fromPlane(ORIGIN, { x: eastM, y: northM })

describe('isPaintedPoint', () => {
  it('takes a point on the globe and refuses anything else', () => {
    expect(isPaintedPoint({ lat: 29.5, lng: -98.2 })).toBe(true)
    expect(isPaintedPoint({ lat: 0, lng: 0 })).toBe(false)
    expect(isPaintedPoint({ lat: 91, lng: 0 })).toBe(false)
    expect(isPaintedPoint({ lat: 29.5, lng: Number.NaN })).toBe(false)
    expect(isPaintedPoint({ lat: '29.5', lng: -98.2 })).toBe(false)
    expect(isPaintedPoint(null)).toBe(false)
  })
})

describe('the plane', () => {
  it('goes out and comes back to the same point', () => {
    const p = at(120, -45)
    const flat = toPlane(ORIGIN, p)
    expect(flat.x).toBeCloseTo(120, 6)
    expect(flat.y).toBeCloseTo(-45, 6)
  })
})

describe('lineLengthMeters', () => {
  it('adds up the legs', () => {
    expect(lineLengthMeters([at(0, 0), at(100, 0), at(100, 50)])).toBeCloseTo(150, 0)
    expect(legLengthsMeters([at(0, 0), at(100, 0), at(100, 50)]).map((m) => Math.round(m))).toEqual([100, 50])
  })
  it('is nothing for a point alone', () => {
    expect(lineLengthMeters([at(0, 0)])).toBe(0)
    expect(lineLengthMeters([])).toBe(0)
  })
  it('leaves out the legs of a part it is told to leave out, and no others', () => {
    const line = [at(0, 0), at(100, 0), at(200, 0), at(300, 0), at(400, 0)]
    // points 1 to 3 are a faint part: two legs of 100 m each.
    expect(lineLengthMeters(line, [[1, 3]])).toBeCloseTo(200, 0)
  })
})

describe('lineRuns', () => {
  const line = [at(0, 0), at(100, 0), at(200, 0), at(300, 0), at(400, 0)]
  it('is one sure run for a line with nothing faint', () => {
    const runs = lineRuns(line)
    expect(runs.sure).toHaveLength(1)
    expect(runs.sure[0]).toHaveLength(5)
    expect(runs.poor).toEqual([])
  })
  it('splits at a faint part and shares the point where they meet', () => {
    const runs = lineRuns(line, [[1, 3]])
    expect(runs.sure.map((r) => r.length)).toEqual([2, 2])
    expect(runs.poor.map((r) => r.length)).toEqual([3])
    expect(runs.poor[0]![0]).toEqual(line[1])
    expect(runs.sure[1]![0]).toEqual(line[3])
  })
  it('draws nothing for a point alone', () => {
    expect(lineRuns([at(0, 0)])).toEqual({ sure: [], poor: [] })
  })
})

describe('metersPerPixel', () => {
  it('halves with each zoom step and shrinks toward the poles', () => {
    expect(metersPerPixel(18, 0)).toBeCloseTo(0.597, 2)
    expect(metersPerPixel(19, 0)).toBeCloseTo(metersPerPixel(18, 0) / 2, 6)
    expect(metersPerPixel(18, 29.5)).toBeLessThan(metersPerPixel(18, 0))
  })
})

describe('simplifyLine', () => {
  it('drops a point that stands within the tolerance of the straight run', () => {
    const out = simplifyLine([at(0, 0), at(50, 0.4), at(100, 0)], 1.5)
    expect(out).toHaveLength(2)
  })
  it('keeps a real corner', () => {
    const out = simplifyLine([at(0, 0), at(50, 0.2), at(100, 0), at(100, 60)], 1.5)
    expect(out).toHaveLength(3)
    expect(lineLengthMeters(out)).toBeCloseTo(160, 0)
  })
  it('always keeps both ends, and a long walk does not run it out of room', () => {
    const walk = Array.from({ length: 4000 }, (_, i) => at(i, Math.sin(i / 3) * 0.3))
    const out = simplifyLine(walk, 1.5)
    expect(out[0]).toEqual(walk[0])
    expect(out[out.length - 1]).toEqual(walk[walk.length - 1])
    expect(out.length).toBeLessThan(20)
  })
  it('hands back a short line as it is', () => {
    expect(simplifyLine([at(0, 0), at(5, 0)], 1.5)).toHaveLength(2)
  })
})

describe('nearestOnLine', () => {
  const line = [at(0, 0), at(100, 0), at(100, 100)]
  it('finds the spot on the line, how far off, and how far along', () => {
    const hit = nearestOnLine(line, at(40, 7))!
    expect(hit.distanceM).toBeCloseTo(7, 1)
    expect(hit.leg).toBe(0)
    expect(hit.alongM).toBeCloseTo(40, 0)
  })
  it('counts along the legs before it', () => {
    const hit = nearestOnLine(line, at(108, 30))!
    expect(hit.leg).toBe(1)
    expect(hit.alongM).toBeCloseTo(130, 0)
    expect(hit.distanceM).toBeCloseTo(8, 1)
  })
  it('holds to an end when the point is past it', () => {
    const hit = nearestOnLine(line, at(-30, 0))!
    expect(hit.alongM).toBeCloseTo(0, 5)
    expect(hit.distanceM).toBeCloseTo(30, 0)
  })
  it('has no answer for a line with no leg', () => {
    expect(nearestOnLine([at(0, 0)], at(1, 1))).toBeNull()
  })
})

describe('trimLine', () => {
  const line = [at(0, 0), at(100, 0), at(100, 100)]
  it('cuts both ends and lands on the cuts', () => {
    const out = trimLine(line, 20, 150)
    expect(lineLengthMeters(out)).toBeCloseTo(130, 0)
    expect(toPlane(ORIGIN, out[0]!).x).toBeCloseTo(20, 0)
    expect(toPlane(ORIGIN, out[out.length - 1]!).y).toBeCloseTo(50, 0)
    expect(out).toHaveLength(3)
  })
  it('takes the two cuts in either order and never runs past the line', () => {
    expect(lineLengthMeters(trimLine(line, 150, 20))).toBeCloseTo(130, 0)
    expect(lineLengthMeters(trimLine(line, -50, 9999))).toBeCloseTo(200, 0)
  })
  it('finds the point a distance along', () => {
    expect(toPlane(ORIGIN, pointAlongLine(line, 130)!).y).toBeCloseTo(30, 0)
    expect(pointAlongLine([], 5)).toBeNull()
  })
})

describe('replaceStretch', () => {
  it('swaps the points between two corners for the ones drawn by hand', () => {
    const line = [at(0, 0), at(50, 0), at(60, 30), at(70, -20), at(100, 0), at(150, 0)]
    const out = replaceStretch(line, 1, 4, [at(75, 2)])
    expect(out).toHaveLength(5)
    expect(toPlane(ORIGIN, out[2]!).x).toBeCloseTo(75, 0)
    expect(out[1]).toEqual(line[1])
    expect(out[3]).toEqual(line[4])
    expect(out[4]).toEqual(line[5])
  })
  it('moves the faint parts after it and drops the one it replaced', () => {
    // [1,4] was redrawn: its two inner points gave way to one, so a later part [5,7] moves back by one.
    expect(partsAfterReplace([[1, 4], [5, 7]], 1, 4, 1)).toEqual([[4, 6]])
    expect(partsAfterReplace([[0, 1], [3, 6]], 3, 6, 4)).toEqual([[0, 1]])
  })
})

describe('snapTarget', () => {
  const targets = [
    { id: 'gate', label: 'Truck gate', ...at(0, 0) },
    { id: 'meter', label: 'Meter', ...at(40, 0) },
  ]
  it('catches the nearest target inside the reach', () => {
    expect(snapTarget(at(1, 2), targets, 3.5)?.id).toBe('gate')
    expect(snapTarget(at(38.5, 0), targets, 3.5)?.id).toBe('meter')
  })
  it('catches nothing outside it', () => {
    expect(snapTarget(at(10, 0), targets, 3.5)).toBeNull()
    expect(snapTarget(at(1, 1), [], 3.5)).toBeNull()
  })
})

describe('boundsOfPoints', () => {
  it('holds every point and skips what is not one', () => {
    const b = boundsOfPoints([at(0, 0), at(100, 50), { lat: 0, lng: 0 }])!
    expect(b.south).toBeCloseTo(ORIGIN.lat, 9)
    expect(b.north).toBeGreaterThan(b.south)
    expect(b.east).toBeGreaterThan(b.west)
    expect(boundsOfPoints([])).toBeNull()
  })
})

describe('the stored shape', () => {
  it('writes pairs of numbers to six decimals and nothing else', () => {
    const fix = { lat: 29.50000049, lng: -98.20000051, accuracyM: 6, atMs: 1700000000000 }
    const json = pointsToJson([fix, at(10, 10)])
    expect(json[0]).toEqual([29.5, -98.200001])
    expect(JSON.stringify(json)).not.toContain('17000')
    expect(Object.keys(json[0]!)).toEqual(['0', '1'])
  })
  it('reads pairs back and skips anything that is not a point', () => {
    expect(pointsFromJson([[29.5, -98.2], ['x', 1], [0, 0], [29.6, -98.3, 12]])).toEqual([
      { lat: 29.5, lng: -98.2 },
      { lat: 29.6, lng: -98.3 },
    ])
    expect(pointsFromJson({ a: 1 })).toEqual([])
    expect(pointsFromJson(null)).toEqual([])
  })
  it('reads faint parts back only when they sit inside the line', () => {
    expect(partsFromJson([[3, 5], [0, 1], [4, 4], [7, 99], ['a', 2], [2.5, 3]], 8)).toEqual([[0, 1], [3, 5]])
    expect(partsFromJson('nope', 8)).toEqual([])
  })
})
