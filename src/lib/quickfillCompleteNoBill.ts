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
