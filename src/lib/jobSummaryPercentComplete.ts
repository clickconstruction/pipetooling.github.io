/** Jobs → Job Summary "%" column: latest field-report completion percent with
 * `jobs_ledger.pct_complete` (Edit Job) as the fallback. Pure — no React/supabase. */

/**
 * True when the job's invoices prove it finished: at least one invoice, every invoice
 * `status === 'paid'`, and the invoiced total is more than zero. A fully collected job is
 * 100% complete regardless of what the last field report said.
 */
export function jobInvoicesAllPaidWithAmount(
  invoices: Array<{ status: string | null; amount: number | null }> | null | undefined,
): boolean {
  if (!invoices || invoices.length === 0) return false
  let total = 0
  for (const inv of invoices) {
    if (inv.status !== 'paid') return false
    total += Number(inv.amount ?? 0)
  }
  return total > 0
}

/**
 * Fully paid invoices win (the money is in — the job is done); then the report percent
 * (what the crew last reported — same source as the timeline chart's green line); then the
 * job's manual pct_complete when it is a valid 0–100 value; otherwise null (rendered as —).
 */
export function resolveJobSummaryPercentComplete(
  reportPct: number | null | undefined,
  pctComplete: number | null | undefined,
  opts?: { invoicesAllPaidWithAmount?: boolean },
): number | null {
  if (opts?.invoicesAllPaidWithAmount) return 100
  if (reportPct != null && Number.isFinite(reportPct) && reportPct >= 0 && reportPct <= 100) {
    return Math.round(reportPct)
  }
  if (pctComplete != null && Number.isFinite(pctComplete) && pctComplete >= 0 && pctComplete <= 100) {
    return Math.round(pctComplete)
  }
  return null
}

export function formatJobSummaryPercentComplete(pct: number | null): string {
  return pct == null ? '—' : `${pct}%`
}

/**
 * The "%"-column fallback chain when no field report carries a % — paid invoices →
 * Edit-Job pct_complete → null. Feeds the Cost Timeline's fallback value point so the
 * chart's value series appears wherever the Job Summary % column shows a percent.
 */
export function resolveJobCurrentPercentFallback(job: {
  pct_complete: number | null
  invoices: Array<{ status: string | null; amount: number | null }> | null | undefined
}): number | null {
  return resolveJobSummaryPercentComplete(null, job.pct_complete, {
    invoicesAllPaidWithAmount: jobInvoicesAllPaidWithAmount(job.invoices),
  })
}
