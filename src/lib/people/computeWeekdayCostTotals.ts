/** Number of weekday columns (Sun..Sat) in the people cost grid. */
export const WEEKDAY_COUNT = 7

export interface WeekdayCostTotals {
  /** Per-weekday column totals, length WEEKDAY_COUNT (index 0 = Sun). */
  columnTotals: number[]
  /** Sum of all column totals. */
  grandTotal: number
}

/** Per-column + grand totals for a person × weekday cost grid. Missing/short byDay entries count as 0. */
export function computeWeekdayCostTotals(rows: ReadonlyArray<{ byDay: number[] }>): WeekdayCostTotals {
  const columnTotals = Array.from({ length: WEEKDAY_COUNT }, (_, dayOfWeek) =>
    rows.reduce((sum, r) => sum + (r.byDay[dayOfWeek] ?? 0), 0)
  )
  const grandTotal = columnTotals.reduce((sum, v) => sum + v, 0)
  return { columnTotals, grandTotal }
}
