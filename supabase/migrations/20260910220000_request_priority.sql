SET lock_timeout = '3s';

-- v2.3246 — Customer Waiting, PR 1 of 4: priority on inbox requests.
--
-- A customer who sends a request from their portal is a person standing at
-- the counter. Until now that request landed in the Dispatch inbox as a plain
-- row — sorted OLDEST-first under three-week-old errands, the phone number
-- they typed buried in pending_payload where nothing reads it. Both inbox
-- tables now carry a priority, who changed it and when, and the last call
-- made on the request (the "Sam called Jane 2:14 pm" state that quiets the
-- app-wide banner for the rest of the team). estimator_requests also gains
-- pending_payload so portal bid requests can carry the same structured
-- context dispatch rows already do.
--
-- Two RPCs do the writes as ONE transaction each (row update + thread note),
-- SECURITY INVOKER so the existing UPDATE policies decide who may act:
-- dispatch group members + dev on dispatch rows, estimator group members +
-- dev on estimator rows — exactly the people who can close a request today.
--
-- Additive only. The old client ignores the new columns; the intake edge
-- function (submit-portal-request) writes priority = 'high' once redeployed
-- AFTER this push.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.dispatch_requests
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority_changed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_called_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_called_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.estimator_requests
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority_changed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_called_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_called_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_payload jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_requests_priority_check') THEN
    ALTER TABLE public.dispatch_requests
      ADD CONSTRAINT dispatch_requests_priority_check CHECK (priority IN ('normal', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimator_requests_priority_check') THEN
    ALTER TABLE public.estimator_requests
      ADD CONSTRAINT estimator_requests_priority_check CHECK (priority IN ('normal', 'high'));
  END IF;
END $$;

COMMENT ON COLUMN public.dispatch_requests.priority IS
  'v2.3246 — normal | high. Portal requests from customers arrive high; the inbox sorts high first and the app-wide Customer Waiting banner shows while any high row is open. Changed only through set_request_priority (which also writes the reason into the thread).';
COMMENT ON COLUMN public.dispatch_requests.last_called_at IS
  'v2.3246 — when someone last tapped Call on this request (log_request_call). Turns the banner from "waiting" (red) to "<name> called <time>" (amber) for the rest of the team.';
COMMENT ON COLUMN public.estimator_requests.priority IS
  'v2.3246 — normal | high. Same semantics as dispatch_requests.priority; portal bid requests land here high.';
COMMENT ON COLUMN public.estimator_requests.last_called_at IS
  'v2.3246 — when someone last tapped Call on this request (log_request_call).';
COMMENT ON COLUMN public.estimator_requests.pending_payload IS
  'v2.3246 — structured context for the row, same shape as dispatch_requests.pending_payload (portal bid requests: source, kind, customerId, customerName, description, phone, phoneSource, plansLink).';

-- The banner's query: open high rows only. Tiny tables, but the predicate is
-- exactly the one every signed-in dispatch member polls.
CREATE INDEX IF NOT EXISTS dispatch_requests_open_high_idx
  ON public.dispatch_requests (created_at)
  WHERE status = 'open' AND priority = 'high';
CREATE INDEX IF NOT EXISTS estimator_requests_open_high_idx
  ON public.estimator_requests (created_at)
  WHERE status = 'open' AND priority = 'high';

-- ---------------------------------------------------------------------------
-- 2. Realtime: the estimator tables were never published, so the estimator
--    inbox's existing subscription (useEstimatorInbox) has been silent. The
--    banner needs both inboxes live; dispatch_requests joined in 20260703130000.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'estimator_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estimator_requests;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'estimator_request_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estimator_request_notes;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. set_request_priority(inbox, id, priority, note) → boolean
--    One transaction: the row's priority + stamp, and a thread note that
--    keeps the reason ("Priority lowered — Scheduled: Thu 9/12, 8–10 am").
--    Returns false when the row was not found, not visible, not updatable
--    (RLS), or already at that priority — the client reads false as "no
--    change" and reloads.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_request_priority(
  p_inbox text,
  p_request_id uuid,
  p_priority text,
  p_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_priority NOT IN ('normal', 'high') THEN
    RAISE EXCEPTION 'priority must be normal or high' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'note must be 500 characters or less' USING ERRCODE = '22023';
  END IF;

  v_body := CASE WHEN p_priority = 'high' THEN 'Priority raised' ELSE 'Priority lowered' END
            || COALESCE(' — ' || v_note, '');

  IF p_inbox = 'dispatch' THEN
    UPDATE public.dispatch_requests
       SET priority = p_priority,
           priority_changed_at = now(),
           priority_changed_by_user_id = v_uid
     WHERE id = p_request_id AND priority <> p_priority;
    IF NOT FOUND THEN RETURN false; END IF;
    INSERT INTO public.dispatch_request_notes (request_id, author_user_id, body)
    VALUES (p_request_id, v_uid, v_body);
    RETURN true;
  ELSIF p_inbox = 'estimator' THEN
    UPDATE public.estimator_requests
       SET priority = p_priority,
           priority_changed_at = now(),
           priority_changed_by_user_id = v_uid
     WHERE id = p_request_id AND priority <> p_priority;
    IF NOT FOUND THEN RETURN false; END IF;
    INSERT INTO public.estimator_request_notes (request_id, author_user_id, body)
    VALUES (p_request_id, v_uid, v_body);
    RETURN true;
  END IF;

  RAISE EXCEPTION 'inbox must be dispatch or estimator' USING ERRCODE = '22023';
END;
$$;

COMMENT ON FUNCTION public.set_request_priority(text, uuid, text, text) IS
  'v2.3246 — raise or lower a dispatch/estimator request''s priority and write the reason into its thread, in one transaction. SECURITY INVOKER: the tables'' UPDATE policies (group member or dev) decide who may act. Returns false when nothing changed.';

REVOKE ALL ON FUNCTION public.set_request_priority(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_request_priority(text, uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. log_request_call(inbox, id, phone) → boolean
--    Tapping Call stamps the row (who, when) and drops a "📞 Called …" note.
--    The stamp is what the banner reads; the note is the audit everyone
--    already knows how to find.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_request_call(
  p_inbox text,
  p_request_id uuid,
  p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  IF v_phone IS NOT NULL AND char_length(v_phone) > 40 THEN
    v_phone := left(v_phone, 40);
  END IF;
  v_body := '📞 Called' || COALESCE(' ' || v_phone, '');

  IF p_inbox = 'dispatch' THEN
    UPDATE public.dispatch_requests
       SET last_called_at = now(), last_called_by_user_id = v_uid
     WHERE id = p_request_id;
    IF NOT FOUND THEN RETURN false; END IF;
    INSERT INTO public.dispatch_request_notes (request_id, author_user_id, body)
    VALUES (p_request_id, v_uid, v_body);
    RETURN true;
  ELSIF p_inbox = 'estimator' THEN
    UPDATE public.estimator_requests
       SET last_called_at = now(), last_called_by_user_id = v_uid
     WHERE id = p_request_id;
    IF NOT FOUND THEN RETURN false; END IF;
    INSERT INTO public.estimator_request_notes (request_id, author_user_id, body)
    VALUES (p_request_id, v_uid, v_body);
    RETURN true;
  END IF;

  RAISE EXCEPTION 'inbox must be dispatch or estimator' USING ERRCODE = '22023';
END;
$$;

COMMENT ON FUNCTION public.log_request_call(text, uuid, text) IS
  'v2.3246 — stamp last_called_at/by on a dispatch/estimator request and drop a "📞 Called <phone>" thread note, in one transaction. SECURITY INVOKER (group member or dev). Returns false when the row was not found or not updatable.';

REVOKE ALL ON FUNCTION public.log_request_call(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_request_call(text, uuid, text) TO authenticated;
