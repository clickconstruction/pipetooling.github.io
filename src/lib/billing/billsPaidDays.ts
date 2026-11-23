/**
 * Bills sent, the second view, By day paid (punch list #422, PR 3). Pure.
 *
 * The first view lists bills in the order they went. This one lists money in the order it came: a month of days,
 * each with what came in, and behind a picked day its payments. The owner asked for it so the leader can see how
 * much comes in from Stripe on any given day; it shows every way of paying, with a chip that narrows it to Stripe,
 * since Stripe is under a fifth of the payments.
 *
 * What a day's figure is, from what the app keeps:
 *   - a payment sits on its `paid_on` (`billPaymentYmd`): for a Stripe payment the day the customer paid, for a
 *     matched deposit the day it posted at the bank, for a payment typed by hand the day the person named;
 *   - the amount is what the payment took off the bill. Stripe's fee is not taken off: the app does not keep it;
 *   - a credit in kind is listed and never added: it is not money;
 *   - a payment on a test-mode bill is left out;
 *   - a refund made in Stripe is not seen, so it lowers no day.
 * One deposit that paid several bills is drawn once, with its bills under it (`billsPaidDayGroups`).
 *
 * The reads are `billsPaidIo.ts`, the screen `components/billing/BillsPaidByDay.tsx`.
 */
import { calendarYmdInAppTzFromIso, companyWeekStartSundayContaining, formatDenverTimeOnly, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays } from '../../utils/dateUtils'
import { escapeCsvField } from '../domTableToCsv'
import { formatCurrency } from '../format'
import { instrumentWord, isStripePayment } from '../jobs/billsAndPayments'
import { sentCopyJobLabel, type SentCopyAboutJob } from '../sent/sentCopyAbout'
import { isInKindPaymentType } from '../../../supabase/functions/_shared/inKindPayment'
import { billPaymentWayWords, billPaymentYmd, type BillPaidBill, type BillPayment } from './billsPaid'

/** A payment as this view reads it: on a bill, or on a job with no bill named. */
export type BillsPaidPayment = Omit<BillPayment, 'billId'> & { billId: string | null; jobId: string | null }

/** The bill a payment is on, with what dates it and what leaves it out. */
export interface BillsPaidBill extends BillPaidBill {
  jobId: string | null
  /** *test* for a bill made in Stripe's test mode: its payments are no money. */
  stripeMode?: string | null
  /** The bill's own send stamp and the time it was made: the day it went, when no sent copy says. */
  sentAtIso?: string | null
  billedAtIso?: string | null
}

export interface BillsPaidJob extends SentCopyAboutJob {
  customer_name?: string | null
}

export interface BillsPaidInput {
  payments: ReadonlyArray<BillsPaidPayment>
  bills: ReadonlyMap<string, BillsPaidBill>
  jobs: ReadonlyMap<string, BillsPaidJob>
  /** The number each bill carries, from a sent copy's title. A bill with none reads *Bill*. */
  numbers?: ReadonlyMap<string, string>
  /** The first send on record of each bill, by bill id. */
  firstSent?: ReadonlyMap<string, string>
  /** Who each bill went to, by bill id, from its sent copy. A bill with none is named by its job's customer. */
  sentTo?: ReadonlyMap<string, string>
}

/** How the money came, as the chips sort it. */
export type BillsPaidHow = 'stripe' | 'check' | 'bank' | 'cash' | 'other'
export type BillsPaidChip = BillsPaidHow | 'all'

/** The chips, in the order they are drawn. *Stripe* is always offered: it is the one the view was asked for. */
export const BILLS_PAID_CHIPS: ReadonlyArray<{ key: BillsPaidChip; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'check', label: 'Check' },
  { key: 'bank', label: 'Bank transfer' },
  { key: 'cash', label: 'Cash' },
  { key: 'other', label: 'Other' },
]

