import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { JobActivityEventRpcRow } from './jobActivityEventsFromRpc'

/**
 * Single role-aware source for the job activity ledger (Phase 2): the
 * `list_job_activity_events` RPC, which applies financial/operational role
 * gating server-side and resolves actor names. Returns oldest-first (cap 200).
 */
export async function fetchJobActivityEventsForJobLedger(
  jobId: string,
): Promise<{ data: JobActivityEventRpcRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () => await supabase.rpc('list_job_activity_events', { p_job_id: jobId }),
      'fetchJobActivityEventsForJobLedger',
    )
    return { data: (data ?? []) as JobActivityEventRpcRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
