-- Add `(job_ledger_id, user_id)` index on `clock_sessions` to make the two
-- `EXISTS (SELECT 1 FROM clock_sessions cs WHERE cs.job_ledger_id = jobs_ledger.id ...)`
-- USING clauses on `jobs_ledger` index-lookup instead of seq-scanning the table:
--
--   - "Users can read jobs ledger linked from own clock sessions":
--       ... AND cs.user_id = auth.uid()
--   - "Team leads can read jobs ledger for member clock sessions":
--       ... AND is_team_lead_for_member(auth.uid(), cs.user_id)
--
-- Without this composite, the planner picks Seq Scan on `clock_sessions`
-- inside the SubPlan for every `jobs_ledger` row read, which on
-- 2026-05-16T17:02Z surfaced as a 500 burst on
--   GET /rest/v1/jobs_ledger?select=*&order=hcp_number.desc
-- (PostgREST hit the 2-min `statement_timeout` under modest concurrency).
--
-- Captured plan as the dev role on the bare `SELECT * FROM jobs_ledger
-- ORDER BY hcp_number DESC` showed:
--   * Execution Time: 174.707 ms
--   * Buffers: shared hit=6031
--   * Two `Seq Scan on clock_sessions` SubPlans, each removing ~1000 rows
--
-- Existing complement index `idx_clock_sessions_job_ledger_active_clocked_in`
-- is on `(job_ledger_id, clocked_in_at)` which doesn't cover `user_id`.
-- Partial `WHERE job_ledger_id IS NOT NULL` matches the EXISTS predicates
-- and keeps the index small (bid-only and unassigned sessions are excluded).

CREATE INDEX IF NOT EXISTS idx_clock_sessions_job_ledger_user
  ON public.clock_sessions (job_ledger_id, user_id)
  WHERE job_ledger_id IS NOT NULL;

ANALYZE public.clock_sessions;
