import { buildEarnedRevenue } from './earnedRevenue'
import { loadEarnedJobs } from './loadBridgeData'
import { loadVectorSessions } from './loadBridgeVectors'
import { ratePerHourByJob, type VectorSession } from './vectors'

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
 *   a pay-week row on Vectors read the same rate for the same job.
 */

export type VectorDaysInputs = {
  start: string
  end: string
  sessions: VectorSession[]
  ratePerHourByJob: Map<string, number>
  assumedHalfJobs: Set<string>
  jobLabels: Map<string, string>
}

export async function loadVectorDaysInputs(args: { start: string; end: string; officeJobLedgerId: string | null }): Promise<VectorDaysInputs> {
  const sessions = await loadVectorSessions(args.start, args.end, args.officeJobLedgerId)
  const jobIds = [...new Set(sessions.map((s) => (s.officeJob || s.onBid ? null : s.jobId)).filter((v): v is string => !!v))]
  const { jobs, earnedJobs } = await loadEarnedJobs(jobIds)
  const earned = buildEarnedRevenue({ jobs: earnedJobs, sessions: [] })
  return {
    start: args.start,
    end: args.end,
    sessions,
    ratePerHourByJob: ratePerHourByJob(jobs, earned.expectedHoursByJob),
    assumedHalfJobs: new Set(earned.assumedHalfJobs),
    jobLabels: new Map(jobs.map((j) => [j.id, j.label])),
  }
}
