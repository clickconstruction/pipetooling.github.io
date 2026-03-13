-- RPC to approve clock sessions and merge hours into people_hours atomically

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
  -- Caller must have pay access (matches people_hours policy)
  IF NOT (public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master() OR public.is_assistant()) THEN
    RETURN QUERY SELECT 0, 'Access denied'::text;
    RETURN;
  END IF;

  -- Process each session: upsert people_hours and mark approved
  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
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
    SET approved_at = NOW(), approved_by = auth.uid()
    WHERE id = v_session.id;

    v_approved := v_approved + 1;
  END LOOP;

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.approve_clock_sessions(UUID[]) IS 'Approve clock sessions and merge hours into people_hours. Caller must have pay access.';
