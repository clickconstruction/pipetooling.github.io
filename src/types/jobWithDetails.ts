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
  linkedBid?: { id: string; project_name: string | null; bid_number: string | null } | null
  /** Max `job_schedule_blocks.work_date` for this job; set in Jobs `loadJobs` only. */
  last_schedule_work_date?: string | null
  /** Primary linked quote for Stages row banner; set in `loadJobs` only. */
  linkedEstimateForStages?: JobLinkedEstimateForStages | null
}
