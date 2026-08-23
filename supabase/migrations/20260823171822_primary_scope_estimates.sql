SET lock_timeout = '3s';

-- Primary scoping, part 2 of 3 — ESTIMATES (v2.2175).
--
-- Owner rule: a primary sees only estimates they created and sent themselves
-- (created_by is the proxy — the table has no sent_by) or that hang off a job
-- they are the Account Man for. Same RESTRICTIVE-policy mechanism as part 1
-- (20260823171344_primary_scope_bids.sql, which declares is_primary() and
-- primary_can_access_estimate()). No-op for every other role. Idempotent.

-- estimates: INSERT must check the NEW row (created_by = me, or AM on its job).
DROP POLICY IF EXISTS primary_scope_estimates ON public.estimates;
CREATE POLICY primary_scope_estimates ON public.estimates AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary())
          OR created_by = (SELECT auth.uid())
          OR (job_ledger_id IS NOT NULL AND public.primary_can_access_job(job_ledger_id)) )
  WITH CHECK ( NOT (SELECT public.is_primary())
          OR created_by = (SELECT auth.uid())
          OR (job_ledger_id IS NOT NULL AND public.primary_can_access_job(job_ledger_id)) );

-- Thread notes follow their estimate.
DROP POLICY IF EXISTS primary_scope_estimates_thread_notes ON public.estimates_thread_notes;
CREATE POLICY primary_scope_estimates_thread_notes ON public.estimates_thread_notes AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary()) OR public.primary_can_access_estimate(estimate_id) )
  WITH CHECK ( NOT (SELECT public.is_primary()) OR public.primary_can_access_estimate(estimate_id) );
