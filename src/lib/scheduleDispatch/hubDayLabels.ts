/**
 * Day-column labels for the Schedule Dispatch hub and the job-week grid.
 *
 * A work date is a civil `YYYY-MM-DD`; the label is that day in the company
 * calendar zone whatever zone the device is in, because the date is read at
 * noon UTC (`referenceDateForWorkDateYmd`).
 */
import { APP_CALENDAR_TZ, formatMmDdSlash, referenceDateForWorkDateYmd } from '../../utils/dateUtils'

/** `Mon` … `Sun` for a work date. */
export function shortDowLabel(dateKey: string): string {
  const d = referenceDateForWorkDateYmd(dateKey)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ }).format(d)
}

/** One-line day header: `Mon (09/28)`. */
export function hubDayColumnHeaderLabel(dateKey: string): string {
  return `${shortDowLabel(dateKey)} (${formatMmDdSlash(dateKey)})`
}
