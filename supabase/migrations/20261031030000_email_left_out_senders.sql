SET lock_timeout = '3s';

-- Messages, punch list #223 PR 1 (v2.6202, to-dos/messages-notices/README.md, piece 1): **A notice, not a person**.
-- On 2026-10-30 New on the Messages page held thirteen rows and eleven were mail nobody wrote to us. The Who is this?
-- card had no press for *this is not a person*: every press named the sender as one. This adds the fourth block's
-- ground, the owner's calls 1 and 2 taken as the card recommends:
--
--  - email_left_out_senders: the addresses and domains the office marked a notice. The bids@ reader (gmail-sync) reads
--    the list once per run and leaves the next mail from them out before email_place_address ever runs. Office-read;
--    written only through the two presses below. Call 1: the address, with the whole domain as a second press when it
--    is a company's own, never an open mail service.
--  - mark_notice(p_contact_id, p_scope): the press. The sender's address (or domain) goes on the list, the thread goes
--    done with a grey event line, and nothing else moves: Gmail is untouched, search still finds the thread, the
--    Who is this? pill still lists it (call 2). Only a sender nobody has named yet can be marked.
--  - unmark_notice(p_contact_id): the undo, from the thread. The rows this thread put on the list come off, and the
--    thread goes back to waiting, so it is in New again.
--
-- Both are SECURITY INVOKER behind follow_up_press, like every press on Follow up: a training account, a twin and
-- anyone off the office team are refused in words. The table's writes are the functions' alone: no INSERT, UPDATE
-- or DELETE policy, and the functions run as the caller, so they are SECURITY DEFINER only for the table's rows.

CREATE TABLE IF NOT EXISTS public.email_left_out_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The address or the domain, lower-case and trimmed.
  value text NOT NULL CHECK (value = lower(btrim(value)) AND length(value) BETWEEN 3 AND 320),
  kind text NOT NULL CHECK (kind IN ('address', 'domain')),
  -- The box it holds for; null for both. The press marks for both today.
  mailbox text CHECK (mailbox IS NULL OR mailbox IN ('bids', 'team')),
  -- The thread the press was made from, so the undo finds its rows. Null once that contact is gone.
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  marked_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_left_out_senders_one ON public.email_left_out_senders (kind, value, COALESCE(mailbox, ''));
CREATE INDEX IF NOT EXISTS email_left_out_senders_contact ON public.email_left_out_senders (contact_id) WHERE contact_id IS NOT NULL;

COMMENT ON TABLE public.email_left_out_senders IS
  'v2.6202 (punch list #223 PR 1) — the senders the office marked A notice, not a person on the Who is this? card: an address, or a company''s whole domain, which gmail-sync leaves out before placing the address. Written only through mark_notice / unmark_notice.';

ALTER TABLE public.email_left_out_senders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_left_out_senders_office_read ON public.email_left_out_senders;
CREATE POLICY email_left_out_senders_office_read ON public.email_left_out_senders
  FOR SELECT TO authenticated USING (public.gc_office_team());
REVOKE ALL ON TABLE public.email_left_out_senders FROM anon;
GRANT SELECT ON TABLE public.email_left_out_senders TO authenticated;
-- Closed by privilege: the reader reads as the service role, and the two presses below write as the owner.

-- The mail services anyone can sign up for: a domain there says nothing about the sender, so it is never marked whole
-- (the client's list is newLane.ts's OPEN_MAIL through leftOutSenders.ts's OPEN_MAIL_DOMAINS; this is the server's copy).
CREATE OR REPLACE FUNCTION public.email_open_mail_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(btrim(p_domain)) = ANY (ARRAY[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com',
    'me.com', 'aol.com', 'att.net', 'sbcglobal.net', 'comcast.net', 'proton.me', 'protonmail.com'])
$$;

