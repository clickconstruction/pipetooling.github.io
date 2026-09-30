import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { buildEarnedRevenue, expectedHoursForJob } from './earnedRevenue'
import { loadEarnedJobs } from './loadBridgeData'
import { loadVectorSessions } from './loadBridgeVectors'
import { ratePerHourByJob, type VectorSession } from './vectors'
import { ymdAddDays } from './vectorDays'

/**
 * Vectors by the day loader (v2.4217, punch list #69) — the sessions and the
 * job rates for one drawn period, which may reach past the Bridge's 8-week
 * window (a month, thirteen pay weeks, a year of months). People and wages
 * come from the Vectors inputs already on the page; this loads only what the
 * period adds:
 *
 * - every closed clock session in the period, with its approval state
 *   (`loadVectorSessions`, the Vectors loader's own read);
 * - the jobs those sessions touched, priced the way the Bridge prices them
 *   (`loadEarnedJobs` → contract ÷ expected hours), so a month cell here and
 *   a pay-week row on Vectors read the same rate for the same job;
 * - the same jobs' rates AS THEY STOOD A WEEK AGO (v2.4220): lifetime hours
 *   through the cutoff and the % complete the job carried then (the last
 *   `job_pct_events` row at or before it — seed rows included, so a job whose
 *   % has never changed reads its current %). The kernel marks ↻ a day whose
 *   verdict differs between the two. The contract price and the status are
 *   read as they stand today — a price change or a finish inside the week
 *   is not replayed.
 */

export const VECTOR_REPRICE_LOOKBACK_DAYS = 7

export type VectorDaysInputs = {
  start: string
  end: string
  sessions: VectorSession[]
  ratePerHourByJob: Map<string, number>
  assumedHalfJobs: Set<string>
  jobLabels: Map<string, string>
  /** The rates a week ago, for the ↻ mark. */
  priorRatePerHourByJob: Map<string, number>
}

type PctRow = { job_id: string; pct: number | null; changed_at: string }

export async function loadVectorDaysInputs(args: { start: string; end: string; todayYmd: string; officeJobLedgerId: string | null }): Promise<VectorDaysInputs> {
  const cutoffYmd = ymdAddDays(args.todayYmd, -VECTOR_REPRICE_LOOKBACK_DAYS)
  const sessions = await loadVectorSessions(args.start, args.end, args.officeJobLedgerId)
  const jobIds = [...new Set(sessions.map((s) => (s.officeJob || s.onBid ? null : s.jobId)).filter((v): v is string => !!v))]
  const [{ jobs, earnedJobs, lifetimeHoursAsOf }, pctRows] = await Promise.all([
    loadEarnedJobs(jobIds, { asOfYmd: cutoffYmd }),
    fetchAllRowsChunkedIn(
      jobIds,
      async (chunk, from, to) => ({
        data: (await withSupabaseRetry(
          async () => supabase.from('job_pct_events').select('job_id, pct, changed_at').in('job_id', chunk).lte('changed_at', `${cutoffYmd}T23:59:59-06:00`).order('changed_at', { ascending: false }).range(from, to),
          'vector days pct history',
        )) as PctRow[] | null,
        error: null,
      }),
      'vector days pct history',
      { chunkSize: 200 },
    ),
  ])
  const earned = buildEarnedRevenue({ jobs: earnedJobs, sessions: [] })

  // The % each job carried at the cutoff: the newest event at or before it.
  const priorPctByJob = new Map<string, number | null>()
  for (const r of pctRows) if (!priorPctByJob.has(r.job_id)) priorPctByJob.set(r.job_id, r.pct == null ? null : Number(r.pct))
  const priorExpected = new Map<string, number>()
  for (const j of earnedJobs) {
    const life = lifetimeHoursAsOf.get(j.id) ?? 0
    if (life <= 0) continue
    const pct = priorPctByJob.has(j.id) ? priorPctByJob.get(j.id) ?? null : j.pctComplete
    priorExpected.set(j.id, expectedHoursForJob({ ...j, pctComplete: pct, lifetimeHours: life }).hours)
  }

  return {
    start: args.start,
    end: args.end,
    sessions,
    ratePerHourByJob: ratePerHourByJob(jobs, earned.expectedHoursByJob),
    assumedHalfJobs: new Set(earned.assumedHalfJobs),
    jobLabels: new Map(jobs.map((j) => [j.id, j.label])),
    priorRatePerHourByJob: ratePerHourByJob(jobs, priorExpected),
  }
}
