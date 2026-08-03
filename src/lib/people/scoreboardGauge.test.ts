import { describe, expect, it } from 'vitest'
import {
  gaugeBand,
  gaugeBandSegments,
  gaugeDistanceToGreen,
  gaugeNeedleTopPct,
  greenWeekCount,
  type GaugeConfig,
} from './scoreboardGauge'

/** The demo profit-ratio gauge: 0.5×–1.5×, red < 1.0, yellow 1.0–1.2, green ≥ 1.2. */
const PROFIT: GaugeConfig = { min: 0.5, max: 1.5, redBelow: 1.0, greenAbove: 1.2, direction: 'higher' }
/** The demo office-per-field gauge: 0–50%, green ≤ 25, yellow 25–40, red > 40. */
const OFFICE: GaugeConfig = { min: 0, max: 50, redBelow: 40, greenAbove: 25, direction: 'lower' }

describe('gaugeBand', () => {
  it('higher-is-better: green at/above greenAbove, red below redBelow', () => {
    expect(gaugeBand(1.35, PROFIT)).toBe('green')
    expect(gaugeBand(1.2, PROFIT)).toBe('green')
    expect(gaugeBand(1.1, PROFIT)).toBe('yellow')
    expect(gaugeBand(1.0, PROFIT)).toBe('yellow')
    expect(gaugeBand(0.94, PROFIT)).toBe('red')
  })
  it('lower-is-better: green at/below greenAbove, red above redBelow', () => {
    expect(gaugeBand(19, OFFICE)).toBe('green')
    expect(gaugeBand(25, OFFICE)).toBe('green')
    expect(gaugeBand(31, OFFICE)).toBe('yellow')
    expect(gaugeBand(40, OFFICE)).toBe('yellow')
    expect(gaugeBand(46, OFFICE)).toBe('red')
  })
})

describe('gaugeNeedleTopPct', () => {
  it('max renders at the top, min at the bottom, midpoint centered', () => {
    expect(gaugeNeedleTopPct(1.5, PROFIT)).toBe(0)
    expect(gaugeNeedleTopPct(0.5, PROFIT)).toBe(100)
    expect(gaugeNeedleTopPct(1.0, PROFIT)).toBe(50)
  })
  it('clamps out-of-scale values', () => {
    expect(gaugeNeedleTopPct(2.4, PROFIT)).toBe(0)
    expect(gaugeNeedleTopPct(-1, OFFICE)).toBe(100)
  })
  it('degenerate scale centers rather than dividing by zero', () => {
    expect(gaugeNeedleTopPct(1, { ...PROFIT, min: 1, max: 1 })).toBe(50)
  })
})

describe('gaugeBandSegments', () => {
  it('higher: green on top, segments tile the bar exactly', () => {
    const segs = gaugeBandSegments(PROFIT)
    expect(segs.map((s) => s.band)).toEqual(['green', 'yellow', 'red'])
    expect(segs[0]).toEqual({ topPct: 0, heightPct: 30.000000000000004, band: 'green' })
    const total = segs.reduce((s, x) => s + x.heightPct, 0)
    expect(total).toBeCloseTo(100)
  })
  it('lower: red on top, green at bottom', () => {
    const segs = gaugeBandSegments(OFFICE)
    expect(segs.map((s) => s.band)).toEqual(['red', 'yellow', 'green'])
    expect(segs[0]?.topPct).toBe(0)
    expect(segs[2]?.heightPct).toBeCloseTo(50)
    expect(segs.reduce((s, x) => s + x.heightPct, 0)).toBeCloseTo(100)
  })
  it('segment edges land where the needle would for the boundary values', () => {
    const segs = gaugeBandSegments(PROFIT)
    expect(segs[1]?.topPct).toBeCloseTo(gaugeNeedleTopPct(1.2, PROFIT))
    expect(segs[2]?.topPct).toBeCloseTo(gaugeNeedleTopPct(1.0, PROFIT))
  })
})

describe('gaugeDistanceToGreen', () => {
  it('zero when already green; gap to the green boundary otherwise', () => {
    expect(gaugeDistanceToGreen(1.35, PROFIT)).toBe(0)
    expect(gaugeDistanceToGreen(1.18, PROFIT)).toBeCloseTo(0.02)
    expect(gaugeDistanceToGreen(31, OFFICE)).toBe(6)
  })
})

describe('greenWeekCount', () => {
  it('counts green weeks', () => {
    expect(greenWeekCount(['green', 'yellow', 'green', 'red'])).toEqual({ green: 2, total: 4 })
    expect(greenWeekCount([])).toEqual({ green: 0, total: 0 })
  })
})
