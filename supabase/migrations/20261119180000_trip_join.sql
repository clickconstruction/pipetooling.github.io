SET lock_timeout = '3s';

-- Join a trip with the next (v2.7960, punch list #379, the other press on the card's mock-up).
--
-- Two trips that were really one become one trip. A crew that pressed End the trip by mistake and started again, or
-- a trip typed twice from memory, leaves two trips for one going out. It is also the way a split is taken back,
-- which until now meant deleting the new trip and painting its days onto the first with Change.
--
-- `trip_join(trip, next_trip, dry_run)` joins a trip with the one that went out next on the same home:
--   * the trip keeps its id, its number, its words and where it came from. Where what it was for, who asked or how
--     it went is empty, it takes the next trip's;
--   * everyone on either trip is on the joined trip, by name, with every day from both. Where both give one person
--     the same day, this trip's kind stays, and the reply names those days;
--   * its jobs are both trips' jobs;
--   * billing: an empty one takes the other's, and two different ones refuse in words;
--   * the line: when only the next trip holds one, the line is tied to the joined trip. Both holding one refuses;
--   * `ended_at` is the next trip's, so a trip still growing on the phone keeps growing;
--   * the next trip goes. Its number is not given to another trip.
--
-- It takes both ids and refuses when the second is not the next trip on the same home, so a stale screen cannot
-- join the wrong pair. The order is the look's own (`sortTrips`): first day, then last day, then id.
--
-- It writes through `trip_save`, inside this one call, so the save, the line's tie and the delete land together or
-- not at all. SECURITY INVOKER, like the save and the split: the trips tables' own policies decide who, so a
-- training account, a twin and somebody who left are refused where the save refuses them.
--
-- Four parts:
--   1. `trip_next_id(trip)`: the trip that went out next on the same home. Read under the caller's own policies.
--   2. `trip_join_line(trip, next_trip, move)`: what the two trips hold of a job's lines, and the tie moved when
--      asked. A definer with its own checks, as `trip_put_on_job_line` is, since the lines table's own policies are
--      narrower than the trips office: an invoker that could not read a line would lose its tie without a word.
--   3. `trip_join` itself.
--   4. The trip that was joined away is deleted, so it waits under Deleted trips for 90 days. Put back as things
--      stood would return its days beside the joined trip, every one of them twice. So the trip's capture
--      (`trips_archive_on_delete`, restated from prod's live body, which matched 20261118203000) keeps the trip it
--      was joined into beside the row, as it keeps `held_line_id`, and `trip_deleted_list` (restated from prod's live
--      body, which matched 20261118100000) hands that out, so the fold reads *Joined into Trip 7* with no Put back.
--      A join is taken back with Split in two.
--
-- No table, column or index. Idempotent. This file ships alone, ahead of the press that calls it: until that press
-- ships, the two restated functions answer as before for every trip, since no trip is joined.

-- 1. The trip that went out next on the same home, in the look's own order.
CREATE OR REPLACE FUNCTION public.trip_next_id(p_trip_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH home AS (
    SELECT t.development_id, t.job_id FROM public.trips t WHERE t.id = p_trip_id
  ),
  spans AS (
    -- The same development, or the same job when the trip has no development. A day is a key like 2026-11-14, so
    -- the text order is the day order.
    SELECT t.id,
           (SELECT min(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = t.id) AS first_day,
           (SELECT max(k) FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = t.id) AS last_day
    FROM public.trips t, home h
    WHERE (h.development_id IS NOT NULL AND t.development_id = h.development_id)
       OR (h.development_id IS NULL AND t.development_id IS NULL AND t.job_id = h.job_id)
  ),
  ordered AS (
    SELECT s.id,
           lead(s.id) OVER (ORDER BY s.first_day COLLATE "C" NULLS LAST, s.last_day COLLATE "C" NULLS LAST, s.id::text COLLATE "C") AS next_id
    FROM spans s
  )
  SELECT o.next_id FROM ordered o WHERE o.id = p_trip_id
$fn$;

ALTER FUNCTION public.trip_next_id(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_next_id(uuid) IS 'Trips (#379): the trip that went out next on the same home (the same development, or the same job when the trip has no development), in the order the Trips look draws: first day, then last day, then id. Null when the trip is the last, or is not one the caller reads. SECURITY INVOKER: read under the caller''s own policies.';
REVOKE EXECUTE ON FUNCTION public.trip_next_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_next_id(uuid) TO authenticated, service_role;

-- 2. What a trip and its next trip hold of a job's lines, and the tie moved when asked.
CREATE OR REPLACE FUNCTION public.trip_join_line(p_trip_id uuid, p_next_trip_id uuid, p_move boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_here uuid;
  v_next uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  -- A definer stands behind the tables' fences, so it holds them itself, as trip_put_on_job_line does.
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin joins no trips.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'Trips are joined by the office or a leader.' USING ERRCODE = '42501';
  END IF;
  IF p_move AND public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. No trip was joined.' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NULL OR p_next_trip_id IS NULL THEN
    RAISE EXCEPTION 'Name the trip and the trip that went out next.' USING ERRCODE = '22023';
  END IF;
  -- Only a trip and the one that went out next on its home: this moves no tie between any other pair.
  IF public.trip_next_id(p_trip_id) IS DISTINCT FROM p_next_trip_id THEN
    RAISE EXCEPTION 'That is not the next trip on this site any more. Close this and look again.' USING ERRCODE = '22023';
  END IF;

  -- One trip, one line (jobs_ledger_fixtures_one_line_a_trip).
  SELECT f.id INTO v_here FROM public.jobs_ledger_fixtures f WHERE f.trip_id = p_trip_id LIMIT 1;
  SELECT f.id INTO v_next FROM public.jobs_ledger_fixtures f WHERE f.trip_id = p_next_trip_id LIMIT 1;

  IF v_here IS NOT NULL AND v_next IS NOT NULL THEN
    RETURN 'both';
  END IF;
  IF v_here IS NOT NULL THEN
    RETURN 'stays';
  END IF;
  IF v_next IS NULL THEN
    RETURN 'none';
  END IF;
  IF p_move THEN
    UPDATE public.jobs_ledger_fixtures f SET trip_id = p_trip_id WHERE f.id = v_next AND f.trip_id = p_next_trip_id;
  END IF;
  RETURN 'moves';
END
$fn$;

ALTER FUNCTION public.trip_join_line(uuid, uuid, boolean) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_join_line(uuid, uuid, boolean) IS 'Trips (#379): what a trip and the trip that went out next hold of a job''s lines, for the join: none, stays (this trip holds the line), moves (only the next trip holds one) or both. With p_move, a line only the next trip holds is tied to this trip, and nothing else of the line changes: no price, no bill, no total. A definer, since the lines table''s own policies are narrower than the trips office. For the trips office, and only for a trip and its next trip on the same home. Refuses a training account that asks for the move, a digital twin and an archived caller itself.';
REVOKE EXECUTE ON FUNCTION public.trip_join_line(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_join_line(uuid, uuid, boolean) TO authenticated, service_role;

-- 3. The join.
CREATE OR REPLACE FUNCTION public.trip_join(p_trip_id uuid, p_next_trip_id uuid, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  a record;
  b record;
  v_people jsonb;
  v_shared jsonb;
  v_jobs jsonb;
  v_billing text;
  v_line text;
  v_asked_by text;
  v_asked_who text;
  v_asked_how text;
  v_first jsonb;
  v_second jsonb;
  v_p jsonb;
  v_r jsonb;
  v_gone integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to join trips.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'Trips are joined by the office or a leader.' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NULL OR p_next_trip_id IS NULL THEN
    RAISE EXCEPTION 'Name the trip and the trip that went out next.' USING ERRCODE = '22023';
  END IF;
  IF p_trip_id = p_next_trip_id THEN
    RAISE EXCEPTION 'A trip is joined with the next one, not with itself.' USING ERRCODE = '22023';
  END IF;

  -- Two presses on one pair wait for each other here. A dry run takes no lock: it may run where nothing can be written.
  IF NOT p_dry_run THEN
    PERFORM 1 FROM public.trips t WHERE t.id IN (p_trip_id, p_next_trip_id) ORDER BY t.id FOR UPDATE;
  END IF;

  SELECT tr.id, tr.development_id, tr.job_id, tr.purpose, tr.asked_by, tr.asked_who, tr.asked_how, tr.outcome,
         tr.billing, tr.ended_at, tr.trip_number
    INTO a
  FROM public.trips tr WHERE tr.id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That trip is not here any more. Close this and look again.' USING ERRCODE = '22023';
  END IF;
  SELECT tr.id, tr.development_id, tr.job_id, tr.purpose, tr.asked_by, tr.asked_who, tr.asked_how, tr.outcome,
         tr.billing, tr.ended_at, tr.trip_number
    INTO b
  FROM public.trips tr WHERE tr.id = p_next_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The next trip is not here any more. Close this and look again.' USING ERRCODE = '22023';
  END IF;
  -- The second is the next trip on the same home, or nothing is joined: a stale screen cannot join the wrong pair.
  IF public.trip_next_id(p_trip_id) IS DISTINCT FROM p_next_trip_id THEN
    RAISE EXCEPTION 'That is not the next trip on this site any more. Close this and look again.' USING ERRCODE = '22023';
  END IF;

  -- Billing: an empty one takes the other's. Two different ones wait for Change.
  IF a.billing IS NOT NULL AND b.billing IS NOT NULL AND a.billing <> b.billing THEN
    RAISE EXCEPTION 'These trips say two different billings: % and %. Make them match with Change, then join.',
      CASE a.billing WHEN 'inside' THEN 'Inside the price' WHEN 'extra' THEN 'Extra' ELSE 'Ours' END,
      CASE b.billing WHEN 'inside' THEN 'Inside the price' WHEN 'extra' THEN 'Extra' ELSE 'Ours' END
      USING ERRCODE = '22023';
  END IF;
  v_billing := COALESCE(a.billing, b.billing);

  -- The lines: one trip, one line.
  v_line := public.trip_join_line(p_trip_id, p_next_trip_id, false);
  IF v_line = 'both' THEN
    RAISE EXCEPTION 'Both trips are on a bill, each with its own line. A trip holds one line. Take one line off its job, then join.' USING ERRCODE = '22023';
  END IF;

  -- Everyone on either trip, by name as the save tells people apart. Each keeps every day from both, and where both
  -- give one person the same day this trip's kind stays.
  WITH pa AS (
    SELECT lower(btrim(tp.person_name)) AS k, tp.person_id, tp.user_id, tp.person_name, tp.days FROM public.trip_people tp WHERE tp.trip_id = p_trip_id
  ),
  pb AS (
    SELECT lower(btrim(tp.person_name)) AS k, tp.person_id, tp.user_id, tp.person_name, tp.days FROM public.trip_people tp WHERE tp.trip_id = p_next_trip_id
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
        'person_id', COALESCE(pa.person_id, pb.person_id), 'user_id', COALESCE(pa.user_id, pb.user_id),
        'name', COALESCE(pa.person_name, pb.person_name),
        'days', COALESCE(pb.days, '{}'::jsonb) || COALESCE(pa.days, '{}'::jsonb))
      ORDER BY COALESCE(pa.person_name, pb.person_name), COALESCE(pa.k, pb.k)), '[]'::jsonb)
    INTO v_people
  FROM pa FULL JOIN pb ON pa.k = pb.k;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', pa.person_name, 'day', e.key, 'kept', pa.days ->> e.key, 'dropped', e.value #>> '{}')
                            ORDER BY pa.person_name, e.key), '[]'::jsonb)
    INTO v_shared
  FROM public.trip_people pa
  JOIN public.trip_people pb ON pb.trip_id = p_next_trip_id AND lower(btrim(pb.person_name)) = lower(btrim(pa.person_name))
  CROSS JOIN LATERAL jsonb_each(pb.days) AS e
  WHERE pa.trip_id = p_trip_id AND pa.days ? e.key;

  SELECT COALESCE(jsonb_agg(j.job_id ORDER BY j.job_id), '[]'::jsonb) INTO v_jobs
  FROM (SELECT DISTINCT tj.job_id FROM public.trip_jobs tj WHERE tj.trip_id IN (p_trip_id, p_next_trip_id)) AS j;

  -- Who asked is one answer in three parts, so the next trip's is taken whole or not at all.
  IF a.asked_by IS NULL THEN
    v_asked_by := b.asked_by; v_asked_who := b.asked_who; v_asked_how := b.asked_how;
  ELSE
    v_asked_by := a.asked_by; v_asked_who := a.asked_who; v_asked_how := a.asked_how;
  END IF;

  v_p := jsonb_build_object(
    'id', p_trip_id, 'development_id', a.development_id, 'job_id', a.job_id,
    'purpose', CASE WHEN btrim(COALESCE(a.purpose, '')) <> '' THEN a.purpose ELSE COALESCE(b.purpose, '') END,
    'asked_by', v_asked_by, 'asked_who', COALESCE(v_asked_who, ''), 'asked_how', COALESCE(v_asked_how, ''),
    'outcome', CASE WHEN btrim(COALESCE(a.outcome, '')) <> '' THEN a.outcome ELSE COALESCE(b.outcome, '') END,
    'billing', v_billing, 'people', v_people, 'job_ids', v_jobs);

  IF p_dry_run THEN
    v_r := public.trip_save(v_p, true);
    SELECT jsonb_build_object('trip_number', a.trip_number, 'people', count(DISTINCT tp.id), 'first_day', min(k), 'last_day', max(k))
      INTO v_first FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = p_trip_id;
    SELECT jsonb_build_object('trip_number', b.trip_number, 'people', count(DISTINCT tp.id), 'first_day', min(k), 'last_day', max(k))
      INTO v_second FROM public.trip_people tp, jsonb_object_keys(tp.days) AS k WHERE tp.trip_id = p_next_trip_id;
    RETURN jsonb_build_object('dry_run', true, 'would', 'join', 'trip_id', p_trip_id, 'trip_number', a.trip_number,
      'next_trip_id', p_next_trip_id, 'next_trip_number', b.trip_number, 'first', v_first, 'second', v_second,
      'joined', v_r, 'shared_days', v_shared, 'line', v_line, 'billing', v_billing, 'ended', b.ended_at IS NOT NULL);
  END IF;

  -- The line first, while the second is still the next trip: the joined trip's days may sort it somewhere else.
  v_line := public.trip_join_line(p_trip_id, p_next_trip_id, true);

  -- The joined trip, whole, through the one door.
  v_r := public.trip_save(v_p, false);
  UPDATE public.trips SET ended_at = b.ended_at WHERE id = p_trip_id AND ended_at IS DISTINCT FROM b.ended_at;

  -- The next trip goes. Its capture reads which trip it was joined into, for this delete alone.
  PERFORM set_config('trips.joined_into', p_trip_id::text, true);
  DELETE FROM public.trips WHERE id = p_next_trip_id;
  GET DIAGNOSTICS v_gone = ROW_COUNT;
  PERFORM set_config('trips.joined_into', '', true);
  IF v_gone <> 1 THEN
    RAISE EXCEPTION 'The next trip could not be taken away, so nothing was joined.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('dry_run', false, 'did', 'join', 'trip_id', p_trip_id, 'trip_number', v_r -> 'trip_number',
    'gone_trip_id', p_next_trip_id, 'gone_trip_number', b.trip_number, 'joined', v_r, 'shared_days', v_shared,
    'line', v_line, 'billing', v_billing, 'ended', b.ended_at IS NOT NULL);
END
$fn$;

ALTER FUNCTION public.trip_join(uuid, uuid, boolean) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_join(uuid, uuid, boolean) IS 'Trips (#379): join a trip with the trip that went out next on the same home. The trip keeps its id, its number, its words and its via, and takes the next trip''s where what it was for, who asked or how it went is empty. Everyone on either trip is on it by name with every day from both, and where both give one person the same day this trip''s kind stays (shared_days names them). Its jobs are both trips'' jobs. Billing: an empty one takes the other''s, two different ones refuse. A line only the next trip holds is tied to the joined trip, and both holding one refuses. ended_at is the next trip''s. The next trip is deleted, kept 90 days marked with the trip it was joined into, and its number is not given again. Refuses a second trip that is not the next one. Written through trip_save inside this call, so all of it lands or none. SECURITY INVOKER: the trips tables'' policies decide who. The dry run writes nothing.';
REVOKE EXECUTE ON FUNCTION public.trip_join(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_join(uuid, uuid, boolean) TO authenticated, service_role;

-- 4a. The trip's capture, with the trip it was joined into. From prod's live body, which is 20261118203000's.
CREATE OR REPLACE FUNCTION public.trips_archive_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  j jsonb;
  v_line uuid;
  v_into jsonb;
BEGIN
  BEGIN
    j := to_jsonb(OLD);
    -- One trip, one line (jobs_ledger_fixtures_one_line_a_trip). The mark is still set here: the foreign key clears
    -- it after the trip's row is gone.
    SELECT f.id INTO v_line FROM public.jobs_ledger_fixtures f WHERE f.trip_id = OLD.id LIMIT 1;
    IF v_line IS NOT NULL THEN
      j := j || jsonb_build_object('held_line_id', v_line);
    END IF;
    -- A trip that goes because trip_join joined it into another keeps that trip beside the row, so Deleted trips
    -- offers no Put back for days the joined trip already holds. Only a trip that is there, and never itself.
    BEGIN
      SELECT jsonb_build_object('trip_id', t.id, 'trip_number', t.trip_number) INTO v_into
      FROM public.trips t
      WHERE t.id = NULLIF(current_setting('trips.joined_into', true), '')::uuid AND t.id <> OLD.id;
    EXCEPTION WHEN OTHERS THEN
      v_into := NULL;
    END;
    IF v_into IS NOT NULL THEN
      j := j || jsonb_build_object('joined_into', v_into);
    END IF;
    INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
    VALUES (TG_TABLE_NAME, OLD.id::text, OLD.id::text, j, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Never block a delete because archiving failed.
    RAISE WARNING 'trips_archive_on_delete failed for trip %: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END
$fn$;
ALTER FUNCTION public.trips_archive_on_delete() OWNER TO postgres;
COMMENT ON FUNCTION public.trips_archive_on_delete() IS 'Trips: BEFORE DELETE on trips. Snapshots the row into deleted_records_archive under the trip''s id, as the generic capture did, with held_line_id when a job''s line carries the trip and joined_into ({ trip_id, trip_number }) when trip_join joined it into another. Never raises.';
REVOKE EXECUTE ON FUNCTION public.trips_archive_on_delete() FROM PUBLIC, anon, authenticated;

-- 4b. A site's deleted trips, each with the trip it was joined into. From prod's live body, which is 20261118100000's.
CREATE OR REPLACE FUNCTION public.trip_deleted_list(p_development_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  -- A definer stands behind the tables' fences, so it holds them itself, as trip_phone does.
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin reads no deleted trip.' USING ERRCODE = '42501';
  END IF;
  -- The roles that read and change every trip. A person on a trip reads that trip, and no deleted one.
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'Only the office reads a site''s deleted trips.' USING ERRCODE = '42501';
  END IF;
  IF p_development_id IS NULL THEN
    RAISE EXCEPTION 'Name the site.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(x.item ORDER BY x.deleted_at DESC, x.record_id), '[]'::jsonb)
    INTO v_out
  FROM (
    SELECT d.record_id, d.deleted_at,
      jsonb_build_object(
        'deleted_at', d.deleted_at,
        'deleted_by_name', (SELECT u.name FROM public.users u WHERE u.id = d.deleted_by),
        -- A job the trip named that has since been deleted is left out of the trip, and counted here.
        'jobs_gone', (
          SELECT count(*) FROM public.deleted_records_archive j
          WHERE j.table_name = 'trip_jobs' AND j.group_key = d.record_id AND j.deleted_at = d.deleted_at AND j.restored_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = (j.row_data ->> 'job_id')::uuid)
        ),
        -- The trip this one was joined into (trip_join), null for a trip somebody deleted. Its days are on that trip.
        'joined_into', d.row_data -> 'joined_into',
        'trip', jsonb_build_object(
          'id', d.record_id,
          'trip_number', d.row_data -> 'trip_number',
          'development_id', d.row_data -> 'development_id',
          'job_id', d.row_data -> 'job_id',
          'purpose', d.row_data -> 'purpose',
          'asked_by', d.row_data -> 'asked_by',
          'asked_who', d.row_data -> 'asked_who',
          'asked_how', d.row_data -> 'asked_how',
          'outcome', d.row_data -> 'outcome',
          'billing', d.row_data -> 'billing',
          'via', d.row_data -> 'via',
          'created_at', d.row_data -> 'created_at',
          -- A roster row or a login that is gone since is a name alone, so the save does not trip on it.
          'trip_people', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                     'person_id', (SELECT pe.id FROM public.people pe WHERE pe.id = NULLIF(p.row_data ->> 'person_id', '')::uuid),
                     'user_id', (SELECT u.id FROM public.users u WHERE u.id = NULLIF(p.row_data ->> 'user_id', '')::uuid),
                     'person_name', p.row_data ->> 'person_name',
                     'days', COALESCE(p.row_data -> 'days', '{}'::jsonb))
                   ORDER BY p.row_data ->> 'person_name', p.record_id)
            FROM public.deleted_records_archive p
            WHERE p.table_name = 'trip_people' AND p.group_key = d.record_id AND p.deleted_at = d.deleted_at AND p.restored_at IS NULL
          ), '[]'::jsonb),
          'trip_jobs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('job_id', j.row_data ->> 'job_id') ORDER BY j.row_data ->> 'job_id')
            FROM public.deleted_records_archive j
            WHERE j.table_name = 'trip_jobs' AND j.group_key = d.record_id AND j.deleted_at = d.deleted_at AND j.restored_at IS NULL
              AND EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = (j.row_data ->> 'job_id')::uuid)
          ), '[]'::jsonb)
        )
      ) AS item
    FROM (
      -- One row a trip: its newest delete that nothing has put back, and only while no trip holds its id.
      -- Its people and jobs above are the ones nothing has put back either: a trip made again settles every row
      -- of its older deletes, so what is left under its id belongs to this delete.
      SELECT DISTINCT ON (a.record_id) a.record_id, a.row_data, a.deleted_at, a.deleted_by
      FROM public.deleted_records_archive a
      WHERE a.table_name = 'trips'
        AND a.restored_at IS NULL
        AND a.record_id IS NOT NULL
        AND a.row_data ->> 'development_id' = p_development_id::text
        AND NOT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = a.record_id::uuid)
      ORDER BY a.record_id, a.deleted_at DESC
    ) d
    ORDER BY d.deleted_at DESC
    LIMIT 50
  ) x;

  RETURN v_out;
END
$fn$;
ALTER FUNCTION public.trip_deleted_list(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_deleted_list(uuid) IS 'Trips: a site''s deleted trips that nothing has put back, newest first, at most 50, for the trips office (dev, master_technician, assistant, controller, primary). Each is { deleted_at, deleted_by_name, jobs_gone, joined_into, trip }, the trip whole in the shape the app reads one (trip_people, trip_jobs), with a job, a roster row or a login that is gone since left out. joined_into is { trip_id, trip_number } for a trip that trip_join joined into another, whose days that trip holds, and null for a trip somebody deleted. Read from deleted_records_archive, which keeps a row 90 days. Refuses an archived caller and a digital twin itself. Putting a trip back is trip_save under its own id.';
REVOKE EXECUTE ON FUNCTION public.trip_deleted_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_deleted_list(uuid) TO authenticated, service_role;
