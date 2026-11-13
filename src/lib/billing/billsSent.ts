/**
 * Bills sent (punch list #327, PR 1): one line each time a bill leaves the company, read from the records the app
 * already keeps. The master asked for a ledger he can open at any time that says which bills went out, to whom, and
 * when exactly. Nothing here is a new record: a line is a sent copy (`sent_documents`, `lib/sent/`) with the bill's
 * amount and the job's words beside it, so the list can never disagree with what was sent.
 *
 * The rules, pure. The reads are `billsSentIo.ts`, the screen `components/billing/BillsSentLedger.tsx` at `/bills-sent`.
 *
 * - Every send is its own line. A bill sent twice is two lines, the second marked *2nd send* with the day of the first.
 * - A day's total counts a bill once, on the day it first went. A resend and a statement are listed and not added.
 * - A copy that went to an address on the copy list folds into its send, as *copy to*.
 * - The line never guesses. A print says the app cannot know who was handed it.
 */
import { companyWeekStartSundayContaining, calendarYmdInAppTzFromIso, formatDenverTimeOnly, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays } from '../../utils/dateUtils'
import { formatCurrency } from '../format'
import { canReadSentCopies, sentKindWords, type SentCopy } from '../sent/sentCopies'
import { sentCopyJobLabel, type SentCopyAboutJob } from '../sent/sentCopyAbout'

/** Who may open the screen: the people who read sent copies, as the table's own policy (dev, master, assistant, controller). */
export function canOpenBillsSent(role: string | null | undefined): boolean {
  return canReadSentCopies(role)
}

export const BILLS_SENT_PATH = '/bills-sent'

/** The papers the list reads: every kind that begins `bill`, a statement to a general contractor, a pay application. */
export const BILLS_SENT_KIND_PREFIX = 'bill'
export const BILLS_SENT_OTHER_KINDS: ReadonlyArray<string> = ['gc_statement', 'gc_statement_print', 'pay_application']

export function isBillsSentKind(kind: string): boolean {
  return kind.startsWith(BILLS_SENT_KIND_PREFIX) || BILLS_SENT_OTHER_KINDS.includes(kind)
}

/** A sent copy as the list reads it: the row, the jobs it names and the id that ties an email to its statement row. */
export type BillsSentCopy = SentCopy & { resendEmailId?: string | null }

/** The bill a copy was drawn from (`jobs_ledger_invoices`). */
export interface BillsSentBill {
  id: string
  jobId: string | null
  amount: number | null
  status: string
}

/** A job's words and what the search box can find it by. */
export interface BillsSentJob extends SentCopyAboutJob {
  job_address?: string | null
  customer_name?: string | null
}

/** A statement's own row (`gc_statement_emails`), by the email's id. */
export interface BillsSentStatement {
  resendEmailId: string
  total: number | null
  jobCount: number | null
}

/** A send of a bill the page did not load as a line: enough to say which send a line is and when the first went. */
export interface BillsSentEarlier {
  billId: string
  atIso: string
}

export interface BillsSentInput {
  copies: ReadonlyArray<BillsSentCopy>
  bills: ReadonlyMap<string, BillsSentBill>
  jobs: ReadonlyMap<string, BillsSentJob>
  statements: ReadonlyMap<string, BillsSentStatement>
  /** Every send on record of the bills on the page, the page's own included. */
  earlier: ReadonlyArray<BillsSentEarlier>
}

/** How it left, as the chips sort it. */
export type BillsSentRoute = 'email' | 'printed' | 'statement' | 'other'

export const BILLS_SENT_ROUTE_CHIPS: ReadonlyArray<{ key: BillsSentRoute | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'printed', label: 'Printed' },
  { key: 'statement', label: 'Statement' },
]

export interface BillsSentLine {
  /** The sent copy's id. */
  id: string
  atIso: string
  route: BillsSentRoute
  /** The chip on the line: *Email*, *Email, sent again*, *Printed*, *Statement*, *Saved as a file*. */
  routeWords: string
  /** *Bill 1412-0002*, *Statement*, *Pay application 4*. */
  what: string
  billId: string | null
  /** The job's words and its door; '' and null on a paper that names no job. */
  jobWords: string
  jobTo: string | null
  /** Who it was for, by name. */
  payer: string
  amount: number | null
  /** True when this line adds to its day's total: the first send on record of a bill that has an amount. */
  counts: boolean
  /** True when the bill is paid today. */
  paid: boolean
  toName: string
  toAddresses: string[]
  copyTo: string[]
  /** Who pressed send. */
  by: string
  /** Which send of this bill the line is: 1 for the first. */
  nth: number
  /** The first send's time, on a line that is not the first. */
  firstAtIso: string | null
  /** What the app cannot know or wants said: under a print, under a statement. '' otherwise. */
  note: string
  /** The copy the line opens. */
  copy: BillsSentCopy
  /** The copies to the copy list that went with this send, to open beside it. */
  copies: BillsSentCopy[]
  /** What the search box matches, lower case. */
  haystack: string
}

