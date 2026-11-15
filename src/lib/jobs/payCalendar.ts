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
 *
 * Since punch list #341's PR 5 the terms have a second shape: paid a number of
 * days after the bill is accepted (`daysAfter`). It has no cutoff and no pay
 * day, so `dueDayFor` adds the days and `nextCutoff` answers none. Everything
 * built on the due day (the record, the expected day, the waiting lists) reads
 * it unchanged.
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
  /**
   * Paid this many days after the bill is accepted, 1 to 180 (punch list #341, PR 5): the other
   * shape of terms. Set, the cutoff, the pay day and the month count are not read. Absent or null
   * on a calendar of the first shape.
   */
  daysAfter?: number | null
}

/**
 * One bill's own due day (punch list #341, PR 4): the contract names a date for that one bill. A
 * retainage release, a dated draw once it is billed, a final payment. It sits at the top of the
 * ladder a bill reads: the bill's own day, the job's calendar, the payer's calendar, the pace guess.
 */
export type BillOwnDue = {
  /** YYYY-MM-DD the bill is due. */
  dueYmd: string
  /** The clause as the contract numbers it: `§ 9.4`. '' when the office has none. */
  clause: string
  /** The clause in a few words. */
  words: string
  setByName?: string | null
  setAt?: string | null
}

/** One stored row: the payer's own calendar (`jobId` null), one job's, or one bill's own due day (`invoiceId`). */
export type PayCalendarRow = {
  /** '' on a bill's own due day, which belongs to the bill and names no payer. */
  payerCustomerId: string
  jobId: string | null
  /** A job's row can say the payer's calendar is not on this job. */
  off: boolean
  calendar: PayCalendar | null
  setByName: string | null
  setAt: string | null
  /** The bill a row of `invoice_due_days` is for. Such a row rides with the calendars, so every reader of one finds the other. */
  invoiceId?: string | null
  ownDue?: BillOwnDue | null
}

export const PAY_CALENDAR_CUTOFF_MAX = 28
export const PAY_CALENDAR_MONTHS_AFTER_MAX = 2
/** The most days after the bill a contract's terms can name here. */
export const PAY_CALENDAR_DAYS_AFTER_MAX = 180
/** What the window's days box starts on when the office picks days after the bill: the commonest term past a month. */
export const PAY_CALENDAR_DAYS_AFTER_DEFAULT = 45
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
  const clauseOf = (): Pick<PayCalendar, 'payWhenPaid' | 'clause' | 'words'> => ({
    payWhenPaid: raw.payWhenPaid === true,
    clause: typeof raw.clause === 'string' ? raw.clause.trim().slice(0, PAY_CALENDAR_CLAUSE_MAX) : '',
    words: typeof raw.words === 'string' ? raw.words.trim().slice(0, PAY_CALENDAR_WORDS_MAX) : '',
  })
  // Days after the bill (punch list #341, PR 5): no pay day is needed. The first shape's fields keep their defaults, so a switch back in the window starts somewhere sane.
  const daysAfter = whole(raw.daysAfter)
  if (daysAfter != null && daysAfter >= 1 && daysAfter <= PAY_CALENDAR_DAYS_AFTER_MAX) return { cutoffDay: null, payDay: PAY_CALENDAR_DEFAULT.payDay, monthsAfter: PAY_CALENDAR_DEFAULT.monthsAfter, ...clauseOf(), daysAfter }
  const payDay = whole(raw.payDay)
  if (payDay == null || payDay < 1 || payDay > 31) return null
  const cutoff = whole(raw.cutoffDay)
  const months = whole(raw.monthsAfter)
  return {
    cutoffDay: cutoff != null && cutoff >= 1 && cutoff <= PAY_CALENDAR_CUTOFF_MAX ? cutoff : null,
    payDay,
    monthsAfter: months != null && months >= 0 && months <= PAY_CALENDAR_MONTHS_AFTER_MAX ? months : 1,
    ...clauseOf(),
  }
}

