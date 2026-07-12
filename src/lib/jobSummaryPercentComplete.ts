/** Jobs → Job Summary "%" column: latest field-report completion percent with
 * `jobs_ledger.pct_complete` (Edit Job) as the fallback. Pure — no React/supabase. */

/**
 * Report percent wins (it reflects what the crew last reported — same source as the
 * timeline chart's green line); otherwise the job's manual pct_complete when it is a
 * valid 0–100 value; otherwise null (rendered as —).
 */
export function resolveJobSummaryPercentComplete(
  reportPct: number | null | undefined,
  pctComplete: number | null | undefined,
): number | null {
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
