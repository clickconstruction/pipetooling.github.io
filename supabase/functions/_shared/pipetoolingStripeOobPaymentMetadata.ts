/** Stripe Invoice.metadata keys for out-of-band (manual) pay — read by stripe-webhook. */
export const STRIPE_OOB_META_PAID_ON = 'pt_paid_on'
export const STRIPE_OOB_META_PAYMENT_TYPE = 'pt_payment_type'
export const STRIPE_OOB_META_REFERENCE = 'pt_reference'
export const STRIPE_OOB_META_INTERNAL_NOTE = 'pt_internal_note'

const STRIPE_METADATA_MAX_LEN = 500

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
  return out
}

export type ParsedOobMetadataForRpc = {
  p_payment_type?: string
  p_reference_number?: string
  p_paid_on?: string
  p_internal_note?: string
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
  const out: ParsedOobMetadataForRpc = {}
  if (pt) out.p_payment_type = pt
  if (ref) out.p_reference_number = ref
  if (note) out.p_internal_note = note
  if (paidRaw && /^\d{4}-\d{2}-\d{2}$/.test(paidRaw)) out.p_paid_on = paidRaw
  return out
}
