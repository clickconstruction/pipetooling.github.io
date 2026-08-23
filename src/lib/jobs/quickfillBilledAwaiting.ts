/**
 * Quickfill → Billed Awaiting Payment rows (v2.2147): the Pipeline's own
 * `billedActiveRows` (one row per bill — a billed job with one bill line is
 * ONE merged row, never job + invoice; Collections excluded) decorated with
 * the names the lean spine lacks. Before this the section pushed a job-level
 * row for every billed job AND an invoice row per billed line, doubling
 * nearly everything (122 lines / $488k against the Pipeline's 61 / $240k).
 */
import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type QuickfillBilledRow = {
  key: string
  jobId: string
  jobNumber: string
  jobName: string
  assigned: string[]
  remaining: number
}

export function buildQuickfillBilledRows(
  leanBilledRows: readonly StageRow[],
  jobNameById: ReadonlyMap<string, string>,
  assignedByJobId: ReadonlyMap<string, string[]>,
): { rows: QuickfillBilledRow[]; total: number } {
  const rows: QuickfillBilledRow[] = []
  let total = 0
  for (const r of leanBilledRows) {
    const remaining = stageRowBilledRemainingAmount(r)
    if (remaining <= 0) continue
    total += remaining
    rows.push({
      key: r.kind === 'job' ? `job-${r.job.id}` : `inv-${r.inv.id}`,
      jobId: r.job.id,
      jobNumber: effectiveJobLedgerNumber(r.job.hcp_number, r.job.click_number) || '—',
      jobName: (jobNameById.get(r.job.id) ?? r.job.job_name ?? '').trim() || '—',
      assigned: assignedByJobId.get(r.job.id) ?? [],
      remaining,
    })
  }
  return { rows, total }
}
