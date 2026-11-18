SET lock_timeout = '3s';

-- A trip record (punch list #379, PR 2: the table). A trip is one going-out to a site away from home and coming
-- back: people, and for each person the days they were on it, each day Getting ready, On the road or At the site.
-- It belongs to a development; a job with no development can hold one. A trip is a reading laid over the clock:
-- nothing here names a clock row, a bill or a cost, and changing or deleting a trip changes none of them.
--
-- Four tables: trips, trip_people (each person with their days), trip_jobs (the jobs its work goes on, optional
-- for good) and trip_dismissals (the days somebody said were Not a trip, so the same days are not offered again).
-- One write door, trip_save, which saves a trip whole or not at all under the caller's own RLS.
--
-- Who: the roles in the Development page's office door (dev, master_technician, assistant, controller, primary)
-- read and change every trip. A person on a trip reads that trip, who else is on it and its jobs. Nobody else reads
-- a row. Additive and idempotent. Nothing in the app reads these tables until the client that follows.

-- 1. The audience, in one place.
CREATE OR REPLACE FUNCTION public.trips_office()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  );
$$;
COMMENT ON FUNCTION public.trips_office() IS 'Trips (#379): who reads and changes every trip: dev, the leaders (master_technician), the assistants, the controller and primary, the same roles as the Development page''s office door. Change the audience here, never in a policy.';
REVOKE EXECUTE ON FUNCTION public.trips_office() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trips_office() TO authenticated, service_role;

