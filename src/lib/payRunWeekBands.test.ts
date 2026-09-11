import { describe, expect, it } from 'vitest'
import { bandsByStartIndex, buildPayRunWeekBands, type PayRunBandRow } from './payRunWeekBands'

const row = (id: string, start: string, end: string, hours: number, gross: number): PayRunBandRow => ({
  id,
  period_start: start,
  period_end: end,
  hours_total: hours,
  gross_pay: gross,
})

// Created-order slice of the real table: five w31 rows, then three w30 rows.
const ROWS: PayRunBandRow[] = [
  row('a', '2026-07-26', '2026-08-01', 8.26, 206.4),
  row('b', '2026-07-26', '2026-08-01', 39.84, 667.27),
  row('c', '2026-07-26', '2026-08-01', 34.25, 642.17),
  row('d', '2026-07-26', '2026-08-01', 40, 2309.2),
  row('e', '2026-07-26', '2026-08-01', 58.85, 470.79),
  row('f', '2026-07-19', '2026-07-25', 39.22, 980.53),
  row('g', '2026-07-19', '2026-07-25', 24.5, 196.04),
  row('h', '2026-07-19', '2026-07-25', 40, 2309.2),
]

describe('buildPayRunWeekBands', () => {
  it('opens a band at the first row of each run of consecutive same-period rows', () => {
    const bands = buildPayRunWeekBands(ROWS, new Set(['c', 'h']))
    expect(bands.map((b) => b.startIndex)).toEqual([0, 5])
    expect(bands[0]).toMatchObject({ periodStart: '2026-07-26', periodEnd: '2026-08-01', count: 5, openCount: 4 })
    expect(bands[0]?.hours).toBeCloseTo(181.2)
    expect(bands[0]?.gross).toBeCloseTo(4295.83)
    expect(bands[1]).toMatchObject({ periodStart: '2026-07-19', periodEnd: '2026-07-25', count: 3, openCount: 2 })
    expect(bands[1]?.hours).toBeCloseTo(103.72)
    expect(bands[1]?.gross).toBeCloseTo(3485.77)
  })

  it('does not re-sort: a period that reappears later gets its own band', () => {
    const rows = [ROWS[0]!, ROWS[5]!, ROWS[1]!]
    const bands = buildPayRunWeekBands(rows, new Set())
    expect(bands.map((b) => [b.startIndex, b.periodStart, b.count])).toEqual([
      [0, '2026-07-26', 1],
      [1, '2026-07-19', 1],
      [2, '2026-07-26', 1],
    ])
  })

  it('a single row is its own band; no rows means no bands', () => {
    expect(buildPayRunWeekBands([ROWS[0]!], new Set()).length).toBe(1)
    expect(buildPayRunWeekBands([], new Set())).toEqual([])
  })

  it('treats a changed period_end as a new run even when period_start matches', () => {
    const rows = [row('x', '2026-07-19', '2026-07-25', 1, 1), row('y', '2026-07-19', '2026-07-26', 1, 1)]
    expect(buildPayRunWeekBands(rows, new Set()).length).toBe(2)
  })

  it('bandsByStartIndex keys each band by the row it precedes', () => {
    const map = bandsByStartIndex(buildPayRunWeekBands(ROWS, new Set()))
    expect([...map.keys()]).toEqual([0, 5])
    expect(map.get(5)?.count).toBe(3)
    expect(map.get(1)).toBeUndefined()
  })
})
