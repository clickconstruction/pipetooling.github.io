-- Allow team leaders (without pay tab) to approve/revoke clock sessions for assigned members.

CREATE OR REPLACE FUNCTION public.approve_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(approved_count int, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
  v_session RECORD;
  v_hours numeric;
  v_to_sync RECORD;
  v_pay boolean;
BEGIN
  v_pay := public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  LOOP
    IF NOT v_pay THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by)
    VALUES (v_session.person_name, v_session.work_date, v_hours, auth.uid())
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      entered_by = EXCLUDED.entered_by;

    UPDATE public.clock_sessions
    SET approved_at = NOW(), approved_by = auth.uid(),
        revoked_at = NULL, revoked_by = NULL
    WHERE id = v_session.id;

    v_approved := v_approved + 1;
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.job_ledger_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.bid_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_bids_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.approve_clock_sessions(UUID[]) IS 'Approve clock sessions and merge hours. Pay access OR team leader for session user.';

CREATE OR REPLACE FUNCTION public.revoke_clock_sessions(p_session_ids UUID[])
RETURNS TABLE(revoked_count int, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_revoked int := 0;
  v_session RECORD;
  v_hours numeric;
  v_new_hours numeric;
  v_pay boolean;
BEGIN
  v_pay := public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
  LOOP
    IF NOT v_pay THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

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

    UPDATE public.clock_sessions
    SET approved_at = NULL, approved_by = NULL,
        revoked_at = NOW(), revoked_by = auth.uid()
    WHERE id = v_session.id;

    v_revoked := v_revoked + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_revoked, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.revoke_clock_sessions(UUID[]) IS 'Revoke approved clock sessions. Pay access OR team leader for session user.';