-- 2. A person's days: an object of day to kind, every key a real day, every kind one of the three.
CREATE OR REPLACE FUNCTION public.trip_days_ok(p_days jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  d record;
BEGIN
  IF p_days IS NULL OR jsonb_typeof(p_days) <> 'object' THEN
    RETURN false;
  END IF;
  FOR d IN SELECT key, value FROM jsonb_each(p_days) LOOP
    IF d.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(d.value) <> 'string' OR (d.value #>> '{}') NOT IN ('ready', 'road', 'site') THEN
      RETURN false;
    END IF;
    BEGIN
      PERFORM make_date(substr(d.key, 1, 4)::int, substr(d.key, 6, 2)::int, substr(d.key, 9, 2)::int);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  END LOOP;
  RETURN true;
END
$fn$;
COMMENT ON FUNCTION public.trip_days_ok(jsonb) IS 'Trips (#379): true when a person''s days are an object of YYYY-MM-DD to ready, road or site, every key a real day. The check on trip_people.days.';
REVOKE EXECUTE ON FUNCTION public.trip_days_ok(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_days_ok(jsonb) TO authenticated, service_role;

-- 3. The tables.
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT '' CHECK (char_length(purpose) <= 500),
  asked_by text CHECK (asked_by IN ('us', 'them')),
  asked_who text NOT NULL DEFAULT '' CHECK (char_length(asked_who) <= 200),
  asked_how text NOT NULL DEFAULT '' CHECK (char_length(asked_how) <= 200),
  outcome text NOT NULL DEFAULT '' CHECK (char_length(outcome) <= 2000),
  billing text CHECK (billing IN ('inside', 'extra', 'ours')),
  via text NOT NULL DEFAULT 'app' CHECK (via IN ('app', 'phone', 'mcp')),
  agent_label text CHECK (agent_label IS NULL OR char_length(agent_label) <= 120),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_has_a_home CHECK (development_id IS NOT NULL OR job_id IS NOT NULL)
);
COMMENT ON TABLE public.trips IS 'A trip to a site away from home (#379): what for, who asked, how it went, billing. Its people and their days are trip_people; the jobs its work goes on are trip_jobs. A reading over the clock: no clock row, bill or cost hangs on it.';
COMMENT ON COLUMN public.trips.development_id IS 'The site the trip is to. Null only for a trip a job with no development holds.';
COMMENT ON COLUMN public.trips.job_id IS 'The job that holds the trip when no development does. The jobs a trip''s work goes on are trip_jobs, not this.';
COMMENT ON COLUMN public.trips.purpose IS 'What for, in the writer''s words.';
COMMENT ON COLUMN public.trips.asked_by IS 'us or them, or null while nobody has said.';
COMMENT ON COLUMN public.trips.asked_who IS 'When they asked: who, in words (a name and a role).';
COMMENT ON COLUMN public.trips.asked_how IS 'When they asked: how and when, in words (by phone, by email, the day).';
COMMENT ON COLUMN public.trips.outcome IS 'How it went, in the writer''s words.';
COMMENT ON COLUMN public.trips.billing IS 'inside (inside the price), extra or ours, or null while nobody has said. It bills nothing by itself.';
COMMENT ON COLUMN public.trips.via IS 'app (the desk), phone (the crew''s own start) or mcp (the dev seat, with agent_label).';

CREATE INDEX IF NOT EXISTS trips_development_idx ON public.trips (development_id) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trips_job_idx ON public.trips (job_id) WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.trip_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  person_name text NOT NULL CHECK (btrim(person_name) <> '' AND char_length(person_name) <= 200),
  days jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (public.trip_days_ok(days)),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.trip_people IS 'Who went on a trip (#379), one row a person, with their own days. Someone not in the app is a name alone.';
COMMENT ON COLUMN public.trip_people.person_id IS 'The roster person (people.id), which is how the crew''s days name them; null for someone not in the app.';
COMMENT ON COLUMN public.trip_people.user_id IS 'The person''s login, which is how the clock''s rows name them and how they read their own trip; null when they have none.';
COMMENT ON COLUMN public.trip_people.days IS 'An object of YYYY-MM-DD to ready, road or site. A day off in the middle is a day that is not here.';

CREATE UNIQUE INDEX IF NOT EXISTS trip_people_one_name_a_trip ON public.trip_people (trip_id, lower(btrim(person_name)));
CREATE INDEX IF NOT EXISTS trip_people_user_idx ON public.trip_people (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trip_people_person_idx ON public.trip_people (person_id) WHERE person_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.trip_jobs (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, job_id)
);
COMMENT ON TABLE public.trip_jobs IS 'The jobs a trip''s work goes on (#379). Optional for good: a trip belongs to the site, and no job is made to hold it.';
CREATE INDEX IF NOT EXISTS trip_jobs_job_idx ON public.trip_jobs (job_id);

CREATE TABLE IF NOT EXISTS public.trip_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  person_name text NOT NULL CHECK (btrim(person_name) <> '' AND char_length(person_name) <= 200),
  first_day date NOT NULL,
  last_day date NOT NULL,
  dismissed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_dismissals_has_a_home CHECK (development_id IS NOT NULL OR job_id IS NOT NULL),
  CONSTRAINT trip_dismissals_days_in_order CHECK (last_day >= first_day)
);
COMMENT ON TABLE public.trip_dismissals IS 'Not a trip (#379): a person''s days at a site that somebody said were not a trip, both ends in, so Looks like a trip does not offer them again.';
CREATE INDEX IF NOT EXISTS trip_dismissals_development_idx ON public.trip_dismissals (development_id) WHERE development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trip_dismissals_job_idx ON public.trip_dismissals (job_id) WHERE job_id IS NOT NULL;

-- 4. Is the caller on this trip? Read as the definer: a policy on trips that reads trip_people, whose own policy
-- reads trips, would recurse.
CREATE OR REPLACE FUNCTION public.trip_is_mine(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_trip_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trip_people tp WHERE tp.trip_id = p_trip_id AND tp.user_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.trip_is_mine(uuid) IS 'Trips (#379): the signed-in user is one of the trip''s people. Definer with row security off, since trips and trip_people would otherwise ask each other. It answers yes or no about the caller and returns no row.';
REVOKE EXECUTE ON FUNCTION public.trip_is_mine(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_is_mine(uuid) TO authenticated, service_role;

-- 5. Row security: the office reads and changes every row; a person on a trip reads it.
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trips_select ON public.trips;
CREATE POLICY trips_select ON public.trips FOR SELECT TO authenticated
  USING ((SELECT public.trips_office()) OR public.trip_is_mine(id));
DROP POLICY IF EXISTS trips_insert ON public.trips;
CREATE POLICY trips_insert ON public.trips FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trips_update ON public.trips;
CREATE POLICY trips_update ON public.trips FOR UPDATE TO authenticated
  USING ((SELECT public.trips_office())) WITH CHECK ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trips_delete ON public.trips;
CREATE POLICY trips_delete ON public.trips FOR DELETE TO authenticated
  USING ((SELECT public.trips_office()));

DROP POLICY IF EXISTS trip_people_select ON public.trip_people;
CREATE POLICY trip_people_select ON public.trip_people FOR SELECT TO authenticated
  USING ((SELECT public.trips_office()) OR user_id = (SELECT auth.uid()) OR public.trip_is_mine(trip_id));
DROP POLICY IF EXISTS trip_people_insert ON public.trip_people;
CREATE POLICY trip_people_insert ON public.trip_people FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trip_people_update ON public.trip_people;
CREATE POLICY trip_people_update ON public.trip_people FOR UPDATE TO authenticated
  USING ((SELECT public.trips_office())) WITH CHECK ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trip_people_delete ON public.trip_people;
CREATE POLICY trip_people_delete ON public.trip_people FOR DELETE TO authenticated
  USING ((SELECT public.trips_office()));

DROP POLICY IF EXISTS trip_jobs_select ON public.trip_jobs;
CREATE POLICY trip_jobs_select ON public.trip_jobs FOR SELECT TO authenticated
  USING ((SELECT public.trips_office()) OR public.trip_is_mine(trip_id));
DROP POLICY IF EXISTS trip_jobs_insert ON public.trip_jobs;
CREATE POLICY trip_jobs_insert ON public.trip_jobs FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trip_jobs_delete ON public.trip_jobs;
CREATE POLICY trip_jobs_delete ON public.trip_jobs FOR DELETE TO authenticated
  USING ((SELECT public.trips_office()));

DROP POLICY IF EXISTS trip_dismissals_select ON public.trip_dismissals;
CREATE POLICY trip_dismissals_select ON public.trip_dismissals FOR SELECT TO authenticated
  USING ((SELECT public.trips_office()));
DROP POLICY IF EXISTS trip_dismissals_insert ON public.trip_dismissals;
CREATE POLICY trip_dismissals_insert ON public.trip_dismissals FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.trips_office()) AND dismissed_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS trip_dismissals_delete ON public.trip_dismissals;
CREATE POLICY trip_dismissals_delete ON public.trip_dismissals FOR DELETE TO authenticated
  USING ((SELECT public.trips_office()));

REVOKE ALL ON public.trips, public.trip_people, public.trip_jobs, public.trip_dismissals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_people TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.trip_jobs TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.trip_dismissals TO authenticated;
GRANT ALL ON public.trips, public.trip_people, public.trip_jobs, public.trip_dismissals TO service_role;

-- 6. The one write door: a trip saved whole, or not at all. SECURITY INVOKER, so the policies above decide who.
-- p: { id?, development_id?, job_id?, purpose?, asked_by?, asked_who?, asked_how?, outcome?, billing?, via?,
--      agent_label?, people: [{ person_id?, user_id?, name, days: { "YYYY-MM-DD": "ready"|"road"|"site" } }],
--      job_ids?: [uuid] }
-- With an id that exists the trip is replaced: its fields, its people and its jobs become what p says. With an id
-- that does not exist the trip is made under that id, which is how a delete is undone. p_dry_run checks and counts
-- and writes nothing.
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
    SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = v_id) INTO v_exists;
  ELSE
    v_id := gen_random_uuid();
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run', true, 'would', CASE WHEN v_exists THEN 'change' ELSE 'add' END, 'trip_id', v_id,
      'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n);
  END IF;

  IF v_exists THEN
    UPDATE public.trips SET
      development_id = v_dev, job_id = v_job,
      purpose = COALESCE(p->>'purpose', ''), asked_by = v_asked_by, asked_who = COALESCE(p->>'asked_who', ''),
      asked_how = COALESCE(p->>'asked_how', ''), outcome = COALESCE(p->>'outcome', ''), billing = v_billing,
      updated_by = v_uid, updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.trips (id, development_id, job_id, purpose, asked_by, asked_who, asked_how, outcome, billing, via, agent_label, created_by, updated_by)
    VALUES (v_id, v_dev, v_job, COALESCE(p->>'purpose', ''), v_asked_by, COALESCE(p->>'asked_who', ''), COALESCE(p->>'asked_how', ''),
      COALESCE(p->>'outcome', ''), v_billing, v_via, NULLIF(p->>'agent_label', ''), v_uid, v_uid);
  END IF;

  DELETE FROM public.trip_people WHERE trip_id = v_id;
  INSERT INTO public.trip_people (trip_id, person_id, user_id, person_name, days)
  SELECT v_id, NULLIF(e->>'person_id', '')::uuid, NULLIF(e->>'user_id', '')::uuid, btrim(e->>'name'), COALESCE(e->'days', '{}'::jsonb)
  FROM jsonb_array_elements(v_people) AS e;

  DELETE FROM public.trip_jobs WHERE trip_id = v_id;
  INSERT INTO public.trip_jobs (trip_id, job_id)
  SELECT DISTINCT v_id, j::uuid FROM jsonb_array_elements_text(v_jobs) AS j;

  RETURN jsonb_build_object('dry_run', false, 'did', CASE WHEN v_exists THEN 'changed' ELSE 'added' END, 'trip_id', v_id,
    'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n);
END
$fn$;
COMMENT ON FUNCTION public.trip_save(jsonb, boolean) IS 'Trips (#379): save a trip whole (its fields, its people with their days, its jobs) or not at all. SECURITY INVOKER: the tables'' policies decide who. An id that exists is replaced; an id that does not is made under that id; p_dry_run checks and counts and writes nothing. It touches trips, trip_people and trip_jobs and nothing else: no clock row, bill or cost.';
REVOKE EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
