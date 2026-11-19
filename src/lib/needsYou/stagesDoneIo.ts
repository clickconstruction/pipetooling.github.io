import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import type { StagesDoneJobSource, StagesDoneLineSource } from './stagesDone'

/**
 * The reads behind *a stage reads 100% and is not billed* (punch list #397, PR 7): the lines the crew put
 * at 100% that sit on no bill, then their jobs and every line of those jobs, so the rule can tell a staged
 * job from a job on one line. Three reads, and the first is small: few lines carry a percent of their own.
 */
export type StagesDoneIo = {
  fetchSources: () => Promise<{ jobs: StagesDoneJobSource[]; lines: StagesDoneLineSource[] }>
}

const LINE_COLS = 'id, job_id, name, count, line_unit_price, line_kind, invoice_id, progress_pct'

async function fetchSources(): Promise<{ jobs: StagesDoneJobSource[]; lines: StagesDoneLineSource[] }> {
  const done = await fetchAllRows<{ job_id: string }>((from, to) => supabase.from('jobs_ledger_fixtures').select('job_id').gte('progress_pct', 100).is('invoice_id', null).order('id').range(from, to), 'a stage at 100%: the finished lines')
  const ids = [...new Set(done.map((r) => r.job_id))]
  if (ids.length === 0) return { jobs: [], lines: [] }
  const [jobs, lines] = await Promise.all([
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, status').in('id', chunk).eq('status', 'working').order('id').range(from, to), 'a stage at 100%: the jobs'),
    fetchAllRowsChunkedIn(ids, (chunk, from, to) => supabase.from('jobs_ledger_fixtures').select(LINE_COLS).in('job_id', chunk).order('id').range(from, to), 'a stage at 100%: the lines'),
  ])
  return { jobs: jobs as unknown as StagesDoneJobSource[], lines: lines as unknown as StagesDoneLineSource[] }
}

export const stagesDoneIo: StagesDoneIo = { fetchSources }
