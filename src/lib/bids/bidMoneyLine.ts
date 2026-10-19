/**
 * The money line under a won bid (punch list #129, v2.5647): where the job born of a bid stands on money, for the
 * job's people, who read no job row of their own. The read (`list_bid_money_strip`, `useBidMoneyStrip`) hands in the
 * job, its bills, its payments and its live promises in the rows the app's own kernels take, and this works out what
 * the line says: the stage, what is still open after the payment rule (`billPapers` over the AR page's bill truth),
 * the newest open bill's pay page, the customer's latest word and how far past it the day is. Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { shortDate } from '../gc/words'
import { claimWords, parsePaymentPromisesRpc, promiseSaidLine, promisesOnJob, type PaymentPromise } from '../jobs/paymentPromises'
import { STALE_AFTER_DAYS } from '../jobs/paidClaims'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { billPapers, type BillPaper, type PaperInvoiceRow, type PaperJobRow, type PaperPaymentRow } from '../messages/papers'

/** One entry, as the reads return it: a bid's (`list_bid_money_strip`) or a customer's job's (`list_customer_money_strip`, v2.5649, `bidId` the job's bid or null). */
export interface BidMoneyStripEntry {
  bidId: string | null
  job: PaperJobRow & {
    customer_id: string | null
    customer_name: string | null
    customer_phone: string | null
    customer_email: string | null
    created_at: string | null
  }
  invoices: (PaperInvoiceRow & { created_at: string | null })[]
  payments: PaperPaymentRow[]
  /** The job's live promises, the shape of `list_job_payment_promises`. */
  promises: unknown
}

/** Defensive parse of `list_bid_money_strip` and `list_customer_money_strip`: an entry needs a job with an id; the rest reads as empty. */
export function parseBidMoneyStrip(raw: unknown): BidMoneyStripEntry[] {
  if (!Array.isArray(raw)) return []
  const out: BidMoneyStripEntry[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    const job = r.job
    if (job == null || typeof job !== 'object' || typeof (job as { id?: unknown }).id !== 'string') continue
    out.push({
      bidId: typeof r.bidId === 'string' ? r.bidId : null,
      job: job as BidMoneyStripEntry['job'],
      invoices: Array.isArray(r.invoices) ? (r.invoices as BidMoneyStripEntry['invoices']) : [],
      payments: Array.isArray(r.payments) ? (r.payments as PaperPaymentRow[]) : [],
      promises: r.promises,
    })
  }
  return out
}

export type BidMoneyTone = 'quiet' | 'amber' | 'red' | 'green'

export interface BidMoneyLine {
  bidId: string | null
  job: {
    id: string
    /** The job's number, as the board shows it: "1032". '' when it has none. */
    number: string
    name: string
    status: string | null
    customerId: string | null
    customerName: string | null
    customerPhone: string | null
    customerEmail: string | null
    createdAt: string | null
  }
  /** "Working", "Billed Sep 30", "Paid". */
  stage: string
  /** What is still open across the job's bills after the payment rule; null while nothing is billed. */
  open: number | null
  bills: BillPaper[]
  /** The newest open bill's pay page; null when no open bill is on Stripe. */
  payUrl: string | null
  /** The customer's latest live word on this job: a promise, or since v2.5648 a paid claim (`kind`). */
  promise: PaymentPromise | null
  /** Days today is past the promised day while money is open; null otherwise, and null for a paid claim. */
  pastDays: number | null
  /** A paid claim with nothing landed on the job since the day they named: the days since, once `STALE_AFTER_DAYS` or more (v2.5650). */
  staleDays: number | null
  tone: BidMoneyTone
  /** The job's payments and every live word, newest first, for the trail (v2.5651). */
  payments: PaperPaymentRow[]
  words: PaymentPromise[]
}

const STAGE_WORDS: Record<string, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to bill',
  billed: 'Billed',
  collections: 'Collections',
  paid: 'Paid',
}

const DAY_MS = 86_400_000

function daysBetween(fromYmd: string, toYmd: string): number {
  const at = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  return Math.round((at(toYmd) - at(fromYmd)) / DAY_MS)
}

/** Today in the app's calendar, for the line's "days past". */
export function todayYmd(now: Date = new Date()): string {
  return calendarYmdInAppTzFromIso(now.toISOString()) || now.toISOString().slice(0, 10)
}

