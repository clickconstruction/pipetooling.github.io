/**
 * "In kind" wherever a person picks a payment's kind (v2.6816): the choices the
 * pickers offer, the memo they ask for, and the words the Record a cash or
 * check payment window says under the kind. The predicate itself lives in
 * `supabase/functions/_shared/inKindPayment.ts` so the edge functions read the
 * same word. What an in-kind payment is NOT counted as — money landed, at the
 * bank or in the drawer — is decided in `moneyInWeek.ts`; what it never sits
 * on — the deposit-matching list — in `list_unlinked_payments_for_bank_payments`.
 * Pure; tested beside it.
 */
import { IN_KIND_PAYMENT_TYPE, isInKindPaymentType } from '../../../supabase/functions/_shared/inKindPayment'

export { IN_KIND_PAYMENT_TYPE, isInKindPaymentType }

/** The kinds a person can pick, in the order the window lists them. */
export const PAYMENT_KIND_CHOICES = ['Cash', 'Check', 'Wire', 'ACH', 'Card (external)', IN_KIND_PAYMENT_TYPE, 'Other'] as const
export type PaymentKindChoice = (typeof PAYMENT_KIND_CHOICES)[number]

/** The row's kind reads in kind (a DB row, an Edit-Job form row or the window's state all fit). */
export function isInKindPayment(p: { payment_type?: string | null }): boolean {
  return isInKindPaymentType(p.payment_type)
}

/** The memo field's label when the kind is in kind: it is no longer an internal note. */
export const IN_KIND_MEMO_LABEL = 'What was given instead of money'
export const IN_KIND_MEMO_PLACEHOLDER = 'e.g. Rent credit, March 2026'
/** The refusal when an in-kind payment is confirmed with no memo. */
export const IN_KIND_MEMO_REQUIRED = 'Say what was given instead of money, for example "Rent credit, March 2026".'

/** An in-kind row with no memo: the pickers ask for one before it is confirmed. */
export function inKindMemoMissing(p: { payment_type?: string | null; note?: string | null }): boolean {
  return isInKindPayment(p) && (p.note ?? '').trim().length === 0
}

/**
 * The line under the kind in the window. On a bill that went out through Stripe
 * the same two paths a cash payment takes carry it: under the open balance a
 * credit line on the Stripe invoice, at the balance the invoice marked paid
 * outside Stripe. Both are honest for a credit — Stripe moves no money either
 * way and the row carries the kind — so neither is refused.
 */
export function inKindWindowNote(args: { stripeHosted: boolean; planKind: string | null | undefined }): string {
  const base = 'In kind pays the bill down and counts toward what the customer has paid, and is never counted as money in the bank.'
  if (!args.stripeHosted) return base
  if (args.planKind === 'part') return `${base} Stripe puts the credit on the invoice as a credit line, in these words, so the pay link asks for the rest.`
  return `${base} Stripe marks the invoice settled outside Stripe, so the pay link stops working and no reminder goes out.`
}