-- A notice, not a person. p_scope is 'address' (this sender) or 'domain' (everyone at the company's own domain).
CREATE OR REPLACE FUNCTION public.mark_notice(p_contact_id uuid, p_scope text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_kind text;
  v_address text;
  v_domain text;
BEGIN
  v_me := public.follow_up_press('mark a notice');
  IF p_scope IS NULL OR p_scope NOT IN ('address', 'domain') THEN
    RAISE EXCEPTION 'A notice is marked by its address or by its whole domain.' USING ERRCODE = 'P0001';
  END IF;
  SELECT kind INTO v_kind FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind <> 'unknown' THEN
    RAISE EXCEPTION 'Only a sender nobody has named can be marked a notice.' USING ERRCODE = 'P0001';
  END IF;
  SELECT lower(btrim(value)) INTO v_address
  FROM public.contact_channels
  WHERE contact_id = p_contact_id AND kind = 'email' AND position('@' IN value) > 1
  ORDER BY created_at
  LIMIT 1;
  IF v_address IS NULL THEN
    RAISE EXCEPTION 'Only an email sender can be marked a notice.' USING ERRCODE = 'P0001';
  END IF;
  v_domain := split_part(v_address, '@', 2);

  -- The address always; the domain beside it when asked, and only a company's own.
  INSERT INTO public.email_left_out_senders (value, kind, mailbox, contact_id, marked_by)
  SELECT v_address, 'address', NULL, p_contact_id, v_me
  WHERE NOT EXISTS (SELECT 1 FROM public.email_left_out_senders WHERE kind = 'address' AND value = v_address AND mailbox IS NULL);
  IF p_scope = 'domain' THEN
    IF v_domain = '' OR public.email_open_mail_domain(v_domain) THEN
      RAISE EXCEPTION 'That is an open mail service. Mark the address alone.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.email_left_out_senders (value, kind, mailbox, contact_id, marked_by)
    SELECT v_domain, 'domain', NULL, p_contact_id, v_me
    WHERE NOT EXISTS (SELECT 1 FROM public.email_left_out_senders WHERE kind = 'domain' AND value = v_domain AND mailbox IS NULL);
  END IF;

  -- The thread goes done and off Follow up. The event line moves nothing (messages_move_state reads only in, out and note).
  UPDATE public.contacts SET state = 'done', snoozed_until = NULL, has_user_id = NULL, has_since = NULL, has_how = NULL
  WHERE id = p_contact_id;
  PERFORM public.follow_up_event(
    p_contact_id,
    CASE WHEN p_scope = 'domain' THEN 'Marked a notice: everything from ' || v_domain || '.' ELSE 'Marked a notice: ' || v_address || '.' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notice(uuid, text) TO authenticated;

-- Not a notice after all: the rows this thread put on the list come off, and the thread is back in New.
CREATE OR REPLACE FUNCTION public.unmark_notice(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gone int;
BEGIN
  PERFORM public.follow_up_press('put a notice back');
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.email_left_out_senders WHERE contact_id = p_contact_id;
  GET DIAGNOSTICS v_gone = ROW_COUNT;
  IF v_gone = 0 THEN
    RAISE EXCEPTION 'That sender is not marked a notice.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contacts SET state = 'waiting', snoozed_until = NULL WHERE id = p_contact_id;
  PERFORM public.follow_up_event(p_contact_id, 'Not a notice after all.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmark_notice(uuid) TO authenticated;

COMMENT ON FUNCTION public.mark_notice(uuid, text) IS
  'v2.6202 — A notice, not a person: puts the Who is this? sender''s address (p_scope address) or the company''s domain beside it (p_scope domain, never an open mail service) on email_left_out_senders, sets the thread done and writes the event line. follow_up_press guards it; only a contact of kind unknown with an email channel.';
COMMENT ON FUNCTION public.unmark_notice(uuid) IS
  'v2.6202 — Not a notice after all: deletes the rows this contact put on email_left_out_senders, sets the thread waiting and writes the event line.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
