/**
 * Permits, what we can see (punch list #307): how far back a count of permits can honestly claim
 * to reach. The pull holds a city's permits from the day its first run read back to, so a line
 * that says "in the last year" on ten weeks of records overstates. Every count on Prospects →
 * Permits takes its words from here: the day the records start, or a year once they reach that
 * far. No React, no Supabase.
 */
import { ymdPlusDays } from './permitResearch'
import { BUILDER_PERMIT_DAYS } from './permitPublic'

export type RecordsReach = {
  /** The first day a count covers: the day the records start, or the window's own first day. Null when the start is not known. */
  sinceYmd: string | null
  /** True when the records go back as far as the window asks. */
  whole: boolean
}

/** What a count over `days` can see, given the day the city's records start. */
export function recordsReach(recordsStartYmd: string | null, todayYmd: string, days: number = BUILDER_PERMIT_DAYS): RecordsReach {
  if (!recordsStartYmd || !/^\d{4}-\d{2}-\d{2}$/.test(recordsStartYmd)) return { sinceYmd: null, whole: false }
  const windowStart = ymdPlusDays(todayYmd, -days)
  return recordsStartYmd <= windowStart ? { sinceYmd: windowStart, whole: true } : { sinceYmd: recordsStartYmd, whole: false }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Aug 26", with the year when it is not today's: "Aug 26, 2025". */
export function reachDay(ymd: string, todayYmd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const day = `${MONTHS[(m ?? 1) - 1] ?? ''} ${d ?? ''}`.trim()
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? day : `${day}, ${y}`
}

/**
 * The words after a count: "since Aug 26" while the records are shorter than the window, "in the
 * last year" once they reach it, null when the start is not known (the line then says "we can see").
 */
export function reachWords(reach: RecordsReach, todayYmd: string, days: number = BUILDER_PERMIT_DAYS): string | null {
  if (!reach.sinceYmd) return null
  if (reach.whole) return days === 365 ? 'in the last year' : `in the last ${days} days`
  return `since ${reachDay(reach.sinceYmd, todayYmd)}`
}

/** The Builders table's count column: "Permits, 12 mo" on a whole year, "Permits since Aug 26" on less. */
export function permitsColumnWords(reach: RecordsReach, todayYmd: string): string {
  if (!reach.sinceYmd) return 'Permits'
  return reach.whole ? 'Permits, 12 mo' : `Permits since ${reachDay(reach.sinceYmd, todayYmd)}`
}

/** The title over a builder's own permits. */
export function theirPermitsTitle(reach: RecordsReach, todayYmd: string): string {
  const words = reachWords(reach, todayYmd)
  return words ? `Their permits ${words}` : 'Their permits'
}

/**
 * The line over the Builders list while the records are shorter than a year: where they start and
 * what every count on the page therefore is. Null once they reach a year, or when the start is not known.
 */
export function recordsStartLine(city: string, reach: RecordsReach, todayYmd: string): string | null {
  if (!reach.sinceYmd || reach.whole) return null
  const owner = /s$/i.test(city) ? `${city}'` : `${city}'s`
  return `${owner} records here start ${reachDay(reach.sinceYmd, todayYmd)}. Every count is what we can see since then.`
}
