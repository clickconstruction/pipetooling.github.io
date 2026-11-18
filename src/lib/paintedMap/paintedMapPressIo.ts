/**
 * The Dashboard's Paint a map press (punch list #392): what the person is clocked onto and what is
 * on their schedule today, for `paintPressLanding`. Reads only. The press is handed this, so its
 * render test hands it a fake.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { PaintPressClock, PaintPressJob, PaintPressStop } from './paintedMapPress'

export type PaintPressDay = { clock: PaintPressClock; todayStops: PaintPressStop[] }

/** A day with nothing known: the press lands on the person's pick. */
export const PAINT_PRESS_NO_DAY: PaintPressDay = { clock: null, todayStops: [] }

type JobRow = { id?: string | null; hcp_number: string | null; job_name: string | null; job_address: string | null; billing_only?: boolean | null }

const jobOf = (id: string, row: JobRow | null | undefined): PaintPressJob => ({ id, number: row?.hcp_number ?? null, name: row?.job_name ?? null, address: row?.job_address ?? null, billingOnly: row?.billing_only ?? false })

/**
 * Today's stops and the open clock, the same two rows Job Mode's card reads. A job the person is
 * clocked onto that is not on today's schedule is read by itself. A read that fails throws: the
 * press then opens with nothing known, and the person picks the job.
 */
export async function loadPaintPressDay(userId: string, nowMs: number = Date.now()): Promise<PaintPressDay> {
  const today = denverCalendarDayKey(nowMs)
  const [blocksRaw, openRaw] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select('id, job_id, time_start, time_end, jobs_ledger(hcp_number, job_name, job_address, billing_only)')
          .eq('assignee_user_id', userId)
          .eq('work_date', today)
          .order('time_start', { ascending: true }),
      'load schedule',
    ),
    withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('id, job_ledger_id, bid_id')
          .eq('user_id', userId)
          .is('clocked_out_at', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .order('clocked_in_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      'load clock session',
    ),
  ])

  const todayStops: PaintPressStop[] = []
  for (const r of (blocksRaw ?? []) as Array<{ job_id: string | null; time_start: string; time_end: string; jobs_ledger: JobRow | null }>) {
    if (!r?.job_id) continue
    todayStops.push({ job: jobOf(r.job_id, r.jobs_ledger), timeStart: r.time_start, timeEnd: r.time_end })
  }

  const open = (openRaw ?? null) as { id: string; job_ledger_id: string | null; bid_id: string | null } | null
  if (!open) return { clock: null, todayStops }
  // The office, or a bid: clocked in, and on nothing a map is painted for.
  if (!open.job_ledger_id) return { clock: { job: null }, todayStops }
  const onSchedule = todayStops.find((s) => s.job.id === open.job_ledger_id)
  if (onSchedule) return { clock: { job: onSchedule.job }, todayStops }
  const jobId = open.job_ledger_id
  const row = await withSupabaseRetry(
    async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, billing_only').eq('id', jobId).maybeSingle(),
    'load clocked job',
  )
  // A job the person may not read: still theirs to paint on, named by the sheet as this job.
  return { clock: { job: jobOf(jobId, (row ?? null) as JobRow | null) }, todayStops }
}
