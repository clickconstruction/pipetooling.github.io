/**
 * Self-scheduling + field job requests (v2.1568): client wrappers for the
 * SECURITY DEFINER RPCs (search / add / move / remove / request) plus the pure
 * bits — own-day overlap detection and the "moved by" trail formatting the
 * Schedule page badge uses. All writes are RPC-side validated (assignee =
 * yourself, job in an active stage); table RLS is untouched.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { pgTimeToMinutes, scheduleFormatWindow } from './jobScheduleChicago'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'

export type SelfScheduleJobSearchRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string
  customer_name: string | null
}

/** The v2.1568 trail columns — optional until gen-types runs post-push. */
export type SelfScheduleBlockExtras = {
  field_moved_at?: string | null
  field_moved_from?: { work_date?: string; time_start?: string; time_end?: string } | null
}

export const SELF_SCHEDULE_STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed',
}

export async function searchJobsForSelfSchedule(query: string): Promise<SelfScheduleJobSearchRow[]> {
  const data = await withSupabaseRetry(
    async () => supabase.rpc('search_jobs_for_self_schedule', { p_query: query }),
    'search jobs for self schedule',
  )
  return (data ?? []) as SelfScheduleJobSearchRow[]
}

export async function selfScheduleAddBlock(args: {
  jobId: string
  workDate: string
  timeStart: string
  timeEnd: string
  joinCrew: boolean
}): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.rpc('self_schedule_add_block', {
        p_job_id: args.jobId,
        p_work_date: args.workDate,
        p_time_start: args.timeStart,
        p_time_end: args.timeEnd,
        p_join_crew: args.joinCrew,
      }),
    'add job to my schedule',
  )
}

export async function selfMoveScheduleBlock(args: {
  blockId: string
  workDate: string
  timeStart: string
  timeEnd: string
}): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.rpc('self_move_schedule_block', {
        p_block_id: args.blockId,
        p_work_date: args.workDate,
        p_time_start: args.timeStart,
        p_time_end: args.timeEnd,
      }),
    'move my schedule block',
  )
}

export async function selfRemoveScheduleBlock(blockId: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.rpc('self_remove_schedule_block', { p_block_id: blockId }),
    'remove my schedule block',
  )
}

export async function requestFieldJob(args: {
  jobName: string
  jobAddress: string
  customerName: string
  customerPhone: string
  customerEmail: string
  gcName: string
  lineItems: string[]
  workDate: string
  timeStart: string
  timeEnd: string
}): Promise<string> {
  const data = await withSupabaseRetry(
    async () =>
      supabase.rpc('request_field_job', {
        p_job_name: args.jobName,
        p_job_address: args.jobAddress,
        p_customer_name: args.customerName,
        p_customer_phone: args.customerPhone,
        p_customer_email: args.customerEmail,
        p_gc_name: args.gcName,
        p_line_items: args.lineItems,
        p_work_date: args.workDate,
        p_time_start: args.timeStart,
        p_time_end: args.timeEnd,
      }),
    'request a job from the field',
  )
  return data as unknown as string
}

/**
 * First of MY blocks overlapping the proposed window on that date (excluding
 * the block being edited). Warn-not-block, same as the office scheduler.
 */
export function findOwnScheduleOverlap<T extends Pick<JobScheduleBlockRow, 'id' | 'work_date' | 'time_start' | 'time_end'>>(
  blocks: T[],
  proposed: { workDate: string; timeStart: string; timeEnd: string },
  excludeBlockId?: string | null,
): T | null {
  const start = pgTimeToMinutes(proposed.timeStart)
  const end = pgTimeToMinutes(proposed.timeEnd)
  if (!(end > start)) return null
  for (const b of blocks) {
    if (excludeBlockId && b.id === excludeBlockId) continue
    if (b.work_date !== proposed.workDate) continue
    const bStart = pgTimeToMinutes(b.time_start)
    const bEnd = pgTimeToMinutes(b.time_end)
    if (start < bEnd && bStart < end) return b
  }
  return null
}

/** "was Tue 12:00 PM–2:00 PM" for the Schedule page's moved-by badge; null when no trail. */
export function formatFieldMovedFrom(extras: SelfScheduleBlockExtras | null | undefined): string | null {
  const from = extras?.field_moved_from
  if (!from?.time_start || !from?.time_end) return null
  return `was ${from.work_date ?? ''} ${scheduleFormatWindow(from.time_start, from.time_end)}`.replace(/\s+/g, ' ').trim()
}

/** Shift a "HH:MM[:SS]" time by whole minutes, clamped to the same day. */
export function shiftPgTime(pgTime: string, deltaMinutes: number): string {
  const total = Math.max(0, Math.min(24 * 60, pgTimeToMinutes(pgTime) + deltaMinutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
