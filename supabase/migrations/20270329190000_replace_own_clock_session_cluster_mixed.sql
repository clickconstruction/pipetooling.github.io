-- Replace N time-contiguous clock_sessions (same user, any job/bid mix) with M segments; per-segment job_ledger_id / bid_id in JSON.
-- Dashboard My Time when a merged strip spans different jobs/bids.

CREATE OR REPLACE FUNCTION public.replace_own_clock_session_cluster_mixed(
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
  v_tz text := 'America/Denver';
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
  v_seg_job uuid;
  v_seg_bid uuid;
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

  IF jsonb_typeof(p_segments) <> 'array' OR jsonb_array_length(p_segments) < 1 THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Expected at least one segment'::text;
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
      RETURN QUERY SELECT ARRAY[]::uuid[], 'Session is outside the editable this or last week (America/Denver)'::text;
      RETURN;
    END IF;

    IF v_first_iter THEN
      v_first := v_rec;
      v_first_iter := false;
    ELSE
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

    v_seg_job := NULL;
    v_seg_bid := NULL;
    IF v_elem ? 'job_ledger_id' AND v_elem->>'job_ledger_id' IS NOT NULL AND btrim(v_elem->>'job_ledger_id') <> '' THEN
      v_seg_job := (v_elem->>'job_ledger_id')::uuid;
    END IF;
    IF v_elem ? 'bid_id' AND v_elem->>'bid_id' IS NOT NULL AND btrim(v_elem->>'bid_id') <> '' THEN
      v_seg_bid := (v_elem->>'bid_id')::uuid;
    END IF;

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
      v_first.user_id,
      v_in,
      v_out,
      v_work,
      v_notes,
      v_seg_job,
      v_seg_bid,
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

COMMENT ON FUNCTION public.replace_own_clock_session_cluster_mixed(uuid[], jsonb) IS
  'Replace N time-contiguous clock sessions (owner, mixed job/bid) with M segments; optional job_ledger_id/bid_id per segment; current or previous Denver week; approved rollback per removed row.';

REVOKE ALL ON FUNCTION public.replace_own_clock_session_cluster_mixed(uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_own_clock_session_cluster_mixed(uuid[], jsonb) TO authenticated;
