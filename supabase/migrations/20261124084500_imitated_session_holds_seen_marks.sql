SET lock_timeout = '3s';

-- View as and Imitate (v2.8459): the four "seen" marks refuse a session someone else opened as the person.
--
-- A dev in View as is signed in as the person. Four functions mark something as seen for whoever calls them, and the
-- app calls each with no press, when the thing is on the screen: an answer to a note the person tagged someone in
-- (job_note_tags_seen, task_note_tags_seen), a bid marked for them (bid_mark_requests_seen), and a law firm's answers
-- (legal_firm_intake_seen). So a dev's look cleared what the person had not read. v2.8246 stopped the client sending
-- them while View as is on. This is the same rule on the server, so a browser still holding an older build, or any
-- other client, cannot mark them either.
--
-- Each function is restated from the file that made it, with one early return when session_opened_by_imitation()
-- (v2.8251, 20261122021600) says the calling session was opened by an imitation:
--   * job_note_tags_seen()            from 20261116100000_jobs_ledger_note_tags.sql   answers 0
--   * task_note_tags_seen()           from 20261117160000_task_note_tags.sql           answers 0
--   * bid_mark_requests_seen(uuid)    from 20261001170000_bid_mark_requests.sql        answers 0
--   * legal_firm_intake_seen(uuid)    from 20261008001000_legal_firm_intake.sql        answers nothing, after its own
--     office check, so a caller the office check refuses is still refused in words.
-- The hold answers as a call that found nothing to mark, so no client reads it as a failure.
--
-- What is left alone: a press. bid_mark_requests_close (Done, Not for me) and every other function a person presses
-- for still save in View as, as that person, by design. The three marks that are table writes, not functions
-- (user_bid_notes_read_state, bid_plan_questions.seen_at, the first look stamp), stay held by the client alone.
--
-- Idempotent: four CREATE OR REPLACE and their comments. No table is made, so no fence call closes the file. Grants
-- and owners are as the first files left them: CREATE OR REPLACE keeps both.

CREATE OR REPLACE FUNCTION public.job_note_tags_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  -- A session someone else opened as this person (Imitate, View as) has read nothing for them.
  IF public.session_opened_by_imitation() THEN
    RETURN 0;
  END IF;

  UPDATE public.jobs_ledger_note_tags
     SET asker_seen_at = now()
   WHERE tagger_user_id = auth.uid() AND cleared_at IS NOT NULL AND asker_seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.job_note_tags_seen() IS
  'Marks every cleared tag the caller asked as seen (punch list #363), so an answer stops counting above Jobs once the You asked list has been on the asker''s screen. Returns how many. v2.7385. Marks nothing and returns 0 for a session opened by an imitation (session_opened_by_imitation(), v2.8459): a dev looking as a person has read nothing for them.';

CREATE OR REPLACE FUNCTION public.task_note_tags_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_n integer;
BEGIN
  -- A session someone else opened as this person (Imitate, View as) has read nothing for them.
  IF public.session_opened_by_imitation() THEN
    RETURN 0;
  END IF;

  UPDATE public.task_note_tags
     SET asker_seen_at = now()
   WHERE tagger_user_id = auth.uid() AND cleared_at IS NOT NULL AND asker_seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.task_note_tags_seen() IS
  'Marks every cleared task tag the caller asked as seen (punch list #375), so an answer stops counting above Checklist once the You asked list has been on the asker''s screen. Returns how many. One function for each kind of tag: each section shows its own kind. v2.7570. Marks nothing and returns 0 for a session opened by an imitation (session_opened_by_imitation(), v2.8459).';

-- The receiver opened the bid: every open, unseen request for them on it is seen now.
CREATE OR REPLACE FUNCTION public.bid_mark_requests_seen(p_bid_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  -- A session someone else opened as this person (Imitate, View as) has read nothing for them.
  IF public.session_opened_by_imitation() THEN
    RETURN 0;
  END IF;

  UPDATE public.bid_mark_requests
     SET seen_at = now()
   WHERE bid_id = p_bid_id AND for_user_id = auth.uid() AND closed_at IS NULL AND seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.bid_mark_requests_seen(uuid) IS
  'The receiver opened the bid: every open, unseen request for them on it is seen now (v2.4297). Returns how many. Marks nothing and returns 0 for a session opened by an imitation (session_opened_by_imitation(), v2.8459). Done and Not for me (bid_mark_requests_close) are presses and are not held.';

CREATE OR REPLACE FUNCTION public.legal_firm_intake_seen(p_firm_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.legal_office_can_read() THEN
    RAISE EXCEPTION 'Only the office reads the firm''s answers';
  END IF;

  -- A session someone else opened as this person (Imitate, View as) has read nothing for them.
  IF public.session_opened_by_imitation() THEN
    RETURN;
  END IF;

  UPDATE public.legal_firms
     SET intake_seen_at = now()
   WHERE id = p_firm_id
     AND intake_sent_at IS NOT NULL
     AND (intake_seen_at IS NULL OR intake_seen_at < intake_sent_at);
END;
$$;

COMMENT ON FUNCTION public.legal_firm_intake_seen(uuid) IS 'The office read the firm''s answers to Start here (v2.4821): stamps legal_firms.intake_seen_at so the Legal desk''s firm door loses its dot. Office only (legal_office_can_read()). Stamps nothing for a session opened by an imitation (session_opened_by_imitation(), v2.8459).';
