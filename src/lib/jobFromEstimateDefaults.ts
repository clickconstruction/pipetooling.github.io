import type { Database } from '../types/database'
import { isAppDefaultEstimateTitle } from './estimates/estimateTitle'

type EstimateRow = Database['public']['Tables']['estimates']['Row']

/**
 * What the Create job window seeds from an estimate. The job name is the
 * estimate's title — unless that title is still the app's own default
 * ("Estimate for Kimberly Coe"), in which case the job is named for the
 * customer when a name is known (v2.3748). The same rule runs in SQL for jobs
 * the signature makes on its own (`auto_create_job_from_signed_estimate`).
 */
export function defaultJobFieldsFromEstimate(
  row: Pick<EstimateRow, 'title' | 'for_address'>,
  opts: { customerName?: string | null } = {},
): {
  jobName: string
  jobAddress: string
} {
  const title = (row.title ?? '').trim()
  const customerName = (opts.customerName ?? '').trim()
  return {
    jobName: customerName && isAppDefaultEstimateTitle(title) ? customerName : title,
    jobAddress: (row.for_address ?? '').trim(),
  }
}
