import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { LINE_BUDGETS_REVIEW_WINDOW_DAYS, type ReviewFixtureSource, type ReviewJobSource } from './lineBudgetsReview'

/**
 * The weekly review's reads and the stamp (punch list #234, PR 1c). The projects awarded in the
 * window come from `job_budgets.awarded_at` (PR 1a's freeze), their lines from `jobs_ledger_fixtures`
 * with the budget and reviewed columns; the stamp is `stamp_line_budgets_reviewed`, the owner's.
 */
export type LineBudgetsReviewIo = {
  fetchSources: (nowIso: string) => Promise<{ jobs: ReviewJobSource[]; fixtures: ReviewFixtureSource[] }>
  stamp: (fixtureIds: string[]) => Promise<number>
}

async function fetchSources(nowIso: string): Promise<{ jobs: ReviewJobSource[]; fixtures: ReviewFixtureSource[] }> {
  const since = new Date(Date.parse(nowIso) - LINE_BUDGETS_REVIEW_WINDOW_DAYS * 86_400_000).toISOString()
  // The award columns are read through a cast until the types carry them.
  const { data: awards, error } = await supabase.from('job_budgets').select('job_id, awarded_at' as never).gte('awarded_at' as never, since)
  if (error) throw error
  const byJob = new Map((awards as unknown as Array<{ job_id: string; awarded_at: string | null }>).map((a) => [a.job_id, a.awarded_at] as const))
  const ids = [...byJob.keys()]
  if (ids.length === 0) return { jobs: [], fixtures: [] }
  const [jobRows, fixtureRows] = await Promise.all([
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, customer_name, revenue, status, billing_only').in('id', chunk).or('status.is.null,status.eq.working').eq('billing_only', false).range(from, to), 'line budgets review: the projects'),
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger_fixtures').select('id, job_id, name, count, line_unit_price, line_kind, budget_labor_pct, budget_materials_pct, budget_source, budget_tuned_at, budget_rate_usd, budget_reviewed_at' as never).in('job_id', chunk).range(from, to), 'line budgets review: the lines'),
  ])
  const jobs = (jobRows as unknown as Array<Omit<ReviewJobSource, 'awarded_at'>>).map((j) => ({ ...j, awarded_at: byJob.get(j.id) ?? null }))
  return { jobs, fixtures: fixtureRows as unknown as ReviewFixtureSource[] }
}

export const lineBudgetsReviewIo: LineBudgetsReviewIo = {
  fetchSources,
  async stamp(fixtureIds) {
    const { data, error } = await supabase.rpc('stamp_line_budgets_reviewed' as never, { p_fixture_ids: fixtureIds } as never)
    if (error) throw error
    return Number(data) || 0
  },
}
