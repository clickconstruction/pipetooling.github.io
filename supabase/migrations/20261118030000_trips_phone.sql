SET lock_timeout = '3s';

-- The trip record's phone ground (punch list #379, PR 7a). The crew knows first that a trip has started, so the
-- phone may start one, join one, mark a day and end one. The crew writes no trip row by itself: 20261117234500
-- gave the tables' writes to the office alone, and that stays. Each of the four acts is one checked function, a
-- definer that touches the caller's own row on a trip of a job the caller is working, and nothing else.
--
--   1. trips.ended_at: a trip started on the phone grows a day at a time, so its days cannot say it is over.
--      End the trip stamps it. Where a trip stands on the screen is still read from its days.
--   2. trip_crew_on_job(job): the caller is on the job's crew, or has a clock row on it today or yesterday.
--   3. trip_phone_state(job): what the phone needs before it asks: the job's site, the caller's own open trip
--      there, and the open trips a crewmate started, by first name and day. No row of anybody's is handed over.
--   4. trip_phone(p): start, join, day and end.
--   5. trip_save: the same function as 20261117234500 with one more fact in its reply, was_updated_at, the stamp of
--      the trip it would replace. The dev seat hashes the dry run's reply, so a trip changed in the app between a
--      plan and its apply now refuses the apply.
--
-- A trip is a reading over the clock. Nothing here reads a clock row for anything but the gate, and nothing
-- writes one, a bill or a cost. Additive and idempotent; one nullable column on a small table, no new table, so
-- no fence call. The office's client does not name ended_at, so the push can come any time after the merge; the
-- phone's client that follows must not reach the live app before it.

-- 1. The stamp.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS ended_at timestamptz;
COMMENT ON COLUMN public.trips.ended_at IS 'When somebody on the trip pressed End the trip on the phone. A trip started on the phone grows a day at a time, so until this is set the phone offers it to crewmates to join. Null on a trip the office made: its days say everything.';

-- 2. Is the caller working this job? The crew list, a schedule block this week or last (helper_on_job), or a clock
-- row of their own on it today or yesterday. Definer with row security off, as helper_on_job is.
CREATE OR REPLACE FUNCTION public.trip_crew_on_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT auth.uid() IS NOT NULL AND p_job_id IS NOT NULL AND (
    public.helper_on_job(p_job_id)
    OR EXISTS (
      SELECT 1 FROM public.clock_sessions c
      WHERE c.job_ledger_id = p_job_id AND c.user_id = auth.uid()
        AND c.work_date >= public.app_today() - 1
        AND c.rejected_at IS NULL AND c.revoked_at IS NULL
    )
  );
$$;
COMMENT ON FUNCTION public.trip_crew_on_job(uuid) IS 'Trips (#379): the signed-in user is working this job: on its crew, on its schedule this week or last, or clocked in on it today or yesterday. The gate of the phone''s trip acts. It answers yes or no about the caller.';
REVOKE EXECUTE ON FUNCTION public.trip_crew_on_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_crew_on_job(uuid) TO authenticated, service_role;

-- 3. What the phone needs before it asks. A trip is open while nobody has ended it and its last painted day is no
-- more than three days back: a weekend can pass, an abandoned trip is not offered for good.
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
    SELECT t.id, t.created_at, t.purpose,
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
        'trip_id', l.id, 'first_day', l.first_day, 'last_day', l.last_day, 'purpose', l.purpose,
        'days', me.days,
        'with', COALESCE((SELECT jsonb_agg(split_part(o.person_name, ' ', 1) ORDER BY o.person_name) FROM public.trip_people o WHERE o.trip_id = l.id AND o.user_id IS DISTINCT FROM v_uid), '[]'::jsonb))
     FROM live l JOIN public.trip_people me ON me.trip_id = l.id AND me.user_id = v_uid
     ORDER BY l.first_day DESC, l.created_at DESC LIMIT 1),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'trip_id', l.id, 'first_day', l.first_day,
        'people', COALESCE((SELECT jsonb_agg(split_part(o.person_name, ' ', 1) ORDER BY o.person_name) FROM public.trip_people o WHERE o.trip_id = l.id), '[]'::jsonb))
        ORDER BY l.first_day DESC, l.created_at DESC)
     FROM live l
     WHERE NOT EXISTS (SELECT 1 FROM public.trip_people me WHERE me.trip_id = l.id AND me.user_id = v_uid)), '[]'::jsonb)
  INTO v_mine, v_open;

  RETURN jsonb_build_object('ok', true, 'development_id', v_dev, 'development_name', v_dev_name, 'has_trips', v_any, 'mine', v_mine, 'open', v_open, 'today', v_today);
