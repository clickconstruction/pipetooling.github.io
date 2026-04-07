import type { Database } from './database'

type JobsLedgerRow = Database['public']['Tables']['jobs_ledger']['Row']
type JobsLedgerMaterial = Database['public']['Tables']['jobs_ledger_materials']['Row']
type JobsLedgerFixture = Database['public']['Tables']['jobs_ledger_fixtures']['Row']
type JobsLedgerPayment = Database['public']['Tables']['jobs_ledger_payments']['Row']
type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type JobsLedgerTeamMember = Database['public']['Tables']['jobs_ledger_team_members']['Row']

export type JobWithDetails = JobsLedgerRow & {
  materials: JobsLedgerMaterial[]
  fixtures: JobsLedgerFixture[]
  payments: JobsLedgerPayment[]
  invoices: JobsLedgerInvoice[]
  team_members: (JobsLedgerTeamMember & { users: { name: string } | null })[]
  report_count?: number
  project?: { id: string; name: string } | null
}
