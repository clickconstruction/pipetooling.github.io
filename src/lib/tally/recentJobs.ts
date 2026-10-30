/**
 * Recent on the Choose job sheet (punch list #216): the jobs the viewer was on, newest first, each
 * job once, three on show and ten at most, every row saying when and how it knows. A mark is one
 * clock-in or one purchase sorted to the job; `fetchRecentJobMarks` reads them. Pure.
 */

export type RecentJobSource = 'clock' | 'purchase'

export type RecentJobMark = {
  jobId: string
  /** The company-calendar day, YYYY-MM-DD. */
  ymd: string
  /** The instant, ISO, for the order; the day when there is none. */
  at: string
  source: RecentJobSource
}

/** On show before Show N more. */
export const RECENT_JOBS_SHOWN = 3
/** The ceiling: past it the search is the way. */
export const RECENT_JOBS_MAX = 10

/** Newest first, each job once at its newest mark, at most `max`. */
export function orderRecentJobs(marks: readonly RecentJobMark[], max = RECENT_JOBS_MAX): RecentJobMark[] {
  const sorted = marks
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (a.m.at < b.m.at ? 1 : a.m.at > b.m.at ? -1 : a.i - b.i))
    .map((x) => x.m)
  const seen = new Set<string>()
  const out: RecentJobMark[] = []
  for (const m of sorted) {
    if (!m.jobId || seen.has(m.jobId)) continue
    seen.add(m.jobId)
    out.push(m)
    if (out.length >= max) break
  }
  return out
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!hit) return null
  return { y: Number(hit[1]), m: Number(hit[2]), d: Number(hit[3]) }
}

/** "today", "yesterday", "Mon Oct 27", or "Oct 27, 2025" in another year. '' for a day it cannot read. */
export function recentDayWords(ymd: string, todayYmd: string): string {
  const day = parseYmd(ymd)
  if (!day) return ''
  const today = parseYmd(todayYmd)
  const date = new Date(Date.UTC(day.y, day.m - 1, day.d))
  if (today) {
    const gap = Math.round((Date.UTC(today.y, today.m - 1, today.d) - date.getTime()) / 86400000)
    if (gap === 0) return 'today'
    if (gap === 1) return 'yesterday'
    if (today.y !== day.y) return `${MONTHS[day.m - 1]} ${day.d}, ${day.y}`
  }
  return `${WEEKDAYS[date.getUTCDay()]} ${MONTHS[day.m - 1]} ${day.d}`
}

/** The row's line: "Clocked in today", "Purchase sorted Oct 24". */
export function recentWhenWords(mark: Pick<RecentJobMark, 'ymd' | 'source'>, todayYmd: string): string {
  const day = recentDayWords(mark.ymd, todayYmd)
  const verb = mark.source === 'clock' ? 'Clocked in' : 'Purchase sorted'
  return day ? `${verb} ${day}` : verb
}

/** Under the Recent heading: "jobs you were on" when every mark is a clock-in, nothing when purchases name them. */
export function recentHeadingSub(marks: readonly Pick<RecentJobMark, 'source'>[]): string {
  return marks.length > 0 && marks.every((m) => m.source === 'clock') ? 'jobs you were on' : ''
}

/** "Show 7 more" for what the fold hides, null when nothing is hidden. */
export function showMoreLabel(total: number, shown: number): string | null {
  const hidden = total - shown
  return hidden > 0 ? `Show ${hidden} more` : null
}
