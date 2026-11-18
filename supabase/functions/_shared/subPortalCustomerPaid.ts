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
