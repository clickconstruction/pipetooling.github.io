/**
 * One row of a person's license hours log (`list_user_license_hours_log`, `my_logbook()`, `my_week()`): a types file of
 * its own, so the kernels that run on the edge (the Your week email, punch list #255 v2.6607) can take the type without
 * the log's code.
 */
export type LicenseHoursLogRow = {
  session_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string
  hours: number
  job_ledger_id: string | null
  job_number: string
  job_name: string
  job_address: string
  service_type_name: string
  bid_id: string | null
  notes: string
}
