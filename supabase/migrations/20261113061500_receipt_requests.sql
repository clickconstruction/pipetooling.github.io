SET lock_timeout = '3s';

-- A receipt link for a card charge (punch list #299, PR 1 of three, v2.7101). The owner's ask of 2026-11-09: when a
-- charge lands on a card assigned to a person, text them a place to photograph the receipt, with no sign-in. This file
-- is the ground under that link and sends nothing: the request a charge is asked by, the link's code, and the two words
-- a ticket needs to say it came by the link. PR 2 is the text.
--
--   1. counter_tickets takes source = 'link' and match_kind = 'link'. A photo sent through a receipt link is the same
--      ticket the Tally press writes (#295), already on its charge: the link carried the charge, so there is no minute,
--      no total and no question.
--   2. receipt_requests: one row a charge, so a charge is asked once whatever asks. Whose card it is, the cell texted
--      and when (PR 2 writes those), when the link was first opened and answered, the ticket it became, when it closes,
--      and why no text could go.
--   3. receipt_links: one row a code. Only the SHA-256 of the ten-letter code is kept, as an estimate's share link is
--      kept, so a code is handed out once. That is why a link is its own row and not a column on the request: the
--      office's Copy the receipt link and PR 2's reminder each need a code after the first was handed out, and a second
--      code must not close the first. A link opens on up to ten requests (PR 2 folds two charges in one hour into one
--      text). It opens for fourteen days.
--   4. receipt_request_ensure(charge, made_by): the request for a charge, made on the first ask. The holder is the
--      charge's attribution, else the card's link, read as the Tally doors read them. The service role alone calls it.
--
-- Who may do what. A request is read by the office (is_office_staff) and by the holder it names. A link is read by the
-- office; it holds a hash and nothing a reader could open. Nobody writes either from the app: there is no INSERT,
-- UPDATE or DELETE policy for any role, so every write is the receipt-link function's, as the service role, after it
-- has checked the link's code or the caller's role (first_looks' rule). A visitor who is not signed in has no grant.
--
-- Additive and idempotent. Two tables are created, so the four fences close the file. No client reads either table in
-- PR 1 (the page and the office's press ask the function), so this is harmless on either side of the Pages deploy.

-- 1. The ticket's two new words. The column checks were written inline (20261109190000), so they are found by what
--    they say and written again under their own names.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.counter_tickets'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ~ '\(source = ANY' OR pg_get_constraintdef(oid) ~ '\(match_kind = ANY')
  LOOP
    EXECUTE format('ALTER TABLE public.counter_tickets DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.counter_tickets
  ADD CONSTRAINT counter_tickets_source_check CHECK (source IN ('camera', 'file', 'office', 'link')),
  ADD CONSTRAINT counter_tickets_match_kind_check CHECK (match_kind IN ('minute', 'total', 'asked', 'picked', 'link'));

COMMENT ON COLUMN public.counter_tickets.source IS 'Where the paper came from: camera (the Tally press), file (a photo or a PDF already on the phone), office (a paper handed in at the desk), link (a receipt link, punch list #299: no sign-in, written by the receipt-link function).';
COMMENT ON COLUMN public.counter_tickets.match_kind IS 'How the ticket met its charge: minute (the only swipe on the taker''s card in the half hour before the photo, made with no press), total (a typed total equal to the charge within a day, made with no press), asked (a person answered Yes to the one charge that fits), picked (the office picked the charge), link (the photo came through the charge''s own receipt link, punch list #299).';

-- 2. The request: one row a charge.
CREATE TABLE IF NOT EXISTS public.receipt_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  holder_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  holder_name text NOT NULL DEFAULT '' CHECK (char_length(holder_name) <= 120),
  no_text_why text CHECK (no_text_why IS NULL OR no_text_why IN ('no_cell', 'no_person', 'archived', 'opted_out')),
  cell text CHECK (cell IS NULL OR cell ~ '^\+[1-9][0-9]{7,14}$'),
  texted_at timestamptz,
  reminded_at timestamptz,
  opened_at timestamptz,
  answered_at timestamptz,
  ticket_id uuid REFERENCES public.counter_tickets(id) ON DELETE SET NULL,
  closes_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  closed_at timestamptz,
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_requests_one_per_charge UNIQUE (mercury_transaction_id)
);
CREATE INDEX IF NOT EXISTS receipt_requests_holder_idx ON public.receipt_requests (holder_user_id, created_at DESC) WHERE holder_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS receipt_requests_waiting_idx ON public.receipt_requests (created_at DESC) WHERE answered_at IS NULL AND closed_at IS NULL;

COMMENT ON TABLE public.receipt_requests IS
  'A receipt asked for on a card charge (punch list #299): one row a charge. Whose card, the cell texted and when, when the link was opened and answered, the ticket it became (counter_tickets, source = link), when it closes, and why no text could go. Written only by the receipt-link edge function and, from PR 2, the sweep.';
COMMENT ON COLUMN public.receipt_requests.holder_user_id IS 'Whose charge it is: the charge''s attribution, else the person the card is tied to (receipt_request_ensure). Null for a card tied to no one.';
COMMENT ON COLUMN public.receipt_requests.no_text_why IS 'Why no text could go: no_cell (no cell on file, or one that will not read as ten digits), no_person (the card is tied to no one), archived (the holder has left), opted_out (the holder replied STOP). The office''s Needs you item reads it.';
COMMENT ON COLUMN public.receipt_requests.answered_at IS 'When the first photo came through a link.';
COMMENT ON COLUMN public.receipt_requests.closes_at IS 'When the newest link on the request stops opening: fourteen days from when it was handed out.';
COMMENT ON COLUMN public.receipt_requests.closed_at IS 'The request was closed before its day: the charge failed or was reversed. A closed request never texts and its links read closed.';

-- 3. The link: one row a code, the code kept only as its hash.
CREATE TABLE IF NOT EXISTS public.receipt_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  request_ids uuid[] NOT NULL CHECK (cardinality(request_ids) BETWEEN 1 AND 10),
  made_for text NOT NULL DEFAULT 'office' CHECK (made_for IN ('office', 'text', 'reminder')),
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  CONSTRAINT receipt_links_code_hash_key UNIQUE (code_hash)
);
CREATE INDEX IF NOT EXISTS receipt_links_requests_idx ON public.receipt_links USING gin (request_ids);

COMMENT ON TABLE public.receipt_links IS
  'A receipt link''s code (punch list #299): one row a code. The page at /r/<code> opens the requests it names, with no sign-in, for fourteen days. Written only by the receipt-link edge function.';
COMMENT ON COLUMN public.receipt_links.code_hash IS 'SHA-256 of the link''s ten-letter code. The code is handed out once and never kept.';
COMMENT ON COLUMN public.receipt_links.request_ids IS 'The requests the link opens: one for a link the office copied, up to ten for a text that folds charges together. Plain ids, no key: a request that is gone is skipped.';
COMMENT ON COLUMN public.receipt_links.made_for IS 'What the code was handed to: office (Copy the receipt link), text (the text when the charge posts), reminder (the next evening''s text).';

ALTER TABLE public.receipt_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_requests_select ON public.receipt_requests;
CREATE POLICY receipt_requests_select ON public.receipt_requests FOR SELECT TO authenticated
  USING (public.is_office_staff() OR holder_user_id = auth.uid());
REVOKE ALL ON TABLE public.receipt_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.receipt_requests TO authenticated;
GRANT ALL ON TABLE public.receipt_requests TO service_role;

ALTER TABLE public.receipt_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_links_select_office ON public.receipt_links;
CREATE POLICY receipt_links_select_office ON public.receipt_links FOR SELECT TO authenticated
  USING (public.is_office_staff());
REVOKE ALL ON TABLE public.receipt_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.receipt_links TO authenticated;
GRANT ALL ON TABLE public.receipt_links TO service_role;

-- 4. The request for a charge, made on the first ask. The holder is read as the card doors read it: the charge's
--    attribution, else the card's link. A request nobody has answered or texted takes the holder again on a later
--    ask, so a card tied after the first ask is not left with no one.
CREATE OR REPLACE FUNCTION public.receipt_request_ensure(p_transaction_id uuid, p_made_by uuid DEFAULT NULL)
RETURNS public.receipt_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_raw jsonb;
  v_holder uuid;
  v_name text;
  v_row public.receipt_requests;
BEGIN
  SELECT t.kind, t.raw INTO v_kind, v_raw FROM public.mercury_transactions t WHERE t.id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That charge is not in the feed.' USING ERRCODE = 'P0002';
  END IF;
  IF v_kind IS NULL OR v_kind NOT IN ('debitCardTransaction', 'creditCardTransaction') THEN
    RAISE EXCEPTION 'That is not a card charge.' USING ERRCODE = '22023';
  END IF;

  SELECT att.user_id INTO v_holder FROM public.mercury_transaction_attributions att WHERE att.mercury_transaction_id = p_transaction_id AND att.user_id IS NOT NULL LIMIT 1;
  IF v_holder IS NULL THEN
    SELECT l.user_id INTO v_holder FROM public.mercury_debit_card_user_links l WHERE l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(v_raw) LIMIT 1;
  END IF;
  IF v_holder IS NOT NULL THEN
    SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_holder;
  END IF;

  INSERT INTO public.receipt_requests (mercury_transaction_id, holder_user_id, holder_name, made_by)
  VALUES (p_transaction_id, v_holder, left(COALESCE(v_name, ''), 120), p_made_by)
  ON CONFLICT (mercury_transaction_id) DO NOTHING;

  UPDATE public.receipt_requests r
  SET holder_user_id = v_holder, holder_name = left(COALESCE(v_name, ''), 120), updated_at = now()
  WHERE r.mercury_transaction_id = p_transaction_id
    AND r.answered_at IS NULL AND r.texted_at IS NULL
    AND v_holder IS NOT NULL AND r.holder_user_id IS DISTINCT FROM v_holder;

  SELECT * INTO v_row FROM public.receipt_requests r WHERE r.mercury_transaction_id = p_transaction_id;
  RETURN v_row;
END
$$;
REVOKE ALL ON FUNCTION public.receipt_request_ensure(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receipt_request_ensure(uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.receipt_request_ensure(uuid, uuid) IS
  'Receipt links (punch list #299): the receipt_requests row for a card charge, made on the first ask, with the holder read from the charge''s attribution, else the card''s link. Refuses a charge that is not in the feed or is not a card charge. The service role alone calls it (the receipt-link function).';

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
