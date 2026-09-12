import { expectedHoursForJob } from '../bridge/earnedRevenue'

/**
 * Review's earned convention (v2.3360) — the Bridge's rule, adopted.
 *
 * People → Review used to credit a person with a job's revenue by their
 * wage-weighted cost share (their labor $ in the period ÷ every contributor's
 * labor $ over the job's life, sub sheets included) of a value created that
 * treated a job with no % complete as 100% done. The Bridge's Truth check
 * (v2.3335) proved its own rule against net position, and Vectors (v2.3344)
 * credits people by it, so Review now reads the same way:
 *
 *   value created  = contract × pctEffective
 *                    finished (ready_to_bill / billed / paid) → 100%
 *                    % complete set                            → that %
 *                    nothing set                               → 50%, marked ≈
 *   person's share = their clock hours on the job in the period
 *                    ÷ the job's lifetime clock hours (every person)
 *
 * Both halves are `earnedRevenue.ts`'s: expected hours = lifetime ÷ pct, and
 * an hour earns contract ÷ expected hours — so hours × rate equals value
 * created × share exactly, and a person's earned on Review is their earned
 * on the Bridge. Sub labor sheets are a job cost, not a share of revenue:
 * they have no clock hours. Pure.
 */

export type ReviewEarnedJob = {
  revenue: number | null
  pctComplete: number | null
  /** jobs_ledger.status; null when unknown (treated as not finished). */
  status: string | null
  /** All approved clock hours on the job, all time, every person. */
  lifetimeHours: number
}

export type ReviewEarned = {
  /** 0–1. */
  pctEffective: number
  /** True when nothing was set and the kernel assumed half done. */
  assumedHalf: boolean
  finished: boolean
  /** contract × pctEffective. */
  valueCreated: number
  /** Expected total clock hours (lifetime ÷ pct); 0 when the job has no hours yet. */
  expectedHours: number
}

const FINISHED = new Set(['ready_to_bill', 'billed', 'paid'])

export function reviewJobEarned(job: ReviewEarnedJob): ReviewEarned {
  const revenue = job.revenue != null && Number.isFinite(job.revenue) && job.revenue > 0 ? job.revenue : 0
  const finished = job.status != null && FINISHED.has(job.status)
  const { hours: expectedHours, assumedHalf } = expectedHoursForJob({
    id: '',
    revenueUsd: revenue,
    pctComplete: job.pctComplete,
    status: job.status ?? '',
    lifetimeHours: Math.max(0, job.lifetimeHours),
  })
  const pct = job.pctComplete
  const pctEffective = finished ? 1 : pct != null && Number.isFinite(pct) && pct > 0 ? Math.min(1, pct / 100) : 0.5
  return { pctEffective, assumedHalf: !finished && assumedHalf, finished, valueCreated: revenue * pctEffective, expectedHours }
}

/**
 * A person's share of a job for the period: their clock hours ÷ the job's
 * lifetime clock hours. A job with hours in the period but none on record
 * lifetime (a data gap) credits the whole period share, as before.
 */
export function reviewShareRatio(hoursInPeriod: number, lifetimeHours: number): number {
  if (!(hoursInPeriod > 0)) return 0
  return lifetimeHours > 0 ? Math.min(1, hoursInPeriod / lifetimeHours) : 1
}