/** A chip's words after *Nothing came in*: *from Stripe*, *by check*. '' for every way. */
const HOW_TAIL: Readonly<Record<BillsPaidChip, string>> = { all: '', stripe: ' from Stripe', check: ' by check', bank: ' by bank transfer', cash: ' in cash', other: ' any other way' }

export function isBillsPaidChip(v: string | null | undefined): v is BillsPaidChip {
  return BILLS_PAID_CHIPS.some((c) => c.key === v)
}

/** One payment as the view draws it. */
export interface BillsPaidLine {
  id: string
  /** The day it counts on, YYYY-MM-DD. */
  ymd: string
  how: BillsPaidHow
  /** *Card · Stripe*, *Check 4417 · bank deposit*: the job window's words. */
  wayWords: string
  amount: number
  /** A credit and no money: listed, never added. */
  inKind: boolean
  billId: string | null
  /** *Bill 1420-0001*, *Bill*, or *Payment* for money on a job with no bill named. */
  what: string
  jobWords: string
  jobTo: string | null
  payer: string
  /** The instant a Stripe payment was recorded, to say its time. Null for every other way. */
  atIso: string | null
  /** The day the bill first went, YYYY-MM-DD. '' when the app has no day for it. */
  sentYmd: string
  /** Whole days from the bill going out to the money. Null when either day is unknown, or the money came first. */
  took: number | null
  /** The bank deposit the payment is matched to: payments that share one are one deposit. */
  depositId: string | null
  /** The check's number, when the row holds one. */
  reference: string
  /** True when the bill is still open after this payment: the payment is part of it. */
  partOfBill: boolean
}

/** How a payment came, for the chips. A check is a check whoever recorded it. A matched deposit that is no check is a bank transfer. */
export function billsPaidHowOf(p: Pick<BillsPaidPayment, 'note' | 'paymentType' | 'bankTransactionId'>): BillsPaidHow {
  if (isStripePayment(p)) return 'stripe'
  const word = instrumentWord(p.paymentType)
  if (word === 'check') return 'check'
  if (word === 'cash') return 'cash'
  if (word === 'wire' || word === 'ach' || (p.bankTransactionId ?? '').trim()) return 'bank'
  return 'other'
}

const dayGap = (fromYmd: string, toYmd: string): number | null => {
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 86_400_000) : null
}

/**
 * The payments as lines, newest day first. Within a day a Stripe payment comes first, newest first, then the
 * rest with one deposit's payments together. A payment with no day, no amount to add, or on a test-mode bill is
 * left out.
 */
