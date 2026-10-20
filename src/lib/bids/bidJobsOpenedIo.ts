/**
 * The jobs opened from bids (`jobs_ledger.bid_id`), newest first, for every role that works bids. An estimator reads no
 * job row, so the table read alone told them a won bid had no job and offered a second one (BP166 → #878, found on the
 * live walk of punch list #129); `list_bid_jobs_opened` (v2.5659, SECURITY DEFINER, the office and estimators) names
 * them. A primary, whom the function does not serve, keeps the table read its policies give. Both are read and merged,
 * so a role either one answers sees the jobs. Fail-soft: a read that fails adds nothing.
 */
import { supabase } from '../supabase'
import type { BidBoardJobLink } from './bidBoardJobLinks'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type JobOpenedFromBid = BidBoardJobLink & { bidId: string; jobName: string | null; createdAt: string | null }

type Row = { bid_id: string | null; job_id?: string; id?: string; hcp_number: string | null; click_number?: string | null; job_name: string | null; created_at: string | null }

/** Merge both reads: one entry per job, newest first, numbered the way the board numbers it (HCP, else C#). Pure. */
export function mergeJobsOpened(rows: ReadonlyArray<Row>): JobOpenedFromBid[] {
  const byId = new Map<string, JobOpenedFromBid>()
  for (const r of rows) {
    const jobId = r.job_id ?? r.id
    if (!jobId || !r.bid_id || byId.has(jobId)) continue
    byId.set(jobId, { bidId: r.bid_id, jobId, hcpNumber: effectiveJobLedgerNumber(r.hcp_number, r.click_number ?? null), jobName: r.job_name ?? null, createdAt: r.created_at ?? null })
  }
  return [...byId.values()].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function loadJobsOpenedFromBids(bidIds: ReadonlyArray<string>): Promise<JobOpenedFromBid[]> {
  const ids = [...new Set(bidIds.filter(Boolean))]
  if (ids.length === 0) return []
  // Each read answers on its own: one that throws or errors adds nothing, so the other still names the jobs.
  const safe = async (read: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> => {
    try {
      const r = await read()
      return r.error ? [] : ((r.data ?? []) as Row[])
    } catch {
      return []
    }
  }
  const [fn, table] = await Promise.all([
    safe(() => supabase.rpc('list_bid_jobs_opened' as never, { p_bid_ids: ids } as never)),
    safe(() => supabase.from('jobs_ledger').select('id, bid_id, hcp_number, click_number, job_name, created_at').in('bid_id', ids)),
  ])
  return mergeJobsOpened([...fn, ...table])
}
