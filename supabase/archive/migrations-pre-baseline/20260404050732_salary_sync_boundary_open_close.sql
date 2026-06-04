-- Boundary-driven salary sync: at each block end, close all open clock_sessions for
-- user/work_date at t_block_end (including approved); at block start, insert salary_schedule
-- row only when none are open. Replaces canonical slot UPDATE + overlap guards.

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
  v_override_meaningful boolean;
  v_has_open boolean;
  v_row_id uuid;
  v_row_out timestamptz;
  v_row_appr timestamptz;
  v_skip_continuous_null_inserts boolean;
BEGIN
  -- PTO: remove non-final salary_schedule rows, then close any remaining opens at p_now
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
    UPDATE public.clock_sessions
    SET clocked_out_at = p_now
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND clocked_out_at IS NULL
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
    UPDATE public.clock_sessions
    SET clocked_out_at = p_now
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND clocked_out_at IS NULL
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
    UPDATE public.clock_sessions
    SET clocked_out_at = p_now
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND clocked_out_at IS NULL
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

  -- Split template: remove orphan continuous (NULL index) salary row for this day only
  IF v_mode <> 'continuous' THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND salary_segment_index IS NULL
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
  END IF;

  IF v_mode = 'continuous' THEN
    t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
    t_end := t_start + (sa_dur || ' minutes')::interval;

    SELECT EXISTS (
      SELECT 1
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index IS NOT NULL
        AND approved_at IS NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL
    ) INTO v_skip_continuous_null_inserts;

    IF p_now >= t_end THEN
      UPDATE public.clock_sessions
      SET clocked_out_at = t_end
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND clocked_out_at IS NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL;

      IF NOT v_skip_continuous_null_inserts
         AND NOT EXISTS (
        SELECT 1
        FROM public.clock_sessions
        WHERE user_id = p_user_id
          AND work_date = p_work_date
          AND origin = 'salary_schedule'
          AND salary_segment_index IS NULL
      ) THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, t_end, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', NULL
        );
      END IF;
    END IF;

    IF NOT v_skip_continuous_null_inserts
       AND p_now >= t_start
       AND p_now < t_end THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.clock_sessions
        WHERE user_id = p_user_id
          AND work_date = p_work_date
          AND clocked_out_at IS NULL
          AND rejected_at IS NULL
          AND revoked_at IS NULL
      ) INTO v_has_open;

      IF NOT v_has_open THEN
        SELECT id, clocked_out_at, approved_at
        INTO v_row_id, v_row_out, v_row_appr
        FROM public.clock_sessions
        WHERE user_id = p_user_id
          AND work_date = p_work_date
          AND origin = 'salary_schedule'
          AND salary_segment_index IS NULL
        FOR UPDATE;

        IF FOUND THEN
          IF v_row_out IS NOT NULL
             AND v_row_appr IS NULL THEN
            UPDATE public.clock_sessions
            SET clocked_in_at = t_start,
                clocked_out_at = NULL,
                job_ledger_id = jl_a,
                bid_id = bid_a,
                notes = ''
            WHERE id = v_row_id
              AND rejected_at IS NULL
              AND revoked_at IS NULL;
          END IF;
        ELSE
          INSERT INTO public.clock_sessions (
            user_id, clocked_in_at, clocked_out_at, work_date, notes,
            job_ledger_id, bid_id, origin, salary_segment_index
          ) VALUES (
            p_user_id, t_start, NULL, p_work_date, '',
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
      AND work_date = p_work_date
      AND clocked_out_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
  END IF;

  IF p_now >= t_end2 THEN
    UPDATE public.clock_sessions
    SET clocked_out_at = t_end2
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND clocked_out_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
  END IF;

  IF p_now >= t_end THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index = 1
    ) THEN
      INSERT INTO public.clock_sessions (
        user_id, clocked_in_at, clocked_out_at, work_date, notes,
        job_ledger_id, bid_id, origin, salary_segment_index
      ) VALUES (
        p_user_id, t_start, t_end, p_work_date, '',
        jl_a, bid_a, 'salary_schedule', 1
      );
    END IF;
  END IF;

  IF p_now >= t_end2 THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index = 2
    ) THEN
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

  IF p_now >= t_start AND p_now < t_end THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND clocked_out_at IS NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL
    ) INTO v_has_open;

    IF NOT v_has_open THEN
      SELECT id, clocked_out_at, approved_at
      INTO v_row_id, v_row_out, v_row_appr
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index = 1
      FOR UPDATE;

      IF FOUND THEN
        IF v_row_out IS NOT NULL
           AND v_row_appr IS NULL THEN
          UPDATE public.clock_sessions
          SET clocked_in_at = t_start,
              clocked_out_at = NULL,
              job_ledger_id = jl_a,
              bid_id = bid_a,
              notes = ''
          WHERE id = v_row_id
            AND rejected_at IS NULL
            AND revoked_at IS NULL;
        END IF;
      ELSE
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, NULL, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', 1
        );
      END IF;
    END IF;
  END IF;

  IF p_now >= t_start2 AND p_now < t_end2 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND clocked_out_at IS NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL
    ) INTO v_has_open;

    IF NOT v_has_open THEN
      SELECT id, clocked_out_at, approved_at
      INTO v_row_id, v_row_out, v_row_appr
      FROM public.clock_sessions
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index = 2
      FOR UPDATE;

      IF FOUND THEN
        IF v_row_out IS NOT NULL
           AND v_row_appr IS NULL THEN
          UPDATE public.clock_sessions
          SET clocked_in_at = t_start2,
              clocked_out_at = NULL,
              job_ledger_id = CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
              bid_id = CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
              notes = ''
          WHERE id = v_row_id
            AND rejected_at IS NULL
            AND revoked_at IS NULL;
        END IF;
      ELSE
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start2, NULL, p_work_date, '',
          CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
          CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
          'salary_schedule', 2
        );
      END IF;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS
  'Definer: salary template as block boundaries — at each block end sets clocked_out_at=t_end on all open sessions for user/work_date (all origins, including approved); at block start inserts salary_schedule only when no session is open. Deletes non-final wrong-shape salary rows when template mode is continuous vs split. PTO/no-template/excluded weekend: delete non-final salary rows then close opens at p_now.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;
