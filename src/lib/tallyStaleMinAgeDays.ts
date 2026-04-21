import { denverCalendarDayKey } from '../utils/dateUtils'

/** Default Chicago calendar-day age threshold for “stale” Job Parts Tally Mercury rows (staff + personal banners). */
export const TALLY_STALE_MIN_AGE_DAYS = 2

/** Integer calendar-day span from earlier YYYY-MM-DD to later (Chicago civil dates from `denverCalendarDayKey`). */
function chicagoYmdCalendarDaysBetween(earlierYmd: string, laterYmd: string): number | null {
  const parse = (ymd: string): number | null => {
    const parts = ymd.split('-').map((p) => Number(p))
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
    const [y, m, d] = parts
    if (y == null || m == null || d == null) return null
    return Date.UTC(y, m - 1, d)
  }
  const a = parse(earlierYmd)
  const b = parse(laterYmd)
  if (a == null || b == null) return null
  return Math.floor((b - a) / 86400000)
}

/**
 * Matches `list_stale_unlinked_mercury_transactions_for_tally_staff` when `include_all_unlinked` is false:
 * `(now() AT TIME ZONE 'America/Chicago')::date - (posted_at AT TIME ZONE 'America/Chicago')::date > age_int`.
 */
export function isUnlinkedMercuryRowStaleForTallyStaffFollowUp(
  postedAt: string | null,
  minAgeDays: number,
  nowMs: number = Date.now(),
): boolean {
  if (postedAt == null || postedAt === '') return false
  const postedMs = new Date(postedAt).getTime()
  if (!Number.isFinite(postedMs)) return false
  const ageInt = Math.max(0, Math.floor(minAgeDays))
  const postedYmd = denverCalendarDayKey(postedMs)
  const todayYmd = denverCalendarDayKey(nowMs)
  const diffDays = chicagoYmdCalendarDaysBetween(postedYmd, todayYmd)
  if (diffDays == null) return false
  return diffDays > ageInt
}
