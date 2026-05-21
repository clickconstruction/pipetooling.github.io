/**
 * Compute a softer "(today)" / "(yesterday)" / "(tomorrow)" / "(N days ago)" /
 * "(in N days)" phrase relative to `todayYmd` (caller-controlled, typically
 * `denverCalendarDayKey(Date.now())` so it reflects the company calendar day).
 *
 * Day-count math mirrors `invoiceCreatedCalendarDayOffset` (UTC-noon midpoints
 * avoid DST landmines on YYYY-MM-DD strings) but the result is **unclamped**:
 * positive integers mean `dayYmd` is in the past, negative integers mean it is
 * in the future. That distinction is required by the User Review modal's Week
 * mode, which renders both past and future days inside the company week.
 */

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function ymdToUtcNoonMs(ymd: string): number | null {
  const m = YMD_RE.exec(ymd)
  if (!m) return null
  const y = parseInt(m[1] ?? '', 10)
  const mo = parseInt(m[2] ?? '', 10)
  const d = parseInt(m[3] ?? '', 10)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return Date.UTC(y, mo - 1, d, 12, 0, 0)
}

/**
 * Signed calendar days from `todayYmd` to `dayYmd` (so 3 means dayYmd is 3
 * days **before** today, -2 means 2 days **after** today).
 */
export function relativeDayOffset(dayYmd: string, todayYmd: string): number | null {
  const dayMs = ymdToUtcNoonMs(dayYmd)
  const todayMs = ymdToUtcNoonMs(todayYmd)
  if (dayMs == null || todayMs == null) return null
  return Math.round((todayMs - dayMs) / 86_400_000)
}

/**
 * Natural phrase for `dayYmd` relative to `todayYmd`.
 *
 * - `0` -> `'today'`
 * - `1` -> `'yesterday'`
 * - `-1` -> `'tomorrow'`
 * - `n > 1` -> `'${n} days ago'`
 * - `n < -1` -> `'in ${-n} days'`
 *
 * Returns `null` when either input is not a valid `YYYY-MM-DD` so callers can
 * gracefully omit the subline rather than render a malformed placeholder.
 */
export function formatRelativeDayPhrase(
  dayYmd: string,
  todayYmd: string,
): string | null {
  const n = relativeDayOffset(dayYmd, todayYmd)
  if (n == null) return null
  if (n === 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n === -1) return 'tomorrow'
  if (n > 1) return `${n} days ago`
  return `in ${-n} days`
}
