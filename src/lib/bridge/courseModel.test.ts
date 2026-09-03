import { describe, expect, it } from 'vitest'
import { bidWinLever, buildCourseModel } from './courseModel'

const m = (rows: Array<[string, number]>) => new Map(rows)

describe('buildCourseModel', () => {
  const base = {
    todayYmd: '2026-09-03',
    daysBack: 3,
    daysAhead: 4,
    earnedByDay: m([['2026-08-31', 1000], ['2026-09-01', 1000], ['2026-09-02', 1000], ['2026-09-03', 1000]]),
    directByDay: m([['2026-08-31', 400], ['2026-09-02', 400]]),
    overheadByDay: m([['2026-08-31', 100], ['2026-09-01', 100], ['2026-09-02', 100], ['2026-09-03', 100]]),
    speedDays: 4,
    targetUsd: null,
  }

  it('builds the cumulative track and trailing speed', () => {
    const c = buildCourseModel(base)
    expect(c.track.map((d) => d.cumulativeUsd)).toEqual([500, 1400, 1900, 2800])
    expect(c.speed).toEqual({ days: 4, earnedPerDay: 1000, directPerDay: 200, overheadPerDay: 100, burnPerDay: 300, climbPerDay: 700 })
    expect(c.contributionMargin).toBeCloseTo(0.8)
  })

  it('projects at the climb rate; no target → no verdict', () => {
    const c = buildCourseModel(base)
    expect(c.projection.map((p) => p.cumulativeUsd)).toEqual([3500, 4200, 4900, 5600])
    expect(c.endUsd).toBe(5600)
    expect(c.verdict).toEqual({ kind: 'no-target', gapUsd: null, underwaterDays: 0 })
  })

  it('a target is measured from the track end; levers bend the projection', () => {
    const makes = buildCourseModel({ ...base, targetUsd: 2000 })
    expect(makes.targetEndUsd).toBe(4800)
    expect(makes.verdict).toEqual({ kind: 'makes', gapUsd: 800, underwaterDays: 0 })
    const misses = buildCourseModel({ ...base, targetUsd: 5000 })
    expect(misses.verdict.kind).toBe('misses')
    expect(misses.verdict.gapUsd).toBe(-2200)
    const bent = buildCourseModel({ ...base, targetUsd: 5000, levers: [{ key: 'x', label: 'x', ratePerDay: 500, fromOffset: 2 }, { key: 'y', label: 'y', onceUsd: 1000 }] })
    expect(bent.projection.map((p) => p.cumulativeUsd)).toEqual([4500, 5700, 6900, 8100])
    expect(bent.verdict.kind).toBe('makes')
  })

  it('counts underwater days on a sinking projection', () => {
    const c = buildCourseModel({ ...base, earnedByDay: new Map(), targetUsd: 0 })
    expect(c.speed.climbPerDay).toBe(-300)
    expect(c.verdict.underwaterDays).toBe(4)
  })
})

describe('bidWinLever', () => {
  it('spreads contract × margin over the duration from the start offset', () => {
    const l = bidWinLever({ key: 'b', label: 'Win', bidValueUsd: 60000, contributionMargin: 0.3, startOffset: 10, durationDays: 60 })
    expect(l).toEqual({ key: 'b', label: 'Win', ratePerDay: 300, fromOffset: 10 })
    expect(bidWinLever({ key: 'b', label: 'Win', bidValueUsd: 60000, contributionMargin: null, startOffset: 1 })).toBeNull()
  })
})