/** A copy to the copy list rides with the send it followed when it went within this long of it. */
const COPY_FOLD_MS = 5 * 60_000

const BILL_SOURCE = 'jobs_ledger_invoices'

const isStatementKind = (kind: string): boolean => kind.startsWith('gc_statement')

/** The words for a paper that is a bill of a named sort. */
const KIND_WHAT: Readonly<Record<string, string>> = {
  bill_gc_pay_app: 'Pay application',
  bill_gc_certified: 'Certified bill',
  bill_gc_reminder: 'Reminder',
  bill_gc_interest: 'Interest bill',
}

/**
 * The number on the bill as the payer read it, from the email's own title: *Invoice #1412-0002 from …* gives
 * `1412-0002`. '' when the title carries none (a print, a paper that is not a Stripe bill).
 */
export function billNumberFromTitle(title: string): string {
  const m = /#\s*([A-Za-z0-9][A-Za-z0-9-]*)/.exec(title)
  return m?.[1] ?? ''
}

function whatOf(copy: BillsSentCopy): string {
  if (isStatementKind(copy.kind)) return 'Statement'
  if (copy.kind === 'pay_application') {
    const n = copy.sourceSnapshot?.applicationNumber
    return typeof n === 'number' || (typeof n === 'string' && n.trim()) ? `Pay application ${n}` : 'Pay application'
  }
  const named = KIND_WHAT[copy.kind]
  if (named) return named
  if (copy.kind === 'bill' || copy.kind === 'bill_resent' || copy.kind === 'bill_copy' || copy.kind === 'bill_pay_code') {
    const number = billNumberFromTitle(copy.title)
    return number ? `Bill ${number}` : 'Bill'
  }
  return sentKindWords(copy.kind) || 'Bill'
}

function routeOf(copy: BillsSentCopy): BillsSentRoute {
  if (isStatementKind(copy.kind)) return 'statement'
  if (copy.how === 'email') return 'email'
  if (copy.how === 'print') return 'printed'
  return 'other'
}

const OTHER_ROUTE_WORDS: Readonly<Record<string, string>> = { hand: 'Handed over', mail: 'Mailed', link: 'Link sent', download: 'Saved as a file' }

function routeWordsOf(copy: BillsSentCopy, route: BillsSentRoute, nth: number): string {
  if (route === 'statement') return copy.how === 'print' ? 'Statement, printed' : 'Statement'
  if (route === 'email') return nth > 1 ? 'Email, sent again' : 'Email'
  if (route === 'printed') return 'Printed'
  return OTHER_ROUTE_WORDS[copy.how] ?? 'Sent'
}

function noteOf(copy: BillsSentCopy, route: BillsSentRoute): string {
  if (route === 'statement') return copy.how === 'print' ? 'Lists bills already sent. Not in the day’s total. The app cannot know who it was handed to.' : 'Lists bills already sent. Not in the day’s total.'
  if (route === 'printed') return copy.kind === 'bill_pay_code' ? 'The pay sheet was printed. The app cannot know who it was handed to.' : 'Printed. The app cannot know who it was handed to.'
  if (copy.how === 'download') return 'Saved as a file. The app cannot know where it went.'
  return ''
}

const billIdOf = (copy: BillsSentCopy): string | null => (copy.sourceTable === BILL_SOURCE && copy.sourceId ? copy.sourceId : null)

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * The lines, newest first. A copy to the copy list folds into the send it rode with. Each line knows which send of
 * its bill it is from every send on record (`earlier`), so a second send whose first is off the page still says so.
 */
