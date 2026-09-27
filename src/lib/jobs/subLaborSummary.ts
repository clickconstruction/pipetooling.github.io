import { laborJobSubCost } from './subLaborCost'
import type { JobSubLaborInputs } from '../../../supabase/functions/_shared/jobSubLaborInputs'

/** What the job form's cost block and delete gate read: how many sub-labor sheets sit on the job, and what they cost together. */
export type SubLaborSummary = { count: number; total: number }

/**
 * The sub-labor sheets on a job as one count and one total — each sheet's line totals plus its
 * drive cost through `laborJobSubCost` (the tested kernel the Job window's profit band and the
 * dev MCP server read). Null while nothing has loaded. Lifted out of `JobFormModal`'s inline
 * loader (v2.3871), which carried a hand copy of the drive-cost formula.
 */
export function subLaborSummary(data: JobSubLaborInputs | null | undefined): SubLaborSummary | null {
  if (!data) return null
  let total = 0
  for (const lj of data.laborJobs) total += laborJobSubCost(lj, data.mileageCost, data.timePerMile)
  return { count: data.laborJobs.length, total }
}
