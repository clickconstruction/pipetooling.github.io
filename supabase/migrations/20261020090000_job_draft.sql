SET lock_timeout = '3s';

-- An estimator's job draft rides the Dispatch request (punch list #129 follow-up, the owner's call of 2026-10-20). An
-- estimator reads no job row and may not insert one, so the won bid's Job block no longer offers them New Job: they
-- send Dispatch a short draft (the job's name, address, GC, the figure it starts at, the trade, a wanted-by day and a
-- note), and the inbox's Open the job opens New Job with it laid over the bid's own import. Scheduling stays with the
-- assistant. Two pieces:
--   1. The draft rides dispatch_requests.pending_payload as {"job_draft": {...}} (the column v2.1615 made for a pending
--      action's own context), as the client's kernel writes it (lib/bids/jobDraft.ts, version 1). The request's own
--      policies hold it: the sender inserts and reads their row, Dispatch and devs read and close it. Only the
--      column's comment changes here.
--   2. list_bid_jobs_opened(p_bid_ids) — the jobs opened from each bid, newest first, for the roles that work bids
--      (the office and estimators), so the Job block of a bid an estimator won says "J878 opened from this bid" instead
--      of offering a second job (BP166, found on the live walk). Only the job's number and name leave; jobs_ledger's
--      policies are unchanged.
-- Idempotent: COMMENT ON, CREATE OR REPLACE.

COMMENT ON COLUMN public.dispatch_requests.pending_payload IS
  'Structured context for pending_action flows (v2.1615). find_property_owner: {"supply_houses": [{"id","label","email"}]} — the supply house(s) the requester wants the job account at. open_job_from_bid (v2.5659): {"job_draft": {v, jobName, address, gcKey, gcName, carry, serviceTypeId, wantedBy, note}} — an estimator''s draft of the job, laid over the bid''s import when the inbox opens New Job.';

CREATE OR REPLACE FUNCTION public.list_bid_jobs_opened(p_bid_ids uuid[])
RETURNS TABLE (
  bid_id uuid,
  job_id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.bid_id, j.id, j.hcp_number, j.click_number, j.job_name, j.created_at
  FROM public.jobs_ledger j
  WHERE j.bid_id = ANY (COALESCE(p_bid_ids, '{}'::uuid[]))
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
    )
  ORDER BY j.bid_id, j.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_bid_jobs_opened(uuid[]) IS
  'The jobs opened from each bid (jobs_ledger.bid_id), newest first: id, number and name only, for the office and estimators (punch list #129 follow-up, v2.5659). The won bid''s Job block reads it so an estimator, who reads no job row, sees the job their bid opened. Nothing for any other role.';

REVOKE ALL ON FUNCTION public.list_bid_jobs_opened(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_jobs_opened(uuid[]) TO authenticated, service_role;
