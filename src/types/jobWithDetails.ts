import type { Database } from './database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

/** One estimate chosen for Jobs Stages banner (`estimates.job_ledger_id` → job). */
export type JobLinkedEstimateForStages = {
  estimate_number: number
  title: string
  status: Database['public']['Enums']['estimate_status']
}

export type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
  payments: JobsLedgerPayment[]
  invoices: JobsLedgerInvoice[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
  report_count?: number
  project?: { id: string; name: string } | null
  /** Embedded bid when `bid_id` is set (`jobs_ledger.bid_id` → `bids`). */
  linkedBid?: {
    id: string
    project_name: string | null
    bid_number: string | null
    service_type_id: string | null
    /** The bid's GC/Builder (bids.customer_id) — detail fetch only (v2.1176); feeds the "Use bid's GC" chip. */
    customer_id?: string | null
    customers?: { id: string; name: string | null } | null
  } | null
  /** Embedded GC (General Contractor) when `gc_customer_id` is set (v2.1176). */
  gcCustomer?: { id: string; name: string | null } | null
  /** Embedded development (group of jobs) when `development_id` is set (v2.1199). */
  development?: { id: string; name: string | null } | null
  /** From `service_types:service_type_id(name)` on detail fetch (`fetchJobWithDetailsById`). */
  serviceType?: { name: string } | null
  /** Max `job_schedule_blocks.work_date` for this job; set in Jobs `loadJobs` only. */
  last_schedule_work_date?: string | null
  /** Primary linked quote for Stages row banner; set in `loadJobs` only. */
  linkedEstimateForStages?: JobLinkedEstimateForStages | null
}