export function billsPaidLines(input: BillsPaidInput): BillsPaidLine[] {
  const lines: BillsPaidLine[] = []
  for (const p of input.payments) {
    const bill = p.billId ? input.bills.get(p.billId) : undefined
    if ((bill?.stripeMode ?? '').trim() === 'test') continue
    const ymd = billPaymentYmd(p)
    if (!ymd || !(p.amount > 0)) continue
    const jobId = p.jobId ?? bill?.jobId ?? null
    const job = jobId ? input.jobs.get(jobId) : undefined
    const number = p.billId ? (input.numbers?.get(p.billId) ?? '') : ''
    const sentIso = (p.billId ? input.firstSent?.get(p.billId) : undefined) ?? bill?.sentAtIso ?? bill?.billedAtIso ?? ''
    const sentYmd = sentIso ? calendarYmdInAppTzFromIso(sentIso) : ''
    const stripe = isStripePayment(p)
    lines.push({
      id: p.id,
      ymd,
      how: billsPaidHowOf(p),
      wayWords: billPaymentWayWords(p, bill),
      amount: p.amount,
      inKind: isInKindPaymentType(p.paymentType),
      billId: p.billId,
      what: p.billId ? (number ? `Bill ${number}` : 'Bill') : 'Payment',
      jobWords: jobId ? sentCopyJobLabel(jobId, job) : '',
      jobTo: jobId ? `/jobs?edit=${encodeURIComponent(jobId)}` : null,
      // The one who was billed, as By day sent names them: a builder pays for a homeowner's job, and the two views once named one bill two ways.
      payer: ((p.billId ? input.sentTo?.get(p.billId) : '') ?? '').trim() || (job?.customer_name ?? '').trim(),
      atIso: stripe ? p.createdAtIso : null,
      sentYmd,
      took: sentYmd ? dayGap(sentYmd, ymd) : null,
      depositId: (p.bankTransactionId ?? '').trim() || null,
      reference: (p.referenceNumber ?? '').trim().replace(/^#/, ''),
      partOfBill: !!bill && bill.status === 'billed',
    })
  }
  const time = (l: BillsPaidLine): number => (l.atIso ? Date.parse(l.atIso) || 0 : 0)
  return lines.sort(
    (a, b) =>
      b.ymd.localeCompare(a.ymd) ||
      Number(b.how === 'stripe') - Number(a.how === 'stripe') ||
      time(b) - time(a) ||
      (a.depositId ?? '~').localeCompare(b.depositId ?? '~') ||
      a.id.localeCompare(b.id),
  )
}

/** The lines a chip leaves. */
export function billsPaidFilter(lines: ReadonlyArray<BillsPaidLine>, how: BillsPaidChip): BillsPaidLine[] {
  return how === 'all' ? lines.slice() : lines.filter((l) => l.how === how)
}

/** The chips to draw: every way, Stripe, then each other way some payment in these lines came by. */
export function billsPaidChips(lines: ReadonlyArray<BillsPaidLine>): ReadonlyArray<{ key: BillsPaidChip; label: string }> {
  const seen = new Set(lines.map((l) => l.how))
  return BILLS_PAID_CHIPS.filter((c) => c.key === 'all' || c.key === 'stripe' || seen.has(c.key))
}

/** A count of payments and what they add to. A credit in kind is in neither. */
export interface BillsPaidSum {
  payments: number
  total: number
}

export function billsPaidSum(lines: ReadonlyArray<BillsPaidLine>): BillsPaidSum {
  const money = lines.filter((l) => !l.inKind)
  return { payments: money.length, total: Math.round(money.reduce((s, l) => s + l.amount, 0) * 100) / 100 }
}

// ---------- The month ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const
const MONTH = /^(\d{4})-(\d{2})$/

/** *2026-11* from a day or a month. '' when neither. */
export function billsPaidMonthOf(ymdOrMonth: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec((ymdOrMonth ?? '').trim())
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2]}` : ''
}

/** *November 2026*. */
export function billsPaidMonthLabel(month: string): string {
  const m = MONTH.exec(month)
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}` : ''
}

/** *November*: the month alone, for a tile. */
export function billsPaidMonthName(month: string): string {
  const m = MONTH.exec(month)
  return m ? (MONTHS[Number(m[2]) - 1] ?? '') : ''
}

