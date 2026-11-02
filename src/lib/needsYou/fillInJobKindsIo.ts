import { supabase } from '../supabase'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { saveJobKind } from '../jobs/jobKindWrite'
import type { JobKind } from '../jobs/jobKind'
import { jobsWithNoKind, type JobKindBillSource, type JobKindCandidates, type JobKindFixtureSource, type JobKindJobSource, type JobKindSessionSource, type JobKindSources } from './fillInJobKinds'

/**
 * The job-kind kind's reads and writes (punch list #238, PR 2). The candidates are the working jobs
 * with no bid, no GC project, no HCP number and no press on them, then their stage rows, which the
 * kernel reads; the deck adds the clock and the bills for the jobs that stay, each failing soft to
 * no line. Save is the Edit tab's own `saveJobKind`; Undo clears the
 * press, so the job reads from its signals again.
 */
export type JobKindFillInIo = {
  fetchCandidates: () => Promise<JobKindCandidates>
  fetchSources: () => Promise<JobKindSources>
  save: (jobId: string, kind: JobKind) => Promise<void>
  undo: (jobId: string) => Promise<void>
}

/** What the kernel and the row read, and no more: the Dashboard makes this read on every load. */
const CANDIDATE_COLUMNS = 'id, status, billing_only, kind, hcp_number, click_number, bid_id, project_id, revenue, first_work_date, job_name, job_address, customer_name, created_at'

async function fetchCandidates(): Promise<JobKindCandidates> {
  const rows = await fetchAllRows(
    (from, to) =>
      supabase
        .from('jobs_ledger')
        .select(CANDIDATE_COLUMNS)
        .or('status.is.null,status.eq.working')
        .is('bid_id', null)
        .is('project_id', null)
        .eq('billing_only', false)
        .order('created_at', { ascending: false })
        .range(from, to),
    'fill in: working jobs for their kind',
  )
  // An HCP number or a press settles the kind, so those jobs need no stage rows read.
  const jobs = (rows as unknown as JobKindJobSource[]).filter((j) => !(j.hcp_number ?? '').trim() && !j.kind)
  const fixtures = await fetchAllRowsChunkedIn(
    jobs.map((j) => j.id),
    (chunk, from, to) => supabase.from('jobs_ledger_fixtures').select('id, job_id, name, count, line_unit_price, sequence_order, stage_kind').in('job_id', chunk).range(from, to),
    'fill in: stage rows for a job kind',
  )
  return { jobs, fixtures: fixtures as JobKindFixtureSource[] }
}

async function fetchSessions(jobIds: string[]): Promise<JobKindSessionSource[]> {
  const rows = await fetchAllRowsChunkedIn(
    jobIds,
    (chunk, from, to) =>
      supabase
        .from('clock_sessions')
        .select('job_ledger_id, user_id, work_date, clocked_in_at, clocked_out_at')
        .in('job_ledger_id', chunk)
        .not('approved_at', 'is', null)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .range(from, to),
    'fill in: clock time for a job kind',
  )
  return rows as JobKindSessionSource[]
}

async function fetchBills(jobIds: string[]): Promise<JobKindBillSource[]> {
  const rows = await fetchAllRowsChunkedIn(jobIds, (chunk, from, to) => supabase.from('jobs_ledger_invoices').select('job_id, amount, status').in('job_id', chunk).range(from, to), 'fill in: bills for a job kind')
  return rows as JobKindBillSource[]
}

export const jobKindFillInIo: JobKindFillInIo = {
  fetchCandidates,
  async fetchSources() {
    const { jobs, fixtures } = await fetchCandidates()
    const ids = jobsWithNoKind(jobs, fixtures).map((j) => j.id)
    const [sessions, bills] = await Promise.all([fetchSessions(ids).catch(() => null), fetchBills(ids).catch(() => null)])
    return { jobs, fixtures, sessions, bills }
  },
  save: (jobId, kind) => saveJobKind(jobId, kind),
  undo: (jobId) => saveJobKind(jobId, null),
}
