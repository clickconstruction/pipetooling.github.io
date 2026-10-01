/**
 * Each bill shows the money that paid it (v2.4293). Pure: the words and
 * numbers the Bill tab draws under a bill for every payment counted toward it,
 * the bill's paid bar, and which payments sit on no bill at all.
 *
 * Why the words come from provenance and not from `payment_type`: that column
 * holds eight spellings of three things (null, Cheque, Check, checkDeposit,
 * Card (external), ACH, other, Other — a read of 348 rows on 2026-09-30), so
 * the chip reads the row's origin — a bank deposit link, a Stripe bill, or a
 * hand-typed row — and only then the type word. The bank names the payer on
 * every check deposit (`mercury_transactions.counterparty_name`), which is why
 * a bank row says "check from Loberg Contracting" and never the deposit id.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { attributeJobPayments, type PaymentSlice } from './paymentAttribution'
import { mercuryLinkedPaymentRow, stripeBillInvoiceForPaymentRow } from './jobFormPaymentPredicates'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'

/** What the bank synced about the deposit behind a bank-linked row. */
export type MercuryDepositFacts = {
  postedYmd: string | null
  counterparty: string | null
  kind: string | null
  status: string | null
  failureReason: string | null
}

export type PaymentSourceKind = 'bank' | 'stripe-card' | 'stripe-recorded' | 'hand'

export type PaymentSource = {
  kind: PaymentSourceKind
  /** The chip: "Check · bank deposit", "Card · Stripe", "Check · recorded in Stripe", "Check · typed by hand". */
  chip: string
  /** The one-word instrument the chip leads with, lower case: check, card, wire, cash, ach, payment. */
  instrument: string
}

const BANK_KIND_WORDS: Record<string, string> = {
  checkDeposit: 'check',
  incomingDomesticWire: 'wire',
  incomingInternationalWire: 'wire',
  externalTransfer: 'transfer',
  internalTransfer: 'transfer',
}

/** "Cheque", "Check", "checkDeposit", "Card (external)", "ACH", "other" → one lower-case word, or null. */
export function instrumentWord(paymentType: string | null | undefined): string | null {
  const t = (paymentType ?? '').trim().toLowerCase()
  if (!t) return null
  if (/che(ck|que)/.test(t)) return 'check'
  if (/card/.test(t)) return 'card'
  if (/wire/.test(t)) return 'wire'
  if (/ach|transfer/.test(t)) return 'ach'
  if (/cash/.test(t)) return 'cash'
  return null
}

function cap(word: string): string {
  return word === 'ach' ? 'ACH' : word.charAt(0).toUpperCase() + word.slice(1)
}

/** Where a payment row came from, and the chip that says so. */
export function paymentSource(row: PaymentRow, job: JobWithDetails | null, bank?: MercuryDepositFacts | null): PaymentSource {
  if (mercuryLinkedPaymentRow(row)) {
    const word = (bank?.kind && BANK_KIND_WORDS[bank.kind]) || instrumentWord(row.payment_type) || null
    return { kind: 'bank', chip: word ? `${cap(word)} · bank deposit` : 'Bank deposit', instrument: word ?? 'deposit' }
  }
  if (stripeBillInvoiceForPaymentRow(row, job)) {
    const word = instrumentWord(row.payment_type)
    if (word && word !== 'card') return { kind: 'stripe-recorded', chip: `${cap(word)} · recorded in Stripe`, instrument: word }
    return { kind: 'stripe-card', chip: 'Card · Stripe', instrument: 'card' }
  }
  const word = instrumentWord(row.payment_type)
  return { kind: 'hand', chip: word ? `${cap(word)} · typed by hand` : 'Typed by hand', instrument: word ?? 'payment' }
}

/**
 * The source in a sentence, lower case, for the line's words: "check from Loberg
 * Contracting", "check · bank deposit", "card through Stripe", "check recorded in
 * Stripe", "check · typed by hand", "typed by hand".
 */
export function sourceWords(source: PaymentSource, bank?: MercuryDepositFacts | null): string {
  const counterparty = (bank?.counterparty ?? '').trim()
  switch (source.kind) {
    case 'bank':
      return counterparty ? `${source.instrument} from ${counterparty}` : source.chip.toLowerCase()
    case 'stripe-card':
      return 'card through Stripe'
    case 'stripe-recorded':
      return `${source.instrument} recorded in Stripe`
    default:
      return source.chip === 'Typed by hand' ? 'typed by hand' : `${source.instrument} · typed by hand`
  }
}

/** The bill's day the pay gap is measured from: when it was sent, else when it was billed. */
export function billSentYmd(inv: Pick<JobsLedgerInvoiceRow, 'sent_to_customer_at' | 'billed_at'>): string | null {
  const raw = (inv.sent_to_customer_at ?? inv.billed_at ?? '').trim()
  return raw ? raw.slice(0, 10) : null
}

/** Whole days from the bill going out to the money arriving; null without both dates, never negative words. */
export function daysAfterBill(sentYmd: string | null, paidYmd: string | null): number | null {
  if (!sentYmd || !paidYmd) return null
  return daysBetweenYmd(sentYmd, paidYmd)
}

