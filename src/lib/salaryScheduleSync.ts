import { supabase } from './supabase'
import { denverCalendarDayKey } from '../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** YYYY-MM-DD for `work_date` using company calendar (America/Chicago). */
export function denverWorkDateToday(): string {
  return denverCalendarDayKey(Date.now())
}

/** Refresh auto-materialized salary clock_sessions for one user (RLS: self or pay staff). */
export async function syncSalaryClockSessionsForUserDay(
  userId: string,
  workDateYmd?: string,
): Promise<{ error: string | null }> {
  const d = workDateYmd ?? denverWorkDateToday()
  try {
    await withSupabaseRetry(
      async () =>
        supabase.rpc('sync_salary_clock_sessions_for_user_day', {
          p_user_id: userId,
          p_work_date: d,
        }),
      'sync_salary_clock_sessions_for_user_day',
    )
    return { error: null }
  } catch (e) {
    return { error: formatErrorMessage(e, 'Sync failed') }
  }
}
