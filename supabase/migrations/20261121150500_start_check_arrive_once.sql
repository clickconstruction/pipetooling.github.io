SET lock_timeout = '3s';

-- Before we start, on arrival (punch list #382, the audit of PR 10): a stage is answered once.
--
-- start_check_arrival_state asks about a stage only while nobody has arrived at it, and start_check_arrive
-- (20261120100000) took a row lock "to hold two arrivals apart". But the door itself never looked for the first
-- arrival, so a second answer was kept. Two of ours reach a site together and both have the card open. Hector says No
-- on the slab and sends. Luis, whose card was read before that, presses "Yes, all as told". The slab was still on the
-- list to look at, since a No leaves it with no yes we saw, so Luis's press was kept: a second arrival, and a yes we
-- saw on the very bullet Hector said No to. The office reads the newest arrival, so its stage stopped being red and
-- the No was gone from its list, with Dispatch's line the only trace.
--
-- Now the door refuses a second answer in words that name who answered first, and changes nothing. That is the rule
-- the read already held: the first of ours to answer has answered for the crew. A dev can still delete an arrival
-- (start_check_arrivals_delete), which opens the stage to be asked about again.
--
-- One function replaced, the same signature, the same grants. No table, so no closing calls. Idempotent.

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

  -- The lock holds two arrivals apart: the second one waits here, then reads the first and is refused.
  PERFORM 1 FROM public.jobs_ledger_fixtures f WHERE f.id = p_fixture_id FOR UPDATE;
  -- A stage is answered once. The first of ours to answer has answered for the crew.
  SELECT COALESCE(NULLIF(btrim(a.by_name), ''), 'Someone') INTO v_answered
    FROM public.start_check_arrivals a
   WHERE a.fixture_id = p_fixture_id
   ORDER BY a.created_at, a.id
   LIMIT 1;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION '% already answered for this stage.', v_answered USING ERRCODE = '22023';
  END IF;

  -- What there is to look at: the bullets on them that nobody of ours has seen.
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
COMMENT ON FUNCTION public.start_check_arrive(uuid, uuid[]) IS 'Before we start (#382): the crew''s answer on arrival at a stage, kept once a stage. Each bullet as told becomes a yes we saw in the caller''s name. A No opens its bullet again and sends Dispatch one stage check (#245''s road). The arrival keeps the trip the caller is on today. For the job''s crew and desk. Refuses a second answer at a stage, an archived caller, training mode and a digital twin.';
REVOKE EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_check_arrive(uuid, uuid[]) TO authenticated, service_role;
