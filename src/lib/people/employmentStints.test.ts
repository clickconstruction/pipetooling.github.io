import { describe, expect, it } from 'vitest'
import { earlierStintsLine, inAnyStint, spanWords, stintRange, stintRows, tenureLabel } from './employmentStints'

const TWO = [
  { start_date: '2024-03-04', end_date: '2026-11-03' },
  { start_date: '2029-11-05', end_date: null },
]

describe('tenure and spans', () => {
  it('tenure counts from the day back (call 1)', () => {
    expect(tenureLabel('2029-11-05', '2030-06-05')).toBe('7m')
    expect(tenureLabel('2024-03-04', '2026-11-03')).toBe('2y 8m')
    expect(tenureLabel(null, '2026-11-04')).toBe('')
    expect(tenureLabel('2027-01-01', '2026-11-04')).toBe('')
  })

  it('words a closed stint in years and months', () => {
    expect(spanWords('2024-03-04', '2026-11-03')).toBe('2 years 7 months')
    expect(spanWords('2024-03-04', '2026-11-04')).toBe('2 years 8 months')
    expect(spanWords('2026-01-01', '2026-11-30')).toBe('10 months')
    expect(spanWords('2026-11-01', '2026-11-20')).toBe('under a month')
  })
})

describe('stintRows', () => {
  it("draws the mock-up's three lines, newest first, with the away gap between", () => {
    const rows = stintRows(TWO, '2029-11-06')
    expect(rows.map((r) => [r.kind, stintRange(r), r.words, r.current])).toEqual([
      ['stint', 'Nov 5, 2029 → present', 'this stint', true],
      ['away', 'Nov 4, 2026 → Nov 4, 2029', 'away 3 years', false],
      ['stint', 'Mar 4, 2024 → Nov 3, 2026', '2 years 7 months', false],
    ])
  })

  it('one stint draws nothing: the pair says it already', () => {
    expect(stintRows([TWO[0]!], '2026-11-04')).toEqual([])
    expect(stintRows([], '2026-11-04')).toEqual([])
  })

  it('a same-day bench and back has no away line', () => {
    const rows = stintRows([{ start_date: '2026-01-05', end_date: '2026-06-30' }, { start_date: '2026-07-01', end_date: null }], '2026-11-04')
    expect(rows.map((r) => r.kind)).toEqual(['stint', 'stint'])
  })
})

describe('earlierStintsLine and inAnyStint', () => {
  it('names the earlier stints after the tenure', () => {
    expect(earlierStintsLine(TWO)).toBe('before: Mar 4, 2024 to Nov 3, 2026')
    expect(earlierStintsLine([{ start_date: '2020-01-02', end_date: '2021-06-30' }, ...TWO])).toBe('before: Jan 2, 2020 to Jun 30, 2021, and Mar 4, 2024 to Nov 3, 2026')
    expect(earlierStintsLine([TWO[1]!])).toBeNull()
  })

  it('a day in either stint is inside; a day in the gap is not', () => {
    expect(inAnyStint('2025-05-05', TWO)).toBe(true)
    expect(inAnyStint('2027-05-05', TWO)).toBe(false)
    expect(inAnyStint('2030-01-01', TWO)).toBe(true)
    expect(inAnyStint('2023-01-01', TWO)).toBe(false)
    expect(inAnyStint('2023-01-01', [{ start_date: null, end_date: '2023-06-01' }])).toBe(true)
  })
})
