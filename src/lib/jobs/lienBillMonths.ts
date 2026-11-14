import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * The lien work month of a job nobody clocked on (the owner, 2026-11-13). Pure.
 *
 * A job with no approved clock hours and no last day of work set by hand was dated from the day it was
 * made (v2.3747). Jobs brought in from the earlier system were made weeks after their work, so their
 * papers named the month they were typed in. The owner's rule: the month comes from the bill.
 *
 * - Only a bill that went out and is still unpaid counts (`status = 'billed'`): it is the work payment
 *   is asked for.
 * - A bill's day is the earlier of the day it was marked billed and the day it went to the customer, in
 *   the company calendar. A bill sent again later keeps its first day.
 * - Each such bill gives a month. The latest is the last month, which the last day to file counts from.
 * - A job with no dated unpaid bill keeps its creation month, so no job falls out of the lien readers
 *   (punch list #32's lesson).
 *
 * A bill is not a record of work. It is sometimes written before the job is done and sometimes weeks
 * after, so a month from a bill is a stand-in until a person sets the last day of work. Every surface
 * that shows one says so (`MONTH_FROM_BILL_LINE`); none holds a paper for it. The SQL twin is
 * `public.lien_bill_months(uuid)`, which the four lien readers call.
 */

export type LienBill = { status?: string | null; billed_at?: string | null; sent_to_customer_at?: string | null }

/** Where a stand-in month came from: a sent, unpaid bill, or the day the job was made. */
export type LienStandInSource = 'bill' | 'job_created'

const YMD = /^\d{4}-\d{2}-\d{2}$/

function dayOf(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim()
  if (!raw) return ''
  // A bare day is already a calendar day; an instant is read in the company calendar.
  if (YMD.test(raw)) return raw
  const day = calendarYmdInAppTzFromIso(raw)
  return YMD.test(day) ? day : ''
}

/** The day a bill counts from: the earlier of its billed day and its sent day; '' when it has neither. */
export function lienBillDay(bill: LienBill): string {
  const days = [dayOf(bill.billed_at), dayOf(bill.sent_to_customer_at)].filter(Boolean).sort()
  return days[0] ?? ''
}

export type LienBillMonths = {
  /** 'YYYY-MM', oldest first, one per month a sent, unpaid bill is dated in. */
  months: string[]
  /** The latest of those months; '' when there is none. */
  lastMonth: string
  /** The latest bill day, 'YYYY-MM-DD'; '' when there is none. */
  lastDay: string
}

/** The months a job's sent, unpaid bills are dated in. */
export function lienBillMonths(bills: ReadonlyArray<LienBill> | null | undefined): LienBillMonths {
  const days = (bills ?? [])
    .filter((b) => b.status === 'billed')
    .map(lienBillDay)
    .filter(Boolean)
    .sort()
  const months = [...new Set(days.map((d) => d.slice(0, 7)))]
  return { months, lastMonth: months[months.length - 1] ?? '', lastDay: days[days.length - 1] ?? '' }
}

export type LienStandIn = {
  /** 'YYYY-MM-DD' the dates count from; '' when the job has neither a dated bill nor a creation day. */
  day: string
  /** 'YYYY-MM' */
  month: string
  /** Every stand-in month, oldest first: the bill months, or the one creation month. */
  months: string[]
  source: LienStandInSource | null
}

/**
 * The month of a job with no approved hours and no last day set by hand: its sent, unpaid bills when one
 * is dated, else the day it was made. The callers ask only when the hours and the hand-set day are absent.
 */
export function lienStandInMonth(src: { bills?: ReadonlyArray<LienBill> | null; createdAt?: string | null }): LienStandIn {
  const fromBills = lienBillMonths(src.bills)
  if (fromBills.lastDay) return { day: fromBills.lastDay, month: fromBills.lastMonth, months: fromBills.months, source: 'bill' }
  const created = dayOf(src.createdAt)
  if (created) return { day: created, month: created.slice(0, 7), months: [created.slice(0, 7)], source: 'job_created' }
  return { day: '', month: '', months: [], source: null }
}

/** The line under a month dated from a bill: one wording on every surface, beside `DATED_FROM_CREATION_WORDS`. */
export const DATED_FROM_BILL_WORDS = 'dated from the bill · no clock hours'

/** The plain line wherever a bill's month shows on a paper's own screen, its help sheet and its notice record. */
export const MONTH_FROM_BILL_LINE = 'The month comes from the bill, not from recorded work.'

/** The same line for a job with no dated bill, whose month is the day it was made. */
export const MONTH_FROM_CREATION_LINE = 'The month comes from the day the job was made, not from recorded work.'

/** What to do about either: the existing door. */
export const MONTH_STAND_IN_DOOR_WORDS = 'Set the last day of work on the job if the work ran in another month.'

/** The line for a stand-in month, by where it came from; '' for a month from hours or a day set by hand. */
export function lienStandInLine(source: LienStandInSource | null | undefined): string {
  return source === 'bill' ? MONTH_FROM_BILL_LINE : source === 'job_created' ? MONTH_FROM_CREATION_LINE : ''
}

/** The stand-in a carried pair of flags names: `standIn` is the flag called `fromCreation` since v2.3747, `fromBill` the one beside it. */
export function lienStandInSourceOf(standIn: boolean | null | undefined, fromBill: boolean | null | undefined): LienStandInSource | null {
  return standIn ? (fromBill ? 'bill' : 'job_created') : null
}

/**
 * The flag a paper on a stand-in month carries, on its pane, its Lien window tab, its help sheet and its notice record:
 * where the month came from and the door. '' for a month from hours or a day set by hand. A flag, never a hold (the
 * owner, 2026-11-13: "Only flag it"), for the reason `lienAffidavitNoticeCheck.ts` gives: a hold has no override, and
 * a paper stopped days before its last day to file would cost the lien.
 */
export function lienStandInFlag(source: LienStandInSource | null | undefined): string {
  const line = lienStandInLine(source)
  return line ? `${line} ${MONTH_STAND_IN_DOOR_WORDS}` : ''
}

/** The short words under a stand-in month. */
export function lienStandInWords(fromBill: boolean): string {
  return fromBill ? DATED_FROM_BILL_WORDS : 'dated from the job’s creation · no clock hours'
}
