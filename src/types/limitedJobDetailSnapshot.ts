/** Read-only job fields for users without full `jobs_ledger` child-table SELECT (e.g. subcontractors). */
export type LimitedJobDetailSnapshot = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_plans_link: string | null
  revenue: number | null
  project_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  last_bill_date: string | null
  last_work_date: string | null
  status: string
}
