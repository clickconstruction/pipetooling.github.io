SET lock_timeout = '3s';

-- A number for each trip (punch list #379). A trip is told by its days, and days are hard to say in a text or cite
-- on a bill. So each trip gets a short number on its site: Trip 1, Trip 2. The database hands it out when the trip
-- is made. Nobody types it, it never changes, and a number once handed out is never given to another trip, so
-- "Trip 5" on a bill means one trip for good.
--
--   1. trip_number_counters: the last number each site (or each job that holds its own trips) handed out. A table,
--      not max(trip_number): a deleted Trip 5 must not hand 5 to the next trip.
--   2. trips.trip_number, and trips_take_number, the trigger that hands it out on insert and holds it on update.
--   3. trip_save, from 20261118030000, with trip_number in its reply; a trip made again under its own id (the undo of
--      a delete) may ask for the number it had, and gets it when the site handed it out before and nothing holds it.
--   4. trip_phone_state, from 20261118030000, with trip_number on the caller's trip and on each open one.
--
-- The numbers run in the order trips are made, not the order they went out: a trip filed later from an old ledger
-- takes the next number. It is a handle, not a rank. Additive and idempotent. One new table, so the four fence calls
-- close the file. The live client does not name trip_number, so the push can come any time after the merge.

-- 1. The counters. Nobody reads or writes them but the trigger: row security is on with no policy, and no grant.
CREATE TABLE IF NOT EXISTS public.trip_number_counters (
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  CONSTRAINT trip_number_counters_one_home CHECK ((development_id IS NOT NULL) <> (job_id IS NOT NULL))
);
COMMENT ON TABLE public.trip_number_counters IS 'Trips (#379): the last trip number each site handed out, or each job that holds its own trips. Written by the trips_take_number trigger alone, so a number once handed out is never given to another trip, even after its trip is deleted.';
CREATE UNIQUE INDEX IF NOT EXISTS trip_number_counters_development ON public.trip_number_counters (development_id) WHERE development_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_number_counters_job ON public.trip_number_counters (job_id) WHERE job_id IS NOT NULL;
ALTER TABLE public.trip_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_number_counters FROM anon, authenticated;
GRANT ALL ON public.trip_number_counters TO service_role;

-- 2. The number.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_number integer;
COMMENT ON COLUMN public.trips.trip_number IS 'The trip''s short number on its site (Trip 1, Trip 2), handed out by trips_take_number when the trip is made, in the order trips are made. Never typed, never changed, never given to another trip.';

-- Trips made before the number, in the order they were made, and each site's counter set past them.
WITH numbered AS (
  SELECT t.id,
         COALESCE((SELECT max(o.trip_number) FROM public.trips o
                   WHERE CASE WHEN t.development_id IS NOT NULL THEN o.development_id = t.development_id
                              ELSE o.development_id IS NULL AND o.job_id = t.job_id END), 0)
         + row_number() OVER (PARTITION BY t.development_id, CASE WHEN t.development_id IS NULL THEN t.job_id END ORDER BY t.created_at, t.id) AS n
  FROM public.trips t
  WHERE t.trip_number IS NULL
)
UPDATE public.trips t SET trip_number = numbered.n FROM numbered WHERE numbered.id = t.id;
INSERT INTO public.trip_number_counters (development_id, last_number)
  SELECT t.development_id, max(t.trip_number) FROM public.trips t WHERE t.development_id IS NOT NULL AND t.trip_number IS NOT NULL GROUP BY t.development_id
  ON CONFLICT (development_id) WHERE development_id IS NOT NULL DO UPDATE SET last_number = GREATEST(public.trip_number_counters.last_number, EXCLUDED.last_number);
INSERT INTO public.trip_number_counters (job_id, last_number)
  SELECT t.job_id, max(t.trip_number) FROM public.trips t WHERE t.development_id IS NULL AND t.job_id IS NOT NULL AND t.trip_number IS NOT NULL GROUP BY t.job_id
  ON CONFLICT (job_id) WHERE job_id IS NOT NULL DO UPDATE SET last_number = GREATEST(public.trip_number_counters.last_number, EXCLUDED.last_number);

CREATE UNIQUE INDEX IF NOT EXISTS trips_number_on_development ON public.trips (development_id, trip_number) WHERE development_id IS NOT NULL AND trip_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trips_number_on_job ON public.trips (job_id, trip_number) WHERE development_id IS NULL AND trip_number IS NOT NULL;

-- The trigger. On insert it locks the site's counter row, so two trips made at once take two numbers. A number that
-- comes with the row is kept only when the site handed it out before and no trip holds it now (a deleted trip put
-- back); anything else takes the next number. On update the number stands, whatever the statement says.
CREATE OR REPLACE FUNCTION public.trips_take_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_last integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.trip_number := OLD.trip_number;
    RETURN NEW;
  END IF;
  -- A trip with no home is refused by the table's own check, in its own words: nothing to number.
  IF NEW.development_id IS NULL AND NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.development_id IS NOT NULL THEN
    INSERT INTO public.trip_number_counters (development_id) VALUES (NEW.development_id)
      ON CONFLICT (development_id) WHERE development_id IS NOT NULL DO NOTHING;
    SELECT c.last_number INTO v_last FROM public.trip_number_counters c WHERE c.development_id = NEW.development_id FOR UPDATE;
    IF NEW.trip_number IS NOT NULL AND NEW.trip_number BETWEEN 1 AND v_last
       AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.development_id = NEW.development_id AND t.trip_number = NEW.trip_number) THEN
      RETURN NEW;
    END IF;
    UPDATE public.trip_number_counters SET last_number = v_last + 1 WHERE development_id = NEW.development_id;
  ELSE
    INSERT INTO public.trip_number_counters (job_id) VALUES (NEW.job_id)
      ON CONFLICT (job_id) WHERE job_id IS NOT NULL DO NOTHING;
    SELECT c.last_number INTO v_last FROM public.trip_number_counters c WHERE c.job_id = NEW.job_id FOR UPDATE;
    IF NEW.trip_number IS NOT NULL AND NEW.trip_number BETWEEN 1 AND v_last
       AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.development_id IS NULL AND t.job_id = NEW.job_id AND t.trip_number = NEW.trip_number) THEN
      RETURN NEW;
    END IF;
    UPDATE public.trip_number_counters SET last_number = v_last + 1 WHERE job_id = NEW.job_id;
  END IF;
  NEW.trip_number := v_last + 1;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.trips_take_number() IS 'Trips (#379): hands a new trip the next number on its site, under a lock on the site''s counter, and holds a trip''s number through every update. A number that comes with the row is kept only when the site handed it out before and no trip holds it now. Definer, since nobody else may touch the counters.';
