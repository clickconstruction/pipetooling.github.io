/**
 * Earned revenue kernel (v2.2677) — the Bridge's "thrust".
 *
 * Percentage-of-completion, labor-weighted: each approved field hour on a job
 * earns that job's contract revenue ÷ the job's expected total hours. Expected
 * total hours come from the job's completion signal — hours to date ÷
 * pct_complete — so a job that is 40% done after 100 hours is expected to
 * take 250, and each of those 100 hours earned 1/250 of the contract.
 *
 * Rules (documented on the page, deliberately simple for v1):
 * - Finished jobs (ready_to_bill / billed / paid) are 100% — expected hours =
 *   lifetime hours, so the whole contract has been earned across its hours.
 * - Open jobs use pct_complete (0–100); with no pct they are ASSUMED 50% done
 *   and counted in `assumedHalfJobs` so the page can say so.
 * - Jobs with no contract revenue set earn $0 and are counted in
 *   `noRevenueJobs` — T&M work whose price isn't on the ledger yet.
 * - Hours on a day beyond the expected total (a job that ran long) still earn
 *   at the same rate; the job simply over-earns relative to contract, which is
 *   the honest signal that its price is wrong, not the kernel's.
 *
 * Pure: no React, no Supabase.
 */

export type EarnedRevenueJob = {
  id: string
  revenueUsd: number | null
  /** 0–100 or null. */
  pctComplete: number | null
  status: string
  /** All approved field hours on the job, all time. */
  lifetimeHours: number
}

export type EarnedRevenueSessionHours = { jobId: string; ymd: string; hours: number }

export type EarnedRevenueResult = {
  /** Earned $ per calendar day (only days with hours appear). */
  earnedByDay: Map<string, number>
  /** Earned $ per job over the input sessions. */
  earnedByJob: Map<string, number>
  /** Expected total hours per job (the denominator used). */
  expectedHoursByJob: Map<string, number>
  assumedHalfJobs: string[]
  noRevenueJobs: string[]
}

const FINISHED = new Set(['ready_to_bill', 'billed', 'paid'])

export function expectedHoursForJob(job: EarnedRevenueJob): { hours: number; assumedHalf: boolean } {
  const life = Math.max(0, job.lifetimeHours)
  if (FINISHED.has(job.status)) return { hours: life, assumedHalf: false }
  const pct = job.pctComplete
  if (pct != null && Number.isFinite(pct) && pct > 0) return { hours: life / Math.min(1, pct / 100), assumedHalf: false }
  return { hours: life / 0.5, assumedHalf: true }
}

export function buildEarnedRevenue(input: {
  jobs: ReadonlyArray<EarnedRevenueJob>
  sessions: ReadonlyArray<EarnedRevenueSessionHours>
}): EarnedRevenueResult {
  const jobById = new Map(input.jobs.map((j) => [j.id, j]))
  const expectedHoursByJob = new Map<string, number>()
  const assumedHalfJobs: string[] = []
  const noRevenueJobs: string[] = []
  const ratePerHour = new Map<string, number>()
  for (const j of input.jobs) {
    const { hours, assumedHalf } = expectedHoursForJob(j)
    expectedHoursByJob.set(j.id, hours)
    if (assumedHalf) assumedHalfJobs.push(j.id)
    const rev = j.revenueUsd
    if (rev == null || !Number.isFinite(rev) || rev <= 0) {
      noRevenueJobs.push(j.id)
      ratePerHour.set(j.id, 0)
    } else {
      ratePerHour.set(j.id, hours > 0 ? rev / hours : 0)
    }
  }
  const earnedByDay = new Map<string, number>()
  const earnedByJob = new Map<string, number>()
  for (const s of input.sessions) {
    if (!jobById.has(s.jobId) || !(s.hours > 0)) continue
    const usd = s.hours * (ratePerHour.get(s.jobId) ?? 0)
    if (usd === 0) continue
    earnedByDay.set(s.ymd, (earnedByDay.get(s.ymd) ?? 0) + usd)
    earnedByJob.set(s.jobId, (earnedByJob.get(s.jobId) ?? 0) + usd)
  }
  return { earnedByDay, earnedByJob, expectedHoursByJob, assumedHalfJobs, noRevenueJobs }
}
