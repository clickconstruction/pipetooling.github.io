/** Earliest approved clock-in and latest approved closed clock-out for a job. */

import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type JobClockSessionBoundsRow = {
  firstClockedInAt: string | null
  firstUserName: string | null
  lastClockedOutAt: string | null
  lastUserName: string | null
}

export type JobClockSessionBoundsResult = {
  data: JobClockSessionBoundsRow
  error: string | null
}

type RawClockSessionBoundsRow = {
  clocked_in_at: string | null
  clocked_out_at: string | null
  users: { name: string | null } | null
}

const SELECT_FIRST = 'clocked_in_at, users!clock_sessions_user_id_fkey(name)'
const SELECT_LAST = 'clocked_out_at, users!clock_sessions_user_id_fkey(name)'

/**
 * Returns the timestamp + user_name of the earliest approved clock-in and the latest
 * approved closed clock-out for the given job ledger row.
 *
 * Uses the same filter as the cached `jobs_ledger.last_work_date` column:
 *   - `approved_at IS NOT NULL` (sessions have been confirmed into payroll-eligible state)
 *   - `rejected_at IS NULL`
 *   - `revoked_at IS NULL`
 * Additionally requires `clocked_out_at IS NOT NULL` for the "last" bound so the displayed
 * end is a truly completed work session (open sessions only contribute a start).
 *
 * Returned timestamps are raw UTC ISO strings; format with
 * {@link formatClockSessionTimestampChicago} for the company wall-clock display.
 */
export async function fetchJobClockSessionBounds(
  jobId: string,
): Promise<JobClockSessionBoundsResult> {
  try {
    const [firstRaw, lastRaw] = await Promise.all([
      withSupabaseRetry(
        async () =>
          await supabase
            .from('clock_sessions')
            .select(SELECT_FIRST)
            .eq('job_ledger_id', jobId)
            .not('approved_at', 'is', null)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .order('clocked_in_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
        'fetchJobClockSessionBounds first',
      ),
      withSupabaseRetry(
        async () =>
          await supabase
            .from('clock_sessions')
            .select(SELECT_LAST)
            .eq('job_ledger_id', jobId)
            .not('approved_at', 'is', null)
            .not('clocked_out_at', 'is', null)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .order('clocked_out_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        'fetchJobClockSessionBounds last',
      ),
    ])

    const first = firstRaw as RawClockSessionBoundsRow | null
    const last = lastRaw as RawClockSessionBoundsRow | null

    return {
      data: {
        firstClockedInAt: first?.clocked_in_at ?? null,
        firstUserName: first?.users?.name ?? null,
        lastClockedOutAt: last?.clocked_out_at ?? null,
        lastUserName: last?.users?.name ?? null,
      },
      error: null,
    }
  } catch (e) {
    return {
      data: {
        firstClockedInAt: null,
        firstUserName: null,
        lastClockedOutAt: null,
        lastUserName: null,
      },
      error: formatErrorMessage(e),
    }
  }
}
