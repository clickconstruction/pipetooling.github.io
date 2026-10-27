import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
/**
 * The reads behind Market and Sales (link PR 4): the bids created, sent or
 * answered since 90 days before the window (the awaiting window), the jobs
 * those bids became, and the estimates over the same span. `demandPace.ts`
 * shapes them.
 */
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { ymdAddDays, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { AWAITING_DAYS, type DemandBid, type DemandEstimate, type DemandInput } from './demandPace'

type BidRow = { id: string; created_at: string | null; bid_date_sent: string | null; bid_value: number | null; agreed_value: number | null; outcome: string | null; outcome_at: string | null }
type JobRow = { id: string; bid_id: string | null; created_at: string | null; revenue: number | null; billing_only: boolean | null }
type EstimateRow = { id: string; created_at: string; sent_at: string | null; status: string; total_cents: number | null; acceptor_consented_at: string | null; updated_at: string | null; doc_kind: string | null }

const ymdOf = (iso: string | null | undefined): string | null => (iso ? calendarYmdInAppTzFromIso(iso) || null : null)

export async function loadDemandInputs(db: SupabaseClient<Database>, opts: { windowStart: string; todayYmd: string }): Promise<DemandInput> {
  const sinceYmd = ymdAddDays(opts.windowStart, -AWAITING_DAYS)
  const sinceIso = `${sinceYmd}T00:00:00Z`
  const select = 'id, created_at, bid_date_sent, bid_value, agreed_value, outcome, outcome_at'
  const [created, sent, answered, estimateRows] = await Promise.all([
    fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(select).gte('created_at', sinceIso).order('id').range(from, to), 'bridge demand bids created')) as BidRow[] | null, error: null }), 'bridge demand bids created'),
    fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(select).gte('bid_date_sent', sinceYmd).order('id').range(from, to), 'bridge demand bids sent')) as BidRow[] | null, error: null }), 'bridge demand bids sent'),
    fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => db.from('bids').select(select).gte('outcome_at', sinceIso).order('id').range(from, to), 'bridge demand bids answered')) as BidRow[] | null, error: null }), 'bridge demand bids answered'),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => db.from('estimates').select('id, created_at, sent_at, status, total_cents, acceptor_consented_at, updated_at, doc_kind').gte('created_at', sinceIso).order('id').range(from, to), 'bridge demand estimates')) as EstimateRow[] | null,
        error: null,
      }),
      'bridge demand estimates',
    ),
  ])
  const bidById = new Map<string, BidRow>()
  for (const r of [...created, ...sent, ...answered]) bidById.set(r.id, r)
  const ids = [...bidById.keys()]
  const jobs = ids.length
    ? await fetchAllRowsChunkedIn<JobRow, string>(
        ids,
        async (chunk, from, to) => ({ data: (await withSupabaseRetry(async () => db.from('jobs_ledger').select('id, bid_id, created_at, revenue, billing_only').in('bid_id', chunk).order('id').range(from, to), 'bridge demand jobs from bids')) as JobRow[] | null, error: null }),
        'bridge demand jobs from bids',
      )
    : []
  const jobByBid = new Map<string, JobRow>()
  for (const j of jobs) if (j.bid_id && !j.billing_only && !jobByBid.has(j.bid_id)) jobByBid.set(j.bid_id, j)

  const bids: DemandBid[] = ids.map((id) => {
    const r = bidById.get(id) as BidRow
    const job = jobByBid.get(id) ?? null
    return {
      id,
      createdYmd: ymdOf(r.created_at),
      sentYmd: r.bid_date_sent ? r.bid_date_sent.slice(0, 10) : null,
      usd: Number(r.agreed_value ?? r.bid_value ?? 0),
      outcome: r.outcome,
      outcomeYmd: ymdOf(r.outcome_at),
      jobCreatedYmd: job ? ymdOf(job.created_at) : null,
      jobUsd: job ? job.revenue : null,
    }
  })
  const estimates: DemandEstimate[] = estimateRows
    .filter((e) => !e.doc_kind || e.doc_kind === 'estimate')
    .map((e) => ({ id: e.id, createdYmd: calendarYmdInAppTzFromIso(e.created_at), sentYmd: ymdOf(e.sent_at), status: e.status, usd: (e.total_cents ?? 0) / 100, acceptedYmd: ymdOf(e.acceptor_consented_at), updatedYmd: ymdOf(e.updated_at) }))
  return { windowStart: opts.windowStart, todayYmd: opts.todayYmd, bids, estimates }
}
