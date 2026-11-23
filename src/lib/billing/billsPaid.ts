/**
 * Bills sent: who paid, when and how. Pure.
 *
 * The page said *Paid Nov 9* from `bill_send_marks`, which answers by sent copy. So a line with no copy (a text, a
 * Housecall Pro bill, an email from before the copies began) had no day, a part payment said nothing until the bill
 * was paid in full, and the way a bill was paid was read and never drawn. This reads a bill's own payment rows
 * (`jobs_ledger_payments` by `invoice_id`) and says one thing a bill: paid, part paid or not paid, the day, and
 * the way in the job window's own words (`paymentSourceFromFacts`), so the page and the job never name one payment
 * two ways.
 *
 * A payment's day is its `paid_on`, else the day its row was written in the company's calendar, as
 * `bill_send_marks` reads it. A Stripe payment's row is written within seconds of the customer paying, so its
 * instant is kept to say the time. Every other row is written when the office gets to it, so its instant says
 * nothing of when the money came.
 *
 * `billsSent.ts` reads these states by type alone. The page's read (`billsSentIo.ts`) builds them, so this file
 * and the job kernels it leans on stay out of the app's first bundle, where `billsSent.ts` rides.
 */
import { isInKindPaymentType } from '../../../supabase/functions/_shared/inKindPayment'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { isStripePayment, paymentSourceFromFacts } from '../jobs/billsAndPayments'
import { invoiceRecordsThroughStripe } from '../jobs/paymentInvoiceLinking'

/** One payment row on a bill, as the page reads it. */
export interface BillPayment {
  id: string
  billId: string
  amount: number
  /** `paid_on` as stored: YYYY-MM-DD, or null. */
  paidOn: string | null
  createdAtIso: string | null
  paymentType: string | null
  note: string | null
  referenceNumber: string | null
  /** The bank deposit the row is matched to (`mercury_transaction_id`). */
  bankTransactionId: string | null
  stripeCreditNoteId: string | null
}

/** What of a bill says how its payments are worded and whether it is paid. */
export interface BillPaidBill {
  id: string
  amount: number | null
  /** ready_to_bill, billed or paid. */
  status: string
  stripeInvoiceId?: string | null
  /** Stripe's own word for its invoice: *paid* once Stripe has it as paid. */
  stripeInvoiceStatus?: string | null
  externalSendChannel?: string | null
}

export type BillPaidKind = 'paid' | 'part' | 'open'

/** One payment as a line draws it. */
export interface BillPaidPayment {
  id: string
  /** The day it counts on, YYYY-MM-DD. '' when the row holds no day that parses. */
  ymd: string
  amount: number
  /** *Card · Stripe*, *Check 4417 · bank deposit*, *Cash · typed by hand*. */
  wayWords: string
  /** The instant a Stripe payment was recorded. Null for every other way. */
  atIso: string | null
  /** Paid through Stripe by the customer: the webhook's own row. */
  stripe: boolean
  /** A credit and no money: it pays the bill and is added to no day's money. */
  inKind: boolean
  bankTransactionId: string | null
}

/** Where one bill stands. */
export interface BillPaidState {
  kind: BillPaidKind
  /** The newest payment's day, YYYY-MM-DD. Null with no payment on record, or none with a day. */
  paidOn: string | null
  /** What the payments on record add to. */
  paidAmount: number
  /** What is still out. 0 on a paid bill. */
  outAmount: number
  /** The newest payment's way. '' with no payment on record. */
  wayWords: string
  /** The newest payment's instant, when Stripe recorded it. */
  paidAtIso: string | null
  /** Oldest first. */
  payments: BillPaidPayment[]
}

const YMD = /^\d{4}-\d{2}-\d{2}/

/** The day a payment counts on: its `paid_on`, else the day its row was written, in the company's calendar. '' when neither parses. */
export function billPaymentYmd(p: Pick<BillPayment, 'paidOn' | 'createdAtIso'>): string {
  const paid = (p.paidOn ?? '').trim()
  if (YMD.test(paid)) return paid.slice(0, 10)
  return p.createdAtIso ? calendarYmdInAppTzFromIso(p.createdAtIso) : ''
}

/**
 * Stripe holds a record of the payment: the webhook wrote it, it carries a credit note, or its bill went through
 * Stripe and Stripe has the bill as paid. The job window's test (`stripeHoldsPaymentReason`), from a bill and no job.
 */
