/**
 * The ZZ test jobs read itself (punch list #61, v2.5116), with the client passed in, so a read on the edge can make
 * it as the service role (the Bridge's weekly sheet, v2.5880). `zzTestJobRows.ts` binds the app's client and keeps
 * the per-user cache; nothing else imports this file directly. The server pattern takes a name that starts with ZZ,
 * or one character and then ZZ (a name with a leading space; `_` is LIKE's one-character wildcard), and the kernel
 * re-checks every row (`isZzTestName` trims).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
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

/** Every ZZ test job the client can see, any status and any customer. */
export async function readZzTestJobRows(db: SupabaseClient<Database>): Promise<ZzTestJobRow[]> {
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          db
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