END
$fn$;
COMMENT ON FUNCTION public.trip_phone_state(uuid) IS 'Trips (#379): what the phone needs before it asks about a trip on a job the caller is working: the job''s development, whether the site has any trip, the caller''s own open trip there with their days, and the open trips crewmates started, by first name and first day. Definer: a crew member reads no trip they are not on, so this hands over first names and days and no row. ok false for anyone not working the job.';
REVOKE EXECUTE ON FUNCTION public.trip_phone_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_phone_state(uuid) TO authenticated, service_role;

-- 4. The phone's four acts. p: { action: 'start' | 'join' | 'day' | 'end', job_id, trip_id?, kind?, outcome? }
--   start  a trip on the job's development with the caller on it, today painted kind (site when left out), the job
--          named under Work goes on. A caller already on an open trip there gets that trip, with today painted.
--   join   the caller onto an open trip of the job's development, today painted kind.
--   day    the caller's own today painted kind on a trip they are on: Clock in paints site, Heading home paints road.
--   end    the trip is stamped ended, and outcome is kept when the trip has none yet.
-- Always the caller's own row and the server's own today. The office changes or deletes a phone trip like any other.
CREATE OR REPLACE FUNCTION public.trip_phone(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_today text := public.app_today()::text;
  v_action text;
  v_job uuid;
  v_trip uuid;
  v_kind text;
  v_dev uuid;
  v_person uuid;
  v_name text;
  v_row uuid;
  v_trip_dev uuid;
  v_ended timestamptz;
  v_outcome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. No trip was changed.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin keeps no trip.' USING ERRCODE = '42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'The phone says start, join, day or end, and the job.' USING ERRCODE = '22023';
  END IF;
  v_action := COALESCE(p->>'action', '');
  v_job := NULLIF(p->>'job_id', '')::uuid;
  v_trip := NULLIF(p->>'trip_id', '')::uuid;
  v_kind := COALESCE(NULLIF(p->>'kind', ''), 'site');
  IF v_action NOT IN ('start', 'join', 'day', 'end') THEN
    RAISE EXCEPTION 'The phone says start, join, day or end.' USING ERRCODE = '22023';
  END IF;
  IF v_kind NOT IN ('ready', 'road', 'site') THEN
    RAISE EXCEPTION 'A day is ready, road or site.' USING ERRCODE = '22023';
  END IF;
  IF v_job IS NULL OR NOT public.trip_crew_on_job(v_job) THEN
    RAISE EXCEPTION 'A trip is started from a job you are working. Ask the office to add it.' USING ERRCODE = '42501';
  END IF;
  SELECT j.development_id INTO v_dev FROM public.jobs_ledger j WHERE j.id = v_job;
  IF v_dev IS NULL THEN
    RAISE EXCEPTION 'This job is not in a development yet. The office can add the trip.' USING ERRCODE = '22023';
  END IF;

  -- Who the caller is on a trip: their roster row when they have one, else their login's name.
  SELECT pe.id, pe.name INTO v_person, v_name FROM public.people pe WHERE pe.account_user_id = v_uid AND pe.archived_at IS NULL ORDER BY pe.created_at LIMIT 1;
  IF v_name IS NULL THEN
    SELECT COALESCE(NULLIF(btrim(u.name), ''), 'Someone') INTO v_name FROM public.users u WHERE u.id = v_uid;
  END IF;
  v_name := left(btrim(COALESCE(v_name, 'Someone')), 200);

  IF v_action = 'start' THEN
    -- The caller's own open trip on this site, if they already have one: starting twice makes one trip.
    SELECT t.id INTO v_trip
    FROM public.trips t JOIN public.trip_people me ON me.trip_id = t.id AND me.user_id = v_uid
    WHERE t.development_id = v_dev AND t.ended_at IS NULL
      AND (SELECT max(k) FROM jsonb_object_keys(me.days) AS k) >= (public.app_today() - 3)::text
    ORDER BY t.created_at DESC LIMIT 1;
    IF v_trip IS NULL THEN
      INSERT INTO public.trips (development_id, via, created_by, updated_by) VALUES (v_dev, 'phone', v_uid, v_uid) RETURNING id INTO v_trip;
      INSERT INTO public.trip_people (trip_id, person_id, user_id, person_name, days) VALUES (v_trip, v_person, v_uid, v_name, jsonb_build_object(v_today, v_kind));
      INSERT INTO public.trip_jobs (trip_id, job_id) VALUES (v_trip, v_job) ON CONFLICT DO NOTHING;
      RETURN jsonb_build_object('did', 'started', 'trip_id', v_trip, 'day', v_today, 'kind', v_kind);
    END IF;
    v_action := 'day';
  END IF;

  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'Which trip? The phone names it.' USING ERRCODE = '22023';
  END IF;
  SELECT t.development_id, t.ended_at, t.outcome INTO v_trip_dev, v_ended, v_outcome FROM public.trips t WHERE t.id = v_trip;
  IF v_trip_dev IS NULL OR v_trip_dev <> v_dev THEN
    RAISE EXCEPTION 'That trip is not on this job''s site.' USING ERRCODE = '22023';
  END IF;
  SELECT tp.id INTO v_row FROM public.trip_people tp WHERE tp.trip_id = v_trip AND tp.user_id = v_uid;

  IF v_action = 'join' THEN
    IF v_ended IS NOT NULL THEN
      RAISE EXCEPTION 'That trip has ended. Start a trip, or ask the office.' USING ERRCODE = '22023';
    END IF;
    IF v_row IS NULL THEN
      -- One name a trip: a crewmate who shares the caller's name keeps theirs, and the caller's gets a mark.
      IF EXISTS (SELECT 1 FROM public.trip_people tp WHERE tp.trip_id = v_trip AND lower(btrim(tp.person_name)) = lower(v_name)) THEN
        v_name := left(v_name, 190) || ' (2)';
      END IF;
      INSERT INTO public.trip_people (trip_id, person_id, user_id, person_name, days) VALUES (v_trip, v_person, v_uid, v_name, jsonb_build_object(v_today, v_kind));
    ELSE
      UPDATE public.trip_people SET days = days || jsonb_build_object(v_today, v_kind) WHERE id = v_row;
    END IF;
    INSERT INTO public.trip_jobs (trip_id, job_id) VALUES (v_trip, v_job) ON CONFLICT DO NOTHING;
    UPDATE public.trips SET updated_by = v_uid, updated_at = now() WHERE id = v_trip;
    RETURN jsonb_build_object('did', 'joined', 'trip_id', v_trip, 'day', v_today, 'kind', v_kind);
  END IF;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'You are not on that trip. Join it first.' USING ERRCODE = '42501';
  END IF;

  IF v_action = 'day' THEN
    IF v_ended IS NOT NULL THEN
      RAISE EXCEPTION 'That trip has ended. Start a trip, or ask the office.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.trip_people SET days = days || jsonb_build_object(v_today, v_kind) WHERE id = v_row;
    INSERT INTO public.trip_jobs (trip_id, job_id) VALUES (v_trip, v_job) ON CONFLICT DO NOTHING;
    UPDATE public.trips SET updated_by = v_uid, updated_at = now() WHERE id = v_trip;
    RETURN jsonb_build_object('did', 'day', 'trip_id', v_trip, 'day', v_today, 'kind', v_kind);
  END IF;

  -- end
  UPDATE public.trips SET
    ended_at = COALESCE(ended_at, now()),
    outcome = CASE WHEN btrim(outcome) = '' THEN left(btrim(COALESCE(p->>'outcome', '')), 2000) ELSE outcome END,
    updated_by = v_uid, updated_at = now()
  WHERE id = v_trip;
  RETURN jsonb_build_object('did', 'ended', 'trip_id', v_trip, 'already', v_ended IS NOT NULL);
END
$fn$;
COMMENT ON FUNCTION public.trip_phone(jsonb) IS 'Trips (#379): the phone''s four acts on a trip, for somebody working the job: start (a trip on the job''s development with the caller on it and today painted), join (the caller onto an open trip there), day (the caller''s own today painted: Clock in is site, Heading home is road) and end (the trip stamped ended, an outcome kept when it has none). Definer, since the tables'' writes are the office''s: it writes the caller''s own row, the server''s own today and the trip''s job link, and never a clock row, a bill or a cost. Refused for a training account, a digital twin and an archived caller.';
REVOKE EXECUTE ON FUNCTION public.trip_phone(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_phone(jsonb) TO authenticated, service_role;

-- 5. trip_save, from 20261117234500, with the stamp of the trip it would replace in its reply.
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
    SELECT true, t.updated_at INTO v_exists, v_was FROM public.trips t WHERE t.id = v_id;
    v_exists := COALESCE(v_exists, false);
  ELSE
    v_id := gen_random_uuid();
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('dry_run', true, 'would', CASE WHEN v_exists THEN 'change' ELSE 'add' END, 'trip_id', v_id,
      'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n,
      'was_updated_at', v_was);
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
    'people', v_people_n, 'person_days', v_person_days, 'first_day', v_first, 'last_day', v_last, 'jobs', v_jobs_n,
    'was_updated_at', v_was);
END
$fn$;
COMMENT ON FUNCTION public.trip_save(jsonb, boolean) IS 'Trips (#379): save a trip whole (its fields, its people with their days, its jobs) or not at all. SECURITY INVOKER: the tables'' policies decide who. An id that exists is replaced; an id that does not is made under that id; p_dry_run checks and counts and writes nothing. The reply names was_updated_at, the stamp of the trip it replaces (null for a new one), so a plan made before somebody else''s change does not match its apply. It touches trips, trip_people and trip_jobs and nothing else: no clock row, bill or cost.';
REVOKE EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_save(jsonb, boolean) TO authenticated, service_role;