/** The line for one bid's entry. */
export function bidMoneyLine(entry: BidMoneyStripEntry, today: string): BidMoneyLine {
  const job = entry.job
  const bills = billPapers({ jobs: [job], invoices: entry.invoices, payments: entry.payments })
  const openBills = bills.filter((b) => b.open)
  const billed = bills.length > 0
  const open = billed ? openBills.reduce((sum, b) => sum + b.amount, 0) : null
  const billedDays = bills.map((b) => b.billedYmd).filter((d): d is string => !!d).sort()
  const newestBilled = billedDays.length ? billedDays[billedDays.length - 1]! : null
  const status = job.status ?? null
  const stageWord = STAGE_WORDS[status ?? ''] ?? (status ? status.replace(/_/g, ' ') : 'Job')
  const stage = (status === 'billed' || status === 'collections' || status === 'paid') && newestBilled ? `${stageWord} ${shortDate(newestBilled)}` : stageWord
  const words = promisesOnJob(parsePaymentPromisesRpc(entry.promises), job.id)
  const promise = words[0] ?? null
  const moneyOpen = open != null && open > 0
  const past = promise && promise.kind !== 'paid_claim' && moneyOpen ? daysBetween(promise.promisedYmd, today) : 0
  const pastDays = past > 0 ? past : null
  // A claim with nothing landed since the day they named comes back amber after a week (punch list #129 PR 4).
  const landedSince = promise?.kind === 'paid_claim' ? entry.payments.some((p) => (p.paid_on ?? '') >= promise.promisedYmd) : true
  const since = promise?.kind === 'paid_claim' && moneyOpen && !landedSince ? daysBetween(promise.promisedYmd, today) : 0
  const staleDays = since >= STALE_AFTER_DAYS ? since : null
  const tone: BidMoneyTone = !billed ? 'quiet' : !moneyOpen ? 'green' : pastDays ? 'red' : staleDays ? 'amber' : promise ? 'quiet' : 'amber'
  return {
    bidId: entry.bidId,
    job: {
      id: job.id,
      number: effectiveJobLedgerNumber(job.hcp_number, job.click_number),
      name: (job.job_name ?? '').trim(),
      status,
      customerId: job.customer_id ?? null,
      customerName: job.customer_name ?? null,
      customerPhone: job.customer_phone ?? null,
      customerEmail: job.customer_email ?? null,
      createdAt: job.created_at ?? null,
    },
    stage,
    open,
    bills,
    payUrl: openBills.find((b) => b.payUrl)?.payUrl ?? null,
    promise,
    pastDays,
    staleDays,
    tone,
    payments: entry.payments,
    words,
  }
}

/** The lines for every entry that has a bid, by bid. */
export function bidMoneyLinesByBid(entries: readonly BidMoneyStripEntry[], today: string): Map<string, BidMoneyLine> {
  return new Map(entries.filter((e) => e.bidId).map((e) => [e.bidId!, bidMoneyLine(e, today)]))
}

export interface BidMoneyWords {
  /** "Billed Sep 30", "Working". */
  stage: string
  /** "$4,200 open", "not billed yet", "paid". */
  money: string
  /** "They said Oct 25", "Said Oct 25 · 4 days past", "They say they paid · a check in the mail · Oct 20", "no word yet"; null when nothing is billed or it is paid. */
  word: string | null
  /** "Dana, by text, heard by Theo"; null with no word. */
  by: string | null
}

/** What the line says, left to right. */
export function bidMoneyWords(line: BidMoneyLine): BidMoneyWords {
  const open = line.open
  const money = open == null ? 'not billed yet' : open > 0 ? `${moneyWords(open)} open` : 'paid'
  if (open == null || open <= 0) return { stage: line.stage, money, word: null, by: null }
  const p = line.promise
  if (!p) return { stage: line.stage, money, word: 'no word yet', by: null }
  const day = shortDate(p.promisedYmd)
  if (p.kind === 'paid_claim') {
    const stale = line.staleDays ? ` \u00b7 nothing landed in ${line.staleDays === 1 ? '1 day' : `${line.staleDays} days`}` : ''
    return { stage: line.stage, money, word: `They say they paid \u00b7 ${claimWords(p)} \u00b7 ${day}${stale}`, by: promiseSaidLine(p) || null }
  }
  const word = line.pastDays ? `Said ${day} · ${line.pastDays === 1 ? '1 day' : `${line.pastDays} days`} past` : `They said ${day}`
  return { stage: line.stage, money, word, by: promiseSaidLine(p) || null }
}

function moneyWords(n: number): string {
  const cents = Math.round(n * 100)
  if (cents % 100 === 0) return `$${(cents / 100).toLocaleString('en-US')}`
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Send the pay page is offered while an open bill has one and the customer can be reached. */
export function canSendPayPage(line: BidMoneyLine): boolean {
  return !!line.payUrl && !!line.job.customerId && (!!(line.job.customerPhone ?? '').trim() || !!(line.job.customerEmail ?? '').trim())
}

/** The kind the door opens in for the pay page: a text when they have a number, else an email. */
export function payPageKind(line: BidMoneyLine): 'text' | 'email' {
  return (line.job.customerPhone ?? '').trim() ? 'text' : 'email'
}
