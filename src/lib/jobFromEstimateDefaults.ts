import type { Database } from '../types/database'

type EstimateRow = Database['public']['Tables']['estimates']['Row']

export function defaultJobFieldsFromEstimate(
  row: Pick<EstimateRow, 'title' | 'for_address'>,
): {
  jobName: string
  jobAddress: string
} {
  return {
    jobName: (row.title ?? '').trim(),
    jobAddress: (row.for_address ?? '').trim(),
  }
}
