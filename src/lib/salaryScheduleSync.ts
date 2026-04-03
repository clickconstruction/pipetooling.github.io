import { supabase } from './supabase'
import { denverCalendarDayKey } from '../utils/dateUtils'
import {
  DatabaseError,
  formatErrorMessage,
  withRetry,
  withSupabaseRetry,
} from '../utils/errorHandling'

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

/** Remove salary work schedule data and refresh sync so hourly pay config matches the clock strip. */
export async function removeSalaryScheduleForUser(userId: string): Promise<{ error: string | null }> {
  try {
    await withRetry(async () => {
      const r = await supabase.from('salary_work_schedule_templates').delete().eq('user_id', userId)
      if (r.error) throw new DatabaseError(r.error.message)
      return r
    })
    await withRetry(async () => {
      const r = await supabase.from('salary_work_schedule_day_overrides').delete().eq('user_id', userId)
      if (r.error) throw new DatabaseError(r.error.message)
      return r
    })
    return syncSalaryClockSessionsForUserDay(userId, denverWorkDateToday())
  } catch (e) {
    return { error: formatErrorMessage(e, 'Failed to remove salary work schedule') }
  }
}