/** The month before or after. */
export function billsPaidShiftMonth(month: string, by: number): string {
  const m = MONTH.exec(month)
  if (!m) return month
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * The words on a month step: the month it opens, short, *Oct*. The year joins when the step leaves the year on
 * the screen, *Dec 2025*, so a press across New Year says where it lands.
 */
export function billsPaidStepLabel(month: string, by: number): string {
  const to = MONTH.exec(billsPaidShiftMonth(month, by))
  if (!to || !MONTH.test(month)) return ''
  const short = (MONTHS[Number(to[2]) - 1] ?? '').slice(0, 3)
  return to[1] === month.slice(0, 4) ? short : `${short} ${to[1]}`
}

/** A month's first and last day. */
export function billsPaidMonthSpan(month: string): { first: string; last: string } {
  const m = MONTH.exec(month)
  if (!m) return { first: '', last: '' }
  const days = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, '0')}` }
}

/**
 * The days to read for a month. This month is read back to the Sunday that began this week, so the week's tile
 * is whole when the week began in the month before.
 */
export function billsPaidRange(month: string, todayYmd: string): { from: string; to: string } {
  const { first, last } = billsPaidMonthSpan(month)
  if (billsPaidMonthOf(todayYmd) !== month) return { from: first, to: last }
  const week = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
  return { from: week < first ? week : first, to: last }
}

/** One day of the month's grid. */
export interface BillsPaidCell {
  ymd: string
  /** The day of the month, 1 to 31. */
  day: number
  sum: BillsPaidSum
  today: boolean
  /** A day that has not come: it is drawn and cannot be pressed. */
  later: boolean
}

/** The month as a grid whose weeks begin on Sunday: the blanks before the 1st, then each day with what came in. */
export function billsPaidMonthCells(lines: ReadonlyArray<BillsPaidLine>, month: string, todayYmd: string): { blanks: number; cells: BillsPaidCell[] } {
  const { first, last } = billsPaidMonthSpan(month)
  if (!first) return { blanks: 0, cells: [] }
  const byDay = new Map<string, BillsPaidLine[]>()
  for (const l of lines) byDay.set(l.ymd, [...(byDay.get(l.ymd) ?? []), l])
  const cells: BillsPaidCell[] = []
  for (let ymd = first; ymd <= last; ymd = ymdAddDays(ymd, 1)) {
    cells.push({ ymd, day: Number(ymd.slice(8)), sum: billsPaidSum(byDay.get(ymd) ?? []), today: ymd === todayYmd, later: ymd > todayYmd })
  }
  return { blanks: new Date(`${first}T12:00:00Z`).getUTCDay(), cells }
}

/** The day the view opens a month on: today in this month, else the newest day money came, else the month's last day that has come. */
export function billsPaidOpeningDay(lines: ReadonlyArray<BillsPaidLine>, month: string, todayYmd: string): string {
  if (billsPaidMonthOf(todayYmd) === month) return todayYmd
  const { last } = billsPaidMonthSpan(month)
  const newest = lines.find((l) => billsPaidMonthOf(l.ymd) === month && !l.inKind)?.ymd
  return newest ?? (last > todayYmd ? todayYmd : last)
}

/**
 * A grid cell's amount, written to fit the cell, with the exact figure on the picked day beside it. At a desk a
 * cell holds four digits whole (*$7,935*), then thousands with one decimal (*$10.2k*). A phone's cell is about
 * 46 px wide: three digits whole (*$640*), one decimal under ten thousand (*$5.8k*), then the thousands alone (*$13k*).
 */
export function billsPaidCellMoney(total: number, phone: boolean): string {
  const whole = Math.round(total)
  const oneDecimal = `$${String(Math.round(total / 100) / 10).replace(/\.0$/, '')}k`
  const thousands = `$${Math.round(total / 1000)}k`
  if (phone) return whole < 1000 ? `$${whole}` : whole < 9950 ? oneDecimal : thousands
  return whole < 10000 ? `$${formatCurrency(whole).replace(/\.00$/, '')}` : whole < 99950 ? oneDecimal : thousands
}

/** A grid cell's small line under its amount: *3 paid*. The whole word *payments* is wider than a day. */
export function billsPaidCellCount(sum: Pick<BillsPaidSum, 'payments'>): string {
  return `${sum.payments} paid`
}

/** What a screen reader hears on a day: *Wed, Nov 18, $7,935.00, 3 payments*, or that nothing came in. */
export function billsPaidCellLabel(cell: Pick<BillsPaidCell, 'ymd' | 'sum'>): string {
  const day = formatWorkDateYmdWeekdayShortFriendly(cell.ymd)
  return cell.sum.payments > 0 ? `${day}, ${billsPaidMoney(cell.sum.total)}, ${plural(cell.sum.payments, 'payment')}` : `${day}, nothing came in`
}

// ---------- A day ----------

/** A day's payments in the groups they are drawn in: one deposit's payments together, every other payment alone. */
export interface BillsPaidGroup {
  /** The deposit the payments share. Null for a payment that stands alone. */
  depositId: string | null
  lines: BillsPaidLine[]
  total: number
  /** *Check 4417*, when the deposit's payments name one check. '' otherwise. */
  checkWords: string
}

export function billsPaidDayGroups(dayLines: ReadonlyArray<BillsPaidLine>): BillsPaidGroup[] {
  const out: BillsPaidGroup[] = []
  for (const l of dayLines) {
    const last = out[out.length - 1]
    if (l.depositId && last && last.depositId === l.depositId) last.lines.push(l)
    else out.push({ depositId: l.depositId, lines: [l], total: 0, checkWords: '' })
  }
  for (const g of out) {
    g.total = billsPaidSum(g.lines).total
    const refs = [...new Set(g.lines.map((l) => l.reference).filter(Boolean))]
    g.checkWords = g.lines.every((l) => l.how === 'check') && refs.length === 1 ? `Check ${refs[0]}` : ''
  }
  return out
}

/** A deposit's heading over its bills: *One deposit · Check 4417 · 2 bills*. '' for a payment that stands alone. */
export function billsPaidGroupWords(group: Pick<BillsPaidGroup, 'depositId' | 'lines' | 'checkWords'>): string {
  if (!group.depositId || group.lines.length < 2) return ''
  return ['One deposit', group.checkWords, plural(group.lines.length, 'bill')].filter(Boolean).join(' · ')
}

/** *Today · Mon, Nov 23*, or the day alone. */
export function billsPaidDayHeading(ymd: string, todayYmd: string): string {
  const day = formatWorkDateYmdWeekdayShortFriendly(ymd)
  return ymd === todayYmd ? `Today · ${day}` : day
}

/** How long the money took, after the day the bill went: *the same day*, *6 days after it went*. '' when not known. */
export function billsPaidTookWords(line: Pick<BillsPaidLine, 'took'>): string {
  if (line.took == null) return ''
  return line.took === 0 ? 'the same day' : `${plural(line.took, 'day')} after it went`
}

/** A Stripe payment's time, Central: *8:21 AM*. '' for every other way. */
export function billsPaidTime(line: Pick<BillsPaidLine, 'atIso'>): string {
  const t = line.atIso ? Date.parse(line.atIso) : NaN
  return Number.isFinite(t) ? formatDenverTimeOnly(t) : ''
}

/**
 * What an empty day says, and the press it offers: every way that day when the chip hid some, else today.
 * `next` is '' when the day is today and nothing is hidden: there is nowhere better to send the reader.
 */
export function billsPaidEmptyDay(opts: { ymd: string; how: BillsPaidChip; everyWay: number; todayYmd: string }): { main: string; next: '' | 'Show every way that day' | 'Go to today' } {
  const main = `Nothing came in${HOW_TAIL[opts.how]} on ${formatWorkDateYmdWeekdayShortFriendly(opts.ymd)}.`
  if (opts.how !== 'all' && opts.everyWay > 0) return { main, next: 'Show every way that day' }
  return { main, next: opts.ymd === opts.todayYmd ? '' : 'Go to today' }
}

// ---------- The tiles ----------

/** What came in today, since the Sunday that began this week, and in the month shown. Today and the week are null on a month that is not this one. */
export function billsPaidTiles(lines: ReadonlyArray<BillsPaidLine>, month: string, todayYmd: string): { today: BillsPaidSum | null; week: BillsPaidSum | null; month: BillsPaidSum } {
  const inMonth = lines.filter((l) => billsPaidMonthOf(l.ymd) === month)
  if (billsPaidMonthOf(todayYmd) !== month) return { today: null, week: null, month: billsPaidSum(inMonth) }
  const weekStart = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
  return {
    today: billsPaidSum(lines.filter((l) => l.ymd === todayYmd)),
    week: billsPaidSum(lines.filter((l) => l.ymd >= weekStart && l.ymd <= todayYmd)),
    month: billsPaidSum(inMonth),
  }
}

// ---------- Out of the app ----------

export function plural(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`
}

