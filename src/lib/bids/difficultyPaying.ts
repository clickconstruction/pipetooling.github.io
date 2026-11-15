/**
 * GC difficulty rating (punch list #357, PR 3): the Paying scale, read from the GC's bills.
 *
 * Paying is never picked by a person (the owner's call of 2026-11-14). The point comes from what the app already
 * keeps about how the GC pays: the median days from a bill to its payment and the payments themselves
 * (`get_billed_customer_pay_speeds`, `billedExpectedPay.ts`), the GC pace here (`payPace.ts`) and, where the office
 * set one, the GC's pay calendar replayed against those payments (`payCalendar.ts`). The rule is the price list's
 * (PR 4); until then it is the default here: a point when the median is past the days, or enough bills in the last
 * year landed after their calendar's due day. Fewer bills than the minimum reads no point, and says so. The office
 * may set the point by hand with a reason instead.
 *
 * Pure: the reads are in `difficultyPayingIo.ts`. The read is written into the rating's picks with its words
 * (`pick_reasons`), so a rating stays a record with reasons; the card shows the live read beside what the rating
 * holds, and wakes the save press when they differ.
 */
import type { PayReceipt, PaySpeedStat } from '../jobs/billedExpectedPay'
import { dueDayFor, payCalendarDaysBetween, type PayCalendar } from '../jobs/payCalendar'

export const DIFFICULTY_PAYING_KEY = 'paying'

export type DifficultyPayingRule = {
  /** A point when the median days to pay is past this. */
  daysPast: number
  /** A point when this many bills in the last year landed after their calendar's due day. */
  lateBillsInYear: number
  /** Fewer bills than this reads no point. */
  minBills: number
}

/** The rule until the Bid Board's price list carries it (PR 4). */
export const DIFFICULTY_PAYING_RULE_DEFAULT: DifficultyPayingRule = { daysPast: 45, lateBillsInYear: 2, minBills: 3 }

export type DifficultyPayingInputs = {
  /** The pay-speed read could be made at all (the role may read it, the call answered). */
  readable: boolean
  /** The GC's own median and sample count; null with no measured payment. */
  own: PaySpeedStat | null
  /** The GC's measured payments, newest first, at most 12. */
  receipts: readonly PayReceipt[]
  /** The GC pace here: the median of the GC payers' own medians, and how many payers it rests on. */
  gcPace: { medianDays: number; payers: number } | null
  /** The GC's pay calendar, when the office set one. */
  calendar: PayCalendar | null
  todayYmd: string
}

export type DifficultyPayingWhy = 'unreadable' | 'too-few' | 'slow' | 'late' | 'fine'

export type DifficultyPayingRead = {
  /** 1, 0, or null when nothing can be read. */
  points: 0 | 1 | null
  why: DifficultyPayingWhy
  bills: number
  medianDays: number | null
  /** Bills in the last year that landed after their calendar's due day; null with no calendar. */
  lateInYear: number | null
  gcPaceDays: number | null
  gcPacePayers: number
  rule: DifficultyPayingRule
}

const DAYS_IN_YEAR = 365

/** How many of the measured payments in the last year landed after their calendar's due day; null with no calendar. */
export function lateBillsInYear(receipts: readonly PayReceipt[], calendar: PayCalendar | null, todayYmd: string): number | null {
  if (!calendar) return null
  let late = 0
  for (const r of receipts) {
    const age = payCalendarDaysBetween(r.paidYmd, todayYmd)
    if (age == null || age > DAYS_IN_YEAR) continue
    const due = dueDayFor(r.billedYmd, calendar)
    const after = due ? payCalendarDaysBetween(due, r.paidYmd) : null
    if (after != null && after > 0) late += 1
  }
  return late
}

