import type { JobModeScheduleBlock } from '../jobModePickCurrentNext'
import { buildKeptReadKey } from '../keptRead'

/**
 * Job Mode's kept day (punch list #183 PR 3): what the Dashboard's Job Mode card keeps on the
 * device through `useKeptRead`, so a slow morning draws the day rail as read at 7:52 AM under the
 * stamp *Your day as read at 7:52 AM · reading again…* instead of *Loading Job Mode…*, with every
 * press that acts on the day held until the live read lands.
 *
 * The rows are the rail's facts: each of today's schedule blocks with its job's display fields,
 * whether a closed clock session visited the job today, and whether the open session was on it.
 * The open session's id and its travel stamps are never kept: the clock reads live, since Clock
 * In, On my way and Clock out act on it (the card's rule, *What it must never do*). The key
 * carries the day, so yesterday's rail is never shown as today's.
 */

export const JOB_MODE_KEPT_PAGE = 'job-mode'

export const JOB_MODE_KEPT_SCOPES: readonly string[] = ['today']

/** `u1:job-mode:2026-10-29`. */
export function jobModeKeptKey(userId: string, dayYmd: string): string {
  return buildKeptReadKey(userId, JOB_MODE_KEPT_PAGE, dayYmd)
}

export type JobModeKeptRow = {
  block: JobModeScheduleBlock
  /** The open session was on this job when the day was read. */
  current: boolean
  /** A closed session visited this job that day. */
  visited: boolean
}

export type JobModeKeptDay = {
  blocks: JobModeScheduleBlock[]
  /** The job the open session was on, or null (not clocked in, on a bid, or on a job off the schedule). */
  currentJobId: string | null
  visitedJobIds: Set<string>
}

/** The rows to keep once the day's reads landed: one per block, flagged from the live session and the day's closed sessions. */
export function buildJobModeKeptRows(args: {
  blocks: readonly JobModeScheduleBlock[]
  currentJobId: string | null
  visitedJobIds: ReadonlySet<string>
}): JobModeKeptRow[] {
  return args.blocks.map((block) => ({
    block,
    current: args.currentJobId != null && block.job_id === args.currentJobId,
    visited: args.visitedJobIds.has(block.job_id),
  }))
}

/** The kept rows back into what the rail and the header take. */
export function unpackJobModeKeptRows(rows: readonly JobModeKeptRow[]): JobModeKeptDay {
  const visitedJobIds = new Set<string>()
  let currentJobId: string | null = null
  const blocks: JobModeScheduleBlock[] = []
  for (const r of rows) {
    blocks.push(r.block)
    if (r.visited) visitedJobIds.add(r.block.job_id)
    if (r.current && currentJobId == null) currentJobId = r.block.job_id
  }
  return { blocks, currentJobId, visitedJobIds }
}

/** A stored row off the shape voids the kept day: a block with its id, its job and its window, and the two flags. */
export function jobModeKeptRowIsValid(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (typeof r.current !== 'boolean' || typeof r.visited !== 'boolean') return false
  const b = r.block
  if (!b || typeof b !== 'object') return false
  const block = b as Record<string, unknown>
  if (typeof block.id !== 'string' || block.id.length === 0) return false
  if (typeof block.job_id !== 'string' || block.job_id.length === 0) return false
  if (typeof block.time_start !== 'string' || typeof block.time_end !== 'string') return false
  return true
}
