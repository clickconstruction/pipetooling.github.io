/**
 * An in-kind payment (v2.6816): a payment that pays a bill down but is not money.
 * The office's landlord settles finished work by taking it off the rent the
 * company owes him, a month at a time — the jobs' revenue stays whole, each
 * credit pays the bills down, and no cash ever arrives. Recorded as Other it
 * read as $1,000 landed in the bank every month and sat on the deposit-matching
 * list for ever, so it has a kind of its own. One predicate, shared by the app
 * and the edge functions: the kind is a word in `payment_type`, and the memo
 * says what was given instead of money. Pure and dependency-free.
 */

/** The kind as the pickers write it. */
export const IN_KIND_PAYMENT_TYPE = 'In kind'

/** "In kind", "in-kind", "INKIND" — the word, wherever it sits in the type. */
export function isInKindPaymentType(paymentType: string | null | undefined): boolean {
  return /(^|[^a-z])in[\s-]?kind/i.test((paymentType ?? '').trim())
}

/** The word the customer reads for it on a statement, a credit line or a paid row: never a cash word. */
export const IN_KIND_CUSTOMER_WORD = 'Credit'
