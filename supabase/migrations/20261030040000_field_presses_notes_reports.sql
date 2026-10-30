SET lock_timeout = '3s';

-- Offline in the field (punch list #163 PR 3): the queue's two more kinds. land_field_press
-- (20261029230000, PR 2) landed clock_in and clock_out; this CREATE OR REPLACE adds job_note
-- (a row in jobs_ledger_thread_notes, created at the pressed time) and field_report (a row in
-- reports, created at the pressed time; an estimator through insert_report as the form already
-- does for that role). The clock kinds are the same text as PR 2's. Still SECURITY INVOKER: every
-- write runs under the caller's own policies, exactly as the phone's direct inserts do today.
-- The table field_presses is unchanged (its CHECK already names the four kinds).

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
