import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

const JOB_DETAIL_CLOCK_SESSION_SELECT =
  'id, user_id, clocked_in_at, clocked_out_at, work_date, notes, approved_at, rejected_at, users!clock_sessions_user_id_fkey(name)'

export type JobDetailClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  work_date: string | null
  notes: string | null
  approved_at: string | null
  rejected_at: string | null
  users: { name: string | null } | null
}

/** Non-revoked clock sessions for a job ledger row (newest-first cap 101 for truncation detection). */
export async function fetchClockSessionsForJobLedger(
  jobId: string,
): Promise<{ data: JobDetailClockSessionRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('clock_sessions')
          .select(JOB_DETAIL_CLOCK_SESSION_SELECT)
          .eq('job_ledger_id', jobId)
          .is('revoked_at', null)
          .order('clocked_in_at', { ascending: true })
          .limit(101),
      'fetchClockSessionsForJobLedger',
    )
    return { data: (data ?? []) as JobDetailClockSessionRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}
