-- Default Mon–Fri salary materialization; Sat/Sun skipped unless a meaningful day override exists.

ALTER TABLE public.salary_work_schedule_templates
  ADD COLUMN IF NOT EXISTS exclude_weekends boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.salary_work_schedule_templates.exclude_weekends IS 'When true, salary_sync skips Sat/Sun without a meaningful salary_work_schedule_day_overrides row (mode or segment_a_start_local set).';

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
    RETURN;
  END IF;

  IF sb_time IS NULL OR sb_dur IS NULL THEN
    RETURN;
  END IF;

  t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
  t_end := t_start + (sa_dur || ' minutes')::interval;
  t_start2 := (p_work_date::timestamp + sb_time) AT TIME ZONE tz;
  t_end2 := t_start2 + (sb_dur || ' minutes')::interval;

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
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
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
END;
$$;

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS 'Definer: create/close salary_schedule clock_sessions for one user/day; PTO and excluded weekends delete non-final salary rows and skip; weekend work via meaningful day override.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;
