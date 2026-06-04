-- Update revoke to set revoked_at/revoked_by; approve to clear them

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
BEGIN
  IF NOT (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) THEN
    RETURN QUERY SELECT 0, 'Access denied'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL
  LOOP
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
  END LOOP;

  RETURN QUERY SELECT v_revoked, NULL::text;
END;
$$;

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
BEGIN
  IF NOT (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) THEN
    RETURN QUERY SELECT 0, 'Access denied'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  LOOP
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

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$$;
