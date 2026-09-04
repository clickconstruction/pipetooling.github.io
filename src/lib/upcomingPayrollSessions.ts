import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { fetchAllRowsChunkedIn } from './supabasePaging'
import type { UpcomingClockSessionRow } from './upcomingPayrollSummary'

/**
 * The upcoming-payroll clock-session read, paged (v2.2759).
 *
 * The Dashboard AP card, the People → Pay stubs header, and the Employment
 * tab's pay totals all estimate unpaid payroll from every roster member's
 * sessions since `upcomingPayrollFetchStartYmd` — a window that walks back to
 * the oldest unpaid stub. Once that window covered four months of one roster
 * the un-limited read crossed PostgREST's 1,000-row cap and the estimate was
 * silently understated; the v2.2756 tripwire flagged `[row-cap] clock_sessions`
 * on every Dashboard load. Roster ids go in 150-id `.in()` chunks and every
 * chunk pages with a stable `work_date, id` order. Throws on a page error —
 * callers keep their existing "no estimate" fallback.
 */
export async function loadUpcomingClockSessions(
  supabase: SupabaseClient<Database>,
  userIds: string[],
  fromYmd: string,
): Promise<UpcomingClockSessionRow[]> {
  return fetchAllRowsChunkedIn<UpcomingClockSessionRow, string>(
    userIds,
    (chunk, from, to) =>
      supabase
        .from('clock_sessions')
        .select('user_id, work_date, clocked_in_at, clocked_out_at')
        .in('user_id', chunk)
        .gte('work_date', fromYmd)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .order('work_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: UpcomingClockSessionRow[] | null; error: { message: string } | null }>,
    'load upcoming payroll clock sessions',
  )
}
