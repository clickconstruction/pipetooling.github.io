import { describe, expect, it } from 'vitest'
import { fromPlane, lineLengthMeters, toPlane, type PaintedPoint } from './paintedLine'
import {
  PAINT_MAX_MS,
  PAINT_STANDING_MS,
  cleanStroke,
  clockWords,
  isPoorFix,
  isRealStep,
  isRoughFix,
  keptFixes,
  paintingStop,
  spanWords,
  strokeHow,
  strokeMarginMeters,
  type PaintedFix,
} from './paintedTrack'

const ORIGIN: PaintedPoint = { lat: 29.5, lng: -98.2 }
/** A reading so many metres east and north of a made-up spot, with its margin and its second. */
const fix = (eastM: number, northM: number, accuracyM: number | null = 5, second = 0): PaintedFix => ({
  ...fromPlane(ORIGIN, { x: eastM, y: northM }),
  accuracyM,
  atMs: second * 1000,
})

describe('how sure a reading is', () => {
  it('calls a reading past about 65 ft poor, and one with no margin not poor', () => {
    expect(isPoorFix(20)).toBe(false)
    expect(isPoorFix(21)).toBe(true)
    expect(isPoorFix(null)).toBe(false)
  })
  it('calls a margin of half a mile a rough location, not a reading', () => {
    expect(isRoughFix(900)).toBe(false)
    expect(isRoughFix(1500)).toBe(true)
    expect(isRoughFix(null)).toBe(false)
  })
})

describe('isRealStep', () => {
  it('takes the first reading', () => {
    expect(isRealStep(null, fix(0, 0))).toBe(true)
  })
  it('does not take the wobble of a phone lying still', () => {
    expect(isRealStep(fix(0, 0, 5), fix(1.5, 1, 5))).toBe(false)
    expect(isRealStep(fix(0, 0, 5), fix(4, 0, 5))).toBe(false)
    expect(isRealStep(fix(0, 0, 5), fix(5.5, 0, 5))).toBe(true)
    expect(isRealStep(fix(0, 0, 1), fix(2.5, 0, 1))).toBe(false)
    expect(isRealStep(fix(0, 0, 1), fix(3.2, 0, 1))).toBe(true)
  })
  it('asks for a longer step when the phone is less sure', () => {
    expect(isRealStep(fix(0, 0, 30), fix(25, 0, 30))).toBe(false)
    expect(isRealStep(fix(0, 0, 30), fix(31, 0, 30))).toBe(true)
    expect(isRealStep(fix(0, 0, 5), fix(25, 0, 30))).toBe(false)
  })
  it('takes a sure reading at once after an unsure one', () => {
    expect(isRealStep(fix(0, 0, 40), fix(8, 0, 5))).toBe(true)
    expect(isRealStep(fix(0, 0, 40), fix(2, 0, 5))).toBe(false)
  })
  it('never takes a rough location or a broken point', () => {
    expect(isRealStep(fix(0, 0), fix(500, 0, 2000))).toBe(false)
    expect(isRealStep(null, { lat: 0, lng: 0, accuracyM: 5, atMs: 0 })).toBe(false)
  })
})

describe('cleanStroke', () => {
  it('turns a straight walk with a wobble into a straight line of the right length', () => {
    const walk = Array.from({ length: 101 }, (_, i) => fix(i * 1.4, Math.sin(i) * 0.6, 5, i))
    const out = cleanStroke(walk)
    expect(out.poorParts).toEqual([])
    expect(out.points.length).toBeLessThan(6)
    // 100 steps of 1.4 m: 140 m. The cleaned line is within a couple of metres of it, not ten percent long.
    expect(Math.abs(lineLengthMeters(out.points) - 140)).toBeLessThan(4)
    expect(out.startAccuracyM).toBe(5)
    expect(out.endAccuracyM).toBe(5)
  })
  it('draws no knot where the person stood at the start and the end', () => {
    const standing = (east: number, from: number) => Array.from({ length: 30 }, (_, i) => fix(east + Math.cos(i * 2) * 1.5, Math.sin(i * 3) * 1.5, 5, from + i))
    const walk = Array.from({ length: 51 }, (_, i) => fix(i * 2, 0, 5, 30 + i))
    const out = cleanStroke([...standing(0, 0), ...walk, ...standing(100, 81)])
    expect(Math.abs(lineLengthMeters(out.points) - 100)).toBeLessThan(6)
  })
  it('marks a stretch the phone was not sure of, one sure point either side, and leaves it out of the length', () => {
    const sureA = Array.from({ length: 11 }, (_, i) => fix(i * 10, 0, 5, i))
    const poor = [fix(125, 18, 40, 12), fix(150, -22, 45, 14), fix(175, 20, 40, 16)]
    const sureB = Array.from({ length: 11 }, (_, i) => fix(200 + i * 10, 0, 5, 18 + i))
    const out = cleanStroke([...sureA, ...poor, ...sureB])
    expect(out.poorParts).toHaveLength(1)
    const [from, to] = out.poorParts[0]!
    // The part opens on the last sure point before it and closes on the first sure point after it.
    expect(toPlane(ORIGIN, out.points[from]!).x).toBeCloseTo(100, 0)
    expect(toPlane(ORIGIN, out.points[to]!).x).toBeCloseTo(200, 0)
    // Two sure stretches of 100 m each are counted, and the faint 100 m between them is not.
    expect(lineLengthMeters(out.points, out.poorParts)).toBeCloseTo(200, 0)
    expect(lineLengthMeters(out.points)).toBeGreaterThan(300)
  })
  it('marks a stroke that opens unsure from its first point', () => {
    const out = cleanStroke([fix(0, 0, 60, 0), fix(40, 10, 60, 5), fix(80, 0, 5, 10), fix(120, 0, 5, 15)])
    expect(out.poorParts[0]![0]).toBe(0)
    expect(lineLengthMeters(out.points, out.poorParts)).toBeCloseTo(40, 0)
  })
  it('hands back pairs of numbers and nothing of when', () => {
    const out = cleanStroke([fix(0, 0, 5, 100), fix(50, 0, 5, 200)])
    expect(Object.keys(out.points[0]!).sort()).toEqual(['lat', 'lng'])
    expect(JSON.stringify(out.points)).not.toContain('atMs')
  })
  it('makes nothing of one reading or of none', () => {
    expect(cleanStroke([]).points).toEqual([])
    expect(cleanStroke([fix(0, 0)]).points).toHaveLength(1)
    expect(keptFixes([fix(0, 0), fix(0.5, 0.5), fix(1, 0)])).toHaveLength(1)
  })
})

