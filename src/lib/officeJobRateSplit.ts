import { round2 } from './mercurySplitMath'
import { approvedClosedSessionHours } from './overheadDailyLabor'

/**
 * Dual hourly rate (office vs. field-job) pay math.
 *
 * A worker may opt into a second hourly rate: an "office rate" for time on office work
 * (the configured office job + any bid + unassigned time) and the normal `hourly_wage`
 * for time on real field jobs. Hours stay authoritative from `people_hours` (a daily
 * total, possibly manually edited); approved clock sessions only decide each day's
 * *office fraction*, which is applied to that day's authoritative total.
 *
 * Pure module — no React, no Supabase. Reuses `round2` (cents rounding, matches the rest
 * of the app) and `approvedClosedSessionHours` (returns null for open sessions => excluded).
 */

/** Minimal clock-session shape needed for office/job bucketing. Caller selects exactly these columns. */
export type RateSplitSessionRow = {
  work_date: string
  job_ledger_id: string | null
  bid_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

/** Per-day office/job hours derived from clock sessions (used only to compute the fraction). */
export type DayBucketHours = {
  officeHours: number
  jobHours: number
}

/** Result of splitting one day's authoritative hours into the two rate buckets. */
export type DayRateSplit = {
  workDate: string
  /** = officeHours + jobHours; equals the authoritative people_hours total (rounded to cents-of-hours). */
  totalHours: number
  officeHours: number
  jobHours: number
  officePaid: number
  jobPaid: number
  /** Stored as pay_stub_days.paid_amount. */
  paidAmount: number
  /** Stored as pay_stub_days.rate_at_time (derived; trust paidAmount, not rate*hours). */
  blendedRate: number
}

export type DualRateConfigLike = {
  is_salary?: boolean | null
  office_hourly_wage?: number | null
}

/**
 * Single source of the opt-in gate so the stub generator and the draft preview can't diverge.
 * Dual rate applies only to hourly (non-salary) people who have an office rate set.
 */
export function shouldUseDualRate(cfg: DualRateConfigLike | undefined | null): boolean {
  return !!cfg && !cfg.is_salary && cfg.office_hourly_wage != null
}

/**
 * OFFICE for everything except a real field job. A session is JOB only when it has a
 * `job_ledger_id` that is set AND not the configured office job. Office job, any bid, and
 * unassigned (both null) all bucket as OFFICE (the decided "unassigned => office" rule).
 */
export function rateBucketForSession(
  s: Pick<RateSplitSessionRow, 'job_ledger_id' | 'bid_id'>,
  officeJobLedgerId: string | null,
): 'office' | 'job' {
  if (s.job_ledger_id != null && s.job_ledger_id !== officeJobLedgerId) return 'job'
  return 'office'
}

/** Payable for pay purposes: approved, not rejected/revoked. (Open sessions excluded via duration.) */
function isPayableSession(s: RateSplitSessionRow): boolean {
  return !s.rejected_at && !s.revoked_at && s.approved_at != null
}

/** Sum payable, closed session hours per work_date into office/job buckets. */
export function bucketSessionHoursByDay(
  sessions: readonly RateSplitSessionRow[],
  officeJobLedgerId: string | null,
): Map<string, DayBucketHours> {
  const byDay = new Map<string, DayBucketHours>()
  for (const s of sessions) {
    if (!isPayableSession(s)) continue
    const hrs = approvedClosedSessionHours(s)
    if (hrs == null || hrs <= 0) continue
    const entry = byDay.get(s.work_date) ?? { officeHours: 0, jobHours: 0 }
    if (rateBucketForSession(s, officeJobLedgerId) === 'job') entry.jobHours += hrs
    else entry.officeHours += hrs
    byDay.set(s.work_date, entry)
  }
  return byDay
}

/**
 * Split one day's authoritative hours by the session-derived office fraction and price each
 * bucket. Sessions only set the fraction — they never override the authoritative total.
 */
export function splitDayHoursByRate(args: {
  workDate: string
  /** Authoritative hours for the day (from people_hours; NOT derived from sessions). */
  totalHours: number
  /** Session-derived office/job hours for this day; undefined when no sessions exist. */
  bucketHours?: DayBucketHours
  officeWage: number
  jobWage: number
}): DayRateSplit {
  const { workDate, officeWage, jobWage } = args
  const totalHours = round2(args.totalHours)
  if (totalHours <= 0) {
    return {
      workDate,
      totalHours: 0,
      officeHours: 0,
      jobHours: 0,
      officePaid: 0,
      jobPaid: 0,
      paidAmount: 0,
      blendedRate: 0,
    }
  }

  const bucket = args.bucketHours
  const bucketTotal = bucket ? bucket.officeHours + bucket.jobHours : 0

  let officeHours: number
  let jobHours: number
  if (!bucket || bucketTotal <= 0) {
    // No attributable sessions for the day => all office (unassigned/manual defaults to office).
    officeHours = totalHours
    jobHours = 0
  } else {
    const officeFrac = bucket.officeHours / bucketTotal
    officeHours = round2(totalHours * officeFrac)
    // Subtract so the two parts re-sum exactly to totalHours (no penny drift).
    jobHours = round2(totalHours - officeHours)
  }

  const officePaid = round2(officeHours * officeWage)
  const jobPaid = round2(jobHours * jobWage)
  const paidAmount = round2(officePaid + jobPaid)
  const blendedRate = totalHours > 0 ? round2(paidAmount / totalHours) : 0

  return { workDate, totalHours, officeHours, jobHours, officePaid, jobPaid, paidAmount, blendedRate }
}

/**
 * Build per-day rate splits for an entire period. The single entry point used by both the
 * stub generator and the draft-payroll preview, so their math is guaranteed identical.
 */
export function buildDayRateSplitsForPeriod(args: {
  daysInRange: readonly string[]
  /** Authoritative people_hours per work_date. */
  hoursByDate: ReadonlyMap<string, number>
  sessions: readonly RateSplitSessionRow[]
  officeJobLedgerId: string | null
  officeWage: number
  jobWage: number
}): Map<string, DayRateSplit> {
  const { daysInRange, hoursByDate, sessions, officeJobLedgerId, officeWage, jobWage } = args
  const bucketByDay = bucketSessionHoursByDay(sessions, officeJobLedgerId)
  const out = new Map<string, DayRateSplit>()
  for (const workDate of daysInRange) {
    out.set(
      workDate,
      splitDayHoursByRate({
        workDate,
        totalHours: hoursByDate.get(workDate) ?? 0,
        bucketHours: bucketByDay.get(workDate),
        officeWage,
        jobWage,
      }),
    )
  }
  return out
}

/** Period totals for the itemized stub document. */
export type RateSplitSummary = {
  officeHours: number
  officeRate: number
  officePaid: number
  jobHours: number
  jobRate: number
  jobPaid: number
}

/** Persisted pay_stub_days breakdown columns (NULL on single-rate stub days). */
export type StubDayBreakdownRow = {
  office_hours: number | null
  office_rate: number | null
  job_hours: number | null
  job_rate: number | null
}

/**
 * Rebuild the period summary from persisted pay_stub_days breakdown columns (used when
 * re-opening / printing an existing stub). Returns null when no day carries a breakdown
 * (i.e. a legacy single-rate stub) so the document falls back to its single line.
 */
export function summarizeStubDayBreakdown(
  rows: readonly StubDayBreakdownRow[],
): RateSplitSummary | null {
  let any = false
  let officeHours = 0
  let jobHours = 0
  let officePaid = 0
  let jobPaid = 0
  let officeRate = 0
  let jobRate = 0
  for (const r of rows) {
    if (r.office_hours == null && r.job_hours == null) continue
    any = true
    const oh = r.office_hours ?? 0
    const jh = r.job_hours ?? 0
    const orr = r.office_rate ?? 0
    const jr = r.job_rate ?? 0
    officeHours += oh
    jobHours += jh
    officePaid += oh * orr
    jobPaid += jh * jr
    if (orr) officeRate = orr
    if (jr) jobRate = jr
  }
  if (!any) return null
  return {
    officeHours: round2(officeHours),
    officeRate,
    officePaid: round2(officePaid),
    jobHours: round2(jobHours),
    jobRate,
    jobPaid: round2(jobPaid),
  }
}

/** Sum a period's DayRateSplits into office/field totals for display. */
export function summarizeRateSplits(
  splits: Iterable<DayRateSplit>,
  officeWage: number,
  jobWage: number,
): RateSplitSummary {
  let officeHours = 0
  let officePaid = 0
  let jobHours = 0
  let jobPaid = 0
  for (const s of splits) {
    officeHours += s.officeHours
    officePaid += s.officePaid
    jobHours += s.jobHours
    jobPaid += s.jobPaid
  }
  return {
    officeHours: round2(officeHours),
    officeRate: officeWage,
    officePaid: round2(officePaid),
    jobHours: round2(jobHours),
    jobRate: jobWage,
    jobPaid: round2(jobPaid),
  }
}
