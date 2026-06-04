-- salary_split_derived: set by split/cluster RPCs when indexed salary_schedule → user_punch; salary_sync closes at template slot ends.

ALTER TABLE public.clock_sessions
  ADD COLUMN IF NOT EXISTS salary_split_derived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clock_sessions.salary_split_derived IS
'True when split/cluster RPCs replaced an indexed salary_schedule segment with user_punch rows; salary_sync may clock out at block boundaries.';

-- Allow splitting indexed salary_schedule rows (segment 1/2): children become user_punch with NULL salary_segment_index.
-- Split-mode salary_sync: skip INSERT for canonical slot 1/2 when any material session overlaps that template window (Option 2).

CREATE OR REPLACE FUNCTION public.split_own_clock_session_segments(
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
  v_tz text := 'America/Chicago';
  v_today date;
  v_week_start date;
  v_week_end date;
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

  SELECT * INTO v_parent
  FROM public.clock_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Session not found'::text;
    RETURN;
  END IF;

  IF v_parent.user_id <> v_uid THEN
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

  IF v_parent.work_date < v_week_start OR v_parent.work_date > v_week_end THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable current week'::text;
    RETURN;
  END IF;

  v_is_open_parent := v_parent.clocked_out_at IS NULL;
  v_n := jsonb_array_length(p_segments);

  -- Validate each segment and contiguous coverage
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
      -- Open parent
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

  -- Roll back approved hours (same as revoke, without setting revoked_at — we delete the row)
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
      origin,
      salary_segment_index,
      salary_split_derived,
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
      CASE
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL THEN 'user_punch'
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NULL THEN 'salary_schedule'
        ELSE v_parent.origin
      END,
      CASE
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL THEN NULL
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NULL AND v_n >= 2 THEN (v_i + 1)::smallint
        ELSE NULL
      END,
      (v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL),
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

COMMENT ON FUNCTION public.split_own_clock_session_segments(uuid, jsonb) IS
  'Replace own clock session with N contiguous segments inside the original span; current week (America/Chicago). Approved sessions: people_hours rollback + crew sync, then delete; new rows pending. Indexed salary_schedule children become user_punch.';

REVOKE ALL ON FUNCTION public.split_own_clock_session_segments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_own_clock_session_segments(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.split_own_clock_session_cluster(
  p_session_ids uuid[],
  p_segments jsonb
)
RETURNS TABLE(inserted_ids uuid[], error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tz text := 'America/Chicago';
  v_today date;
  v_week_start date;
  v_week_end date;
  v_prev_week_start date;
  v_prev_week_end date;
  v_cnt int;
  v_first public.clock_sessions%ROWTYPE;
  v_last public.clock_sessions%ROWTYPE;
  v_prev public.clock_sessions%ROWTYPE;
  v_rec public.clock_sessions%ROWTYPE;
  v_first_iter boolean := true;
  v_gap_ok boolean;
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
  v_is_open_block boolean;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_work date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Not authenticated'::text;
    RETURN;
  END IF;

  IF p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL OR array_length(p_session_ids, 1) < 1 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least one session id'::text;
    RETURN;
  END IF;

  IF jsonb_typeof(p_segments) <> 'array' OR jsonb_array_length(p_segments) < 2 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least two segments'::text;
    RETURN;
  END IF;

  SELECT count(DISTINCT x)::int INTO v_cnt FROM unnest(p_session_ids) AS x;
  IF v_cnt <> array_length(p_session_ids, 1) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Duplicate session ids'::text;
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.clock_sessions WHERE id = ANY (p_session_ids);
  IF v_cnt <> array_length(p_session_ids, 1) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'One or more sessions not found'::text;
    RETURN;
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_week_start := v_today - EXTRACT(DOW FROM v_today)::integer;
  v_week_end := v_week_start + 6;
  v_prev_week_start := v_week_start - 7;
  v_prev_week_end := v_week_end - 7;

  v_prev := NULL;
  FOR v_rec IN
    SELECT * FROM public.clock_sessions
    WHERE id = ANY (p_session_ids)
    ORDER BY clocked_in_at ASC
    FOR UPDATE
  LOOP
    IF v_rec.user_id <> v_uid THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Access denied'::text;
      RETURN;
    END IF;
    IF v_rec.rejected_at IS NOT NULL THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Rejected sessions cannot be split'::text;
      RETURN;
    END IF;
    IF v_rec.revoked_at IS NOT NULL THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Revoked sessions cannot be split'::text;
      RETURN;
    END IF;

    IF NOT (
      (v_rec.work_date >= v_week_start AND v_rec.work_date <= v_week_end)
      OR (v_rec.work_date >= v_prev_week_start AND v_rec.work_date <= v_prev_week_end)
    ) THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable this or last week (America/Chicago)'::text;
      RETURN;
    END IF;

    IF v_first_iter THEN
      v_first := v_rec;
      v_first_iter := false;
    ELSE
      IF v_prev.job_ledger_id IS NOT DISTINCT FROM v_rec.job_ledger_id
         AND v_prev.bid_id IS NOT DISTINCT FROM v_rec.bid_id THEN
        NULL;
      ELSE
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Cluster sessions must share the same job and bid'::text;
        RETURN;
      END IF;
      IF v_prev.clocked_out_at IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the final session in a cluster may be open'::text;
        RETURN;
      END IF;
      v_gap_ok := v_rec.clocked_in_at <= v_prev.clocked_out_at + interval '1 second';
      IF NOT v_gap_ok THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Sessions in cluster must be contiguous'::text;
        RETURN;
      END IF;
    END IF;
    v_prev := v_rec;
    v_last := v_rec;
  END LOOP;

  v_is_open_block := v_last.clocked_out_at IS NULL;
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
      IF abs(EXTRACT(EPOCH FROM (v_in - v_first.clocked_in_at))) > v_eps THEN
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

    IF NOT v_is_open_block THEN
      IF v_out IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'All segments must be closed for a closed block'::text;
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
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the final segment may be open for an open block'::text;
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
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Final segment of an open block must stay open'::text;
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

  IF NOT v_is_open_block THEN
    IF abs(EXTRACT(EPOCH FROM (v_prev_out - v_last.clocked_out_at))) > v_eps THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Last segment must end at the original clock-out time'::text;
      RETURN;
    END IF;
  END IF;

  FOR v_rec IN
    SELECT * FROM public.clock_sessions
    WHERE id = ANY (p_session_ids)
    ORDER BY clocked_in_at ASC
  LOOP
    IF v_rec.approved_at IS NOT NULL AND v_rec.clocked_out_at IS NOT NULL THEN
      SELECT trim(both from u.name) INTO v_person_name
      FROM public.users u
      WHERE u.id = v_rec.user_id;

      IF v_person_name IS NULL OR v_person_name = '' THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'User has no name'::text;
        RETURN;
      END IF;

      v_hours := EXTRACT(EPOCH FROM (v_rec.clocked_out_at - v_rec.clocked_in_at)) / 3600.0;
      IF v_hours > 0 THEN
        UPDATE public.people_hours
        SET hours = hours - v_hours,
            entered_by = v_uid
        WHERE person_name = v_person_name
          AND work_date = v_rec.work_date
        RETURNING hours INTO v_new_hours;

        IF FOUND THEN
          IF v_new_hours <= 0 THEN
            DELETE FROM public.people_hours
            WHERE person_name = v_person_name
              AND work_date = v_rec.work_date;
          END IF;
        END IF;
      END IF;

      IF v_rec.job_ledger_id IS NOT NULL THEN
        PERFORM public.sync_crew_jobs_from_clock(v_person_name, v_rec.work_date);
      END IF;
      IF v_rec.bid_id IS NOT NULL THEN
        PERFORM public.sync_crew_bids_from_clock(v_person_name, v_rec.work_date);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.clock_sessions WHERE id = ANY (p_session_ids);

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
      origin,
      salary_segment_index,
      salary_split_derived,
      clock_in_lat,
      clock_in_lng,
      clock_out_lat,
      clock_out_lng
    )
    VALUES (
      v_first.user_id,
      v_in,
      v_out,
      v_work,
      v_notes,
      v_first.job_ledger_id,
      v_first.bid_id,
      CASE
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL THEN 'user_punch'
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NULL THEN 'salary_schedule'
        ELSE v_first.origin
      END,
      CASE
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL THEN NULL
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NULL AND v_n >= 2 THEN (v_i + 1)::smallint
        ELSE NULL
      END,
      (v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL),
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_new_id;

    v_ids := array_append(v_ids, v_new_id);
  END LOOP;

  UPDATE public.clock_sessions
  SET clock_in_lat = v_first.clock_in_lat,
      clock_in_lng = v_first.clock_in_lng
  WHERE id = v_ids[1];

  FOR v_i IN REVERSE (v_n - 1) .. 0 LOOP
    v_elem := p_segments -> v_i;
    v_out_null := (v_elem->'clocked_out_at' IS NULL)
      OR (v_elem->>'clocked_out_at' IS NOT NULL AND v_elem->>'clocked_out_at' = '');
    IF NOT v_out_null THEN
      UPDATE public.clock_sessions
      SET clock_out_lat = v_last.clock_out_lat,
          clock_out_lng = v_last.clock_out_lng
      WHERE id = v_ids[v_i + 1];
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_ids, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.split_own_clock_session_cluster(uuid[], jsonb) IS
  'Replace N contiguous same-job/bid clock sessions (owner) with M segments; current or previous Chicago week; approved rollback per removed row; new rows pending. Indexed salary_schedule children become user_punch.';

REVOKE ALL ON FUNCTION public.split_own_clock_session_cluster(uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.split_own_clock_session_cluster(uuid[], jsonb) TO authenticated;

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
  v_tz text := 'America/Chicago';
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
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable this or last week (America/Chicago)'::text;
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
      origin,
      salary_segment_index,
      salary_split_derived,
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
      CASE
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL THEN 'user_punch'
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NULL THEN 'salary_schedule'
        ELSE v_parent.origin
      END,
      CASE
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL THEN NULL
        WHEN v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NULL AND v_n >= 2 THEN (v_i + 1)::smallint
        ELSE NULL
      END,
      (v_parent.origin = 'salary_schedule' AND v_parent.salary_segment_index IS NOT NULL),
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
  'Like split_own_clock_session_segments for self, team lead, or pay access. Indexed salary_schedule children become user_punch.';

REVOKE ALL ON FUNCTION public.leader_split_clock_session_segments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leader_split_clock_session_segments(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.leader_split_clock_session_cluster(
  p_session_ids uuid[],
  p_segments jsonb
)
RETURNS TABLE(inserted_ids uuid[], error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tz text := 'America/Chicago';
  v_today date;
  v_week_start date;
  v_week_end date;
  v_prev_week_start date;
  v_prev_week_end date;
  v_cnt int;
  v_first public.clock_sessions%ROWTYPE;
  v_last public.clock_sessions%ROWTYPE;
  v_prev public.clock_sessions%ROWTYPE;
  v_rec public.clock_sessions%ROWTYPE;
  v_first_iter boolean := true;
  v_gap_ok boolean;
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
  v_is_open_block boolean;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_work date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Not authenticated'::text;
    RETURN;
  END IF;

  IF p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL OR array_length(p_session_ids, 1) < 1 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least one session id'::text;
    RETURN;
  END IF;

  IF jsonb_typeof(p_segments) <> 'array' OR jsonb_array_length(p_segments) < 2 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least two segments'::text;
    RETURN;
  END IF;

  SELECT count(DISTINCT x)::int INTO v_cnt FROM unnest(p_session_ids) AS x;
  IF v_cnt <> array_length(p_session_ids, 1) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Duplicate session ids'::text;
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.clock_sessions WHERE id = ANY (p_session_ids);
  IF v_cnt <> array_length(p_session_ids, 1) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'One or more sessions not found'::text;
    RETURN;
  END IF;

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_week_start := v_today - EXTRACT(DOW FROM v_today)::integer;
  v_week_end := v_week_start + 6;
  v_prev_week_start := v_week_start - 7;
  v_prev_week_end := v_week_end - 7;

  v_prev := NULL;
  FOR v_rec IN
    SELECT * FROM public.clock_sessions
    WHERE id = ANY (p_session_ids)
    ORDER BY clocked_in_at ASC
    FOR UPDATE
  LOOP
    IF NOT public.can_edit_clock_sessions_for_user(v_rec.user_id) THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Access denied'::text;
      RETURN;
    END IF;
    IF v_rec.rejected_at IS NOT NULL THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Rejected sessions cannot be split'::text;
      RETURN;
    END IF;
    IF v_rec.revoked_at IS NOT NULL THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Revoked sessions cannot be split'::text;
      RETURN;
    END IF;

    IF NOT (
      (v_rec.work_date >= v_week_start AND v_rec.work_date <= v_week_end)
      OR (v_rec.work_date >= v_prev_week_start AND v_rec.work_date <= v_prev_week_end)
    ) THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable this or last week (America/Chicago)'::text;
      RETURN;
    END IF;

    IF v_first_iter THEN
      v_first := v_rec;
      v_first_iter := false;
    ELSE
      IF v_prev.user_id IS DISTINCT FROM v_rec.user_id THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Cluster sessions must belong to the same user'::text;
        RETURN;
      END IF;
      IF v_prev.job_ledger_id IS NOT DISTINCT FROM v_rec.job_ledger_id
         AND v_prev.bid_id IS NOT DISTINCT FROM v_rec.bid_id THEN
        NULL;
      ELSE
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Cluster sessions must share the same job and bid'::text;
        RETURN;
      END IF;
      IF v_prev.clocked_out_at IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the final session in a cluster may be open'::text;
        RETURN;
      END IF;
      v_gap_ok := v_rec.clocked_in_at <= v_prev.clocked_out_at + interval '1 second';
      IF NOT v_gap_ok THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'Sessions in cluster must be contiguous'::text;
        RETURN;
      END IF;
    END IF;
    v_prev := v_rec;
    v_last := v_rec;
  END LOOP;

  v_is_open_block := v_last.clocked_out_at IS NULL;
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
      IF abs(EXTRACT(EPOCH FROM (v_in - v_first.clocked_in_at))) > v_eps THEN
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

    IF NOT v_is_open_block THEN
      IF v_out IS NULL THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'All segments must be closed for a closed block'::text;
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
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Only the final segment may be open for an open block'::text;
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
          RETURN QUERY SELECT ARRAY[]::uuid[], 'Final segment of an open block must stay open'::text;
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

  IF NOT v_is_open_block THEN
    IF abs(EXTRACT(EPOCH FROM (v_prev_out - v_last.clocked_out_at))) > v_eps THEN
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Last segment must end at the original clock-out time'::text;
      RETURN;
    END IF;
  END IF;

  FOR v_rec IN
    SELECT * FROM public.clock_sessions
    WHERE id = ANY (p_session_ids)
    ORDER BY clocked_in_at ASC
  LOOP
    IF v_rec.approved_at IS NOT NULL AND v_rec.clocked_out_at IS NOT NULL THEN
      SELECT trim(both from u.name) INTO v_person_name
      FROM public.users u
      WHERE u.id = v_rec.user_id;

      IF v_person_name IS NULL OR v_person_name = '' THEN
        RETURN QUERY SELECT ARRAY[]::uuid[], 'User has no name'::text;
        RETURN;
      END IF;

      v_hours := EXTRACT(EPOCH FROM (v_rec.clocked_out_at - v_rec.clocked_in_at)) / 3600.0;
      IF v_hours > 0 THEN
        UPDATE public.people_hours
        SET hours = hours - v_hours,
            entered_by = v_uid
        WHERE person_name = v_person_name
          AND work_date = v_rec.work_date
        RETURNING hours INTO v_new_hours;

        IF FOUND THEN
          IF v_new_hours <= 0 THEN
            DELETE FROM public.people_hours
            WHERE person_name = v_person_name
              AND work_date = v_rec.work_date;
          END IF;
        END IF;
      END IF;

      IF v_rec.job_ledger_id IS NOT NULL THEN
        PERFORM public.sync_crew_jobs_from_clock(v_person_name, v_rec.work_date);
      END IF;
      IF v_rec.bid_id IS NOT NULL THEN
        PERFORM public.sync_crew_bids_from_clock(v_person_name, v_rec.work_date);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.clock_sessions WHERE id = ANY (p_session_ids);

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
      origin,
      salary_segment_index,
      salary_split_derived,
      clock_in_lat,
      clock_in_lng,
      clock_out_lat,
      clock_out_lng
    )
    VALUES (
      v_first.user_id,
      v_in,
      v_out,
      v_work,
      v_notes,
      v_first.job_ledger_id,
      v_first.bid_id,
      CASE
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL THEN 'user_punch'
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NULL THEN 'salary_schedule'
        ELSE v_first.origin
      END,
      CASE
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL THEN NULL
        WHEN v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NULL AND v_n >= 2 THEN (v_i + 1)::smallint
        ELSE NULL
      END,
      (v_first.origin = 'salary_schedule' AND v_first.salary_segment_index IS NOT NULL),
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_new_id;

    v_ids := array_append(v_ids, v_new_id);
  END LOOP;

  UPDATE public.clock_sessions
  SET clock_in_lat = v_first.clock_in_lat,
      clock_in_lng = v_first.clock_in_lng
  WHERE id = v_ids[1];

  FOR v_i IN REVERSE (v_n - 1) .. 0 LOOP
    v_elem := p_segments -> v_i;
    v_out_null := (v_elem->'clocked_out_at' IS NULL)
      OR (v_elem->>'clocked_out_at' IS NOT NULL AND v_elem->>'clocked_out_at' = '');
    IF NOT v_out_null THEN
      UPDATE public.clock_sessions
      SET clock_out_lat = v_last.clock_out_lat,
          clock_out_lng = v_last.clock_out_lng
      WHERE id = v_ids[v_i + 1];
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_ids, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.leader_split_clock_session_cluster(uuid[], jsonb) IS
  'Like split_own_clock_session_cluster for self, team lead, or pay access. Indexed salary_schedule children become user_punch.';

REVOKE ALL ON FUNCTION public.leader_split_clock_session_cluster(uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leader_split_clock_session_cluster(uuid[], jsonb) TO authenticated;
-- Continuous salary: after splitting the auto day into indexed salary_schedule rows (1..N),
-- approving those segments cleared the "pending indexed splits" guard (approved_at IS NULL),
-- so salary_sync could INSERT a duplicate NULL-index row and double hours. Block NULL-index
-- INSERT whenever any non-rejected/non-revoked indexed salary_schedule row exists for that day.

CREATE OR REPLACE FUNCTION public.salary_sync_one_user_clock_sessions(
  p_user_id uuid,
  p_work_date date,
  p_now timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Half-open semantics (split and continuous insert windows):
--   Each template slot i is [T_i_open, T_i_close) in timestamptz (inclusive open, exclusive close).
--   For overlap tests only, treat a row as [clocked_in_at, s_out_eff) with
--   s_out_eff = COALESCE(clocked_out_at, p_now).
--   Stored clocked_out_at is the exclusive end instant (sync sets clocked_out_at = t_end / t_end2 at block end).
-- Half-open overlap(session, slot) iff:
--   clocked_in_at < t_close_slot AND t_open_slot < s_out_eff
-- (same as [s_in,s_out) intersecting [t_open,t_close) in half-open form.)
DECLARE
  r_t record;
  r_o record;
  tz text;
  v_mode text;
  sa_time time;
  sa_dur int;
  sb_time time;
  sb_dur int;
  v_use_split_focus boolean;
  jl_a uuid;
  bid_a uuid;
  jl_b uuid;
  bid_b uuid;
  t_start timestamptz;
  t_end timestamptz;
  t_start2 timestamptz;
  t_end2 timestamptz;
  cs record;
  v_override_meaningful boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_time_off
    WHERE user_id = p_user_id
      AND p_work_date >= start_date
      AND p_work_date <= end_date
  ) THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  SELECT * INTO r_t FROM public.salary_work_schedule_templates WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  SELECT * INTO r_o
  FROM public.salary_work_schedule_day_overrides
  WHERE user_id = p_user_id AND work_date = p_work_date;

  v_override_meaningful := FOUND AND (r_o.mode IS NOT NULL OR r_o.segment_a_start_local IS NOT NULL);

  IF r_t.exclude_weekends
     AND NOT v_override_meaningful
     AND to_char(p_work_date, 'ID')::int IN (6, 7) THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  tz := COALESCE(r_o.timezone, r_t.timezone, 'America/Chicago');
  v_mode := COALESCE(r_o.mode, r_t.mode);
  sa_time := COALESCE(r_o.segment_a_start_local, r_t.segment_a_start_local);
  sa_dur := COALESCE(r_o.segment_a_duration_minutes, r_t.segment_a_duration_minutes);
  sb_time := COALESCE(r_o.segment_b_start_local, r_t.segment_b_start_local);
  sb_dur := COALESCE(r_o.segment_b_duration_minutes, r_t.segment_b_duration_minutes);
  v_use_split_focus := COALESCE(r_o.use_split_focus, r_t.use_split_focus);
  jl_a := COALESCE(r_o.job_ledger_id, r_t.job_ledger_id);
  bid_a := COALESCE(r_o.bid_id, r_t.bid_id);
  jl_b := COALESCE(r_o.segment_b_job_ledger_id, r_t.segment_b_job_ledger_id);
  bid_b := COALESCE(r_o.segment_b_bid_id, r_t.segment_b_bid_id);

  IF v_mode = 'continuous' THEN
    t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
    t_end := t_start + (sa_dur || ' minutes')::interval;

    IF p_now >= t_end THEN
      UPDATE public.clock_sessions
      SET clocked_out_at = t_end
      WHERE user_id = p_user_id
        AND origin = 'user_punch'
        AND salary_split_derived = true
        AND rejected_at IS NULL
        AND revoked_at IS NULL
        AND clocked_out_at IS NULL
        AND clocked_in_at < t_end
        AND t_start < COALESCE(clocked_out_at, p_now)
        AND (
          work_date = p_work_date
          OR (clocked_in_at AT TIME ZONE tz)::date = p_work_date
        );
    END IF;

    SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
    INTO cs
    FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND salary_segment_index IS NULL
    FOR UPDATE;

    IF FOUND THEN
      IF cs.approved_at IS NOT NULL OR cs.rejected_at IS NOT NULL OR cs.revoked_at IS NOT NULL THEN
        RETURN;
      END IF;
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions
        SET clocked_out_at = t_end
        WHERE id = cs.id;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1
        FROM public.clock_sessions
        WHERE user_id = p_user_id
          AND work_date = p_work_date
          AND origin = 'salary_schedule'
          AND salary_segment_index IS NOT NULL
          AND rejected_at IS NULL
          AND revoked_at IS NULL
      ) THEN
        IF p_now >= t_start AND p_now < t_end THEN
          INSERT INTO public.clock_sessions (
            user_id, clocked_in_at, clocked_out_at, work_date, notes,
            job_ledger_id, bid_id, origin, salary_segment_index
          ) VALUES (
            p_user_id, t_start, NULL, p_work_date, '',
            jl_a, bid_a, 'salary_schedule', NULL
          );
        ELSIF p_now >= t_end THEN
          INSERT INTO public.clock_sessions (
            user_id, clocked_in_at, clocked_out_at, work_date, notes,
            job_ledger_id, bid_id, origin, salary_segment_index
          ) VALUES (
            p_user_id, t_start, t_end, p_work_date, '',
            jl_a, bid_a, 'salary_schedule', NULL
          );
        END IF;
      END IF;
    END IF;
    RETURN;
  END IF;

  IF sb_time IS NULL OR sb_dur IS NULL THEN
    RETURN;
  END IF;

  t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
  t_end := t_start + (sa_dur || ' minutes')::interval;
  t_start2 := (p_work_date::timestamp + sb_time) AT TIME ZONE tz;
  t_end2 := t_start2 + (sb_dur || ' minutes')::interval;

  IF p_now >= t_end THEN
    UPDATE public.clock_sessions
    SET clocked_out_at = t_end
    WHERE user_id = p_user_id
      AND origin = 'user_punch'
      AND salary_split_derived = true
      AND rejected_at IS NULL
      AND revoked_at IS NULL
      AND clocked_out_at IS NULL
      AND clocked_in_at < t_end
      AND t_start < COALESCE(clocked_out_at, p_now)
      AND (
        work_date = p_work_date
        OR (clocked_in_at AT TIME ZONE tz)::date = p_work_date
      );
  END IF;

  IF p_now >= t_end2 THEN
    UPDATE public.clock_sessions
    SET clocked_out_at = t_end2
    WHERE user_id = p_user_id
      AND origin = 'user_punch'
      AND salary_split_derived = true
      AND rejected_at IS NULL
      AND revoked_at IS NULL
      AND clocked_out_at IS NULL
      AND clocked_in_at < t_end2
      AND t_start2 < COALESCE(clocked_out_at, p_now)
      AND (
        work_date = p_work_date
        OR (clocked_in_at AT TIME ZONE tz)::date = p_work_date
      );
  END IF;

  -- Split slot 1: canonical row FOR UPDATE
  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 1
  FOR UPDATE;

  IF FOUND THEN
    IF cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      -- Exclusive end t_end: same instant is first instant not in slot 1; adjacency with slot 2 at t_start2 = t_end uses strict <
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    -- Half-open overlap with [t_start, t_end): block canonical INSERT if any material session intersects this window
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions cs
      WHERE cs.user_id = p_user_id
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at < t_end
        AND t_start < COALESCE(cs.clocked_out_at, p_now)
        AND (
          cs.work_date = p_work_date
          OR (cs.clocked_in_at AT TIME ZONE tz)::date = p_work_date
        )
    ) THEN
      IF p_now >= t_start AND p_now < t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, NULL, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', 1
        );
      ELSIF p_now >= t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, t_end, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', 1
        );
      END IF;
    END IF;
  END IF;

  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 2
  FOR UPDATE;

  IF FOUND THEN
    IF cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end2 THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end2 WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    -- Half-open overlap with [t_start2, t_end2); independent of slot 1 window except shared rows on disk
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions cs
      WHERE cs.user_id = p_user_id
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at < t_end2
        AND t_start2 < COALESCE(cs.clocked_out_at, p_now)
        AND (
          cs.work_date = p_work_date
          OR (cs.clocked_in_at AT TIME ZONE tz)::date = p_work_date
        )
    ) THEN
      IF p_now >= t_start2 AND p_now < t_end2 THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start2, NULL, p_work_date, '',
          CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
          CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
          'salary_schedule', 2
        );
      ELSIF p_now >= t_end2 THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start2, t_end2, p_work_date, '',
          CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
          CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
          'salary_schedule', 2
        );
      END IF;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS 'Definer: half-open template slots [t_open,t_close); split overlap = clock_in < t_close AND t_open < coalesce(out, now); create/close salary_schedule rows; at slot ends also sets clocked_out_at=t_end/t_end2 for user_punch rows with salary_split_derived; PTO/no template/excluded weekends; continuous skips NULL-index INSERT when any indexed salary_schedule rows exist for the day (non-rejected/non-revoked), including approved splits; work_date or clock-in date in template tz.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;
