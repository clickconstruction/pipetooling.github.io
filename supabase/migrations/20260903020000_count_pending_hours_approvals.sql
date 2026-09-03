SET lock_timeout = '3s';

-- Pending hours-approvals count for the Dashboard "Needs you" card (v2.2671).
--
-- The Aug 2026 approvals stall (3 weeks of zero approvals, 152 sessions / 799h
-- pending) had no surface anywhere near the people who could fix it — the only
-- indicator lived on People → Overhead, a tab nobody visits daily. This RPC
-- feeds a Needs You item so a stale approvals queue shows up where the day
-- starts.
--
-- The gate lives IN the function (list_bulk_deletion_alerts precedent) so the
-- card and the numbers can never disagree: callers without approval powers get
-- the zero row, and the client hook needs no role logic. Counts every CLOSED
-- pending session (approved/rejected/revoked all NULL) regardless of origin —
-- salary_schedule rows drain via auto_approve_salary_clock_sessions within the
-- hour, so with the card's 3-day age gate they can never trigger it alone.

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
    OR public.is_assistant_of_pay_approved_master()
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

COMMENT ON FUNCTION public.count_pending_clock_session_approvals() IS
  'Closed clock sessions awaiting approval (count, hours, people, oldest work_date) for the Needs You card. Gate inside: pay-approval roles get real numbers, everyone else the zero row.';

GRANT EXECUTE ON FUNCTION public.count_pending_clock_session_approvals() TO authenticated;