/** The terms are a number of days after the bill, not a cutoff and a pay day (punch list #341, PR 5). */
export function paysDaysAfter(cal: PayCalendar | null | undefined): cal is PayCalendar & { daysAfter: number } {
  return cal != null && typeof cal.daysAfter === 'number' && cal.daysAfter >= 1
}

/** What the terms are called where a line names them: a pay calendar, or pay terms when they are days after the bill. */
export function payTermsNoun(cal: PayCalendar | null | undefined): 'pay calendar' | 'pay terms' {
  return paysDaysAfter(cal) ? 'pay terms' : 'pay calendar'
}

/**
 * What a save sends for a calendar. Days after the bill go with no pay day, so a database from
 * before migration 20261115190000 refuses the save in words, where it would have stored the
 * default pay day and read the terms as a calendar.
 */
export function payCalendarSavePayload(cal: PayCalendar): Record<string, unknown> {
  const clause = cal.clause.trim()
  const words = cal.words.trim()
  if (paysDaysAfter(cal)) return { daysAfter: cal.daysAfter, payWhenPaid: cal.payWhenPaid, clause, words }
  return { cutoffDay: cal.cutoffDay, payDay: cal.payDay, monthsAfter: cal.monthsAfter, payWhenPaid: cal.payWhenPaid, clause, words }
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
  /** Days after the bill (punch list #341, PR 5); absent on a read from before the column. */
  days_after?: number | null
}

/** One stored row, read for a screen; null when it names no payer, or is neither a calendar nor a job's off switch. */
export function parsePayCalendarRow(row: PayCalendarDbRow | null | undefined, setByName?: string | null): PayCalendarRow | null {
  const payer = typeof row?.payer_customer_id === 'string' ? row.payer_customer_id : ''
  if (!row || !payer) return null
  const jobId = typeof row.job_id === 'string' && row.job_id ? row.job_id : null
  const off = row.off === true
  const calendar = off
    ? null
    : normalizePayCalendar({ cutoffDay: row.cutoff_day, payDay: row.pay_day, monthsAfter: row.months_after, payWhenPaid: row.pay_when_paid, clause: row.clause, words: row.words, daysAfter: row.days_after })
  if (!calendar && !(off && jobId)) return null
  return { payerCustomerId: payer, jobId, off, calendar, setByName: setByName?.trim() || null, setAt: typeof row.set_at === 'string' ? row.set_at : null }
}

/** An `invoice_due_days` row as the database returns it. Every column optional: a read from before the push has none. */
export type BillDueDayDbRow = {
  invoice_id?: string | null
  due_on?: string | null
  clause?: string | null
  words?: string | null
  marked_at?: string | null
}

/** One bill's own due day, read for a screen as a row that rides with the calendars; null with no bill or no usable day. */
export function parseBillDueDayRow(row: BillDueDayDbRow | null | undefined, setByName?: string | null): PayCalendarRow | null {
  const invoiceId = typeof row?.invoice_id === 'string' ? row.invoice_id : ''
  const dueYmd = typeof row?.due_on === 'string' ? row.due_on.slice(0, 10) : ''
  if (!row || !invoiceId || !parts(dueYmd)) return null
  const setAt = typeof row.marked_at === 'string' ? row.marked_at : null
  const by = setByName?.trim() || null
  const ownDue: BillOwnDue = {
    dueYmd,
    clause: typeof row.clause === 'string' ? row.clause.trim().slice(0, PAY_CALENDAR_CLAUSE_MAX) : '',
    words: typeof row.words === 'string' ? row.words.trim().slice(0, PAY_CALENDAR_WORDS_MAX) : '',
    setByName: by,
    setAt,
  }
  return { payerCustomerId: '', jobId: null, off: false, calendar: null, setByName: by, setAt, invoiceId, ownDue }
}

