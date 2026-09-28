/**
 * The job form's two totals — what the job is worth and what has been paid on it — and the
 * figures read off them. One home so the copies cannot drift: the display, the billing math,
 * the revenue written on save and the Paid → Billed demotion all read the same sums (v2.1029
 * lost the hazmat fee's revenue when one copy recomputed from the line items alone).
 */
import { revenueDollarsFromFixtures, type JobFixtureLineForRevenue } from '../revenueFromJobFixtures'

/**
 * The Job Total with riders: the named line items' extended amounts plus the rider (hazmat)
 * fees. The line items round to cents; the sum with the fees is not rounded again.
 */
export function jobFormRevenueDollars(fixtures: JobFixtureLineForRevenue[], riderFeesDollars: number): number {
  return revenueDollarsFromFixtures(fixtures) + riderFeesDollars
}

/** Every payment line's amount, summed; a blank or unreadable amount counts as zero. */
export function jobFormPaidDollars(payments: readonly { amount: number | string | null | undefined }[]): number {
  return payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
}

/** What "Remove payment?" shows: the line, the job total, the remainder now and after. */
export type JobFormPaymentRemovePreview = { rowAmt: number; jobTotal: number; currentRem: number; newRem: number }

/**
 * The remove-payment preview for one line. Null when no line is picked or the line is gone.
 * Neither remainder goes below zero — an overpaid job reads 0 remaining, before and after.
 */
export function jobFormPaymentRemovePreview(args: {
  rowId: string | null
  payments: readonly { id: string; amount: number | string | null | undefined }[]
  jobTotalDollars: number
}): JobFormPaymentRemovePreview | null {
  const { rowId, payments, jobTotalDollars } = args
  if (!rowId) return null
  const row = payments.find((r) => r.id === rowId)
  if (!row) return null
  const rev = jobTotalDollars
  const paidSum = jobFormPaidDollars(payments)
  const currentRem = Math.max(0, rev - paidSum)
  const rowAmt = Number(row.amount) || 0
  const newRem = Math.max(0, rev - (paidSum - rowAmt))
  return { rowAmt, jobTotal: rev, currentRem, newRem }
}
