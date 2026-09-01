/**
 * Pure helper for the Job Mode day rail (v2.2558): collapses today's
 * `job_schedule_blocks` into one row per job, in time order, with a status the
 * card can render at a glance:
 *
 *  - `done`       — the job has a closed clock session today
 *  - `current`    — the open clock session is on this job
 *  - `still-open` — unvisited, but the tech is already clocked in past it
 *                   (skipped, or clocked out mid-day) — still owed a visit
 *  - `upcoming`   — unvisited, later than the current focus
 *
 * A job with several windows (morning + afternoon) gets a single row keyed by
 * its first window. Decoupled from Supabase shapes; see jobModePickCurrentNext
 * for the block type.
 */

import {
  sortJobModeScheduleBlocks,
  type JobModeScheduleBlock,
} from './jobModePickCurrentNext'

export type JobModeDayRailStatus = 'done' | 'current' | 'still-open' | 'upcoming'

export type JobModeDayRailRow = {
  /** The job's first schedule window today (display fields live here). */
  block: JobModeScheduleBlock
  status: JobModeDayRailStatus
}

export type JobModeDayRail = {
  rows: JobModeDayRailRow[]
  /** Jobs with a closed session today (the rail's "N of M done"). */
  doneCount: number
  /** Distinct jobs on today's schedule. */
  totalCount: number
}

export function buildJobModeDayRail(opts: {
  blocks: readonly JobModeScheduleBlock[]
  /** Job the open clock session is on (null when not clocked in / on a bid). */
  currentJobId: string | null
  visitedJobIds: ReadonlySet<string>
}): JobModeDayRail {
  const ordered = sortJobModeScheduleBlocks(opts.blocks)
  const firstBlockByJob: JobModeScheduleBlock[] = []
  const seen = new Set<string>()
  for (const b of ordered) {
    if (seen.has(b.job_id)) continue
    seen.add(b.job_id)
    firstBlockByJob.push(b)
  }

  const currentIndex = opts.currentJobId
    ? firstBlockByJob.findIndex((b) => b.job_id === opts.currentJobId)
    : -1
  // With no current anchor (not clocked in), a visited job is done and an
  // unvisited one behind a *visited* job is still-open — the tech moved past it.
  const lastVisitedIndex = (() => {
    let last = -1
    firstBlockByJob.forEach((b, i) => {
      if (opts.visitedJobIds.has(b.job_id)) last = i
    })
    return last
  })()
  const anchorIndex = currentIndex >= 0 ? currentIndex : lastVisitedIndex

  let doneCount = 0
  const rows: JobModeDayRailRow[] = firstBlockByJob.map((b, i) => {
    if (b.job_id === opts.currentJobId) return { block: b, status: 'current' }
    if (opts.visitedJobIds.has(b.job_id)) {
      doneCount++
      return { block: b, status: 'done' }
    }
    if (i < anchorIndex) return { block: b, status: 'still-open' }
    return { block: b, status: 'upcoming' }
  })

  return { rows, doneCount, totalCount: firstBlockByJob.length }
}
