// Punch list #61 (v2.5116, shared since v2.5120): every ZZ test job the caller can see, any status and any
// customer, read once and shared. A screen whose rows carry no names (an RPC's job ids, a lean read)
// drops ZZ jobs by these ids, and the Pipeline strip uses them for the paid ZZ jobs its active read never
// ships. The server pattern takes a name that starts with ZZ, or one character and then ZZ (a name with a
// leading space; `_` is LIKE's one-character wildcard), and the kernel re-checks every row (`isZzTestName`
// trims). So a leading-space name is caught on both sides without paging every Pizza and Jazz (review on
// #5241); a name with two leading spaces is caught where a screen reads names, not by this read. The sweep
// keeps its own strict filter (`ZZ_TEST_JOBS_OR_FILTER`), so its counts do not move.

import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isZzTestJob } from './zzTestJobSweep'

/** The server's half: ZZ at the start, or after one character. The kernel drops the few false hits (Izzy). */
export const ZZ_TEST_JOBS_LOOSE_OR_FILTER = 'job_name.ilike.zz*,job_name.ilike._zz*,customer_name.ilike.zz*,customer_name.ilike._zz*'
export const ZZ_TEST_JOB_ROWS_SELECT = 'id, status, job_name, customer_name, customer_id'

export type ZzTestJobRow = {
  id: string
  status: string | null
  job_name: string | null
  customer_name: string | null
  customer_id: string | null
}

/** The read itself, every time (the Pipeline strip's stats carry their own 60-second freshness). */
export async function fetchZzTestJobRows(): Promise<ZzTestJobRow[]> {
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger')
            .select(ZZ_TEST_JOB_ROWS_SELECT)
            .or(ZZ_TEST_JOBS_LOOSE_OR_FILTER)
            .order('id')
            .range(from, to),
        'zz test jobs',
      )) as unknown as ZzTestJobRow[] | null,
      error: null,
    }),
    'zz test jobs',
  )
  return (rows ?? []).filter(isZzTestJob)
}

/** How long the shared answer stands. A ZZ job made in that window can show on the Dashboard until it lapses. */
export const ZZ_TEST_JOB_ROWS_TTL_MS = 60_000

/**
 * One answer per signed-in user. RLS scopes the read, so the answer read as a sample assistant (View as)
 * is not the dev's after Exit, and nobody's after sign-out (review on #5241).
 */
let cached: { at: number; userId: string; rows: Promise<ZzTestJobRow[]> } | null = null

/** The shared answer for the Dashboard's readers: one read per minute per user, however many cards ask. */
export function loadZzTestJobRows(userId: string | null | undefined, now = Date.now()): Promise<ZzTestJobRow[]> {
  const key = userId ?? ''
  if (cached && cached.userId === key && now - cached.at < ZZ_TEST_JOB_ROWS_TTL_MS) return cached.rows
  const rows = fetchZzTestJobRows()
  const entry = { at: now, userId: key, rows }
  cached = entry
  rows.catch(() => {
    if (cached === entry) cached = null
  })
  return rows
}

/** Forget the shared answer, so the next reader reads again. The sweep calls it after it moves jobs. */
export function invalidateZzTestJobRows(): void {
  cached = null
}

/** The ids, for a screen that drops rows by id. */
export async function loadZzTestJobIds(userId: string | null | undefined, now = Date.now()): Promise<Set<string>> {
  return new Set((await loadZzTestJobRows(userId, now)).map((r) => r.id))
}
