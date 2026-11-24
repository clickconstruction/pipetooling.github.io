/**
 * How a bill the customer paid through Stripe was paid, as `mark_invoice_paid_from_stripe` is told it.
 *
 * The webhook used to say nothing: the payment row was written with no `payment_type` and the note *Stripe*, and
 * every screen read it as a card. A customer who pays from a bank account is no card: the money takes days to
 * clear, Stripe's fee is a different one, and a debit can be returned. The Bills sent walk of 2026-11-23 found one
 * worded *Card · Stripe* beside Stripe's own record of an ACH direct debit.
 *
 * Pure. The webhook reads the method off the paying charge and asks here what to pass. Only a debit on a bank
 * account is named. A card, a wallet and anything else pass nothing, so those rows are written exactly as before.
 */

/** `jobs_ledger_payments.payment_type` for a bank debit the customer made through Stripe. The client's `STRIPE_BANK_DEBIT_PAYMENT_TYPE` is the same word; `stripePaidMethod.test.ts` holds the two equal. */
export const STRIPE_BANK_DEBIT_PAYMENT_TYPE = 'Bank debit'

/** The row's note that marks a payment Stripe recorded. The paid function writes it by itself only when it is told nothing else. */
export const STRIPE_PAYMENT_ROW_NOTE = 'Stripe'

/** Stripe's payment method types that draw on a bank account. */
const BANK_DEBIT_METHOD_TYPES: ReadonlySet<string> = new Set(['us_bank_account', 'ach_debit', 'acss_debit', 'sepa_debit', 'bacs_debit', 'au_becs_debit'])

/** True for a Stripe payment method type that is a debit on a bank account. */
export function isStripeBankDebitMethod(methodType: string | null | undefined): boolean {
  return BANK_DEBIT_METHOD_TYPES.has((methodType ?? '').trim())
}

/**
 * What to add to the paid function's arguments, or null to add nothing. Null whenever the bill was marked paid
 * outside Stripe: the office's own words for that payment stand. The note is passed with the type because the paid
 * function writes *Stripe* by itself only when the type, the reference and the note are all empty.
 */
export function stripePaidMethodArgs(
  methodType: string | null | undefined,
  outOfBand: { p_payment_type?: string; p_reference_number?: string; p_internal_note?: string },
): { p_payment_type: string; p_internal_note: string } | null {
  if (outOfBand.p_payment_type || outOfBand.p_reference_number || outOfBand.p_internal_note) return null
  return isStripeBankDebitMethod(methodType) ? { p_payment_type: STRIPE_BANK_DEBIT_PAYMENT_TYPE, p_internal_note: STRIPE_PAYMENT_ROW_NOTE } : null
}
