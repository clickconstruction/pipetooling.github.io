import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../supabasePaging'
import type { JobHoursSession } from './jobHours'

/**
 * The read behind `jobHours.ts` (punch list #334, PR 10): every closed clock session on the jobs named, with whose it is.
 * The same sessions `loadEarnedJobs` sums for a job's lifetime hours, plus the ones still waiting on approval, which
 * the kernel keeps apart. Rejected and revoked sessions are left out, as there.
 */

type Row = { user_id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; job_ledger_id: string | null; approved_at: string | null }

const hoursOf = (inIso: string, outIso: string | null): number => {
  if (!outIso) return 0
  const h = (Date.parse(outIso) - Date.parse(inIso)) / 3_600_000
  return Number.isFinite(h) && h > 0 ? h : 0
}

export async function loadJobHours(db: SupabaseClient<Database>, jobIds: ReadonlyArray<string>, names: ReadonlyMap<string, string>): Promise<JobHoursSession[]> {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return []
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () => db.from('clock_sessions').select('user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, approved_at').in('job_ledger_id', ids).is('rejected_at', null).is('revoked_at', null).not('clocked_out_at', 'is', null).order('id').range(from, to),
        'bridge job hours',
      )) as Row[] | null,
      error: null,
    }),
    'bridge job hours',
  )
  // Names: the page's own list first, then one read for anyone it does not hold (a sub, an archived account).
  const known = new Map(names)
  const wanted = [...new Set(rows.map((r) => r.user_id).filter((id) => !known.has(id)))]
  if (wanted.length > 0) {
    const users = (await withSupabaseRetry(async () => db.from('users').select('id, name').in('id', wanted), 'bridge job hours names')) as Array<{ id: string; name: string | null }> | null
    for (const u of users ?? []) if (u.name) known.set(u.id, u.name)
  }
  return rows
    .filter((r) => r.job_ledger_id)
    .map((r) => ({ jobId: r.job_ledger_id as string, userId: r.user_id, name: known.get(r.user_id) ?? 'Someone', ymd: r.work_date, hours: hoursOf(r.clocked_in_at, r.clocked_out_at), approved: r.approved_at != null }))
}
