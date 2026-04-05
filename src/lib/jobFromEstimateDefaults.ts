import type { Database } from '../types/database'

type EstimateRow = Database['public']['Tables']['estimates']['Row']

export function defaultJobFieldsFromEstimate(
  row: Pick<EstimateRow, 'title' | 'for_address' | 'total_cents'>,
): {
  jobName: string
  jobAddress: string
  revenue: number | null
} {
  return {
    jobName: (row.title ?? '').trim(),
    jobAddress: (row.for_address ?? '').trim(),
    revenue: row.total_cents != null ? row.total_cents / 100 : null,
  }
}
