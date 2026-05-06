/** Target row revenue from share of current bid total (Bids Pricing → Generate Unit Cost). */

export const TARGET_PCT_OF_TOTAL_REVENUE_MAX = 1000

export type UnitPriceFromTargetPctInput = {
  totalRevenue: number
  targetPct: number
  count: number
  isFixed: boolean
}

export type UnitPriceFromTargetPctResult = {
  rowRevenue: number
  unitPrice: number
}

export function unitPriceFromTargetPctOfTotal(
  input: UnitPriceFromTargetPctInput,
): UnitPriceFromTargetPctResult | null {
  const T = input.totalRevenue
  const p = input.targetPct
  if (!Number.isFinite(T) || T <= 0) return null
  if (!Number.isFinite(p) || p <= 0 || p > TARGET_PCT_OF_TOTAL_REVENUE_MAX) return null

  const rowRevenue = Math.round(((p / 100) * T) * 100) / 100
  if (!Number.isFinite(rowRevenue) || rowRevenue <= 0) return null

  if (input.isFixed) {
    return { rowRevenue, unitPrice: rowRevenue }
  }

  const c = Number(input.count)
  if (!Number.isFinite(c) || c <= 0) return null
  const unitPrice = Math.round((rowRevenue / c) * 100) / 100
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null
  return { rowRevenue, unitPrice }
}
