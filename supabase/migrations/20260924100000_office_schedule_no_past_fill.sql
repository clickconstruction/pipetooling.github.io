SET lock_timeout = '3s';

-- Standing office schedule (v2.3808): the fill never reaches into the past.
-- ensure_office_schedule_blocks(p_from, p_to) ran over whatever week an
-- editor was looking at, so opening a week from months ago created Office
-- blocks for the roster on days already worked (Apr 27 – May 1 2026, eleven
-- blocks, 2026-09-24), stamped created_by = the viewer, and tombstoned them.
-- The loop now starts at GREATEST(p_from, today in Chicago): a range that
-- ends before today is a no-op (ok, created 0), a range straddling today
-- fills today onward. The client clamps the same way before it calls; this
-- is the guard that holds for every caller.

CREATE OR REPLACE FUNCTION public.ensure_office_schedule_blocks(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_office_job_id uuid;
  v_created integer := 0;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_day date;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 31 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Date range must be 1–31 days');
  END IF;

  -- Never fill a day already worked: a past week is history, not a schedule.
  IF p_to < v_today THEN
    RETURN jsonb_build_object('ok', true, 'created', 0);
  END IF;

  -- Canonical Office job: the People → Overhead setting, else the HCP-000 /
  -- name heuristic (same fallback order the rest of the app uses).
  SELECT NULLIF(TRIM(s.value_text), '')::uuid INTO v_office_job_id
  FROM public.app_settings s
  WHERE s.key = 'overhead_office_job_ledger_id_v1'
    AND EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = NULLIF(TRIM(s.value_text), '')::uuid);
  IF v_office_job_id IS NULL THEN
    SELECT o.id INTO v_office_job_id FROM public.get_jobs_ledger_office() o LIMIT 1;
  END IF;
  IF v_office_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No Office job found (set one at People → Overhead)');
  END IF;

  v_day := GREATEST(p_from, v_today);
  WHILE v_day <= p_to LOOP
    IF EXTRACT(ISODOW FROM v_day) < 6 THEN
      FOR r IN SELECT ro.user_id, ro.time_start, ro.time_end FROM public.dispatch_office_roster ro LOOP
        -- Filled once already (tombstone) → never again.
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM public.dispatch_office_schedule_fills f
          WHERE f.user_id = r.user_id AND f.work_date = v_day
        );
        -- Time off wins.
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM public.user_time_off t
          WHERE t.user_id = r.user_id AND v_day BETWEEN t.start_date AND t.end_date
        );
        -- An overlapping existing block (field dispatch, bid time) wins.
        CONTINUE WHEN EXISTS (
          SELECT 1 FROM public.job_schedule_blocks b
          WHERE b.assignee_user_id = r.user_id
            AND b.work_date = v_day
            AND b.time_start < r.time_end
            AND b.time_end > r.time_start
        );
        INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end, created_by)
        VALUES (v_office_job_id, r.user_id, v_day, r.time_start, r.time_end, v_uid);
        INSERT INTO public.dispatch_office_schedule_fills (user_id, work_date)
        VALUES (r.user_id, v_day)
        ON CONFLICT DO NOTHING;
        v_created := v_created + 1;
      END LOOP;
    END IF;
    v_day := v_day + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

COMMENT ON FUNCTION public.ensure_office_schedule_blocks(date, date) IS
  'Standing office schedule (v2.1810, past-guard v2.3808): idempotently fills weekday Office-job blocks for the dispatch_office_roster over [GREATEST(p_from, today in Chicago), p_to]. Days before today are never filled; time off and overlapping blocks skip; tombstoned (person, day)s never refill.';

GRANT EXECUTE ON FUNCTION public.ensure_office_schedule_blocks(date, date) TO authenticated;
