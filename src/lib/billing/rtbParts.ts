/**
 * Bill Customer's RTB as the row's bar and three rows (punch list #217, jobs-pipeline-4, a
 * prototype). Today the window's header reads *1327 · Leak under slab · RTB $1,250.00*: the amount
 * about to go out on every channel is a remainder the app worked out (bid − payments made − other
 * open bills, `planPrimaryRtbForBillCustomer`), and the header shows only the answer. This kernel
 * turns the same facts into the Pipeline row's money bar with *this bill* as its next segment and
 * the bid as the frame, and the sum as rows — *Bid − paid · N payments − open bills · N = this bill*,
 * the open bills unfolding to each bill with its day and age — each part with a door to where it is
 * kept. Pure: the component draws fractions and links.
 *
 * The open bills are counted as `otherOpenInvoiceAmounts` counts them (v2.3775): the ready-to-bill
 * and billed rows other than the never-sent primary bundle, each for what is still unpaid on it. A
 * bill being sent from its own row (kind `invoice`) is *this bill*, never one of the open ones.
 */

import { formatCurrency } from '../format'
import { calendarYmdInAppTzFromIso, ymdDaysBetween } from '../../utils/dateUtils'
import { appliedCentsByInvoiceId, moneyCents, openLineCents } from './openLineAllocation'

export type RtbPartsInvoice = {
  id: string
  status: string | null
  amount: number | string | null
  is_primary_rtb_bundle: boolean | null
  billed_at: string | null
  sequence_order: number | null
}

export type RtbPartsPayment = { invoice_id?: string | null; amount: number | string | null }

export type RtbPartsInput = {
  jobId: string
  revenue: number | null | undefined
  paymentsMade: number | null | undefined
  invoices: ReadonlyArray<RtbPartsInvoice>
  payments: ReadonlyArray<RtbPartsPayment>
  /** The bill about to go: the planned primary's amount, or the row's own amount and id. */
  thisBill: { amount: number; invoiceId: string | null }
  todayYmd: string
}

export type RtbSegmentKind = 'paid' | 'open' | 'this' | 'rest'
export type RtbSegment = { kind: RtbSegmentKind; amount: number; fraction: number; label: string; title: string }

export type RtbOpenBill = {
  id: string
  /** *Bill 1*, in the order they went out. */
  label: string
  ymd: string | null
  /** *Sep 12*, or *draft* for a row never sent. */
  dayWords: string
  /** Days since it went out; null for a draft. */
  days: number | null
  /** What is still unpaid on it: what stands against the remainder. */
  open: number
  face: number
  applied: number
}

export type RtbRowKind = 'bid' | 'paid' | 'open' | 'this'
export type RtbRow = {
  kind: RtbRowKind
  words: string
  amount: number
  sign: '' | '−' | '='
  door: { label: string; href: string } | null
}

