import { supabase } from './supabase'
import { buildJobsLedgerFullDetailSelect } from './jobsLedgerEmbedSelects'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { Database } from '../types/database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

const JOB_LEDGER_DETAIL_SELECT = buildJobsLedgerFullDetailSelect()

function mapRowToJobWithDetails(
  row: JobsLedgerRow & {
    jobs_ledger_materials?: JobsLedgerMaterial[]
    jobs_ledger_fixtures?: JobsLedgerFixture[]
    jobs_ledger_payments?: JobsLedgerPayment[]
    jobs_ledger_invoices?: JobsLedgerInvoice[]
    jobs_ledger_team_members?: (JobsLedgerTeamMember & { users: { name: string } | null })[]
    reports?: Array<{
      job_ledger_id: string | null
      created_at: string | null
      users?: { name: string | null } | { name: string | null }[] | null
      report_templates?: { name: string | null } | { name: string | null }[] | null
    }>
    projects?: { id: string; name: string } | null
    bids?: {
      id: string
      project_name: string | null
      bid_number: string | null
      service_type_id: string | null
      customer_id?: string | null
      customers?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    } | null
    gc_customer?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    account_manager?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    development?: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    service_types?: { name: string } | null
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
    gc_customer: gcEmbed,
    development: devEmbed,
    account_manager: amEmbed,
    service_types: serviceTypeEmbed,
    ...job
  } = row
  // PostgREST returns embedded to-one as an object or a 1-element array.
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  // Newest report's meta for the Job Detail "Reports" box — embeds are
  // unordered, so pick by created_at here (report counts are small).
  const latestReportRow = (rep ?? []).reduce<(typeof rep extends Array<infer R> | undefined ? R : never) | null>(
    (best, r) => {
      if (!r.created_at) return best
      if (!best?.created_at || r.created_at > best.created_at) return r
      return best
    },
    null,
  )
  return {
    ...job,
    serviceType: serviceTypeEmbed && typeof (serviceTypeEmbed as { name?: string }).name === 'string' ? (serviceTypeEmbed as { name: string }) : null,
    materials: (mat ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    fixtures: (fix ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    payments: (pay ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    invoices: (inv ?? []).sort((a, b) => a.sequence_order - b.sequence_order),
    team_members: team ?? [],
    report_count: (rep ?? []).length,
    latestReport: latestReportRow
      ? {
          created_at: latestReportRow.created_at,
          author_name: one(latestReportRow.users)?.name ?? null,
          template_name: one(latestReportRow.report_templates)?.name ?? null,
        }
      : null,
    project: proj ?? null,
    linkedBid: bidEmbed ? { ...bidEmbed, customers: one(bidEmbed.customers) } : null,
    gcCustomer: one(gcEmbed),
    development: one(devEmbed),
    account_manager: one(amEmbed),
    last_schedule_work_date: null,
  }
}

/** Single-job fetch with the same shape as Jobs `loadJobs` rows. */
export async function fetchJobWithDetailsById(jobId: string): Promise<JobWithDetails | null> {
  try {
    const data = await withSupabaseRetry(
      async () => await supabase.from('jobs_ledger').select(JOB_LEDGER_DETAIL_SELECT).eq('id', jobId).maybeSingle(),
      'fetchJobWithDetailsById',
    )
    if (!data) return null
    return mapRowToJobWithDetails(data as Parameters<typeof mapRowToJobWithDetails>[0])
  } catch {
    return null
  }
}
