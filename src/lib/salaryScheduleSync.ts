import { isImpersonationSessionActive } from './impersonationSession'
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

/**
 * The clock button's own sync, the one no press asks for (on mount, then every 90 s). Held while
 * View as is on: the call would run as the imitated person and write their clock rows from the
 * dev's browser, and the server's own schedule fills those rows every few minutes anyway. The flag
 * is read at each call, so a tick scheduled before an imitation began is held as well. A sync a
 * person presses for (a saved workday, time off, a pay change) is `syncSalaryClockSessionsForUserDay`.
 */
export async function syncSalaryClockSessionsUnasked(
  userId: string,
  io: { viewingAs?: () => boolean; sync?: typeof syncSalaryClockSessionsForUserDay } = {},
  workDateYmd?: string,
): Promise<{ error: string | null; held: boolean }> {
  const viewingAs = io.viewingAs ?? isImpersonationSessionActive
  if (viewingAs()) return { error: null, held: true }
  const sync = io.sync ?? syncSalaryClockSessionsForUserDay
  // Today when no day is named, as the clock button asks; the day editor names the day it opened on.
  const { error } = await (workDateYmd === undefined ? sync(userId) : sync(userId, workDateYmd))
  return { error, held: false }
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