/** Every stored row, keyed for `calendarFor`. */
export type PayCalendarIndex = {
  byPayer: ReadonlyMap<string, PayCalendarRow>
  /** Keyed `payerId|jobId`. */
  byPayerJob: ReadonlyMap<string, PayCalendarRow>
  /** One bill's own due day, by the bill's id (punch list #341, PR 4); absent on an index built before it. */
  byInvoice?: ReadonlyMap<string, BillOwnDue>
}

export const PAY_CALENDAR_INDEX_EMPTY: PayCalendarIndex = { byPayer: new Map(), byPayerJob: new Map(), byInvoice: new Map() }

export function indexPayCalendars(rows: ReadonlyArray<PayCalendarRow>): PayCalendarIndex {
  const byPayer = new Map<string, PayCalendarRow>()
  const byPayerJob = new Map<string, PayCalendarRow>()
  const byInvoice = new Map<string, BillOwnDue>()
  for (const r of rows) {
    if (r.invoiceId) {
      if (r.ownDue) byInvoice.set(r.invoiceId, r.ownDue)
    } else if (r.jobId) byPayerJob.set(`${r.payerCustomerId}|${r.jobId}`, r)
    else if (r.calendar) byPayer.set(r.payerCustomerId, r)
  }
  return { byPayer, byPayerJob, byInvoice }
}

/**
 * Where a bill's due day comes from: the bill's own day, its job's own calendar, its payer's, none
 * because the job switched it off, or none because none is set.
 */
export type PayCalendarSource = 'bill' | 'job' | 'payer' | 'off' | 'none'

/** The calendar one bill reads, and whose it is (punch list #341). */
export type PayCalendarRead = {
  /** The calendar the bill reads; null when the job switched it off, or none is set. */
  calendar: PayCalendar | null
  from: PayCalendarSource
  /** The payer's own calendar, whatever the job carries: what the job would follow without a row of its own. */
  payerCalendar: PayCalendar | null
  /** The job whose own row this is, so its record can be picked out of the payer's payments (`recordFor`); absent on the payer's, and with none. */
  jobId?: string | null
  /** The bill's own due day (`from` is `bill`): no calendar is read for it, so `calendar` is null. */
  ownDue?: BillOwnDue | null
  /** On a bill with its own day, what the bill would read without it: the next rungs of the ladder, for the window that sets the day. */
  under?: { calendar: PayCalendar | null; from: Exclude<PayCalendarSource, 'bill'> }
}

const NO_CALENDAR: PayCalendarRead = { calendar: null, from: 'none', payerCalendar: null }

/**
 * The calendar one bill reads and whose it is: its job's own row for its payer, else the
 * payer's, else none. A job's row that is off means none, whatever the payer holds. None is
 * today's behavior. A job's row belongs to one payer: a bill another party pays reads past it.
 */
export function calendarSourceFor(index: PayCalendarIndex | null | undefined, bill: { payerId: string | null | undefined; jobId?: string | null; invoiceId?: string | null }): PayCalendarRead {
  if (!index) return NO_CALENDAR
  const under = calendarUnder(index, bill)
  // The top rung (punch list #341, PR 4): a day the contract names for this one bill wins over any calendar, and needs no payer on file.
  const ownDue = bill.invoiceId ? index.byInvoice?.get(bill.invoiceId) : undefined
  if (ownDue) return { calendar: null, from: 'bill', payerCalendar: under.payerCalendar, ownDue, under: { calendar: under.calendar, from: under.from as Exclude<PayCalendarSource, 'bill'> } }
  return under
}

/** The ladder below a bill's own day: the job's own row for the payer, else the payer's, else none. */
function calendarUnder(index: PayCalendarIndex, bill: { payerId: string | null | undefined; jobId?: string | null }): PayCalendarRead {
  if (!bill.payerId) return NO_CALENDAR
  const payerCalendar = index.byPayer.get(bill.payerId)?.calendar ?? null
  const own = bill.jobId ? index.byPayerJob.get(`${bill.payerId}|${bill.jobId}`) : undefined
  if (own) return own.off || !own.calendar ? { calendar: null, from: 'off', payerCalendar, jobId: own.jobId } : { calendar: own.calendar, from: 'job', payerCalendar, jobId: own.jobId }
  return payerCalendar ? { calendar: payerCalendar, from: 'payer', payerCalendar } : NO_CALENDAR
}

