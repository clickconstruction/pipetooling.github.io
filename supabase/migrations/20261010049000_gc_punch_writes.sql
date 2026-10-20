SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U3b-i (v2.5131): the daily log's tighter rules and the punch list's
-- presses. Plan: to-dos/gc-mode/mockups/building-u3b.md on spike/gc-mode. Tables: 20261008030000_gc_building_records.
--
-- 1. gc_save_daily_log, made again: only our own crew or a trade with a signed statement of work goes on the log
--    (logTrades), a crew on site keeps its trade's start promise on the log's day, a missing high or low is refused
--    instead of saved as 0, and the first day reads "Oct 5".
-- 2. A punch item taken off is kept, with who took it off and when (removed_at, removed_by), and never deleted.
-- 3. The punch list's presses: add an item, take one off while nothing was pressed on it, check one fixed or send it
--    back, the office's word that the trade fixed it, and the trade's own from its portal (the Portal's P5).
-- 4. gc_accept_work (U6c) counts no item taken off.

-- 1. The daily log.
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

  INSERT INTO public.gc_daily_logs AS l (project_id, log_date, sky, high, low, weather_stop, done, visitors, photos_url, written_on, written_by)
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
  'GC mode (v2.4957, v2.5131): the superintendent''s daily log for one day on a GC project being built, with its crews and what held work up; saving a day again replaces its log. Refuses a training account, a digital twin, a job not being built, a day before work started or after the writer''s day, a missing high or low, a trade not on the job, and a trade with no signed statement of work (logTrades: those and our own crew). A hired trade''s crew on site keeps its start promise. SECURITY INVOKER: RLS decides who may.';

-- 2. A punch item taken off is kept, never deleted, and only one nothing was pressed on.
ALTER TABLE public.gc_punch_items
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_punch_items_removed_untouched') THEN
    ALTER TABLE public.gc_punch_items ADD CONSTRAINT gc_punch_items_removed_untouched
      CHECK (removed_at IS NULL OR (fixed_on IS NULL AND checked_on IS NULL AND sent_back_times = 0));
  END IF;
END $$;
COMMENT ON COLUMN public.gc_punch_items.removed_at IS
  'GC mode (v2.5131): taken off the punch list (added by mistake), kept as a record. Only an item nothing was pressed on. Every reader skips it.';
REVOKE DELETE, TRUNCATE ON TABLE public.gc_punch_items FROM authenticated;

-- 3. The punch list's presses.

-- Add an item to a trade's punch list (addPunchItem): a trade we hired on a job we are building, its statement of
-- work signed and its work not accepted yet. Returns the item.
CREATE OR REPLACE FUNCTION public.gc_add_punch_item(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  k public.gc_trade_packages%ROWTYPE;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_text text := regexp_replace(btrim(coalesce(p->>'text', '')), '\s+', ' ', 'g');
  v_where text := nullif(regexp_replace(btrim(coalesce(p->>'where', '')), '\s+', ' ', 'g'), '');
  v_photo text := nullif(btrim(coalesce(p->>'photoUrl', '')), '');
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add to a punch list.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add to a punch list.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO k FROM public.gc_trade_packages WHERE id = nullif(btrim(coalesce(p->>'packageId', '')), '')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = k.project_id;
  IF v_stage IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'The punch list is for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  IF k.ours THEN
    RAISE EXCEPTION 'Our own crew has no punch list here. Its work runs on the Pipeline.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = k.id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already. Anything wrong now is under their warranty.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'Say what is left to fix.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_punch_items (project_id, package_id, position, text, where_on, photo_url, added_on, added_by)
  VALUES (
    k.project_id, k.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_punch_items WHERE package_id = k.id),
    v_text, v_where, v_photo, public.app_today(), v_uid
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Take an item off, added by mistake: kept as a record with who and when, only while nothing was pressed on it.
CREATE OR REPLACE FUNCTION public.gc_remove_punch_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v public.gc_punch_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take an item off a punch list.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take an item off a punch list.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'No punch item with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.fixed_on IS NOT NULL OR v.checked_on IS NOT NULL OR v.sent_back_times > 0 THEN
    RAISE EXCEPTION 'They have worked on this item already. Only an item nothing was done on comes off.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_punch_items SET removed_at = now(), removed_by = v_uid WHERE id = p_item_id;
END;
$$;

-- Check an item the trade says is fixed (checkPunchItem): fixed, or back to the trade with what is still wrong,
-- counting the times. Returns the day.
CREATE OR REPLACE FUNCTION public.gc_check_punch_item(p_item_id uuid, p_fixed boolean, p_note text DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v public.gc_punch_items%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot check a punch item.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot check a punch item.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'No punch item with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.checked_on IS NOT NULL THEN
    RAISE EXCEPTION 'It is checked already.' USING ERRCODE = 'P0001';
  END IF;
  IF v.fixed_on IS NULL THEN
    RAISE EXCEPTION 'Only an item they say is fixed gets checked.' USING ERRCODE = 'P0001';
  END IF;
  IF p_fixed IS NULL THEN
    RAISE EXCEPTION 'Say whether it is fixed.' USING ERRCODE = 'P0001';
  END IF;
  IF p_fixed THEN
    UPDATE public.gc_punch_items SET checked_on = public.app_today(), checked_by = v_uid WHERE id = p_item_id;
  ELSE
    IF v_note = '' THEN
      RAISE EXCEPTION 'Say what is still wrong.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_punch_items
    SET fixed_on = NULL, sent_back_times = sent_back_times + 1, sent_back_note = v_note, sent_back_on = public.app_today()
    WHERE id = p_item_id;
  END IF;
  RETURN public.app_today();
END;
$$;

-- An item marked fixed, both ways in (tradeFixPunchItem): the trade's from its portal, and the office's when the
-- trade says so by phone. On a job we are building, an item still open, by the company on its statement of work.
-- The last item fixed on the trade keeps its punch promise. Returns the day, or raises its key and words.
CREATE OR REPLACE FUNCTION public.gc_punch_fixed_ask(p_item_id uuid, p_company_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_punch_items%ROWTYPE;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No punch item with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = v.package_id;
  IF v_sow.id IS NULL OR v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v.package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can fix its punch items.';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = v.project_id;
  IF v_stage IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Punch items are fixed while we build the job.';
  END IF;
  IF v.fixed_on IS NOT NULL OR v.checked_on IS NOT NULL THEN
    RAISE EXCEPTION 'punchNotOpen' USING ERRCODE = 'P0001', DETAIL = 'That item is marked fixed already.';
  END IF;
  UPDATE public.gc_punch_items SET fixed_on = public.app_today() WHERE id = p_item_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.gc_punch_items
    WHERE package_id = v.package_id AND removed_at IS NULL AND fixed_on IS NULL AND checked_on IS NULL
  ) THEN
    PERFORM public.gc_keep_promises(p_company_id, 'punch', v.project_id, v.package_id, public.app_today());
  END IF;
  RETURN public.app_today();
END;
$$;

-- The trade's "It is fixed" from its portal: the service role's only, called by the Portal's submit function (P5).
CREATE OR REPLACE FUNCTION public.gc_trade_punch_fixed(p_company_id uuid, p_item_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN public.gc_punch_fixed_ask(p_item_id, p_company_id);
END;
$$;

-- The office's "They say it is fixed": the trade told us by phone or text (new beside the prototype, as U4's and
-- U6's came-in presses are), in the office's words, for the company on the item's statement of work.
CREATE OR REPLACE FUNCTION public.gc_punch_fixed_in(p_item_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_detail text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a punch item fixed.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a punch item fixed.' USING ERRCODE = '42501';
  END IF;
  SELECT s.company_id INTO v_company
  FROM public.gc_punch_items i JOIN public.gc_sows s ON s.package_id = i.package_id
  WHERE i.id = p_item_id;
  BEGIN
    RETURN public.gc_punch_fixed_ask(p_item_id, v_company);
  EXCEPTION WHEN raise_exception THEN
    -- The shared rules' keys, in the office's words.
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RAISE EXCEPTION '%', CASE SQLERRM
      WHEN 'notFound' THEN 'No punch item with that id.'
      WHEN 'notOnTrade' THEN 'No company is awarded this trade with a signed statement of work.'
      WHEN 'jobNotBuilding' THEN 'Punch items are fixed while we build the job.'
      WHEN 'punchNotOpen' THEN 'It is marked fixed already. Check it.'
      ELSE coalesce(nullif(v_detail, ''), SQLERRM) END USING ERRCODE = 'P0001';
  END;
END;
$$;

-- 4. Accept a trade's work (U6c's acceptWork), made again so an item taken off holds nothing up.
CREATE OR REPLACE FUNCTION public.gc_accept_work(p_package_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_left integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_sow_all_billed(v_sow.id) THEN
    RAISE EXCEPTION 'Accept the work once every line is billed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_left FROM public.gc_punch_items WHERE package_id = p_package_id AND checked_on IS NULL AND removed_at IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'Their punch list has % % to fix or check first.', v_left, CASE WHEN v_left = 1 THEN 'item' ELSE 'items' END USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_sows SET accepted_on = public.app_today() WHERE id = v_sow.id;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_add_punch_item(jsonb) IS
  'GC mode (v2.5131): add an item to a trade''s punch list (addPunchItem) on a job being built: a trade we hired, its statement of work signed and its work not accepted. Refuses a training account, a digital twin, our own crew and blank words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_remove_punch_item(uuid) IS
  'GC mode (v2.5131): take a punch item added by mistake off the list, kept with who and when (removed_at, removed_by), only while nothing was pressed on it. Never a delete. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_check_punch_item(uuid, boolean, text) IS
  'GC mode (v2.5131): check an item the trade says is fixed (checkPunchItem): fixed, or back to the trade with what is still wrong, counting the times. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) IS
  'GC mode (v2.5131): a punch item marked fixed, the rules both ways in share: the company on its statement of work, a job being built, an item still open; the last one fixed keeps the trade''s punch promise. Raises keys: notFound, notOnTrade, jobNotBuilding, punchNotOpen. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) IS
  'GC mode (v2.5131): the trade''s It is fixed from its portal (tradeFixPunchItem), through gc_punch_fixed_ask. Service role only.';
COMMENT ON FUNCTION public.gc_punch_fixed_in(uuid) IS
  'GC mode (v2.5131): the office records that the trade says a punch item is fixed, by the trade''s own rules, in the office''s words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_accept_work(uuid) IS
  'GC mode (v2.5115, v2.5131): accept a trade''s work (acceptWork) once every line is billed and its punch list is done (no item without its check; an item taken off counts for nothing). Not twice. SECURITY INVOKER: RLS decides who may.';

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_add_punch_item(jsonb)', 'public.gc_remove_punch_item(uuid)', 'public.gc_check_punch_item(uuid, boolean, text)',
    'public.gc_punch_fixed_in(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- The shared rules: the office's twin calls them as the signed-in user, the portal's as the service role.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) TO authenticated, service_role';
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) TO service_role';
END $$;
