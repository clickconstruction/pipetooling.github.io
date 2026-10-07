/**
 * A payment the app counts toward a Stripe bill that Stripe never heard of (v2.4847).
 *
 * Job 825: a $3,500 check from the GC was recorded on Sep 14, after the $3,850
 * Stripe bill went out on Sep 2. The app counted it (the bill read $350 open, the
 * Pipeline card 91% paid), but no credit note was written, so the customer's pay
 * link and the invoice PDF still asked for $3,850. The payment line's ⋯ now offers
 * **Apply it to the Stripe bill**: the same credit note a part payment recorded
 * through the Stripe window gets (v2.3695), written for the row that already
 * exists. Undo part payment is the way back.
 */
import { stripeCreditLineText } from './stripePartPayment'
import { instrumentWord } from './billsAndPayments'

export type ApplyToStripeInput = {
  /** The bill the line is drawn under; null in ③ (money on no bill). */
  bill: { status: string | null; amount: number | null; stripe_invoice_id: string | null; stripe_invoice_status?: string | null } | null
  billIsStripe: boolean
  row: { stripe_credit_note_id?: string | null; amount: number | null }
  /** The row is saved — an unsaved draft has no id Stripe could be told about. */
  persisted: boolean
  /** The slice is a part of the payment (the rest went to another bill). */
  partial: boolean
  /** The host offers the door. */
  hasAction: boolean
}

/**
 * Live when: the line sits under a Stripe bill still Billed and not paid in Stripe,
 * the row is saved and whole, carries no credit note yet, and its amount is under
 * the bill (a payment at or over the bill is a whole-bill close — Mark Paid's job).
 */
export function applyToStripeOffered(input: ApplyToStripeInput): boolean {
  const { bill, row } = input
  if (!input.hasAction || !bill || !input.billIsStripe || !input.persisted || input.partial) return false
  if (bill.status !== 'billed') return false
  if ((bill.stripe_invoice_id ?? '').trim().length === 0) return false
  if ((bill.stripe_invoice_status ?? '').trim() === 'paid') return false
  if ((row.stripe_credit_note_id ?? '').trim().length > 0) return false
  const amount = Number(row.amount ?? 0)
  const billAmount = Number(bill.amount ?? 0)
  if (!(amount > 0.005)) return false
  if (amount >= billAmount - 0.005) return false
  return true
}

/** The words of the confirm: what Stripe will read, and what the pay link asks for after. */
export function applyToStripeWords(input: {
  row: { amount: number | null; paid_on: string | null; payment_type: string | null; reference_number: string | null; mercury_transaction_id?: string | null }
  bill: { amount: number | null }
  /** What the app shows open on the bill after this payment (its other payments counted). */
  openAfter: number
}): { creditLine: string; staysDue: string; sentence: string } {
  const amount = Number(input.row.amount ?? 0)
  const paidOn = input.row.paid_on ? String(input.row.paid_on).slice(0, 10) : ''
  const creditLine = stripeCreditLineText(customerPaymentTypeWord(input.row.payment_type), paidOn, amount, creditLineReference(input.row))
  const staysDue = money(Math.max(0, input.openAfter))
  return {
    creditLine,
    staysDue,
    sentence: `Stripe puts a credit line on the $${money(Number(input.bill.amount ?? 0))} bill: "${creditLine}". The pay link and the invoice PDF then ask for $${staysDue}. Nothing moves in the bank, and the payment stays as it is here. Undo part payment is the way back.`,
  }
}

/**
 * The type word the customer reads on the credit line: a bank row's Mercury kind
 * ("checkDeposit", "incomingDomesticWire") and the office's spellings ("Cheque")
 * become Check · Wire · ACH · Card · Cash; anything else reads Payment. Mirrored
 * in the function's `customerPaymentTypeWord`.
 */
export function customerPaymentTypeWord(paymentType: string | null | undefined): string {
  const w = instrumentWord(paymentType)
  if (!w) return 'Payment'
  return w === 'ach' ? 'ACH' : w.charAt(0).toUpperCase() + w.slice(1)
}

/** A hand-typed check's number goes on the line; a bank row's reference is the bank's id, never shown. */
export function creditLineReference(row: { reference_number: string | null; mercury_transaction_id?: string | null }): string | null {
  if ((row.mercury_transaction_id ?? '').trim()) return null
  return row.reference_number
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
