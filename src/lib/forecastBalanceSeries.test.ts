import { describe, expect, it } from 'vitest'
import { buildForecastBalanceSeries } from './forecastBalanceSeries'

const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']

describe('buildForecastBalanceSeries', () => {
  it('accumulates day by day, applying same-day events at end of day', () => {
    const s = buildForecastBalanceSeries(days, [
      { ymd: '2026-08-01', delta: -38120 },
      { ymd: '2026-08-02', delta: 151000 },
    ])
    expect(s.values).toEqual([-38120, 112880, 112880, 112880])
    expect(s.min).toBe(-38120)
    expect(s.max).toBe(112880)
    expect(s.final).toBe(112880)
  })

  it('folds events before the window into the initial balance', () => {
    const s = buildForecastBalanceSeries(days, [
      { ymd: '2026-07-01', delta: 500 },
      { ymd: '2026-08-01', delta: -200 },
    ])
    expect(s.initial).toBe(500)
    expect(s.values).toEqual([300, 300, 300, 300])
  })

  it('events past the window count toward final but not the drawn series', () => {
    const s = buildForecastBalanceSeries(days, [
      { ymd: '2026-08-02', delta: 100 },
      { ymd: '2026-12-25', delta: 900 },
    ])
    expect(s.values).toEqual([0, 100, 100, 100])
    expect(s.final).toBe(1000)
  })

  it('merges multiple same-day deltas and handles empty inputs', () => {
    const s = buildForecastBalanceSeries(days, [
      { ymd: '2026-08-03', delta: 40 },
      { ymd: '2026-08-03', delta: -15 },
    ])
    expect(s.values).toEqual([0, 0, 25, 25])
    expect(buildForecastBalanceSeries([], []).values).toEqual([])
    expect(buildForecastBalanceSeries(days, []).values).toEqual([0, 0, 0, 0])
  })
})
