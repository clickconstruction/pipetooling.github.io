/**
 * Voided test bills (punch list #443, row 7): the rule and the words of the folded line under Bill Customer. Pure.
 *
 * **Void invoice** deletes the bill's row. For a bill of a ZZ test job the function that voids it writes one
 * `voided_test_bills` row first (`supabase/functions/_shared/voidedTestBill.ts`): the bill as it stood, its sends,
 * what was done in Stripe, who voided it and when. This file says who reads that record and how a row reads as
 * lines. The read is `voidedTestBillsIo.ts`. The line is `VoidedTestBillsFold`.
 *
 * Who: a developer, on a ZZ test job. The table lets a developer alone read it, and a real job's bill leaves no
 * row, so nobody else has anything to read and a real job has nothing to ask for. Nothing here can be pressed.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly, formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import { billNumberFromTitle } from './billsSent'

/** What the line reads of each record. */
export const VOIDED_TEST_BILLS_COLS = 'id, invoice_id, job_id, bill, sends, stripe_invoice_id, stripe_action, voided_by_name, voided_at'

/** True when the line may be drawn at all: a developer, on a ZZ test job. */
export function voidedTestBillsDrawn(role: string | null | undefined, job: { job_name?: string | null; customer_name?: string | null } | null | undefined): boolean {
  return role === 'dev' && !!job && isZzTestJob(job)
}

/** One send of a voided bill, as a line. */
export interface VoidedTestBillSendLine {
  key: string
  /** How it went: *Email*, *Printed*, *Email from Stripe*. */
  how: string
  /** Who it went to, by name and address. '' when the record holds neither. */
  to: string
  /** The day and the time it went. '' for a time that does not parse. */
  day: string
  time: string
}

/** One voided test bill, as the line draws it. */
export interface VoidedTestBill {
  id: string
  invoiceId: string
  /** The number on the bill as the payer read it, `1412-0002`, from a send's title. '' when no send carries one. */
  number: string
  /** The bill's amount as it stood. Null when the kept row holds none. */
  amount: number | null
  voidedDay: string
  voidedTime: string
  /** Who voided it. '' when the record holds no name. */
  voidedBy: string
  /** What was done on Stripe's side, in words. */
  stripeWords: string
  stripeInvoiceId: string
  sends: VoidedTestBillSendLine[]
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean) : [])
const rowOf = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const amountOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)

