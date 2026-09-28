/**
 * The Workflow page's small formatters: the dates, day counts and money it
 * prints on a stage card, in the action ledger and in the line-item tables.
 */

import { dueState, type DueDescription } from '../ageState'
import { APP_CALENDAR_TZ, ymdFromDateLike } from '../../utils/dateUtils'

/** `Mon, 9/7/26, 3:05 PM` in the app's time zone; `unknown` for no value. */
export function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ })
  const dateTime = date.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: APP_CALENDAR_TZ })
  return `${weekday}, ${dateTime}`
}

/** `9/7/26` in the app's time zone; an em dash for no value. */
export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/**
 * Whole days a step has been open: started, not ended, counted to now.
 * Null when it has not started, has ended, or starts in the future.
 */
export function daysOpen(startedAt: string | null, endedAt: string | null, now: Date = new Date()): number | null {
  if (!startedAt || endedAt) return null
  const start = new Date(startedAt)
  const end = now
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
}

/** Whole days between a step's start and end; null when either is missing or the end is first. */
export function daysBetween(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
}

/**
 * Dollars and cents, a negative in accounting parentheses: `$1,234.56`,
 * `($1,234.56)`. The Forecast lib's `formatAmount` prints a minus sign
 * instead — the two are not interchangeable.
 */
export function formatAmount(amount: number | null | undefined): string {
  const value = amount || 0
  const absValue = Math.abs(value)
  // Format with commas for thousands
  const formatted = absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value < 0) {
    return `($${formatted})`
  }
  return `$${formatted}`
}

/**
 * An expected date as `9/7/26`, read at noon so the day never shifts with the
 * viewer's time zone; an em dash for a blank or unreadable value.
 */
export function formatScheduledDateShort(value: string | null | undefined): string {
  const ymd = ymdFromDateLike(value)
  if (!ymd) return '—'
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
}

/**
 * Planned window vs today for a step still in flight (journey-map #40): red
 * "N days late" once the expected end has passed, amber "due today" / "start N
 * days past" for a pending step whose start slipped. Finished steps never age.
 */
export function expectedDueState(
  s: { status: string; scheduled_start_date?: string | null; scheduled_end_date?: string | null },
  todayYmd: string = new Date().toLocaleDateString('en-CA', { timeZone: APP_CALENDAR_TZ }),
): DueDescription | null {
  if (s.status !== 'pending' && s.status !== 'in_progress') return null
  return dueState(ymdFromDateLike(s.scheduled_end_date), todayYmd, {
    startYmd: ymdFromDateLike(s.scheduled_start_date),
    started: s.status === 'in_progress',
  })
}
