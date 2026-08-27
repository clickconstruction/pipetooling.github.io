/**
 * Workbench cell → sale-price solver (v2.2379, owner-approved prototype):
 * the Revenue, Profit, and Margin cells are inputs, and each one solves
 * straight back to the row's sale price/unit — type in whichever number the
 * negotiation is happening in. Pure math so the conversions are testable
 * apart from the 4,900-line tab.
 */

export type WorkbenchCellField = 'revenue' | 'profit' | 'margin'

/** Margin solves refuse at/above this — a 95%+ margin is a typo, not a price. */
export const MAX_CELL_MARGIN = 0.95

/**
 * The unit price implied by typing `raw` into `field` on a row of `count`
 * units carrying `rowCost` total cost. Null when the input can't produce a
 * usable price: unparseable, non-positive result, zero count, a margin at or
 * above MAX_CELL_MARGIN, or a profit/margin edit on a row with no cost
 * (those cells aren't editable without a cost, but the guard stands anyway).
 * Result is rounded to cents.
 */
export function impliedUnitPrice(field: WorkbenchCellField, raw: string, count: number, rowCost: number): number | null {
  if (!(count > 0)) return null
  const v = parseFloat(raw.replace(/[$,%\s]/g, ''))
  if (!Number.isFinite(v)) return null
  let unit: number
  if (field === 'revenue') {
    unit = v / count
  } else if (field === 'profit') {
    if (!(rowCost > 0)) return null
    unit = (rowCost + v) / count
  } else {
    if (!(rowCost > 0)) return null
    const m = v / 100
    if (m >= MAX_CELL_MARGIN) return null
    unit = rowCost / (1 - m) / count
  }
  if (!Number.isFinite(unit) || unit <= 0) return null
  return Math.round(unit * 100) / 100
}

/** The value a cell's editor should open with, from the row's current numbers (unit price may be null on unpriced rows). */
export function cellEditSeed(field: WorkbenchCellField, unitPrice: number | null, count: number, rowCost: number): string {
  if (unitPrice == null || !(count > 0)) return ''
  const revenue = unitPrice * count
  if (field === 'revenue') return (Math.round(revenue * 100) / 100).toString()
  if (field === 'profit') return (Math.round((revenue - rowCost) * 100) / 100).toString()
  if (!(revenue > 0)) return ''
  return Math.round(((revenue - rowCost) / revenue) * 100).toString()
}
