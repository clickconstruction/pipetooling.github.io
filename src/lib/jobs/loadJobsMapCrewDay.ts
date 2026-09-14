/**
 * One day's clock sessions for the Pipeline map's crew layer (v2.3399):
 * who clocked in on which job on `ymd` (revoked and rejected sessions left
 * out). A day is a few dozen rows; paged anyway, cached per day for the
 * session. Runs under the caller's RLS.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { fetchAllRows } from '../supabasePaging'
import { summarizeCrewSessions, type JobsMapCrewDay, type JobsMapCrewSessionRow } from './jobsMapCrewDay'

const cache = new Map<string, Promise<JobsMapCrewDay>>()

export function resetJobsMapCrewDayCacheForTests(): void {
  cache.clear()
}

export function loadJobsMapCrewDay(ymd: string): Promise<JobsMapCrewDay> {
  const hit = cache.get(ymd)
  if (hit) return hit
  const promise = fetchAllRows<JobsMapCrewSessionRow>(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .select('user_id, job_ledger_id')
            .eq('work_date', ymd)
            .not('job_ledger_id', 'is', null)
            .is('revoked_at', null)
            .is('rejected_at', null)
            .order('id')
            .range(from, to) as PromiseLike<SupabaseClientResult<JobsMapCrewSessionRow[]>>,
        'jobs map crew day',
      )) as unknown as JobsMapCrewSessionRow[] | null,
      error: null,
    }),
    'jobs map crew day',
  )
    .then((rows) => summarizeCrewSessions(ymd, rows))
    .catch((e: unknown) => {
      if (cache.get(ymd) === promise) cache.delete(ymd)
      throw e
    })
  cache.set(ymd, promise)
  return promise
}
