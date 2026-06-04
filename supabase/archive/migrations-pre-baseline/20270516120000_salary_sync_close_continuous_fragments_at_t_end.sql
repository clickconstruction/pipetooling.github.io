-- Continuous template + My Time split: indexed salary_schedule fragments (salary_segment_index 1..N)
-- were never closed when the canonical NULL-index row no longer existed. When p_now has passed block end,
-- force clocked_out_at = t_end for open, non-final fragments (clocked_out_at IS NULL only).

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
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index IS NOT NULL
        AND approved_at IS NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL
        AND clocked_in_at < t_end
        AND clocked_out_at IS NULL;
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

  IF t_start2 = t_start THEN
    t_start2 := t_end;
    t_end2 := t_start2 + (sb_dur || ' minutes')::interval;
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
      FROM public.clock_sessions sess
      WHERE sess.user_id = p_user_id
        AND sess.rejected_at IS NULL
        AND sess.revoked_at IS NULL
        AND sess.clocked_in_at < t_end
        AND t_start < COALESCE(sess.clocked_out_at, p_now)
        AND (
          sess.work_date = p_work_date
          OR (sess.clocked_in_at AT TIME ZONE tz)::date = p_work_date
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
      FROM public.clock_sessions sess
      WHERE sess.user_id = p_user_id
        AND sess.rejected_at IS NULL
        AND sess.revoked_at IS NULL
        AND sess.clocked_in_at < t_end2
        AND t_start2 < COALESCE(sess.clocked_out_at, p_now)
        AND (
          sess.work_date = p_work_date
          OR (sess.clocked_in_at AT TIME ZONE tz)::date = p_work_date
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

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS 'Definer: half-open template slots [t_open,t_close); split overlap = clock_in < t_close AND t_open < coalesce(out, now); if split and segment B start equals A, second slot is contiguous at t_end of first; PTO/no template/excluded weekends; continuous closes indexed salary_schedule fragments at t_end when p_now >= t_end; continuous skips NULL-index INSERT when any indexed salary_schedule rows exist; work_date or clock-in date in template tz.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;
