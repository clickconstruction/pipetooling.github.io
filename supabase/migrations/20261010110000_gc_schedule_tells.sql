SET lock_timeout = '3s';

-- GC mode, the schedule's PR 13a (v2.5173): Tell the trades and their answers (to-dos/gc-mode/mockups/schedule-pr13.md
-- on branch spike/gc-mode). The tables are PR 3's (gc_schedule_move_tells, gc_schedule_move_answers); this adds their
-- two writes. The office records the companies it told, after gc-trade-email sent each one its dates; a company answers
-- from its portal through the submit function. Both are records: neither touches the plan or its version, and each
-- day is the company's (app_today()). No table is created.

-- The companies told of moves (Tell the trades, G-132): once gc-trade-email has sent a company its new dates, one row
-- per move and company, with that company's lines the move changed and the dates the message gave (shown), and the
-- send's log row. A row already there stays as it is, so a press again after a send that went but was not recorded
-- records it once. A move undone, or on another job, is refused whole. Under the tells' own policy (a dev's until the
-- schedule's PR 10). Returns how many rows it added.
CREATE OR REPLACE FUNCTION public.gc_schedule_record_tells(p_project_id uuid, p_company_id uuid, p_email_send_log_id uuid, p_tells jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tell jsonb;
  v_move public.gc_schedule_moves%ROWTYPE;
  v_added integer := 0;
BEGIN
  IF jsonb_typeof(p_tells) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tells) = 0 THEN
    RAISE EXCEPTION 'Nothing was told.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_tell IN SELECT value FROM jsonb_array_elements(p_tells) LOOP
    SELECT * INTO v_move FROM public.gc_schedule_moves
     WHERE id = nullif(v_tell ->> 'moveId', '')::uuid AND project_id = p_project_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A move in this tell is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_move.undone_on IS NOT NULL THEN
      RAISE EXCEPTION 'A move in this tell was undone. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.gc_schedule_move_tells (move_id, company_id, told_on, shown, email_send_log_id)
    VALUES (v_move.id, p_company_id, public.app_today(), coalesce(v_tell -> 'shown', '[]'::jsonb), p_email_send_log_id)
    ON CONFLICT (move_id, company_id) DO NOTHING;
    IF FOUND THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_added;
END;
$$;

-- A company's answer to its new dates from its portal (tradeAnswerDates, G-113): the dates work, or another day asked
-- for, today or later, with a note if it likes. Only for a move it was told of, while the move stands, and once. Its
-- refusals are the portal's keys, each with its words as DETAIL. Service role only: the submit function calls it once it
-- has turned a link into its company.
CREATE OR REPLACE FUNCTION public.gc_trade_answer_dates(p_company_id uuid, p_move_id uuid, p_ok boolean, p_day date, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_move public.gc_schedule_moves%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No move with that id.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_move_tells WHERE move_id = p_move_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That company was not told of that move.';
  END IF;
  IF v_move.undone_on IS NOT NULL THEN
    RAISE EXCEPTION 'datesTakenBack' USING ERRCODE = 'P0001', DETAIL = 'The office took those dates back.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_move_answers WHERE move_id = p_move_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'Those dates have their answer already.';
  END IF;
  IF p_ok IS NULL OR (p_ok AND p_day IS NOT NULL) THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say the dates work, or ask for another day.';
  END IF;
  IF NOT p_ok AND p_day IS NULL THEN
    RAISE EXCEPTION 'dayNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say which day works.';
  END IF;
  IF NOT p_ok AND p_day < public.app_today() THEN
    RAISE EXCEPTION 'dayPassed' USING ERRCODE = 'P0001', DETAIL = 'Pick today or a day after it.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  INSERT INTO public.gc_schedule_move_answers (move_id, company_id, answered_on, ok, day, note)
  VALUES (p_move_id, p_company_id, public.app_today(), p_ok, p_day, nullif(v_note, ''));
EXCEPTION
  -- Two answers at once: the first stands.
  WHEN unique_violation THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'Those dates have their answer already.';
END;
$$;

COMMENT ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) IS
  'GC mode (v2.5173): the companies told of moves (Tell the trades, G-132), after gc-trade-email sent each its dates. One row per move and company with the dates shown and the send''s log row; one already there stays. A move undone or on another job is refused. A record: no version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) IS
  'GC mode (v2.5173): a company''s answer to its new dates from its portal (tradeAnswerDates, G-113): they work, or another day asked for, today or later. Only a move it was told of, while it stands, and once. Service role only.';

-- The office's record: signed-in users, the tells' own policy deciding who.
REVOKE ALL ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) TO authenticated;
-- The trade's answer: only the service role, the submit function after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) TO service_role;
