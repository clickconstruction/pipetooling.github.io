import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesUpcomingAppointment } from '../stagesUpcomingSchedule'
import { scheduleDateKeyAddDays } from '../jobScheduleChicago'
import { deriveStagesWhen, stripWeekStartYmd, type StagesWhen } from './stagesScheduleStrip'

/**
 * The Working header's schedule pills and the next-first sort (v2.3788):
 * every job on the board is one of four kinds, read from the same "when"
 * state the two-week strip draws — nothing new is fetched.
 *
 *   thisWeek     a block from today through this week's Sunday
 *   later        the next block is after Sunday
 *   unscheduled  nothing booked from today on, job under 100 %
 *   done         nothing booked, 100 % (or a status past Working)
 */

export type StagesWhenKind = 'thisWeek' | 'later' | 'unscheduled' | 'done'

/** The pill the office picks; `all` is the header's default. */
export type StagesWhenPill = 'all' | 'unscheduled' | 'thisWeek' | 'later'

export const STAGES_WHEN_PILLS: readonly StagesWhenPill[] = ['all', 'unscheduled', 'thisWeek', 'later']

export const STAGES_WHEN_PILL_LABELS: Record<StagesWhenPill, string> = {
  all: 'All',
  unscheduled: 'Not scheduled',
  thisWeek: 'This week',
  later: 'Later',
}

/** Sunday of the week holding `todayYmd` — the last day "this week" reaches. */
export function stripWeekEndYmd(todayYmd: string): string | null {
  const start = stripWeekStartYmd(todayYmd)
  return start ? scheduleDateKeyAddDays(start, 6) : null
}

export function classifyStagesWhen(when: StagesWhen, todayYmd: string): StagesWhenKind {
  if (when.kind === 'done') return 'done'
  if (when.kind === 'unscheduled') return 'unscheduled'
  const sunday = stripWeekEndYmd(todayYmd)
  return sunday && when.nextYmd <= sunday ? 'thisWeek' : 'later'
}

export type StagesWhenByJobId = ReadonlyMap<string, { when: StagesWhen; kind: StagesWhenKind }>

/** One pass over a section's jobs — the strip's own derivation, then the kind. */
export function stagesWhenForJobs(
  jobs: readonly JobWithDetails[],
  upcomingByJobId: Record<string, StagesUpcomingAppointment>,
  todayYmd: string,
): StagesWhenByJobId {
  const out = new Map<string, { when: StagesWhen; kind: StagesWhenKind }>()
  for (const job of jobs) {
    const when = deriveStagesWhen({
      upcoming: upcomingByJobId[job.id] ?? null,
      lastWorkDate: job.last_work_date,
      lastScheduleWorkDate: job.last_schedule_work_date ?? null,
      pctComplete: job.pct_complete,
      status: job.status,
      todayYmd,
    })
    out.set(job.id, { when, kind: classifyStagesWhen(when, todayYmd) })
  }
  return out
}

export type StagesWhenCounts = Record<StagesWhenPill, number> & { done: number }

/** Pill counts: `all` is every job; `unscheduled` never counts a finished job. */
export function countStagesWhenPills(jobs: readonly JobWithDetails[], byJob: StagesWhenByJobId): StagesWhenCounts {
  const c: StagesWhenCounts = { all: jobs.length, unscheduled: 0, thisWeek: 0, later: 0, done: 0 }
  for (const job of jobs) {
    const kind = byJob.get(job.id)?.kind
    if (kind === 'unscheduled') c.unscheduled++
    else if (kind === 'thisWeek') c.thisWeek++
    else if (kind === 'later') c.later++
    else if (kind === 'done') c.done++
  }
  return c
}

export function stagesWhenPillMatches(pill: StagesWhenPill, kind: StagesWhenKind | undefined): boolean {
  if (pill === 'all') return true
  return kind === pill
}

export function filterJobsByStagesWhenPill(
  jobs: readonly JobWithDetails[],
  pill: StagesWhenPill,
  byJob: StagesWhenByJobId,
): JobWithDetails[] {
  if (pill === 'all') return [...jobs]
  return jobs.filter((j) => stagesWhenPillMatches(pill, byJob.get(j.id)?.kind))
}

/**
 * The next-first order, as one string key per job so the board's sort can
 * stay a plain comparator: scheduled jobs by their first booked day and its
 * start time; then the unbooked, oldest last-worked first (never worked
 * first of all); finished jobs with nothing booked last. Ties fall through
 * to the board's classic order.
 */
export function stagesNextFirstKey(job: JobWithDetails, up: StagesUpcomingAppointment | null | undefined): string {
  if (up) return `0 ${up.ymd} ${up.timeStart}`
  const status = (job.status ?? 'working').trim()
  const pct = typeof job.pct_complete === 'number' ? job.pct_complete : null
  const done = (pct != null && pct >= 100) || (status !== 'waiting' && status !== 'working')
  const last = (job.last_work_date ?? '').slice(0, 10) || '0000-00-00'
  return done ? `2 ${last}` : `1 ${last}`
}

/** A comparator for `buildJobsStagesBoardLists` when the sort mode is `next`. */
export function makeStagesNextFirstComparator(
  upcomingByJobId: Record<string, StagesUpcomingAppointment>,
  tieBreak: (a: JobWithDetails, b: JobWithDetails) => number,
): (a: JobWithDetails, b: JobWithDetails) => number {
  return (a, b) => {
    const ka = stagesNextFirstKey(a, upcomingByJobId[a.id])
    const kb = stagesNextFirstKey(b, upcomingByJobId[b.id])
    if (ka < kb) return -1
    if (ka > kb) return 1
    return tieBreak(a, b)
  }
}
