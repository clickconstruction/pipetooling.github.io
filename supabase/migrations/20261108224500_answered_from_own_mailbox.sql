SET lock_timeout = '3s';

-- v2.6745 — Answered from my own mailbox (punch list #207, the owner's variant of call 1, in place of PR 4).
--
-- An estimator who answers a customer from their own mailbox, wendi@ and not bids@, leaves no trace the app can read:
-- the reader reads the two boxes alone (and, since v2.6731, their Sent folders). The thread keeps reading Our move. The
-- strip above the reply box offers the sent mail when the app can see it (My email's list as the person, tagged onto
-- the job) and otherwise this door: the answer written down by hand as our line. A signed-in client cannot insert an
-- out line (`messages_team_is_note_or_event`, and the restrictive `messages_client_writes_own_team_lines` admits notes
-- and events only), and a team note moves nothing, so the record needs a SECURITY DEFINER door like `log_call`
-- (`20261021010000_log_call.sql`). The line is an email going out (`channel 'email'`, `direction 'out'`), the person
-- as who, `mailbox 'mine'` and `mail_user_id` the person (as a line tagged from their own box reads), the words typed
-- or *Answered from my own mailbox.*, the job on its column; `messages_move_state` reads it as a reply, so the court
-- flips to theirs and whoever had the thread lets go. Follow up's guard (`follow_up_press`: a sign-in, no training
-- account, no digital twin, the office team), every refusal in words. Idempotent: the function is replaced.

CREATE OR REPLACE FUNCTION public.answered_from_own_mailbox(
  p_contact_id uuid,
  p_words text DEFAULT NULL,
  p_job_kind text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('say you answered from your own mailbox');
  v_words text := nullif(btrim(coalesce(p_words, '')), '');
  v_id uuid;
BEGIN
  IF v_words IS NOT NULL AND length(v_words) > 2000 THEN
    RAISE EXCEPTION 'Keep the answer to 2,000 letters.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, mailbox, mail_user_id, bid_id, project_id, jobs_ledger_id)
  VALUES (
    p_contact_id, 'email', 'out', v_me,
    public.follow_up_user_name(v_me) || ' · answered from their own mailbox',
    coalesce(v_words, 'Answered from my own mailbox.'),
    'mine', v_me,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.answered_from_own_mailbox(uuid, text, text, uuid) IS
  'Punch list #207 (v2.6745): the thread''s Answered from my own mailbox press. Writes the answer an office member sent from their own mailbox as our line (channel email, direction out, mailbox mine), so the court flips to theirs. Follow up''s guard: the office team, no training account, no twin.';

REVOKE EXECUTE ON FUNCTION public.answered_from_own_mailbox(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answered_from_own_mailbox(uuid, text, text, uuid) TO authenticated, service_role;
