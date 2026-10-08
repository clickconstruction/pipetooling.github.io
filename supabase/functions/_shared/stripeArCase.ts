/**
 * A card chargeback or a failed bank debit on a Stripe bill, as a case beside the checks that came
 * back (v2.4950, punch list #76 piece 1). stripe-webhook turns Stripe's object into the arguments of
 * `record_ar_stripe_case` (20261009080000); the notice and Accounts Receivable word it.
 *
 * Pure: no Deno, no Supabase, no Stripe SDK. Tested from `src/lib/jobs/stripeArCase.test.ts`.
 */

export type StripeCaseKind = 'dispute' | 'debit_failed'
export type StripeCaseMode = 'live' | 'test'

/** The arguments of `record_ar_stripe_case`, by name. */
export type StripeCaseArgs = {
  p_kind: StripeCaseKind
  p_object_id: string
  p_mode: StripeCaseMode
  p_charge_id: string | null
  p_stripe_invoice_id: string
  p_amount: number
  p_reason: string | null
  p_status: string | null
  p_due_by: string | null
  p_occurred_at: string | null
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const idOf = (v: unknown): string => (typeof v === 'string' ? v.trim() : v && typeof v === 'object' ? text((v as { id?: unknown }).id) : '')
const isoOf = (epochSeconds: unknown): string | null =>
  typeof epochSeconds === 'number' && Number.isFinite(epochSeconds) && epochSeconds > 0 ? new Date(epochSeconds * 1000).toISOString() : null
const dollars = (cents: unknown): number => (typeof cents === 'number' && Number.isFinite(cents) ? Math.round(cents) / 100 : 0)

/** The parts of a Stripe Dispute the case reads. */
export type StripeDisputeLike = {
  id: string
  amount?: number | null
  charge?: string | { id?: string } | null
  reason?: string | null
  status?: string | null
  created?: number | null
  evidence_details?: { due_by?: number | null } | null
}

/** A dispute on a charge that paid `stripeInvoiceId`; null without one (not a bill of ours). */
export function disputeCaseArgs(d: StripeDisputeLike, mode: StripeCaseMode, stripeInvoiceId: string | null | undefined): StripeCaseArgs | null {
  const invoice = text(stripeInvoiceId)
  if (!text(d.id) || !invoice) return null
  return {
    p_kind: 'dispute',
    p_object_id: text(d.id),
    p_mode: mode,
    p_charge_id: idOf(d.charge) || null,
    p_stripe_invoice_id: invoice,
    p_amount: dollars(d.amount),
    p_reason: text(d.reason) || null,
    p_status: text(d.status) || null,
    p_due_by: isoOf(d.evidence_details?.due_by),
    p_occurred_at: isoOf(d.created),
  }
}

/** The parts of a Stripe PaymentIntent the case reads (API 2024-06-20 carries `invoice`). */
export type StripePaymentIntentLike = {
  id: string
  amount?: number | null
  invoice?: string | { id?: string } | null
  payment_method_types?: string[] | null
  last_payment_error?: { message?: string | null; payment_method?: { type?: string | null } | null } | null
}

/** Stripe's words for a failed debit, cut to one line. */
export const STRIPE_DEBIT_REASON_MAX = 200

/**
 * A bank debit (ACH) that failed on a bill: a case, because it fails days after the customer
 * pressed Pay and they think it went through. A card that fails does so on the pay page, in front
 * of them, so it is null; so is a payment with no bill.
 */
export function debitFailedCaseArgs(pi: StripePaymentIntentLike, mode: StripeCaseMode, occurredEpochSeconds?: number | null): StripeCaseArgs | null {
  const invoice = idOf(pi.invoice)
  if (!text(pi.id) || !invoice) return null
  const errType = text(pi.last_payment_error?.payment_method?.type)
  const types = (pi.payment_method_types ?? []).map(text)
  const bank = errType ? errType === 'us_bank_account' : types.length === 1 && types[0] === 'us_bank_account'
  if (!bank) return null
  const message = text(pi.last_payment_error?.message)
  return {
    p_kind: 'debit_failed',
    p_object_id: text(pi.id),
    p_mode: mode,
    p_charge_id: null,
    p_stripe_invoice_id: invoice,
    p_amount: dollars(pi.amount),
    p_reason: message ? message.slice(0, STRIPE_DEBIT_REASON_MAX) : null,
    p_status: 'failed',
    p_due_by: null,
    p_occurred_at: isoOf(occurredEpochSeconds),
  }
}

/** Stripe's dispute reason codes, as a sentence the office reads. An unknown code reads as none. */
const DISPUTE_REASON_WORDS: Record<string, string> = {
  fraudulent: 'They say they did not make the payment.',
  unrecognized: 'They do not recognize the charge.',
  duplicate: 'They say they were charged twice.',
  product_not_received: 'They say the work was not done.',
  product_unacceptable: 'They say the work was not right.',
  credit_not_processed: 'They say a credit they were owed never came.',
  subscription_canceled: 'They say they had cancelled.',
  debit_not_authorized: 'They say they did not allow the bank debit.',
  customer_initiated: 'They asked their bank to take it back.',
  incorrect_account_details: 'Their bank says the account details were wrong.',
  insufficient_funds: 'Their bank says the account was short.',
  bank_cannot_process: 'Their bank could not process it.',
}

export function stripeDisputeReasonWords(reason: string | null | undefined): string {
  return DISPUTE_REASON_WORDS[text(reason)] ?? 'They gave no reason Stripe could name.'
}

/** The dispute or the payment in Stripe's Dashboard, test or live. */
export function stripeCaseDashboardUrl(kind: string | null | undefined, objectId: string, mode: string | null | undefined): string {
  const base = text(mode) === 'test' ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com'
  const id = encodeURIComponent(text(objectId))
  return kind === 'dispute' ? `${base}/disputes/${id}` : `${base}/payments/${id}`
}
