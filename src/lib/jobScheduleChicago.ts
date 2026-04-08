/** America/Chicago wall clock for job schedule work_date and time_start/time_end. */

import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/** Re-export of company IANA zone (CST/CDT via DST). Same as `APP_CALENDAR_TZ`. */
export const JOB_SCHEDULE_TIMEZONE = APP_CALENDAR_TZ

/** YYYY-MM-DD in Chicago for "now". */
export function scheduleTodayDateKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JOB_SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

export function scheduleFormatWeekdayLong(dateKey: string): string {
  const d = scheduleParseDateKeyLocal(dateKey)
  if (!d) return dateKey
  return new Intl.DateTimeFormat('en-US', {
    timeZone: JOB_SCHEDULE_TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

/** Long weekday name only (America/Chicago). Invalid keys fall back to raw `dateKey`. */
export function scheduleFormatWeekdayOnly(dateKey: string): string {
  const d = scheduleParseDateKeyLocal(dateKey)
  if (!d) return dateKey
  return new Intl.DateTimeFormat('en-US', {
    timeZone: JOB_SCHEDULE_TIMEZONE,
    weekday: 'long',
  }).format(d)
}

/** Month, day, year without weekday (America/Chicago). Invalid keys fall back to raw `dateKey`. */
export function scheduleFormatDateLongNoWeekday(dateKey: string): string {
  const d = scheduleParseDateKeyLocal(dateKey)
  if (!d) return dateKey
  return new Intl.DateTimeFormat('en-US', {
    timeZone: JOB_SCHEDULE_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

/** Parse YYYY-MM-DD as a UTC noon anchor for formatting (avoids previous-day shift). */
export function scheduleParseDateKeyLocal(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim())
  if (!m) return null
  const y = Number(m[1])
  const mon = Number(m[2]) - 1
  const day = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(y, mon, day, 12, 0, 0))
}

/** Add calendar days in Chicago (interpret dateKey as Chicago civil date). */
export function scheduleDateKeyAddDays(dateKey: string, deltaDays: number): string | null {
  const d = scheduleParseDateKeyLocal(dateKey)
  if (!d || !Number.isFinite(deltaDays)) return null
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return scheduleDateKeyFromUtcNoon(d)
}

function scheduleDateKeyFromUtcNoon(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JOB_SCHEDULE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

/**
 * PostgreSQL `time` / time-without-time-zone string "HH:MM:SS" or "HH:MM".
 * Returns compact display e.g. "9:30 AM".
 * Uses a UTC Date anchor + `timeZone: 'UTC'` so digits match stored wall time regardless of browser TZ (Chicago semantics live in data/business rules, not here).
 */
export function scheduleFormatTimeHm(pgTime: string): string {
  const parts = pgTime.trim().split(':')
  const h = Number(parts[0] ?? '0')
  const min = Number(parts[1] ?? '0')
  let sec = 0
  if (parts[2] != null) {
    const secPart = String(parts[2]).split('.')[0] ?? '0'
    const n = Number(secPart)
    sec = Number.isFinite(n) ? n : 0
  }
  if (!Number.isFinite(h) || !Number.isFinite(min)) return pgTime
  const d = new Date(Date.UTC(2000, 0, 1, h, min, sec))
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function scheduleFormatWindow(timeStart: string, timeEnd: string): string {
  return `${scheduleFormatTimeHm(timeStart)}–${scheduleFormatTimeHm(timeEnd)}`
}
