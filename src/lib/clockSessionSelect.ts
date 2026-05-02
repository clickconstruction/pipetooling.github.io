/** Select for dashboard today clock strip (work_date = today): times, memo, job/bid embeds. */
export const CLOCK_SESSION_TODAY_STRIP_SELECT =
  'id, user_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at, notes, job_ledger_id, bid_id, origin, salary_segment_index, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, clock_in_location_source, clock_out_location_source, users!clock_sessions_user_id_fkey(name), jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))'

/** Month grid + day modal: own sessions with job/bid embeds (no GPS / approver joins). */
export const CLOCK_SESSION_CALENDAR_SELECT =
  'id, user_id, work_date, clocked_in_at, clocked_out_at, approved_at, notes, job_ledger_id, bid_id, origin, salary_segment_index, rejected_at, revoked_at, jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))'

/** Shared PostgREST select for clock session lists with joins (People Hours, Dashboard My Team, etc.). */
export const CLOCK_SESSION_LIST_SELECT =
  'id, user_id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, origin, salary_segment_index, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, clock_in_location_source, clock_out_location_source, approved_at, approved_by, rejected_at, rejected_by, revoked_at, revoked_by, users!clock_sessions_user_id_fkey(name), approved_by_user:users!clock_sessions_approved_by_fkey(name), rejected_by_user:users!clock_sessions_rejected_by_fkey(name), revoked_by_user:users!clock_sessions_revoked_by_fkey(name), jobs_ledger!clock_sessions_job_ledger_id_fkey(hcp_number, job_name, job_address, service_type_id), bids!clock_sessions_bid_id_fkey(bid_number, project_name, address, service_type_id, customers(name))'
