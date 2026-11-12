import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import type { BidSent } from './bidWins'
import { isLeftOut, type LeftOutRule } from './leftOut'
import { withoutZzBridgeBids, type BridgeZzTestJobIds } from './zzTestJobs'

/**
 * The read behind the bids' won coefficient (punch list #318): every bid ever sent, with its send
 * day, its outcome and its dollars, and the jobs made from those bids. All of them, not the page's window: the
 * coefficient needs the ones old enough to have an answer. A ZZ bid is left out for the viewer who leaves ZZ test
 * jobs out, as on Market and Sales (`withoutZzBridgeBids`). A bid on something the Bridge leaves out (`leftOut.ts`) is flagged, and the kernel leaves it out.
 */

type BidRow = { id: string; project_name: string | null; bid_date_sent: string | null; bid_value: number | null; agreed_value: number | null; outcome: string | null; development_id: string | null; customer_id: string | null; address: string | null }
type JobRow = { id: string; bid_id: string | null; revenue: number | null }

export async function loadBidsSent(db: SupabaseClient<Database>, opts: { zzTestJobIds: BridgeZzTestJobIds; leftOut: ReadonlyArray<LeftOutRule> }): Promise<BidSent[]> {
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('bids').select('id, project_name, bid_date_sent, bid_value, agreed_value, outcome, development_id, customer_id, address').not('bid_date_sent', 'is', null).order('id').range(from, to), 'bridge bids sent')) as BidRow[] | null,
      error: null,
    }),
    'bridge bids sent',
  )
  const bids = withoutZzBridgeBids(rows, opts.zzTestJobIds)
  const ids = bids.map((b) => b.id)
  const jobs = ids.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        ids,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, bid_id, revenue').in('bid_id', chunk).order('id').range(from, to), 'bridge bids sent jobs')) as JobRow[] | null, error: null }),
        'bridge bids sent jobs',
      )
    : []
  const jobUsdByBid = new Map<string, number>()
  for (const j of jobs) if (j.bid_id) jobUsdByBid.set(j.bid_id, (jobUsdByBid.get(j.bid_id) ?? 0) + Number(j.revenue ?? 0))
  const out: BidSent[] = []
  for (const b of bids) {
    const sentYmd = b.bid_date_sent ? b.bid_date_sent.slice(0, 10) : ''
    if (!sentYmd) continue
    out.push({ sentYmd, outcome: b.outcome, usd: Number(b.agreed_value ?? b.bid_value ?? 0), hasJob: jobUsdByBid.has(b.id), jobUsd: jobUsdByBid.get(b.id) ?? null, leftOut: isLeftOut({ developmentId: b.development_id, customerId: b.customer_id, address: b.address }, opts.leftOut) })
  }
  return out
}
