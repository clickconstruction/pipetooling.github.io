/** Physical payment installments recorded against a pay stub (see pay_stub_payments). */

export type PayStubPaymentRow = {
  id: string
  pay_stub_id: string
  amount: number
  paid_at: string
  memo: string | null
  created_at: string | null
  created_by: string | null
}

export const PAY_STUB_PAY_FULLY_TOLERANCE = 0.01

export function sumPayStubPaymentAmounts(rows: PayStubPaymentRow[] | undefined): number {
  if (!rows?.length) return 0
  return Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100
}

export function remainingPayStubBalance(grossPay: number, paidSum: number): number {
  return Math.max(0, Math.round((grossPay - paidSum) * 100) / 100)
}

export function isPayStubFullyPaid(grossPay: number, paidSum: number): boolean {
  return paidSum + PAY_STUB_PAY_FULLY_TOLERANCE >= grossPay
}

/**
 * The most recent payment date recorded against a stub, or null when no payments exist.
 * Explicit max (not "last row") so callers don't depend on fetch order surviving client-side edits.
 */
export function lastPayStubPaymentPaidAt(rows: PayStubPaymentRow[] | undefined): string | null {
  if (!rows?.length) return null
  let latest: string | null = null
  for (const r of rows) {
    if (!r.paid_at) continue
    if (latest === null || r.paid_at > latest) latest = r.paid_at
  }
  return latest
}
