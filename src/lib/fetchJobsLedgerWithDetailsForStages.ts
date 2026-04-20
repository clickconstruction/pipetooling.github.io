/**
 * Shared jobs_ledger fetch + enrichment used by Jobs `loadJobs` and Accounts Receivable standalone page.
 * Keep in sync when extending Stages job shape.
 */
import { supabase } from './supabase'
import { mergeMaxScheduleWorkDateByJobId } from './stagesJobReferenceDates'
import { pickLinkedEstimateForStagesBanner } from './pickLinkedEstimateForStagesBanner'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

export type FetchJobsLedgerWithDetailsResult =
  | { ok: true; jobs: JobWithDetails[] }
  | { ok: false; error: string }

export async function fetchJobsLedgerWithDetailsForStages(options: {
  customerFilter?: string | null
}): Promise<FetchJobsLedgerWithDetailsResult> {
  const customerFilter = options.customerFilter?.trim() || null
  type Row = JobsLedgerRow & {
    jobs_ledger_materials?: JobsLedgerMaterial[]
    jobs_ledger_fixtures?: JobsLedgerFixture[]
    jobs_ledger_payments?: JobsLedgerPayment[]
    jobs_ledger_invoices?: JobsLedgerInvoice[]
    jobs_ledger_team_members?: (JobsLedgerTeamMember & { users: { name: string } | null })[]
    reports?: Array<{ job_ledger_id: string | null }>
    projects?: { id: string; name: string } | null
    bids?: { id: string; project_name: string | null; bid_number: string | null } | null
  }
  let rows: Row[]
  try {
    const data = await withSupabaseRetry(
      async () => {
        let q = supabase
          .from('jobs_ledger')
          .select(
            `
        *,
        jobs_ledger_materials(*),
        jobs_ledger_fixtures(*),
        jobs_ledger_payments(*),
        jobs_ledger_invoices(*),
        jobs_ledger_team_members(*, users(name)),
        reports(job_ledger_id),
        projects:project_id(id, name),
        bids:bid_id(id, project_name, bid_number)
      `,
          )
          .order('hcp_number', { ascending: false })
        if (customerFilter) {
          q = q.eq('customer_id', customerFilter)
        }
        return q
      },
      'fetch jobs_ledger for stages',
    )
    rows = (data ?? []) as Row[]
  } catch (e: unknown) {
    return { ok: false, error: formatErrorMessage(e, 'Failed to load jobs') }
  }
  if (rows.length === 0) {
    return { ok: true, jobs: [] }
  }
  const jobsWithDetails: JobWithDetails[] = rows.map((row) => {
    const {
      jobs_ledger_materials: mat,
      jobs_ledger_fixtures: fix,
      jobs_ledger_payments: pay,
      jobs_ledger_invoices: inv,
      jobs_ledger_team_members: team,
      reports: rep,
      projects: proj,
      bids: bidEmbed,
      ...job
    } = row
    return {
      ...job,
      materials: (mat ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      fixtures: (fix ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      payments: (pay ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      invoices: (inv ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
      team_members: team ?? [],
      report_count: (rep ?? []).length,
      project: proj ?? null,
      linkedBid: bidEmbed ?? null,
      last_schedule_work_date: null,
    }
  })

  const SCHEDULE_BLOCKS_IN_CHUNK = 150
  let scheduleMaxByJobId = new Map<string, string>()
  try {
    const ids = jobsWithDetails.map((j) => j.id)
    for (let i = 0; i < ids.length; i += SCHEDULE_BLOCKS_IN_CHUNK) {
      const chunk = ids.slice(i, i + SCHEDULE_BLOCKS_IN_CHUNK)
      const blockRows = await withSupabaseRetry(
        async () =>
          supabase.from('job_schedule_blocks').select('job_id, work_date').in('job_id', chunk),
        'job_schedule_blocks for stages banner',
      )
      const part = mergeMaxScheduleWorkDateByJobId(
        (blockRows ?? []) as Array<{ job_id: string; work_date: string }>,
      )
      for (const [jobId, ymd] of part) {
        const prev = scheduleMaxByJobId.get(jobId)
        if (prev == null || ymd > prev) scheduleMaxByJobId.set(jobId, ymd)
      }
    }
  } catch (e) {
    console.warn('fetchJobsLedgerWithDetailsForStages: job_schedule_blocks batch failed', e)
    scheduleMaxByJobId = new Map()
  }

  const ESTIMATES_STAGES_BANNER_CHUNK = 150
  const estimateCandidatesByJobId = new Map<
    string,
    Array<{
      estimate_number: number
      title: string
      status: Database['public']['Enums']['estimate_status']
      updated_at: string | null
    }>
  >()
  try {
    const ids = jobsWithDetails.map((j) => j.id)
    for (let i = 0; i < ids.length; i += ESTIMATES_STAGES_BANNER_CHUNK) {
      const chunk = ids.slice(i, i + ESTIMATES_STAGES_BANNER_CHUNK)
      const estimateRows = await withSupabaseRetry(
        async () =>
          supabase
            .from('estimates')
            .select('job_ledger_id, estimate_number, title, status, updated_at')
            .in('job_ledger_id', chunk),
        'load estimates for stages banner',
      )
      const list = (estimateRows ?? []) as Array<{
        job_ledger_id: string | null
        estimate_number: number
        title: string
        status: Database['public']['Enums']['estimate_status']
        updated_at: string | null
      }>
      for (const row of list) {
        const jid = row.job_ledger_id
        if (!jid) continue
        const cur = estimateCandidatesByJobId.get(jid) ?? []
        cur.push({
          estimate_number: row.estimate_number,
          title: row.title,
          status: row.status,
          updated_at: row.updated_at,
        })
        estimateCandidatesByJobId.set(jid, cur)
      }
    }
  } catch (e) {
    console.warn('fetchJobsLedgerWithDetailsForStages: estimates stages banner batch failed', e)
    estimateCandidatesByJobId.clear()
  }

  const jobsWithSchedule: JobWithDetails[] = jobsWithDetails.map((j) => ({
    ...j,
    last_schedule_work_date: scheduleMaxByJobId.get(j.id) ?? null,
    linkedEstimateForStages: pickLinkedEstimateForStagesBanner(estimateCandidatesByJobId.get(j.id) ?? []),
  }))
  return { ok: true, jobs: jobsWithSchedule }
}
