/**
 * The customer paid (punch list #388, step 2): the rule behind the sub's page saying so.
 *
 * A sheet at Waiting on customer is tied to one of the job's bills (`people_labor_jobs.draw_invoice_id`,
 * step 1). The page says the customer paid for that bill only, and only once the office's own record says
 * the bill is paid in full. The owner's calls of 2026-11-17: the day and no amount, never on a guess,
 * never for a part payment.
 *
 * So the day is given when all of these hold, and null otherwise:
 *   - the sheet is at `customer_pay` and carries a tie;
 *   - the tied bill's status is `paid`, the office's mark that nothing is left open on it;
 *   - at least one payment recorded on that bill carries a day.
 * The day is the latest of those payments' days: the day the last of the money came in.
 *
 * Pure, Deno- and Node-safe. `sub-portal` calls it with the rows it read as the service role, and
 * src/lib/subPortal/subPortalCustomerPaid.test.ts holds it.
 */

import { effectiveInvoiceParty, payerCustomerId, type InvoicePartyFields, type JobPartyFields } from './billToParty.ts'

/** A bill as `jobs_ledger_invoices` holds it; only what the rule reads. */
export type TiedBillRow = { id: string; status: string | null }

/** A payment as `jobs_ledger_payments` holds it; only what the rule reads. */
export type TiedBillPaymentRow = { invoice_id: string | null; paid_on: string | null }

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** The day the sheet's tied bill was paid in full, as YYYY-MM-DD, or null when the page must not say paid. */
export function customerPaidOn(input: {
  stage: string | null | undefined
  drawInvoiceId: string | null | undefined
  bills: readonly TiedBillRow[]
  payments: readonly TiedBillPaymentRow[]
}): string | null {
  if (input.stage !== 'customer_pay') return null
  const billId = (input.drawInvoiceId ?? '').trim()
  if (!billId) return null
  const bill = input.bills.find((b) => b.id === billId)
  if (!bill || bill.status !== 'paid') return null
  let last: string | null = null
  for (const p of input.payments) {
    if (p.invoice_id !== billId) continue
    const day = (p.paid_on ?? '').slice(0, 10)
    if (!YMD.test(day)) continue
    if (last == null || day > last) last = day
  }
  return last
}

/** Each sheet's paid day by sheet id: only the sheets the page may say paid for. */
export function customerPaidDays(
  sheets: ReadonlyArray<{ id: string; stage: string | null | undefined; draw_invoice_id?: string | null }>,
  bills: readonly TiedBillRow[],
  payments: readonly TiedBillPaymentRow[],
): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of sheets) {
    const day = customerPaidOn({ stage: s.stage, drawInvoiceId: s.draw_invoice_id, bills, payments })
    if (day) out.set(s.id, day)
  }
  return out
}

/** A sheet of the page's payload with the paid day on it, when the page may say paid. */
export type WithCustomerPaid<T> = T & { customerPaidOn?: string }

/** Put each sheet's paid day on the payload's sheet. A sheet with no day is handed back as it came. */
export function attachCustomerPaid<T extends { id: string }>(sheets: readonly T[], days: ReadonlyMap<string, string>): Array<WithCustomerPaid<T>> {
  return sheets.map((s) => {
    const day = days.get(s.id)
    return day ? { ...s, customerPaidOn: day } : s
  })
}

// ── The usual pay time (punch list #388, step 3) ────────────────────────────────────────────────────────
//
// While a sheet waits on the customer, the page may say how long this payer usually takes. The owner's calls
// of 2026-11-17: a range in weeks with the word *usually*, never the office's days figure, never the payer's
// name, and nothing at all below five payments in the last 12 months. The figures come from the office's own
// answer, `get_billed_customer_pay_speeds`, so the sub's line and the office's *Pays in 9–41d* read the same
// receipts.

/** Fewer measurable payments from this payer than this and the page says nothing. The owner's call 4. */
export const USUAL_PAY_MIN_PAYMENTS = 5

/**
 * How long a payer usually takes, in whole weeks.
 *   - `{ lo: 0, hi: 1 }` — within a week;
 *   - `lo` equal to `hi` — one figure, about that many weeks (2 or more);
 *   - otherwise a range, `lo` to `hi` weeks, `lo` 1 or more.
 */
export type UsualPayWeeks = { lo: number; hi: number }

function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const w = idx - lo
  return sorted[lo]! * (1 - w) + sorted[hi]! * w
}

/**
 * The payer's typical days from a bill to its money: the 25th to the 75th percentile, each rounded. The same
 * figures as the office's `paySpeedSpread` (src/lib/jobs/paymentReliability.ts) at four payments and up, which
 * the floor of five always is; the parity test holds the two together. Null below the floor.
 */
export function usualPayDays(gapDays: ReadonlyArray<number>): { loDays: number; hiDays: number; samples: number } | null {
  const gaps = gapDays.filter((g) => Number.isFinite(g) && g >= 0).sort((a, b) => a - b)
  if (gaps.length < USUAL_PAY_MIN_PAYMENTS) return null
  return { loDays: Math.round(percentile(gaps, 0.25)), hiDays: Math.round(percentile(gaps, 0.75)), samples: gaps.length }
}

/**
 * The same range in whole weeks, wide enough to hold the days: the fast end rounds down and the slow end
 * rounds up, so the page never promises a shorter wait than the office's own figure shows. A slow end of a
 * week or less reads *within a week*. Null below the floor.
 */
