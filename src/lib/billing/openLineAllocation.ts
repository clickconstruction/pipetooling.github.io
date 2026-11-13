/**
 * What an open bill still puts against a job's remainder (v2.3775).
 *
 * The Ready-to-Bill remainder everywhere is
 *   revenue − payments_made − Σ open lines
 * where the open lines are the ready_to_bill + billed rows (the elastic RTB
 * primary bundle excluded where the caller says so). `payments_made` already
 * holds EVERY payment on the job, including the ones applied to a billed line
 * that is still open — so a line must count for what is still UNPAID on it,
 * never its face amount, or the paid part is subtracted twice.
 *
 * Job 978 (Springtown HVAC, 2026-09-23): $3,630 bid, $2,999 paid on the job,
 * one $1,072.50 billed line with $1,018.87 applied to it. Face-amount math
 * read 3,630 − 2,999 − 1,072.50 < 0 → "Nothing left to bill for this job";
 * the line's unpaid $53.63 is what stands against the job, so $577.37 is left.
 *
 * `ensure_single_ready_to_bill_invoice_for_job` (migration 20260923233000)
 * computes the same sum in SQL. Change one, change the other.
 */

export type OpenLineInvoice = {
  id?: string | null
  status: string | null
  amount: number | string | null | undefined
  is_primary_rtb_bundle?: boolean | null
}

export type LinkedPayment = {
  invoice_id?: string | null
  amount: number | string | null | undefined
}

export function moneyCents(v: number | string | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Σ payment cents applied to each invoice, keyed by invoice id (unlinked payments are not here). */
export function appliedCentsByInvoiceId(payments: ReadonlyArray<LinkedPayment> | null | undefined): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of payments ?? []) {
    if (!p.invoice_id) continue
    m.set(p.invoice_id, (m.get(p.invoice_id) ?? 0) + moneyCents(p.amount))
  }
  return m
}

/** Cents still unpaid on one line: its amount net of what was applied to it, floored at 0. */
export function openLineCents(amount: number | string | null | undefined, appliedCents: number): number {
  return Math.max(0, moneyCents(amount) - appliedCents)
}

/** The RTB primary bundle: elastic, resized by the ensure RPC to whatever is not billed. */
export function isRtbPrimaryBundle(inv: Pick<OpenLineInvoice, 'status' | 'is_primary_rtb_bundle'>): boolean {
  return inv.status === 'ready_to_bill' && inv.is_primary_rtb_bundle === true
}

/** An open line: ready_to_bill or billed. Paid / void / anything else stands against nothing. */
export function isOpenLine(inv: Pick<OpenLineInvoice, 'status'>): boolean {
  return inv.status === 'ready_to_bill' || inv.status === 'billed'
}

/**
 * Σ cents the open lines still put against the job's remainder — each line net
 * of the payments applied to it. `excludeRtbPrimary` drops the elastic bundle
 * (the ensure RPC's basis, and every "how much can still be carved" read);
 * leave it false for the board-merge basis, where a well-synced bundle reads
 * as a $0 gap.
 */
export function allocatedOpenCents(
  invoices: ReadonlyArray<OpenLineInvoice> | null | undefined,
  payments: ReadonlyArray<LinkedPayment> | null | undefined,
  opts: { excludeRtbPrimary: boolean },
): number {
  const applied = appliedCentsByInvoiceId(payments)
  let sum = 0
  for (const inv of invoices ?? []) {
    if (!isOpenLine(inv)) continue
    if (opts.excludeRtbPrimary && isRtbPrimaryBundle(inv)) continue
    sum += openLineCents(inv.amount, inv.id ? (applied.get(inv.id) ?? 0) : 0)
  }
  return sum
}
