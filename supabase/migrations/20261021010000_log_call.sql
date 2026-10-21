SET lock_timeout = '3s';

-- v2.5710 — Log a call (punch list #140 PR 7, the train's one migration).
--
-- The reply box's fourth kind, Call, logs a call the office made: what they said and the day they gave. A signed-in
-- client cannot write a call line (`messages_team_is_note_or_event` makes a team line a note or an event, and the
-- restrictive `messages_client_writes_own_team_lines` lets a client insert notes and events only), and a team note
-- would leave the thread's chip on "Our move" and never hold Waiting on them. So `log_call` writes the call as our line
-- (`channel 'call'`, `direction 'out'`, the caller as who), which the trigger `messages_move_state` reads as a reply:
-- the conversation's state goes to done and whoever had it lets go. The day they gave goes on that line as a written
-- promise of a new kind, 'said', which `runningPromise` reads like any other written promise, so the chip reads
-- "Their move · until …" and Waiting on them can hold the row until the day. The person's open calls to make close as
-- a Quo-logged call closes them (`call_tasks_close_by_call`). SECURITY DEFINER with Follow up's own guard
-- (`follow_up_press`: a sign-in, no training account, no digital twin, the office team), and every refusal in words.
-- Idempotent: the constraint is dropped and re-added, the function replaced.

ALTER TABLE public.message_promises DROP CONSTRAINT IF EXISTS message_promises_kind_known;
ALTER TABLE public.message_promises ADD CONSTRAINT message_promises_kind_known
  CHECK (kind IN ('quote', 'start', 'papers', 'payment', 'decision', 'access', 'answer', 'cert', 'question', 'said'));

CREATE OR REPLACE FUNCTION public.log_call(
  p_contact_id uuid,
  p_said text,
  p_day date DEFAULT NULL,
  p_day_words text DEFAULT NULL,
  p_job_kind text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('log a call');
  v_said text := btrim(coalesce(p_said, ''));
  v_words text := nullif(btrim(coalesce(p_day_words, '')), '');
  v_name text;
  v_first text;
  v_id uuid;
BEGIN
  IF v_said = '' THEN
    RAISE EXCEPTION 'Write what they said first.' USING ERRCODE = 'P0001';
  END IF;
  IF p_day IS NOT NULL AND v_words IS NOT NULL THEN
    RAISE EXCEPTION 'A day is a date or the words typed, not both.' USING ERRCODE = 'P0001';
  END IF;
  IF v_words IS NOT NULL AND length(v_words) > 80 THEN
    RAISE EXCEPTION 'Keep the day to 80 letters.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  -- The line names them as the thread does, by first name: a title ("Dr. Priya Raman") is skipped, and a number
  -- nobody has named stays whole.
  v_name := btrim(coalesce(public.contact_display_name(p_contact_id), ''));
  v_first := CASE
    WHEN v_name = '' THEN 'them'
    WHEN v_name ~ '\d' THEN v_name
    WHEN split_part(v_name, ' ', 1) ~ '\.$' AND split_part(v_name, ' ', 2) <> '' THEN split_part(v_name, ' ', 2)
    ELSE split_part(v_name, ' ', 1)
  END;
  INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, bid_id, project_id, jobs_ledger_id)
  VALUES (
    p_contact_id, 'call', 'out', v_me, public.follow_up_user_name(v_me),
    'Called ' || v_first || '. They said: ' || v_said,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END)
  RETURNING id INTO v_id;
  IF p_day IS NOT NULL OR v_words IS NOT NULL THEN
    INSERT INTO public.message_promises (message_id, kind, state, day, day_words, decided_by, decided_at)
    VALUES (v_id, 'said', 'written', p_day, v_words, v_me, clock_timestamp());
  END IF;
  UPDATE public.call_tasks
  SET done_at = clock_timestamp(), done_how = 'call', done_by = v_me, done_message_id = v_id
  WHERE contact_id = p_contact_id AND done_at IS NULL;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_call(uuid, text, date, text, text, uuid) IS
  'Punch list #140 PR 7 (v2.5710): the reply box''s Call kind. Writes the call the office made as our line (channel call, direction out), the day they gave as a written promise of kind said, and closes their open calls to make. Follow up''s guard: the office team, no training account, no twin.';

REVOKE EXECUTE ON FUNCTION public.log_call(uuid, text, date, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_call(uuid, text, date, text, text, uuid) TO authenticated, service_role;
