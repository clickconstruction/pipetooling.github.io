/**
 * Bounds for “agreed discount” new invoice total (USD): at least payments applied,
 * at most current billed amount.
 */
/** Same tolerance as `AgreedWriteDownModal` / server: new total must be strictly below current billed. */
export const WRITE_DOWN_NEW_TOTAL_EPS = 0.005

export function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

export function agreedWriteDownNewTotalBounds(
  currentBilledAmount: number,
  paidOnInvoice: number,
): { min: number; max: number } {
  const max = roundUsd2(currentBilledAmount)
  const min = roundUsd2(paidOnInvoice)
  if (min > max) {
    return { min: max, max: min }
  }
  return { min, max }
}

/** Discount (amount off) = current billed − new total. */
export function agreedWriteDownDiscountBounds(
  currentBilledAmount: number,
  paidOnInvoice: number,
): { min: number; max: number } {
  const b = agreedWriteDownNewTotalBounds(currentBilledAmount, paidOnInvoice)
  const maxDiscount = roundUsd2(b.max - b.min)
  if (maxDiscount <= 0) {
    return { min: 0, max: 0 }
  }
  const minDiscount = roundUsd2(WRITE_DOWN_NEW_TOTAL_EPS)
  if (maxDiscount < minDiscount) {
    return { min: 0, max: 0 }
  }
  return { min: minDiscount, max: maxDiscount }
}

/** Safe upper bound for “new total” number input / helper copy (below billed by ≥ 1¢ when possible). */
export function agreedWriteDownDisplayMaxNewTotal(bounds: { min: number; max: number }): number {
  return roundUsd2(Math.max(bounds.min, bounds.max - 0.01))
}

export function resolveWriteDownNewTotalFromInputs(
  currentBilledAmount: number,
  discountRaw: string,
  totalRaw: string,
):
  | { ok: true; newTotal: number; source: 'discount' | 'total' }
  | { ok: false; error: string } {
  const d = parseNewTotalInput(discountRaw)
  const t = parseNewTotalInput(totalRaw)
  const hasD = d != null && d > 0
  const hasT = t != null && t > 0
  if (hasD && hasT) {
    return { ok: false, error: 'Enter either a discount or a new invoice total, not both.' }
  }
  if (!hasD && !hasT) {
    return { ok: false, error: 'Enter a discount amount or a new invoice total.' }
  }
  if (hasD) {
    return { ok: true, newTotal: roundUsd2(currentBilledAmount - d), source: 'discount' }
  }
  return { ok: true, newTotal: roundUsd2(t!), source: 'total' }
}

export function parseNewTotalInput(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return n
}
