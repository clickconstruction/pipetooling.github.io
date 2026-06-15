/**
 * `<input type="datetime-local">` helpers that interpret the wall clock in the company
 * timezone (`APP_CALENDAR_TZ`, America/Chicago) — NOT the browser's local zone.
 *
 * Clock/contact times are stored as real instants (`timestamptz`). A datetime-local input is a
 * zone-less wall clock, so we must convert through Central explicitly; otherwise a viewer outside
 * Central sees/saves their own local time.
 *
 * Conversion uses the offset method (format the instant in the zone, treat those parts as UTC, take
 * the difference) so it is correct for any time of day and across DST — unlike a bounded offset scan.
 */
import { APP_CALENDAR_TZ } from './dateUtils'

const appTzParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_CALENDAR_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

type WallParts = { y: number; mo: number; d: number; h: number; mi: number; s: number }

function appTzWallPartsAt(utcMs: number): WallParts {
  const parts = appTzParts.formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? NaN)
  let h = get('hour')
  if (h === 24) h = 0 // some engines emit "24" for midnight under h23
  return { y: get('year'), mo: get('month'), d: get('day'), h, mi: get('minute'), s: get('second') }
}

/** Zone offset (wall − UTC, ms) at the given instant: negative for Central (UTC-5/-6). */
function appTzOffsetMsAt(utcMs: number): number {
  const w = appTzWallPartsAt(utcMs)
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - utcMs
}

/** Wall clock (Y/M/D H:M:S) in `APP_CALENDAR_TZ` → UTC ms. Handles any hour and DST. */
export function appTzWallClockToUtcMs(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  const asIfUtc = Date.UTC(year, month1 - 1, day, hour, minute, second)
  const off1 = appTzOffsetMsAt(asIfUtc)
  let utc = asIfUtc - off1
  const off2 = appTzOffsetMsAt(utc)
  if (off2 !== off1) utc = asIfUtc - off2 // refine across a DST boundary
  return utc
}

const z2 = (n: number) => String(n).padStart(2, '0')

/** Instant ISO → `YYYY-MM-DDTHH:mm` wall clock in `APP_CALENDAR_TZ`. Empty string if invalid/blank. */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const w = appTzWallPartsAt(ms)
  return `${w.y}-${z2(w.mo)}-${z2(w.d)}T${z2(w.h)}:${z2(w.mi)}`
}

/** `YYYY-MM-DDTHH:mm` wall clock in `APP_CALENDAR_TZ` → instant ISO. Null if blank/invalid. */
export function fromDatetimeLocal(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim())
  if (!m) return null
  const ms = appTzWallClockToUtcMs(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]))
  return new Date(ms).toISOString()
}
