import { describe, expect, it } from 'vitest'
import { monthEnd, monthShift, monthStart, windowsAxis } from './lienWindowsAxis'

describe('lienWindowsAxis (v2.4652)', () => {
  it('month helpers', () => {
    expect(monthStart('2026-10-06')).toBe('2026-10-01')
    expect(monthEnd('2026-10-06')).toBe('2026-10-31')
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
    expect(monthShift('2026-10-06', 1)).toBe('2026-11-01')
    expect(monthShift('2026-01-15', -1)).toBe('2025-12-01')
    expect(monthShift('2026-12-15', 1)).toBe('2027-01-01')
  })

  it('a story with no bars is never one month: a month of air on each side of today', () => {
    const a = windowsAxis('2026-10-06', [])
    expect(a.first).toBe('2026-09-01')
    expect(a.last).toBe('2026-11-30')
    expect(a.ticks).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
  })

  it('a closed window behind today widens the axis back to its first day', () => {
    const a = windowsAxis('2026-10-06', [{ start: '2026-08-01', end: '2026-09-15' }])
    expect(a.first).toBe('2026-08-01')
    expect(a.last).toBe('2026-10-31')
    expect(a.ticks.length).toBe(3)
  })

  it('a long story is drawn whole, no padding', () => {
    const a = windowsAxis('2026-09-24', [
      { start: '2026-04-01', end: '2026-06-15' },
      { start: '2026-09-24', end: '2026-12-15' },
    ])
    expect(a.first).toBe('2026-04-01')
    expect(a.last).toBe('2026-12-31')
    expect(a.ticks.length).toBe(9)
  })

  it('two months of story still get the air', () => {
    const a = windowsAxis('2026-10-06', [{ start: '2026-10-01', end: '2026-11-16' }])
    expect(a.ticks.map((t) => t.slice(5, 7))).toEqual(['09', '10', '11', '12'])
  })
})