export type RtbParts = {
  bid: number
  paid: number
  paidCount: number
  open: number
  openBills: RtbOpenBill[]
  thisBill: number
  /** What the bid still holds after this bill; 0 when this bill closes it. */
  rest: number
  /** The frame in dollars: the bid, or the parts when they run past it. */
  scale: number
  segments: RtbSegment[]
  rows: RtbRow[]
  /** Under the bar's right end: *this bill is the rest* or *$X left after this bill*. */
  frameWords: string
  /** One sentence when the parts run past the bid, so the reader sees why the bill is small. */
  note: string | null
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const round2 = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${formatCurrency(n)}`

/** `2026-09-12` → `Sep 12`; '' for anything else. */
export function rtbDayWords(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return m >= 1 && m <= 12 ? `${MONTH[m - 1]} ${d}` : ''
}

function frac(amount: number, scale: number): number {
  return scale > 0.004 ? Math.max(0, Math.min(1, amount / scale)) : 0
}

/** The Edit Job window, where the bid's price and the job's bills are kept. */
export function rtbEditJobHref(jobId: string): string {
  return `/jobs?tab=stages&edit=${encodeURIComponent(jobId)}`
}

/** The Edit Job window on ③ Payments received. */
export function rtbPaymentsHref(jobId: string): string {
  return `${rtbEditJobHref(jobId)}&editFocus=payments`
}

/** The open bills as `otherOpenInvoiceAmounts` counts them, oldest first, each with its day and age. */
export function rtbOpenBills(input: Pick<RtbPartsInput, 'invoices' | 'payments' | 'thisBill' | 'todayYmd'>): RtbOpenBill[] {
  const applied = appliedCentsByInvoiceId(input.payments)
  const rows = input.invoices
    .filter((inv) => (inv.status === 'ready_to_bill' || inv.status === 'billed') && !(inv.status === 'ready_to_bill' && inv.is_primary_rtb_bundle === true) && inv.id !== input.thisBill.invoiceId)
    .map((inv) => {
      const ymd = inv.billed_at ? calendarYmdInAppTzFromIso(inv.billed_at) : null
      return { inv, ymd }
    })
    .sort((a, b) => (a.ymd ?? '9999').localeCompare(b.ymd ?? '9999') || (a.inv.sequence_order ?? 0) - (b.inv.sequence_order ?? 0) || a.inv.id.localeCompare(b.inv.id))
  return rows.map(({ inv, ymd }, i) => {
    const appliedCents = applied.get(inv.id) ?? 0
    return {
      id: inv.id,
      label: `Bill ${i + 1}`,
      ymd,
      dayWords: ymd ? rtbDayWords(ymd) : 'draft',
      days: ymd ? Math.max(0, ymdDaysBetween(ymd, input.todayYmd) ?? 0) : null,
      open: openLineCents(inv.amount, appliedCents) / 100,
      face: moneyCents(inv.amount) / 100,
      applied: appliedCents / 100,
    }
  })
}

export function rtbParts(input: RtbPartsInput): RtbParts {
  const bid = round2(Math.max(0, Number(input.revenue ?? 0) || 0))
  const paid = round2(Math.max(0, Number(input.paymentsMade ?? 0) || 0))
  const paidCount = input.payments.length
  const openBills = rtbOpenBills(input)
  const open = round2(openBills.reduce((s, b) => s + b.open, 0))
  const thisBill = round2(Math.max(0, input.thisBill.amount))
  const rest = round2(Math.max(0, bid - paid - open - thisBill))
  const scale = round2(Math.max(bid, paid + open + thisBill))

  const segments: RtbSegment[] = []
  if (paid > 0.004) segments.push({ kind: 'paid', amount: paid, fraction: frac(paid, scale), label: usd(paid), title: `${usd(paid)} paid · ${paidCount} payment${paidCount === 1 ? '' : 's'}` })
  if (open > 0.004) segments.push({ kind: 'open', amount: open, fraction: frac(open, scale), label: usd(open), title: `${usd(open)} on ${openBills.length} open bill${openBills.length === 1 ? '' : 's'}, still unpaid` })
  if (thisBill > 0.004) segments.push({ kind: 'this', amount: thisBill, fraction: frac(thisBill, scale), label: usd(thisBill), title: `This bill, ${usd(thisBill)}` })
  if (rest > 0.004) segments.push({ kind: 'rest', amount: rest, fraction: frac(rest, scale), label: '', title: `${usd(rest)} of the bid left after this bill` })

  const over = round2(paid + open + thisBill - bid)
  const note = over > 0.004 && bid > 0.004 ? `Paid and open bills come to ${usd(over)} more than the bid, so the frame is drawn to them.` : null
  const frameWords = rest > 0.004 ? `${usd(rest)} left after this bill` : thisBill > 0.004 ? 'this bill is the rest' : 'nothing left to bill'

  const rows: RtbRow[] = [
    { kind: 'bid', words: 'Bid', amount: bid, sign: '', door: { label: 'Edit tab', href: rtbEditJobHref(input.jobId) } },
    { kind: 'paid', words: `Paid · ${paidCount} payment${paidCount === 1 ? '' : 's'}`, amount: paid, sign: '−', door: { label: 'Payments', href: rtbPaymentsHref(input.jobId) } },
    { kind: 'open', words: `Open bills · ${openBills.length}`, amount: open, sign: '−', door: null },
    { kind: 'this', words: 'This bill', amount: thisBill, sign: '=', door: null },
  ]

  return { bid, paid, paidCount, open, openBills, thisBill, rest, scale, segments, rows, frameWords, note }
}

/** *Bill 1 · Sep 12 · 48 d* — one open bill's line under the unfolded row. */
export function rtbOpenBillWords(b: RtbOpenBill): string {
  if (b.days == null) return `${b.label} · ${b.dayWords}`
  return `${b.label} · ${b.dayWords} · ${b.days} d`
}
