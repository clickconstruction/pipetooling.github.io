/**
 * Week bands for the Pay run table (People → Pay → Payroll → Pay run): the rows arrive in the
 * order the table shows them (newest created first), and a band opens every run of consecutive
 * rows that share a pay period. The band is the visual break the owner asked for, and it carries
 * the run's subtotal so a week's size is readable without adding rows by eye.
 *
 * Runs, not groups: rows are NOT re-sorted. If the same period shows up again later in the list
 * (a catch-up report generated weeks after the rest), it gets its own band there — the table's
 * order is the created order, and the band only marks where consecutive rows change week.
 */

export type PayRunBandRow = {
  id: string
  period_start: string
  period_end: string
  hours_total: number
  gross_pay: number
}

export type PayRunWeekBand = {
  /** Index into the visible rows where this run starts — the band renders before this row. */
  startIndex: number
  periodStart: string
  periodEnd: string
  count: number
  hours: number
  gross: number
  /** Rows in the run that are not fully paid. */
  openCount: number
}

export function buildPayRunWeekBands(rows: readonly PayRunBandRow[], fullyPaidIds: ReadonlySet<string>): PayRunWeekBand[] {
  const bands: PayRunWeekBand[] = []
  let current: PayRunWeekBand | null = null
  rows.forEach((row, index) => {
    if (!current || current.periodStart !== row.period_start || current.periodEnd !== row.period_end) {
      current = { startIndex: index, periodStart: row.period_start, periodEnd: row.period_end, count: 0, hours: 0, gross: 0, openCount: 0 }
      bands.push(current)
    }
    current.count += 1
    current.hours += Number(row.hours_total) || 0
    current.gross += Number(row.gross_pay) || 0
    if (!fullyPaidIds.has(row.id)) current.openCount += 1
  })
  return bands
}

/** Band lookup by the row index it precedes. */
export function bandsByStartIndex(bands: readonly PayRunWeekBand[]): Map<number, PayRunWeekBand> {
  return new Map(bands.map((b) => [b.startIndex, b]))
}
