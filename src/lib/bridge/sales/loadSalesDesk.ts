import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Sales desk (punch list #192, v2.5932): the reads the Bridge does not
 * already make, lazy on the desk's first open. The open bids (sent, not
 * decided, not yet a job, every age so the ones past the awaiting window can
 * be counted apart), the decided bids of the last `SALES_DECIDED_DAYS` for
 * the per-asker win rates and answer paces and the funnel (marked won, lost
 * or started_or_complete with `outcome_at` in the span, plus the bids a job
 * was created from in the span, the Sales card's own rule), the asker names
 * from `customers` (the bid form's GC field writes `customer_id`) and
 * `bids_gc_builders`, the estimates sent inside the awaiting window, and
 * every estimate asked for in the decided span for the estimates' own pace
 * and the speed sentence. Read-only; nothing new on the server.
 * `salesDesk.ts` does the arithmetic and the words.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../supabasePaging'
import { ymdAddDays } from '../../../utils/dateUtils'
import { AWAITING_DAYS } from '../demandPace'
import { SALES_DECIDED_DAYS, type SalesDecidedBid, type SalesEstimateHistory, type SalesOpenBid, type SalesOpenEstimate } from './salesDesk'

export type SalesDeskReads = {
  openBids: SalesOpenBid[]
  decidedBids: SalesDecidedBid[]
  /** Asker id → name: `customers` for a bid's customer, `bids_gc_builders` for a GC builder. */
  gcNames: ReadonlyMap<string, string>
  openEstimates: SalesOpenEstimate[]
  /** Every estimate asked for in the decided span, any status. */
  estimateHistory: SalesEstimateHistory[]
}

type OpenBidRow = { id: string; bid_number: string | null; project_name: string | null; gc_builder_id: string | null; customer_id: string | null; bid_value: number | null; agreed_value: number | null; bid_date_sent: string | null; created_at: string | null; next_followup_on: string | null; next_followup_reason: string | null; last_contact: string | null; outcome: string | null }
type DecidedBidRow = { id: string; bid_number: string | null; project_name: string | null; gc_builder_id: string | null; customer_id: string | null; bid_value: number | null; agreed_value: number | null; bid_date_sent: string | null; outcome: string | null; outcome_at: string | null; loss_category: string | null; loss_reason: string | null }
type JobRow = { id: string; bid_id: string | null; created_at: string | null; billing_only: boolean | null }
type NameRow = { id: string; name: string }
type EstimateRow = { id: string; title: string; sent_at: string | null; total_cents: number | null; doc_kind: string | null; customer_id: string | null }
type EstimateHistoryRow = { id: string; created_at: string; sent_at: string | null; status: string; acceptor_consented_at: string | null; updated_at: string | null; total_cents: number | null; doc_kind: string | null }

const OPEN_SELECT = 'id, bid_number, project_name, gc_builder_id, customer_id, bid_value, agreed_value, bid_date_sent, created_at, next_followup_on, next_followup_reason, last_contact, outcome'
const DECIDED_SELECT = 'id, bid_number, project_name, gc_builder_id, customer_id, bid_value, agreed_value, bid_date_sent, outcome, outcome_at, loss_category, loss_reason'
const JOB_SELECT = 'id, bid_id, created_at, billing_only'
const HISTORY_SELECT = 'id, created_at, sent_at, status, acceptor_consented_at, updated_at, total_cents, doc_kind'
/** A bid with one of these outcomes is decided; anything else, or none, is open unless a job was made from it. */
const DECIDED_OUTCOME_LIST = ['won', 'lost', 'started_or_complete'] as const
const DECIDED_OUTCOMES = `(${DECIDED_OUTCOME_LIST.join(',')})`

const ymdOf = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)
const usdOf = (r: { agreed_value: number | null; bid_value: number | null }): number => Number(r.agreed_value ?? r.bid_value ?? 0)
const decidedOutcomeOf = (o: string | null): SalesDecidedBid['outcome'] => (o === 'won' || o === 'lost' || o === 'started_or_complete' ? o : null)

export async function loadSalesDeskReads(db: SupabaseClient<Database>, opts: { todayYmd: string }): Promise<SalesDeskReads> {
  const decidedSinceIso = `${ymdAddDays(opts.todayYmd, -SALES_DECIDED_DAYS)}T00:00:00Z`
  const awaitingSinceIso = `${ymdAddDays(opts.todayYmd, -AWAITING_DAYS)}T00:00:00Z`
  // Two reads make the open set exactly: an outcome of null, and an outcome outside the decided three (NOT IN drops nulls).
  const [openNull, openOther, decidedRows, spanJobs, estimateRows, historyRows] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(OPEN_SELECT).not('bid_date_sent', 'is', null).is('outcome', null).order('id').range(from, to), 'sales desk open bids')) as OpenBidRow[] | null, error: null }),
      'sales desk open bids',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(OPEN_SELECT).not('bid_date_sent', 'is', null).not('outcome', 'in', DECIDED_OUTCOMES).order('id').range(from, to), 'sales desk open bids by outcome')) as OpenBidRow[] | null, error: null }),
      'sales desk open bids by outcome',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(DECIDED_SELECT).in('outcome', [...DECIDED_OUTCOME_LIST]).gte('outcome_at', decidedSinceIso).order('id').range(from, to), 'sales desk decided bids')) as DecidedBidRow[] | null, error: null }),
      'sales desk decided bids',
    ),
    // The jobs created from a bid in the span: each is a win by the Sales card's rule, whatever the bid's outcome says.
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select(JOB_SELECT).not('bid_id', 'is', null).gte('created_at', decidedSinceIso).order('id').range(from, to), 'sales desk jobs of the span')) as JobRow[] | null, error: null }),
      'sales desk jobs of the span',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('estimates').select('id, title, sent_at, total_cents, doc_kind, customer_id').eq('status', 'sent').gte('sent_at', awaitingSinceIso).order('id').range(from, to), 'sales desk open estimates')) as EstimateRow[] | null, error: null }),
      'sales desk open estimates',
    ),
    fetchAllRows(
      async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('estimates').select(HISTORY_SELECT).gte('created_at', decidedSinceIso).order('id').range(from, to), 'sales desk estimate history')) as EstimateHistoryRow[] | null, error: null }),
      'sales desk estimate history',
    ),
  ])
  const openById = new Map<string, OpenBidRow>()
  for (const r of [...openNull, ...openOther]) if (r.bid_date_sent) openById.set(r.id, r)
  const openIds = [...openById.keys()]
  const jobs = openIds.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        openIds,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select(JOB_SELECT).in('bid_id', chunk).order('id').range(from, to), 'sales desk jobs from bids')) as JobRow[] | null, error: null }),
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

  // The decided set: the bids with an outcome in the span, plus the bids a job was created from in the span, read by id when not already in hand.
  const spanJobByBid = new Map<string, JobRow>()
  for (const j of spanJobs) if (j.bid_id && j.created_at && !j.billing_only && !spanJobByBid.has(j.bid_id)) spanJobByBid.set(j.bid_id, j)
  const decidedById = new Map<string, DecidedBidRow>()
  for (const r of decidedRows) decidedById.set(r.id, r)
  const jobOnlyIds = [...spanJobByBid.keys()].filter((id) => !decidedById.has(id))
  const jobOnlyRows = jobOnlyIds.length
    ? await fetchAllRowsChunkedIn<DecidedBidRow, string>(
        jobOnlyIds,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(DECIDED_SELECT).in('id', chunk).order('id').range(from, to), 'sales desk bids behind the span jobs')) as DecidedBidRow[] | null, error: null }),
        'sales desk bids behind the span jobs',
      )
    : []
  for (const r of jobOnlyRows) decidedById.set(r.id, r)
  const decidedBids: SalesDecidedBid[] = []
  for (const r of decidedById.values()) {
    const job = spanJobByBid.get(r.id) ?? null
    const jobCreatedYmd = job ? ymdOf(job.created_at) : null
    const outcomeYmd = ymdOf(r.outcome_at)
    // The decided day is outcome_at as recorded, else the day the job was made; a bid with neither has no day to read.
    if (!outcomeYmd && !jobCreatedYmd) continue
    decidedBids.push({
      id: r.id,
      gcBuilderId: r.gc_builder_id,
      customerId: r.customer_id,
      usd: usdOf(r),
      sentYmd: ymdOf(r.bid_date_sent),
      outcome: decidedOutcomeOf(r.outcome),
      outcomeYmd,
      jobCreatedYmd,
      lossCategory: r.loss_category,
      lossReason: r.loss_reason,
      bidNumber: r.bid_number,
      projectName: r.project_name,
    })
  }

  // The asker names: the customer on the bid first (the bid form's GC field), the GC builder for the bids with none.
  const allBids = [...openBids, ...decidedBids]
  const customerIds = [...new Set(allBids.map((b) => b.customerId).filter((id): id is string => !!id))]
  const gcIds = [...new Set(allBids.map((b) => b.gcBuilderId).filter((id): id is string => !!id))]
  const [customerRows, gcRows] = await Promise.all([
    customerIds.length
      ? fetchAllRowsChunkedIn<NameRow, string>(
          customerIds,
          async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('customers').select('id, name').in('id', chunk).order('id').range(from, to), 'sales desk customer names')) as NameRow[] | null, error: null }),
          'sales desk customer names',
        )
      : Promise.resolve([] as NameRow[]),
    gcIds.length
      ? fetchAllRowsChunkedIn<NameRow, string>(
          gcIds,
          async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids_gc_builders').select('id, name').in('id', chunk).order('id').range(from, to), 'sales desk gc names')) as NameRow[] | null, error: null }),
          'sales desk gc names',
        )
      : Promise.resolve([] as NameRow[]),
  ])
  const gcNames = new Map<string, string>()
  for (const g of gcRows) gcNames.set(g.id, g.name)
  for (const c of customerRows) gcNames.set(c.id, c.name)

  const openEstimates: SalesOpenEstimate[] = estimateRows
    .filter((e) => (!e.doc_kind || e.doc_kind === 'estimate') && !!e.sent_at)
    .map((e) => ({ id: e.id, title: e.title, sentYmd: (e.sent_at as string).slice(0, 10), usd: (e.total_cents ?? 0) / 100, customerId: e.customer_id }))
  // The estimates' own history: every status, so the accepted ones give the pace and the decided ones the same-day split.
  const estimateHistory: SalesEstimateHistory[] = historyRows
    .filter((e) => (!e.doc_kind || e.doc_kind === 'estimate') && !!e.created_at)
    .map((e) => ({ id: e.id, createdYmd: e.created_at.slice(0, 10), sentYmd: ymdOf(e.sent_at), status: e.status, acceptedYmd: ymdOf(e.acceptor_consented_at), updatedYmd: ymdOf(e.updated_at), usd: (e.total_cents ?? 0) / 100 }))
  return { openBids, decidedBids, gcNames, openEstimates, estimateHistory }
}
