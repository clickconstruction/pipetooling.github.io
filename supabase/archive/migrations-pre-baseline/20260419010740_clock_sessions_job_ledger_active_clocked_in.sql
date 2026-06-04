-- Job Detail + lists: filter by job_ledger_id, non-revoked, order by clocked_in_at (LIMIT).
-- Without this index, large clock_sessions tables can sequential-scan under RLS.

CREATE INDEX IF NOT EXISTS idx_clock_sessions_job_ledger_active_clocked_in
  ON public.clock_sessions (job_ledger_id, clocked_in_at)
  WHERE job_ledger_id IS NOT NULL AND revoked_at IS NULL;

COMMENT ON INDEX public.idx_clock_sessions_job_ledger_active_clocked_in IS
  'Partial index for sessions tied to a job, excluding revoked rows; supports ORDER BY clocked_in_at.';
