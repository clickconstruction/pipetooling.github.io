/** Read-only job fields for users without full `jobs_ledger` child-table SELECT (e.g. subcontractors). */
export type LimitedJobDetailSnapshot = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  google_drive_link: string | null
  job_pictures_link: string | null
  job_plans_link: string | null
  revenue: number | null
  project_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  /** GC (General Contractor) name via the `gc_customer_id` embed, when set (v2.1176). */
  gc_customer_name: string | null
  /** Development (group of jobs) name via the `development_id` embed, when set (v2.1199). */
  development_name: string | null
  last_work_date: string | null
  status: string
  /** When present from `jobs_ledger` + `service_types` join. */
  service_type_name: string | null
}
