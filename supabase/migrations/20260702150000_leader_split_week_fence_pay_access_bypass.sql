-- Draft Payroll day-editor bridge: pay-access bypass for the leader split/replace week fence.
--
-- The three leader_* clock-session split/replace RPCs hard-reject sessions whose work_date is
-- outside this-or-last week (America/Chicago). The Draft Payroll Hours-breakdown day editor lets
-- pay-access users edit any day inside the pay period, so the fence gains a bypass for
-- pay-access callers (is_pay_approved_master() already includes is_dev()). This grants no new
-- capability class: pay-access users can already adjust/insert/delete clock_sessions on any date
-- via direct table writes (RLS is role-only, no date predicates); the bypass makes the split path
-- consistent. The own_* variants stay fenced -- the client routes overridden saves through the
-- leader RPCs (pay-access users pass can_edit_clock_sessions_for_user even for self).
-- Function bodies below are verbatim from prod (md5(prosrc) verified against live) apart from the
-- one-line fence change per function.

CREATE OR REPLACE FUNCTION public.pay_access_clock_week_fence_bypass() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT public.is_pay_approved_master() OR public.is_assistant_of_pay_approved_master();
$$;

ALTER FUNCTION public.pay_access_clock_week_fence_bypass() OWNER TO postgres;
-- Advisor function_search_path_mutable: match the sibling helpers (20260605212302).
ALTER FUNCTION public.pay_access_clock_week_fence_bypass() SET search_path = public;

COMMENT ON FUNCTION public.pay_access_clock_week_fence_bypass() IS
  'True for pay-access callers (dev / pay-approved master / their assistants). Used by the leader_* clock-session split/replace RPCs to bypass the this-or-last-week edit fence for Draft Payroll day edits.';


CREATE OR REPLACE FUNCTION "public"."leader_replace_clock_session_cluster_mixed"("p_session_ids" "uuid"[], "p_segments" "jsonb") RETURNS TABLE("inserted_ids" "uuid"[], "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    ) AND NOT public.pay_access_clock_week_fence_bypass() THEN
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

  IF EXISTS (
    SELECT 1 FROM public.clock_sessions cs
    WHERE cs.id = ANY (p_session_ids)
      AND (cs.origin IS DISTINCT FROM v_first.origin
           OR cs.salary_segment_index IS DISTINCT FROM v_first.salary_segment_index)
  ) THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Cluster sessions must share the same origin and salary segment index'::text;
    RETURN;
  END IF;

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

  IF v_first.origin = 'salary_schedule' AND v_n >= 2 AND v_first.salary_segment_index IS NOT NULL THEN
    RETURN QUERY SELECT ARRAY[]::uuid[], 'Cannot split a single salary segment into multiple clock rows; merge or replace the full day''s salary sessions instead.'::text;
    RETURN;
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
      origin,
      salary_segment_index,
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
      v_first.origin,
      CASE
        WHEN v_first.origin = 'salary_schedule' AND v_n >= 2 AND v_first.salary_segment_index IS NULL
          THEN (v_i + 1)::smallint
        ELSE v_first.salary_segment_index
      END,
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


COMMENT ON FUNCTION public.leader_replace_clock_session_cluster_mixed IS
  'Replaces a cluster of clock sessions with mixed work/gap segments (team lead / pay access). Week fence (this + last week, America/Chicago) is bypassed for pay-access callers via pay_access_clock_week_fence_bypass() so Draft Payroll day edits work on any pay-period day.';


CREATE OR REPLACE FUNCTION "public"."leader_split_clock_session_cluster"("p_session_ids" "uuid"[], "p_segments" "jsonb") RETURNS TABLE("inserted_ids" "uuid"[], "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    ) AND NOT public.pay_access_clock_week_fence_bypass() THEN
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
        PERFORM public.people_hours_subtract_approved_hours(
          v_rec.user_id,
          v_person_name,
          v_rec.work_date,
          v_hours,
          v_uid
        );
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


COMMENT ON FUNCTION public.leader_split_clock_session_cluster IS
  'Replaces a cluster of clock sessions with new segments (team lead / pay access). Week fence (this + last week, America/Chicago) is bypassed for pay-access callers via pay_access_clock_week_fence_bypass() so Draft Payroll day edits work on any pay-period day.';


CREATE OR REPLACE FUNCTION "public"."leader_split_clock_session_segments"("p_session_id" "uuid", "p_segments" "jsonb") RETURNS TABLE("inserted_ids" "uuid"[], "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  ) AND NOT public.pay_access_clock_week_fence_bypass() THEN
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
      PERFORM public.people_hours_subtract_approved_hours(
        v_parent.user_id,
        v_person_name,
        v_parent.work_date,
        v_hours,
        v_uid
      );
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


COMMENT ON FUNCTION public.leader_split_clock_session_segments IS
  'Splits one clock session into contiguous segments (team lead / pay access). Week fence (this + last week, America/Chicago) is bypassed for pay-access callers via pay_access_clock_week_fence_bypass() so Draft Payroll day edits work on any pay-period day.';
