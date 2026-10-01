SET lock_timeout = '3s';

-- v2.4297 — Mark a bid for a teammate.
--
-- WHY. v2.4287 gave everyone private marks on bids (bid_marks): "these are mine today". The
-- owner asked for the next step: an estimator or account man marks a bid FOR someone else, with
-- an optional note ("GC moved the due date to Fri. Reprice the trim."), and the bid shows up
-- marked on that person's lists until they finish it. Nothing in the app addressed a bid to one
-- person: bid notes have no mentions, and the bottom-bar Inbox is the team's queue for customer
-- requests.
--
-- A request is not a bid_marks row: it has two people, a note, and a life (seen → done / not for
-- me / taken back) that both of them see. So it is its own table, and bid_marks is untouched.
--
-- LIFE OF A REQUEST
--   mark_bid_for()             the sender makes it (or re-sends: same sender, same bid, same
--                              person while it is open → the note and the time are replaced)
--   bid_mark_requests_seen()   the receiver opened the bid: seen_at, once
--   bid_mark_requests_close()  the receiver: 'done' or 'not_for_me' — closes every open request
--                              for them on that bid, whoever sent it
--   bid_mark_request_take_back() the sender, while it is still open
-- Closed rows stay: the sender reads "Robert is done · Mon" for three days (a client rule), and
-- the row is the record of who asked whom.
--
-- WHO. Both people must open the Bids page (the roles of can_open_bid_reply_book()), the target
-- must be an active account, and nobody marks a bid for themselves (that is bid_marks). Each
-- person reads only rows they sent or received. There is no INSERT / UPDATE / DELETE policy:
-- the four functions are the only writers, so no client can rewrite who sent what.

CREATE TABLE IF NOT EXISTS public.bid_mark_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id       uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  for_user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note         text NOT NULL DEFAULT '' CHECK (char_length(note) <= 280),
  created_at   timestamptz NOT NULL DEFAULT now(),
  seen_at      timestamptz,
  closed_at    timestamptz,
  outcome      text CHECK (outcome IN ('done', 'not_for_me', 'taken_back')),
  CONSTRAINT bid_mark_requests_not_self CHECK (for_user_id <> from_user_id),
  CONSTRAINT bid_mark_requests_closed_has_outcome CHECK ((closed_at IS NULL) = (outcome IS NULL))
);

COMMENT ON TABLE public.bid_mark_requests IS
  'A bid marked FOR a teammate, with an optional note: open until the receiver says Done or Not for me, or the sender takes it back. Written only by mark_bid_for() and the bid_mark_request* functions. v2.4297.';

-- One open request per (bid, receiver, sender): a re-send replaces the note.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bid_mark_requests_open
  ON public.bid_mark_requests (bid_id, for_user_id, from_user_id)
  WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bid_mark_requests_for_open
  ON public.bid_mark_requests (for_user_id)
  WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bid_mark_requests_from
  ON public.bid_mark_requests (from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bid_mark_requests_bid
  ON public.bid_mark_requests (bid_id);

ALTER TABLE public.bid_mark_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_mark_requests_select_own ON public.bid_mark_requests;
CREATE POLICY bid_mark_requests_select_own ON public.bid_mark_requests
  FOR SELECT TO authenticated
  USING (for_user_id = (SELECT auth.uid()) OR from_user_id = (SELECT auth.uid()));

REVOKE ALL ON public.bid_mark_requests FROM anon;
GRANT SELECT ON public.bid_mark_requests TO authenticated;
GRANT ALL ON public.bid_mark_requests TO service_role;

-- Does this account open the Bids page? (the same roles as can_open_bid_reply_book(), for any user)
CREATE OR REPLACE FUNCTION public.user_opens_bids(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id
      AND u.archived_at IS NULL
      AND u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']::public.user_role[])
  )
$$;

COMMENT ON FUNCTION public.user_opens_bids(uuid) IS
  'True when the account is active and its role opens the Bids page: who may receive a bid marked for them. v2.4297.';

-- Make (or re-send) a request. Returns its id.
CREATE OR REPLACE FUNCTION public.mark_bid_for(p_bid_id uuid, p_for_user_id uuid, p_note text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_note text := left(btrim(coalesce(p_note, '')), 280);
  v_id   uuid;
BEGIN
  IF v_me IS NULL OR NOT public.user_opens_bids(v_me) THEN
    RAISE EXCEPTION 'Only people who use Bids can mark a bid for someone' USING ERRCODE = '42501';
  END IF;
  IF p_for_user_id IS NULL OR p_for_user_id = v_me THEN
    RAISE EXCEPTION 'Pick someone else. Your own marks are the Mark button' USING ERRCODE = '22023';
  END IF;
  IF NOT public.user_opens_bids(p_for_user_id) THEN
    RAISE EXCEPTION 'That person does not use Bids' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bids b WHERE b.id = p_bid_id) THEN
    RAISE EXCEPTION 'No such bid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.bid_mark_requests
     SET note = v_note, created_at = now(), seen_at = NULL
   WHERE bid_id = p_bid_id AND for_user_id = p_for_user_id AND from_user_id = v_me AND closed_at IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.bid_mark_requests (bid_id, for_user_id, from_user_id, note)
    VALUES (p_bid_id, p_for_user_id, v_me, v_note)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

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
  UPDATE public.bid_mark_requests
     SET seen_at = now()
   WHERE bid_id = p_bid_id AND for_user_id = auth.uid() AND closed_at IS NULL AND seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- The receiver finishes: 'done' or 'not_for_me'. Closes every open request for them on the bid.
CREATE OR REPLACE FUNCTION public.bid_mark_requests_close(p_bid_id uuid, p_outcome text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_outcome NOT IN ('done', 'not_for_me') THEN
    RAISE EXCEPTION 'Outcome must be done or not_for_me' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bid_mark_requests
     SET closed_at = now(), outcome = p_outcome, seen_at = coalesce(seen_at, now())
   WHERE bid_id = p_bid_id AND for_user_id = auth.uid() AND closed_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- The sender takes one back while it is still open.
CREATE OR REPLACE FUNCTION public.bid_mark_request_take_back(p_request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.bid_mark_requests
     SET closed_at = now(), outcome = 'taken_back'
   WHERE id = p_request_id AND from_user_id = auth.uid() AND closed_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Can a phone notification reach this person? (only whether one exists — never the device)
CREATE OR REPLACE FUNCTION public.user_has_push_device(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_opens_bids(auth.uid())
     AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p_user_id)
$$;

COMMENT ON FUNCTION public.user_has_push_device(uuid) IS
  'True when the person has at least one phone or browser registered for push. Asked by Mark for someone… to say whether "Also send it to their phone" can reach them. v2.4297.';

REVOKE ALL ON FUNCTION public.user_opens_bids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_bid_for(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bid_mark_requests_seen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bid_mark_requests_close(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bid_mark_request_take_back(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_push_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_opens_bids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_bid_for(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bid_mark_requests_seen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bid_mark_requests_close(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bid_mark_request_take_back(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_push_device(uuid) TO authenticated;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