function ms(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

/** A stored instant as the line writes it: the company's day, and the time. Both '' for a time that does not parse. */
export function voidedTestBillWhen(iso: string): { day: string; time: string } {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return { day: '', time: '' }
  return { day: formatWorkDateYmdFriendly(calendarYmdInAppTzFromIso(iso)), time: formatDenverTimeOnly(t) }
}

/** What the function did on Stripe's side, in words, from the word of its own answer. */
const STRIPE_WORDS: Readonly<Record<string, string>> = {
  void: 'Voided in Stripe',
  delete_draft: 'Draft deleted in Stripe',
  noop: 'Already void in Stripe',
  noop_missing: 'Not found in Stripe',
  reverse_oob_mark: 'Paid mark reversed in Stripe',
  db_only_no_stripe_id: 'No invoice in Stripe',
  db_only_non_stripe_collect_send_back: 'Not a Stripe bill',
}

export function voidedTestBillStripeWords(action: string | null | undefined): string {
  const a = (action ?? '').trim()
  return STRIPE_WORDS[a] ?? (a ? a : 'Not on record')
}

/** How a sent copy went, in words. The same words Bills sent uses for a copy's way. */
const COPY_HOW_WORDS: Readonly<Record<string, string>> = { email: 'Email', print: 'Printed', hand: 'Handed over', mail: 'Mailed', link: 'Link sent', download: 'Saved as a file' }

/** The kind of a copy that went to the bill's copy list, beside the send to the payer (`send-stripe-invoice`). */
const COPY_LIST_KIND = 'bill_copy'

/** A copy and the Stripe email filed with it are one send when they went within this long of each other, as on Bills sent. */
const SAME_SEND_MS = 5 * 60_000

/**
 * A record's sends as lines, oldest first. A Stripe email and the copy filed with it are one send, and the copy is
 * the line, since it names who it went to. A Stripe email with no copy near it is its own line.
 */
export function voidedTestBillSendLines(sends: unknown): VoidedTestBillSendLine[] {
  const rows = (Array.isArray(sends) ? sends : []).map(rowOf).filter((r): r is Record<string, unknown> => r != null && !!text(r.id))
  const copies = rows.filter((r) => r.source === 'sent_copy')
  const emails = rows.filter((r) => r.source === 'stripe_email')
  const covered = new Set<string>()
  for (const c of copies) {
    // A copy to the copy list rode with a send. It is no send of its own to fold a Stripe email into.
    if (text(c.how) !== 'email' || text(c.kind) === COPY_LIST_KIND) continue
    let best: Record<string, unknown> | null = null
    for (const e of emails) {
      if (covered.has(text(e.id))) continue
      const gap = Math.abs(ms(text(e.sent_at)) - ms(text(c.sent_at)))
      if (gap <= SAME_SEND_MS && (!best || gap < Math.abs(ms(text(best.sent_at)) - ms(text(c.sent_at))))) best = e
    }
    if (best) covered.add(text(best.id))
  }
  const lines: Array<{ at: number; line: VoidedTestBillSendLine }> = []
  for (const c of copies) {
    const to = [text(c.recipient_name).trim(), texts(c.recipient_emails).join(', ')].filter(Boolean).join(', ')
    const how = text(c.kind) === 'bill_by_hand' ? 'Recorded by hand' : text(c.kind) === COPY_LIST_KIND ? 'Copy by email' : (COPY_HOW_WORDS[text(c.how)] ?? 'Sent')
    lines.push({ at: ms(text(c.sent_at)), line: { key: `copy:${text(c.id)}`, how, to, ...voidedTestBillWhen(text(c.sent_at)) } })
  }
  for (const e of emails) {
    if (covered.has(text(e.id))) continue
    lines.push({ at: ms(text(e.sent_at)), line: { key: `email:${text(e.id)}`, how: 'Email from Stripe', to: texts(e.copy_emails).join(', '), ...voidedTestBillWhen(text(e.sent_at)) } })
  }
  return lines.sort((a, b) => a.at - b.at).map((l) => l.line)
}

/** The bill's number from the first send whose title carries one, as Bills sent reads it. '' when none does. */
function numberOf(sends: unknown): string {
  for (const raw of Array.isArray(sends) ? sends : []) {
    const number = billNumberFromTitle(text(rowOf(raw)?.title))
    if (number) return number
  }
  return ''
}

/** One row of the table as the line draws it. Null for a row with no id. */
export function parseVoidedTestBill(raw: unknown): VoidedTestBill | null {
  const r = rowOf(raw)
  if (!r || !text(r.id)) return null
  const when = voidedTestBillWhen(text(r.voided_at))
  return {
    id: text(r.id),
    invoiceId: text(r.invoice_id),
    number: numberOf(r.sends),
    amount: amountOf(rowOf(r.bill)?.amount),
    voidedDay: when.day,
    voidedTime: when.time,
    voidedBy: text(r.voided_by_name).trim(),
    stripeWords: voidedTestBillStripeWords(text(r.stripe_action)),
    stripeInvoiceId: text(r.stripe_invoice_id).trim(),
    sends: voidedTestBillSendLines(r.sends),
  }
}

/** The folded line's own words: *Voided test bills · 2*. */
export function voidedTestBillsHeading(n: number): string {
  return `Voided test bills · ${n}`
}

/** What the open line says first. */
export const VOIDED_TEST_BILLS_NOTE = 'Only a developer sees this list. Each bill was voided on this test job, and its row was deleted. This is the record the void kept.'

/** What a record with no send says. A text with the pay link is not kept here, so the words claim no more than the record holds. */
export const VOIDED_TEST_BILL_NO_SENDS = 'The record holds no send of this bill.'

/** What stands in for a name the record does not hold. */
export const VOIDED_TEST_BILL_NO_NAME = 'Name not on record'

/** What a Stripe email with no copy says in place of an address. Stripe holds the payer's address, and the row does not. */
export const VOIDED_TEST_BILL_NO_ADDRESS = 'Address not on record'
