/**
 * Display fallback for a job's "% done" (v2.1572): a job whose recorded
 * `jobs_ledger.pct_complete` is null reads as 0 — or 100 once the job is
 * Paid in Full (`status = 'paid'`) — so % text never renders as absence.
 * A recorded pct always wins, including on paid jobs.
 *
 * Display-only, by design:
 * - Never write the synthesized value back or seed a % editor with it (the
 *   Stages "% done" input commits on blur — prefilling would mint fake
 *   assessments), which is why the Stages board cell does NOT use this.
 * - Never feed it into money math — "value created" stays
 *   `amount × recorded pct` (dashboardFinancials, stagesMoneyBar).
 * - Movement UI (today's ▲/▼ delta, progress bars, the yellow field-progress
 *   dot) stays tied to recorded values; a synthesized % must not claim
 *   progress happened.
 */
export function effectivePctComplete(pct: number | null | undefined, status: string | null | undefined): number {
  if (pct != null && Number.isFinite(pct)) return pct
  return status === 'paid' ? 100 : 0
}
