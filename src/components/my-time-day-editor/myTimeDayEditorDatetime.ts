/**
 * Bridge `<input type="datetime-local">` / `<input type="time">` with epoch ms for the My Time day
 * editor, interpreting the wall clock in the company timezone (`APP_CALENDAR_TZ`, America/Chicago),
 * not the browser's local zone. Delegates to the shared Central-aware converters in
 * `utils/datetimeLocal` so clock-session boundary edits match the rest of the app.
 */
import { appTzWallClockToUtcMs, fromDatetimeLocal, toDatetimeLocal } from '../../utils/datetimeLocal'

export function msToDatetimeLocalValue(ms: number): string {
  return toDatetimeLocal(new Date(ms).toISOString())
}

export function parseDatetimeLocalToMs(value: string): number | null {
  const iso = fromDatetimeLocal(value)
  return iso ? new Date(iso).getTime() : null
}

/** Central `HH:mm` for `<input type="time">` (minute precision, matches datetime-local). */
export function msToTimeLocalValue(ms: number): string {
  return msToDatetimeLocalValue(ms).slice(11, 16)
}

/** YYYY-MM-DD (Central) from cluster start, same encoding as `msToDatetimeLocalValue` date half. */
export function anchorDateYmdFromClusterStart(t0: number): string {
  return msToDatetimeLocalValue(t0).slice(0, 10)
}

/** Parse `timeHm` (e.g. from `type="time"`) on anchor calendar day, interpreted as Central wall time. */
export function parseTimeOnAnchorDateToMs(anchorYmd: string, timeHm: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchorYmd)
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeHm)
  if (!dm || !tm) return null
  return appTzWallClockToUtcMs(
    Number(dm[1]),
    Number(dm[2]),
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    tm[3] ? Number(tm[3]) : 0,
  )
}
