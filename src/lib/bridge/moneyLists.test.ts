import { describe, expect, it } from 'vitest'
import { laterPress, listWindow } from './moneyLists'

const rows = [
  { ymd: '2026-11-10', usd: 2_300 },
  { ymd: '2026-11-13', usd: 7_400 },
  { ymd: '2026-11-24', usd: 12_900 },
  { ymd: '2026-11-25', usd: 5_000 },
  { ymd: '2026-12-11', usd: 7_400 },
]
const k = (n: number): string => `$${(n / 1000).toFixed(1)}k`

describe('listWindow', () => {
  it('shows the next fourteen days and counts what waits after them', () => {
    const w = listWindow(rows, '2026-11-24', false)
    expect(w.shown.map((r) => r.ymd)).toEqual(['2026-11-10', '2026-11-13', '2026-11-24'])
    expect(w.later).toEqual({ count: 2, usd: 12_400 })
    expect(laterPress(w.later, false, k)).toBe('Show the 2 later days, $12.4k')
  })

  it('shows every row once the press is used, and offers the way back', () => {
    const w = listWindow(rows, '2026-11-24', true)
    expect(w.shown.length).toBe(5)
    expect(laterPress(w.later, true, k)).toBe('Show the next 14 days only')
  })

  it('has no press when the fourteen days hold everything', () => {
    const w = listWindow(rows.slice(0, 2), '2026-11-24', false)
    expect(w.later).toEqual({ count: 0, usd: 0 })
    expect(laterPress(w.later, false, k)).toBeNull()
    expect(laterPress({ count: 1, usd: 900 }, false, k)).toBe('Show the 1 later day, $0.9k')
    expect(listWindow([], '2026-11-24', false)).toEqual({ shown: [], later: { count: 0, usd: 0 } })
  })
})
