SET lock_timeout = '3s';

-- Before we start, on arrival (punch list #382, two calls from the audit of PR 10, on Taunya's word of 2026-11-21):
-- a stage is asked about again after a No, and a later No is kept.
--
-- Until now a stage was asked about once and answered once (20261121150500). Two things were lost by that:
--
--   A. After a No, nobody of ours was ever asked again. Hector says No on the slab. The office calls, and the customer
--      says it is poured now. That new yes is the one that most needs one of ours to see it, and the next person on
--      site was asked nothing. Only a dev deleting the arrival opened the stage again.
--   B. The first of two says "Yes, all as told" and the second says No on the slab. The second was refused, and a No
--      is the dearer of the two answers: it is the one that saves a wasted trip.
--
-- The rule now, in one place the read and the door both use (start_check_to_look):
--
--   Nobody has arrived yet    the bullets on them that nobody of ours has seen, as before.
--   Someone has arrived       the bullets that had a No, that the office or the customer has given a new yes since,
--                             and that nobody of ours has seen. A bullet with a No and no new yes is not asked
--                             about: nothing new was told us. A bullet written after the first arrival is not either.
--
-- And the door, once someone has arrived:
--
--   An answer to what is asked again   kept as a new arrival: each one as told becomes a yes we saw, each No opens
--                                      its bullet again and sends Dispatch its line.
--   A No on a bullet we saw as a yes   kept as a new arrival of its own, with its line to Dispatch. It takes that yes
--                                      back and writes no other yes: the card it came from may be an old one.
--   "Yes, all as told" with nothing    refused by name, as since 20261121150500: the first of ours to answer has
--   asked again, or a No that is       answered for the crew, and a second yes must not replace a No.
--   already standing
--
-- One function added, with no grant to anyone signed in, and two replaced with the same signatures and grants. No
-- table, so no closing calls. Idempotent.

CREATE OR REPLACE FUNCTION public.start_check_to_look(p_fixture_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(array_agg(b.id ORDER BY b.sort_order, b.created_at, b.id), '{}'::uuid[])
    FROM public.start_check_bullets b
   WHERE b.fixture_id = p_fixture_id AND b.waits_on = 'them' AND b.removed_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = b.id AND m.taken_back_at IS NULL AND m.know = 'saw')
     AND (
       NOT EXISTS (SELECT 1 FROM public.start_check_arrivals a WHERE a.fixture_id = p_fixture_id)
       OR (
         -- A No takes every yes on its bullet back, so a yes that stands on it now was given after the No.
         EXISTS (SELECT 1 FROM public.start_check_arrivals a WHERE a.fixture_id = p_fixture_id AND b.id = ANY (a.not_as_told))
         AND EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = b.id AND m.taken_back_at IS NULL)
       )
     )
$fn$;