/** The press that sets one bill's own due day, and its window's title. */
export const BILL_OWN_DUE_PRESS = 'This bill is due on…'

/** What a bill with its own due day reads where a calendar's words would stand. */
export const BILL_OWN_DUE_WORDS = 'This bill’s own day'

/** A bill's own day in a few words, with its clause: "This bill’s own day · § 9.4". */
export function billOwnDueShort(own: BillOwnDue): string {
  return own.clause ? `${BILL_OWN_DUE_WORDS} · ${own.clause}` : BILL_OWN_DUE_WORDS
}

/** A bill's own day in a sentence, for a hover: the clause's words, then that no calendar is read. */
export function billOwnDueWords(own: BillOwnDue): string {
  const said = own.words ? `${own.clause ? `${own.clause}: ` : ''}${/[.!?]$/.test(own.words) ? own.words : `${own.words}.`}` : 'The contract names this date for this one bill.'
  return `${said} No pay calendar is read for this bill.`
}

/**
 * The window's two lines for one bill's own day: what the bill reads without it, and what the day
 * typed makes it. `otherwise` is the due day its calendar gives it and whether that calendar is the
 * job's own; null with no calendar, where the bill reads the usual guess.
 */
export function billOwnDuePreview(dueYmd: string | null | undefined, otherwise: { dueYmd: string; own: boolean } | null | undefined): { otherwise: string; own: string; picked: boolean } {
  const picked = !!parts(dueYmd)
  return {
    otherwise: otherwise ? `By ${otherwise.own ? 'this job’s own' : 'the'} pay calendar it is due ${payCalendarMonthDay(otherwise.dueYmd)}.` : 'With no pay calendar it reads the usual guess.',
    own: picked ? `On its own day it is due ${payCalendarMonthDay(dueYmd as string)}.` : 'Pick the day to see what it makes the bill.',
    picked,
  }
}

/** A calendar handed over bare, or with whose it is: the pay model takes either (punch list #341). */
export type PayCalendarArg = PayCalendar | PayCalendarRead | null | undefined

/** Either form as a read. A bare calendar is taken as the payer's, which is what every caller before #341 meant. */
export function asPayCalendarRead(arg: PayCalendarArg): PayCalendarRead {
  if (!arg) return NO_CALENDAR
  if ('from' in arg) return arg
  return { calendar: arg, from: 'payer', payerCalendar: arg }
}

/** What a job switched off reads, on its row, in the job window and in its payer's window: one home, so the three never drift. It is a state and the press back to it, not an empty list. */
export const JOB_NO_CALENDAR_WORDS = 'No pay calendar on this job'

/** The words that mark a calendar as one job's own, wherever a row says its calendar (punch list #341). */
export const OWN_CALENDAR_WORDS = 'This job’s own'

/** A row's calendar in a few words, marked when it is the job's own: "This job’s own · In by the 25th, paid the 30th". Null with none. */
export function payCalendarShortFor(read: PayCalendarRead): string | null {
  if (!read.calendar) return null
  return read.from === 'job' ? `${OWN_CALENDAR_WORDS} · ${payCalendarShort(read.calendar)}` : payCalendarShort(read.calendar)
}

