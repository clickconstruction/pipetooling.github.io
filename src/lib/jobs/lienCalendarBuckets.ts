import { buildLienCalendar, kindsQueue, lienCalendarRowMatches, type LienCalendarGroup, type LienCalendarJob } from './lienCalendar'
import { formatYmdMonthDay } from './billedExpectedPay'
import { daysBetweenYmd } from './lienPayRunway'
import { LIEN_DESK_LEAD_DAYS } from './lienDesk'

/**
 * The Lien calendar's buckets (v2.4340): Overdue, This month, Next month, Later.
 *
 * Every job is counted once, at its next date — the § 53.056 notice it owes, else
 * its § 53.052 lien date — and lands in the calendar month that date falls in.
 * Overdue holds the jobs whose window closed with nothing sent: nothing is left to
 * file, the money is still owed. A filed lien has nothing left on this clock and
 * waits in Later. Before, the to-do counted a job once per deadline, so October's
 * and November's sums together came to more than the whole board.
 *
 * Pure: the tab draws the pills, the section bars and the counts on the date row
 * from this; each bucket's rows are grouped the way the board groups them
 * (`buildLienCalendar`: by GC, direct, lien gone).
 */

export type LienCalendarBucketKey = 'overdue' | 'this_month' | 'next_month' | 'later'

export const LIEN_CALENDAR_BUCKET_KEYS: ReadonlyArray<LienCalendarBucketKey> = ['overdue', 'this_month', 'next_month', 'later']

const TITLES: Record<LienCalendarBucketKey, string> = { overdue: 'Overdue', this_month: 'This month', next_month: 'Next month', later: 'Later' }

/** A job's next date on the lien clock: the notice it owes, else its lien date; null once the window closed or the lien is filed. */
export type LienNextDate = { ymd: string; what: 'notice' | 'lien' }

export function lienNextDate(job: Pick<LienCalendarJob, 'runway'>): LienNextDate | null {
  const r = job.runway
  if (r.state === 'none' || r.state === 'closed' || r.state === 'filed') return null
  if (r.state === 'notice_due' && r.noticeByYmd) return { ymd: r.noticeByYmd, what: 'notice' }
  return r.lienByYmd ? { ymd: r.lienByYmd, what: 'lien' } : null
}

function monthIndex(ymd: string): number {
  return Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7)) - 1
}

