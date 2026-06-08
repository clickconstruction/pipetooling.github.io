import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const SELECT =
  'id, from_status, to_status, changed_at, changed_by_user_id, users!job_status_events_changed_by_user_id_fkey(name)'

export type JobStatusEventRow = {
  id: string
  from_status: string | null
  to_status: string | null
  changed_at: string | null
  changed_by_user_id: string | null
  users: { name: string | null } | null
}

/** Status-transition audit rows for a job ledger row (oldest-first, cap 101). */
export async function fetchJobStatusEventsForJobLedger(
  jobId: string,
): Promise<{ data: JobStatusEventRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_status_events')
          .select(SELECT)
          .eq('job_id', jobId)
          .order('changed_at', { ascending: true })
          .limit(101),
      'fetchJobStatusEventsForJobLedger',
    )
    return { data: (data ?? []) as JobStatusEventRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
