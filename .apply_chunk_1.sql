CREATE OR REPLACE FUNCTION public.can_edit_clock_sessions_for_user(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_target_user_id IS NOT NULL
    AND (
      p_target_user_id = auth.uid()
      OR public.is_team_lead_for_member(auth.uid(), p_target_user_id)
      OR public.is_pay_approved_master()
      OR public.is_assistant_of_pay_approved_master()
    );
$$;

COMMENT ON FUNCTION public.can_edit_clock_sessions_for_user(uuid) IS
  'True if the caller may edit clock sessions for the target user (self, team lead, or pay access).';

GRANT EXECUTE ON FUNCTION public.can_edit_clock_sessions_for_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leader_split_clock_session_segments(
  p_session_id uuid,
  p_segments jsonb
)
RETURNS TABLE(inserted_ids uuid[], error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_parent public.clock_sessions%ROWTYPE;
  v_tz text := 'America/Denver';
  v_today date;
  v_week_start date;
  v_week_end date;
  v_prev_week_start date;
  v_prev_week_end date;
  v_n int;
  v_i int;
  v_elem jsonb;
  v_in timestamptz;
  v_out timestamptz;
  v_out_null boolean;
  v_notes text;
  v_person_name text;
  v_hours numeric;
  v_new_hours numeric;
  v_eps double precision := 1.0;
  v_min_h numeric := 0.01;
  v_prev_out timestamptz;
  v_is_open_parent boolean;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_work date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Not authenticated'::text;
    RETURN;
  END IF;

  IF jsonb_typeof(p_segments) <> 'array' OR jsonb_array_length(p_segments) < 2 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least two segments'::text;
    RETURN;
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_week_start := v_today - EXTRACT(DOW FROM v_today)::integer;
  v_week_end := v_week_start + 6;
  v_prev_week_start := v_week_start - 7;
  v_prev_week_end := v_week_end - 7;

  SELECT * INTO v_parent
  FROM public.clock_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Session not found'::text;
    RETURN;
  END IF;

  IF NOT public.can_edit_clock_sessions_for_user(v_parent.user_id) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Access denied'::text;
    RETURN;
  END IF;

  IF v_parent.rejected_at IS NOT NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Rejected sessions cannot be split'::text;
    RETURN;
  END IF;

  IF v_parent.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Revoked sessions cannot be split'::text;
    RETURN;
  END IF;

  IF NOT (
    (v_parent.work_date >= v_week_start AND v_parent.work_date <= v_week_end)
    OR (v_parent.work_date >= v_prev_week_start AND v_parent.work_date <= v_prev_week_end)
  ) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable this or last week (America/Denver)'::text;
    RETURN;
  END IF;

  v_is_open_parent := v_parent.clocked_out_at IS NULL;
  v_n := jsonb_array_length(p_segments);

  FOR v_i IN 0 .. (v_n - 1) LOOP
    v_elem := p_segments -> v_i;
    IF v_elem IS NULL OR jsonb_typeof(v_elem) <> 'object' THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Invalid segment payload'::text;
      RETURN;
    END IF;

    IF v_elem->>'clocked_in_at' IS NULL OR v_elem->>'clocked_in_at' = '' THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Each segment needs clocked_in_at'::text;
      RETURN;
    END IF;

    v_in := (v_elem->>'clocked_in_at')::timestamptz;

    v_out_null := (v_elem->'clocked_out_at' IS NULL)
      OR (v_elem->>'clocked_out_at' IS NOT NULL AND v_elem->>'clocked_out_at' = '');
    IF NOT v_out_null THEN
      v_out := (v_elem->>'clocked_out_at')::timestamptz;
    ELSE
      v_out := NULL;
    END IF;

    v_notes := trim(both from coalesce(v_elem->>'notes', ''));
    IF v_notes = '' THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Notes are required for each segment'::text;
      RETURN;
    END IF;

    IF v_i = 0 THEN
      IF abs(EXTRACT(EPOCH FROM (v_in - v_parent.clocked_in_at))) > v_eps THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'First segment must start at the original clock-in time'::text;
        RETURN;
      END IF;
    ELSE
      IF v_prev_out IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the last segment may be open (no clock-out)'::text;
        RETURN;
      END IF;
      IF abs(EXTRACT(EPOCH FROM (v_in - v_prev_out))) > v_eps THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Segments must be contiguous'::text;
        RETURN;
      END IF;
    END IF;

    IF NOT v_is_open_parent THEN
      IF v_out IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'All segments must be closed for a closed session'::text;
        RETURN;
      END IF;
      IF v_in >= v_out THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Each segment must have clock-out after clock-in'::text;
        RETURN;
      END IF;
      IF (EXTRACT(EPOCH FROM (v_out - v_in)) / 3600.0) < v_min_h THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Each part must be at least 0.01 hours'::text;
        RETURN;
      END IF;
      IF v_out > now() THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Clock-out cannot be in the future'::text;
        RETURN;
      END IF;
      v_prev_out := v_out;
    ELSE
      IF v_i < v_n - 1 THEN
        IF v_out IS NULL THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the final segment may be open for an open session'::text;
          RETURN;
        END IF;
        IF v_in >= v_out THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Each closed part must have clock-out after clock-in'::text;
          RETURN;
        END IF;
        IF (EXTRACT(EPOCH FROM (v_out - v_in)) / 3600.0) < v_min_h THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Each part must be at least 0.01 hours'::text;
          RETURN;
        END IF;
        IF v_out > now() THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Clock-out cannot be in the future'::text;
          RETURN;
        END IF;
        v_prev_out := v_out;
      ELSE
        IF v_out IS NOT NULL THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Final segment of an open session must stay open'::text;
          RETURN;
        END IF;
        IF v_in >= now() THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Open segment must start before now'::text;
          RETURN;
        END IF;
        IF (EXTRACT(EPOCH FROM (now() - v_in)) / 3600.0) < v_min_h THEN
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Open segment must be at least 0.01 hours so far'::text;
          RETURN;
        END IF;
        v_prev_out := NULL;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_is_open_parent THEN
    IF abs(EXTRACT(EPOCH FROM (v_prev_out - v_parent.clocked_out_at))) > v_eps THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Last segment must end at the original clock-out time'::text;
      RETURN;
    END IF;
  END IF;

  IF v_parent.approved_at IS NOT NULL AND v_parent.clocked_out_at IS NOT NULL THEN
    SELECT trim(both from u.name) INTO v_person_name
    FROM public.users u
    WHERE u.id = v_parent.user_id;

    IF v_person_name IS NULL OR v_person_name = '' THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'User has no name'::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_parent.clocked_out_at - v_parent.clocked_in_at)) / 3600.0;
    IF v_hours > 0 THEN
      UPDATE public.people_hours
      SET hours = hours - v_hours,
          entered_by = v_uid
      WHERE person_name = v_person_name
        AND work_date = v_parent.work_date
      RETURNING hours INTO v_new_hours;

      IF FOUND THEN
        IF v_new_hours <= 0 THEN
          DELETE FROM public.people_hours
          WHERE person_name = v_person_name
            AND work_date = v_parent.work_date;
        END IF;
      END IF;
    END IF;

    IF v_parent.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_person_name, v_parent.work_date);
    END IF;
    IF v_parent.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_person_name, v_parent.work_date);
    END IF;
  END IF;

  DELETE FROM public.clock_sessions WHERE id = p_session_id;

  FOR v_i IN 0 .. (v_n - 1) LOOP
    v_elem := p_segments -> v_i;
    v_in := (v_elem->>'clocked_in_at')::timestamptz;
    v_out_null := (v_elem->'clocked_out_at' IS NULL)
      OR (v_elem->>'clocked_out_at' IS NOT NULL AND v_elem->>'clocked_out_at' = '');
    IF NOT v_out_null THEN
      v_out := (v_elem->>'clocked_out_at')::timestamptz;
    ELSE
      v_out := NULL;
    END IF;
    v_notes := trim(both from coalesce(v_elem->>'notes', ''));

    v_work := (v_in AT TIME ZONE v_tz)::date;

    INSERT INTO public.clock_sessions (
      user_id,
      clocked_in_at,
      clocked_out_at,
      work_date,
      notes,
      job_ledger_id,
      bid_id,
      clock_in_lat,
      clock_in_lng,
      clock_out_lat,
      clock_out_lng
    )
    VALUES (
      v_parent.user_id,
      v_in,
      v_out,
      v_work,
      v_notes,
      v_parent.job_ledger_id,
      v_parent.bid_id,
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_new_id;

    v_ids := array_append(v_ids, v_new_id);
  END LOOP;

  UPDATE public.clock_sessions
  SET clock_in_lat = v_parent.clock_in_lat,
      clock_in_lng = v_parent.clock_in_lng
  WHERE id = v_ids[1];

  FOR v_i IN REVERSE (v_n - 1) .. 0 LOOP
    v_elem := p_segments -> v_i;
    v_out_null := (v_elem->'clocked_out_at' IS NULL)
      OR (v_elem->>'clocked_out_at' IS NOT NULL AND v_elem->>'clocked_out_at' = '');
    IF NOT v_out_null THEN
      UPDATE public.clock_sessions
      SET clock_out_lat = v_parent.clock_out_lat,
          clock_out_lng = v_parent.clock_out_lng
      WHERE id = v_ids[v_i + 1];
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_ids, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.leader_split_clock_session_segments(uuid, jsonb) IS
  'Like split_own_clock_session_segments for self, team lead, or pay access.';

REVOKE ALL ON FUNCTION public.leader_split_clock_session_segments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leader_split_clock_session_segments(uuid, jsonb) TO authenticated;