/**
 * Pay calendar (punch list #323): a payer who pays on a set day of the month.
 *
 * A contract of this kind names two days. A bill in by the **cutoff** (the last
 * day of the month, or an earlier day) is paid on the **pay day** of a later
 * month, most often the next. So a bill sent on the 1st and one sent on the
 * 30th fall due the same day, and one day past the cutoff costs a whole month.
 * A pace in days cannot say either thing.
 *
 * The contract says when a bill is DUE. The record says when it LANDS. This
 * kernel keeps the two apart: `dueDayFor` is the contract, `latenessAgainst`
 * is the payer's measured payments replayed through the calendar (days after
 * each one's own due day), and `expectedFromDue` is the due day plus that
 * lateness: the honest guess. Replayed on the payers the card was written for,
 * two of three had paid weeks to months after such a day, so the due day is
 * never passed off as the expected one.
 *
 * Pure: no React, no supabase. `payCalendarIo.ts` beside it does the reads and
 * the save. A calendar is held on the payer (`jobId` null), and a job can carry
 * its own or switch the payer's off (`calendarFor`).
 */

/** The three numbers and the note. */
export type PayCalendar = {
  /** The day of the month a bill must be in by, 1 to 28; null is the last day of the month. */
  cutoffDay: number | null
  /** The day of the month they pay, 1 to 31; a day the month does not have is its last day. */
  payDay: number
  /** Months after the cutoff's month: 0 the same month, 1 the next, 2 the month after that. */
  monthsAfter: number
  /** They pay when the owner pays them: the due day is the earliest, not a day to count on. */
  payWhenPaid: boolean
  /** The clause as the contract numbers it: `§ 5.2`. '' when the office has none. */
  clause: string
  /** The clause in a few words. */
  words: string
}

/** One stored row: the payer's own calendar (`jobId` null), or one job's. */
export type PayCalendarRow = {
  payerCustomerId: string
  jobId: string | null
  /** A job's row can say the payer's calendar is not on this job. */
  off: boolean
  calendar: PayCalendar | null
  setByName: string | null
  setAt: string | null
}

export const PAY_CALENDAR_CUTOFF_MAX = 28
export const PAY_CALENDAR_MONTHS_AFTER_MAX = 2
export const PAY_CALENDAR_CLAUSE_MAX = 40
export const PAY_CALENDAR_WORDS_MAX = 240

