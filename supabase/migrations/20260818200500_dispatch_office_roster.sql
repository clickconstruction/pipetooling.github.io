SET lock_timeout = '3s';

-- Standing office schedule (v2.1810): the office crew's 8:00–16:00 "J000 ·
-- Office" blocks were typed in by hand every weekday morning (146 blocks in
-- the two months before this shipped). A small roster + an idempotent ensure
-- RPC now materializes those blocks ahead of time, producing ordinary
-- job_schedule_blocks rows anchored to the designated Office job — so the
-- Day view, My Schedule, clock attribution, and overhead reporting all work
-- unchanged, and every block stays hand-editable.
--
-- Guardrails (all in ensure_office_schedule_blocks):
--   · weekdays only (matching two months of observed practice: 0 weekend blocks)
--   · time off wins — a user_time_off day is never filled
--   · field dispatch wins — an overlapping existing block skips the fill
--   · deletions stick — dispatch_office_schedule_fills tombstones each
--     (person, day) the automation has filled once; deleting the block never
--     resurrects it. A skipped day (time off / overlap) is NOT tombstoned, so
--     if the conflict clears, the next ensure fills it.

-- ---------------------------------------------------------------------------
-- Roster: who gets a standing Office block, and their daily window.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_office_roster (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  time_start time NOT NULL DEFAULT '08:00',
  time_end time NOT NULL DEFAULT '16:00',
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_office_roster_window CHECK (
    time_end > time_start
    AND time_start >= '04:00'
    AND time_end <= '20:00'
  )
);

COMMENT ON TABLE public.dispatch_office_roster IS
  'Standing office schedule roster (v2.1810): these people get an automatic weekday Office-job schedule block (their window here) via ensure_office_schedule_blocks. Managed in Dispatch Settings.';

-- ---------------------------------------------------------------------------
-- Fill ledger: tombstones. One row per (person, day) the automation has
-- filled ONCE — deleting the created block never resurrects it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch_office_schedule_fills (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_date)
);

COMMENT ON TABLE public.dispatch_office_schedule_fills IS
  'Tombstone ledger for the standing office schedule (v2.1810): each (person, day) is auto-filled at most once, so a hand-deleted Office block stays deleted.';

ALTER TABLE public.dispatch_office_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_office_schedule_fills ENABLE ROW LEVEL SECURITY;

-- Read for anyone signed in (mirrors dispatch_swim_lanes); writes for the
-- schedule-dispatch cohort INCLUDING controller (client parity, as the
-- swim-lanes migration established).
DROP POLICY IF EXISTS dispatch_office_roster_select ON public.dispatch_office_roster;
CREATE POLICY dispatch_office_roster_select ON public.dispatch_office_roster
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS dispatch_office_roster_write ON public.dispatch_office_roster;
CREATE POLICY dispatch_office_roster_write ON public.dispatch_office_roster
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
  ));

-- Fills are read-only to clients; only the SECURITY DEFINER RPC writes them.
DROP POLICY IF EXISTS dispatch_office_schedule_fills_select ON public.dispatch_office_schedule_fills;
CREATE POLICY dispatch_office_schedule_fills_select ON public.dispatch_office_schedule_fills
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- The materializer. Idempotent over any range; callers pass the visible
-- window (the hub calls it for the loaded week).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_office_schedule_blocks(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_office_job_id uuid;
  v_created integer := 0;
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

  v_day := p_from;
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
  'Standing office schedule (v2.1810): idempotently fills weekday Office-job blocks for the dispatch_office_roster over [p_from, p_to]. Time off and overlapping blocks skip; tombstoned (person, day)s never refill.';

GRANT EXECUTE ON FUNCTION public.ensure_office_schedule_blocks(date, date) TO authenticated;

-- New tables → training-mode guards (both required).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
