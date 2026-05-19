/**
 * Chunked fetch for approved `clock_sessions` rows tied to a list of `jobs_ledger` IDs.
 * Used by Projects → Job History Gantt to build per-job bar bounds + per-day distinct-user counts.
 *
 * Filters mirror `jobs_ledger.last_work_date` semantics:
 *   - `approved_at IS NOT NULL`
 *   - `rejected_at IS NULL`
 *   - `revoked_at IS NULL`
 * Date range is **not** filtered server-side — working jobs are short-lived enough that loading
 * their full session history is cheap, and we need full first/last bounds regardless of the
 * user's selected viewport.
 */

import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { ProjectsJobHistoryClockRow } from './projectsJobHistoryData'

const SELECT_COLUMNS = 'job_ledger_id, user_id, work_date, clocked_out_at'
const JOB_IDS_IN_CHUNK = 100

export type FetchProjectsJobHistoryClockSessionsResult =
  | { ok: true; rows: ProjectsJobHistoryClockRow[] }
  | { ok: false; error: string }

export async function fetchProjectsJobHistoryClockSessions(
  jobIds: readonly string[],
): Promise<FetchProjectsJobHistoryClockSessionsResult> {
  const ids = jobIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) return { ok: true, rows: [] }

  const out: ProjectsJobHistoryClockRow[] = []
  try {
    for (let i = 0; i < ids.length; i += JOB_IDS_IN_CHUNK) {
      const chunk = ids.slice(i, i + JOB_IDS_IN_CHUNK)
      const data = (await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select(SELECT_COLUMNS)
            .in('job_ledger_id', chunk)
            .not('approved_at', 'is', null)
            .is('rejected_at', null)
            .is('revoked_at', null),
        'fetch clock_sessions for projects job schedule',
      )) as unknown as ProjectsJobHistoryClockRow[] | null
      if (data && data.length > 0) out.push(...data)
    }
    return { ok: true, rows: out }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Failed to load clock sessions') }
  }
}
