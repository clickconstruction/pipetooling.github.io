/** Format an ISO timestamp as Chicago wall-clock parts (date / time / "N days ago"). */

import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export type ClockSessionTimestampParts = {
  /** Long-form Chicago calendar date, e.g. `Wed, May 13, 2026`. */
  date: string
  /** Chicago wall-clock time, e.g. `7:32 AM`. */
  time: string
  /** Calendar-day relative label, e.g. `today`, `yesterday`, `5 days ago`. */
  relative: string
}

/**
 * Returns Chicago wall-clock parts for the given ISO timestamp, or `null` for null /
 * empty / unparseable input. Used by Job Detail "Job Start" / "Last Work" tiles so
 * the date, time, and "(N days ago)" lines stack cleanly.
 *
 * `now` is exposed for deterministic tests; production callers should let it default.
 *
 * Calendar-day arithmetic uses Chicago `YYYY-MM-DD` anchors (UTC noon parsing) so
 * DST shifts can never produce a 0.96-day or 1.04-day result.
 */
export function formatClockSessionTimestampPartsChicago(
  iso: string | null | undefined,
  now: Date = new Date(),
): ClockSessionTimestampParts | null {
  const raw = iso?.trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)

  const relative = chicagoCalendarDayLabel(d, now)

  return { date, time, relative }
}

/**
 * Read year / month / day fields from `Intl.DateTimeFormat` parts so we get
 * Chicago calendar components reliably across ICU versions (some platforms
 * format `en-CA` as `YYYY-MM-DD` and others as `MM/DD/YYYY`).
 */
const YMD_CHICAGO_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function chicagoCalendarMidnightUtc(d: Date): number | null {
  const parts = YMD_CHICAGO_FORMATTER.formatToParts(d)
  let year: number | null = null
  let month: number | null = null
  let day: number | null = null
  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value)
    else if (part.type === 'month') month = Number(part.value)
    else if (part.type === 'day') day = Number(part.value)
  }
  if (
    year === null ||
    month === null ||
    day === null ||
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null
  }
  return Date.UTC(year, month - 1, day, 12, 0, 0)
}

function chicagoCalendarDayLabel(stamp: Date, now: Date): string {
  const a = chicagoCalendarMidnightUtc(stamp)
  const b = chicagoCalendarMidnightUtc(now)
  if (a === null || b === null) return ''
  const diffDays = Math.round((b - a) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays > 1) return `${diffDays} days ago`
  if (diffDays === -1) return 'tomorrow'
  return `in ${Math.abs(diffDays)} days`
}
