/**
 * Send Job Back billing context (v2.2601). Sending a Ready-to-Bill job back to
 * Working is usually one of two very different moves:
 *
 *  - "A stage is billed — work continues": the routine partial-billing round
 *    trip (bill one stage, keep working). Billed lines survive the send-back
 *    untouched; the only draft removed is the elastic PRIMARY remainder
 *    bundle, which the ensure RPC re-mints next time the job is ready to
 *    bill. Nothing is voided and no subcontractor call is owed.
 *
 *  - Rework: a deliberately-created draft carve is being deleted — the
 *    "I am going to call the Subcontractor…" attestation belongs here.
 *
 * This kernel classifies the job's invoices so the modal can pick its copy,
 * show the attestation checkbox only when a real carve is being deleted, and
 * offer the one-tap "Stage billed — continuing work" reason chip.
 */

export type SendBackInvoiceLike = {
  status: string | null
  amount: unknown
  is_primary_rtb_bundle?: boolean | null
}

export type SendBackJobBillingContext = {
  /** Unsent Ready-to-Bill drafts the send-back deletes. */
  rtbDraftCount: number
  /** Deliberate (non-primary) drafts among them — deleting these loses real carves. */
  rtbNonPrimaryDraftCount: number
  /** Billed/paid lines that SURVIVE the send-back. */
  billedCount: number
  billedTotalDollars: number
  /** The routine move: at least one line billed, and no deliberate draft is lost. */
  stageBilledContinues: boolean
}

export function sendBackJobBillingContext(
  invoices: SendBackInvoiceLike[] | null | undefined,
): SendBackJobBillingContext {
  let rtbDraftCount = 0
  let rtbNonPrimaryDraftCount = 0
  let billedCount = 0
  let billedCents = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'ready_to_bill') {
      rtbDraftCount++
      if (inv.is_primary_rtb_bundle !== true) rtbNonPrimaryDraftCount++
    } else if (inv.status === 'billed' || inv.status === 'paid') {
      billedCount++
      const n = Number(inv.amount)
      if (Number.isFinite(n)) billedCents += Math.round(n * 100)
    }
  }
  return {
    rtbDraftCount,
    rtbNonPrimaryDraftCount,
    billedCount,
    billedTotalDollars: billedCents / 100,
    stageBilledContinues: billedCount > 0 && rtbNonPrimaryDraftCount === 0,
  }
}

/**
 * Whether the "voiding this bill / call the Subcontractor" attestation gates
 * the send-back. Only when a deliberately-created draft is being deleted —
 * removing just the auto-remainder (or nothing) voids nothing.
 */
export function sendBackRequiresVoidAttestation(ctx: SendBackJobBillingContext): boolean {
  return ctx.rtbNonPrimaryDraftCount > 0
}

/** One-tap reasons for the crew-visible note; the first fits the routine move. */
export const SEND_BACK_STAGE_BILLED_REASON = 'Stage billed — continuing work'
export const SEND_BACK_REWORK_REASON = 'Rework needed'
