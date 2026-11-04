-- The email viewer's *Put it on a bid…* (v2.6509, 2026-11-04). Grace, on an invitation to bid in the Messages
-- thread window's email viewer: the row offered *Start a change order* and nothing for a bid, though the email is
-- a new bid, or the history of a bid someone already made from another source. The press ties the line to the bid
-- through the Tied to row's own writer (tie_message) and then writes one line on the bid's log
-- (bids_submission_entries, the Bid window's history): "Invitation to bid came in by email from Glenn Geling, Oct
-- 22." The log's one INSERT policy admits devs, masters, assistants and estimators and the bid's service type,
-- while the office team that may tie a line (follow_up_press: is_office_or_estimator) also holds the controller;
-- written as the caller, a controller's press would fail on RLS after the tie landed. So the line goes through a
-- SECURITY DEFINER helper in the shape of adopt_logs_both_bids (20261031203414): the office gate first, the line
-- must be an email that came in and be on that bid already, the caller must be able to price the bid, a twin writes
-- only on its own bids, and the read-only statement trigger on the table still fires inside it. When the line reads
-- as an invitation with no answer, the answer is kept on the jsonb as Start a bid keeps it, so the New lane stops
-- asking Bid it? of it. No table, no column changes; one new function, EXECUTE for authenticated and service_role,
-- none for anon. Idempotent: CREATE OR REPLACE.
SET lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.bid_log_message_in(
  p_bid_id uuid,
  p_message_id uuid,
  p_words text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('put an email on a bid');
  v_msg public.messages%ROWTYPE;
  v_words text := left(btrim(coalesce(p_words, '')), 600);
  v_entry uuid;
BEGIN
  IF p_bid_id IS NULL OR p_message_id IS NULL THEN
    RAISE EXCEPTION 'bid_log_message_in: the bid and the line are required' USING ERRCODE = 'P0001';
  END IF;
  IF v_words = '' THEN
    RAISE EXCEPTION 'The log line needs words.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No line with that id.';
  END IF;
  IF v_msg.direction <> 'in' OR v_msg.channel <> 'email' THEN
    RAISE EXCEPTION 'Only an email that came in goes on a bid''s history.' USING ERRCODE = 'P0001';
  END IF;
  -- The tie came first, through tie_message: the log line names a bid the line is on.
  IF v_msg.bid_id IS DISTINCT FROM p_bid_id THEN
    RAISE EXCEPTION 'Tie the email to the bid first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.can_access_bid_for_pricing(p_bid_id) THEN
    RAISE EXCEPTION 'bid_log_message_in: not allowed' USING ERRCODE = '42501';
  END IF;
  -- A definer skips the digital-twin fence, so its rule is kept here (follow_up_press refuses a twin already; belt and braces).
  IF public.is_digital_twin() AND NOT EXISTS (
       SELECT 1 FROM public.bids b WHERE b.id = p_bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid())) THEN
    RAISE EXCEPTION 'bid_log_message_in: a twin writes only on its own bids' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
  VALUES (p_bid_id, v_words, v_me)
  RETURNING id INTO v_entry;

  -- An invitation nobody answered is answered now: it is on a bid (the shape start_bid_from_message writes).
  IF v_msg.invitation IS NOT NULL AND jsonb_typeof(v_msg.invitation) = 'object' AND (v_msg.invitation->'answer') IS NULL THEN
    UPDATE public.messages SET
      invitation = v_msg.invitation || jsonb_build_object('answer', jsonb_build_object('what', 'bid', 'bid_id', p_bid_id, 'by', v_me, 'at', clock_timestamp()))
    WHERE id = p_message_id;
  END IF;
  RETURN v_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.bid_log_message_in(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bid_log_message_in(uuid, uuid, text) TO authenticated, service_role;
COMMENT ON FUNCTION public.bid_log_message_in(uuid, uuid, text) IS
  'v2.6509: the email viewer''s Put it on a bid writes one line on the bid''s log (bids_submission_entries) as the owner, after tie_message put the line on the bid, since the log''s insert policy admits fewer roles than may tie a line (no controller). follow_up_press; the line must be an email in on that bid; the caller must be able to price the bid; a twin only on its own bids. An unanswered invitation on the line is answered as a bid. Answers the entry''s id.';
