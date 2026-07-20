import { describe, expect, it } from 'vitest'
import {
  buildDayTravelGaps,
  estimateTravelBetween,
  haversineMeters,
  straightLineDriveMinutes,
  type LatLng,
  type TravelGapBlock,
} from './jobTravelEstimate'

// Real-ish Texas coordinates for sanity distances.
const SAN_ANTONIO: LatLng = { lat: 29.4241, lng: -98.4936 }
const NEW_BRAUNFELS: LatLng = { lat: 29.703, lng: -98.1245 }
const SAME_SITE_NEIGHBOR: LatLng = { lat: 29.4242, lng: -98.4937 }

describe('haversineMeters', () => {
  it('zero for identical points', () => {
    expect(haversineMeters(SAN_ANTONIO, SAN_ANTONIO)).toBe(0)
  })

  it('San Antonio → New Braunfels is roughly 46km straight-line', () => {
    const m = haversineMeters(SAN_ANTONIO, NEW_BRAUNFELS)
    expect(m).toBeGreaterThan(40000)
    expect(m).toBeLessThan(52000)
  })
})

describe('straightLineDriveMinutes', () => {
  it('same-site distances round to zero', () => {
    expect(straightLineDriveMinutes(0)).toBe(0)
    expect(straightLineDriveMinutes(149)).toBe(0)
  })

  it('scales with distance and rounds up', () => {
    // 10km straight-line → 13km road at 35mph (~939 m/min) → ~14 min
    const min = straightLineDriveMinutes(10000)
    expect(min).toBeGreaterThanOrEqual(13)
    expect(min).toBeLessThanOrEqual(15)
  })
})

describe('estimateTravelBetween', () => {
  it('tags results as straightline (Option B swaps in routed + falls back here)', () => {
    const e = estimateTravelBetween(SAN_ANTONIO, NEW_BRAUNFELS)
    expect(e.source).toBe('straightline')
    expect(e.minutes).toBeGreaterThan(30)
  })
})

describe('buildDayTravelGaps', () => {
  const coords = new Map<string, LatLng>([
    ['jobA', SAN_ANTONIO],
    ['jobB', NEW_BRAUNFELS],
    ['jobC', SAME_SITE_NEIGHBOR],
  ])
  const blk = (blockId: string, jobId: string, startMin: number, endMin: number): TravelGapBlock => ({
    blockId,
    jobId,
    startMin,
    endMin,
  })

  it('emits a gap pair with feasibility from slack vs drive', () => {
    const gaps = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 720, 840)],
      coords,
    )
    expect(gaps).toHaveLength(1)
    const g = gaps[0]!
    expect(g.boundaryKind).toBe('gap')
    expect(g.gapMinutes).toBe(120)
    expect(g.feasible).toBe(true)
  })

  it('flags tight gaps (slack < drive) as infeasible', () => {
    const gaps = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 615, 840)],
      coords,
    )
    expect(gaps[0]!.feasible).toBe(false)
    expect(gaps[0]!.gapMinutes).toBe(15)
  })

  it('touching pairs are never feasible when a drive exists', () => {
    const gaps = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 600, 840)],
      coords,
    )
    expect(gaps[0]!.boundaryKind).toBe('touching')
    expect(gaps[0]!.feasible).toBe(false)
  })

  it('skips same-job pairs, same-site pairs, and pairs missing coordinates', () => {
    expect(
      buildDayTravelGaps([blk('b1', 'jobA', 480, 600), blk('b2', 'jobA', 600, 840)], coords),
    ).toHaveLength(0)
    expect(
      buildDayTravelGaps([blk('b1', 'jobA', 480, 600), blk('b2', 'jobC', 600, 840)], coords),
    ).toHaveLength(0)
    expect(
      buildDayTravelGaps([blk('b1', 'jobA', 480, 600), blk('b2', 'jobX', 600, 840)], coords),
    ).toHaveLength(0)
  })

  it('sorts blocks before pairing', () => {
    const gaps = buildDayTravelGaps(
      [blk('b2', 'jobB', 720, 840), blk('b1', 'jobA', 480, 600)],
      coords,
    )
    expect(gaps[0]!.fromJobId).toBe('jobA')
    expect(gaps[0]!.toJobId).toBe('jobB')
  })

  it('a higher assumed mph shrinks the straight-line estimate', () => {
    const slow = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 720, 840)],
      coords,
      { mph: 20 },
    )
    const fast = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 720, 840)],
      coords,
      { mph: 60 },
    )
    expect(fast[0]!.estimate.minutes).toBeLessThan(slow[0]!.estimate.minutes)
  })

  it('routed estimates win over straight-line, missing pairs fall back', () => {
    const routed = new Map([
      ['jobA|jobB', { minutes: 52, meters: 61000, source: 'routed' as const }],
    ])
    const gaps = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 720, 840)],
      coords,
      { routedByPairKey: routed },
    )
    expect(gaps[0]!.estimate.source).toBe('routed')
    expect(gaps[0]!.estimate.minutes).toBe(52)
    const fallback = buildDayTravelGaps(
      [blk('b1', 'jobA', 480, 600), blk('b2', 'jobB', 720, 840)],
      coords,
      { routedByPairKey: new Map() },
    )
    expect(fallback[0]!.estimate.source).toBe('straightline')
  })
})
