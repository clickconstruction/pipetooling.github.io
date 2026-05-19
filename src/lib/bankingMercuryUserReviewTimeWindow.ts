import type { Database } from '../types/database'
import {
  calendarYmdInAppTzFromIso,
  companyWeekStartSundayContaining,
  ymdAddDays,
} from '../utils/dateUtils'

export type UserReviewTimeWindow =
  | 'this_week'
  | 'last_week'
  | 'last_2_weeks'
  | 'last_30_days'
  | 'last_60_days'
  | 'last_90_days'
  | 'all'

export const USER_REVIEW_TIME_WINDOW_DEFAULT: UserReviewTimeWindow = 'last_30_days'

export type UserReviewTimeWindowOption = {
  value: UserReviewTimeWindow
  label: string
}

export const USER_REVIEW_TIME_WINDOW_OPTIONS: UserReviewTimeWindowOption[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_2_weeks', label: 'Last 2 weeks' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_60_days', label: 'Last 60 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export type UserReviewTimeWindowRange = {
  /** Inclusive start YYYY-MM-DD in America/Chicago. */
  startYmd: string
  /** Inclusive end YYYY-MM-DD in America/Chicago. */
  endYmd: string
}

/** Today's YYYY-MM-DD in `APP_CALENDAR_TZ` for an instant. Empty if invalid. */
function appTzYmdFromMs(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return calendarYmdInAppTzFromIso(d.toISOString())
}

/**
 * Resolve a window selection to an inclusive date range (or null for `all`).
 * Tests pass `nowMs` explicitly so results are deterministic.
 */
export function getUserReviewTimeWindowRange(
  window: UserReviewTimeWindow,
  nowMs: number = Date.now(),
): UserReviewTimeWindowRange | null {
  if (window === 'all') return null

  const todayYmd = appTzYmdFromMs(nowMs)
  if (todayYmd === '') return null

  if (window === 'this_week') {
    const sun = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
    return { startYmd: sun, endYmd: ymdAddDays(sun, 6) }
  }

  if (window === 'last_week') {
    const sunThis = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
    const sunLast = ymdAddDays(sunThis, -7)
    return { startYmd: sunLast, endYmd: ymdAddDays(sunLast, 6) }
  }

  const days =
    window === 'last_2_weeks'
      ? 14
      : window === 'last_30_days'
        ? 30
        : window === 'last_60_days'
          ? 60
          : window === 'last_90_days'
            ? 90
            : 0
  if (days <= 0) return null

  // Trailing window inclusive of today: today, today-1, …, today-(days-1).
  const startYmd = ymdAddDays(todayYmd, -(days - 1))
  return { startYmd, endYmd: todayYmd }
}

export type TimeWindowMercuryTxRow = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'id' | 'posted_at' | 'created_at'
>

/**
 * Determine the YYYY-MM-DD a Mercury transaction belongs to in `APP_CALENDAR_TZ`.
 * Prefers `posted_at`; falls back to `created_at`. Returns null if neither is parseable.
 */
export function mercuryTxCalendarDayKey(row: TimeWindowMercuryTxRow): string | null {
  const candidates: (string | null | undefined)[] = [row.posted_at, row.created_at]
  for (const c of candidates) {
    if (c == null) continue
    const trimmed = c.trim()
    if (trimmed === '') continue
    const ms = Date.parse(trimmed)
    if (!Number.isFinite(ms)) continue
    const ymd = appTzYmdFromMs(ms)
    if (ymd !== '') return ymd
  }
  return null
}

/**
 * Pure filter — keep only transactions whose Chicago calendar day falls inside the inclusive range.
 * For `window === 'all'` the input array is returned unchanged (referentially equal).
 */
export function filterMercuryTxByUserReviewTimeWindow<T extends TimeWindowMercuryTxRow>(
  rows: T[],
  window: UserReviewTimeWindow,
  nowMs: number = Date.now(),
): T[] {
  if (window === 'all') return rows
  const range = getUserReviewTimeWindowRange(window, nowMs)
  if (range == null) return rows
  const out: T[] = []
  for (const r of rows) {
    const k = mercuryTxCalendarDayKey(r)
    if (k == null) continue
    if (k >= range.startYmd && k <= range.endYmd) out.push(r)
  }
  return out
}

/** Display string for the active window's resolved range — e.g. `Apr 17 – May 17`. */
export function formatUserReviewTimeWindowRange(
  window: UserReviewTimeWindow,
  nowMs: number = Date.now(),
): string | null {
  const range = getUserReviewTimeWindowRange(window, nowMs)
  if (range == null) return null
  return `${formatShortYmd(range.startYmd)} – ${formatShortYmd(range.endYmd)}`
}

function formatShortYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(y, mo, d, 12)))
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (month && day) return `${month} ${day}`
    return ymd
  } catch {
    return ymd
  }
}
