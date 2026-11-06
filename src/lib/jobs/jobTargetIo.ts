/**
 * The job's labor budget as the Target line's fallback (punch list #255, v2.6585): the hours and where they came from,
 * from the job's `job_budgets` row under the viewer's own policy. None without a row.
 */
import { supabase } from '../supabase'
import type { BudgetSource } from './jobTarget'

export type JobTargetBudget = { hours: number | null; source: BudgetSource }

/** The labor budget's hours and where they came from, from the job's `job_budgets` row; none without one. */
export async function fetchJobTargetBudget(jobId: string): Promise<JobTargetBudget> {
  const r = await supabase.from('job_budgets').select('labor_hours, kind').eq('job_id', jobId).maybeSingle()
  if (r.error || !r.data) return { hours: null, source: null }
  const row = r.data as { labor_hours: number | string | null; kind: string | null }
  const hours = Number(row.labor_hours)
  return { hours: Number.isFinite(hours) ? hours : null, source: row.kind === 'bid' || row.kind === 'typed' ? row.kind : null }
}

