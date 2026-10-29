SET lock_timeout = '3s';

-- Offline in the field (punch list #163 PR 2, v2.NNNN): the server side of the queue a phone keeps
-- when a press cannot reach the office. Every press carries an id minted on the phone and the
-- moment it was pressed; this table remembers each press that landed, with what the server
-- answered, so a send that lands twice (a timeout whose request landed, a resend after a lost
-- answer) counts once: the second landing is answered with the first's result. One RPC,
-- land_field_press, takes the id, the kind, the pressed time and the press's payload, does the
-- write the press asks for, and records it. This PR lands clock_in and clock_out; PR 3 adds
-- job_note and field_report (CREATE OR REPLACE, the same table).
--
-- The clock-time rule is B (decided 2026-10-29): a clock-in that lands late is inserted at the
-- pressed time, so the typed-hours ledger (v2.4242, clock_sessions_typed_record) files the
-- stretch older than its ten-minute slack as a typed entry by the person, which waits for approval
-- like any typed hours, and the session's notes carry a sent-late mark; the live session runs from
-- the moment the press lands. A late clock-out closes the session at the pressed time. One row,
-- not two: a clock-out pressed before its clock-in landed still closes it at its own time.
--
-- SECURITY INVOKER: the writes run under the caller's own policies, exactly as the phone's direct
-- inserts do today (a person inserts their own user_punch session and updates their own open one),
-- so the RPC widens nothing. The read-only fences and the twin fence apply as on any table.

CREATE TABLE IF NOT EXISTS public.field_presses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('clock_in', 'clock_out', 'job_note', 'field_report')),
  pressed_at timestamptz NOT NULL,
  landed_at timestamptz NOT NULL DEFAULT now(),
  late boolean NOT NULL DEFAULT false,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.field_presses IS 'Punch list #163: a press the phone queued and sent later, by the id the phone minted. A second landing of the same id is answered with result again, so it counts once. The press''s own row is in clock_sessions, jobs_ledger_thread_notes or reports.';
COMMENT ON COLUMN public.field_presses.pressed_at IS 'The phone''s clock at the press.';
COMMENT ON COLUMN public.field_presses.late IS 'Landed more than the typed-hours slack (10 minutes) after it was pressed.';
COMMENT ON COLUMN public.field_presses.result IS 'What the first landing answered: {"session_id": …}, {"note_id": …}, {"report_id": …}.';

CREATE INDEX IF NOT EXISTS idx_field_presses_user_landed ON public.field_presses (user_id, landed_at DESC);

ALTER TABLE public.field_presses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_presses_own_read ON public.field_presses;
CREATE POLICY field_presses_own_read ON public.field_presses
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_dev()) OR (SELECT public.has_payroll_access()) OR (SELECT public.is_assistant()));

DROP POLICY IF EXISTS field_presses_own_insert ON public.field_presses;
CREATE POLICY field_presses_own_insert ON public.field_presses
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.field_presses FROM anon;
GRANT SELECT, INSERT ON public.field_presses TO authenticated;
GRANT ALL ON public.field_presses TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- The one RPC
-- ─────────────────────────────────────────────────────────────────────────────────────────────

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

  ELSE
    RAISE EXCEPTION 'That kind of press cannot be sent from the queue yet: %.', COALESCE(p_kind, 'none') USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.land_field_press(uuid, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.land_field_press(uuid, text, timestamptz, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.land_field_press(uuid, text, timestamptz, jsonb) TO authenticated;

COMMENT ON FUNCTION public.land_field_press(uuid, text, timestamptz, jsonb) IS
  'Punch list #163: lands a press the phone queued (clock_in, clock_out; PR 3 adds job_note, field_report) by its phone-minted id and pressed time, under the caller''s own policies, and answers the first landing''s result again on a repeat. A late clock-in is inserted at the pressed time so the typed-hours ledger files the stretch as typed by the person (rule B).';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
