import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Market desk (punch list #192, v2.5931): the reads behind the intake
 * strip and the relationship book, wider than the Bridge's 8-week demand
 * read. The bids opened since 90 days before the span (with their asker and
 * project), the jobs those bids became, every asker's first-ever bid and its
 * bids on record by outcome (the new-name and never-answered reads), the
 * askers' names, and the estimates over the same span. Read only; nothing
 * new on the server. `marketDesk.ts` shapes them.
 *
 * The asker is the bid's customer: the bid form stores the GC as the bid's
 * customer and leaves gc_builder_id null (`bidFormPayload.ts`), so every bids
 * read carries customer_id and keys by `marketAskerId` (customer_id, else
 * gc_builder_id). Names come from `customers` for the customer ids seen and
 * from `bids_gc_builders` for the rest, merged into the one map.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { ymdAddDays } from '../../../utils/dateUtils'
import { MARKET_DESK_WEEKS, foldMarketRecord, marketAskerId, type MarketDeskBid, type MarketDeskEstimate, type MarketLifetime } from './marketDesk'

/** The read starts this many days before the span: the answered bids behind each GC's answer pace, the way the demand read widens for the awaiting window. */
export const MARKET_READ_LEAD_DAYS = 90

export type MarketDeskReads = {
  bids: MarketDeskBid[]
  estimates: MarketDeskEstimate[]
  /** Names by asker id: the customers' names for the bids' customer ids, the GC list's for the rest, in one map. */
  gcNames: ReadonlyMap<string, string>
  /** Every asker's first-ever bid day, keyed by `marketAskerId`. */
  firstBidYmdByGc: ReadonlyMap<string, string>
  /** Every asker's bids on record, answered and won by the bid's own outcome. No job rows here, so a bid that became a job without the won mark stays unanswered. */
  lifetimeByGc: ReadonlyMap<string, MarketLifetime>
}

type BidRow = { id: string; created_at: string | null; bid_date_sent: string | null; bid_value: number | null; agreed_value: number | null; outcome: string | null; outcome_at: string | null; customer_id: string | null; gc_builder_id: string | null; project_name: string | null }
type JobRow = { id: string; bid_id: string | null; created_at: string | null; revenue: number | null; billing_only: boolean | null }
type FirstBidRow = { customer_id: string | null; gc_builder_id: string | null; created_at: string | null; outcome: string | null }
type GcRow = { id: string; name: string }
type CustomerRow = { id: string; name: string }
type EstimateRow = { id: string; created_at: string; sent_at: string | null; status: string; total_cents: number | null; acceptor_consented_at: string | null; updated_at: string | null; doc_kind: string | null }

const ymdOf = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)

export async function loadMarketDeskReads(db: SupabaseClient<Database>, opts: { todayYmd: string }): Promise<MarketDeskReads> {
  const sinceYmd = ymdAddDays(opts.todayYmd, -(MARKET_DESK_WEEKS * 7 + MARKET_READ_LEAD_DAYS))
  const sinceIso = `${sinceYmd}T00:00:00Z`
  const [bidRows, firstRows, gcRows, estimateRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('bids').select('id, created_at, bid_date_sent, bid_value, agreed_value, outcome, outcome_at, customer_id, gc_builder_id, project_name').gte('created_at', sinceIso).order('id').range(from, to), 'market desk bids')) as BidRow[] | null,
        error: null,
      }),
      'market desk bids',
    ),
    fetchAllRows(
      async (from, to) => ({
        // Every bid on record with an asker: a customer (the bid form's GC) or, failing that, a GC-list id.
        data: (await withSupabaseRetry(async () => db.from('bids').select('customer_id, gc_builder_id, created_at, outcome').or('customer_id.not.is.null,gc_builder_id.not.is.null').order('id').range(from, to), 'market desk first bids')) as FirstBidRow[] | null,
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
  // The customers' names, for every customer id a bid names: the bid form stores the GC there.
  const customerIds = new Set<string>()
  for (const r of bidRows) if (r.customer_id) customerIds.add(r.customer_id)
  for (const r of firstRows) if (r.customer_id) customerIds.add(r.customer_id)
  const customerRows = customerIds.size
    ? await fetchAllRowsChunkedIn<CustomerRow, string>(
        [...customerIds],
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('customers').select('id, name').in('id', chunk).order('id').range(from, to), 'market desk customer names')) as CustomerRow[] | null, error: null }),
        'market desk customer names',
      )
    : []

  const bids: MarketDeskBid[] = bidRows.map((r) => ({
    id: r.id,
    createdYmd: ymdOf(r.created_at),
    sentYmd: r.bid_date_sent ? r.bid_date_sent.slice(0, 10) : null,
    usd: Number(r.agreed_value ?? r.bid_value ?? 0),
    outcome: r.outcome,
    outcomeYmd: ymdOf(r.outcome_at),
    jobCreatedYmd: jobByBid.has(r.id) ? ymdOf((jobByBid.get(r.id) as JobRow).created_at) : null,
    gcId: marketAskerId({ customerId: r.customer_id, gcBuilderId: r.gc_builder_id }),
    projectName: r.project_name,
  }))
  // The first-bid and lifetime reads fold by the same key as the book, so new name and never answered read per customer.
  const { firstBidYmdByGc, lifetimeByGc } = foldMarketRecord(firstRows.map((r) => ({ customerId: r.customer_id, gcBuilderId: r.gc_builder_id, createdYmd: ymdOf(r.created_at), outcome: r.outcome })))
  const gcNames = new Map<string, string>()
  for (const g of gcRows) gcNames.set(g.id, g.name)
  for (const c of customerRows) gcNames.set(c.id, c.name)
  const estimates: MarketDeskEstimate[] = estimateRows
    .filter((e) => !e.doc_kind || e.doc_kind === 'estimate')
    .map((e) => ({ id: e.id, createdYmd: e.created_at.slice(0, 10), sentYmd: ymdOf(e.sent_at), status: e.status, usd: (e.total_cents ?? 0) / 100, acceptedYmd: ymdOf(e.acceptor_consented_at), updatedYmd: ymdOf(e.updated_at) }))
  return { bids, estimates, gcNames, firstBidYmdByGc, lifetimeByGc }
}