export function readDifficultyPaying(inputs: DifficultyPayingInputs, rule: DifficultyPayingRule = DIFFICULTY_PAYING_RULE_DEFAULT): DifficultyPayingRead {
  const bills = inputs.own?.samples ?? inputs.receipts.length
  const medianDays = inputs.own?.medianDays ?? null
  const base = {
    bills,
    medianDays,
    lateInYear: lateBillsInYear(inputs.receipts, inputs.calendar, inputs.todayYmd),
    gcPaceDays: inputs.gcPace?.medianDays ?? null,
    gcPacePayers: inputs.gcPace?.payers ?? 0,
    rule,
  }
  if (!inputs.readable) return { ...base, points: null, why: 'unreadable' }
  if (bills < rule.minBills || medianDays == null) return { ...base, points: null, why: 'too-few' }
  if (medianDays > rule.daysPast) return { ...base, points: 1, why: 'slow' }
  if (base.lateInYear != null && base.lateInYear >= rule.lateBillsInYear) return { ...base, points: 1, why: 'late' }
  return { ...base, points: 0, why: 'fine' }
}

const billsWord = (n: number) => `${n} bill${n === 1 ? '' : 's'}`
const daysWord = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** The numbers behind the read, as the card shows them under the scale. */
export function difficultyPayingWords(r: DifficultyPayingRead): string {
  if (r.why === 'unreadable') return 'Their bills could not be read, so the point is not known.'
  if (r.why === 'too-few') return r.bills === 0 ? `No paid bill on record yet. The point is read once they have ${r.rule.minBills}.` : `${billsWord(r.bills)} on record, fewer than the ${r.rule.minBills} the read needs. No point.`
  const parts = [`Paid in ${daysWord(r.medianDays ?? 0)}, the median of ${billsWord(r.bills)}.`]
  if (r.gcPaceDays != null && r.gcPacePayers > 0) parts.push(`The GC pace is ${daysWord(r.gcPaceDays)}.`)
  if (r.lateInYear != null) parts.push(r.lateInYear === 0 ? 'None in the last year went past their calendar.' : `${billsWord(r.lateInYear)} in the last year went past their calendar.`)
  return parts.join(' ')
}

/** The rule in a sentence. */
export function difficultyPayingRuleWords(rule: DifficultyPayingRule): string {
  return `A point when the median is past ${daysWord(rule.daysPast)}, or ${billsWord(rule.lateBillsInYear)} in a year are late. Read once a GC has ${billsWord(rule.minBills)}.`
}

export const DIFFICULTY_PAYING_BY_HAND = 'By hand: '

/** The words a read point carries into the rating (`pick_reasons.paying`). */
export function difficultyPayingReadReason(r: DifficultyPayingRead): string {
  return `Read from their bills: ${difficultyPayingWords(r)}`
}

/** The words a by-hand point carries. */
export function difficultyPayingByHandReason(reason: string): string {
  return `${DIFFICULTY_PAYING_BY_HAND}${reason.trim()}`
}

/** A stored reason that was set by hand gives the person's words back; null for a read. */
export function difficultyPayingByHandOf(reason: string | null | undefined): string | null {
  if (!reason || !reason.startsWith(DIFFICULTY_PAYING_BY_HAND)) return null
  return reason.slice(DIFFICULTY_PAYING_BY_HAND.length)
}

export type DifficultyPayingPick = { points: number; reason: string }

/**
 * The Paying pick the card carries into the next save: the by-hand pick when one is set, else the read's point with
 * its words, else nothing (the scale stays unrated).
 */
export function difficultyPayingPick(read: DifficultyPayingRead | null, byHand: { points: number; reason: string } | null): DifficultyPayingPick | null {
  if (byHand && byHand.reason.trim() !== '') return { points: byHand.points, reason: difficultyPayingByHandReason(byHand.reason) }
  if (read && read.points != null) return { points: read.points, reason: difficultyPayingReadReason(read) }
  return null
}

/** The line that says where the rating that stands and the bills now disagree; null when they agree or nothing is read. */
export function difficultyPayingDriftWords(stored: { points: number; reason: string } | null, read: DifficultyPayingRead | null): string | null {
  if (!read || read.points == null) return null
  if (!stored) return `Their bills read ${read.points === 1 ? '1 point' : '0 points'} now. The rating that stands has no Paying point yet. Save to read it in.`
  if (difficultyPayingByHandOf(stored.reason) != null) return null
  if (stored.points === read.points) return null
  return `Their bills read ${read.points === 1 ? '1 point' : '0 points'} now; the rating holds ${stored.points}. Save to read it in.`
}
