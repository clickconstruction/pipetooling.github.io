SET lock_timeout = '3s';

-- Messages, cut 8a (the portals; to-dos/gc-mode/messages/BUILD_PLAN.md on branch spike/gc-mode, the prototype's v1.162
-- to v1.165): the lines the office types for a customer's page that the database does not keep yet, each with its
-- Spanish, and who the customer calls on site. No new table.
--
--   * gc_daily_logs.customer_line and customer_line_es: This week, one line a week in the customer's words, written
--     on the daily log beside the superintendent's own (done stays theirs and never reaches the customer).
--   * gc_owner_pay_apps.customer_line and customer_line_es: what a pay application covers, in the customer's words, on
--     its card on Money. It is the page's sentence, not the bill: a sent bill still never changes, so these two
--     columns get their own UPDATE grant, as the architect's certificate has.
--   * gc_change_orders.description_es: a change order's description in Spanish, beside the one it went with.
--   * gc_projects.superintendent_user_id: who is on site, for Your people (no column named the superintendent of a
--     job until now).
--
-- A Spanish line needs its English one, and a line is never only spaces. The checks go on unchecked and are then
-- checked under the lighter lock; every new column starts empty, so nothing fails. Who writes each one is the
-- table's existing policy: the daily log's writers, the money team for pay applications and change orders, and the
-- office team for the job. gc_save_daily_log takes the day's line in the payload it already takes. Nothing reads them
-- until the customer page's screens (cut 8b).

-- 1 · This week's line on the daily log ---------------------------------------------------------------------------------

ALTER TABLE public.gc_daily_logs ADD COLUMN IF NOT EXISTS customer_line text;
ALTER TABLE public.gc_daily_logs ADD COLUMN IF NOT EXISTS customer_line_es text;
COMMENT ON COLUMN public.gc_daily_logs.customer_line IS
  'Messages cut 8a: the day''s line for the customer''s page (This week), in their words. NULL: nothing for the customer that day. The superintendent''s own words stay in done.';
COMMENT ON COLUMN public.gc_daily_logs.customer_line_es IS
  'Messages cut 8a: customer_line in Spanish. NULL: not written yet; the page reads the English and the readiness list names the gap.';
ALTER TABLE public.gc_daily_logs DROP CONSTRAINT IF EXISTS gc_daily_logs_customer_line_said;
ALTER TABLE public.gc_daily_logs ADD CONSTRAINT gc_daily_logs_customer_line_said CHECK (
  (customer_line IS NULL OR length(btrim(customer_line)) BETWEEN 1 AND 300)
  AND (customer_line_es IS NULL OR length(btrim(customer_line_es)) BETWEEN 1 AND 300)
  AND (customer_line_es IS NULL OR customer_line IS NOT NULL)
) NOT VALID;
ALTER TABLE public.gc_daily_logs VALIDATE CONSTRAINT gc_daily_logs_customer_line_said;

-- 2 · What a pay application covers ------------------------------------------------------------------------------------

ALTER TABLE public.gc_owner_pay_apps ADD COLUMN IF NOT EXISTS customer_line text;
ALTER TABLE public.gc_owner_pay_apps ADD COLUMN IF NOT EXISTS customer_line_es text;
COMMENT ON COLUMN public.gc_owner_pay_apps.customer_line IS
  'Messages cut 8a: what this pay application covers, in the customer''s words, for its card on their page (Roof deck, rough-in started, storefront glass). The page''s sentence, not the bill''s: it may be written or fixed after the bill went.';
COMMENT ON COLUMN public.gc_owner_pay_apps.customer_line_es IS
  'Messages cut 8a: customer_line in Spanish. NULL: not written yet.';
ALTER TABLE public.gc_owner_pay_apps DROP CONSTRAINT IF EXISTS gc_owner_pay_apps_customer_line_said;
ALTER TABLE public.gc_owner_pay_apps ADD CONSTRAINT gc_owner_pay_apps_customer_line_said CHECK (
  (customer_line IS NULL OR length(btrim(customer_line)) BETWEEN 1 AND 300)
  AND (customer_line_es IS NULL OR length(btrim(customer_line_es)) BETWEEN 1 AND 300)
  AND (customer_line_es IS NULL OR customer_line IS NOT NULL)
) NOT VALID;
ALTER TABLE public.gc_owner_pay_apps VALIDATE CONSTRAINT gc_owner_pay_apps_customer_line_said;
-- A sent pay application keeps what it went with; its line for the customer's page is the third door, after the
-- certificate and the invoice it was billed on.
GRANT UPDATE (customer_line, customer_line_es) ON TABLE public.gc_owner_pay_apps TO authenticated;

-- 3 · A change order's description in Spanish --------------------------------------------------------------------------

ALTER TABLE public.gc_change_orders ADD COLUMN IF NOT EXISTS description_es text;
COMMENT ON COLUMN public.gc_change_orders.description_es IS
  'Messages cut 8a: the description in Spanish, for the customer''s page. NULL: not written yet; the page reads the English.';
