import { describe, expect, it } from 'vitest'
import {
  buildOverheadLensSeries,
  overheadLensRateWithExtraDenominator,
  overheadLensSensitivity,
} from './overheadLensSeries'

const map = (rows: Array<[string, number]>) => new Map(rows)

describe('buildOverheadLensSeries', () => {
  it('bins 7-day weeks back from the window end, oldest bin short, each rate = bin pool ÷ bin denominator', () => {
    // 10-day window: bins are [d1..d3] (3 days) and [d4..d10] (7 days).
    const pool = map([['2026-09-01', 100], ['2026-09-05', 700]])
    const den = map([['2026-09-02', 10], ['2026-09-08', 35]])
    const s = buildOverheadLensSeries({ poolUsdByDay: pool, denominatorByDay: den, startYmd: '2026-09-01', endYmd: '2026-09-10' })
    expect(s.weeks).toHaveLength(2)
    expect(s.weeks[0]).toMatchObject({ startYmd: '2026-09-01', endYmd: '2026-09-03', days: 3, poolUsd: 100, denominator: 10, rate: 10 })
    expect(s.weeks[1]).toMatchObject({ startYmd: '2026-09-04', endYmd: '2026-09-10', days: 7, poolUsd: 700, denominator: 35, rate: 20 })
  })

  it('a 90-day window yields 12 full weeks plus a 6-day head', () => {
    const s = buildOverheadLensSeries({ poolUsdByDay: new Map(), denominatorByDay: new Map(), startYmd: '2026-06-05', endYmd: '2026-09-02' })
    expect(s.weeks).toHaveLength(13)
    expect(s.weeks[0]?.days).toBe(6)
    expect(s.weeks.slice(1).every((w) => w.days === 7)).toBe(true)
    expect(s.weeks[12]?.endYmd).toBe('2026-09-02')
    expect(s.weeks.every((w) => w.rate === null)).toBe(true)
  })

  it('rolling rate uses the trailing span and is null until the denominator is positive', () => {
    const pool = map([['2026-09-01', 50], ['2026-09-02', 50], ['2026-09-03', 50]])
    const den = map([['2026-09-02', 5], ['2026-09-03', 5]])
    const s = buildOverheadLensSeries({ poolUsdByDay: pool, denominatorByDay: den, startYmd: '2026-09-01', endYmd: '2026-09-03', rollingDays: 2 })
    expect(s.rolling.map((r) => r.rate)).toEqual([null, 20, 10]) // d2: (50+50)/5 · d3: (50+50)/(5+5)
    expect(s.rollingDays).toBe(2)
  })

  it('tolerates an inverted window', () => {
    const s = buildOverheadLensSeries({ poolUsdByDay: new Map(), denominatorByDay: new Map(), startYmd: '2026-09-05', endYmd: '2026-09-01' })
    expect(s.weeks).toEqual([])
    expect(s.rolling).toEqual([])
  })
})

describe('sensitivity + what-if', () => {
  it('partial derivatives at the current point', () => {
    const s = overheadLensSensitivity(39374, 2736)
    expect(s.perPoolDollar).toBeCloseTo(1 / 2736)
    expect(s.perDenominatorUnit).toBeCloseTo(-39374 / (2736 * 2736))
    expect(overheadLensSensitivity(100, 0)).toEqual({ perDenominatorUnit: null, perPoolDollar: null })
  })

  it('rate with extra denominator (pending hours approved, pool unchanged)', () => {
    expect(overheadLensRateWithExtraDenominator(39374, 2736, 611)).toBeCloseTo(39374 / 3347)
    expect(overheadLensRateWithExtraDenominator(39374, 0, 0)).toBeNull()
  })
})
