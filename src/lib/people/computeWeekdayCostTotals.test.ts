import { describe, expect, it } from 'vitest'
import { WEEKDAY_COUNT, computeWeekdayCostTotals } from './computeWeekdayCostTotals'

describe('computeWeekdayCostTotals', () => {
  it('returns all-zero columns and zero grand total for no rows', () => {
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([])
    expect(columnTotals).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(columnTotals).toHaveLength(WEEKDAY_COUNT)
    expect(grandTotal).toBe(0)
  })

  it('mirrors a single row and sums it as the grand total', () => {
    const byDay = [10, 20, 30, 40, 50, 60, 70]
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([{ byDay }])
    expect(columnTotals).toEqual(byDay)
    expect(grandTotal).toBe(280)
  })

  it('sums multiple rows column-by-column', () => {
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([
      { byDay: [1, 2, 3, 4, 5, 6, 7] },
      { byDay: [10, 20, 30, 40, 50, 60, 70] },
      { byDay: [100, 0, 0, 0, 0, 0, 0] },
    ])
    expect(columnTotals).toEqual([111, 22, 33, 44, 55, 66, 77])
    expect(grandTotal).toBe(408)
  })

  it('treats missing/short byDay entries as zero', () => {
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([{ byDay: [5, 5] }])
    expect(columnTotals).toEqual([5, 5, 0, 0, 0, 0, 0])
    expect(grandTotal).toBe(10)
  })

  it('preserves fractional and negative values without rounding', () => {
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([
      { byDay: [1.5, -2, 0, 0, 0, 0, 0] },
      { byDay: [0.25, 2, 0, 0, 0, 0, 0] },
    ])
    expect(columnTotals[0]).toBeCloseTo(1.75)
    expect(columnTotals[1]).toBe(0)
    expect(grandTotal).toBeCloseTo(1.75)
  })

  it('ignores byDay indices beyond the weekday range', () => {
    const { columnTotals, grandTotal } = computeWeekdayCostTotals([{ byDay: [1, 1, 1, 1, 1, 1, 1, 999] }])
    expect(columnTotals).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(grandTotal).toBe(7)
  })
})
