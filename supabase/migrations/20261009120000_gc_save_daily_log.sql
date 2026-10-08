SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U3a-i (v2.4957): the superintendent's daily log on real
-- data, one press. gc_save_daily_log writes a day's log with its crews and what held work up, and
-- replaces that day's when saved again (the prototype's saveDailyLog). It refuses a job not being
-- built, a day before work started or after the writer's day, and a trade not on the job. The
-- prototype's tighter rule (our own crew, or a trade with a signed statement of work: logTrades) is
-- the window's until the Board's B6 makes statements of work real; U3b adds it here, with the start
-- promises a crew on site keeps (gc_keep_promises). Plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on
-- spike/gc-mode, U3. Tables: 20261008030000_gc_building_records.

CREATE OR REPLACE FUNCTION public.gc_save_daily_log(log jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_date date;
  v_today date;
  v_stage text;
  v_started date;
  v_id uuid;
  v_pkg uuid;
  v_workers integer;
  v_reason text;
  i integer := 0;
  x jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot write a daily log.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot write a daily log.' USING ERRCODE = '42501';
  END IF;
  v_project := nullif(btrim(coalesce(log->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which job the log is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage, started_on INTO v_stage, v_started FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' OR v_started IS NULL THEN
    RAISE EXCEPTION 'The daily log starts once work starts.' USING ERRCODE = 'P0001';
  END IF;

  -- The day it is for, and the writer's own day (the company's, never the server's UTC one), held
  -- within a day of the server's so a stale page cannot write tomorrow's log.
  v_date := nullif(btrim(coalesce(log->>'date', '')), '')::date;
  v_today := nullif(btrim(coalesce(log->>'today', '')), '')::date;
  IF v_date IS NULL OR v_today IS NULL THEN
    RAISE EXCEPTION 'The log’s day is missing.' USING ERRCODE = 'P0001';
  END IF;
  IF v_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'This page’s day is out of date. Reload it and write the log again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_date > v_today THEN
    RAISE EXCEPTION 'A log is written on its day or after, never before.' USING ERRCODE = 'P0001';
  END IF;
  IF v_date < v_started THEN
    RAISE EXCEPTION 'Work started %. A log before that day has nothing to say.', to_char(v_started, 'Mon DD') USING ERRCODE = 'P0001';
  END IF;

  -- Every trade the log names is one of this job's.
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT nullif(btrim(coalesce(c->>'packageId', '')), '')::uuid AS pkg FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) c
      UNION ALL
      SELECT nullif(btrim(coalesce(d->>'packageId', '')), '')::uuid FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) d
    ) named
    WHERE named.pkg IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages k WHERE k.id = named.pkg AND k.project_id = v_project)
  ) THEN
    RAISE EXCEPTION 'A trade on this log is not on this job.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_daily_logs AS l (project_id, log_date, sky, high, low, weather_stop, done, visitors, photos_url, written_on, written_by)
  VALUES (
    v_project,
    v_date,
    coalesce(nullif(btrim(coalesce(log->>'sky', '')), ''), 'clear'),
    round(coalesce((log->>'high')::numeric, 0))::integer,
    round(coalesce((log->>'low')::numeric, 0))::integer,
    coalesce((log->>'weatherStop')::boolean, false),
    btrim(coalesce(log->>'done', '')),
    btrim(coalesce(log->>'visitors', '')),
    nullif(btrim(coalesce(log->>'photosUrl', '')), ''),
    v_today,
    v_uid
  )
  ON CONFLICT (project_id, log_date) DO UPDATE SET
    sky = EXCLUDED.sky,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    weather_stop = EXCLUDED.weather_stop,
    done = EXCLUDED.done,
    visitors = EXCLUDED.visitors,
    photos_url = EXCLUDED.photos_url,
    written_on = EXCLUDED.written_on,
    written_by = EXCLUDED.written_by,
    updated_at = now()
  RETURNING l.id INTO v_id;

  -- A day has one log: saving again replaces its crews and delays.
  DELETE FROM public.gc_daily_log_crews WHERE log_id = v_id;
  DELETE FROM public.gc_daily_log_delays WHERE log_id = v_id;

  -- Each trade on site and how many. A trade with nobody is left off, as the prototype does; a trade
  -- named twice keeps its last count.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) LOOP
    v_pkg := nullif(btrim(coalesce(x->>'packageId', '')), '')::uuid;
    v_workers := round(coalesce((x->>'workers')::numeric, 0))::integer;
    CONTINUE WHEN v_pkg IS NULL OR v_workers <= 0;
    INSERT INTO public.gc_daily_log_crews (log_id, package_id, workers) VALUES (v_id, v_pkg, v_workers)
    ON CONFLICT (log_id, package_id) DO UPDATE SET workers = EXCLUDED.workers;
  END LOOP;

  -- What held work up, in the order written. Null: the job's own.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) LOOP
    v_reason := btrim(coalesce(x->>'reason', ''));
    INSERT INTO public.gc_daily_log_delays (log_id, position, package_id, reason, note)
    VALUES (v_id, i, nullif(btrim(coalesce(x->>'packageId', '')), '')::uuid, v_reason, btrim(coalesce(x->>'note', '')));
    i := i + 1;
  END LOOP;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_save_daily_log(jsonb) IS
  'GC mode (v2.4957): the superintendent''s daily log for one day on a GC project being built, with its crews and what held work up; saving a day again replaces its log. Refuses a training account, a digital twin, a job not being built, a day before work started or after the writer''s day, and a trade not on the job. SECURITY INVOKER: RLS decides who may.';

REVOKE ALL ON FUNCTION public.gc_save_daily_log(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_save_daily_log(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_save_daily_log(jsonb) TO authenticated;
