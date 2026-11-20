/**
 * Job Mode's top row: the reads behind `topRow.ts`. Reads only. The row is handed these, so its render test
 * hands it fakes.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { loadPaintOfficeJobId } from '../paintedMap/paintedMapPressIo'
import type { PaintPressJob, PaintPressStop } from '../paintedMap/paintedMapPress'
import { legOf } from './onMyWay'
import type { TopRowDay } from './topRow'

type JobRow = { id?: string | null; hcp_number: string | null; job_name: string | null; job_address: string | null; billing_only?: boolean | null }

const jobOf = (id: string, row: JobRow | null | undefined, officeJobId: string | null): PaintPressJob => ({ id, number: row?.hcp_number ?? null, name: row?.job_name ?? null, address: row?.job_address ?? null, billingOnly: row?.billing_only ?? false, office: !!officeJobId && id === officeJobId })

type SessionRow = { id: string; job_ledger_id: string | null; bid_id: string | null; clocked_out_at: string | null; travel_started_at: string | null; arrived_at: string | null }

/**
 * Today's stops, the open clock with its two travel stamps, and the jobs with a closed session today: the
 * rows Job Mode's card reads for its day list. A job the person is clocked onto that is not on today's
 * schedule is read by itself. A read that fails throws, and the row then draws the person's own squares.
 */
export async function loadTopRowDay(userId: string, nowMs: number = Date.now()): Promise<TopRowDay> {
  const today = denverCalendarDayKey(nowMs)
  const [officeJobId, blocksRaw, sessionsRaw] = await Promise.all([
    loadPaintOfficeJobId(),
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
          .select('id, job_ledger_id, bid_id, clocked_out_at, travel_started_at, arrived_at')
          .eq('user_id', userId)
          .or(`clocked_out_at.is.null,work_date.eq.${today}`)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .order('clocked_in_at', { ascending: false }),
      'load clock sessions',
    ),
  ])

  const todayStops: PaintPressStop[] = []
  for (const r of (blocksRaw ?? []) as Array<{ job_id: string | null; time_start: string; time_end: string; jobs_ledger: JobRow | null }>) {
    if (!r?.job_id) continue
    todayStops.push({ job: jobOf(r.job_id, r.jobs_ledger, officeJobId), timeStart: r.time_start, timeEnd: r.time_end })
  }

  const sessions = (sessionsRaw ?? []) as SessionRow[]
  const visitedJobIds = [...new Set(sessions.filter((s) => s.clocked_out_at && s.job_ledger_id).map((s) => s.job_ledger_id as string))]
  const open = sessions.find((s) => !s.clocked_out_at) ?? null
  if (!open) return { clock: null, todayStops, visitedJobIds }
  const leg = legOf({ travelStartedAt: open.travel_started_at, arrivedAt: open.arrived_at })
  // The office, or a bid: clocked in, and on no job of the row's.
  if (!open.job_ledger_id) return { clock: { job: null, leg }, todayStops, visitedJobIds }
  const onSchedule = todayStops.find((s) => s.job.id === open.job_ledger_id)
  if (onSchedule) return { clock: { job: onSchedule.job, leg }, todayStops, visitedJobIds }
  const jobId = open.job_ledger_id
  const row = await withSupabaseRetry(
    async () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, billing_only').eq('id', jobId).maybeSingle(),
    'load clocked job',
  )
  return { clock: { job: jobOf(jobId, (row ?? null) as JobRow | null, officeJobId), leg }, todayStops, visitedJobIds }
}

/**
 * The live boxes on a job's site, as a count: the job's development, the development's jobs, then one head
 * count of their boxes that are not retired and not the Unsorted pile. Under the reader's own access, so a
 * job the person cannot read beside counts as the one job. A read that fails throws, and the row draws no
 * On site square.
 */
export async function loadSiteBoxCount(jobId: string): Promise<number> {
  const job = (await withSupabaseRetry(async () => supabase.from('jobs_ledger').select('development_id').eq('id', jobId).maybeSingle(), 'load the job’s site')) as { development_id: string | null } | null
  let jobIds = [jobId]
  const siteId = job?.development_id ?? null
  if (siteId) {
    const siblings = ((await withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id').eq('development_id', siteId), 'load the site’s jobs')) ?? []) as Array<{ id: string }>
    jobIds = [...new Set([jobId, ...siblings.map((s) => s.id)])]
  }
  const { count, error } = await supabase.from('job_containers').select('id', { count: 'exact', head: true }).in('job_id', jobIds).is('retired_at', null).neq('kind', 'unsorted')
  if (error) throw error
  return count ?? 0
}
