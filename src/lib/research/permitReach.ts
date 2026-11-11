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

/** The latest of each feed's earliest clean read: the day all of a city's feeds reach. */
export function recordsStartOf(runs: ReadonlyArray<{ source: string; since: string | null }>): string | null {
  const earliest = new Map<string, string>()
  for (const r of runs) {
    if (!r.since) continue
    const held = earliest.get(r.source)
    if (!held || r.since < held) earliest.set(r.source, r.since)
  }
  let start: string | null = null
  for (const day of earliest.values()) if (start == null || day > start) start = day
  return start
}

/** How far back the records are worth reading: the first day of the city's current datastore. */
export const HISTORY_GOAL_YMD = '2025-01-01'
/** The cities whose feed can be read up to a day: the ones `permit-pull` reads back as history. */
export const HISTORY_CITIES: readonly string[] = ['San Antonio']
/** How much one read back takes: about three months, a run the pull finishes inside its time budget. */
export const HISTORY_STEP_DAYS = 92

export type HistoryAsk = {
  /** The window one press reads: from `since` up to, not including, `until`. */
  since: string
  until: string
  /** "San Antonio's records here start Aug 26." */
  words: string
  /** "Read back to May 26" */
  press: string
  /** "Reading May 26 to Aug 26…" */
  busy: string
}

/**
 * The next read back as history (punch list #307), or null when the records already reach the
 * goal or their start is not known. One press reads one step further back, so the day the
 * records start moves a step at a time and every count says the new day.
 */
export function historyAsk(city: string, recordsStartYmd: string | null, todayYmd: string, cities: readonly string[] = HISTORY_CITIES): HistoryAsk | null {
  if (!cities.includes(city)) return null
  if (!recordsStartYmd || !/^\d{4}-\d{2}-\d{2}$/.test(recordsStartYmd) || recordsStartYmd <= HISTORY_GOAL_YMD) return null
  const step = ymdPlusDays(recordsStartYmd, -HISTORY_STEP_DAYS)
  const since = step < HISTORY_GOAL_YMD ? HISTORY_GOAL_YMD : step
  const owner = /s$/i.test(city) ? `${city}'` : `${city}'s`
  return {
    since,
    until: recordsStartYmd,
    words: `${owner} records here start ${reachDay(recordsStartYmd, todayYmd)}.`,
    press: `Read back to ${reachDay(since, todayYmd)}`,
    busy: `Reading ${reachDay(since, todayYmd)} to ${reachDay(recordsStartYmd, todayYmd)}…`,
  }
}

/** "6,412 permits read back to May 26." after a read back. */
export function historyDoneWords(kept: number, sinceYmd: string, todayYmd: string): string {
  return `${kept.toLocaleString('en-US')} permit${kept === 1 ? '' : 's'} read back to ${reachDay(sinceYmd, todayYmd)}.`
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
