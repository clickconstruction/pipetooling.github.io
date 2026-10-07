/**
 * A bill stamped paid with no payment behind it (v2.4839).
 *
 * Job 258 carried an $8,900 bill in status `paid` that was never sent and never
 * paid. The Bill tab read it "marked paid · no payment on record" and counted it
 * for nothing in the sum line, but the row had no door off the job: Delete draft
 * wants a draft, Send back wants `billed`. Meanwhile the stamp still counted in the
 * customer's lifetime billed and read as settled to the lien-waiver kernel, which
 * offered an unconditional waiver for money never received.
 *
 * The ⋯ menu of such a row offers **Remove bill**. The RPC behind it takes only that
 * row — status paid, no payment referencing it, no Stripe invoice — so the money
 * never changes. These words decide when the item is live and what it says when not.
 */
import { ledgerDollars } from './invoiceLedgerRow'

export type MarkedPaidRemoveMenu = {
  enabled: boolean
  /** The tooltip: why it is dead, or what it does. */
  title: string
}

/**
 * For a row already in the paid state: live when nothing is paid on it and no Stripe
 * invoice backs it; dead with the door to use instead otherwise. Null when the row has
 * a payment behind it — a paid bill with a payment is not a stub and gets no item.
 */
export function markedPaidRemoveMenu(input: { paid: number; stripeInvoiceId: string | null | undefined }): MarkedPaidRemoveMenu | null {
  if (input.paid > 0.005) return null
  if ((input.stripeInvoiceId ?? '').trim().length > 0) {
    return { enabled: false, title: 'Stripe holds a paid mark on this bill. Undo it under the bill first.' }
  }
  return { enabled: true, title: 'Remove this bill. It is marked paid, but no payment is recorded on it. No payment or balance changes.' }
}

/** The job thread note that keeps the trace once the row is gone. */
export function markedPaidRemovedNoteBody(amount: number): string {
  return `Removed a ${ledgerDollars(amount)} bill that was marked paid with no payment on record. No payment or balance changed.`
}
