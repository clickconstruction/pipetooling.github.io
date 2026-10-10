SET lock_timeout = '3s';

-- GC mode, the Board's B6-d-i (to-dos/gc-mode/mockups/board-b6d.md on branch spike/gc-mode, calls D1 to D8 as the lead
-- answered them on 2026-10-10, with Owner Billing's changes to D5): our contract to the customer, sent from the
-- customer's window and signed in their portal.
--   - Every send keeps the price by line it went with (D2) and the file the office attached (D1), with the file's
--     SHA-256, so a signature binds to those bytes (D7). The first send stamps gc_projects.owner_contract_sent_on.
--   - The customer signs the newest send from their portal through the service role (B6-d-iii's submit-portal-request
--     kind, which stores the drawn signature and writes the e-sign ledger row after this returns), keeping the price as
--     it was sent, not as it stands on the day they sign.
--   - Owner Billing's gc_sign_owner_contract (Mark it signed) is restated onto one shared first sign,
--     gc_owner_contract_keep, so the two signers cannot drift. It now refuses to undo, or to move the day of, a contract
--     the customer signed in their portal.
--   - esign_consents gains gc_owner_contract. The private bucket gc-owner-contracts holds the files, under
--     <project id>/.
-- The price by line shows our markup (board-b5.md:248), so the table and the bucket are a dev's until award's door and
-- the money team's after it, never award's wider audience. Doc: docs/migrations/.