export function billsSentLines(input: BillsSentInput): BillsSentLine[] {
  const ms = (iso: string): number => {
    const t = Date.parse(iso)
    return Number.isFinite(t) ? t : 0
  }
  const wanted = input.copies.filter((c) => isBillsSentKind(c.kind))
  const riders = wanted.filter((c) => c.kind === 'bill_copy')
  const sends = wanted.filter((c) => c.kind !== 'bill_copy').sort((a, b) => ms(b.sentAt) - ms(a.sentAt))

  // Every send on record of each bill, oldest first, the page's own included once.
  const timesByBill = new Map<string, number[]>()
  const note = (billId: string, at: number) => {
    const list = timesByBill.get(billId) ?? []
    if (!list.includes(at)) list.push(at)
    timesByBill.set(billId, list)
  }
  for (const e of input.earlier) note(e.billId, ms(e.atIso))
  for (const c of sends) {
    const billId = billIdOf(c)
    if (billId) note(billId, ms(c.sentAt))
  }
  for (const list of timesByBill.values()) list.sort((a, b) => a - b)

  // A copy to the copy list rides with the nearest send of its bill; one with no send near it stands as its own line.
  const ridersBySend = new Map<string, BillsSentCopy[]>()
  const alone: BillsSentCopy[] = []
  for (const r of riders) {
    const billId = billIdOf(r)
    const at = ms(r.sentAt)
    let best: BillsSentCopy | null = null
    for (const s of sends) {
      if (!billId || billIdOf(s) !== billId || s.how !== 'email') continue
      const gap = Math.abs(ms(s.sentAt) - at)
      if (gap <= COPY_FOLD_MS && (!best || gap < Math.abs(ms(best.sentAt) - at))) best = s
    }
    if (best) ridersBySend.set(best.id, [...(ridersBySend.get(best.id) ?? []), r])
    else alone.push(r)
  }

  const lineOf = (copy: BillsSentCopy, rode: BillsSentCopy[]): BillsSentLine => {
    const billId = billIdOf(copy)
    const bill = billId ? input.bills.get(billId) : undefined
    const route = routeOf(copy)
    const times = billId ? (timesByBill.get(billId) ?? []) : []
    const at = ms(copy.sentAt)
    const nth = billId ? Math.max(1, times.indexOf(at) + 1) : 1
    const firstAt = nth > 1 && times.length ? times[0]! : null
    const statement = copy.resendEmailId ? input.statements.get(copy.resendEmailId) : undefined
    const amount =
      route === 'statement'
        ? (statement?.total ?? null)
        : copy.kind === 'pay_application'
          ? num(copy.sourceSnapshot?.currentPaymentDue)
          : (bill?.amount ?? null)
    const jobId = (copy.jobIds ?? [])[0] ?? bill?.jobId ?? null
    const job = jobId ? input.jobs.get(jobId) : undefined
    const jobWords = jobId ? sentCopyJobLabel(jobId, job) : route === 'statement' && statement?.jobCount ? plural(statement.jobCount, 'job') : ''
    const payer = copy.recipientName || (job?.customer_name ?? '').trim()
    const copyTo = [...new Set(rode.flatMap((r) => r.recipientEmails))].filter((a) => !copy.recipientEmails.includes(a))
    const what = whatOf(copy)
    return {
      id: copy.id,
      atIso: copy.sentAt,
      route,
      routeWords: routeWordsOf(copy, route, nth),
      what,
      billId,
      jobWords,
      jobTo: jobId ? `/jobs?edit=${encodeURIComponent(jobId)}` : null,
      payer,
      amount,
      counts: !!billId && nth === 1 && amount != null && route !== 'statement',
      paid: bill?.status === 'paid',
      toName: copy.recipientName,
      toAddresses: copy.recipientEmails,
      copyTo,
      by: copy.sentByName,
      nth,
      firstAtIso: firstAt != null ? new Date(firstAt).toISOString() : null,
      note: noteOf(copy, route),
      copy,
      copies: rode,
      haystack: [what, jobWords, payer, copy.recipientName, ...copy.recipientEmails, ...copyTo, (job?.job_address ?? '').trim(), (job?.customer_name ?? '').trim(), copy.sentByName, copy.title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }
  }

  return [...sends.map((s) => lineOf(s, ridersBySend.get(s.id) ?? [])), ...alone.map((r) => lineOf(r, []))].sort((a, b) => ms(b.atIso) - ms(a.atIso))
}

/** `1 bill`, `2 bills`. */
export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** `2nd`, `3rd`, `11th`. */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const last = n % 10
  return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`
}

/** A dollar amount as the list writes it: `$4,860.00`. */
export function billsSentMoney(n: number): string {
  return `$${formatCurrency(n)}`
}

/** What a line that is not a bill's first send says about the first: *2nd send. First sent Tue, Nov 3.* '' on a first send. */
export function billsSentAgainWords(line: Pick<BillsSentLine, 'nth' | 'firstAtIso'>): string {
  if (line.nth <= 1) return ''
  const ymd = line.firstAtIso ? calendarYmdInAppTzFromIso(line.firstAtIso) : ''
  return ymd ? `${ordinal(line.nth)} send. First sent ${formatWorkDateYmdWeekdayShortFriendly(ymd)}.` : `${ordinal(line.nth)} send.`
}

/** Who it went to, as the line writes it: the name, then each address. '' when the copy names neither. */
export function billsSentToWords(line: Pick<BillsSentLine, 'toName' | 'toAddresses'>): { name: string; addresses: string } {
  return { name: line.toName.trim(), addresses: line.toAddresses.join(', ') }
}

/** The time alone, in the company's calendar: *9:28 AM*. '' for a time that does not parse. */
export function billsSentTime(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? formatDenverTimeOnly(t) : ''
}

/** A count of bills and their sum. */
export interface BillsSentSum {
  bills: number
  total: number
}

export interface BillsSentDay {
  ymd: string
  /** *Today · Thu, Nov 12*, *Yesterday · Wed, Nov 11*, then the day alone. */
  label: string
  lines: BillsSentLine[]
  /** The bills that first went this day. */
  sum: BillsSentSum
  /** Lines that are a second or later send. */
  again: number
  statements: number
}

const sumOf = (lines: ReadonlyArray<BillsSentLine>): BillsSentSum => {
  const counted = lines.filter((l) => l.counts)
  return { bills: new Set(counted.map((l) => l.billId)).size, total: counted.reduce((s, l) => s + (l.amount ?? 0), 0) }
}

/** The lines under one band per day in the company's calendar, in the order given (newest first). */
export function billsSentDays(lines: ReadonlyArray<BillsSentLine>, todayYmd: string): BillsSentDay[] {
  const yesterday = ymdAddDays(todayYmd, -1)
  const out: BillsSentDay[] = []
  for (const line of lines) {
    const ymd = Number.isFinite(Date.parse(line.atIso)) ? calendarYmdInAppTzFromIso(line.atIso) : ''
    const last = out[out.length - 1]
    if (last && last.ymd === ymd) {
      last.lines.push(line)
      continue
    }
    const day = ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : 'No date'
    out.push({ ymd, label: ymd === todayYmd ? `Today · ${day}` : ymd === yesterday ? `Yesterday · ${day}` : day, lines: [line], sum: { bills: 0, total: 0 }, again: 0, statements: 0 })
  }
  for (const d of out) {
    d.sum = sumOf(d.lines)
    d.again = d.lines.filter((l) => l.nth > 1).length
    d.statements = d.lines.filter((l) => l.route === 'statement').length
  }
  return out
}

/** A day band's small words after its total: *2 sent again · 1 statement*. '' when there are neither. */
export function billsSentDayExtras(day: Pick<BillsSentDay, 'again' | 'statements'>): string {
  const parts: string[] = []
  if (day.again > 0) parts.push(`${day.again} sent again`)
  if (day.statements > 0) parts.push(plural(day.statements, 'statement'))
  return parts.join(' · ')
}

/** `2 bills · $8,270.00`; a day with sends and no first send says *0 bills*. */
export function billsSentSumWords(sum: BillsSentSum): string {
  return sum.bills > 0 ? `${plural(sum.bills, 'bill')} · ${billsSentMoney(sum.total)}` : '0 bills'
}

/** The two tiles: the bills that first went today, and since the Sunday that began this week. */
export function billsSentTiles(lines: ReadonlyArray<BillsSentLine>, todayYmd: string): { today: BillsSentSum; week: BillsSentSum } {
  const weekStart = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
  const dayOf = (l: BillsSentLine) => (Number.isFinite(Date.parse(l.atIso)) ? calendarYmdInAppTzFromIso(l.atIso) : '')
  return {
    today: sumOf(lines.filter((l) => dayOf(l) === todayYmd)),
    week: sumOf(lines.filter((l) => dayOf(l) >= weekStart && dayOf(l) <= todayYmd)),
  }
}

/** The lines a route chip and the search box leave. Every typed word must be found. */
export function billsSentFilter(lines: ReadonlyArray<BillsSentLine>, route: BillsSentRoute | 'all', typed: string): BillsSentLine[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  return lines.filter((l) => (route === 'all' || l.route === route) && words.every((w) => l.haystack.includes(w)))
}

/** The words a copy's window is headed with. */
export function billsSentCopyLabel(line: Pick<BillsSentLine, 'what' | 'jobWords' | 'routeWords'>): string {
  return ['Copy as it went out', line.what, line.jobWords, line.routeWords].filter(Boolean).join(' · ')
}
