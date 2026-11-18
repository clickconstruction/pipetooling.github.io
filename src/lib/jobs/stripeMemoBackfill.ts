/**
 * Which of a job's Stripe bills still wait on their memo or footer (the Job form map's second pass, cut 3).
 * A bill sent through Stripe gets its memo and footer read back from Stripe after the send; the Job form
 * asks for them again on open for any bill that still lacks one. The form wrote this test three times: the
 * memo that keys the read, the read's own target list, and the bill view's close loop.
 */
export type StripeMemoInvoice = {
  id: string
  status?: string | null
  stripe_invoice_id?: string | null
  hosted_invoice_url?: string | null
  stripe_invoice_memo?: string | null
  stripe_invoice_footer?: string | null
}

/** A bill Stripe hosts (an id and a pay link) whose memo or footer has not been read back yet. */
export function stripeBillLacksMemoOrFooter(inv: StripeMemoInvoice | null | undefined): boolean {
  if (!inv) return false
  if (!(inv.stripe_invoice_id ?? '').trim() || !(inv.hosted_invoice_url ?? '').trim()) return false
  return !(inv.stripe_invoice_memo ?? '').trim() || !(inv.stripe_invoice_footer ?? '').trim()
}

/** The read on open asks only for sent bills. The bill view's close loop asks whatever the bill's status. */
export function invoiceNeedsStripeMemoBackfill(inv: StripeMemoInvoice): boolean {
  return inv.status === 'billed' && stripeBillLacksMemoOrFooter(inv)
}

/** The bills the read on open asks Stripe about, in the job's own order. */
export function stripeMemoBackfillTargets<T extends StripeMemoInvoice>(invoices: readonly T[] | null | undefined): T[] {
  return (invoices ?? []).filter(invoiceNeedsStripeMemoBackfill)
}

/**
 * What the read on open is keyed on: the job and the sorted ids of the bills that wait. Null when none does,
 * so a job re-read with its memos filled does not ask again, and a re-read with the same bills waiting does
 * not either.
 */
export function stripeMemoBackfillKey(jobId: string | null | undefined, invoices: readonly StripeMemoInvoice[] | null | undefined): string | null {
  if (!jobId) return null
  const needIds = stripeMemoBackfillTargets(invoices)
    .map((i) => i.id)
    .sort()
    .join('|')
  if (!needIds) return null
  return `${jobId}::${needIds}`
}
