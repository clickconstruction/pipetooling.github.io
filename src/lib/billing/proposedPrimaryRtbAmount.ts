/**
 * Bill Customer's read-only twin of `ensure_single_ready_to_bill_invoice_for_job`
 * (migration 20260828170937_ensure_rtb_zero_remainder_deletes_primary.sql).
 *
 * Decision 17 (journey map, 2026-09-05): opening a modal writes nothing. The
 * RPC used to run on open — it INSERTs the primary Ready-to-Bill remainder
 * draft, RESIZES an existing one, or DELETES a never-sent $0 primary — and only
 * the INSERT was unwound on Cancel. Now the modal computes what the RPC *would*
 * do from the job row + its invoices and shows that; the RPC itself runs only
 * inside Send / Record, immediately before the write.
 *
 * Every branch below mirrors the RPC's branch of the same shape, in cents
 * (the RPC works in numeric(12,2)). Change one, change the other.
 */

export type PrimaryRtbPlanJob = {
  status: string | null
  revenue: number | null
  payments_made: number | null
}

export type PrimaryRtbPlanInvoice = {
  id: string
  status: string | null
  amount: number | null
  is_primary_rtb_bundle: boolean | null
  stripe_invoice_id?: string | null
  hosted_invoice_url?: string | null
}

export type PrimaryRtbBlockedReason =
  | 'job_not_rtb'
  | 'multiple_primary'
  | 'no_remainder_partials'
  | 'nothing_left'
  | 'fully_allocated'

export type PrimaryRtbPlan =
  | {
      kind: 'bill'
      /** Dollars the primary bill will carry once the commit-time ensure runs. */
      amount: number
      /** The existing RTB row the RPC would adopt/resize, or null when it would INSERT on commit. */
      invoiceId: string | null
      wouldCreate: boolean
    }
  | { kind: 'blocked'; reason: PrimaryRtbBlockedReason; message: string }

/** Verbatim RPC error strings (so the modal reads the same before and after the commit). */
export const PRIMARY_RTB_MESSAGES: Record<PrimaryRtbBlockedReason, string> = {
  job_not_rtb: 'Job must be in Ready to Bill',
  multiple_primary:
    'Multiple primary remainder Ready-to-Bill rows exist for this job; fix is_primary_rtb_bundle so only one is true.',
  no_remainder_partials:
    'No remainder to bill on the job bundle; use Bill Customer from a partial invoice row or adjust amounts.',
  nothing_left: 'Nothing left to bill for this job',
  // The RPC returns {ok, fully_allocated} here (and deletes the never-sent $0
  // primary). Read-only, nothing is deleted — it is simply a dead end, said plainly.
  fully_allocated: 'Nothing left to bill for this job — every dollar is already on an invoice.',
}

function cents(n: number | null | undefined): number {
  return Math.round(Number(n ?? 0) * 100)
}

function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim() === ''
}

function isRtb(inv: Pick<PrimaryRtbPlanInvoice, 'status'>): boolean {
  return inv.status === 'ready_to_bill'
}

function isPrimaryRtb(inv: Pick<PrimaryRtbPlanInvoice, 'status' | 'is_primary_rtb_bundle'>): boolean {
  return isRtb(inv) && inv.is_primary_rtb_bundle === true
}

/** RPC: a primary with a Stripe object AND hosted URL is never resized. */
function isStripeFinalized(inv: Pick<PrimaryRtbPlanInvoice, 'stripe_invoice_id' | 'hosted_invoice_url'>): boolean {
  return !isBlank(inv.stripe_invoice_id) && !isBlank(inv.hosted_invoice_url)
}

/**
 * THE remainder: `GREATEST(0, revenue − payments − Σ other open invoices)`,
 * where "other open invoices" are the RTB + billed rows EXCLUDING the
 * never-sent primary bundle (v2.1134 — the row being resized must not count
 * against the remainder it is resized to). Dollars, exact to the cent.
 */
export function proposedPrimaryRtbAmount(input: {
  revenue: number | null | undefined
  payments: number | null | undefined
  otherOpenInvoices: ReadonlyArray<number | null | undefined>
}): number {
  let allocated = 0
  for (const amt of input.otherOpenInvoices) allocated += cents(amt)
  const unalloc = Math.max(0, cents(input.revenue) - cents(input.payments) - allocated)
  return unalloc / 100
}

/** The RTB + billed rows that count against the remainder (everything but the RTB primary). */
export function otherOpenInvoiceAmounts(invoices: ReadonlyArray<PrimaryRtbPlanInvoice>): number[] {
  const out: number[] = []
  for (const inv of invoices) {
    if (inv.status !== 'ready_to_bill' && inv.status !== 'billed') continue
    if (isPrimaryRtb(inv)) continue
    out.push(Number(inv.amount ?? 0))
  }
  return out
}

/**
 * What the ensure RPC would do for this job right now — branch for branch —
 * without doing it.
 */
export function planPrimaryRtbForBillCustomer(
  job: PrimaryRtbPlanJob,
  invoices: ReadonlyArray<PrimaryRtbPlanInvoice>,
): PrimaryRtbPlan {
  if (job.status !== 'ready_to_bill') {
    return { kind: 'blocked', reason: 'job_not_rtb', message: PRIMARY_RTB_MESSAGES.job_not_rtb }
  }

  const unallocCents = Math.round(
    proposedPrimaryRtbAmount({
      revenue: job.revenue,
      payments: job.payments_made,
      otherOpenInvoices: otherOpenInvoiceAmounts(invoices),
    }) * 100,
  )
  const unalloc = unallocCents / 100

  const primaries = invoices.filter(isPrimaryRtb)
  if (primaries.length > 1) {
    return { kind: 'blocked', reason: 'multiple_primary', message: PRIMARY_RTB_MESSAGES.multiple_primary }
  }

  const rtbRows = invoices.filter(isRtb)

  if (primaries.length === 0) {
    if (unallocCents > 0) {
      // Exactly one RTB row already sized to the remainder: the RPC adopts it
      // as the primary (flag flip, no new row) instead of inserting a twin.
      const only = rtbRows.length === 1 ? rtbRows[0] : undefined
      if (only && cents(only.amount) === unallocCents) {
        return { kind: 'bill', amount: unalloc, invoiceId: only.id, wouldCreate: false }
      }
      return { kind: 'bill', amount: unalloc, invoiceId: null, wouldCreate: true }
    }
    if (rtbRows.length > 0) {
      return {
        kind: 'blocked',
        reason: 'no_remainder_partials',
        message: PRIMARY_RTB_MESSAGES.no_remainder_partials,
      }
    }
    return { kind: 'blocked', reason: 'nothing_left', message: PRIMARY_RTB_MESSAGES.nothing_left }
  }

  const primary = primaries[0]
  if (!primary) {
    return { kind: 'blocked', reason: 'nothing_left', message: PRIMARY_RTB_MESSAGES.nothing_left }
  }
  if (isStripeFinalized(primary)) {
    // Sent to Stripe already: the RPC returns the row as-is, never resizes it.
    return { kind: 'bill', amount: cents(primary.amount) / 100, invoiceId: primary.id, wouldCreate: false }
  }
  if (unallocCents > 0) {
    return { kind: 'bill', amount: unalloc, invoiceId: primary.id, wouldCreate: false }
  }
  return { kind: 'blocked', reason: 'fully_allocated', message: PRIMARY_RTB_MESSAGES.fully_allocated }
}