/** The calendar one bill reads (`calendarSourceFor`, without whose it is). Null for a bill with its own due day, which reads no calendar. */
export function calendarFor(index: PayCalendarIndex | null | undefined, bill: { payerId: string | null | undefined; jobId?: string | null; invoiceId?: string | null }): PayCalendar | null {
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
  if (read.from === 'job' && read.calendar) return { lead: OWN_CALENDAR_WORDS, press: payCalendarShort(read.calendar), tail: null, title: `${payCalendarWords(read.calendar)} Only this job reads it.` }
  if (read.from === 'payer' && read.calendar) return { lead: `Follows ${who}`, press: payCalendarShort(read.calendar), tail: null, title: `${payCalendarWords(read.calendar)} Every job ${who} pays reads it.` }
  if (read.from === 'off') {
    return {
      lead: null,
      press: JOB_NO_CALENDAR_WORDS,
      tail: read.payerCalendar ? `${who} has one` : null,
      title: 'This job reads the usual guess: the bill date plus how long they take to pay.',
    }
  }
  return canSet ? { lead: null, press: 'Set a pay calendar…', tail: null, title: 'For a job whose contract says when its payer pays: a set day of the month, or a number of days after the bill' } : null
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
  // Days after the bill: the day it was received plus the days. No cutoff, so no month is lost by a day.
  if (paysDaysAfter(cal)) return addDays(ymdOf(received.y, received.m, received.d), cal.daysAfter)
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
  // Terms in days after the bill have no cutoff: every line that speaks of one draws nothing.
  if (!today || paysDaysAfter(cal)) return null
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
  if (paysDaysAfter(cal)) return `A bill is paid ${counted(cal.daysAfter, 'day', 'days')} after it is accepted.`
  return `A bill in by ${cutoffWords(cal)} is paid ${payDayWords(cal)} of ${MONTH_WORDS[cal.monthsAfter] ?? MONTH_WORDS[1]}.`
}

/** The calendar in a few words, for a line with little room: "In by the 25th, paid the 30th". */
export function payCalendarShort(cal: PayCalendar): string {
  if (paysDaysAfter(cal)) return `Paid ${counted(cal.daysAfter, 'day', 'days')} after the bill`
  return `In by ${cal.cutoffDay == null ? 'month end' : `the ${ordinalDay(cal.cutoffDay)}`}, paid ${payDayWords(cal)}`
}

