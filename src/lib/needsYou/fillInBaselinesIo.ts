import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { JOB_BUDGET_CHANGED_EVENT } from '../../hooks/useJobBudget'
import type { AwardBaselineRpcArgs, AwardBidBreakdown } from '../jobs/awardBaseline'
import { awardJobBaseline } from '../jobs/awardBaselineIo'
import type { BaselineRate } from '../bids/bidBaselineRates'
import { projectsWithNoBaseline, type BaselineBidSource, type BaselineBudgetSource, type BaselineCandidates, type BaselineFixtureSource, type BaselineJobSource, type BaselineSources } from './fillInBaselines'

/**
 * The baseline kind's reads and writes (punch list #234, PR 1a). The candidates are the working jobs
 * that are not billing-only, their stage rows (the kind's read) and their `job_budgets` rows; the
 * deck adds each linked bid's breakdown and the labor book's rates for the projects that stay, each
 * failing soft to no press. Save is the award window's own `award_job_baseline`; Undo clears the
 * row, so the project is back on the line.
 */
export type BaselineFillInIo = {
  fetchCandidates: () => Promise<BaselineCandidates>
  fetchSources: () => Promise<BaselineSources>
  save: (args: AwardBaselineRpcArgs) => Promise<void>
  undo: (jobId: string) => Promise<void>
}

/** What the kernel and the row read, and no more: the Dashboard makes this read on every load. */
const CANDIDATE_COLUMNS = 'id, status, billing_only, kind, hcp_number, click_number, bid_id, project_id, revenue, first_work_date, job_name, job_address, customer_name, created_at'

async function fetchCandidates(): Promise<BaselineCandidates> {
  const rows = await fetchAllRows(
    (from, to) => supabase.from('jobs_ledger').select(CANDIDATE_COLUMNS).or('status.is.null,status.eq.working').eq('billing_only', false).order('created_at', { ascending: false }).range(from, to),
    'fill in: working jobs for a baseline',
  )
  // A job pressed Service call needs no more reading; every other working job may read as a project.
  const jobs = (rows as unknown as BaselineJobSource[]).filter((j) => j.kind !== 'service')
  const ids = jobs.map((j) => j.id)
  const [fixtures, budgets] = await Promise.all([
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger_fixtures').select('id, job_id, name, count, line_unit_price, sequence_order, stage_kind').in('job_id', chunk).range(from, to), 'fill in: stage rows for a baseline'),
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('job_budgets').select('job_id, kind, labor_hours').in('job_id', chunk).range(from, to), 'fill in: budgets for a baseline'),
  ])
  return { jobs, fixtures: fixtures as BaselineFixtureSource[], budgets: budgets as BaselineBudgetSource[] }
}

async function fetchBids(bidIds: string[]): Promise<BaselineBidSource[]> {
  if (bidIds.length === 0) return []
  const numbers = await fetchAllRowsChunkedIn(bidIds, (chunk, from, to) => supabase.from('bids').select('id, bid_number').in('id', chunk).range(from, to), 'fill in: bids for a baseline')
  const numberOf = new Map((numbers as Array<{ id: string; bid_number: string | null }>).map((b) => [b.id, b.bid_number] as const))
  return Promise.all(
    bidIds.map(async (bid_id): Promise<BaselineBidSource> => {
      const { data, error } = await supabase.rpc('bid_estimate_breakdown', { p_bid_id: bid_id })
      return { bid_id, bid_number: numberOf.get(bid_id) ?? null, breakdown: error ? null : ((data as unknown as AwardBidBreakdown | null) ?? null) }
    }),
  )
}

async function fetchBook(): Promise<BaselineRate[]> {
  const { data, error } = await supabase.rpc('job_baseline_rates')
  if (error) throw error
  return (data ?? []) as BaselineRate[]
}

export const baselineFillInIo: BaselineFillInIo = {
  fetchCandidates,
  async fetchSources() {
    const { jobs, fixtures, budgets } = await fetchCandidates()
    const stay = projectsWithNoBaseline(jobs, fixtures, budgets)
    const bidIds = [...new Set(stay.map((j) => j.bid_id).filter((id): id is string => !!id))]
    const [bids, book] = await Promise.all([fetchBids(bidIds).catch(() => null), fetchBook().catch(() => null)])
    return { jobs, fixtures, budgets, bids, book }
  },
  async save(args) {
    // The shared write: the company rate saved on a bid that has none, then the award (slip 8 of the second walk).
    await awardJobBaseline(args)
  },
  async undo(jobId) {
    const { error } = await supabase.rpc('clear_job_budget', { p_job_id: jobId })
    if (error) throw error
    window.dispatchEvent(new Event(JOB_BUDGET_CHANGED_EVENT))
  },
}
