/**
 * Reject one clock session and take an approved session's hours back out of payroll.
 *
 * `reject_clock_session` (migration 20261009170000, v2.4964) writes the reject under the caller's
 * RLS, with the caller as `rejected_by`, and resyncs `people_hours` in one transaction, so a
 * refused resync undoes the reject. Any refusal is the caller's error. The two-request fallback
 * that covered the time before the push went in v2.4973.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export async function rejectClockSession(sessionId: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.rpc('reject_clock_session', { p_session_id: sessionId }),
    'reject clock session',
  )
}