/** The window's preview, said back in plain dates: a bill in by the cutoff, and one a day late. */
export function payCalendarPreview(cal: PayCalendar, todayYmd: string): { inBy: string; dayLate: string } | null {
  if (paysDaysAfter(cal)) {
    const due = dueDayFor(todayYmd, cal)
    if (!due) return null
    return { inBy: `A bill accepted today, ${payCalendarMonthDay(todayYmd)}, is due ${payCalendarMonthDay(due)}.`, dayLate: 'Each bill has its own due day. No cutoff decides a month.' }
  }
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

/** A measured payment: the day its bill went in, the day the money landed, and the job it was for when the read carries one. */
export type PayCalendarReceipt = { billedYmd: string; paidYmd: string; jobId?: string | null }

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

/** A job's own payments make a record of their own once it has this many (punch list #341, the owner's call 2 at its first pick). */
export const JOB_RECORD_MIN_PAYMENTS = 2

/**
 * Whose payments scored a calendar (punch list #341, PR 3).
 *  - `payer`: the payer's calendar, scored on the payer's payments on every job. As before #341.
 *  - `job`: a job's own calendar, scored on that job's payments alone.
 *  - `borrowed`: a job's own calendar with fewer than `JOB_RECORD_MIN_PAYMENTS` payments of its own,
 *    so the payer's payments on every job stand in, replayed through the job's calendar.
 */
export type PayCalendarRecordOf = 'payer' | 'job' | 'borrowed'

/** The record a due day is scored on, and whose it is. */
export type PayCalendarRecord = {
  lateness: PayCalendarLateness | null
  of: PayCalendarRecordOf
  /** The job's own measured payments among the payer's; 0 on the payer's calendar, where nobody counts them. */
  jobPayments: number
}

/**
 * The record behind one bill's due day. A job on its own calendar pays under its own terms, so the
 * payer's payments on other jobs say little about it: once the job has two payments of its own it is
 * scored on those alone. Until then the payer's record stands in, and `of` says so. Null with no
 * calendar. The receipts are the newest the pay-speeds read returns, at most 12 a payer, so a job's
 * older payments are not counted.
 */
export function recordFor(receipts: ReadonlyArray<PayCalendarReceipt> | null | undefined, read: PayCalendarRead): PayCalendarRecord | null {
  const cal = read.calendar
  if (!cal) return null
  if (read.from !== 'job' || !read.jobId) return { lateness: latenessAgainst(receipts, cal), of: 'payer', jobPayments: 0 }
  const own = (receipts ?? []).filter((r) => r.jobId === read.jobId)
  const ownLateness = own.length >= JOB_RECORD_MIN_PAYMENTS ? latenessAgainst(own, cal) : null
  if (ownLateness && ownLateness.count >= JOB_RECORD_MIN_PAYMENTS) return { lateness: ownLateness, of: 'job', jobPayments: ownLateness.count }
  return { lateness: latenessAgainst(receipts, cal), of: 'borrowed', jobPayments: own.length }
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
export function latenessWords(lateness: PayCalendarLateness | null | undefined, whose: 'Their' | 'This job’s' = 'Their'): string {
  if (!lateness) return 'No payment on record yet. The due day is the best guess there is.'
  const { count, minDays, maxDays, medianDays, onTime } = lateness
  if (count === 1) {
    if (maxDays <= 0) return `${whose} one payment on record landed by its due day.`
    return `${whose} one payment on record landed ${counted(maxDays, 'day', 'days')} after its due day.`
  }
  if (maxDays <= 0) return `${whose} last ${count} payments all landed by the due day.`
  const from = Math.max(0, minDays)
  const range = from === maxDays ? `${counted(maxDays, 'day', 'days')}` : `${from} to ${counted(maxDays, 'day', 'days')}`
  const usual = medianDays > 0 ? ` Usually about ${medianDays}.` : ' Usually on the day.'
  const kept = onTime > 0 && onTime < count ? ` ${onTime} of ${count} were on time.` : ''
  return `${whose} last ${count} payments landed ${range} after the due day.${usual}${kept}`
}

/**
 * The record in the window's and the hover's words, saying whose it is (punch list #341, PR 3). On the
 * payer's calendar these are `latenessWords` as they always were. A job scored on its own payments says
 * *This job's last 3 payments…*. A job still on its payer's record says so first, and how many payments
 * it has of its own.
 */
export function recordWords(record: PayCalendarRecord | null | undefined, payerName?: string | null): string {
  if (!record) return latenessWords(null)
  if (record.of === 'payer') return latenessWords(record.lateness)
  if (record.of === 'job') return latenessWords(record.lateness, 'This job’s')
  const who = (payerName ?? '').trim() || 'the payer'
  if (!record.lateness) return `No payment on this job yet, and none on record for ${who}. The due day is the best guess there is.`
  const lead = record.jobPayments > 0 ? `One payment on this job so far. Until it has ${JOB_RECORD_MIN_PAYMENTS}, the record is ${who}’s on all their jobs.` : `No payment on this job yet. The record is ${who}’s on other jobs.`
  return `${lead} ${latenessWords(record.lateness)}`
}

/** Whose record a row's line stands on, in the fewest words, for the tail of a narrow line; null on the payer's own, which needs no word. */
export function recordOfShort(record: PayCalendarRecord | null | undefined): string | null {
  if (!record || record.of === 'payer') return null
  return record.of === 'job' ? 'this job’s record' : 'their record on other jobs'
}

/** A dates row's line under a due day: the day the money usually lands, then whose record says so. "Usually lands about Dec 16 · this job’s record". */
export function recordLandsShort(dueYmd: string, record: PayCalendarRecord | null | undefined): string {
  const lands = usuallyLandsShort(dueYmd, record?.lateness)
  if (!lands) return record && record.of !== 'payer' ? 'No payment on this job yet' : 'No payment on record yet'
  const of = recordOfShort(record)
  return of ? `${lands} · ${of}` : lands
}

/** That line's hover, with the math and whose record it is. */
export function recordLandsWords(dueYmd: string, record: PayCalendarRecord | null | undefined, payerName?: string | null): string {
  const lands = usuallyLandsWords(dueYmd, record?.lateness)
  if (!record || record.of === 'payer') return lands ?? 'No payment of theirs is measured yet, so the due day is the best guess there is.'
  const who = (payerName ?? '').trim() || 'the payer'
  if (!lands) return `No payment on this job is measured yet, and none of ${who}’s. The due day is the best guess there is.`
  if (record.of === 'job') return `${lands} That is this job’s own ${record.jobPayments} payments, not ${who}’s other jobs.`
  return `${lands} That is ${who}’s record on ${record.jobPayments > 0 ? 'all their jobs' : 'other jobs'}. This job is scored on its own once it has ${JOB_RECORD_MIN_PAYMENTS} payments.`
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
  /** The calendar the bill read, whether it is its job's own, and the record it was scored on (`billCalendarRead`); absent on a read built bare. */
  of?: { calendar: PayCalendar; own: boolean; record: PayCalendarRecord }
  /** The due day is the bill's own (punch list #341, PR 4): no calendar was read. */
  billOwn?: boolean
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

/**
 * One open bill against the calendar it reads, scored on the record that calendar calls for
 * (`recordFor`): a job on its own calendar on its own payments once it has two. The read carries
 * the calendar and the record, so a payer's summary line can read its bills (`payerCalendarSummary`).
 * Null with no calendar, or no usable day.
 */
export function billCalendarRead(read: PayCalendarRead, clockYmd: string | null | undefined, receipts: ReadonlyArray<PayCalendarReceipt> | null | undefined, todayYmd: string): CalendarBillRead | null {
  // A bill with its own due day reads that day and no calendar (punch list #341, PR 4): nothing is replayed, so the expected day is the day itself.
  if (read.ownDue) {
    const since = payCalendarDaysBetween(read.ownDue.dueYmd, todayYmd)
    if (since == null) return null
    const past = Math.max(0, since)
    return { dueYmd: read.ownDue.dueYmd, expectedYmd: read.ownDue.dueYmd, daysPastDue: past, daysPastExpected: past, tone: past >= PAY_CALENDAR_MISSED_RUN_DAYS ? 'late' : past > 0 ? 'warn' : 'ok', billOwn: true }
  }
  const record = recordFor(receipts, read)
  if (!read.calendar || !record) return null
  const bill = calendarBillRead(clockYmd, read.calendar, record.lateness, todayYmd)
  return bill ? { ...bill, of: { calendar: read.calendar, own: read.from === 'job', record } } : null
}

/** What a payer's summary line reads in Money waiting and Accounts Receivable (punch list #341, PR 3). */
export type PayerCalendarSummary = {
  /** The calendar the line reads: the one behind the bill furthest past its expected day, else the payer's own; null with neither. */
  calendar: PayCalendar | null
  /** That calendar is one job's own, not the payer's. */
  own: boolean
  /** The record that calendar was scored on. */
  lateness: PayCalendarLateness | null
  recordOf: PayCalendarRecordOf | null
  /** The most days any bill is past its expected day; null when none is. */
  pastExpectedDays: number | null
  /** The bill furthest past is past its own due day, with no calendar behind it (punch list #341, PR 4). */
  billOwn?: boolean
}

/**
 * A payer's summary line, read from its bills. Before #341's PR 3 the line read the payer's own
 * calendar alone, so a payer with none and one job on its own calendar read as a pace payer while
 * that job's bill was judged by its due day. Now the bill furthest past its expected day lends the
 * line its calendar and its record. With no bill past, the line reads the payer's own, as before.
 */
export function payerCalendarSummary(payer: { calendar: PayCalendar | null; lateness: PayCalendarLateness | null }, bills: ReadonlyArray<CalendarBillRead | null | undefined>): PayerCalendarSummary {
  let worst: CalendarBillRead | null = null
  for (const b of bills) if (b && b.daysPastExpected > 0 && (!worst || b.daysPastExpected > worst.daysPastExpected)) worst = b
  if (worst) {
    // One bill past its own due day: the line reads that day, whatever calendar the payer holds.
    if (worst.billOwn) return { calendar: null, own: false, lateness: null, recordOf: null, pastExpectedDays: worst.daysPastExpected, billOwn: true }
    const of = worst.of
    // A read built bare names no calendar of its own: it was the payer's.
    if (!of) return payer.calendar ? { calendar: payer.calendar, own: false, lateness: payer.lateness, recordOf: 'payer', pastExpectedDays: worst.daysPastExpected } : { calendar: null, own: false, lateness: null, recordOf: null, pastExpectedDays: null }
    return { calendar: of.calendar, own: of.own, lateness: of.record.lateness, recordOf: of.record.of, pastExpectedDays: worst.daysPastExpected }
  }
  if (payer.calendar) return { calendar: payer.calendar, own: false, lateness: payer.lateness, recordOf: 'payer', pastExpectedDays: null }
  return { calendar: null, own: false, lateness: null, recordOf: null, pastExpectedDays: null }
}

/** The read in a row's words: "due Dec 10" · "due Nov 10 · 5d past due" · "due Nov 10 · 12d past expected". A bill's own day has no expected day apart from it. */
export function calendarBillWords(read: CalendarBillRead): string {
  const due = `due ${payCalendarMonthDay(read.dueYmd)}`
  if (read.billOwn) return read.daysPastDue > 0 ? `${due} · ${read.daysPastDue}d past due` : due
  if (read.daysPastExpected > 0) return `${due} · ${read.daysPastExpected}d past expected`
  if (read.daysPastDue > 0) return `${due} · ${read.daysPastDue}d past due`
  return due
}

/** What a calendar payer's waits are measured against, in a list's small line: "pay calendar · lands ~6d after the pay day". */
export function calendarBasisWords(lateness: PayCalendarLateness | null | undefined, own = false, billOwn = false, cal?: PayCalendar | null): string {
  if (billOwn) return 'a bill’s own due day'
  // Terms in days after the bill have a due day and no pay day (punch list #341, PR 5).
  const noun = payTermsNoun(cal)
  const day = paysDaysAfter(cal) ? 'due day' : 'pay day'
  const whose = own ? `a job’s own ${noun}` : noun
  if (!lateness) return `${whose} · no payment on record yet`
  if (lateness.medianDays <= 0) return `${whose} · lands by the ${day}`
  return `${whose} · lands ~${lateness.medianDays}d after the ${day}`
}

/** A summary line's hover on a payer whose line reads a calendar: whose calendar it is, in one sentence before the calendar's own. */
export function payerCalendarLead(name: string | null | undefined, own: boolean, cal?: PayCalendar | null): string {
  const who = (name ?? '').trim()
  const noun = payTermsNoun(cal)
  if (own) return who ? `One of ${who}’s jobs is on its own ${noun}.` : `One of their jobs is on its own ${noun}.`
  if (paysDaysAfter(cal)) return who ? `${who} pays a set number of days after a bill.` : 'Pays a set number of days after a bill.'
  return who ? `${who} pays on a calendar.` : 'Pays on a calendar.'
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
  if (paysDaysAfter(cal)) {
    const due = dueDayFor(todayYmd, cal)
    // Said where the bill goes out: the day counts from the day they accept it, so today is the soonest.
    return due ? { due: `Sent today, this bill is due ${payCalendarMonthDay(due)}.`, cutoff: `They pay ${counted(cal.daysAfter, 'day', 'days')} after they accept it.`, soon: false } : null
  }
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
