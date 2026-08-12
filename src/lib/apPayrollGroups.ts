/**
 * Dashboard AP modal payroll grouping (v2.1596).
 *
 * The Team payroll section lists one open pay-report week per row; people
 * several weeks behind (7 rows for one person) scatter through the
 * amount-sorted list and hide their real total. This groups a person's weeks
 * into one expandable row: total owed, oldest week's date for the aging chip,
 * weeks oldest-first inside. People with a single open week stay flat rows.
 */

import type { FinancialItem } from './dashboardFinancials'
import type { FinanceDrillSort } from './dashboardFinanceModalRows'

export type PayrollPersonGroup = {
  kind: 'paygroup'
  key: string
  /** Person name (the stub rows' label). */
  label: string
  total: number
  /** Oldest week's due date — drives the group's aging chip. */
  oldestDateYmd: string | null
  /** The person's stub items, oldest week first (undated last). */
  weeks: FinancialItem[]
}

export type PayrollRowOrGroup = FinancialItem | PayrollPersonGroup

export function isPayrollPersonGroup(row: PayrollRowOrGroup): row is PayrollPersonGroup {
  return (row as PayrollPersonGroup).kind === 'paygroup'
}

/** "Payroll 2026-07-12 – 2026-07-18" → "2026-07-12 – 2026-07-18" (sublabel fallback "—"). */
export function payrollWeekLabel(item: FinancialItem): string {
  return (item.sublabel ?? '').replace(/^Payroll\s+/, '') || '—'
}

const byOldestAsc = (a: string | null, b: string | null): number => {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

/**
 * Group already-filtered stub items by person. Persons with one week pass
 * through unchanged; 2+ weeks collapse to a PayrollPersonGroup. The result is
 * re-sorted by the drill sort: 'amount' = biggest total first, 'oldest' =
 * oldest week first (undated last).
 */
export function groupPayrollStubItems(items: FinancialItem[], sort: FinanceDrillSort): PayrollRowOrGroup[] {
  const byPerson = new Map<string, FinancialItem[]>()
  for (const item of items) {
    const list = byPerson.get(item.label)
    if (list) list.push(item)
    else byPerson.set(item.label, [item])
  }
  const rows: PayrollRowOrGroup[] = []
  for (const [label, weeks] of byPerson) {
    const only = weeks.length === 1 ? weeks[0] : undefined
    if (only !== undefined) {
      rows.push(only)
      continue
    }
    const sortedWeeks = [...weeks].sort((a, b) => byOldestAsc(a.dateYmd, b.dateYmd))
    let oldest: string | null = null
    for (const w of sortedWeeks) {
      if (w.dateYmd && (oldest === null || w.dateYmd < oldest)) oldest = w.dateYmd
    }
    rows.push({
      kind: 'paygroup',
      key: `paygroup:${label}`,
      label,
      total: weeks.reduce((s, w) => s + w.amount, 0),
      oldestDateYmd: oldest,
      weeks: sortedWeeks,
    })
  }
  const amountOf = (r: PayrollRowOrGroup) => (isPayrollPersonGroup(r) ? r.total : r.amount)
  const dateOf = (r: PayrollRowOrGroup) => (isPayrollPersonGroup(r) ? r.oldestDateYmd : r.dateYmd)
  rows.sort((a, b) => (sort === 'oldest' ? byOldestAsc(dateOf(a), dateOf(b)) : amountOf(b) - amountOf(a)))
  return rows
}