REVOKE EXECUTE ON FUNCTION public.trips_take_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trips_take_number ON public.trips;
CREATE TRIGGER trips_take_number BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_take_number();

-- 3. trip_save, from 20261118030000, with the number in its reply and a number asked for on a trip made again.
CREATE OR REPLACE FUNCTION public.trip_save(p jsonb, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_dev uuid;
  v_job uuid;
  v_people jsonb;
  v_jobs jsonb;
  v_asked_by text;
  v_billing text;
  v_via text;
  v_exists boolean := false;
  v_was timestamptz;
  v_number integer;
  v_ask_number integer;
  v_person jsonb;
  v_name text;
  v_days jsonb;
  v_names text[] := ARRAY[]::text[];
  v_people_n integer := 0;
  v_person_days integer := 0;
  v_first text;
  v_last text;
  v_jobs_n integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to save a trip.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'A trip is saved by the office or a leader.' USING ERRCODE = '42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'A trip is an object: its people, their days and what it was for.' USING ERRCODE = '22023';
  END IF;

  v_id := NULLIF(p->>'id', '')::uuid;
  v_dev := NULLIF(p->>'development_id', '')::uuid;
  v_job := NULLIF(p->>'job_id', '')::uuid;
  v_people := COALESCE(p->'people', '[]'::jsonb);
  v_jobs := COALESCE(p->'job_ids', '[]'::jsonb);
  v_asked_by := NULLIF(p->>'asked_by', '');
  v_billing := NULLIF(p->>'billing', '');
  v_via := COALESCE(NULLIF(p->>'via', ''), 'app');
  v_ask_number := NULLIF(p->>'trip_number', '')::integer;

  IF v_dev IS NULL AND v_job IS NULL THEN
    RAISE EXCEPTION 'A trip belongs to a development, or to a job with no development.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_people) <> 'array' OR jsonb_typeof(v_jobs) <> 'array' THEN
    RAISE EXCEPTION 'A trip''s people and its jobs are lists.' USING ERRCODE = '22023';
  END IF;
  IF v_asked_by IS NOT NULL AND v_asked_by NOT IN ('us', 'them') THEN
    RAISE EXCEPTION 'Who asked for a trip is us or them.' USING ERRCODE = '22023';
  END IF;
  IF v_billing IS NOT NULL AND v_billing NOT IN ('inside', 'extra', 'ours') THEN
    RAISE EXCEPTION 'A trip''s billing is inside, extra or ours.' USING ERRCODE = '22023';
  END IF;
  IF v_via NOT IN ('app', 'phone', 'mcp') THEN
    RAISE EXCEPTION 'A trip comes from the app, the phone or the dev seat.' USING ERRCODE = '22023';
  END IF;

  FOR v_person IN SELECT e FROM jsonb_array_elements(v_people) AS e LOOP
    v_name := btrim(COALESCE(v_person->>'name', ''));
    v_days := COALESCE(v_person->'days', '{}'::jsonb);
    IF v_name = '' THEN
      RAISE EXCEPTION 'Everyone on a trip has a name.' USING ERRCODE = '22023';
    END IF;
    IF lower(v_name) = ANY (v_names) THEN
      RAISE EXCEPTION '% is on this trip twice.', v_name USING ERRCODE = '22023';
    END IF;
    v_names := v_names || lower(v_name);
    IF NOT public.trip_days_ok(v_days) THEN
      RAISE EXCEPTION '%''s days are not days: each is a day and one of ready, road or site.', v_name USING ERRCODE = '22023';
    END IF;
    v_people_n := v_people_n + 1;
    v_person_days := v_person_days + (SELECT count(*) FROM jsonb_object_keys(v_days));
    SELECT LEAST(v_first, min(k)), GREATEST(v_last, max(k)) INTO v_first, v_last FROM jsonb_object_keys(v_days) AS k;
  END LOOP;
  IF v_person_days = 0 THEN
    RAISE EXCEPTION 'A trip needs one person and one day.' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT j) INTO v_jobs_n FROM jsonb_array_elements_text(v_jobs) AS j;

  IF v_id IS NOT NULL THEN
    SELECT true, t.updated_at, t.trip_number INTO v_exists, v_was, v_number FROM public.trips t WHERE t.id = v_id;
    v_exists := COALESCE(v_exists, false);
  ELSE
    v_id := gen_random_uuid();
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run', true, 'would', CASE WHEN v_exists THEN 'change' ELSE 'add' END, 'trip_id', v_id,
      'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n,
      'was_updated_at', v_was, 'trip_number', v_number);
  END IF;

  IF v_exists THEN
    UPDATE public.trips SET
      development_id = v_dev, job_id = v_job,
      purpose = COALESCE(p->>'purpose', ''), asked_by = v_asked_by, asked_who = COALESCE(p->>'asked_who', ''),
      asked_how = COALESCE(p->>'asked_how', ''), outcome = COALESCE(p->>'outcome', ''), billing = v_billing,
      updated_by = v_uid, updated_at = now()
    WHERE id = v_id;
  ELSE
    -- The number is the trigger's to hand out. One asked for is kept only when the site handed it out before and no
    -- trip holds it now: that is a deleted trip put back.
    INSERT INTO public.trips (id, development_id, job_id, purpose, asked_by, asked_who, asked_how, outcome, billing, via, agent_label, created_by, updated_by, trip_number)
    VALUES (v_id, v_dev, v_job, COALESCE(p->>'purpose', ''), v_asked_by, COALESCE(p->>'asked_who', ''), COALESCE(p->>'asked_how', ''),
      COALESCE(p->>'outcome', ''), v_billing, v_via, NULLIF(p->>'agent_label', ''), v_uid, v_uid, v_ask_number);
  END IF;

  DELETE FROM public.trip_people WHERE trip_id = v_id;
  INSERT INTO public.trip_people (trip_id, person_id, user_id, person_name, days)
  SELECT v_id, NULLIF(e->>'person_id', '')::uuid, NULLIF(e->>'user_id', '')::uuid, btrim(e->>'name'), COALESCE(e->'days', '{}'::jsonb)
  FROM jsonb_array_elements(v_people) AS e;

  DELETE FROM public.trip_jobs WHERE trip_id = v_id;
  INSERT INTO public.trip_jobs (trip_id, job_id)
  SELECT DISTINCT v_id, j::uuid FROM jsonb_array_elements_text(v_jobs) AS j;

  SELECT t.trip_number INTO v_number FROM public.trips t WHERE t.id = v_id;
  RETURN jsonb_build_object('dry_run', false, 'did', CASE WHEN v_exists THEN 'changed' ELSE 'added' END, 'trip_id', v_id,
    'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n,
    'was_updated_at', v_was, 'trip_number', v_number);
