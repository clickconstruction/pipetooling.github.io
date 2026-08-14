/**
 * Hours-grid mobile day-sheet kernels (v2.1655): the narrow-viewport grid
 * replaces its three tiny in-cell targets (72px input, !N pending badge, 24px
 * My Time corner) with one whole-cell tap target whose status reads as a word
 * under the hours; tapping opens a bottom sheet carrying the actions. These
 * pure helpers pin the cell's status word and the sheet's day title.
 */

export type HoursGridCellStatus = {
  word: string | null
  tone: 'missing' | 'pending' | null
}

/**
 * The one status word a narrow cell shows under its hours. Missing-job wins
 * over pending — same precedence as the desktop tints (the pending tint is
 * suppressed on missing-job cells).
 */
export function hoursGridCellStatus(args: { pendingCount: number; missingJob: boolean }): HoursGridCellStatus {
  if (args.missingJob) return { word: 'no job', tone: 'missing' }
  if (args.pendingCount > 0) return { word: `${args.pendingCount} pending`, tone: 'pending' }
  return { word: null, tone: null }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * "Thu Aug 14" (with the year appended when it isn't the current one) —
 * locale-independent so jsdom and every device agree.
 */
export function formatDaySheetDayLabel(ymd: string, currentYear?: number): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  if (!y || !m || !d) return ymd
  const dt = new Date(Date.UTC(y, m - 1, d))
  const base = `${WEEKDAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}`
  const nowYear = currentYear ?? new Date().getFullYear()
  return y === nowYear ? base : `${base}, ${y}`
}
