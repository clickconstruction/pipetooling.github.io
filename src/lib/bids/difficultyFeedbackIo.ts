/**
 * GC difficulty rating (punch list #357, PR 6): the reads behind *What the rating did*. The bids to the GC, the pins
 * of the ones priced with difficulty lines, the jobs those bids became and, for the office, the hours clocked on
 * them (`loadEarnedJobs`, the read Job Summary and the Bridge make). Each part fails soft: a read that cannot be
 * made leaves its line off the card.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { loadEarnedJobs } from '../bridge/loadBridgeData'
import { jobLabelOf } from '../people/superintendentScores'
import { difficultyPricedHours, type FeedbackBid, type FeedbackJob } from './difficultyFeedback'

export type DifficultyFeedbackRead = {
  /** When the GC was first rated; null when it never was. */
  firstRatedAt: string | null
  bids: FeedbackBid[]
  /** Null when the hours are not this person's to read, or could not be read. */
  jobs: FeedbackJob[] | null
}

export interface DifficultyFeedbackIo {
  load(customerId: string, opts: { withHours: boolean }): Promise<DifficultyFeedbackRead>
}

type BidRow = { id: string; outcome: string | null; priced_at: string | null; created_at: string | null; bid_date_sent: string | null; priced_difficulty_usd: number | string | null }
type PinRow = { bid_id: string; field_hours: number | string | null; lines: unknown }
type JobRow = { id: string; bid_id: string | null; status: string | null; hcp_number: string | null; click_number: string | null; job_name: string | null }

const DONE = new Set(['ready_to_bill', 'billed', 'paid'])
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function supabaseDifficultyFeedbackIo(): DifficultyFeedbackIo {
  return {
    async load(customerId, { withHours }) {
      const first = (await supabase.from('gc_difficulty_ratings' as never).select('rated_at').eq('customer_id', customerId).order('rated_at', { ascending: true }).limit(1)) as unknown as { data: { rated_at: string }[] | null; error: unknown }
      checkSupabaseError(first as never, 'read when the GC was first rated')
      const firstRatedAt = first.data?.[0]?.rated_at ?? null
      if (!firstRatedAt) return { firstRatedAt: null, bids: [], jobs: null }

      const bidsRes = await supabase.from('bids').select('id, outcome, priced_at, created_at, bid_date_sent, priced_difficulty_usd').eq('customer_id', customerId).limit(500)
      checkSupabaseError(bidsRes as never, 'read the bids to this GC')
      const rows = (bidsRes.data ?? []) as BidRow[]
      const bids: FeedbackBid[] = rows.map((b) => ({
        bidId: b.id,
        outcome: b.outcome === 'won' || b.outcome === 'lost' || b.outcome === 'started_or_complete' ? b.outcome : null,
        pricedOrCreatedAt: b.priced_at ?? b.created_at ?? '',
        sent: !!b.bid_date_sent,
        pricedDifficultyUsd: b.priced_difficulty_usd == null ? null : num(b.priced_difficulty_usd),
      }))
      const since = bids.filter((b) => b.pricedOrCreatedAt >= firstRatedAt).map((b) => b.bidId)
      if (!withHours || since.length === 0) return { firstRatedAt, bids, jobs: withHours ? [] : null }

      try {
        const pinsRes = (await supabase.from('bid_difficulty' as never).select('bid_id, field_hours, lines').in('bid_id', since)) as unknown as { data: PinRow[] | null; error: unknown }
        checkSupabaseError(pinsRes as never, 'read the hours the bids were priced with')
        const pricedByBid = new Map<string, number>()
        for (const p of pinsRes.data ?? []) {
          const lines = Array.isArray(p.lines) ? (p.lines as Array<{ key?: unknown; hours?: unknown }>).map((l) => ({ key: String(l.key ?? ''), hours: num(l.hours) })) : []
          pricedByBid.set(p.bid_id, difficultyPricedHours({ fieldHours: num(p.field_hours), lines }))
        }
        const pinned = [...pricedByBid.keys()]
        if (pinned.length === 0) return { firstRatedAt, bids, jobs: [] }
        const jobsRes = await supabase.from('jobs_ledger').select('id, bid_id, status, hcp_number, click_number, job_name').in('bid_id', pinned)
        checkSupabaseError(jobsRes as never, 'read the jobs from those bids')
        const jobRows = (jobsRes.data ?? []) as JobRow[]
        if (jobRows.length === 0) return { firstRatedAt, bids, jobs: [] }
        const { earnedJobs } = await loadEarnedJobs(supabase, jobRows.map((j) => j.id))
        const hours = new Map(earnedJobs.map((j) => [j.id, j.lifetimeHours]))
        const jobs: FeedbackJob[] = jobRows.map((j) => ({ jobId: j.id, label: jobLabelOf(j), done: DONE.has(j.status ?? ''), clockedHours: hours.get(j.id) ?? 0, pricedHours: pricedByBid.get(j.bid_id ?? '') ?? 0 }))
        return { firstRatedAt, bids, jobs }
      } catch {
        return { firstRatedAt, bids, jobs: null }
      }
    },
  }
}