ALTER TABLE public.gc_change_orders DROP CONSTRAINT IF EXISTS gc_change_orders_description_es_said;
ALTER TABLE public.gc_change_orders ADD CONSTRAINT gc_change_orders_description_es_said CHECK (
  description_es IS NULL OR length(btrim(description_es)) BETWEEN 1 AND 500
) NOT VALID;
ALTER TABLE public.gc_change_orders VALIDATE CONSTRAINT gc_change_orders_description_es_said;

-- 4 · Who is on site -----------------------------------------------------------------------------------------------------

ALTER TABLE public.gc_projects
  ADD COLUMN IF NOT EXISTS superintendent_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.gc_projects.superintendent_user_id IS
  'Messages cut 8a: the superintendent on site for this job, for the customer''s Your people. NULL: none named.';

-- 5 · The daily log saves This week's line ------------------------------------------------------------------------------
-- gc_save_daily_log as 20261010049000 left it, word for word, but for the two columns: the log's page sends
-- customerLine and customerLineEs in the same payload. A page that sends neither keeps the day's line.
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
  v_high integer;
  v_low integer;
  v_id uuid;
  v_pkg uuid;
  v_company uuid;
  v_workers integer;
  v_reason text;
  v_line text;
  v_line_es text;
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
    RAISE EXCEPTION 'Work started %. A log before that day has nothing to say.', to_char(v_started, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;

  -- The day's high and low, each a number. A blank one is refused, never saved as 0.
  v_high := CASE WHEN jsonb_typeof(log->'high') = 'number' THEN round((log->>'high')::numeric)::integer END;
  v_low := CASE WHEN jsonb_typeof(log->'low') = 'number' THEN round((log->>'low')::numeric)::integer END;
  IF v_high IS NULL OR v_low IS NULL THEN
    RAISE EXCEPTION 'Say the day’s high and low.' USING ERRCODE = 'P0001';
  END IF;

  -- The day's line for the customer's page (Messages cut 8a), when the page sent one. Spanish only beside English.
  v_line := nullif(btrim(coalesce(log->>'customerLine', '')), '');
  v_line_es := nullif(btrim(coalesce(log->>'customerLineEs', '')), '');
  IF v_line_es IS NOT NULL AND v_line IS NULL THEN
    RAISE EXCEPTION 'Write the customer’s line in English before its Spanish.' USING ERRCODE = 'P0001';
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

  -- And it is our own crew or a trade with a signed statement of work (logTrades).
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT nullif(btrim(coalesce(c->>'packageId', '')), '')::uuid AS pkg FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) c
      UNION ALL
      SELECT nullif(btrim(coalesce(d->>'packageId', '')), '')::uuid FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) d
    ) named
    JOIN public.gc_trade_packages k ON k.id = named.pkg
    WHERE NOT k.ours
      AND NOT EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.package_id = k.id AND s.status = 'signed')
  ) THEN
    RAISE EXCEPTION 'A trade on this log has no signed statement of work. Only those trades and our own crew go on the log.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_daily_logs AS l (project_id, log_date, sky, high, low, weather_stop, done, visitors, photos_url, written_on, written_by, customer_line, customer_line_es)
  VALUES (
    v_project,
    v_date,
    coalesce(nullif(btrim(coalesce(log->>'sky', '')), ''), 'clear'),
    v_high,
    v_low,
    coalesce((log->>'weatherStop')::boolean, false),
    btrim(coalesce(log->>'done', '')),
    btrim(coalesce(log->>'visitors', '')),
    nullif(btrim(coalesce(log->>'photosUrl', '')), ''),
    v_today,
    v_uid,
    v_line,
    v_line_es
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
    -- A page that sends no customer line (one written before cut 8a) keeps the day's line as it was. A new English
    -- line sent without its Spanish clears the old Spanish, so the page never pairs it with a stale translation.
    customer_line = CASE WHEN log ? 'customerLine' THEN EXCLUDED.customer_line ELSE l.customer_line END,
    customer_line_es = CASE WHEN log ? 'customerLineEs' OR log ? 'customerLine' THEN EXCLUDED.customer_line_es ELSE l.customer_line_es END,
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

  -- A hired trade's crew on site keeps its start promise, on the log's day (buildingPromisesKeptBy).
  FOR v_company, v_pkg IN
    SELECT s.company_id, c.package_id
    FROM public.gc_daily_log_crews c
    JOIN public.gc_sows s ON s.package_id = c.package_id AND s.status = 'signed'
    WHERE c.log_id = v_id
  LOOP
    PERFORM public.gc_keep_promises(v_company, 'start', v_project, v_pkg, v_date);
  END LOOP;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_save_daily_log(jsonb) IS
  'GC mode (v2.4957, v2.5131; the customer''s line v2.5286): the superintendent''s daily log for one day on a GC project being built, with its crews and what held work up, and the day''s line for the customer''s page; saving a day again replaces its log, and keeps the customer''s line when the page sends none. Refuses a training account, a digital twin, a job not being built, a day before work started or after the writer''s day, a missing high or low, a trade not on the job, a trade with no signed statement of work (logTrades: those and our own crew), and a Spanish customer line with no English one. A hired trade''s crew on site keeps its start promise. SECURITY INVOKER: RLS decides who may.';
