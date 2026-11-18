import type { Tables } from '../../types/database'

/** An estimate as the detail page reads it: the row, with the linked job's number when `job_ledger_id` is set. */
export type EstimateDetailRow = Tables<'estimates'> & {
  jobs_ledger?: { hcp_number: string } | null
}
