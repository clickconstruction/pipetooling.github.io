// People → Spending's period picker (punch list #52, PR 4b-2): a preset or a custom range →
// inclusive company days [start, end]. Pure, anchored on an injected company "today"
// (`denverCalendarDayKey`). Weeks start on Sunday, as People → Review's do (`reviewDateRange.ts`).

import { ymdAddDays } from '../../utils/dateUtils'
import { ymdDayOfWeek } from './reviewDateRange'
import { CARD_CHARGES_WINDOW_MAX_DAYS } from '../banking/cardChargesWindow'

export type SpendingPeriod = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30_days' | 'custom'

export const SPENDING_PERIODS: ReadonlyArray<{ key: SpendingPeriod; label: string }> = [
  { key: 'this_week', label: 'This week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
]

export const SPENDING_PERIOD_DEFAULT: SpendingPeriod = 'this_month'

export function isSpendingPeriod(v: unknown): v is SpendingPeriod {
  return typeof v === 'string' && SPENDING_PERIODS.some((p) => p.key === v)
}

export type SpendingRange = {
  start: string
  end: string
  /** A custom range longer than the read allows was cut to its last 366 days. */
  shortened: boolean
}

function firstOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

/**
 * Inclusive [start, end] for a period. A custom range swaps when entered backwards, is one day
 * when only one side is filled, falls back to today when both are empty, and keeps its last
 * 366 days when it is longer (the read refuses more).
 */
export function spendingPeriodRange(period: SpendingPeriod, custom: { start: string; end: string }, todayYmd: string): SpendingRange {
  const plain = (start: string, end: string): SpendingRange => ({ start, end, shortened: false })
  const sunday = ymdAddDays(todayYmd, -ymdDayOfWeek(todayYmd))
  switch (period) {
    case 'this_week':
      return plain(sunday, todayYmd)
    case 'last_week':
      return plain(ymdAddDays(sunday, -7), ymdAddDays(sunday, -1))
    case 'this_month':
      return plain(firstOfMonth(todayYmd), todayYmd)
    case 'last_month': {
      const lastOfPrev = ymdAddDays(firstOfMonth(todayYmd), -1)
      return plain(firstOfMonth(lastOfPrev), lastOfPrev)
    }
    case 'last_30_days':
      return plain(ymdAddDays(todayYmd, -29), todayYmd)
    case 'custom': {
      const cs = custom.start.trim()
      const ce = custom.end.trim()
      let start = cs || ce || todayYmd
      let end = ce || cs || todayYmd
      if (start > end) [start, end] = [end, start]
      const earliest = ymdAddDays(end, -(CARD_CHARGES_WINDOW_MAX_DAYS - 1))
      if (start < earliest) return { start: earliest, end, shortened: true }
      return plain(start, end)
    }
  }
}
