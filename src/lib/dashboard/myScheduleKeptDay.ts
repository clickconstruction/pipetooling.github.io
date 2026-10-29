import type { JobScheduleBlockRow } from '../jobScheduleBlocks'
import type { SubScheduleJobMeta } from '../dashboardSubSchedule'
import { buildKeptReadKey } from '../keptRead'

/**
 * My Schedule's kept day (punch list #183 PR 3): the shape the Dashboard's My Schedule card keeps
 * on the device through `useKeptRead`, so a slow morning shows today's and tomorrow's blocks as
 * read at 7:52 AM with the stamp *Your day as read at 7:52 AM · reading again…* instead of two grey
 * bars, and a failed schedule read never lands as an empty day.
 *
 * What is kept is the view model the card draws, never the raw tables: each block with the label,
 * the customer phone and the job meta the card's three reads resolved for it. The key carries the
 * day, so yesterday's day is never shown as today's (the owner's call 4 of 2026-10-26).
 * `useDashboardSubSchedule` builds the rows once every read landed and unpacks them while the
 * live read runs.
 */

export const MY_SCHEDULE_KEPT_PAGE = 'my-schedule'

/** The two days the card draws; a kept day covers both or is not shown. */
export const MY_SCHEDULE_KEPT_SCOPES: readonly string[] = ['today', 'tomorrow']

/** `u1:my-schedule:2026-10-29`: the day is the scope, so another day is another key. */
export function myScheduleKeptKey(userId: string, todayYmd: string): string {
  return buildKeptReadKey(userId, MY_SCHEDULE_KEPT_PAGE, todayYmd)
}

/** The card's anchor for a block: the job id, or `bid:<id>` on a bid-anchored visit (v2.1613). */
export function myScheduleBlockAnchorId(block: Pick<JobScheduleBlockRow, 'job_id' | 'bid_id'>): string {
  return block.job_id ?? `bid:${block.bid_id ?? ''}`
}

export type MyScheduleKeptRow = {
  block: JobScheduleBlockRow
  /** The row's label under its anchor, null when none was read. */
  label: string | null
  /** The job's customer phone, null when none or on a bid. */
  phone: string | null
  /** The job's pictures link, numbers and address, null on a bid or when the read did not cover it. */
  meta: SubScheduleJobMeta | null
}

export type MyScheduleKeptDay = {
  rows: JobScheduleBlockRow[]
  labels: Map<string, string>
  phones: Map<string, string | null>
  meta: Map<string, SubScheduleJobMeta>
}

/** The rows to keep once the blocks, the labels and the job meta all landed: one per block, with what the card resolved for it. */
export function buildMyScheduleKeptRows(args: {
  rows: readonly JobScheduleBlockRow[]
  labels: ReadonlyMap<string, string>
  phones: ReadonlyMap<string, string | null>
  meta: ReadonlyMap<string, SubScheduleJobMeta>
}): MyScheduleKeptRow[] {
  return args.rows.map((block) => {
    const anchor = myScheduleBlockAnchorId(block)
    const jobId = block.job_id
    return {
      block,
      label: args.labels.get(anchor) ?? null,
      phone: jobId != null ? (args.phones.get(jobId) ?? null) : null,
      meta: jobId != null ? (args.meta.get(jobId) ?? null) : null,
    }
  })
}

/** The kept rows back into what the card takes: the blocks and the three maps. */
export function unpackMyScheduleKeptRows(rows: readonly MyScheduleKeptRow[]): MyScheduleKeptDay {
  const labels = new Map<string, string>()
  const phones = new Map<string, string | null>()
  const meta = new Map<string, SubScheduleJobMeta>()
  const blocks: JobScheduleBlockRow[] = []
  for (const r of rows) {
    blocks.push(r.block)
    if (r.label != null) labels.set(myScheduleBlockAnchorId(r.block), r.label)
    const jobId = r.block.job_id
    if (jobId != null) {
      if (!phones.has(jobId)) phones.set(jobId, r.phone)
      if (r.meta && !meta.has(jobId)) meta.set(jobId, r.meta)
    }
  }
  return { rows: blocks, labels, phones, meta }
}

/** A stored row off the shape voids the kept day: a block with its id, its day and its window. */
export function myScheduleKeptRowIsValid(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  const b = r.block
  if (!b || typeof b !== 'object') return false
  const block = b as Record<string, unknown>
  if (typeof block.id !== 'string' || block.id.length === 0) return false
  if (typeof block.work_date !== 'string' || typeof block.time_start !== 'string' || typeof block.time_end !== 'string') return false
  if (block.job_id != null && typeof block.job_id !== 'string') return false
  if (r.label != null && typeof r.label !== 'string') return false
  if (r.phone != null && typeof r.phone !== 'string') return false
  if (r.meta != null && typeof r.meta !== 'object') return false
  return true
}
