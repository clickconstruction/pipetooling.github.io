SET lock_timeout = '3s';

-- v2.7412 — Tagged job notes from the job window (punch list #363, PR 6 of six).
--
-- WHY. The job window, Job Mode and Quickfill post a note through the outbox (land_field_press, kind job_note), so a
-- note typed on a phone with no signal is kept and sent later. That path never reached job_note_post_tagged, so a note
-- typed there made no tag and answered none. This migration lets it.
--
--   * job_note_tags_write, restated from 20261116100000: the two-minute rule becomes a marker. The function that has
--     just inserted the note sets pt.note_just_posted, local to its transaction, and the tags are written only for
--     that note. A note the phone kept for an hour lands with its pressed time, which the two-minute rule refused.
--     No client can set the marker: each request is its own transaction and set_config is not exposed.
--   * job_note_post_tagged, restated from 20261116100000: sets the marker before it asks for the tags. Nothing else.
--   * land_field_press, restated from 20261030040000 (prod's body compared equal on 2026-11-15): its job_note branch
--     writes the tags for a press that says typed: true. The clock kinds, the report and the record of the landing
--     are the same text.
--
-- ORDER. Push before the client that sends typed and tagged in the payload. The old body ignores both keys, so a
-- client ahead of this push posts the note with no tag, which is what it does today.
--
-- No CREATE TABLE, so no fence call is owed. Idempotent: CREATE OR REPLACE throughout.

CREATE OR REPLACE FUNCTION public.job_note_tags_write(p_note_id uuid, p_tagged uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_job     uuid;
  v_author  uuid;
  v_ids     uuid[];
  v_missing text;
  v_n       integer := 0;
BEGIN
  SELECT n.job_id, n.author_user_id INTO v_job, v_author
  FROM public.jobs_ledger_thread_notes n WHERE n.id = p_note_id;
  IF v_me IS NULL OR v_job IS NULL OR v_author IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Only the note''s writer can tag a teammate in it' USING ERRCODE = '42501';
  END IF;
  -- Only the function that has just inserted this note, in this same transaction, may write its tags. The marker is
  -- local to the transaction and no client can set it: each request is its own transaction and set_config is not
  -- exposed. It replaces the two-minute rule of 20261116100000, which refused a note the phone had kept for an hour.
  IF current_setting('pt.note_just_posted', true) IS DISTINCT FROM p_note_id::text THEN
    RAISE EXCEPTION 'A teammate is tagged when the note is posted, not afterwards' USING ERRCODE = '22023';
  END IF;

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_tagged, '{}'::uuid[])) AS x WHERE x IS NOT NULL AND x <> v_me);
  IF cardinality(v_ids) > 10 THEN
    RAISE EXCEPTION 'A note can tag ten people at most' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_ids) > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM public.job_note_people(v_job, true) p WHERE p.user_id = v_me) THEN
      RAISE EXCEPTION 'Only the office and this job''s crew can tag a teammate on it' USING ERRCODE = '42501';
    END IF;
    SELECT string_agg(coalesce(nullif(btrim(u.name), ''), 'That person'), ', ' ORDER BY u.name) INTO v_missing
    FROM unnest(v_ids) AS x
    LEFT JOIN public.users u ON u.id = x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_note_people(v_job, public.job_note_caller_sees_test()) p WHERE p.user_id = x
    );
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION '% cannot be tagged on this job, so the note was not posted', v_missing USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.jobs_ledger_note_tags (note_id, job_id, tagged_user_id, tagged_name, tagger_user_id)
    SELECT p_note_id, v_job, u.id, btrim(u.name), v_me
    FROM public.users u WHERE u.id = ANY (v_ids)
    ON CONFLICT (note_id, tagged_user_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  -- A typed note on the job answers every tag that waits on its writer there.
  UPDATE public.jobs_ledger_note_tags t
     SET cleared_at = now(), cleared_how = 'answered', answer_note_id = p_note_id
   WHERE t.job_id = v_job AND t.tagged_user_id = v_me AND t.cleared_at IS NULL AND t.note_id <> p_note_id;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.job_note_tags_write(uuid, uuid[]) IS
  'Writes the tag rows for a note its writer has just posted in this same transaction (the pt.note_just_posted marker), refusing a person job_note_people() does not list, and marks the writer''s own waiting tags on that job answered by this note. Returns the tags written. Called by job_note_post_tagged() and by land_field_press() for a job note. v2.7385, the marker v2.7412.';

REVOKE EXECUTE ON FUNCTION public.job_note_tags_write(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_tags_write(uuid, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.job_note_post_tagged(p_job_id uuid, p_body text, p_tagged uuid[] DEFAULT '{}'::uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_body text := btrim(coalesce(p_body, ''));
  v_id   uuid;
BEGIN
  IF v_body = '' THEN
    RAISE EXCEPTION 'Write the note first' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
  VALUES (p_job_id, auth.uid(), v_body)
  RETURNING id INTO v_id;
  PERFORM set_config('pt.note_just_posted', v_id::text, true);
  PERFORM public.job_note_tags_write(v_id, p_tagged);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) IS
  'Posts a typed job note and its tags in one transaction (punch list #363): the note under the caller''s own row-level security, the tags through job_note_tags_write(), which also answers the caller''s waiting tags on that job. A refused tag posts nothing. Returns the note''s id. v2.7385.';

REVOKE EXECUTE ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_note_post_tagged(uuid, text, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.land_field_press(
  p_id uuid,
  p_kind text,
  p_pressed_at timestamptz,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_slack interval := interval '10 minutes';
  v_oldest interval := interval '36 hours';
  v_pressed timestamptz;
  v_late boolean;
  v_existing public.field_presses%ROWTYPE;
  v_result jsonb;
  v_session_id uuid;
  v_open_id uuid;
  v_in_at timestamptz;
  v_out_at timestamptz;
  v_closed_at timestamptz;
  v_notes text;
  v_late_mark text;
  v_work_date date;
  v_body text;
  v_note_id uuid;
  v_report_id uuid;
  v_job uuid;
  v_project uuid;
  v_bid uuid;
  v_lat numeric;
  v_lng numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'The press has no id.' USING ERRCODE = '22023';
  END IF;

  -- A second landing of the same press: the first answer again, which is how it counts once.
  SELECT * INTO v_existing FROM public.field_presses WHERE id = p_id;
  IF FOUND THEN
    IF v_existing.user_id <> v_user THEN
      RAISE EXCEPTION 'That press is someone else''s.' USING ERRCODE = '42501';
    END IF;
    RETURN v_existing.result || jsonb_build_object('repeat', true);
  END IF;

  -- The pressed time, within reason: a phone clock ahead of the server reads as now; a press older
  -- than a day and a half is not sent, the day is reported instead (the missed clock-in form).
  v_pressed := COALESCE(p_pressed_at, v_now);
  IF v_pressed > v_now THEN
    v_pressed := v_now;
  END IF;
  IF v_pressed < v_now - v_oldest THEN
    RAISE EXCEPTION 'That press is more than a day old. Report the day instead.' USING ERRCODE = 'P0001';
  END IF;
  v_late := v_pressed < v_now - v_slack;
  v_work_date := (v_pressed AT TIME ZONE 'America/Chicago')::date;
  v_late_mark := CASE WHEN v_late
    THEN 'Sent late from the phone: pressed ' || to_char(v_pressed AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM')
      || ', reached the office ' || to_char(v_now AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM') || '.'
    ELSE NULL END;

  IF p_kind = 'clock_in' THEN
    -- Already clocked in (the office or another device did it): the press is refused with its reason.
    SELECT cs.id, cs.clocked_in_at INTO v_open_id, v_in_at
    FROM public.clock_sessions cs
    WHERE cs.user_id = v_user AND cs.clocked_out_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    ORDER BY cs.clocked_in_at DESC
    LIMIT 1;
    IF v_open_id IS NOT NULL THEN
      RAISE EXCEPTION 'You were already clocked in at %.', to_char(v_in_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM') USING ERRCODE = 'P0001';
    END IF;

    v_notes := COALESCE(NULLIF(trim(p_payload ->> 'notes'), ''), '');
    IF v_late_mark IS NOT NULL THEN
      v_notes := CASE WHEN v_notes = '' THEN v_late_mark ELSE v_late_mark || ' ' || v_notes END;
    END IF;

    INSERT INTO public.clock_sessions (user_id, clocked_in_at, work_date, notes, job_ledger_id, bid_id, travel_started_at, arrived_at)
    VALUES (
      v_user,
      v_pressed,
      v_work_date,
      v_notes,
      NULLIF(p_payload ->> 'job_ledger_id', '')::uuid,
      NULLIF(p_payload ->> 'bid_id', '')::uuid,
      CASE WHEN p_payload ->> 'travel' = 'on-the-way' THEN v_pressed ELSE NULL END,
      CASE WHEN p_payload ->> 'travel' = 'on-site' THEN v_pressed ELSE NULL END
    )
    RETURNING id INTO v_session_id;
    v_result := jsonb_build_object('session_id', v_session_id, 'late', v_late);

  ELSIF p_kind = 'clock_out' THEN
    -- The session: named, or the one the queued clock-in press made.
    v_session_id := NULLIF(p_payload ->> 'session_id', '')::uuid;
    IF v_session_id IS NULL AND NULLIF(p_payload ->> 'session_press_id', '') IS NOT NULL THEN
      SELECT (fp.result ->> 'session_id')::uuid INTO v_session_id
      FROM public.field_presses fp
      WHERE fp.id = (p_payload ->> 'session_press_id')::uuid AND fp.user_id = v_user;
    END IF;
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'The clock in it belongs to never reached the office.' USING ERRCODE = 'P0001';
    END IF;

    SELECT cs.clocked_in_at, cs.clocked_out_at INTO v_in_at, v_closed_at
    FROM public.clock_sessions cs
    WHERE cs.id = v_session_id AND cs.user_id = v_user AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;
    IF v_in_at IS NULL THEN
      RAISE EXCEPTION 'That session is gone. The office may have removed it.' USING ERRCODE = 'P0001';
    END IF;
    IF v_closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'The office closed that session at %.', to_char(v_closed_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM') USING ERRCODE = 'P0001';
    END IF;

    -- Never before the clock-in: a clock-out pressed before its clock-in landed closes at the later of the two.
    v_out_at := GREATEST(v_pressed, v_in_at + interval '1 minute');
    IF v_out_at > v_now THEN
      v_out_at := v_now;
    END IF;

    SELECT cs.notes INTO v_notes FROM public.clock_sessions cs WHERE cs.id = v_session_id;
    v_notes := COALESCE(NULLIF(trim(p_payload ->> 'notes'), ''), v_notes, '');
    IF v_late_mark IS NOT NULL AND position('Sent late from the phone' in v_notes) = 0 THEN
      v_notes := CASE WHEN v_notes = '' THEN v_late_mark ELSE v_notes || ' ' || v_late_mark END;
    END IF;

    UPDATE public.clock_sessions
    SET clocked_out_at = v_out_at,
        notes = v_notes,
        job_ledger_id = CASE WHEN p_payload ? 'job_ledger_id' THEN NULLIF(p_payload ->> 'job_ledger_id', '')::uuid ELSE job_ledger_id END,
        bid_id = CASE WHEN p_payload ? 'bid_id' THEN NULLIF(p_payload ->> 'bid_id', '')::uuid ELSE bid_id END
    WHERE id = v_session_id AND user_id = v_user AND clocked_out_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That session could not be closed.' USING ERRCODE = 'P0001';
    END IF;
    v_result := jsonb_build_object('session_id', v_session_id, 'late', v_late, 'clocked_out_at', v_out_at);

  ELSIF p_kind = 'job_note' THEN
    -- A job note, written at the moment it was pressed: the thread reads in the order things happened.
    v_body := NULLIF(trim(p_payload ->> 'body'), '');
    IF v_body IS NULL THEN
      RAISE EXCEPTION 'The note is empty.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body, created_at)
    VALUES ((p_payload ->> 'job_id')::uuid, v_user, v_body, v_pressed)
    RETURNING id INTO v_note_id;
    -- Tagged job notes (punch list #363, v2.7412): a note the person typed carries the teammates picked in it and
    -- answers the tags that wait on its writer on that job. Only a press that says typed: true does: a press queued
    -- by an older client, a stamp and a % line say nothing and answer nothing. A person who cannot be tagged
    -- refuses the whole press, so no note lands without the tag it was written with.
    IF COALESCE((p_payload ->> 'typed')::boolean, false) THEN
      PERFORM set_config('pt.note_just_posted', v_note_id::text, true);
      PERFORM public.job_note_tags_write(
        v_note_id,
        CASE WHEN jsonb_typeof(p_payload -> 'tagged') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(p_payload -> 'tagged'))::uuid[]
          ELSE '{}'::uuid[]
        END
      );
    END IF;
    v_result := jsonb_build_object('note_id', v_note_id, 'late', v_late);

  ELSIF p_kind = 'field_report' THEN
    -- A field report, filed at the moment it was pressed. An estimator goes through insert_report, the
    -- definer path the form already uses for that role; everyone else inserts under their own policy.
    v_job := NULLIF(p_payload ->> 'job_ledger_id', '')::uuid;
    v_project := NULLIF(p_payload ->> 'project_id', '')::uuid;
    v_bid := NULLIF(p_payload ->> 'bid_id', '')::uuid;
    v_lat := NULLIF(p_payload ->> 'lat', '')::numeric;
    v_lng := NULLIF(p_payload ->> 'lng', '')::numeric;
    IF public.is_estimator() THEN
      v_report_id := public.insert_report(
        (p_payload ->> 'template_id')::uuid,
        COALESCE(p_payload -> 'field_values', '{}'::jsonb),
        v_job, v_project, v_lat, v_lng, v_bid);
      UPDATE public.reports SET created_at = v_pressed WHERE id = v_report_id AND created_by_user_id = v_user;
    ELSE
      INSERT INTO public.reports (template_id, created_by_user_id, field_values, job_ledger_id, project_id, bid_id, reported_at_lat, reported_at_lng, created_at)
      VALUES ((p_payload ->> 'template_id')::uuid, v_user, COALESCE(p_payload -> 'field_values', '{}'::jsonb), v_job, v_project, v_bid, v_lat, v_lng, v_pressed)
      RETURNING id INTO v_report_id;
    END IF;
    v_result := jsonb_build_object('report_id', v_report_id, 'late', v_late);

  ELSE
    RAISE EXCEPTION 'That kind of press cannot be sent from the queue: %.', COALESCE(p_kind, 'none') USING ERRCODE = '22023';
  END IF;

  -- Remember the landing. A race between two tabs on the same id: the loser answers the winner's result.
  -- In training mode (users.read_only) the fences refuse the record while the person's own punch is
  -- allowed, as it is today; the punch stands and the answer says it was not recorded.
  BEGIN
    INSERT INTO public.field_presses (id, user_id, kind, pressed_at, landed_at, late, result)
    VALUES (p_id, v_user, p_kind, v_pressed, v_now, v_late, v_result);
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing FROM public.field_presses WHERE id = p_id;
      RETURN v_existing.result || jsonb_build_object('repeat', true);
    WHEN insufficient_privilege THEN
      RETURN v_result || jsonb_build_object('recorded', false);
  END;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.land_field_press(uuid, text, timestamptz, jsonb) IS
  'Punch list #163: lands a press the phone queued (clock_in, clock_out, job_note, field_report) by its phone-minted id and pressed time, under the caller''s own policies, and answers the first landing''s result again on a repeat. A late clock-in is inserted at the pressed time so the typed-hours ledger files the stretch as typed by the person (rule B); a note or a report is created at the pressed time.';
