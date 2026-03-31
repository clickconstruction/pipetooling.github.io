import { supabase } from './supabase'
import type { Json } from '../types/database'
import { DatabaseError, withSupabaseRetry } from '../utils/errorHandling'
import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'

export type { SplitClockSegmentPayload }

export async function leaderSplitClockSessionSegments(
  sessionId: string,
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('leader_split_clock_session_segments', {
        p_session_id: sessionId,
        p_segments: segments as unknown as Json,
      }),
    'leader_split_clock_session_segments'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from leader_split_clock_session_segments')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}

export async function leaderSplitClockSessionCluster(
  sessionIds: string[],
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('leader_split_clock_session_cluster', {
        p_session_ids: sessionIds,
        p_segments: segments as unknown as Json,
      }),
    'leader_split_clock_session_cluster'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from leader_split_clock_session_cluster')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}

export async function leaderReplaceClockSessionClusterMixed(
  sessionIds: string[],
  segments: SplitClockSegmentPayload[]
): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('leader_replace_clock_session_cluster_mixed', {
        p_session_ids: sessionIds,
        p_segments: segments as unknown as Json,
      }),
    'leader_replace_clock_session_cluster_mixed'
  )

  const row = Array.isArray(rows) ? rows[0] : undefined
  if (!row) {
    throw new DatabaseError('No response from leader_replace_clock_session_cluster_mixed')
  }
  if (row.error_message) {
    throw new DatabaseError(row.error_message)
  }
  return row.inserted_ids ?? []
}
