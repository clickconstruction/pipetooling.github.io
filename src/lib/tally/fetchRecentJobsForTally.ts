/**
 * The marks behind Recent on the Choose job sheet (punch list #216): the viewer's own clock-ins
 * (`clock_sessions`, not rejected or revoked, the read the Sort screen makes), and when they have
 * none, the jobs their card's newest purchases were sorted to (the Transactions tab's own RPC).
 * The pure order is `recentJobs.ts`; a failed read comes back as a `{ kind, message }` failure
 * the sheet draws on `OfflineRetryPanel`.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../offlineRecoveryState'
import { tallyUniqueJobSplitEntries, type TallyLinkedMercuryRow } from '../mercuryTxRowFromTally'
import { mercurySwipeDayYmd } from '../mercurySwipeTime'
import { ymdFromDateLike } from '../../utils/dateUtils'
import { TALLY_LINKED_ROWS_RPC } from './fetchTallyLinkedMercuryRows'
import { orderRecentJobs, type RecentJobMark } from './recentJobs'

/** Newest clock-ins read: ten distinct jobs need at most this many sessions in practice. */
export const RECENT_CLOCK_SESSIONS_READ = 60
/** Newest purchases read when there are no clock-ins. */
export const RECENT_PURCHASES_READ = 200

export type RecentSessionRow = { work_date: string; job_ledger_id: string | null; clocked_in_at: string }

export function marksFromSessions(rows: readonly RecentSessionRow[]): RecentJobMark[] {
  return rows
    .filter((r) => r.job_ledger_id)
    .map((r) => ({ jobId: r.job_ledger_id as string, ymd: r.work_date, at: r.clocked_in_at || r.work_date, source: 'clock' as const }))
}

export function marksFromPurchases(rows: readonly Pick<TallyLinkedMercuryRow, 'job_splits' | 'raw' | 'posted_at'>[]): RecentJobMark[] {
  const out: RecentJobMark[] = []
  for (const r of rows) {
    const splits = tallyUniqueJobSplitEntries(r.job_splits)
    if (splits.length === 0) continue
    const ymd = mercurySwipeDayYmd(r.raw, r.posted_at) || ymdFromDateLike(r.posted_at)
    for (const s of splits) out.push({ jobId: s.jobId, ymd, at: r.posted_at ?? ymd, source: 'purchase' })
  }
  return out
}

export type RecentJobsRead = { marks: RecentJobMark[]; failure: OfflineRecoveryLastError | null }

export async function fetchRecentJobMarks(userId: string): Promise<RecentJobsRead> {
  try {
    const sessions = (await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('work_date, job_ledger_id, clocked_in_at')
          .eq('user_id', userId)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('job_ledger_id', 'is', null)
          .order('clocked_in_at', { ascending: false })
          .limit(RECENT_CLOCK_SESSIONS_READ),
      'recent jobs clock_sessions',
    )) as RecentSessionRow[] | null
    const clock = orderRecentJobs(marksFromSessions(sessions ?? []))
    if (clock.length > 0) return { marks: clock, failure: null }
    const purchases = (await withSupabaseRetry(
      async () => supabase.rpc(TALLY_LINKED_ROWS_RPC).range(0, RECENT_PURCHASES_READ - 1),
      'recent jobs purchases',
    )) as TallyLinkedMercuryRow[] | null
    return { marks: orderRecentJobs(marksFromPurchases(purchases ?? [])), failure: null }
  } catch (e) {
    return { marks: [], failure: recoveryFailureFromError(e, 'Your recent jobs did not load.') }
  }
}