/** A dollar amount as the view writes it: `$7,935.00`. */
export function billsPaidMoney(n: number): string {
  return `$${formatCurrency(n)}`
}

/** A cell a spreadsheet will not run: text that opens like a formula is led with an apostrophe. */
const csvCell = (v: string): string => escapeCsvField(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)

export const BILLS_PAID_CSV_HEAD: ReadonlyArray<string> = ['Paid on', 'Time', 'Bill', 'Job', 'From', 'Amount', 'In the day total', 'How it was paid', 'Deposit', 'Bill sent on', 'Days to pay', 'Part of the bill']

/**
 * The payments as a spreadsheet, one row a payment, in the order given. The amount is a plain number so a column of
 * them adds. *In the day total* is *no* for a credit in kind. *Deposit* is a letter shared by the payments of one
 * deposit on one day, so a spreadsheet can group them without the bank's own id.
 */
export function billsPaidCsv(lines: ReadonlyArray<BillsPaidLine>): string {
  const rows: string[][] = [BILLS_PAID_CSV_HEAD.slice()]
  const letters = new Map<string, string>()
  for (const l of lines) {
    const key = l.depositId ? `${l.ymd}|${l.depositId}` : ''
    if (key && !letters.has(key)) letters.set(key, `${l.ymd} ${String.fromCharCode(65 + ([...letters.keys()].filter((k) => k.startsWith(`${l.ymd}|`)).length % 26))}`)
    rows.push([l.ymd, billsPaidTime(l), l.what, l.jobWords, l.payer, l.amount.toFixed(2), l.inKind ? 'no' : 'yes', l.wayWords, key ? (letters.get(key) ?? '') : '', l.sentYmd, l.took == null ? '' : String(l.took), l.partOfBill ? 'yes' : 'no'])
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** `bills-paid-2026-11.csv`, or `bills-paid-2026-11-stripe.csv` under a chip. */
export function billsPaidCsvFileName(month: string, how: BillsPaidChip): string {
  return `bills-paid-${month}${how === 'all' ? '' : `-${how}`}.csv`
}

const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const PRINT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/**
 * The month's grid for the printed page: the screen's month of days, on paper. A day money came is boxed in a
 * dark rule with its figure whole, to the cent, so the grid and the days under it say one number. The rule
 * carries the mark because a browser leaves a fill off the paper unless the person asks for backgrounds.
 */
function billsPaidMonthGridHtml(inMonth: ReadonlyArray<BillsPaidLine>, month: string, todayYmd: string): string {
  const { blanks, cells } = billsPaidMonthCells(inMonth, month, todayYmd)
  if (cells.length === 0) return ''
  const cell = (c: BillsPaidCell): string => {
    const has = c.sum.payments > 0
    const inside = has ? `<b>${esc(billsPaidMoney(c.sum.total))}</b><span>${esc(billsPaidCellCount(c.sum))}</span>` : ''
    return `<td class="${has ? 'in' : c.later ? 'later' : 'none'}"><i>${c.day}</i>${inside}</td>`
  }
  const slots: string[] = [...Array.from({ length: blanks }, () => '<td class="blank"></td>'), ...cells.map(cell)]
  while (slots.length % 7 !== 0) slots.push('<td class="blank"></td>')
  const weeks: string[] = []
  for (let i = 0; i < slots.length; i += 7) weeks.push(`<tr>${slots.slice(i, i + 7).join('')}</tr>`)
  return `<table class="cal"><thead><tr>${PRINT_WEEKDAYS.map((w) => `<th>${w}</th>`).join('')}</tr></thead><tbody>${weeks.join('')}</tbody></table>`
}

/**
 * The month as a page to print: the month's grid, then each day money came, newest first, with its total and its
 * payments. Our own reading of the payment rows for the office's file, so it is not itself a send.
 */
export function billsPaidMonthHtml(lines: ReadonlyArray<BillsPaidLine>, opts: { month: string; how: BillsPaidChip; printedAtIso: string }): string {
  const inMonth = lines.filter((l) => billsPaidMonthOf(l.ymd) === opts.month)
  const days = [...new Set(inMonth.map((l) => l.ymd))]
  const chip = BILLS_PAID_CHIPS.find((c) => c.key === opts.how)?.label ?? 'All'
  const sum = billsPaidSum(inMonth)
  const row = (l: BillsPaidLine): string => {
    const facts = [l.wayWords, billsPaidTime(l) ? `paid ${billsPaidTime(l)}` : '', l.sentYmd ? `sent ${formatWorkDateYmdWeekdayShortFriendly(l.sentYmd)}` : '', billsPaidTookWords(l), l.inKind ? 'in kind, not added' : '', l.partOfBill ? 'part of the bill' : '']
      .filter(Boolean)
      .join(' · ')
    return `<tr><td><b>${esc(l.what)}</b>${l.jobWords ? ` · ${esc(l.jobWords)}` : ''}${l.payer ? ` · ${esc(l.payer)}` : ''}<br>${esc(facts)}</td><td class="amt">${esc(billsPaidMoney(l.amount))}</td></tr>`
  }
  const block = (ymd: string): string => {
    const dayLines = inMonth.filter((l) => l.ymd === ymd)
    const daySum = billsPaidSum(dayLines)
    return `<tr class="day"><td><b>${esc(formatWorkDateYmdWeekdayShortFriendly(ymd))}</b> <span>${esc(plural(daySum.payments, 'payment'))}</span></td><td class="amt">${esc(billsPaidMoney(daySum.total))}</td></tr>${dayLines.map(row).join('')}`
  }
  const printedYmd = calendarYmdInAppTzFromIso(opts.printedAtIso)
  const printed = printedYmd ? `${formatWorkDateYmdWeekdayShortFriendly(printedYmd)} · ${formatDenverTimeOnly(Date.parse(opts.printedAtIso))}` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bills paid · ${esc(billsPaidMonthLabel(opts.month))}</title><style>
body{font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:28px}
h1{font-size:18px;margin:0 0 2px}p{margin:3px 0;color:#444}
table{border-collapse:collapse;width:100%;margin-top:10px}td{border-top:1px solid #ccc;padding:5px 8px 5px 0;vertical-align:top}
td.amt{text-align:right;white-space:nowrap;font-weight:600;padding-right:0}
tr.day td{border-top:2px solid #111;padding-top:9px}tr.day span{color:#444;margin-left:8px}
tr{break-inside:avoid}tr.day{break-after:avoid}
table.cal{table-layout:fixed;border-collapse:separate;border-spacing:3px;margin:10px -3px 4px;width:calc(100% + 6px);break-inside:avoid}
table.cal th{font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:#444;font-weight:700;padding:0 0 1px}
table.cal td{border:1px solid #ccc;border-radius:4px;height:46px;padding:3px 5px;overflow:hidden}
table.cal td.in{border:1.5px solid #111;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table.cal td.later{border-style:dashed;opacity:.55}table.cal td.blank{border:0}
table.cal i{display:block;font-style:normal;font-size:10px;font-weight:600;color:#444}
table.cal b{display:block;font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}
table.cal span{display:block;font-size:9.5px;color:#444}
</style></head><body>
<h1>Bills paid · ${esc(billsPaidMonthLabel(opts.month))}</h1>
<p>${esc(chip)}. ${esc(plural(sum.payments, 'payment'))}, ${esc(billsPaidMoney(sum.total))}. Newest day first. All times are Central.</p>
${days.length ? `${billsPaidMonthGridHtml(inMonth, opts.month, printedYmd || '9999-12-31')}<table>${days.map(block).join('')}</table>` : `<p>Nothing came in${esc(HOW_TAIL[opts.how])} in ${esc(billsPaidMonthLabel(opts.month))}.</p>`}
<p style="margin-top:14px">A payment sits on the day the money came, at what it took off the bill. Stripe’s fee is not taken off. A refund made in Stripe is not shown. Printed ${esc(printed)}.</p>
</body></html>`
}
