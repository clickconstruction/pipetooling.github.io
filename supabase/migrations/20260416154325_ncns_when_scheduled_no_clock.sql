-- NCNS when user has job_schedule_blocks on work_date but no clock_sessions: still insert attendance_incidents.

CREATE OR REPLACE FUNCTION public.record_ncns_and_reject_sessions_for_day(
  p_subject_user_id uuid,
  p_work_date date,
  p_details text DEFAULT NULL
)
RETURNS TABLE(rejected_count int, had_approved_sessions boolean, error_message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay boolean;
  v_count int;
  v_had_approved boolean;
  v_has_open boolean;
  v_bad_name boolean;
  v_rejected int := 0;
  v_session RECORD;
  v_hours numeric;
  v_new_hours numeric;
BEGIN
  v_pay :=
    public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant();

  IF NOT v_pay THEN
    IF NOT public.is_team_lead_for_member(auth.uid(), p_subject_user_id) THEN
      RETURN QUERY SELECT 0, false, 'Access denied'::text;
      RETURN;
    END IF;
  END IF;

  SELECT
    COUNT(*)::int,
    COALESCE(BOOL_OR(cs.approved_at IS NOT NULL), false),
    COALESCE(BOOL_OR(cs.clocked_out_at IS NULL), false),
    COALESCE(
      BOOL_OR(
        trim(u.name) IS NULL
        OR trim(u.name) = ''
      ),
      false
    )
  INTO v_count, v_had_approved, v_has_open, v_bad_name
  FROM public.clock_sessions cs
  INNER JOIN public.users u ON u.id = cs.user_id
  WHERE cs.user_id = p_subject_user_id
    AND cs.work_date = p_work_date
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL;

  IF v_count IS NULL OR v_count = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.job_schedule_blocks jsb
      WHERE jsb.assignee_user_id = p_subject_user_id
        AND jsb.work_date = p_work_date
      LIMIT 1
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM public.attendance_incidents ai
        WHERE ai.subject_user_id = p_subject_user_id
          AND ai.work_date = p_work_date
          AND ai.incident_type = 'no_call_no_show'
        LIMIT 1
      ) THEN
        RETURN QUERY SELECT 0, false, 'NCNS already recorded for this day'::text;
        RETURN;
      END IF;

      INSERT INTO public.attendance_incidents (
        subject_user_id,
        work_date,
        created_by_user_id,
        metadata,
        details
      )
      VALUES (
        p_subject_user_id,
        p_work_date,
        auth.uid(),
        jsonb_build_object(
          'had_approved_sessions', false,
          'source', 'my_time_day_editor',
          'scheduled_without_clock', true,
          'rejected_session_count', 0
        ),
        NULLIF(TRIM(p_details), '')
      );

      RETURN QUERY SELECT 0, false, NULL::text;
      RETURN;
    END IF;

    RETURN QUERY SELECT 0, COALESCE(v_had_approved, false), 'No sessions or schedule for this day'::text;
    RETURN;
  END IF;

  IF v_bad_name THEN
    RETURN QUERY SELECT 0, v_had_approved, 'User has no name for one or more sessions'::text;
    RETURN;
  END IF;

  IF v_has_open THEN
    RETURN QUERY SELECT 0, v_had_approved, 'Clock out all sessions before recording NCNS'::text;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT
      cs.id,
      cs.user_id,
      cs.clocked_in_at,
      cs.clocked_out_at,
      cs.work_date,
      cs.approved_at,
      trim(u.name) AS person_name,
      cs.job_ledger_id,
      cs.bid_id
    FROM public.clock_sessions cs
    INNER JOIN public.users u ON u.id = cs.user_id
    WHERE cs.user_id = p_subject_user_id
      AND cs.work_date = p_work_date
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
    ORDER BY cs.clocked_in_at ASC, cs.id ASC
  LOOP
    IF NOT v_pay THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, v_had_approved, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    v_hours :=
      EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;

    IF v_session.approved_at IS NOT NULL AND v_hours > 0 THEN
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
    SET
      approved_at = NULL,
      approved_by = NULL,
      revoked_at = NULL,
      revoked_by = NULL,
      rejected_at = NOW(),
      rejected_by = auth.uid()
    WHERE id = v_session.id;

    v_rejected := v_rejected + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  INSERT INTO public.attendance_incidents (
    subject_user_id,
    work_date,
    created_by_user_id,
    metadata,
    details
  )
  VALUES (
    p_subject_user_id,
    p_work_date,
    auth.uid(),
    jsonb_build_object(
      'had_approved_sessions', v_had_approved,
      'source', 'my_time_day_editor'
    ),
    NULLIF(TRIM(p_details), '')
  );

  RETURN QUERY SELECT v_rejected, v_had_approved, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.record_ncns_and_reject_sessions_for_day(uuid, date, text) IS
  'Record NCNS incident and reject all closed sessions for user/day; unwinds people_hours for approved sessions. If there are no sessions but assignee has job_schedule_blocks on that date, inserts incident only (scheduled_without_clock). Duplicate NCNS same day rejected. Pay access OR team leader for subject.';
