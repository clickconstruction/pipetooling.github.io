import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type RestoreRejectedClockSessionsResult = Array<{
  restored_count: number
  error_message: string | null
}>

/**
 * Clear rejection on clock sessions (return to Pending). Pay access, dev, or team lead for member.
 */
export async function restoreRejectedClockSessions(sessionIds: string[]): Promise<RestoreRejectedClockSessionsResult> {
  const data = await withSupabaseRetry(
    async () =>
      supabase.schema('public').rpc('restore_rejected_clock_sessions', {
        p_session_ids: sessionIds,
      }),
    'restore rejected clock sessions',
  )
  return (data ?? []) as RestoreRejectedClockSessionsResult
}
