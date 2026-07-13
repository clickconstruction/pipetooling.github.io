/** Quickfill "Complete, no Total Bill" section: non-paid jobs resolved 100% complete
 * (same resolution as the Job Summary % column) whose `jobs_ledger.revenue` is unset or $0.
 * Pure — no React/supabase. */
import {
  jobInvoicesAllPaidWithAmount,
  resolveJobSummaryPercentComplete,
} from './jobSummaryPercentComplete'

export type QuickfillCompleteNoBillJobShape = {
  id: string
  status: string
  revenue: number | null
  hcp_number: string | null
  pct_complete: number | null
  invoices: Array<{ status: string | null; amount: number | null }>
}

export function jobHasNoTotalBill(revenue: number | null | undefined): boolean {
  return revenue == null || Number(revenue) === 0
}

/** Candidates worth resolving a report % for: non-paid, no Total Bill, HCP # at or above the
 * org threshold (same `parseInt(hcp_number) >= min` rule as the Jobs Billing section — hides
 * old imports; jobs with a non-numeric HCP # are kept). */
export function quickfillCompleteNoBillCandidates<T extends QuickfillCompleteNoBillJobShape>(
  jobs: T[],
  minHcpNumber: number,
): T[] {
  return jobs.filter((j) => {
    if (j.status === 'paid' || !jobHasNoTotalBill(j.revenue)) return false
    const hcp = parseInt(j.hcp_number ?? '', 10)
    return !Number.isFinite(hcp) || hcp >= minHcpNumber
  })
}

/** Candidates whose resolved percent (report % → pct_complete → paid-invoices override) is 100. */
export function buildQuickfillCompleteNoBillList<T extends QuickfillCompleteNoBillJobShape>(
  jobs: T[],
  reportPctByJobId: Map<string, number>,
  minHcpNumber: number,
): T[] {
  return quickfillCompleteNoBillCandidates(jobs, minHcpNumber).filter(
    (j) =>
      resolveJobSummaryPercentComplete(reportPctByJobId.get(j.id) ?? null, j.pct_complete, {
        invoicesAllPaidWithAmount: jobInvoicesAllPaidWithAmount(j.invoices),
      }) === 100,
  )
}

/** Per-job clock rollup for the section's inline rows. */
export type QuickfillJobClockSummary = {
  /** Earliest clock-in on the job — the "started" date. */
  firstClockInAt: string | null
  sessionCount: number
  /** Closed sessions only. */
  totalHours: number
  /** Distinct YYYY-MM-DD work dates, ascending (work_date, else the clock-in date). */
  workDates: string[]
  hasOpenSession: boolean
}

/** Roll multi-job `clock_sessions` rows (non-rejected, non-revoked) into per-job summaries. */
export function buildJobClockSummaries(
  rows: Array<{
    job_ledger_id: string | null
    clocked_in_at: string | null
    clocked_out_at: string | null
    work_date: string | null
  }>,
): Map<string, QuickfillJobClockSummary> {
  const byJob = new Map<string, QuickfillJobClockSummary & { dateSet: Set<string> }>()
  for (const r of rows) {
    if (!r.job_ledger_id) continue
    let s = byJob.get(r.job_ledger_id)
    if (!s) {
      s = {
        firstClockInAt: null,
        sessionCount: 0,
        totalHours: 0,
        workDates: [],
        hasOpenSession: false,
        dateSet: new Set<string>(),
      }
      byJob.set(r.job_ledger_id, s)
    }
    s.sessionCount += 1
    if (r.clocked_in_at && (!s.firstClockInAt || r.clocked_in_at < s.firstClockInAt)) {
      s.firstClockInAt = r.clocked_in_at
    }
    if (r.clocked_in_at && r.clocked_out_at) {
      const ms = Date.parse(r.clocked_out_at) - Date.parse(r.clocked_in_at)
      if (Number.isFinite(ms) && ms > 0) s.totalHours += ms / 3_600_000
    } else if (r.clocked_in_at && !r.clocked_out_at) {
      s.hasOpenSession = true
    }
    const d = (r.work_date ?? '').slice(0, 10) || (r.clocked_in_at ?? '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) s.dateSet.add(d)
  }
  const out = new Map<string, QuickfillJobClockSummary>()
  for (const [jobId, s] of byJob) {
    const { dateSet, ...summary } = s
    out.set(jobId, { ...summary, workDates: [...dateSet].sort() })
  }
  return out
}
