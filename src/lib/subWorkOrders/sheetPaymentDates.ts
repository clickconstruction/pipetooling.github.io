/**
 * When a sub sheet's payments were made, for the Pay view's row (punch list #347, PR 1).
 *
 * The row said how much was paid and never when: the dates sat in the opened row's Payments table, one sheet at a
 * time, and nowhere on a phone. This reads the sheet's payments (already in memory) into the row's own words.
 *
 * A payment's date is its Date sent (`payment_date`). A row with none shows the day it was recorded, in the app's
 * timezone, and says so. A back-charge (an amount below zero) is not a payment and is left out.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export type SheetPaymentLike = { amount: number | string; payment_date?: string | null; created_at?: string | null }

export type SheetPaymentDate = {
  /** The day, `YYYY-MM-DD`. */
  ymd: string
  /** True when the payment has no Date sent and `ymd` is the day the row was recorded. */
  recorded: boolean
}

export type SheetPaymentDates = {
  /** How many payments the sheet has, dated or not. */
  count: number
  /** Each payment's day, oldest first. A payment with no day at all is counted and not listed. */
  dates: SheetPaymentDate[]
  /** The newest day, null when no payment has one. */
  last: SheetPaymentDate | null
}

const YMD = /^\d{4}-\d{2}-\d{2}/

function dayOf(p: SheetPaymentLike): SheetPaymentDate | null {
  const sent = (p.payment_date ?? '').trim()
  if (YMD.test(sent)) return { ymd: sent.slice(0, 10), recorded: false }
  const made = (p.created_at ?? '').trim()
  if (!made) return null
  const ymd = calendarYmdInAppTzFromIso(made)
  return YMD.test(ymd) ? { ymd: ymd.slice(0, 10), recorded: true } : null
}

export function sheetPaymentDates(payments: readonly SheetPaymentLike[] | null | undefined): SheetPaymentDates {
  const paid = (payments ?? []).filter((p) => Number(p.amount) > 0)
  const dates = paid
    .map(dayOf)
    .filter((d): d is SheetPaymentDate => d !== null)
    .sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
  return { count: paid.length, dates, last: dates.length > 0 ? dates[dates.length - 1]! : null }
}

/** `Nov 12`, or `Nov 12, 2025` for a day in another year than today's. A recorded day leads with `recorded`. */
export function paymentDayWords(d: SheetPaymentDate, todayYmd: string): string {
  const day = d.ymd.slice(0, 4) === todayYmd.slice(0, 4) ? formatWorkDateYmdMonthDayShort(d.ymd) : formatWorkDateYmdFriendly(d.ymd)
  return d.recorded ? `recorded ${day}` : day
}

/**
 * The line under the row's Paid amount: each day for one or two payments (`Oct 21 · Nov 10`), the count and the
 * newest day for more (`3 payments · last Nov 12`). Null when the sheet has no payment with a day.
 */
export function sheetPaidLine(s: SheetPaymentDates, todayYmd: string): string | null {
  if (!s.last) return null
  if (s.count <= 2 && s.dates.length === s.count) return s.dates.map((d) => paymentDayWords(d, todayYmd)).join(' · ')
  return `${s.count} payments · last ${paymentDayWords(s.last, todayYmd)}`
}

/** A settled sheet's Pay when words, in place of `balance is $0`: `paid in full Nov 12`. Null when no day is known. */
export function sheetPaidInFullWords(s: SheetPaymentDates, todayYmd: string): string | null {
  if (!s.last) return null
  return s.last.recorded ? `paid in full · ${paymentDayWords(s.last, todayYmd)}` : `paid in full ${paymentDayWords(s.last, todayYmd)}`
}