export const PAY_CALENDAR_DEFAULT: PayCalendar = { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' }

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MS_PER_DAY = 86_400_000

type Parts = { y: number; m: number; d: number }

function parts(ymd: string | null | undefined): Parts | null {
  const hit = YMD_RE.exec((ymd ?? '').trim())
  if (!hit) return null
  const y = Number(hit[1])
  const m = Number(hit[2]) - 1
  const d = Number(hit[3])
  if (m < 0 || m > 11 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}

function ymdOf(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** A month `add` months on, as a year and a month. */
function monthPlus(y: number, m: number, add: number): { y: number; m: number } {
  const total = y * 12 + m + add
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
}

function utcMs(p: Parts): number {
  return Date.UTC(p.y, p.m, p.d, 12)
}

/** Whole calendar days from `fromYmd` to `toYmd`, positive when `toYmd` is later; null on a bad day. */
export function payCalendarDaysBetween(fromYmd: string, toYmd: string): number | null {
  const a = parts(fromYmd)
  const b = parts(toYmd)
  if (!a || !b) return null
  return Math.round((utcMs(b) - utcMs(a)) / MS_PER_DAY)
}

function addDays(ymd: string, days: number): string | null {
  const p = parts(ymd)
  if (!p) return null
  return new Date(utcMs(p) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** "Dec 10": the year is dropped, as on every dates row. */
export function payCalendarMonthDay(ymd: string): string {
  const p = parts(ymd)
  return p ? `${MONTHS[p.m]} ${p.d}` : ymd
}

/** "1st", "2nd", "3rd", "10th", "21st". */
export function ordinalDay(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const one = n % 10
  return `${n}${one === 1 ? 'st' : one === 2 ? 'nd' : one === 3 ? 'rd' : 'th'}`
}

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/**
 * A calendar read defensively from stored or typed values; null when it has no pay day a
 * month can hold. A cutoff past the 28th is the last day of the month, since every month
 * has a 28th and none of the contracts read name a 29th.
 */
export function normalizePayCalendar(raw: Partial<Record<keyof PayCalendar, unknown>> | null | undefined): PayCalendar | null {
  if (!raw) return null
  const payDay = whole(raw.payDay)
  if (payDay == null || payDay < 1 || payDay > 31) return null
  const cutoff = whole(raw.cutoffDay)
  const months = whole(raw.monthsAfter)
  return {
    cutoffDay: cutoff != null && cutoff >= 1 && cutoff <= PAY_CALENDAR_CUTOFF_MAX ? cutoff : null,
    payDay,
    monthsAfter: months != null && months >= 0 && months <= PAY_CALENDAR_MONTHS_AFTER_MAX ? months : 1,
    payWhenPaid: raw.payWhenPaid === true,
    clause: typeof raw.clause === 'string' ? raw.clause.trim().slice(0, PAY_CALENDAR_CLAUSE_MAX) : '',
    words: typeof raw.words === 'string' ? raw.words.trim().slice(0, PAY_CALENDAR_WORDS_MAX) : '',
  }
}

/** A `payer_pay_calendars` row as the database returns it. Every column optional: a read from before the push has none. */
export type PayCalendarDbRow = {
  payer_customer_id?: string | null
  job_id?: string | null
  off?: boolean | null
  cutoff_day?: number | null
  pay_day?: number | null
  months_after?: number | null
  pay_when_paid?: boolean | null
  clause?: string | null
  words?: string | null
  set_at?: string | null
}

/** One stored row, read for a screen; null when it names no payer, or is neither a calendar nor a job's off switch. */
export function parsePayCalendarRow(row: PayCalendarDbRow | null | undefined, setByName?: string | null): PayCalendarRow | null {
  const payer = typeof row?.payer_customer_id === 'string' ? row.payer_customer_id : ''
  if (!row || !payer) return null
  const jobId = typeof row.job_id === 'string' && row.job_id ? row.job_id : null
  const off = row.off === true
  const calendar = off
    ? null
    : normalizePayCalendar({ cutoffDay: row.cutoff_day, payDay: row.pay_day, monthsAfter: row.months_after, payWhenPaid: row.pay_when_paid, clause: row.clause, words: row.words })
  if (!calendar && !(off && jobId)) return null
  return { payerCustomerId: payer, jobId, off, calendar, setByName: setByName?.trim() || null, setAt: typeof row.set_at === 'string' ? row.set_at : null }
}

/** Every stored row, keyed for `calendarFor`. */
export type PayCalendarIndex = {
  byPayer: ReadonlyMap<string, PayCalendarRow>
  /** Keyed `payerId|jobId`. */
  byPayerJob: ReadonlyMap<string, PayCalendarRow>
}

export const PAY_CALENDAR_INDEX_EMPTY: PayCalendarIndex = { byPayer: new Map(), byPayerJob: new Map() }

export function indexPayCalendars(rows: ReadonlyArray<PayCalendarRow>): PayCalendarIndex {
  const byPayer = new Map<string, PayCalendarRow>()
  const byPayerJob = new Map<string, PayCalendarRow>()
  for (const r of rows) {
    if (r.jobId) byPayerJob.set(`${r.payerCustomerId}|${r.jobId}`, r)
    else if (r.calendar) byPayer.set(r.payerCustomerId, r)
  }
  return { byPayer, byPayerJob }
}

/** Whose calendar a bill reads: its job's own, its payer's, none because the job switched it off, or none because none is set. */
export type PayCalendarSource = 'job' | 'payer' | 'off' | 'none'

/** The calendar one bill reads, and whose it is (punch list #341). */
export type PayCalendarRead = {
  /** The calendar the bill reads; null when the job switched it off, or none is set. */
  calendar: PayCalendar | null
  from: PayCalendarSource
  /** The payer's own calendar, whatever the job carries: what the job would follow without a row of its own. */
  payerCalendar: PayCalendar | null
}

const NO_CALENDAR: PayCalendarRead = { calendar: null, from: 'none', payerCalendar: null }

/**
 * The calendar one bill reads and whose it is: its job's own row for its payer, else the
 * payer's, else none. A job's row that is off means none, whatever the payer holds. None is
 * today's behavior. A job's row belongs to one payer: a bill another party pays reads past it.
 */
export function calendarSourceFor(index: PayCalendarIndex | null | undefined, bill: { payerId: string | null | undefined; jobId?: string | null }): PayCalendarRead {
  if (!index || !bill.payerId) return NO_CALENDAR
  const payerCalendar = index.byPayer.get(bill.payerId)?.calendar ?? null
  const own = bill.jobId ? index.byPayerJob.get(`${bill.payerId}|${bill.jobId}`) : undefined
  if (own) return own.off || !own.calendar ? { calendar: null, from: 'off', payerCalendar } : { calendar: own.calendar, from: 'job', payerCalendar }
  return payerCalendar ? { calendar: payerCalendar, from: 'payer', payerCalendar } : NO_CALENDAR
}

/** The calendar one bill reads (`calendarSourceFor`, without whose it is). */
export function calendarFor(index: PayCalendarIndex | null | undefined, bill: { payerId: string | null | undefined; jobId?: string | null }): PayCalendar | null {
  return calendarSourceFor(index, bill).calendar
}

/** The job window's Pay calendar line (punch list #341): what leads, the words that are the press, what follows, and the hover. */
export type JobPayCalendarWords = { lead: string | null; press: string; tail: string | null; title: string }

/**
 * Whose calendar a job reads, in the job window's words. `canSet` is false for a reader who
 * may not set one: with nothing set there is then nothing to say, and the answer is null.
 */
export function jobPayCalendarWords(read: PayCalendarRead, payerName: string | null | undefined, canSet: boolean): JobPayCalendarWords | null {
  const who = (payerName ?? '').trim() || 'this customer'
  if (read.from === 'job' && read.calendar) return { lead: 'This job’s own', press: payCalendarShort(read.calendar), tail: null, title: `${payCalendarWords(read.calendar)} Only this job reads it.` }
  if (read.from === 'payer' && read.calendar) return { lead: `Follows ${who}`, press: payCalendarShort(read.calendar), tail: null, title: `${payCalendarWords(read.calendar)} Every job ${who} pays reads it.` }
  if (read.from === 'off') {
    return {
      lead: null,
      press: 'No pay calendar on this job',
      tail: read.payerCalendar ? `${who} has one` : null,
      title: 'This job reads the usual guess: the bill date plus how long they take to pay.',
    }
  }
  return canSet ? { lead: null, press: 'Set a pay calendar…', tail: null, title: 'For a job whose payer pays on a set day of the month' } : null
}

/** The year and month whose cutoff a bill received on `receivedYmd` makes. */
function cutoffMonthOf(received: Parts, cal: PayCalendar): { y: number; m: number } {
  const missed = cal.cutoffDay != null && received.d > cal.cutoffDay
  return monthPlus(received.y, received.m, missed ? 1 : 0)
}

/** The day a bill received on `receivedYmd` falls due under the calendar; null on a bad day. */
export function dueDayFor(receivedYmd: string | null | undefined, cal: PayCalendar): string | null {
  const received = parts(receivedYmd)
  if (!received) return null
  const cut = cutoffMonthOf(received, cal)
  const pay = monthPlus(cut.y, cut.m, cal.monthsAfter)
  const due = ymdOf(pay.y, pay.m, Math.min(cal.payDay, daysInMonth(pay.y, pay.m)))
  // A pay day in the cutoff's own month that falls before the bill was in cannot be met: it is the next month's.
  if (due < ymdOf(received.y, received.m, received.d)) {
    const next = monthPlus(pay.y, pay.m, 1)
    return ymdOf(next.y, next.m, Math.min(cal.payDay, daysInMonth(next.y, next.m)))
  }
  return due
}

/** What someone about to bill needs: the last day to send, the day that makes it due, and what one day late costs. */
export type PayCutoff = {
  /** The cutoff on or after today. */
  cutoffYmd: string
  /** Days from today to the cutoff; 0 on the day itself. */
  daysLeft: number
  /** The due day of a bill in by the cutoff. */
  dueYmd: string
  /** The due day of a bill in one day after it. */
  nextDueYmd: string
}

/** The next cutoff on or after `todayYmd`, with both due days; null on a bad day. */
export function nextCutoff(todayYmd: string, cal: PayCalendar): PayCutoff | null {
  const today = parts(todayYmd)
  if (!today) return null
  const cut = cutoffMonthOf(today, cal)
  const cutoffYmd = ymdOf(cut.y, cut.m, cal.cutoffDay ?? daysInMonth(cut.y, cut.m))
  const dayAfter = addDays(cutoffYmd, 1)
  const dueYmd = dueDayFor(cutoffYmd, cal)
  const nextDueYmd = dayAfter ? dueDayFor(dayAfter, cal) : null
  const daysLeft = payCalendarDaysBetween(todayYmd, cutoffYmd)
  if (!dueYmd || !nextDueYmd || daysLeft == null) return null
  return { cutoffYmd, daysLeft, dueYmd, nextDueYmd }
}

const cutoffWords = (cal: PayCalendar): string => (cal.cutoffDay == null ? 'the last day of the month' : `the ${ordinalDay(cal.cutoffDay)}`)
const payDayWords = (cal: PayCalendar): string => (cal.payDay >= 31 ? 'the last day' : `the ${ordinalDay(cal.payDay)}`)
const MONTH_WORDS = ['the same month', 'the next month', 'the month after that'] as const

/** The calendar in one sentence: "A bill in by the last day of the month is paid the 10th of the next month." */
export function payCalendarWords(cal: PayCalendar): string {
  return `A bill in by ${cutoffWords(cal)} is paid ${payDayWords(cal)} of ${MONTH_WORDS[cal.monthsAfter] ?? MONTH_WORDS[1]}.`
}

/** The calendar in a few words, for a line with little room: "In by the 25th, paid the 30th". */
export function payCalendarShort(cal: PayCalendar): string {
  return `In by ${cal.cutoffDay == null ? 'month end' : `the ${ordinalDay(cal.cutoffDay)}`}, paid ${payDayWords(cal)}`
}

/** The window's preview, said back in plain dates: a bill in by the cutoff, and one a day late. */
export function payCalendarPreview(cal: PayCalendar, todayYmd: string): { inBy: string; dayLate: string } | null {
  const cut = nextCutoff(todayYmd, cal)
  const dayAfter = cut ? addDays(cut.cutoffYmd, 1) : null
  if (!cut || !dayAfter) return null
  return {
    inBy: `A bill in by ${payCalendarMonthDay(cut.cutoffYmd)} is due ${payCalendarMonthDay(cut.dueYmd)}.`,
    dayLate: `A bill in on ${payCalendarMonthDay(dayAfter)} is due ${payCalendarMonthDay(cut.nextDueYmd)}.`,
  }
}

/** What the office does by the cutoff: send a bill that is ready, or bill a job still being worked. */
export type PayCutoffVerb = 'Send' | 'Bill'

/** The cutoff as someone about to bill meets it: "Send by Nov 30 to be due Dec 10." and "After that, Jan 10." */
export function cutoffWordsFor(cut: PayCutoff, verb: PayCutoffVerb = 'Send'): { sendBy: string; after: string } {
  return { sendBy: `${verb} by ${payCalendarMonthDay(cut.cutoffYmd)} to be due ${payCalendarMonthDay(cut.dueYmd)}.`, after: `After that, ${payCalendarMonthDay(cut.nextDueYmd)}.` }
}

/** A measured payment: the day its bill went in and the day the money landed. */
export type PayCalendarReceipt = { billedYmd: string; paidYmd: string }

/** The payer's record against a calendar: how its measured payments landed against their own due days. */
export type PayCalendarLateness = {
  /** Payments measured. */
  count: number
  /** The middle lateness in days, never below zero: what `expectedFromDue` adds. */
  medianDays: number
  /** The soonest and the latest, in days after the due day; below zero is before it. */
  minDays: number
  maxDays: number
  /** Payments that landed on or before their due day. */
  onTime: number
}

/**
 * The payer's measured payments replayed through the calendar: each one's due day worked out
 * from the day its bill went in, and the days the money landed after it. Null with nothing to
 * measure. The receipts are the newest the pay-speeds read returns, at most 12 a payer.
 */
export function latenessAgainst(receipts: ReadonlyArray<PayCalendarReceipt> | null | undefined, cal: PayCalendar): PayCalendarLateness | null {
  const late: number[] = []
  for (const r of receipts ?? []) {
    const due = dueDayFor(r.billedYmd, cal)
    const after = due ? payCalendarDaysBetween(due, r.paidYmd) : null
    if (after != null) late.push(after)
  }
  if (!late.length) return null
  late.sort((a, b) => a - b)
  const mid = Math.floor(late.length / 2)
  const median = late.length % 2 ? late[mid]! : (late[mid - 1]! + late[mid]!) / 2
  return { count: late.length, medianDays: Math.max(0, Math.round(median)), minDays: late[0]!, maxDays: late[late.length - 1]!, onTime: late.filter((d) => d <= 0).length }
}

/** The honest guess: the due day plus how late the payer usually runs; the due day itself with no record. */
export function expectedFromDue(dueYmd: string, lateness: PayCalendarLateness | null | undefined): string {
  const days = lateness?.medianDays ?? 0
  return days > 0 ? (addDays(dueYmd, days) ?? dueYmd) : dueYmd
}

const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * The record in the window's words, at most two short sentences. With nothing measured it
 * says so, and says what the due day is then worth.
 */
export function latenessWords(lateness: PayCalendarLateness | null | undefined): string {
  if (!lateness) return 'No payment on record yet. The due day is the best guess there is.'
  const { count, minDays, maxDays, medianDays, onTime } = lateness
  if (count === 1) {
    if (maxDays <= 0) return 'Their one payment on record landed by its due day.'
    return `Their one payment on record landed ${counted(maxDays, 'day', 'days')} after its due day.`
  }
  if (maxDays <= 0) return `Their last ${count} payments all landed by the due day.`
  const from = Math.max(0, minDays)
  const range = from === maxDays ? `${counted(maxDays, 'day', 'days')}` : `${from} to ${counted(maxDays, 'day', 'days')}`
  const usual = medianDays > 0 ? ` Usually about ${medianDays}.` : ' Usually on the day.'
  const kept = onTime > 0 && onTime < count ? ` ${onTime} of ${count} were on time.` : ''
  return `Their last ${count} payments landed ${range} after the due day.${usual}${kept}`
}

/** The record in the fewest words, for a dates row with little room: "Usually lands about Dec 16". The day leads, since a narrow row cuts the tail. */
export function usuallyLandsShort(dueYmd: string, lateness: PayCalendarLateness | null | undefined): string | null {
  if (!lateness) return null
  if (lateness.medianDays <= 0) return 'Usually lands by the due day'
  return `Usually lands about ${payCalendarMonthDay(expectedFromDue(dueYmd, lateness))}`
}

/** The record in a few words, with the math: "Usually lands about 6d after. About Dec 16." */
export function usuallyLandsWords(dueYmd: string, lateness: PayCalendarLateness | null | undefined): string | null {
  if (!lateness) return null
  if (lateness.medianDays <= 0) return 'Usually lands by the due day.'
  return `Usually lands about ${lateness.medianDays}d after. About ${payCalendarMonthDay(expectedFromDue(dueYmd, lateness))}.`
}

/**
 * A bill this many days past its expected day has missed a whole pay run: a payer on a calendar
 * pays once a month, so the next run has come and gone too. The waiting lists read it red.
 */
export const PAY_CALENDAR_MISSED_RUN_DAYS = 30

/** How a waiting list reads one open bill of a payer on a Pay calendar. */
export type CalendarBillTone = 'ok' | 'warn' | 'late'

/**
 * One open bill against its payer's calendar, for the lists that ask whose money is slow
 * (Money waiting, Dashboard Accounts Receivable). A count of days since billing cannot judge
 * such a payer: a bill in on the 1st and one in on the 30th are paid the same day.
 */
export type CalendarBillRead = {
  /** The day the contract makes the bill due. */
  dueYmd: string
  /** The due day plus how late this payer usually runs. */
  expectedYmd: string
  /** Days past the due day; 0 while it is ahead. */
  daysPastDue: number
  /** Days past the expected day; 0 while it is ahead. */
  daysPastExpected: number
  /** ok until the expected day has passed · warn once it has · late once a whole pay run was missed. */
  tone: CalendarBillTone
}

/**
 * Reads one open bill against the calendar. `clockYmd` is the day the calendar counts from:
 * the day the payer accepted the bill, else the day it went in. Null with no usable day.
 */
export function calendarBillRead(clockYmd: string | null | undefined, cal: PayCalendar, lateness: PayCalendarLateness | null | undefined, todayYmd: string): CalendarBillRead | null {
  const dueYmd = dueDayFor(clockYmd, cal)
  if (!dueYmd) return null
  const expectedYmd = expectedFromDue(dueYmd, lateness)
  const sinceDue = payCalendarDaysBetween(dueYmd, todayYmd)
  const sinceExpected = payCalendarDaysBetween(expectedYmd, todayYmd)
  if (sinceDue == null || sinceExpected == null) return null
  const daysPastExpected = Math.max(0, sinceExpected)
  const tone: CalendarBillTone = daysPastExpected >= PAY_CALENDAR_MISSED_RUN_DAYS ? 'late' : daysPastExpected > 0 ? 'warn' : 'ok'
  return { dueYmd, expectedYmd, daysPastDue: Math.max(0, sinceDue), daysPastExpected, tone }
}

/** The read in a row's words: "due Dec 10" · "due Nov 10 · 5d past due" · "due Nov 10 · 12d past expected". */
export function calendarBillWords(read: CalendarBillRead): string {
  const due = `due ${payCalendarMonthDay(read.dueYmd)}`
  if (read.daysPastExpected > 0) return `${due} · ${read.daysPastExpected}d past expected`
  if (read.daysPastDue > 0) return `${due} · ${read.daysPastDue}d past due`
  return due
}

/** What a calendar payer's waits are measured against, in a list's small line: "pay calendar · lands ~6d after the pay day". */
export function calendarBasisWords(lateness: PayCalendarLateness | null | undefined): string {
  if (!lateness) return 'pay calendar · no payment on record yet'
  if (lateness.medianDays <= 0) return 'pay calendar · lands by the pay day'
  return `pay calendar · lands ~${lateness.medianDays}d after the pay day`
}

/** The cutoff asks in amber once it is this close, the last week a bill can still make this month's run. */
export const PAY_CUTOFF_SOON_DAYS = 7

/** The cutoff as a row draws it (PR 3): the two sentences, whether it is close, and the reason for the hover. */
export type PayCutoffLineWords = {
  /** "Send by Nov 30 to be due Dec 10." */
  sendBy: string
  /** "After that, Jan 10." */
  after: string
  /** Inside `PAY_CUTOFF_SOON_DAYS`: the line asks in amber. */
  soon: boolean
  daysLeft: number
  cutoffYmd: string
  /** The calendar in one sentence, and how far off the cutoff is. */
  title: string
}

const leftWords = (days: number): string => (days === 0 ? 'The cutoff is today.' : days === 1 ? 'The cutoff is tomorrow.' : `The cutoff is in ${days} days.`)

/** A job still being worked says its cutoff only this close to it (PR 5): before that the line would sit on every row all month. */
export const PAY_CUTOFF_WORKING_DAYS = 10

/** The cutoff line for a bill not yet sent, or with `Bill` for a job not yet billed; null on a bad day. */
export function payCutoffLine(todayYmd: string, cal: PayCalendar, verb: PayCutoffVerb = 'Send'): PayCutoffLineWords | null {
  const cut = nextCutoff(todayYmd, cal)
  if (!cut) return null
  return { ...cutoffWordsFor(cut, verb), soon: cut.daysLeft <= PAY_CUTOFF_SOON_DAYS, daysLeft: cut.daysLeft, cutoffYmd: cut.cutoffYmd, title: `${payCalendarWords(cal)} ${leftWords(cut.daysLeft)}` }
}

/** The cutoff at the moment of sending (PR 3): what sending today makes the bill, and what waiting costs. */
export function sendTodayCutoffWords(todayYmd: string, cal: PayCalendar): { due: string; cutoff: string; soon: boolean } | null {
  const cut = nextCutoff(todayYmd, cal)
  if (!cut) return null
  return {
    due: `Sent today, this bill is due ${payCalendarMonthDay(cut.dueYmd)}.`,
    cutoff: `Their cutoff is ${payCalendarMonthDay(cut.cutoffYmd)}. After that, ${payCalendarMonthDay(cut.nextDueYmd)}.`,
    soon: cut.daysLeft <= PAY_CUTOFF_SOON_DAYS,
  }
}

/** The Ready to Bill header's chip (PR 3): the nearest cutoff among the bills waiting to go, and how many it holds. */
export function nextCutoffChip(lines: ReadonlyArray<Pick<PayCutoffLineWords, 'cutoffYmd' | 'daysLeft'>>): { label: string; soon: boolean; count: number; cutoffYmd: string } | null {
  if (!lines.length) return null
  const first = lines.reduce((a, b) => (b.cutoffYmd < a.cutoffYmd ? b : a))
  const count = lines.filter((l) => l.cutoffYmd === first.cutoffYmd).length
  return { label: `Next cutoff ${payCalendarMonthDay(first.cutoffYmd)} · ${count} ${count === 1 ? 'bill' : 'bills'}`, soon: first.daysLeft <= PAY_CUTOFF_SOON_DAYS, count, cutoffYmd: first.cutoffYmd }
}
