/**
 * Pure helper for the Dashboard Job Mode card.
 *
 * Given today's `job_schedule_blocks` for a user (jobs only — no bids on the
 * schedule) and the user's open clock session (if any), pick:
 *  - which scheduled block represents the *current* focus (when the open
 *    session matches a block on today's schedule)
 *  - which scheduled block is the *next* one to advance into when the user
 *    taps "Next Job"
 *
 * This is decoupled from Supabase shapes so it stays trivially testable.
 * Block ordering is by `time_start` ascending; ties broken by `time_end` then
 * `id` for stability.
 */

export type JobModeScheduleBlock = {
  id: string
  job_id: string
  time_start: string
  time_end: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  service_type_id: string | null
}

export type JobModeOpenSessionInput = {
  jobLedgerId: string | null
  bidId: string | null
} | null

export type JobModeState =
  /** Not clocked in, no schedule today. */
  | 'no-clock-no-schedule'
  /** Not clocked in, has at least one block today. Next = first block. */
  | 'not-clocked-in-with-schedule'
  /** Clocked in on a job that matches today's schedule, with another job after. */
  | 'on-scheduled-job-not-last'
  /** Clocked in on a job that matches today's schedule, no different job after. */
  | 'on-scheduled-job-last'
  /** Clocked in on a job, but that job isn't on today's schedule. */
  | 'on-off-schedule-job'
  /** Clocked in on a bid (schedule blocks are jobs only). */
  | 'on-bid'

export type JobModeCurrentNext = {
  state: JobModeState
  currentBlock: JobModeScheduleBlock | null
  nextBlock: JobModeScheduleBlock | null
}

function compareBlocks(a: JobModeScheduleBlock, b: JobModeScheduleBlock): number {
  if (a.time_start !== b.time_start) return a.time_start < b.time_start ? -1 : 1
  if (a.time_end !== b.time_end) return a.time_end < b.time_end ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Stable copy ordered by start time. */
export function sortJobModeScheduleBlocks(
  blocks: readonly JobModeScheduleBlock[],
): JobModeScheduleBlock[] {
  return [...blocks].sort(compareBlocks)
}

export function pickCurrentAndNextScheduleBlock(opts: {
  blocks: readonly JobModeScheduleBlock[]
  openSession: JobModeOpenSessionInput
  /**
   * Ledger ids of jobs already visited today (a closed clock session on that
   * job). Lets "Next Job" wrap back to a skipped job instead of walking off the
   * end of the day (v2.2558). Omitted = nothing visited yet.
   */
  visitedJobIds?: ReadonlySet<string>
}): JobModeCurrentNext {
  const ordered = sortJobModeScheduleBlocks(opts.blocks)
  const first = ordered[0] ?? null
  const session = opts.openSession ?? null
  const visited = opts.visitedJobIds ?? new Set<string>()
  // First block whose job hasn't been visited yet — the right restart/entry
  // point after a mid-day clock-out or an off-schedule detour.
  const firstUnvisited = ordered.find((b) => !visited.has(b.job_id)) ?? first

  if (!session) {
    if (!first) {
      return { state: 'no-clock-no-schedule', currentBlock: null, nextBlock: null }
    }
    return { state: 'not-clocked-in-with-schedule', currentBlock: null, nextBlock: firstUnvisited }
  }

  if (session.bidId) {
    return { state: 'on-bid', currentBlock: null, nextBlock: firstUnvisited }
  }

  const currentJobId = session.jobLedgerId
  if (!currentJobId) {
    return { state: 'on-off-schedule-job', currentBlock: null, nextBlock: firstUnvisited }
  }

  const currentBlockIndex = ordered.findIndex((b) => b.job_id === currentJobId)
  const currentBlock = currentBlockIndex >= 0 ? ordered[currentBlockIndex] ?? null : null
  if (!currentBlock) {
    return { state: 'on-off-schedule-job', currentBlock: null, nextBlock: firstUnvisited }
  }
  // "Next Job" means a different, still-unvisited job. Prefer rolling forward
  // in time order; when nothing unvisited remains ahead, wrap back to the
  // earliest skipped job. Same-job continuation windows never count.
  const isNextCandidate = (b: JobModeScheduleBlock) =>
    b.job_id !== currentJobId && !visited.has(b.job_id)
  const nextBlock =
    ordered.slice(currentBlockIndex + 1).find(isNextCandidate) ??
    ordered.find(isNextCandidate) ??
    null
  if (!nextBlock) {
    return { state: 'on-scheduled-job-last', currentBlock, nextBlock: null }
  }
  return { state: 'on-scheduled-job-not-last', currentBlock, nextBlock }
}
