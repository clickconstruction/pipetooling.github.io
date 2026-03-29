import { supabase } from './supabase'
import type { Json } from '../types/database'
import { DatabaseError, withSupabaseRetry } from '../utils/errorHandling'

export type SplitClockSegmentPayload = {
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string
  /** Per-segment job/bid for `replace_own_clock_session_cluster_mixed` only; omit for single-session split RPCs. */
  job_ledger_id?: string | null
  bid_id?: string | null
}

/**
 * Replaces the caller's clock session with N contiguous segments (Dashboard My Time / split modal).
 * When the session was approved, the RPC rolls back people_hours like revoke; new rows are pending.
 */
export async function splitOwnClockSessionSegments(
  sessionId: string,
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('split_own_clock_session_segments', {
        p_session_id: sessionId,
        p_segments: segments as unknown as Json,
      }),
    'split_own_clock_session_segments'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from split_own_clock_session_segments')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}

/** Replace N contiguous same-job/bid sessions with M segments (My Time cluster editor). */
export async function splitOwnClockSessionCluster(
  sessionIds: string[],
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('split_own_clock_session_cluster', {
        p_session_ids: sessionIds,
        p_segments: segments as unknown as Json,
      }),
    'split_own_clock_session_cluster'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from split_own_clock_session_cluster')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}

/** Replace N time-contiguous sessions (mixed job/bid) with M segments; per-segment allocation in JSON. */
export async function replaceOwnClockSessionClusterMixed(
  sessionIds: string[],
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('replace_own_clock_session_cluster_mixed', {
        p_session_ids: sessionIds,
        p_segments: segments as unknown as Json,
      }),
    'replace_own_clock_session_cluster_mixed'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from replace_own_clock_session_cluster_mixed')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}
