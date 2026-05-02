-- Approve/revoke/NCNS + salary split: resolve people.id for clock users; merge hours on people_hours by person_id.

CREATE OR REPLACE FUNCTION public.resolve_pay_person_id_from_clock_user(p_user_id uuid, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_cnt int;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT p.id INTO v_id
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND p.account_user_id = p_user_id
    ORDER BY p.id
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_display_name IS NULL OR btrim(p_display_name) = '' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_cnt
  FROM public.people p
  WHERE p.archived_at IS NULL
    AND btrim(p.name) = btrim(p_display_name);

  IF v_cnt = 1 THEN
    SELECT p.id INTO v_id
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND btrim(p.name) = btrim(p_display_name)
    LIMIT 1;
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.resolve_pay_person_id_from_clock_user(uuid, text) IS
  'Resolve roster id for pay: people.account_user_id first, else unique trim(name) match among active people.';

CREATE OR REPLACE FUNCTION public.people_hours_subtract_approved_hours(
  p_user_id uuid,
  p_person_name text,
  p_work_date date,
  p_hours numeric,
  p_entered_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_new numeric;
BEGIN
  IF p_hours IS NULL OR p_hours <= 0 THEN
    RETURN;
  END IF;

  v_pid := public.resolve_pay_person_id_from_clock_user(p_user_id, p_person_name);

  UPDATE public.people_hours ph
  SET hours = ph.hours - p_hours,
      entered_by = COALESCE(p_entered_by, ph.entered_by)
  WHERE ph.work_date = p_work_date
    AND (
      (v_pid IS NOT NULL AND ph.person_id = v_pid)
      OR (v_pid IS NULL AND ph.person_name = p_person_name)
    )
  RETURNING ph.hours INTO v_new;

  IF FOUND THEN
    IF v_new <= 0 THEN
      DELETE FROM public.people_hours ph2
      WHERE ph2.work_date = p_work_date
        AND (
          (v_pid IS NOT NULL AND ph2.person_id = v_pid)
          OR (v_pid IS NULL AND ph2.person_name = p_person_name)
        );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.people_hours_subtract_approved_hours(uuid, text, date, numeric, uuid) IS
  'Revoke/split-style rollback: subtract closed approved hours from people_hours matching person_id or legacy person_name.';

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
  v_person_id uuid;
BEGIN
  v_pay :=
    public.is_pay_approved_master()
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

    v_person_id := public.resolve_pay_person_id_from_clock_user(v_session.user_id, v_session.person_name);

    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by, person_id)
    VALUES (v_session.person_name, v_session.work_date, v_hours, auth.uid(), v_person_id)
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      entered_by = EXCLUDED.entered_by,
      person_id = COALESCE(public.people_hours.person_id, EXCLUDED.person_id);

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

COMMENT ON FUNCTION public.approve_clock_sessions(UUID[]) IS
  'Approve clock sessions and merge hours. Pay access OR team leader for session user. Writes people_hours.person_id when resolvable.';

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
  v_person_id uuid;
BEGIN
  v_pay :=
    public.is_pay_approved_master()
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

    v_person_id := public.resolve_pay_person_id_from_clock_user(v_session.user_id, v_session.person_name);

    UPDATE public.people_hours
    SET hours = hours - v_hours,
        entered_by = auth.uid()
    WHERE work_date = v_session.work_date
      AND (
        (v_person_id IS NOT NULL AND person_id = v_person_id)
        OR (v_person_id IS NULL AND person_name = v_session.person_name)
      )
    RETURNING hours INTO v_new_hours;

    IF FOUND THEN
      IF v_new_hours <= 0 THEN
        DELETE FROM public.people_hours
        WHERE work_date = v_session.work_date
          AND (
            (v_person_id IS NOT NULL AND person_id = v_person_id)
            OR (v_person_id IS NULL AND person_name = v_session.person_name)
          );
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

COMMENT ON FUNCTION public.revoke_clock_sessions(UUID[]) IS
  'Revoke approved clock sessions. Pay access OR team leader for session user. Matches people_hours by person_id when resolvable.';

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
      PERFORM public.people_hours_subtract_approved_hours(
        v_session.user_id,
        v_session.person_name,
        v_session.work_date,
        v_hours,
        auth.uid()
      );
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
  'Record NCNS incident and reject all closed sessions for user/day; unwinds people_hours for approved sessions (person_id-aware).';
