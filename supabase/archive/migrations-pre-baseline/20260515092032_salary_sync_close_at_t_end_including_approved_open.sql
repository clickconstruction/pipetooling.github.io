-- Repair drift + product change.
--
-- Drift: schema_migrations recorded 20270408153000, 20270408162000, 20270410130200,
-- 20270421130000, 20270421140000, and 20270516120000 as applied, but the live function body
-- was an older version (no degenerate split B remap, no indexed-fragment close at t_end,
-- no work_date-or-clock-in-tz-date split overlap). Re-apply the full latest body.
--
-- Product change: continuous and split close branches now ignore approved_at and only respect
-- rejected_at / revoked_at as terminal. Approving an open salary_schedule row no longer prevents
-- sync from setting clocked_out_at = t_end / t_end2; previously approved-but-open rows fell through
-- to the 23:59 EOD safety net (auto_clock_out_open_sessions_eod), inflating hours.

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
-- Half-open semantics: each template slot is [t_open, t_close); clocked_out_at stores the
-- exclusive end instant. Approved-but-open rows are still closed at t_end (approval does not
-- pin a session past the template end). Rejected / revoked rows are never modified.
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

    -- Close any open indexed (segment_index 1..N from My Time splits) salary_schedule rows at
    -- t_end once past the block end. Includes approved-but-open rows; rejected / revoked unchanged.
    IF p_now >= t_end THEN
      UPDATE public.clock_sessions
      SET clocked_out_at = t_end
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index IS NOT NULL
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
      IF cs.rejected_at IS NOT NULL OR cs.revoked_at IS NOT NULL THEN
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

  -- Degenerate template: segment B starts at the same instant as A. Remap slot 2 to begin at A's t_end
  -- so the half-open overlap check on slot 1 cannot block slot 2's canonical INSERT.
  IF t_start2 = t_start THEN
    t_start2 := t_end;
    t_end2 := t_start2 + (sb_dur || ' minutes')::interval;
  END IF;

  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 1
  FOR UPDATE;

  IF FOUND THEN
    IF cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
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
    IF cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end2 THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end2 WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
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

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS
  'Definer: half-open template slots [t_open,t_close); split overlap = clock_in < t_close AND t_open < coalesce(out, now); degenerate split (segment B start = A start) remaps slot 2 to start at slot 1 t_end; PTO / no template / excluded weekends delete non-final salary rows; continuous closes canonical NULL row and indexed (1..N) salary_schedule fragments at t_end when p_now >= t_end (approved-but-open included; rejected / revoked never modified); continuous skips NULL-index INSERT when any non-rejected/non-revoked indexed salary_schedule rows exist; split slot overlap uses work_date or clock-in date in template tz.';

REVOKE ALL ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) FROM PUBLIC;