-- 1) A price by line's total: the sum of its lines (each trade, then gc, contingency and fee).
CREATE OR REPLACE FUNCTION public.gc_owner_contract_worth_total(p_worth jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(sum((e.value #>> '{}')::numeric), 0) FROM jsonb_each(p_worth) AS e
$$;

COMMENT ON FUNCTION public.gc_owner_contract_worth_total(jsonb) IS
  'GC mode (B6-d-i): the total of a price by line, for gc_owner_contract_sends.total. Pure; reads no table.';

-- 2) Every send of our contract: the first and each reminder or new price after it.
CREATE TABLE IF NOT EXISTS public.gc_owner_contract_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- The project's customer when it went: only they may sign it.
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  first boolean NOT NULL DEFAULT false,
  sent_on date NOT NULL DEFAULT public.app_today(),
  sign_by date NOT NULL,
  note text NOT NULL DEFAULT '',
  -- The price by line it went with (ownerContractWorth's shape), and its total.
  worth jsonb NOT NULL,
  total numeric GENERATED ALWAYS AS (public.gc_owner_contract_worth_total(worth)) STORED,
  -- The file the office attached, in the gc-owner-contracts bucket, and a SHA-256 of its bytes.
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_sha256 text NOT NULL,
  sent_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- Once the customer signs it in their portal (gc_customer_sign_owner_contract, the service role only).
  signed_on date,
  signer_printed_name text,
  signer_signature_storage_path text,
  signer_consented_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  -- clock_timestamp, so two sends in one transaction still have an order: the newest is the one to sign.
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gc_owner_contract_sends_sign_by_ahead CHECK (sign_by >= sent_on),
  CONSTRAINT gc_owner_contract_sends_note_short CHECK (char_length(note) <= 500),
  CONSTRAINT gc_owner_contract_sends_worth_object CHECK (jsonb_typeof(worth) = 'object'),
  CONSTRAINT gc_owner_contract_sends_file_named CHECK (btrim(file_path) <> '' AND btrim(file_name) <> ''),
  CONSTRAINT gc_owner_contract_sends_file_hashed CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT gc_owner_contract_sends_signed_whole CHECK (
    (signed_on IS NULL) = (signer_printed_name IS NULL) AND (signed_on IS NULL) = (signer_consented_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_gc_owner_contract_sends_project ON public.gc_owner_contract_sends (project_id, created_at);

COMMENT ON TABLE public.gc_owner_contract_sends IS
  'GC mode (B6-d-i): every send of our contract to the customer (CustomerSend, paper contract), with the price by line and the file it went with, and the signer''s fields once they sign it in their portal. Written by gc_send_owner_contract; signed by gc_customer_sign_owner_contract (the service role). A dev''s until award''s door, then the money team''s: the price by line is our markup.';

ALTER TABLE public.gc_owner_contract_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_owner_contract_sends_dev ON public.gc_owner_contract_sends;
CREATE POLICY gc_owner_contract_sends_dev ON public.gc_owner_contract_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
-- A send is never changed or taken back by a person: the office inserts only its own columns, through
-- gc_send_owner_contract, and only the service role writes the signer's fields. No one signed in can forge a signature.
REVOKE ALL ON public.gc_owner_contract_sends FROM anon, authenticated;
GRANT SELECT ON public.gc_owner_contract_sends TO authenticated;
GRANT INSERT (project_id, customer_id, first, sign_by, note, worth, file_path, file_name, file_sha256)
  ON public.gc_owner_contract_sends TO authenticated;

-- 3) The files: <project id>/<file>, private. A dev reads and adds one; no UPDATE and no DELETE policy, so a file a
-- signature binds to is never replaced (the table's fences do not reach storage, so they are said here). The portal
-- reads them through the service role.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gc-owner-contracts', 'gc-owner-contracts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS gc_owner_contracts_select ON storage.objects;
CREATE POLICY gc_owner_contracts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'gc-owner-contracts' AND public.is_dev());

DROP POLICY IF EXISTS gc_owner_contracts_insert ON storage.objects;
CREATE POLICY gc_owner_contracts_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gc-owner-contracts'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_dev()
    AND NOT public.is_read_only()
    AND NOT public.is_digital_twin()
  );

-- 4) Whether a price by line is whole for the project, in the office's words: NULL when it is. The checks and their
-- order are gc_sign_owner_contract's as Owner Billing wrote them (20261008010000): an object; each line a dollar amount,
-- not below zero, and one of the project's trades, general conditions, contingency or fee; every trade named; all three
-- of ours. A trade added or deleted since a send makes that send's price not whole.
CREATE OR REPLACE FUNCTION public.gc_owner_contract_worth_problem(p_project_id uuid, p_worth jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_trades integer;
  v_named integer := 0;
  v_ours integer := 0;
BEGIN
  IF p_worth IS NULL OR jsonb_typeof(p_worth) <> 'object' THEN
    RETURN 'Send the price by line: each trade, then general conditions, contingency and fee.';
  END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_worth) LOOP
    IF jsonb_typeof(v_value) <> 'number' THEN
      RETURN 'Each line of the price needs a dollar amount.';
    END IF;
    IF (v_value #>> '{}')::numeric < 0 THEN
      RETURN 'A line of the price cannot be below zero.';
    END IF;
    IF v_key IN ('gc', 'contingency', 'fee') THEN
      v_ours := v_ours + 1;
    ELSIF v_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_key::uuid AND project_id = p_project_id) THEN
      v_named := v_named + 1;
    ELSE
      RETURN 'Each line of the price must be one of this project''s trades, general conditions, contingency or fee.';
    END IF;
  END LOOP;
  SELECT count(*) INTO v_trades FROM public.gc_trade_packages WHERE project_id = p_project_id;
  IF v_named <> v_trades THEN
    RETURN 'The price must name every trade on the project.';
  END IF;
  IF v_ours <> 3 THEN
    RETURN 'The price must have general conditions, contingency and fee.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_owner_contract_worth_ok(p_project_id uuid, p_worth jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.gc_owner_contract_worth_problem(p_project_id, p_worth) IS NULL
$$;

COMMENT ON FUNCTION public.gc_owner_contract_worth_problem(uuid, jsonb) IS
  'GC mode (B6-d-i): why a price by line is not whole for the project, in gc_sign_owner_contract''s words and order, or NULL when it is. Shared by the send, the first sign and the portal''s signing. Reads gc_trade_packages as the caller.';
COMMENT ON FUNCTION public.gc_owner_contract_worth_ok(uuid, jsonb) IS
  'GC mode (B6-d-i): a price by line is whole for the project (gc_owner_contract_worth_problem is NULL). The portal''s signing pre-checks with it, so a customer never reads the office''s words.';

REVOKE ALL ON FUNCTION public.gc_owner_contract_worth_problem(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_owner_contract_worth_ok(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_worth_problem(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_worth_ok(uuid, jsonb) TO authenticated, service_role;

-- 5) The first sign, shared (D5): the lines from the price by line, then the day. As the invoker, RLS on
-- gc_owner_contract_lines (the money team) and gc_projects_owner_terms_guard decide who writes, exactly as before; the
-- portal's signing runs as the service role, which both pass. A project already signed is refused, so a direct call
-- does no more than Mark it signed's first sign.
CREATE OR REPLACE FUNCTION public.gc_owner_contract_keep(p_project_id uuid, p_signed_on date, p_worth jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_why text;
  v_key text;
  v_value jsonb;
BEGIN
  IF p_signed_on IS NULL THEN
    RAISE EXCEPTION 'Pick the day it was signed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_owner_contract_lines WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'That contract is signed already.';
  END IF;
  v_why := public.gc_owner_contract_worth_problem(p_project_id, p_worth);
  IF v_why IS NOT NULL THEN
    RAISE EXCEPTION '%', v_why;
  END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_worth) LOOP
    IF v_key IN ('gc', 'contingency', 'fee') THEN
      INSERT INTO public.gc_owner_contract_lines (project_id, line, worth) VALUES (p_project_id, v_key, (v_value #>> '{}')::numeric);
    ELSE
      INSERT INTO public.gc_owner_contract_lines (project_id, line, package_id, worth) VALUES (p_project_id, 'trade', v_key::uuid, (v_value #>> '{}')::numeric);
    END IF;
  END LOOP;
  UPDATE public.gc_projects SET owner_contract_signed_on = p_signed_on WHERE project_id = p_project_id;
END;
$$;

COMMENT ON FUNCTION public.gc_owner_contract_keep(uuid, date, jsonb) IS
  'GC mode (B6-d-i, Owner Billing''s D5): our contract''s first sign, shared by Mark it signed (gc_sign_owner_contract) and the customer''s signing in their portal (gc_customer_sign_owner_contract): the price by line as gc_owner_contract_lines, then owner_contract_signed_on. Refuses a project already signed. SECURITY INVOKER, so RLS and gc_projects_owner_terms_guard decide who writes.';

REVOKE ALL ON FUNCTION public.gc_owner_contract_keep(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_keep(uuid, date, jsonb) TO authenticated, service_role;

-- 6) The day the customer signed our contract in their portal, if they did. A definer, so Mark it signed's refusals see
-- the sends whoever presses it (the table is a dev's today): it returns only that day, and only to the money team, the
-- only people whose writes it guards.
CREATE OR REPLACE FUNCTION public.gc_owner_contract_portal_signed_on(p_project_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT max(s.signed_on)
  FROM public.gc_owner_contract_sends s
  WHERE s.project_id = p_project_id AND s.signed_on IS NOT NULL AND (SELECT public.gc_money_team())
$$;

COMMENT ON FUNCTION public.gc_owner_contract_portal_signed_on(uuid) IS
  'GC mode (B6-d-i): the day the customer signed our contract in their portal, or NULL; for gc_sign_owner_contract''s two refusals. SECURITY DEFINER over a dev-only table, so it answers only the money team.';

REVOKE ALL ON FUNCTION public.gc_owner_contract_portal_signed_on(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_portal_signed_on(uuid) TO authenticated;

-- 7) Mark it signed, restated (Owner Billing's, 20261008010000): its words and branches as they were, with its first
-- sign moved into gc_owner_contract_keep, and two refusals for a contract the customer signed in their portal, whose
-- signature holds the day as well as the price.
CREATE OR REPLACE FUNCTION public.gc_sign_owner_contract(p_project_id uuid, p_signed_on date, p_worth jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_portal date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to mark the contract signed.';
  END IF;
  PERFORM 1 FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  v_portal := public.gc_owner_contract_portal_signed_on(p_project_id);

  -- Marked not signed: the day and the price go together.
  IF p_signed_on IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = p_project_id) THEN
      RAISE EXCEPTION 'A pay application went out on this price, so the contract stays signed.';
    END IF;
    IF v_portal IS NOT NULL THEN
      RAISE EXCEPTION 'They signed it in their portal, so it stays signed.';
    END IF;
    DELETE FROM public.gc_owner_contract_lines WHERE project_id = p_project_id;
    UPDATE public.gc_projects SET owner_contract_signed_on = NULL WHERE project_id = p_project_id;
    RETURN;
  END IF;

  -- Signed already: the price stays as it was signed, and only the day moves, unless they signed it in their portal.
  IF EXISTS (SELECT 1 FROM public.gc_owner_contract_lines WHERE project_id = p_project_id) THEN
    IF v_portal IS NOT NULL THEN
      RAISE EXCEPTION 'They signed it in their portal on %, so its day stays.', to_char(v_portal, 'Mon FMDD');
    END IF;
    UPDATE public.gc_projects SET owner_contract_signed_on = p_signed_on WHERE project_id = p_project_id;
    RETURN;
  END IF;

  PERFORM public.gc_owner_contract_keep(p_project_id, p_signed_on, p_worth);
END;
$$;

COMMENT ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) IS
  'GC mode (v2.4831): our contract with the customer is signed on a day, with the price by line (ownerContractWorth: each trade''s package id, then gc, contingency and fee); a null day marks it not signed, which a sent pay application refuses. Signed already: only the day moves. The Board''s Get started calls it. Since B6-d-i its first sign is gc_owner_contract_keep, shared with the customer''s signing in their portal, and a contract they signed there is neither undone nor moved. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_sign_owner_contract(uuid, date, jsonb) TO authenticated;

-- 8) A send (D2, D3): the price by line and the file it goes with, on a sign-by day. A dev's until award's door, then
-- the money team's (the price by line is Our number's). The first send stamps owner_contract_sent_on; each one after
-- is a reminder or a new price, and the portal offers only the newest. The email is the client's after it
-- (gc-customer-email, kind contract), as gc_invite_companies leaves its sends to B4's window.
CREATE OR REPLACE FUNCTION public.gc_send_owner_contract(
  p_project_id uuid, p_sign_by date, p_note text, p_worth jsonb, p_file_path text, p_file_name text, p_file_sha256 text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_note text := btrim(coalesce(p_note, ''));
  v_path text := btrim(coalesce(p_file_path, ''));
  v_name text := btrim(coalesce(p_file_name, ''));
  v_sha text := lower(btrim(coalesce(p_file_sha256, '')));
  v_why text;
  v_first boolean;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The table's read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send our contract.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send our contract.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev sends our contract while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;

  SELECT g.stage, g.lost_on, g.owner_contract_signed_on, p.name, p.customer_id INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = p_project_id
  FOR UPDATE OF g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION '% is lost. Bring it back before you send our contract.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.stage = 'bidding' THEN
    RAISE EXCEPTION '% is still bidding. Press We won this first.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.owner_contract_signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'Our contract for % is signed already.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF p_sign_by IS NULL THEN
    RAISE EXCEPTION 'Pick the day to ask them to sign by.' USING ERRCODE = 'P0001';
  END IF;
  IF p_sign_by < public.app_today() THEN
    RAISE EXCEPTION 'Pick a sign-by day from today on.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'Keep your line under 500 characters.' USING ERRCODE = 'P0001';
  END IF;
  v_why := public.gc_owner_contract_worth_problem(p_project_id, p_worth);
  IF v_why IS NOT NULL THEN
    RAISE EXCEPTION '%', v_why USING ERRCODE = 'P0001';
  END IF;
  IF v_path = '' OR v_name = '' THEN
    RAISE EXCEPTION 'Attach the contract file first.' USING ERRCODE = 'P0001';
  END IF;
  IF split_part(v_path, '/', 1) <> p_project_id::text THEN
    RAISE EXCEPTION 'That file is not this project''s.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'The file''s fingerprint is not right. Attach it again.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'gc-owner-contracts' AND o.name = v_path) THEN
    RAISE EXCEPTION 'Upload the contract file first.' USING ERRCODE = 'P0001';
  END IF;

  v_first := NOT EXISTS (SELECT 1 FROM public.gc_owner_contract_sends WHERE project_id = p_project_id);
  INSERT INTO public.gc_owner_contract_sends (project_id, customer_id, first, sign_by, note, worth, file_path, file_name, file_sha256)
  VALUES (p_project_id, v_job.customer_id, v_first, p_sign_by, v_note, p_worth, v_path, v_name, v_sha)
  RETURNING id INTO v_id;
  IF v_first THEN
    UPDATE public.gc_projects SET owner_contract_sent_on = public.app_today()
    WHERE project_id = p_project_id AND owner_contract_sent_on IS NULL;
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_owner_contract(uuid, date, text, jsonb, text, text, text) IS
  'GC mode (B6-d-i): send our contract to the customer to sign in their portal, with the price by line (checked as gc_sign_owner_contract checks it) and the file in gc-owner-contracts with its SHA-256. The first send stamps owner_contract_sent_on. Sends no email: the client''s gc-customer-email kind contract follows it. A dev only until award''s door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_send_owner_contract(uuid, date, text, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_send_owner_contract(uuid, date, text, jsonb, text, text, text) TO authenticated;

-- 9) The customer signs (D7), after gc_trade_sign_sow: the submit function has turned the link into its customer,
-- stored the drawn signature and read the IP and browser; it calls this, then writes the e-sign ledger row (record type
-- gc_owner_contract) with the consent time this returns. Only the newest send, the customer's own, on a job still going,
-- not signed yet, and only while its price is still whole: the price kept is the one they read. A refusal raises a key
-- the portal says in the customer's words, with the reason in plain words as its DETAIL.
CREATE OR REPLACE FUNCTION public.gc_customer_sign_owner_contract(
  p_customer_id uuid, p_send_id uuid, p_printed_name text, p_signature_path text, p_ip text, p_user_agent text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_owner_contract_sends%ROWTYPE;
  v_job record;
  v_name text := btrim(coalesce(p_printed_name, ''));
  v_today date := public.app_today();
  v_at timestamptz := now();
BEGIN
  SELECT * INTO v FROM public.gc_owner_contract_sends WHERE id = p_send_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No contract with that id.';
  END IF;
  SELECT g.lost_on, g.owner_contract_signed_on, p.customer_id INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = v.project_id
  FOR UPDATE OF g;
  IF v.customer_id IS DISTINCT FROM p_customer_id OR v_job.customer_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That contract is another customer''s.';
  END IF;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'lost' USING ERRCODE = 'P0001', DETAIL = 'That job is not going ahead.';
  END IF;
  IF v.signed_on IS NOT NULL OR v_job.owner_contract_signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'That contract is signed already.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.gc_owner_contract_sends s
    WHERE s.project_id = v.project_id AND (s.created_at, s.id) > (v.created_at, v.id)
  ) THEN
    RAISE EXCEPTION 'notNewest' USING ERRCODE = 'P0001', DETAIL = 'We sent you a newer one. Sign that one.';
  END IF;
  IF NOT public.gc_owner_contract_worth_ok(v.project_id, v.worth) THEN
    RAISE EXCEPTION 'priceChanged' USING ERRCODE = 'P0001', DETAIL = 'Our price changed after we sent this. We will send you the new one.';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type your name to sign.';
  END IF;
  IF char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the name under 200 characters.';
  END IF;

  UPDATE public.gc_owner_contract_sends
  SET signed_on = v_today,
      signer_printed_name = v_name,
      signer_signature_storage_path = nullif(btrim(coalesce(p_signature_path, '')), ''),
      signer_consented_at = v_at,
      signer_ip = nullif(btrim(coalesce(p_ip, '')), ''),
      signer_user_agent = nullif(btrim(coalesce(p_user_agent, '')), '')
  WHERE id = v.id;
  -- The price kept is the one they read: the send's, not the project's today.
  PERFORM public.gc_owner_contract_keep(v.project_id, v_today, v.worth);
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text) IS
  'GC mode (B6-d-i): the customer signs our contract in their portal: the newest send, their own, on a job still going, not signed, its price still whole; writes the send''s signer fields and keeps its price by line through gc_owner_contract_keep. Returns the consent time, for the e-sign ledger row (gc_owner_contract) the submit function writes after it; the submit function also stores the signature. Service role only.';

-- Only the service role: B6-d-iii's submit-portal-request kind, after it has turned a link into its customer.
REVOKE ALL ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_customer_sign_owner_contract(uuid, uuid, text, text, text, text) TO service_role;

-- 10) The e-sign ledger keeps the words the customer agreed to, keyed by the send.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change', 'gc_owner_contract')) NOT VALID;
ALTER TABLE public.esign_consents VALIDATE CONSTRAINT esign_consents_record_type_check;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
