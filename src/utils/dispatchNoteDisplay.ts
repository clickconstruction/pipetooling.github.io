/** Display timestamps for dispatch thread notes in America/Chicago. */

import { APP_CALENDAR_TZ } from './dateUtils'

/** YYYY-MM-DD in Chicago for a given instant */
function calendarDayInChicago(isoUtc: string, now: Date = new Date()): { note: string; today: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // formatToParts, not format: small-ICU runtimes render en-CA as MM/DD/YYYY,
  // which would silently parse to NaN downstream.
  const ymd = (d: Date): string => {
    const parts = dtf.formatToParts(d)
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  }
  return {
    note: ymd(new Date(isoUtc)),
    today: ymd(now),
  }
}

function parseYmd(ymd: string): number {
  const parts = ymd.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return Date.UTC(y, m - 1, d) / 86400000
}

/**
 * Calendar-day difference in Chicago between note time and reference "now" (0 = same Chicago calendar day).
 */
export function dispatchNoteDaysAgoInChicago(isoUtc: string, now: Date = new Date()): number {
  const { note, today } = calendarDayInChicago(isoUtc, now)
  return Math.max(0, Math.round(parseYmd(today) - parseYmd(note)))
}

export function formatDispatchNoteDaysAgoLabel(isoUtc: string, now: Date = new Date()): string {
  const n = dispatchNoteDaysAgoInChicago(isoUtc, now)
  if (n === 0) return 'Today'
  if (n === 1) return '1 day ago'
  return `${n} days ago`
}

/** Compact age: "today", "1d", "61d" — for tight scan lines. */
export function formatDispatchNoteDaysAgoShort(isoUtc: string, now: Date = new Date()): string {
  const n = dispatchNoteDaysAgoInChicago(isoUtc, now)
  return n === 0 ? 'today' : `${n}d`
}

/** Compact age phrase: "today", "1d ago", "61d ago" — for tight scan lines. */
export function formatDispatchNoteDaysAgoShortPhrase(isoUtc: string, now: Date = new Date()): string {
  const n = dispatchNoteDaysAgoInChicago(isoUtc, now)
  return n === 0 ? 'today' : `${n}d ago`
}

/** e.g. "Monday, 3:45 PM" in America/Chicago */
export function formatDispatchNoteWeekdayTimeChicago(isoUtc: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoUtc))
}

/** e.g. "3:45 PM" in America/Chicago (time only). */
export function formatDispatchNoteTimeChicago(isoUtc: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoUtc))
}

export type DispatchNoteDisplayMeta = {
  weekdayTimeChicago: string
  daysAgoLabel: string
}

export function getDispatchNoteDisplayMeta(isoUtc: string, now: Date = new Date()): DispatchNoteDisplayMeta {
  return {
    weekdayTimeChicago: formatDispatchNoteWeekdayTimeChicago(isoUtc),
    daysAgoLabel: formatDispatchNoteDaysAgoLabel(isoUtc, now),
  }
}
