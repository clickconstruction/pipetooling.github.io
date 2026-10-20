/**
 * The trail (punch list #129, v2.5651): what a job's people may already read about its money, on one timeline, for
 * the person who reads no job row: the bills (billed, open or paid, the pay page), the payments (the day, the amount),
 * the customer's words (a day they will pay by, or that they say they paid, who heard it) and their lines in Messages
 * (the texts, emails and calls both ways). The office's Job activity is wider (the notes, the crew, the sends); this is
 * the money's story, from the money line's own read and the job's lines. Pure.
 */
import { claimWords, promiseSaidLine, type PaymentPromise } from '../jobs/paymentPromises'
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import type { BidMoneyLine } from './bidMoneyLine'

export type TrailItemKind = 'bill' | 'payment' | 'word' | 'line'

export interface TrailItem {
  key: string
  kind: TrailItemKind
  /** The day, YYYY-MM-DD, for the order and the heading. */
  ymd: string
  /** The time within it when there is one (a word, a line), for the order. */
  at: string
  /** "Bill sent", "Payment", "They said", "Dana", "Theo". */
  who: string
  /** "$4,200 · open · pay page", "$1,200 landed", "will pay by Oct 25 · Dana · by text · heard by Theo". */
  words: string
  /** The customer's own line, drawn in their orange. */
  theirs: boolean
  /** A link to open: the pay page. */
  href?: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
function monthDayYear(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}, ${ymd.slice(0, 4)}`
}
function monthDay(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}
function money(n: number): string {
  const cents = Math.round(n * 100)
  if (cents % 100 === 0) return `$${(cents / 100).toLocaleString('en-US')}`
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function ymdOf(iso: string): string {
  return iso.slice(0, 10)
}

/** The customer's word, as the trail says it. */
export function wordWords(p: PaymentPromise): string {
  const said = promiseSaidLine(p)
  const what = p.kind === 'paid_claim' ? `says they paid ${monthDay(p.promisedYmd)} · ${claimWords(p)}` : `will pay by ${monthDay(p.promisedYmd)}`
  return [what, said, p.note ? `“${p.note}”` : null].filter(Boolean).join(' · ')
}

/** A line's words: a call by its summary, else its length; a text or an email by its body. */
function lineWords(m: JobActivityMessage): string {
  if (m.channel === 'call' || m.channel === 'voicemail' || m.channel === 'missed') {
    const what = m.channel === 'missed' ? 'missed call' : m.channel
    const summary = (m.summary ?? '').trim()
    return summary ? `${what} · ${summary}` : what
  }
  const body = (m.subject ?? '').trim() || m.body.trim()
  return `${m.channel} · ${body}`
}

/** The money's story on the job, newest first. */
export function buildMoneyTrail(line: BidMoneyLine, lines: readonly JobActivityMessage[] | null): TrailItem[] {
  const items: TrailItem[] = []
  for (const b of line.bills) {
    if (!b.billedYmd) continue
    items.push({ key: `bill-${b.id}`, kind: 'bill', ymd: b.billedYmd, at: `${b.billedYmd}T00:00:00`, who: 'Bill sent', words: `${money(b.amount)} · ${b.open ? 'open' : 'paid'}${b.payUrl ? ' · pay page' : ''}`, theirs: false, href: b.payUrl })
  }
  line.payments.forEach((p, i) => {
    if (!p.paid_on) return
    items.push({ key: `payment-${i}`, kind: 'payment', ymd: p.paid_on, at: `${p.paid_on}T00:00:01`, who: 'Payment', words: `${money(Number(p.amount ?? 0))} landed`, theirs: false })
  })
  for (const w of line.words) {
    items.push({ key: `word-${w.id}`, kind: 'word', ymd: ymdOf(w.createdAt), at: w.createdAt, who: 'They said', words: wordWords(w), theirs: false })
  }
  for (const m of lines ?? []) {
    if (m.channel === 'note' || m.channel === 'event') continue
    const theirs = m.direction === 'in'
    items.push({ key: `line-${m.id}`, kind: 'line', ymd: ymdOf(m.at), at: m.at, who: theirs ? m.contact.goesBy?.trim() || m.contact.name : m.who || 'The app', words: lineWords(m), theirs })
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key.localeCompare(b.key)))
}

/** The day heading over a run of items. */
export function trailDayWords(ymd: string): string {
  return monthDayYear(ymd)
}

export const TRAIL_EMPTY = 'Nothing on the money yet: no bill, no payment, no word.'