/** The first day of the month `add` months from `ymd`'s. */
function monthStart(ymd: string, add: number): string {
  const i = monthIndex(ymd) + add
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`
}

function monthName(ymd: string): string {
  return new Date(`${ymd.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** Which bucket a job lands in; null for a job with nothing on the lien clock. */
export function lienBucketOf(job: Pick<LienCalendarJob, 'runway'>, todayYmd: string): LienCalendarBucketKey | null {
  const r = job.runway
  if (r.state === 'none') return null
  if (r.state === 'closed') return 'overdue'
  const next = lienNextDate(job)
  if (!next) return 'later'
  if (next.ymd < todayYmd) return 'overdue'
  const ahead = monthIndex(next.ymd) - monthIndex(todayYmd)
  return ahead <= 0 ? 'this_month' : ahead === 1 ? 'next_month' : 'later'
}

export type LienCalendarBucket = {
  key: LienCalendarBucketKey
  /** "Overdue", "This month", "Next month", "Later". */
  title: string
  /** Tightest first. */
  jobs: LienCalendarJob[]
  /** The bucket's jobs grouped as the board groups them: by GC, then direct, then lien gone. */
  groups: LienCalendarGroup[]
  total: number
  /** Jobs whose next date is a notice, and jobs whose next date is the lien. */
  notices: number
  liens: number
  /** Liens on file: nothing left on their clock, so they wait in Later. */
  filed: number
  /** The distinct next dates, oldest first. */
  dates: string[]
  /** The pill's date: "Oct 15", or "Dec 15 +" when Later holds more than one date; '' on Overdue and when empty. */
  dateLabel: string
  /** The section bar's one line of facts. */
  facts: string
  /** The words under the bar when the bucket is picked and holds nothing. */
  empty: string
  /** Draft the N: the bucket's notices the desk already lists (inside its 30-day lead). */
  draft: { ymd: string; jobIds: string[]; label: string } | null
  /** The stretch of the axis the bucket covers, [fromYmd, toYmd); a null end runs to the axis's edge. */
  span: { fromYmd: string | null; toYmd: string | null }
}

export type LienCalendarBoard = {
  /** All four, in order, empty ones too: the pills always show four counts. */
  buckets: LienCalendarBucket[]
  count: number
  total: number
  /** Jobs whose property kind is not set: the toolbar's "N kinds not set" door. */
  kindsUnset: number
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function inDays(todayYmd: string, ymd: string): string {
  const d = daysBetweenYmd(todayYmd, ymd) ?? 0
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`
}

function draftLabel(n: number): string {
  return `Draft the ${n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : n}`
}

/**
 * Under a bar that already says "by Oct 15 · in 14 days", a GC row whose notices are all on that
 * date says only "send 9 notices"; a row with a later notice keeps its own date.
 */
function wordUnderBar(g: LienCalendarGroup, ymd: string | null): LienCalendarGroup {
  if (!ymd || g.kind !== 'gc') return g
  const owed = g.jobs.filter((j) => j.runway.state === 'notice_due')
  if (!owed.length || owed.some((j) => j.runway.noticeByYmd !== ymd)) return g
  return { ...g, word: owed.length === 1 ? 'send the notice' : `send ${owed.length} notices` }
}

function bucketOf(key: LienCalendarBucketKey, jobs: LienCalendarJob[], todayYmd: string): LienCalendarBucket {
  const cal = buildLienCalendar(jobs, '')
  const sorted = cal.jobs
  const nexts = sorted.map((j) => lienNextDate(j))
  const dates = [...new Set(nexts.filter((n): n is LienNextDate => n != null).map((n) => n.ymd))].sort()
  const barDate = key !== 'overdue' && dates.length === 1 ? dates[0]! : null
  const noticeJobs = sorted.filter((_, i) => nexts[i]?.what === 'notice')
  const liens = nexts.filter((n) => n?.what === 'lien').length
  const filed = sorted.filter((j) => j.runway.state === 'filed').length
  const gcs = new Map<string, string>()
  for (const j of noticeJobs) if (j.gcId) gcs.set(j.gcId, j.gcName?.trim() || 'the GC')

  const facts: string[] = []
  if (key === 'overdue') {
    if (sorted.length) facts.push(plural(sorted.length, 'job', 'jobs'), 'nothing left to file', 'money still owed')
  } else {
    const first = dates[0]
    const last = dates[dates.length - 1]
    if (first && dates.length === 1) facts.push(`by ${formatYmdMonthDay(first)}`, inDays(todayYmd, first))
    else if (first && last) facts.push(key === 'later' ? `${formatYmdMonthDay(first)} and after` : `${formatYmdMonthDay(first)} to ${formatYmdMonthDay(last)}`)
    if (noticeJobs.length) {
      const to = gcs.size === 1 ? ` to ${[...gcs.values()][0]}` : gcs.size > 1 ? ` across ${gcs.size} GCs` : ''
      facts.push(`${plural(noticeJobs.length, 'notice', 'notices')}${to}`)
    }
    if (liens) facts.push(`${plural(liens, 'lien', 'liens')} to file`)
    if (filed) facts.push(`${plural(filed, 'lien', 'liens')} filed`)
  }

  const next = monthStart(todayYmd, 1)
  const empty =
    key === 'overdue'
      ? 'No lien window has closed on a billed job.'
      : key === 'this_month'
        ? `Nothing else falls due in ${monthName(todayYmd)}.`
        : key === 'next_month'
          ? `Nothing falls due in ${monthName(next)}.`
          : `Nothing falls due after ${monthName(next)}.`

  // The desk's notice list reaches 30 days ahead: a door to notices further out would open on an empty list.
  const draftable = noticeJobs.filter((j) => j.runway.daysToNotice != null && j.runway.daysToNotice <= LIEN_DESK_LEAD_DAYS)
  const draftYmd = draftable.map((j) => j.runway.noticeByYmd).sort()[0]
  const draft = key !== 'overdue' && draftable.length && draftYmd ? { ymd: draftYmd, jobIds: draftable.map((j) => j.jobId), label: draftLabel(draftable.length) } : null

  const span =
    key === 'overdue'
      ? { fromYmd: null, toYmd: todayYmd }
      : key === 'this_month'
        ? { fromYmd: todayYmd, toYmd: next }
        : key === 'next_month'
          ? { fromYmd: next, toYmd: monthStart(todayYmd, 2) }
          : { fromYmd: monthStart(todayYmd, 2), toYmd: null }

  return {
    key,
    title: TITLES[key],
    jobs: sorted,
    groups: cal.groups.map((g) => wordUnderBar(g, barDate)),
    total: sorted.reduce((s, j) => s + j.openBalance, 0),
    notices: noticeJobs.length,
    liens,
    filed,
    dates,
    dateLabel: key === 'overdue' || !dates[0] ? '' : key === 'later' && dates.length > 1 ? `${formatYmdMonthDay(dates[0])} +` : formatYmdMonthDay(dates[0]),
    facts: facts.join(' · '),
    empty,
    draft,
    span,
  }
}

export function buildLienCalendarBoard(rows: ReadonlyArray<LienCalendarJob>, query: string, todayYmd: string): LienCalendarBoard {
  const split: Record<LienCalendarBucketKey, LienCalendarJob[]> = { overdue: [], this_month: [], next_month: [], later: [] }
  const live: LienCalendarJob[] = []
  for (const j of rows) {
    if (!lienCalendarRowMatches(j, query)) continue
    const key = lienBucketOf(j, todayYmd)
    if (!key) continue
    split[key].push(j)
    live.push(j)
  }
  const buckets = LIEN_CALENDAR_BUCKET_KEYS.map((key) => bucketOf(key, split[key], todayYmd))
  return {
    buckets,
    count: live.length,
    total: live.reduce((s, j) => s + j.openBalance, 0),
    kindsUnset: kindsQueue(live).length,
  }
}

/** What the date row counts on each 15th: the jobs whose next date it is — each job once. */
export type LienNextDateCount = { ymd: string; jobs: number; notices: number; liens: number; total: number }

export function lienNextDateCounts(buckets: ReadonlyArray<Pick<LienCalendarBucket, 'jobs'>>): Map<string, LienNextDateCount> {
  const out = new Map<string, LienNextDateCount>()
  for (const b of buckets) {
    for (const j of b.jobs) {
      const next = lienNextDate(j)
      if (!next) continue
      const c = out.get(next.ymd) ?? { ymd: next.ymd, jobs: 0, notices: 0, liens: 0, total: 0 }
      c.jobs += 1
      c[next.what === 'notice' ? 'notices' : 'liens'] += 1
      c.total += j.openBalance
      out.set(next.ymd, c)
    }
  }
  return out
}

/**
 * A phone row's one line under its money: the dates ("notice by Oct 15 · lien by Nov 16"), since the
 * bar above already says when and how many. A verdict that changes what to do stays: "file first",
 * and the day a lien died.
 */
export function lienPhoneLine(job: Pick<LienCalendarJob, 'runway'>): string {
  const r = job.runway
  if (r.state === 'closed' || r.state === 'file_first') return r.lines.join(' · ')
  return r.lines[0] ?? r.words
}
