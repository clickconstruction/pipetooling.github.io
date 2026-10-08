/**
 * Reject one clock session and take an approved session's hours back out of payroll.
 *
 * `reject_clock_session` (migration 20261009170000, v2.4964) writes the reject under the caller's
 * RLS and resyncs `people_hours` in one transaction, so a refused resync undoes the reject. Until
 * that migration is pushed the database has no such function; then this falls back to the two
 * requests the My Time day editor always made — the UPDATE, then
 * `recompute_people_hours_after_session_edit` — which can still leave a rejected row counted when
 * the second one fails.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** How the reject went out: one call, or the old two requests while the function is missing. */
export type RejectClockSessionPath = 'one transaction' | 'two requests'

/** PostgREST's answer for a function the database does not have yet. */
export function isMissingRejectFunction(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown; serverMessage?: unknown }
  if (e.code === 'PGRST202' || e.code === '42883') return true
  return /could not find the function/i.test(String(e.serverMessage ?? e.message ?? ''))
}

export async function rejectClockSession(sessionId: string, rejectedBy: string | null): Promise<RejectClockSessionPath> {
  try {
    await withSupabaseRetry(
      async () => supabase.rpc('reject_clock_session' as never, { p_session_id: sessionId } as never),
      'reject clock session',
    )
    return 'one transaction'
  } catch (e: unknown) {
    if (!isMissingRejectFunction(e)) throw e
  }

  await withSupabaseRetry(
    async () =>
      supabase
        .from('clock_sessions')
        .update({
          rejected_at: new Date().toISOString(),
          rejected_by: rejectedBy,
        })
        .eq('id', sessionId),
    'reject clock session from my time day editor',
  )
  // people_hours is maintained incrementally (approve +duration / reject -duration); a raw
  // rejected_at update bypasses that, freezing the day's payroll hours. Resync from the
  // remaining approved sessions server-side — the same RPC the Adjust-times save path uses.
  await withSupabaseRetry(
    async () => supabase.rpc('recompute_people_hours_after_session_edit', { p_session_id: sessionId }),
    'recompute people_hours after reject',
  )
  return 'two requests'
}
