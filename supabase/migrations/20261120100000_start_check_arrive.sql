SET lock_timeout = '3s';

-- Before we start, on arrival (punch list #382, PR 10): the crew's "Is it as told?".
--
-- The first person of ours to reach a stage is shown the bullets on them that nobody of ours has seen, and answers
-- "Yes, all as told" or says No on some. Until now the crew wrote nothing on these tables. Two functions, and no table:
--
--   start_check_arrival_state(job)        what to ask on this job right now, or nothing. A definer read, since the crew
--                                         reads no stage window by the table's own policy.
--   start_check_arrive(fixture, no[])     the one door that keeps the answer. Each bullet as told becomes a yes we
--                                         saw, in the name of the person who got there. A No opens its bullet again
--                                         and sends Dispatch a stage check, on the road punch list #245 built
--                                         (dispatch_requests, pending_action 'stage_check'). There is no checklist
--                                         question behind it, so question_id is null and the payload carries
--                                         start_check_arrival_id: the inbox reads that and opens the job's list.
--                                         The arrival keeps the trip the person is on, when there is one.
--
-- A stage is asked about from the first of our days for it, and never while it has no days of ours.
--
-- Who: the crew on the job (start_checks_crew) and the job's desk (start_checks_desk). Both functions refuse an
-- archived caller, training mode and a digital twin themselves, and open no job to a primary beyond is_job_people,
-- since both gates already hold that. Nobody is stopped: a person is clocked in whatever they answer.
--
-- Additive and idempotent. It creates no table, so it carries no closing calls.

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
  -- The stage to ask about: an unfinished stage line with a bullet on them nobody of ours has seen, that nobody has
  -- arrived at yet, and whose days have come. A stage with no days of ours is not asked about: nobody was sent to it.
  -- The one whose days hold today leads.
  SELECT f.id, COALESCE(NULLIF(btrim(f.name), ''), 'Stage')
    INTO v_fixture, v_name
    FROM public.jobs_ledger_fixtures f
    JOIN public.job_stage_windows w ON w.fixture_id = f.id
   WHERE f.job_id = p_job_id
     AND f.stage_kind IN ('order', 'any')
     AND COALESCE(f.progress_pct, 0) < 100
     AND w.window_start <= v_today
     AND NOT EXISTS (SELECT 1 FROM public.start_check_arrivals a WHERE a.fixture_id = f.id)
     AND EXISTS (
       SELECT 1 FROM public.start_check_bullets b
        WHERE b.fixture_id = f.id AND b.waits_on = 'them' AND b.removed_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = b.id AND m.taken_back_at IS NULL AND m.know = 'saw')
     )
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
         WHERE b.fixture_id = v_fixture AND b.waits_on = 'them' AND b.removed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = b.id AND m.taken_back_at IS NULL AND m.know = 'saw')
      ), '[]'::jsonb)
    )
  );
