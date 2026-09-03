SET lock_timeout = '3s';

-- Fix count_pending_clock_session_approvals()'s role gate (v2.2672).
--
-- 20260903020000 copied the approval-powers check from the BASELINE body of
-- approve_clock_sessions — which still referenced
-- is_assistant_of_pay_approved_master(). That helper was dissolved and DROPPED
-- on 2026-07-14 (20260714200000_dissolve_assistant_pay_linkage.sql: every
-- reference rewritten to plain is_assistant()), so the RPC raised "function
-- does not exist" on every call and the Needs You hours-approvals card stayed
-- permanently quiet (the hook fails soft). Same gate, live helper set.

CREATE OR REPLACE FUNCTION public.count_pending_clock_session_approvals()
RETURNS TABLE(sessions integer, total_hours numeric, people integer, oldest_work_date date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RETURN QUERY SELECT 0, 0::numeric, 0, NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::int,
    COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric, 1), 0),
    COUNT(DISTINCT cs.user_id)::int,
    MIN(cs.work_date)
  FROM public.clock_sessions cs
  WHERE cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL;
END;
$$;
