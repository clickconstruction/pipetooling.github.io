/**
 * React keys for the unified Pipeline table's rows (Stages tab decomposition PR 10, v2.3548).
 * Lifted from `JobsStagesUnifiedTable` unchanged, so the split into row components changes
 * nothing about how React reconciles a section.
 */
import type { StageRow } from '../jobsStagesBoard'

export function stagesUnifiedRowKey(row: StageRow): string {
  if (row.kind === 'invoice') return `inv-${row.inv.id}`
  const bundleInv = row.kind === 'job_with_merged_billed' || row.kind === 'job_with_primary_rtb' ? row.inv : null
  return bundleInv != null
    ? row.kind === 'job_with_primary_rtb'
      ? `job-${row.job.id}-rtb-${bundleInv.id}`
      : `job-${row.job.id}-billed-${bundleInv.id}`
    : `job-${row.job.id}`
}