describe('strokeHow', () => {
  it('calls a walk a walk, even with a stop in it', () => {
    const walk = Array.from({ length: 40 }, (_, i) => fix(i * 4, 0, 5, i * 3))
    expect(strokeHow(walk)).toBe('walked')
  })
  it('calls a drive a drive, even with a wait at a gate', () => {
    const drive = [fix(0, 0, 5, 0), fix(4, 0, 5, 60), ...Array.from({ length: 40 }, (_, i) => fix(10 + i * 25, 0, 5, 62 + i * 2))]
    expect(strokeHow(drive)).toBe('driven')
  })
  it('calls one reading a walk', () => {
    expect(strokeHow([fix(0, 0)])).toBe('walked')
  })
})

describe('strokeMarginMeters', () => {
  it('is a few feet for a line drawn by hand, whatever its length', () => {
    expect(strokeMarginMeters({ how: 'drawn', lengthM: 15 })).toBeCloseTo(2.12, 1)
    expect(strokeMarginMeters({ how: 'drawn', lengthM: 1500 })).toBeCloseTo(2.12, 1)
  })
  it('is tens of feet for a walked line under open sky', () => {
    // 5 m at each end, widened by half, plus 2 in 100 of 150 m: about 13.6 m, some 45 ft.
    expect(strokeMarginMeters({ how: 'walked', lengthM: 150, startAccuracyM: 5, endAccuracyM: 5 })).toBeCloseTo(13.6, 0)
  })
  it('grows with a poor reading at an end', () => {
    const open = strokeMarginMeters({ how: 'walked', lengthM: 150, startAccuracyM: 5, endAccuracyM: 5 })
    const wall = strokeMarginMeters({ how: 'walked', lengthM: 150, startAccuracyM: 5, endAccuracyM: 18 })
    expect(wall).toBeGreaterThan(open * 1.8)
  })
  it('takes the usual margin when the phone gave none', () => {
    expect(strokeMarginMeters({ how: 'driven', lengthM: 0 })).toBeCloseTo(Math.hypot(5, 5) * 1.5, 1)
  })
})

describe('paintingStop', () => {
  it('goes on while the person moves', () => {
    expect(paintingStop({ startedAtMs: 0, lastStepAtMs: 60_000, nowMs: 90_000 })).toBe('go')
  })
  it('pauses after five minutes with no real step', () => {
    expect(paintingStop({ startedAtMs: 0, lastStepAtMs: 60_000, nowMs: 60_000 + PAINT_STANDING_MS })).toBe('standing')
  })
  it('ends after an hour, moving or not', () => {
    expect(paintingStop({ startedAtMs: 0, lastStepAtMs: PAINT_MAX_MS - 1000, nowMs: PAINT_MAX_MS })).toBe('time')
  })
})

describe('the words for a span of time', () => {
  it('says seconds, minutes and hours', () => {
    expect(spanWords(45_000)).toBe('45 seconds')
    expect(spanWords(1_000)).toBe('1 second')
    expect(spanWords(120_000)).toBe('2 minutes')
    expect(spanWords(60_000)).toBe('1 minute')
    expect(spanWords(3_600_000)).toBe('1 hour')
  })
  it('runs the clock on the bar', () => {
    expect(clockWords(134_000)).toBe('2:14')
    expect(clockWords(5_000)).toBe('0:05')
    expect(clockWords(-3)).toBe('0:00')
  })
})
