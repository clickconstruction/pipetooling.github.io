import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Sales desk (punch list #192, v2.5932): the reads the Bridge does not
 * already make, lazy on the desk's first open. The open bids (sent, not
 * decided, not yet a job, every age so the ones past the awaiting window can
 * be counted apart), the decided bids of the last `SALES_DECIDED_DAYS` for
 * the per-asker win rates and answer paces and the funnel, the GC names, and
 * the estimates sent inside the awaiting window. Read-only; nothing new on
 * the server. `salesDesk.ts` does the arithmetic and the words.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { ymdAddDays } from '../../../utils/dateUtils'
import { AWAITING_DAYS } from '../demandPace'
import { SALES_DECIDED_DAYS, type SalesDecidedBid, type SalesOpenBid, type SalesOpenEstimate } from './salesDesk'

export type SalesDeskReads = {
  openBids: SalesOpenBid[]
  decidedBids: SalesDecidedBid[]
  gcNames: ReadonlyMap<string, string>
  openEstimates: SalesOpenEstimate[]
}

type OpenBidRow = { id: string; bid_number: string | null; project_name: string | null; gc_builder_id: string | null; customer_id: string | null; bid_value: number | null; agreed_value: number | null; bid_date_sent: string | null; created_at: string | null; next_followup_on: string | null; next_followup_reason: string | null; last_contact: string | null; outcome: string | null }
type DecidedBidRow = { id: string; gc_builder_id: string | null; bid_value: number | null; agreed_value: number | null; bid_date_sent: string | null; outcome: string | null; outcome_at: string | null; loss_category: string | null; loss_reason: string | null }
type JobRow = { id: string; bid_id: string | null; created_at: string | null; billing_only: boolean | null }
type GcRow = { id: string; name: string }
type EstimateRow = { id: string; title: string; sent_at: string | null; total_cents: number | null; doc_kind: string | null; customer_id: string | null }

const OPEN_SELECT = 'id, bid_number, project_name, gc_builder_id, customer_id, bid_value, agreed_value, bid_date_sent, created_at, next_followup_on, next_followup_reason, last_contact, outcome'
const DECIDED_SELECT = 'id, gc_builder_id, bid_value, agreed_value, bid_date_sent, outcome, outcome_at, loss_category, loss_reason'
/** A bid with one of these outcomes is decided; anything else, or none, is open. */
const DECIDED_OUTCOMES = '(won,lost,started_or_complete)'

const ymdOf = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)
const usdOf = (r: { agreed_value: number | null; bid_value: number | null }): number => Number(r.agreed_value ?? r.bid_value ?? 0)

export async function loadSalesDeskReads(db: SupabaseClient<Database>, opts: { todayYmd: string }): Promise<SalesDeskReads> {
  const decidedSinceIso = `${ymdAddDays(opts.todayYmd, -SALES_DECIDED_DAYS)}T00:00:00Z`
  const awaitingSinceIso = `${ymdAddDays(opts.todayYmd, -AWAITING_DAYS)}T00:00:00Z`
  // Two reads make the open set exactly: an outcome of null, and an outcome outside the decided three (NOT IN drops nulls).
  const [openNull, openOther, decidedRows, estimateRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(OPEN_SELECT).not('bid_date_sent', 'is', null).is('outcome', null).order('id').range(from, to), 'sales desk open bids')) as OpenBidRow[] | null, error: null }),
      'sales desk open bids',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(OPEN_SELECT).not('bid_date_sent', 'is', null).not('outcome', 'in', DECIDED_OUTCOMES).order('id').range(from, to), 'sales desk open bids by outcome')) as OpenBidRow[] | null, error: null }),
      'sales desk open bids by outcome',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(DECIDED_SELECT).in('outcome', ['won', 'lost']).gte('outcome_at', decidedSinceIso).order('id').range(from, to), 'sales desk decided bids')) as DecidedBidRow[] | null, error: null }),
      'sales desk decided bids',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('estimates').select('id, title, sent_at, total_cents, doc_kind, customer_id').eq('status', 'sent').gte('sent_at', awaitingSinceIso).order('id').range(from, to), 'sales desk open estimates')) as EstimateRow[] | null, error: null }),
      'sales desk open estimates',
    ),
  ])
  const openById = new Map<string, OpenBidRow>()
  for (const r of [...openNull, ...openOther]) if (r.bid_date_sent) openById.set(r.id, r)
  const openIds = [...openById.keys()]
  const jobs = openIds.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        openIds,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, bid_id, created_at, billing_only').in('bid_id', chunk).order('id').range(from, to), 'sales desk jobs from bids')) as JobRow[] | null, error: null }),
        'sales desk jobs from bids',
      )
    : []
  // A bid that became a job is not open, whatever its outcome says; a billing-only job is not the work.
  const becameJob = new Set<string>()
  for (const j of jobs) if (j.bid_id && !j.billing_only) becameJob.add(j.bid_id)

  const openBids: SalesOpenBid[] = openIds
    .filter((id) => !becameJob.has(id))
    .map((id) => {
      const r = openById.get(id) as OpenBidRow
      return {
        id,
        bidNumber: r.bid_number,
        projectName: r.project_name,
        gcBuilderId: r.gc_builder_id,
        customerId: r.customer_id,
        usd: usdOf(r),
        sentYmd: (r.bid_date_sent as string).slice(0, 10),
        nextFollowupYmd: ymdOf(r.next_followup_on),
        nextFollowupReason: r.next_followup_reason,
        lastContactYmd: ymdOf(r.last_contact),
      }
    })
  const decidedBids: SalesDecidedBid[] = decidedRows
    .filter((r): r is DecidedBidRow & { outcome: 'won' | 'lost'; outcome_at: string } => (r.outcome === 'won' || r.outcome === 'lost') && !!r.outcome_at)
    .map((r) => ({ id: r.id, gcBuilderId: r.gc_builder_id, usd: usdOf(r), sentYmd: ymdOf(r.bid_date_sent), outcome: r.outcome, outcomeYmd: r.outcome_at.slice(0, 10), lossCategory: r.loss_category, lossReason: r.loss_reason }))

  const gcIds = [...new Set([...openBids.map((b) => b.gcBuilderId), ...decidedBids.map((b) => b.gcBuilderId)].filter((id): id is string => !!id))]
  const gcRows = gcIds.length
    ? await fetchAllRowsChunkedIn<GcRow, string>(
        gcIds,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids_gc_builders').select('id, name').in('id', chunk).order('id').range(from, to), 'sales desk gc names')) as GcRow[] | null, error: null }),
        'sales desk gc names',
      )
    : []
  const gcNames = new Map<string, string>()
  for (const g of gcRows) gcNames.set(g.id, g.name)

  const openEstimates: SalesOpenEstimate[] = estimateRows
    .filter((e) => (!e.doc_kind || e.doc_kind === 'estimate') && !!e.sent_at)
    .map((e) => ({ id: e.id, title: e.title, sentYmd: (e.sent_at as string).slice(0, 10), usd: (e.total_cents ?? 0) / 100, customerId: e.customer_id }))
  return { openBids, decidedBids, gcNames, openEstimates }
}