END
$fn$;

COMMENT ON FUNCTION public.trip_save(jsonb, boolean) IS 'Trips (#379): save a trip whole (its fields, its people with their days, its jobs) or not at all. SECURITY INVOKER: the tables'' policies decide who. An id that exists is replaced; an id that does not is made under that id; p_dry_run checks and counts and writes nothing. The reply names was_updated_at, the stamp of the trip it replaces (null for a new one), and trip_number, the trip''s number on its site (null in a dry run of a new trip: the number is handed out when it is made). p.trip_number is honoured only for a trip made again under its own id whose number the site handed out before. It touches trips, trip_people and trip_jobs and nothing else: no clock row, bill or cost.';
REVOKE EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) TO authenticated, service_role;

-- 4. trip_phone_state, from 20261118030000, with each trip's number.
CREATE OR REPLACE FUNCTION public.trip_phone_state(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_dev uuid;
  v_dev_name text;
  v_mine jsonb;
  v_open jsonb;
  v_any boolean;
BEGIN
  IF v_uid IS NULL OR public.caller_is_archived() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF NOT (public.trip_crew_on_job(p_job_id) OR public.trips_office()) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT j.development_id, d.name INTO v_dev, v_dev_name
  FROM public.jobs_ledger j LEFT JOIN public.developments d ON d.id = j.development_id
  WHERE j.id = p_job_id;
  IF v_dev IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'development_id', NULL, 'has_trips', false, 'mine', NULL, 'open', '[]'::jsonb, 'today', v_today);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.development_id = v_dev) INTO v_any;

  WITH spans AS (
    SELECT t.id, t.created_at, t.purpose, t.trip_number,
           (SELECT min(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = t.id) AS first_day,
           (SELECT max(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = t.id) AS last_day
    FROM public.trips t
    WHERE t.development_id = v_dev AND t.ended_at IS NULL
  ),
  live AS (
    SELECT s.* FROM spans s
    WHERE s.first_day IS NOT NULL AND s.first_day <= v_today::text AND s.last_day >= (v_today - 3)::text
  )
  SELECT
    (SELECT jsonb_build_object(
        'trip_id', l.id, 'trip_number', l.trip_number, 'first_day', l.first_day, 'last_day', l.last_day, 'purpose', l.purpose,
        'days', me.days,
        'with', COALESCE((SELECT jsonb_agg(split_part(o.person_name, ' ', 1) ORDER BY o.person_name) FROM public.trip_people o WHERE o.trip_id = l.id AND o.user_id IS DISTINCT FROM v_uid), '[]'::jsonb))
     FROM live l JOIN public.trip_people me ON me.trip_id = l.id AND me.user_id = v_uid
     ORDER BY l.first_day DESC, l.created_at DESC LIMIT 1),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'trip_id', l.id, 'trip_number', l.trip_number, 'first_day', l.first_day,
        'people', COALESCE((SELECT jsonb_agg(split_part(o.person_name, ' ', 1) ORDER BY o.person_name) FROM public.trip_people o WHERE o.trip_id = l.id), '[]'::jsonb))
        ORDER BY l.first_day DESC, l.created_at DESC)
     FROM live l
     WHERE NOT EXISTS (SELECT 1 FROM public.trip_people me WHERE me.trip_id = l.id AND me.user_id = v_uid)), '[]'::jsonb)
  INTO v_mine, v_open;

  RETURN jsonb_build_object('ok', true, 'development_id', v_dev, 'development_name', v_dev_name, 'has_trips', v_any, 'mine', v_mine, 'open', v_open, 'today', v_today);
END
$fn$;

COMMENT ON FUNCTION public.trip_phone_state(uuid) IS 'Trips (#379): what the phone needs before it asks about a trip on a job the caller is working: the job''s development, whether the site has any trip, the caller''s own open trip there with its number and their days, and the open trips crewmates started, by number, first name and first day. Definer: a crew member reads no trip they are not on, so this hands over first names and days and no row. ok false for anyone not working the job.';
REVOKE EXECUTE ON FUNCTION public.trip_phone_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_phone_state(uuid) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
