export type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
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
  bids: { bid_number: string | null; project_name: string | null; address: string | null; customers: { name: string | null } | null } | null
}

/** Job or bid one-line label for display; null if neither is linked. */
export function formatClockSessionJobOrBidLabel(s: ClockSessionRow): string | null {
  if (s.jobs_ledger) {
    return `J${(s.jobs_ledger.hcp_number || '').trim() || '—'} · ${s.jobs_ledger.job_name || '—'} - ${s.jobs_ledger.job_address || '—'}`
  }
  if (s.bids) {
    return `B${(s.bids.bid_number || '').trim() || '—'} · ${s.bids.project_name || '—'} - ${s.bids.address || s.bids.customers?.name || '—'}`
  }
  return null
}
