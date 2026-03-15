export type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  users: { name: string | null } | null
  approved_by_user: { name: string | null } | null
  rejected_by_user: { name: string | null } | null
  revoked_by_user: { name: string | null } | null
  jobs_ledger: { hcp_number: string | null; job_name: string | null; job_address: string | null } | null
}