END
$fn$;
COMMENT ON FUNCTION public.start_check_arrival_state(uuid) IS 'Before we start (#382): what the crew is asked on arrival at a job. The one stage whose days have come that nobody has arrived at, with the bullets on them nobody of ours has seen. For the job''s crew and desk. Nothing for anyone else, an archived caller or a digital twin.';
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
  v_arrival uuid;
  v_trip uuid;
  v_request uuid;
  v_first text;
  v_told text;
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

  -- What there is to look at: the bullets on them that nobody of ours has seen. The lock holds two arrivals apart.
  PERFORM 1 FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id FOR UPDATE;
  SELECT COALESCE(array_agg(b.id ORDER BY b.sort_order, b.created_at, b.id), '{}'::uuid[]) INTO v_look
    FROM public.start_check_bullets b
   WHERE b.fixture_id = p_fixture_id AND b.waits_on = 'them' AND b.removed_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.start_check_marks m WHERE m.bullet_id = b.id AND m.taken_back_at IS NULL AND m.know = 'saw');
  IF cardinality(v_look) = 0 THEN
    RAISE EXCEPTION 'There is nothing left to look at on this stage.' USING ERRCODE = '22023';
  END IF;
  v_no := COALESCE(ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_not_as_told, '{}'::uuid[])) AS x), '{}'::uuid[]);
  IF NOT (v_no <@ v_look) THEN
    RAISE EXCEPTION 'The list has changed. Open it again.' USING ERRCODE = '22023';
  END IF;

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
  VALUES (v_job, p_fixture_id, v_today, v_no, v_trip, v_uid, v_name)
  RETURNING id INTO v_arrival;

  -- Who told us each one was ready, before the yes is taken back: the office reads it beside the No.
  SELECT string_agg(DISTINCT m.who_name, ', ') INTO v_told
    FROM public.start_check_marks m
   WHERE m.bullet_id = ANY (v_no) AND m.taken_back_at IS NULL AND m.source <> 'crew';

  FOR v_b IN SELECT b.id, b.words FROM public.start_check_bullets b WHERE b.id = ANY (v_look) ORDER BY b.sort_order, b.created_at, b.id LOOP
    UPDATE public.start_check_marks SET taken_back_at = v_now, taken_back_by = v_uid, taken_back_by_name = v_name
     WHERE bullet_id = v_b.id AND taken_back_at IS NULL;
    IF v_b.id = ANY (v_no) THEN
      v_first := COALESCE(v_first, v_b.words);
    ELSE
      INSERT INTO public.start_check_marks (bullet_id, job_id, know, who_name, how, said_on, source, arrival_id, by_user, by_name)
      VALUES (v_b.id, v_job, 'saw', v_name, 'on arrival', v_today, 'crew', v_arrival, v_uid, v_name);
    END IF;
  END LOOP;

  -- A No tells Dispatch as a stage check, the way a check a crew cannot do already does (#245). One line an arrival.
  IF cardinality(v_no) > 0 THEN
    INSERT INTO public.dispatch_requests (from_user_id, title, job_ledger_id, fixture_id, pending_action, pending_payload, priority)
    VALUES (
      v_uid,
      left(
        v_stage || ' · “' || left(v_first, 300) || '” · something else: not as told on arrival'
          || CASE WHEN cardinality(v_no) > 1 THEN ', and ' || (cardinality(v_no) - 1) || ' more' ELSE '' END
          || CASE WHEN v_told IS NOT NULL THEN '. ' || v_told || ' told us it was ready' ELSE '' END,
        2000
      ),
      v_job,
      p_fixture_id,
      'stage_check',
      jsonb_build_object('stage_check', jsonb_build_object(
        'fixture_id', p_fixture_id, 'question_id', NULL, 'reason', 'other', 'stage_name', v_stage,
        'words', 'Not as told on arrival', 'start_check_arrival_id', v_arrival, 'not_as_told', to_jsonb(v_no), 'told_by', v_told
      )),
      'high'
    )
    RETURNING id INTO v_request;
    UPDATE public.start_check_arrivals SET dispatch_request_id = v_request WHERE id = v_arrival;
  END IF;

  RETURN jsonb_build_object('ok', true, 'arrival_id', v_arrival, 'dispatch_request_id', v_request, 'trip_id', v_trip, 'as_told', cardinality(v_look) - cardinality(v_no), 'not_as_told', cardinality(v_no));
END
$fn$;
COMMENT ON FUNCTION public.start_check_arrive(uuid, uuid[]) IS 'Before we start (#382): the crew''s answer on arrival at a stage. Each bullet as told becomes a yes we saw in the caller''s name. A No opens its bullet again and sends Dispatch one stage check (#245''s road). The arrival keeps the trip the caller is on today. For the job''s crew and desk. Refuses an archived caller, training mode and a digital twin.';
REVOKE EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) TO authenticated, service_role;
