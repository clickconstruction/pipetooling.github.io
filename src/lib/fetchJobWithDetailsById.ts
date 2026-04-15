import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

const JOB_LEDGER_DETAIL_SELECT = `
        *,
        jobs_ledger_materials(*),
        jobs_ledger_fixtures(*),
        jobs_ledger_payments(*),
        jobs_ledger_invoices(*),
        jobs_ledger_team_members(*, users(name)),
        reports(job_ledger_id),
        projects:project_id(id, name),
        bids:bid_id(id, project_name, bid_number)
      `

function mapRowToJobWithDetails(
  row: JobsLedgerRow & {
    jobs_ledger_materials?: JobsLedgerMaterial[]
    jobs_ledger_fixtures?: JobsLedgerFixture[]
    jobs_ledger_payments?: JobsLedgerPayment[]
    jobs_ledger_invoices?: JobsLedgerInvoice[]
    jobs_ledger_team_members?: (JobsLedgerTeamMember & { users: { name: string } | null })[]
    reports?: Array<{ job_ledger_id: string | null }>
    projects?: { id: string; name: string } | null
    bids?: { id: string; project_name: string | null; bid_number: string | null } | null
  },
): JobWithDetails {
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
}

/** Single-job fetch with the same shape as Jobs `loadJobs` rows. */
export async function fetchJobWithDetailsById(jobId: string): Promise<JobWithDetails | null> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase.from('jobs_ledger').select(JOB_LEDGER_DETAIL_SELECT).eq('id', jobId).maybeSingle(),
      'fetchJobWithDetailsById',
    )
    if (!data) return null
    return mapRowToJobWithDetails(data as Parameters<typeof mapRowToJobWithDetails>[0])
  } catch {
    return null
  }
}