export function usualPayWeeks(gapDays: ReadonlyArray<number>): UsualPayWeeks | null {
  const days = usualPayDays(gapDays)
  if (!days) return null
  if (days.hiDays <= 7) return { lo: 0, hi: 1 }
  return { lo: Math.max(1, Math.floor(days.loDays / 7)), hi: Math.ceil(days.hiDays / 7) }
}

/** A value off the wire is a weeks figure the page may draw. Anything else is dropped and the card reads as it did. */
export function isUsualPayWeeks(v: unknown): v is UsualPayWeeks {
  if (v == null || typeof v !== 'object') return false
  const { lo, hi } = v as { lo?: unknown; hi?: unknown }
  if (typeof lo !== 'number' || typeof hi !== 'number' || !Number.isInteger(lo) || !Number.isInteger(hi)) return false
  if (lo === 0) return hi === 1
  return lo >= 1 && hi >= 2 && lo <= hi && hi <= 104
}

const YMD_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Each payer's measurable gaps in days, by customer id, from the raw answer of `get_billed_customer_pay_speeds`
 * (its `receipts`: up to twelve of the newest per payer, in the last 12 months). Read as the office's own parser
 * reads it (`parsePaySpeedsRpc`): a receipt with no billed day, no paid day or no gap is not counted. Empty for
 * a refused or malformed answer.
 */
export function payerGapDays(raw: unknown): Map<string, number[]> {
  const out = new Map<string, number[]>()
  const receipts = raw != null && typeof raw === 'object' ? (raw as { receipts?: unknown }).receipts : null
  if (receipts == null || typeof receipts !== 'object') return out
  for (const [id, list] of Object.entries(receipts as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    const gaps: number[] = []
    for (const r of list) {
      if (r == null || typeof r !== 'object') continue
      const { billedYmd, paidYmd, gapDays } = r as { billedYmd?: unknown; paidYmd?: unknown; gapDays?: unknown }
      if (typeof billedYmd !== 'string' || !YMD_DAY.test(billedYmd)) continue
      if (typeof paidYmd !== 'string' || !YMD_DAY.test(paidYmd)) continue
      if (typeof gapDays !== 'number' || !Number.isFinite(gapDays) || gapDays < 0) continue
      gaps.push(Math.round(gapDays))
    }
    if (gaps.length > 0) out.set(id, gaps)
  }
  return out
}

/** A sheet as `people_labor_jobs` holds it; only what the rule reads. */
export type UsualPaySheetRow = {
  id: string
  stage: string | null | undefined
  job_ledger_id?: string | null
  draw_invoice_id?: string | null
  payable_after?: string | null
}
/** A job as `jobs_ledger` holds it: who its bills go to. */
export type UsualPayJobRow = JobPartyFields & { id: string }
/** A bill as `jobs_ledger_invoices` holds it: its own pick of who pays. */
export type UsualPayBillRow = InvoicePartyFields & { id: string }

/**
 * The sheets the line may show on: at Waiting on customer, not yet paid by the customer (the paid sentence takes
 * the line's place) and with no pay day (a queued sheet waits on the calendar, not on the customer).
 */
export function usualPaySheets<T extends UsualPaySheetRow>(sheets: readonly T[], paidDays: ReadonlyMap<string, string>): T[] {
  return sheets.filter((s) => s.stage === 'customer_pay' && !paidDays.has(s.id) && !(s.payable_after ?? '').trim())
}

/**
 * Each waiting sheet's usual pay time, by sheet id: only the sheets with a payer who has the history. The payer
 * is whoever the sheet's bill goes to (`effectiveInvoiceParty`, the builder on a builder-billed bill), the one
 * `pay_speed_samples()` files each payment under. A sheet with no tie reads the job's own rule. A bill typed to
 * someone else has no payer of record, and says nothing.
 */
export function usualPayBySheet(input: {
  sheets: readonly UsualPaySheetRow[]
  paidDays: ReadonlyMap<string, string>
  jobs: readonly UsualPayJobRow[]
  bills: readonly UsualPayBillRow[]
  gapsByPayer: ReadonlyMap<string, readonly number[]>
}): Map<string, UsualPayWeeks> {
  const out = new Map<string, UsualPayWeeks>()
  const jobById = new Map(input.jobs.map((j) => [j.id, j]))
  const billById = new Map(input.bills.map((b) => [b.id, b]))
  for (const s of usualPaySheets(input.sheets, input.paidDays)) {
    const job = s.job_ledger_id ? jobById.get(s.job_ledger_id) : null
    if (!job) continue
    const bill = s.draw_invoice_id ? (billById.get(s.draw_invoice_id) ?? null) : null
    const payer = payerCustomerId(job, effectiveInvoiceParty(job, bill))
    if (!payer) continue
    const weeks = usualPayWeeks(input.gapsByPayer.get(payer) ?? [])
    if (weeks) out.set(s.id, weeks)
  }
  return out
}

/** A sheet of the page's payload with the usual pay time on it, when the page may say it. */
export type WithUsualPay<T> = T & { usualPayWeeks?: UsualPayWeeks }

/** Put each sheet's usual pay time on the payload's sheet. A sheet with none is handed back as it came. */
export function attachUsualPay<T extends { id: string }>(sheets: readonly T[], weeks: ReadonlyMap<string, UsualPayWeeks>): Array<WithUsualPay<T>> {
  return sheets.map((s) => {
    const w = weeks.get(s.id)
    return w ? { ...s, usualPayWeeks: w } : s
  })
}