-- The read and the door call it as their owner. Nobody else has a use for it.
REVOKE EXECUTE ON FUNCTION public.start_check_to_look(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_check_to_look(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.start_check_arrival_state(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today date := public.app_today();
  v_fixture uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL OR public.caller_is_archived() OR public.is_digital_twin() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF NOT (public.start_checks_crew(p_job_id) OR public.start_checks_desk(p_job_id)) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  -- The stage to ask about: an unfinished stage line whose days have come, with something to look at. A stage with no
  -- days of ours is not asked about: nobody was sent to it. The one whose days hold today leads.
  SELECT f.id, COALESCE(NULLIF(btrim(f.name), ''), 'Stage')
    INTO v_fixture, v_name
    FROM public.jobs_ledger_fixtures f
    JOIN public.job_stage_windows w ON w.fixture_id = f.id
   WHERE f.job_id = p_job_id
     AND f.stage_kind IN ('order', 'any')
     AND COALESCE(f.progress_pct, 0) < 100
     AND w.window_start <= v_today
     AND cardinality(public.start_check_to_look(f.id)) > 0
   ORDER BY (COALESCE(w.window_end, w.window_start) >= v_today) DESC, w.window_start DESC, f.sequence_order, f.id
   LIMIT 1;
  IF v_fixture IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'stage', NULL);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'stage', jsonb_build_object(
      'fixture_id', v_fixture,
      'name', v_name,
      'bullets', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', b.id, 'words', b.words) ORDER BY b.sort_order, b.created_at, b.id)
          FROM public.start_check_bullets b
         WHERE b.id = ANY (public.start_check_to_look(v_fixture))
      ), '[]'::jsonb)
    )
  );
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.start_check_arrival_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_arrival_state(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_check_arrive(p_fixture_id uuid, p_not_as_told uuid[] DEFAULT '{}'::uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_now timestamptz := now();
  v_job uuid;
  v_dev uuid;
  v_stage text;
  v_name text;
  v_look uuid[];
  v_no uuid[];
  v_news uuid[];
  v_take uuid[];
  v_yes uuid[];
  v_kept uuid[];
  v_arrival uuid;
  v_trip uuid;
  v_request uuid;
  v_first text;
  v_told text;
  v_answered text;
  v_b record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was kept.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin arrives at no stage.' USING ERRCODE = '42501';
  END IF;
  SELECT f.job_id, COALESCE(NULLIF(btrim(f.name), ''), 'Stage') INTO v_job, v_stage FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'That stage is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.start_checks_crew(v_job) OR public.start_checks_desk(v_job)) THEN
    RAISE EXCEPTION 'This is for the crew on the job.' USING ERRCODE = '42501';
  END IF;

  -- The lock holds two arrivals apart: the second one waits here, then reads what the first one left.
  PERFORM 1 FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id FOR UPDATE;
  SELECT COALESCE(NULLIF(btrim(a.by_name), ''), 'Someone') INTO v_answered
    FROM public.start_check_arrivals a
   WHERE a.fixture_id = p_fixture_id
   ORDER BY a.created_at, a.id
   LIMIT 1;

  -- What there is to look at right now, by the rule the read asks with.
  v_look := public.start_check_to_look(p_fixture_id);
  v_no := COALESCE(ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_not_as_told, '{}'::uuid[])) AS x), '{}'::uuid[]);

  IF v_answered IS NULL THEN
    -- The first answer at the stage.
    IF cardinality(v_look) = 0 THEN
      RAISE EXCEPTION 'There is nothing left to look at on this stage.' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_no <@ v_look) THEN
      RAISE EXCEPTION 'The list has changed. Open it again.' USING ERRCODE = '22023';
    END IF;
    v_take := v_look;
    v_kept := v_no;
  ELSE
    -- A later answer. Every No must still be a bullet on them at this stage.
    IF EXISTS (
      SELECT 1 FROM unnest(v_no) AS x
       WHERE NOT EXISTS (SELECT 1 FROM public.start_check_bullets b WHERE b.id = x AND b.fixture_id = p_fixture_id AND b.waits_on = 'them' AND b.removed_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'The list has changed. Open it again.' USING ERRCODE = '22023';
    END IF;
    -- The Nos that are news: on a bullet asked about again, or on one that stands as a yes we saw.
    v_news := COALESCE(ARRAY(
      SELECT x FROM unnest(v_no) AS x
       WHERE x = ANY (v_look)
          OR EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = x AND m.taken_back_at IS NULL AND m.know = 'saw')
    ), '{}'::uuid[]);
    IF cardinality(v_look) > 0 AND v_no <@ v_look THEN
      -- An answer to what is asked again.
      v_take := v_look;
      v_kept := v_no;
    ELSIF cardinality(v_news) > 0 THEN
      -- A later No. It takes back the yes it speaks to and writes no other: its card may be an old one.
      v_take := v_news;
      v_kept := v_news;
    ELSIF cardinality(v_look) > 0 THEN
      RAISE EXCEPTION 'The list has changed. Open it again.' USING ERRCODE = '22023';
    ELSE
      -- Nothing is asked again and no No is news. The first of ours to answer has answered for the crew.
      RAISE EXCEPTION '% already answered for this stage.', v_answered USING ERRCODE = '22023';
    END IF;
  END IF;
  v_yes := COALESCE(ARRAY(SELECT x FROM unnest(v_take) AS x WHERE NOT (x = ANY (v_kept))), '{}'::uuid[]);

  SELECT pe.name INTO v_name FROM public.people pe WHERE pe.account_user_id = v_uid AND pe.archived_at IS NULL ORDER BY pe.created_at LIMIT 1;
  IF v_name IS NULL OR btrim(v_name) = '' THEN
    SELECT COALESCE(NULLIF(btrim(u.name), ''), 'Someone') INTO v_name FROM public.users u WHERE u.id = v_uid;
  END IF;
  v_name := left(COALESCE(v_name, 'Someone'), 120);

  -- The trip this person is on today, on the job's site, when there is one. A No is what a wasted trip is billed with.
  SELECT j.development_id INTO v_dev FROM public.jobs_ledger j WHERE j.id = v_job;
  IF v_dev IS NOT NULL THEN
    SELECT t.id INTO v_trip
      FROM public.trips t
      JOIN public.trip_people me ON me.trip_id = t.id AND me.user_id = v_uid
     WHERE t.development_id = v_dev AND t.ended_at IS NULL AND me.days ? v_today::text
     ORDER BY t.created_at DESC
     LIMIT 1;
  END IF;

  INSERT INTO public.start_check_arrivals (job_id, fixture_id, arrived_on, not_as_told, trip_id, by_user, by_name)
  VALUES (v_job, p_fixture_id, v_today, v_kept, v_trip, v_uid, v_name)
  RETURNING id INTO v_arrival;

  -- Who told us each one was ready, before the yes is taken back: the office reads it beside the No.
  SELECT string_agg(DISTINCT m.who_name, ', ') INTO v_told
    FROM public.start_check_marks m
   WHERE m.bullet_id = ANY (v_kept) AND m.taken_back_at IS NULL AND m.source <> 'crew';

  FOR v_b IN SELECT b.id, b.words FROM public.start_check_bullets b WHERE b.id = ANY (v_take) ORDER BY b.sort_order, b.created_at, b.id LOOP
    UPDATE public.start_check_marks SET taken_back_at = v_now, taken_back_by = v_uid, taken_back_by_name = v_name
     WHERE bullet_id = v_b.id AND taken_back_at IS NULL;
    IF v_b.id = ANY (v_kept) THEN
      v_first := COALESCE(v_first, v_b.words);
    ELSE
      INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, how, said_on, source, arrival_id, by_user, by_name)
      VALUES (v_b.id, v_job, 'saw', v_name, 'on arrival', v_today, 'crew', v_arrival, v_uid, v_name);
    END IF;
  END LOOP;

  -- A No tells Dispatch as a stage check, the way a check a crew cannot do already does (#245). One line an arrival.
  IF cardinality(v_kept) > 0 THEN
    INSERT INTO public.dispatch_requests (from_user_id, title, job_ledger_id, fixture_id, pending_action, pending_payload, priority)
    VALUES (
      v_uid,
      left(
        v_stage || ' · “' || left(v_first, 300) || '” · something else: not as told on arrival'
          || CASE WHEN cardinality(v_kept) > 1 THEN ', and ' || (cardinality(v_kept) - 1) || ' more' ELSE '' END
          || CASE WHEN v_told IS NOT NULL THEN '. ' || v_told || ' told us it was ready' ELSE '' END,
        2000
      ),
      v_job,
      p_fixture_id,
      'stage_check',
      jsonb_build_object('stage_check', jsonb_build_object(
        'fixture_id', p_fixture_id, 'question_id', NULL, 'reason', 'other', 'stage_name', v_stage,
        'words', 'Not as told on arrival', 'start_check_arrival_id', v_arrival, 'not_as_told', to_jsonb(v_kept), 'told_by', v_told
      )),
      'high'
    )
    RETURNING id INTO v_request;
    UPDATE public.start_check_arrivals SET dispatch_request_id = v_request WHERE id = v_arrival;
  END IF;

  RETURN jsonb_build_object('ok', true, 'arrival_id', v_arrival, 'dispatch_request_id', v_request, 'trip_id', v_trip, 'as_told', cardinality(v_yes), 'not_as_told', cardinality(v_kept));
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) TO authenticated, service_role;
