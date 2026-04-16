-- Rejected + approved_at set: restore_rejected previously skipped those rows (approved_at IS NULL),
-- so "Return to pending" did nothing. Unwind people_hours like revoke, then clear rejection.
-- SECURITY DEFINER: dev callers are not in pay people_hours policies; invoker would no-op hours.

CREATE OR REPLACE FUNCTION public.restore_rejected_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(restored_count int, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored int := 0;
  v_session RECORD;
  v_pay boolean;
  v_dev boolean;
  v_hours numeric;
  v_new_hours numeric;
BEGIN
  v_pay := public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();
  v_dev := public.is_dev();

  FOR v_session IN
    SELECT
      cs.id,
      cs.user_id,
      cs.clocked_in_at,
      cs.clocked_out_at,
      cs.work_date,
      trim(u.name) AS person_name,
      cs.approved_at,
      cs.job_ledger_id,
      cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.rejected_at IS NOT NULL
  LOOP
    IF NOT v_pay AND NOT v_dev THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    IF v_session.approved_at IS NOT NULL THEN
      v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
      IF v_hours > 0 THEN
        UPDATE public.people_hours
        SET hours = hours - v_hours,
            entered_by = auth.uid()
        WHERE person_name = v_session.person_name
          AND work_date = v_session.work_date
        RETURNING hours INTO v_new_hours;

        IF FOUND THEN
          IF v_new_hours <= 0 THEN
            DELETE FROM public.people_hours
            WHERE person_name = v_session.person_name
              AND work_date = v_session.work_date;
          END IF;
        END IF;
      END IF;

      UPDATE public.clock_sessions
      SET approved_at = NULL, approved_by = NULL
      WHERE id = v_session.id;

      IF v_session.job_ledger_id IS NOT NULL THEN
        PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
      END IF;
      IF v_session.bid_id IS NOT NULL THEN
        PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
      END IF;
    END IF;

    UPDATE public.clock_sessions
    SET rejected_at = NULL, rejected_by = NULL
    WHERE id = v_session.id;

    v_restored := v_restored + 1;
  END LOOP;

  RETURN QUERY SELECT v_restored, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.restore_rejected_clock_sessions(UUID[]) IS
  'Clear rejection (return to Pending). If session was still approved, unwind people_hours and crew sync like revoke first. Pay, dev, or team lead. SECURITY DEFINER; auth enforced inside.';

GRANT EXECUTE ON FUNCTION public.restore_rejected_clock_sessions(UUID[]) TO authenticated;