export function billPaymentStripeOwned(p: Pick<BillPayment, 'note' | 'stripeCreditNoteId'>, bill: BillPaidBill | undefined): boolean {
  if (isStripePayment(p)) return true
  if (!bill || !invoiceRecordsThroughStripe({ stripe_invoice_id: bill.stripeInvoiceId, external_send_channel: bill.externalSendChannel })) return false
  return !!(p.stripeCreditNoteId ?? '').trim() || (bill.stripeInvoiceStatus ?? '').trim() === 'paid'
}

/**
 * How a payment was made, in the job window's words, with the check's number after the word when the row holds
 * one: *Check 4417 · bank deposit*. A number is said for a check alone, since no other way has one a person reads.
 */
export function billPaymentWayWords(p: Pick<BillPayment, 'bankTransactionId' | 'note' | 'stripeCreditNoteId' | 'paymentType' | 'referenceNumber'>, bill: BillPaidBill | undefined): string {
  const source = paymentSourceFromFacts({ bankLinked: !!(p.bankTransactionId ?? '').trim(), stripeOwned: billPaymentStripeOwned(p, bill), paymentType: p.paymentType })
  const ref = (p.referenceNumber ?? '').trim().replace(/^#/, '')
  if (!ref || source.instrument !== 'check') return source.chip
  const at = source.chip.indexOf(' · ')
  return at === -1 ? source.chip : `${source.chip.slice(0, at)} ${ref}${source.chip.slice(at)}`
}

const cents = (n: number): number => Math.round(n * 100) / 100

/**
 * Where a bill stands, from its payment rows. Null for a bill that is neither billed nor paid (one sent back to
 * Ready to Bill owes nothing yet). A bill marked paid is paid, whatever its rows add to. A billed bill with money
 * on it is part paid, unless that money covers it: a bill with nothing out is paid, whatever its status still
 * says. A check typed in and held until it clears leaves the bill billed, and the page once read it *Part paid*
 * with *$0.00 out* and counted it among the bills not paid.
 */
export function billPaidState(bill: BillPaidBill, payments: ReadonlyArray<BillPayment>): BillPaidState | null {
  if (bill.status !== 'paid' && bill.status !== 'billed') return null
  const drawn: BillPaidPayment[] = payments
    .filter((p) => p.billId === bill.id)
    .map((p) => {
      const stripe = isStripePayment(p)
      return {
        id: p.id,
        ymd: billPaymentYmd(p),
        amount: p.amount,
        wayWords: billPaymentWayWords(p, bill),
        atIso: stripe ? p.createdAtIso : null,
        stripe,
        inKind: isInKindPaymentType(p.paymentType),
        bankTransactionId: (p.bankTransactionId ?? '').trim() || null,
      }
    })
    // Oldest first, a row with no day last, then by id so the order never moves between reads.
    .sort((a, b) => (a.ymd || '9999').localeCompare(b.ymd || '9999') || a.id.localeCompare(b.id))
  const paidAmount = cents(drawn.reduce((s, p) => s + p.amount, 0))
  const dated = drawn.filter((p) => p.ymd)
  const newest = dated[dated.length - 1] ?? drawn[drawn.length - 1]
  const out = Math.max(0, cents((bill.amount ?? 0) - paidAmount))
  // Money on record that leaves nothing out has paid the bill. A bill with no amount on record cannot be covered.
  const paid = bill.status === 'paid' || (paidAmount > 0 && (bill.amount ?? 0) > 0 && out === 0)
  return {
    kind: paid ? 'paid' : paidAmount > 0 ? 'part' : 'open',
    paidOn: newest?.ymd || null,
    paidAmount,
    outAmount: paid ? 0 : out,
    wayWords: newest?.wayWords ?? '',
    paidAtIso: newest?.atIso ?? null,
    payments: drawn,
  }
}

/** Every bill's state, by bill id. A bill with no state (not billed, not paid) has no entry. */
export function billsPaidByBill(bills: Iterable<BillPaidBill>, payments: ReadonlyArray<BillPayment>): Map<string, BillPaidState> {
  const byBill = new Map<string, BillPayment[]>()
  for (const p of payments) byBill.set(p.billId, [...(byBill.get(p.billId) ?? []), p])
  const out = new Map<string, BillPaidState>()
  for (const bill of bills) {
    const state = billPaidState(bill, byBill.get(bill.id) ?? [])
    if (state) out.set(bill.id, state)
  }
  return out
}