export type PaymentLineWords = {
  /** "Sep 14" */
  dateText: string
  /** "check from Loberg Contracting" on a bank row; the chip on its own carries the rest. */
  who: string | null
  /** "61 d" when the bill went out before the money; "13 d before the bill" when it did not; null without dates. */
  daysText: string | null
  daysTone: 'ok' | 'before-bill' | null
  /** The row is linked to this bill by its invoice_id. */
  pinned: boolean
  /** The row is on no bill, and the oldest-first rule counts it toward this one. */
  countedHere: boolean
  /** The slice is a part of the payment (the rest went to another bill or is surplus). */
  partial: boolean
  /** "check dated Sep 10" when the office entered the check's own date. */
  checkDated: string | null
  /** "check 1042 · deposit for the rough-in" — the hand-typed row's own reference and memo. */
  detail: string | null
  /** The bank returned the deposit: "Returned by the bank · Insufficient funds". */
  returned: string | null
}

/** The words under a bill for one slice of one payment. */
export function paymentLineWords(input: {
  slice: PaymentSlice<PaymentRow>
  source: PaymentSource
  billSentYmd: string | null
  bank?: MercuryDepositFacts | null
}): PaymentLineWords {
  const { slice, source, bank } = input
  const row = slice.payment
  const paidYmd = row.paid_on ? String(row.paid_on).slice(0, 10) : null
  const days = daysAfterBill(input.billSentYmd, paidYmd)
  const counterparty = (bank?.counterparty ?? '').trim()
  const who = source.kind === 'bank' && counterparty ? `${source.instrument} from ${counterparty}` : null
  const ref = (row.reference_number ?? '').trim()
  const memo = (row.note ?? '').trim()
  const detailParts: string[] = []
  if (source.kind === 'hand' || source.kind === 'stripe-recorded') {
    if (ref) detailParts.push(source.instrument === 'check' ? `check ${ref}` : `ref ${ref}`)
    if (memo && memo.toLowerCase() !== 'stripe') detailParts.push(memo)
  } else if (source.kind === 'stripe-card') {
    detailParts.push('Stripe wrote this row')
  }
  const returned = bank && (bank.status ?? '').toLowerCase() === 'failed' ? `Returned by the bank${bank.failureReason ? ` · ${bank.failureReason}` : ''}` : null
  return {
    dateText: paidYmd ? formatYmdMonthDay(paidYmd) : 'no date',
    who,
    daysText: days == null ? null : days >= 0 ? `${days} d` : `${Math.abs(days)} d before the bill`,
    daysTone: days == null ? null : days >= 0 ? 'ok' : 'before-bill',
    pinned: Boolean(row.invoice_id),
    countedHere: !row.invoice_id,
    partial: slice.partial,
    checkDated: row.sent_on ? `check dated ${formatYmdMonthDay(String(row.sent_on).slice(0, 10))}` : null,
    detail: detailParts.length > 0 ? detailParts.join(' · ') : null,
    returned,
  }
}

export type BillPaidBar = {
  /** One segment per slice, in slice order, as a fraction of the bill (0–1); the sum never passes 1. */
  segments: Array<{ paymentId: string; frac: number }>
  paidFrac: number
}

/** The thin bar under a bill: how much of it is in, one segment per payment. */
export function billPaidBar(billAmount: number, slices: ReadonlyArray<PaymentSlice<PaymentRow>>): BillPaidBar {
  const amount = Number(billAmount) || 0
  if (amount <= 0) return { segments: [], paidFrac: 0 }
  let used = 0
  const segments: Array<{ paymentId: string; frac: number }> = []
  for (const s of slices) {
    const room = Math.max(0, 1 - used)
    const frac = Math.min(room, Math.max(0, s.amount / amount))
    if (frac > 0) segments.push({ paymentId: s.payment.id, frac })
    used += frac
  }
  return { segments, paidFrac: Math.min(1, used) }
}

export type BillsAndPayments = {
  /** The slices under each listed bill, in payment order. */
  slicesByBill: Map<string, PaymentSlice<PaymentRow>[]>
  /** Payments no listed bill counts: unlinked money the sent bills did not need, or linked to a bill not listed. */
  onNoBill: PaymentRow[]
  /** Dollars of unlinked money no bill needed. */
  surplus: number
}

/**
 * Where every payment is drawn. A payment appears under each bill that holds a
 * slice of it (a pinned row under its own bill, an unpinned one under the bill
 * the oldest-first rule counts it toward); a payment with no slice anywhere is
 * money on no bill and stays in ③. A row not yet saved (`persistedIds` given and
 * the row not in it) stays in ③ too, whatever the rule would count it toward —
 * the office is still typing it, and a line that jumps under a bill mid-keystroke
 * loses the box it was typing in.
 */
export function splitBillsAndPayments(
  invoices: ReadonlyArray<JobsLedgerInvoiceRow>,
  payments: ReadonlyArray<PaymentRow>,
  persistedIds?: ReadonlySet<string> | null,
): BillsAndPayments {
  const saved = persistedIds ? payments.filter((p) => persistedIds.has(p.id)) : payments
  const attribution = attributeJobPayments(invoices, saved)
  const slicesByBill = new Map<string, PaymentSlice<PaymentRow>[]>()
  const placed = new Set<string>()
  for (const inv of invoices) {
    const slices = attribution.byBill.get(inv.id)?.slices ?? []
    slicesByBill.set(inv.id, slices)
    for (const s of slices) placed.add(s.payment.id)
  }
  const onNoBill = payments.filter((p) => !placed.has(p.id))
  return { slicesByBill, onNoBill, surplus: attribution.surplus }
}
