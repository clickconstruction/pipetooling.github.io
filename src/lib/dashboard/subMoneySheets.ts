/**
 * Dashboard → Your money, the sub's own sheets (punch list #184 sweep B). The list read newest
 * sheet first. Its right order is the day each open balance becomes payable, `payable_after`, a
 * date the office sets and the sub portal already shows (*Payable after Sep 9*): the sheet
 * payable soonest leads. An open sheet with no date follows, the oldest first, and the settled
 * sheets close the list, newest first, a log.
 */
import { formatYmdMonthDay } from '../jobs/billedExpectedPay'

export type SubMoneySheetOrderFields = {
  /** What is still open on the sheet; zero or less is settled. */
  balance: number
  /** YYYY-MM-DD the open balance becomes payable, or null when no date is promised. */
  payableAfter: string | null
  /** The sheet's created stamp, for the order of the undated and the settled. */
  createdAt: string | null
}

function tier(s: SubMoneySheetOrderFields): 0 | 1 | 2 {
  if (s.balance <= 0) return 2
  return s.payableAfter ? 0 : 1
}

/** Soonest payable first, then open sheets with no date oldest first, then settled sheets newest first. */
export function compareSubMoneySheets(a: SubMoneySheetOrderFields, b: SubMoneySheetOrderFields): number {
  const ta = tier(a)
  const tb = tier(b)
  if (ta !== tb) return ta - tb
  const ca = a.createdAt ?? ''
  const cb = b.createdAt ?? ''
  if (ta === 0) return (a.payableAfter ?? '').localeCompare(b.payableAfter ?? '') || ca.localeCompare(cb)
  if (ta === 1) return ca.localeCompare(cb)
  return cb.localeCompare(ca)
}

export function sortSubMoneySheets<T extends SubMoneySheetOrderFields>(sheets: ReadonlyArray<T>): T[] {
  return [...sheets].sort(compareSubMoneySheets)
}

/**
 * The sheet's payable words, only while money is open: *payable after Nov 2* before the day,
 * *payable today* on it, *payable since Oct 20* once it has passed; null for a settled sheet or one
 * with no date. Always neutral, never the age state's amber or red: those ask the viewer to act,
 * and this is the sub's own screen, where the sub cannot act on the payment. A red *6 days late*
 * here would be the company's app telling a sub the company is late (punch list #184, the review).
 */
export function subSheetPayableWords(sheet: Pick<SubMoneySheetOrderFields, 'balance' | 'payableAfter'>, todayYmd: string): string | null {
  if (sheet.balance <= 0 || !sheet.payableAfter) return null
  const day = sheet.payableAfter.slice(0, 10)
  const today = todayYmd.slice(0, 10)
  if (day > today) return `payable after ${formatYmdMonthDay(day)}`
  if (day === today) return 'payable today'
  return `payable since ${formatYmdMonthDay(day)}`
}
