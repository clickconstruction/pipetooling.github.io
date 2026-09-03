import { supabase } from './supabase'
import type { GcCertSnapshot, GcReviewCertRow } from './jobs/gcReviewCertification'

/**
 * IO for gc_review_certifications (v2.1980, Wednesday GC certification).
 * Certifying is a direct RLS-gated insert (append-only — re-certifying just
 * inserts again; latestCertByGc picks the winner). The Dashboard nudge reads
 * gc_review_week_status(). Mirrors gcStatementEmailRequests.
 */

export async function listGcReviewCertifications(weekStartYmd: string): Promise<GcReviewCertRow[]> {
  const { data, error } = await supabase
    .from('gc_review_certifications')
    .select('gc_customer_id, week_start, certified_by_name, certified_at, job_count, total, snapshot, note')
    .eq('week_start', weekStartYmd)
  if (error) throw new Error(error.message)
  return (data ?? []) as GcReviewCertRow[]
}

export async function insertGcReviewCertification(row: {
  week_start: string
  gc_customer_id: string
  certified_by: string
  certified_by_name: string
  job_count: number
  total: number
  snapshot: GcCertSnapshot
  note: string
}): Promise<void> {
  const { error } = await supabase.from('gc_review_certifications').insert(row)
  if (error) throw new Error(error.message)
}

export type GcReviewWeekStatus = {
  gcs_outstanding: number
  gcs_certified: number
  gcs_sent: number
  /** GCs both certified (still matching the live total) AND sent this week (RPC v2, v2.2705); absent from the v1 RPC. */
  gcs_done?: number
}

/** Dashboard nudge spine — distinct-GC counts for the given cert week. */
export async function fetchGcReviewWeekStatus(weekStartYmd: string): Promise<GcReviewWeekStatus | null> {
  const { data, error } = await supabase.rpc('gc_review_week_status', { p_week_start: weekStartYmd })
  if (error) throw new Error(error.message)
  const obj = data as Record<string, unknown> | null
  if (!obj || typeof obj !== 'object' || typeof obj.gcs_outstanding !== 'number') return null
  return obj as unknown as GcReviewWeekStatus
}
