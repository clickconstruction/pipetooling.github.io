import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Market desk (punch list #192, v2.5931): the reads behind the intake
 * strip and the relationship book, wider than the Bridge's 8-week demand
 * read. The bids opened since 90 days before the span (with their GC and
 * project), the jobs those bids became, every GC's first-ever bid (the
 * new-name read), the GC names, and the estimates over the same span. Read
 * only; nothing new on the server. `marketDesk.ts` shapes them.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { ymdAddDays } from '../../../utils/dateUtils'
import { MARKET_DESK_WEEKS, type MarketDeskBid, type MarketDeskEstimate } from './marketDesk'

/** The read starts this many days before the span: the answered bids behind each GC's answer pace, the way the demand read widens for the awaiting window. */
export const MARKET_READ_LEAD_DAYS = 90

export type MarketDeskReads = {
  bids: MarketDeskBid[]
  estimates: MarketDeskEstimate[]
  gcNames: ReadonlyMap<string, string>
  firstBidYmdByGc: ReadonlyMap<string, string>
}

type BidRow = { id: string; created_at: string | null; bid_date_sent: string | null; bid_value: number | null; agreed_value: number | null; outcome: string | null; outcome_at: string | null; gc_builder_id: string | null; project_name: string | null }
type JobRow = { id: string; bid_id: string | null; created_at: string | null; revenue: number | null; billing_only: boolean | null }
type FirstBidRow = { gc_builder_id: string | null; created_at: string | null }
type GcRow = { id: string; name: string }
type EstimateRow = { id: string; created_at: string; sent_at: string | null; status: string; total_cents: number | null; acceptor_consented_at: string | null; updated_at: string | null; doc_kind: string | null }

const ymdOf = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)

export async function loadMarketDeskReads(db: SupabaseClient<Database>, opts: { todayYmd: string }): Promise<MarketDeskReads> {
  const sinceYmd = ymdAddDays(opts.todayYmd, -(MARKET_DESK_WEEKS * 7 + MARKET_READ_LEAD_DAYS))
  const sinceIso = `${sinceYmd}T00:00:00Z`
  const [bidRows, firstRows, gcRows, estimateRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('bids').select('id, created_at, bid_date_sent, bid_value, agreed_value, outcome, outcome_at, gc_builder_id, project_name').gte('created_at', sinceIso).order('id').range(from, to), 'market desk bids')) as BidRow[] | null,
        error: null,
      }),
      'market desk bids',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('bids').select('gc_builder_id, created_at').not('gc_builder_id', 'is', null).order('gc_builder_id').order('created_at').order('id').range(from, to), 'market desk first bids')) as FirstBidRow[] | null,
        error: null,
      }),
      'market desk first bids',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('bids_gc_builders').select('id, name').order('id').range(from, to), 'market desk gc names')) as GcRow[] | null,
        error: null,
      }),
      'market desk gc names',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('estimates').select('id, created_at, sent_at, status, total_cents, acceptor_consented_at, updated_at, doc_kind').gte('created_at', sinceIso).order('id').range(from, to), 'market desk estimates')) as EstimateRow[] | null,
        error: null,
      }),
      'market desk estimates',
    ),
  ])
  const ids = bidRows.map((r) => r.id)
  const jobs = ids.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        ids,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, bid_id, created_at, revenue, billing_only').in('bid_id', chunk).order('id').range(from, to), 'market desk jobs from bids')) as JobRow[] | null, error: null }),
        'market desk jobs from bids',
      )
    : []
  const jobByBid = new Map<string, JobRow>()
  for (const j of jobs) if (j.bid_id && !j.billing_only && !jobByBid.has(j.bid_id)) jobByBid.set(j.bid_id, j)

  const bids: MarketDeskBid[] = bidRows.map((r) => ({
    id: r.id,
    createdYmd: ymdOf(r.created_at),
    sentYmd: r.bid_date_sent ? r.bid_date_sent.slice(0, 10) : null,
    usd: Number(r.agreed_value ?? r.bid_value ?? 0),
    outcome: r.outcome,
    outcomeYmd: ymdOf(r.outcome_at),
    jobCreatedYmd: jobByBid.has(r.id) ? ymdOf((jobByBid.get(r.id) as JobRow).created_at) : null,
    gcId: r.gc_builder_id,
    projectName: r.project_name,
  }))
  const firstBidYmdByGc = new Map<string, string>()
  for (const r of firstRows) {
    const ymd = ymdOf(r.created_at)
    if (!r.gc_builder_id || !ymd) continue
    const have = firstBidYmdByGc.get(r.gc_builder_id)
    if (!have || ymd < have) firstBidYmdByGc.set(r.gc_builder_id, ymd)
  }
  const gcNames = new Map<string, string>()
  for (const g of gcRows) gcNames.set(g.id, g.name)
  const estimates: MarketDeskEstimate[] = estimateRows
    .filter((e) => !e.doc_kind || e.doc_kind === 'estimate')
    .map((e) => ({ id: e.id, createdYmd: e.created_at.slice(0, 10), sentYmd: ymdOf(e.sent_at), status: e.status, usd: (e.total_cents ?? 0) / 100, acceptedYmd: ymdOf(e.acceptor_consented_at), updatedYmd: ymdOf(e.updated_at) }))
  return { bids, estimates, gcNames, firstBidYmdByGc }
}
