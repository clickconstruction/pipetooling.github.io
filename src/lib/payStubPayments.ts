/** Physical payment installments recorded against a pay stub (see pay_stub_payments). */

import { relativeDayOffset } from './relativeDayPhrase'

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

export type PayStubPaymentDelay =
  | { kind: 'paid'; days: number } // signed: last payment N days after (+) / before (−) period end
  | { kind: 'outstanding'; days: number } // no payment yet; days since period end (today >= period end)
  | { kind: 'none' } // no payment and the period hasn't ended yet (or unparseable dates) → render —

/**
 * Local calendar day as YYYY-MM-DD from explicit date parts — NOT `toLocaleDateString('en-CA')`,
 * whose output format depends on the runtime's ICU data (Node small-ICU yields "7/1/2026").
 */
export function localYmdFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Days between a stub's period end and its last payment (Payment Delay column).
 * Unpaid stubs whose period has ended report live days-outstanding instead; unpaid stubs whose
 * period hasn't ended (or unparseable dates) report 'none'. `todayYmd` is caller-supplied
 * (local `toLocaleDateString('en-CA')`) so the math is deterministic in tests.
 */
export function payStubPaymentDelay(
  periodEndYmd: string,
  lastPaidAt: string | null,
  todayYmd: string,
): PayStubPaymentDelay {
  if (lastPaidAt) {
    const paidDate = new Date(lastPaidAt)
    if (Number.isNaN(paidDate.getTime())) return { kind: 'none' }
    // Local calendar day of the payment — matches how the Last Paid column renders the same value.
    const paidYmd = localYmdFromDate(paidDate)
    const days = relativeDayOffset(periodEndYmd, paidYmd)
    return days === null ? { kind: 'none' } : { kind: 'paid', days }
  }
  const outstanding = relativeDayOffset(periodEndYmd, todayYmd)
  if (outstanding === null || outstanding < 0) return { kind: 'none' }
  return { kind: 'outstanding', days: outstanding }
}
