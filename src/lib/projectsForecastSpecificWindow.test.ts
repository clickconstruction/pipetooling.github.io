import { describe, expect, it } from 'vitest'

import {
  FORECAST_SPECIFIC_DEFAULT_BACK_DAYS,
  FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS,
  FORECAST_SPECIFIC_EXTEND_DAYS,
  computeForecastSpecificDefaultWindow,
  computeForecastSpecificEffectiveWindow,
  extendForecastSpecificWindowLeft,
  extendForecastSpecificWindowRight,
} from './projectsForecastSpecificWindow'

// Pick a fixed "today" that doesn't cross a DST boundary in either direction so the
// arithmetic stays trivial and the test is environment-independent. Mid-May avoids
// both US DST flips (March/November).
const TODAY = '2026-05-19'

describe('computeForecastSpecificDefaultWindow', () => {
  it('returns a symmetric window of DEFAULT_BACK_DAYS + 1 + DEFAULT_FORWARD_DAYS days centered on today', () => {
    const w = computeForecastSpecificDefaultWindow(TODAY)
    expect(w).toEqual({ startYmd: '2026-02-18', endYmd: '2026-08-17' })
  })

  it('defaults match the documented 90/90 anchors so the constants drive both math and copy', () => {
    expect(FORECAST_SPECIFIC_DEFAULT_BACK_DAYS).toBe(90)
    expect(FORECAST_SPECIFIC_DEFAULT_FORWARD_DAYS).toBe(90)
    expect(FORECAST_SPECIFIC_EXTEND_DAYS).toBe(90)
  })
})

describe('computeForecastSpecificEffectiveWindow', () => {
  it('with no overrides matches the default window', () => {
    expect(computeForecastSpecificEffectiveWindow(TODAY, null, null)).toEqual(
      computeForecastSpecificDefaultWindow(TODAY),
    )
  })

  it('extends the LEFT edge only when extendedLeftYmd is earlier than the default start', () => {
    const w = computeForecastSpecificEffectiveWindow(TODAY, '2025-11-20', null)
    expect(w).toEqual({ startYmd: '2025-11-20', endYmd: '2026-08-17' })
  })

  it('extends the RIGHT edge only when extendedRightYmd is later than the default end', () => {
    const w = computeForecastSpecificEffectiveWindow(TODAY, null, '2026-11-15')
    expect(w).toEqual({ startYmd: '2026-02-18', endYmd: '2026-11-15' })
  })

  it('applies both overrides independently when each is wider than its default edge', () => {
    const w = computeForecastSpecificEffectiveWindow(TODAY, '2025-11-20', '2026-11-15')
    expect(w).toEqual({ startYmd: '2025-11-20', endYmd: '2026-11-15' })
  })

  it('only-grow guard: ignores a LEFT override that would shrink the window', () => {
    // extendedLeftYmd later than default startYmd → should be ignored
    const w = computeForecastSpecificEffectiveWindow(TODAY, '2026-04-01', null)
    expect(w.startYmd).toBe('2026-02-18')
  })

  it('only-grow guard: ignores a RIGHT override that would shrink the window', () => {
    const w = computeForecastSpecificEffectiveWindow(TODAY, null, '2026-06-01')
    expect(w.endYmd).toBe('2026-08-17')
  })
})

describe('extendForecastSpecificWindowLeft / Right', () => {
  it('extendLeft once moves the start back by EXTEND_DAYS', () => {
    const def = computeForecastSpecificDefaultWindow(TODAY)
    const next = extendForecastSpecificWindowLeft(def.startYmd)
    expect(next).toBe('2025-11-20')
  })

  it('extendLeft twice composes (each click extends by EXTEND_DAYS more)', () => {
    const def = computeForecastSpecificDefaultWindow(TODAY)
    const once = extendForecastSpecificWindowLeft(def.startYmd)
    const twice = extendForecastSpecificWindowLeft(once)
    expect(twice).toBe('2025-08-22')
  })

  it('extendRight once moves the end forward by EXTEND_DAYS', () => {
    const def = computeForecastSpecificDefaultWindow(TODAY)
    const next = extendForecastSpecificWindowRight(def.endYmd)
    expect(next).toBe('2026-11-15')
  })

  it('extendRight twice composes', () => {
    const def = computeForecastSpecificDefaultWindow(TODAY)
    const once = extendForecastSpecificWindowRight(def.endYmd)
    const twice = extendForecastSpecificWindowRight(once)
    expect(twice).toBe('2027-02-13')
  })

  it('chained extends feed back through the effective window unchanged', () => {
    const def = computeForecastSpecificDefaultWindow(TODAY)
    const left2 = extendForecastSpecificWindowLeft(
      extendForecastSpecificWindowLeft(def.startYmd),
    )
    const right2 = extendForecastSpecificWindowRight(
      extendForecastSpecificWindowRight(def.endYmd),
    )
    expect(computeForecastSpecificEffectiveWindow(TODAY, left2, right2)).toEqual({
      startYmd: left2,
      endYmd: right2,
    })
  })
})
