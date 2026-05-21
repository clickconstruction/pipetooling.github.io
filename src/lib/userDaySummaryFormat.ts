import { APP_CALENDAR_TZ } from '../utils/dateUtils'

function formatClockTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Formats a clock session's time range for the User Day Summary modal.
 *
 * Mirrors the open-punch convention from
 * `clockSessionsToDispatchSecondaryBands`:
 * - Closed session: `8:03 AM–12:11 PM`.
 * - Open session whose `dayYmd === todayYmd`: `8:03 AM–now`.
 * - Open session on a past day: `8:03 AM–no clock out`.
 *
 * Callers should derive `todayYmd` via `denverCalendarDayKey(nowMs)` once at
 * the top of the component (same pattern used in
 * `clockSessionsToDispatchSecondaryBands`). Taking the resolved string in
 * keeps this helper deterministic for tests and free of Intl behavior drift.
 */
export function formatSessionTimeRange(
  clockedInAt: string,
  clockedOutAt: string | null,
  dayYmd: string,
  todayYmd: string,
): string {
  const start = formatClockTimeLabel(clockedInAt)
  if (clockedOutAt) return `${start}–${formatClockTimeLabel(clockedOutAt)}`
  if (dayYmd === todayYmd) return `${start}–now`
  return `${start}–no clock out`
}

/**
 * Formats a clock session duration in human-friendly `Xh Ym` / `Ym` form.
 * Returns `0m` for non-positive / non-finite inputs. Rounds down to whole
 * minutes so a 7m 59s session reads as `7m`, matching the way the dispatch
 * strip rounds slot widths.
 */
export function formatSessionDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes - hours * 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/**
 * Convenience wrapper computing the duration in ms between a session's
 * clock-in and either its clock-out (when closed) or `nowMs` (when the
 * session is still open and `dayYmd === todayYmd`). Returns null for an
 * open punch on a past day so the caller can decide whether to display a
 * duration at all for stale open punches.
 */
export function computeSessionDurationMs(
  clockedInAt: string,
  clockedOutAt: string | null,
  nowMs: number,
  dayYmd: string,
  todayYmd: string,
): number | null {
  const startMs = new Date(clockedInAt).getTime()
  if (!Number.isFinite(startMs)) return null
  if (clockedOutAt) {
    const endMs = new Date(clockedOutAt).getTime()
    if (!Number.isFinite(endMs)) return null
    return Math.max(0, endMs - startMs)
  }
  if (dayYmd === todayYmd) return Math.max(0, nowMs - startMs)
  return null
}
