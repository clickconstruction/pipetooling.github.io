import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../utils/dateUtils'

export type UserReviewYmdParts = {
  year: string
  month: string
  mm: string
  dd: string
  yy: string
}

/** Parse a YYYY-MM-DD into America/Chicago-formatted display components. Null if invalid. */
export function formatYmdParts(workDateYmd: string): UserReviewYmdParts | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).formatToParts(referenceDateForWorkDateYmd(workDateYmd))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')
  if (!year || !month || !day) return null
  return { year, month, mm: month, dd: day, yy: year.slice(-2) }
}

/**
 * Compact range label for the User Review header:
 *   same month/year         -> "05/17–23"
 *   cross-month, same year  -> "05/31–06/06"
 *   cross-year (rare)       -> "12/29/25–01/04/26"
 */
export function formatRangeCompact(startYmd: string, endYmd: string): string {
  if (!startYmd || !endYmd) return ''
  const startParts = formatYmdParts(startYmd)
  const endParts = formatYmdParts(endYmd)
  if (!startParts || !endParts) return `${startYmd} – ${endYmd}`
  if (startParts.year !== endParts.year) {
    return `${startParts.mm}/${startParts.dd}/${startParts.yy}–${endParts.mm}/${endParts.dd}/${endParts.yy}`
  }
  if (startParts.month !== endParts.month) {
    return `${startParts.mm}/${startParts.dd}–${endParts.mm}/${endParts.dd}`
  }
  return `${startParts.mm}/${startParts.dd}–${endParts.dd}`
}
