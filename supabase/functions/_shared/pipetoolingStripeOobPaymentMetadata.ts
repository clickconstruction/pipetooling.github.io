/** Stripe Invoice.metadata keys for out-of-band (manual) pay — read by stripe-webhook. */
export const STRIPE_OOB_META_PAID_ON = 'pt_paid_on'
export const STRIPE_OOB_META_PAYMENT_TYPE = 'pt_payment_type'
export const STRIPE_OOB_META_REFERENCE = 'pt_reference'
export const STRIPE_OOB_META_INTERNAL_NOTE = 'pt_internal_note'
/** v2.4289: the user who pressed Mark Paid — the webhook writes the payment row with the service role, which has no auth.uid(). */
export const STRIPE_OOB_META_RECORDED_BY = 'pt_recorded_by'

const STRIPE_METADATA_MAX_LEN = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function truncateStripeMetadataValue(s: string): string {
  const t = s.trim()
  if (t.length <= STRIPE_METADATA_MAX_LEN) return t
  return t.slice(0, STRIPE_METADATA_MAX_LEN)
}

export type OobPaymentMetadataInput = {
  paid_on_yyyy_mm_dd: string
  payment_type: string
  reference_number?: string
  internal_note?: string
  /** The caller's users.id (v2.4289). */
  recorded_by?: string
}

/** Values for Stripe metadata object (all string). */
export function stripeInvoiceMetadataForOobPayment(input: OobPaymentMetadataInput): Record<string, string> {
  const out: Record<string, string> = {
    [STRIPE_OOB_META_PAID_ON]: truncateStripeMetadataValue(input.paid_on_yyyy_mm_dd),
    [STRIPE_OOB_META_PAYMENT_TYPE]: truncateStripeMetadataValue(input.payment_type),
  }
  const ref = (input.reference_number ?? '').trim()
  if (ref) out[STRIPE_OOB_META_REFERENCE] = truncateStripeMetadataValue(ref)
  const note = (input.internal_note ?? '').trim()
  if (note) out[STRIPE_OOB_META_INTERNAL_NOTE] = truncateStripeMetadataValue(note)
  const by = (input.recorded_by ?? '').trim()
  if (UUID_RE.test(by)) out[STRIPE_OOB_META_RECORDED_BY] = by
  return out
}

export type ParsedOobMetadataForRpc = {
  p_payment_type?: string
  p_reference_number?: string
  p_paid_on?: string
  p_internal_note?: string
  /** v2.4289 → mark_invoice_paid_from_stripe(p_recorded_by) → jobs_ledger_payments.created_by. */
  p_recorded_by?: string
}

/** Parse Stripe Invoice.metadata for mark_invoice_paid_from_stripe optional args. */
export function parseOobPaymentMetadataFromStripe(
  metadata: Record<string, string> | null | undefined,
): ParsedOobMetadataForRpc {
  if (!metadata || typeof metadata !== 'object') return {}
  const pt = metadata[STRIPE_OOB_META_PAYMENT_TYPE]?.trim()
  const ref = metadata[STRIPE_OOB_META_REFERENCE]?.trim()
  const paidRaw = metadata[STRIPE_OOB_META_PAID_ON]?.trim()
  const note = metadata[STRIPE_OOB_META_INTERNAL_NOTE]?.trim()
  const by = metadata[STRIPE_OOB_META_RECORDED_BY]?.trim()
  const out: ParsedOobMetadataForRpc = {}
  if (pt) out.p_payment_type = pt
  if (ref) out.p_reference_number = ref
  if (note) out.p_internal_note = note
  if (paidRaw && /^\d{4}-\d{2}-\d{2}$/.test(paidRaw)) out.p_paid_on = paidRaw
  if (by && UUID_RE.test(by)) out.p_recorded_by = by
  return out
}
