SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P4a (to-dos/gc-mode/mockups/portal-p4.md on branch spike/gc-mode):
-- the portal's two records, each on the work a trade signed for (B6-a's gc_sows).
--   - A back-charge is a charge to a trade: cleanup, damage, or work we had to finish for it. The office
--     charges it on Building's screen, the company agrees or disputes it in its portal by its answer day,
--     and the office keeps or drops it. Taking it off a draw is U6's, which gives taken_draw_id its FK.
--   - A change request is a trade asking us for a change on that work. The office makes it a change order
--     to the customer or turns it down (Owner Billing's O3b, under this table's policy).
-- Dev only until the trade wave (src/lib/gc/doors.ts). The office's verbs are SECURITY INVOKER under the
-- tables' policy, and refuse anyone but a dev first, in words, as gc_award does. The trade's two are the service role's alone, as P2a's are: the submit function
-- has already turned the link into its company, and each verb takes that company first. A refusal raises
-- a key the page says in the company's language (decision 11), with the reason in plain words as its
-- DETAIL. Doc: docs/migrations/.

-- A charge to a trade (BackCharge).
CREATE TABLE IF NOT EXISTS public.gc_back_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  -- The statement of work it is on: the work the company signed for.
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE RESTRICT,
  amount numeric NOT NULL
    CONSTRAINT gc_back_charges_amount_positive CHECK (amount > 0),
  -- What it is for, in the office's words.
  reason text NOT NULL
    CONSTRAINT gc_back_charges_reason_said CHECK (btrim(reason) <> '' AND char_length(reason) <= 2000),
  -- The photo sent with it, a Drive link. Null: none (no upload until P5a).
  photo_url text,
  -- The app's day it was sent, and the day to answer by: BACK_CHARGE_ANSWER_DAYS later
  -- (src/lib/gc/portal.ts; src/lib/gc/backChargesSql.test.ts reads the number on the next line).
  sent_on date NOT NULL,
  answer_by date NOT NULL GENERATED ALWAYS AS (sent_on + 5) STORED,
  status text NOT NULL DEFAULT 'open'
    CONSTRAINT gc_back_charges_status_known CHECK (status IN ('open', 'agreed', 'disputed', 'kept', 'dropped')),
  -- The company's answer: the day, and its reason when it disputes.
  answered_on date,
  answer_note text,
  -- The office's keep or drop: the day, why, and who.
  settled_on date,
  settled_note text,
  settled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The draw it came off, and the day. U6 adds the draw's FK and the verb that writes them.
  taken_draw_id uuid,
  taken_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_back_charges_answer_dated CHECK (status NOT IN ('agreed', 'disputed') OR answered_on IS NOT NULL),
  CONSTRAINT gc_back_charges_dispute_says_why CHECK (status <> 'disputed' OR btrim(coalesce(answer_note, '')) <> ''),
  CONSTRAINT gc_back_charges_settled_says_why CHECK (status NOT IN ('kept', 'dropped') OR (settled_on IS NOT NULL AND btrim(coalesce(settled_note, '')) <> '')),
  CONSTRAINT gc_back_charges_taken_dated CHECK ((taken_draw_id IS NULL) = (taken_on IS NULL))
);

COMMENT ON TABLE public.gc_back_charges IS
  'GC mode (P4a): a charge to a trade on its signed statement of work (BackCharge): cleanup, damage, or work we had to finish for it. The company agrees or disputes it in its portal by answer_by; the office keeps or drops it; U6 takes it off a draw. Written by gc_back_charge, gc_keep_back_charge, gc_drop_back_charge and the service role''s gc_trade_answer_back_charge. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_back_charges_sow_idx ON public.gc_back_charges (sow_id);
CREATE INDEX IF NOT EXISTS gc_back_charges_company_idx ON public.gc_back_charges (company_id);

-- A change a trade asked us for from its portal (TradeChangeRequest).
CREATE TABLE IF NOT EXISTS public.gc_trade_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  -- The statement of work it would change: the work the company signed for.
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE RESTRICT,
  asked_on date NOT NULL,
  -- What changed, in the trade's words.
  description text NOT NULL
    CONSTRAINT gc_trade_change_requests_described CHECK (btrim(description) <> '' AND char_length(description) <= 2000),
  -- Why, the three a change order to the customer carries.
  reason text NOT NULL
    CONSTRAINT gc_trade_change_requests_reason_known CHECK (reason IN ('owner', 'field', 'plans')),
  -- What the trade asks for the work, and the working days it adds.
  amount numeric NOT NULL
    CONSTRAINT gc_trade_change_requests_amount_positive CHECK (amount > 0),
  days integer NOT NULL DEFAULT 0
    CONSTRAINT gc_trade_change_requests_days_counted CHECK (days >= 0),
  -- The file sent with it, a Drive link. Null: none (no upload until P5a).
  file_url text,
  -- The office's answer: the change order it made of it, or the day it turned it down and why. Deleting
  -- the draft frees the request to be drafted again.
  change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE SET NULL,
  turned_down_on date,
  turned_down_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_trade_change_requests_turned_down_says_why CHECK (
    (turned_down_on IS NULL AND turned_down_note IS NULL)
    OR (turned_down_on IS NOT NULL AND btrim(coalesce(turned_down_note, '')) <> '')
  ),
  CONSTRAINT gc_trade_change_requests_one_answer CHECK (turned_down_on IS NULL OR change_order_id IS NULL)
);

COMMENT ON TABLE public.gc_trade_change_requests IS
  'GC mode (P4a): a change a trade asked for from its portal on its signed statement of work (TradeChangeRequest). The office makes it a change order to the customer (change_order_id) or turns it down (turned_down_*), through Owner Billing''s two verbs. Written by the service role''s gc_trade_ask_change. Dev only while it is built.';

-- The company's own, newest first, and the submit function's hourly count.
CREATE INDEX IF NOT EXISTS gc_trade_change_requests_company_idx ON public.gc_trade_change_requests (company_id, created_at);
CREATE INDEX IF NOT EXISTS gc_trade_change_requests_project_idx ON public.gc_trade_change_requests (project_id);

ALTER TABLE public.gc_back_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_change_requests ENABLE ROW LEVEL SECURITY;

-- Dev only until the trade wave. Building's screen and Owner Billing's two verbs work under these.
DROP POLICY IF EXISTS gc_back_charges_dev ON public.gc_back_charges;
CREATE POLICY gc_back_charges_dev ON public.gc_back_charges FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_trade_change_requests_dev ON public.gc_trade_change_requests;
CREATE POLICY gc_trade_change_requests_dev ON public.gc_trade_change_requests FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- The client writes through the verbs and never deletes. A charge is made with what the office types,
-- the rest by default, and is kept or dropped in its settled columns. The company's answer is written
-- with the service role, and the draw it came off by U6. A request is the trade's, through the service
-- role, and the office answers it in its own columns.
REVOKE ALL ON TABLE public.gc_back_charges, public.gc_trade_change_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_back_charges, public.gc_trade_change_requests FROM authenticated;
GRANT INSERT (project_id, package_id, company_id, sow_id, amount, reason, photo_url, sent_on) ON TABLE public.gc_back_charges TO authenticated;
GRANT UPDATE (status, settled_on, settled_note, settled_by) ON TABLE public.gc_back_charges TO authenticated;
GRANT UPDATE (change_order_id, turned_down_on, turned_down_note) ON TABLE public.gc_trade_change_requests TO authenticated;

-- Charge a trade (the prototype's backCharge, on Building's screen): on its statement of work once it is
-- signed. The company is the one on it. Returns the charge's id.
CREATE OR REPLACE FUNCTION public.gc_back_charge(p_package_id uuid, p_amount numeric, p_reason text, p_photo_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_sow public.gc_sows%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev charges a trade while GC mode is built.';
  END IF;
  SELECT k.project_id INTO v_project_id FROM public.gc_trade_packages k WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_sow.id IS NULL OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'A charge goes on signed work. This trade''s statement of work is not signed.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the charge''s amount.';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'descriptionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what the charge is for.';
  END IF;
  IF char_length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the reason under 2,000 characters.';
  END IF;
  INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, photo_url, sent_on)
  VALUES (v_project_id, p_package_id, v_sow.company_id, v_sow.id, p_amount, v_reason, nullif(btrim(coalesce(p_photo_url, '')), ''), public.app_today())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Keep a charge (the prototype's settleBackCharge, keep): after the company disputed it, or when its
-- answer day went by with no answer. Never one taken off a draw. The note says why it stands.
CREATE OR REPLACE FUNCTION public.gc_keep_back_charge(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev keeps a charge while GC mode is built.';
  END IF;
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge came off a draw already.';
  END IF;
  IF v.status = 'open' AND public.app_today() <= v.answer_by THEN
    RAISE EXCEPTION 'stillOpen' USING ERRCODE = 'P0001', DETAIL = format('The company has until %s to answer it.', to_char(v.answer_by, 'Mon FMDD'));
  END IF;
  IF v.status NOT IN ('open', 'disputed') THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = CASE v.status
      WHEN 'agreed' THEN 'The company agreed to that charge already.'
      ELSE format('That charge is %s already.', v.status) END;
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the charge stands.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = 'kept', settled_on = public.app_today(), settled_note = v_note, settled_by = auth.uid()
  WHERE id = v.id;
END;
$$;

-- Drop a charge (the prototype's settleBackCharge, drop): any charge not dropped yet and not taken off a
-- draw, a kept one too. The note says why.
CREATE OR REPLACE FUNCTION public.gc_drop_back_charge(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev drops a charge while GC mode is built.';
  END IF;
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge came off a draw already.';
  END IF;
  IF v.status = 'dropped' THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge is dropped already.';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the charge is dropped.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = 'dropped', settled_on = public.app_today(), settled_note = v_note, settled_by = auth.uid()
  WHERE id = v.id;
END;
$$;

-- The company agrees to a charge or disputes it (tradeAnswerBackCharge): its own charge, still open and
-- not taken off a draw, even after its answer day. A dispute says why.
CREATE OR REPLACE FUNCTION public.gc_trade_answer_back_charge(p_company_id uuid, p_charge_id uuid, p_agree boolean, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That charge is another company''s.';
  END IF;
  IF v.status <> 'open' OR v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge has its answer already.';
  END IF;
  IF p_agree IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say whether the company agrees.';
  END IF;
  IF NOT p_agree AND v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the company disputes it.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = CASE WHEN p_agree THEN 'agreed' ELSE 'disputed' END, answered_on = public.app_today(), answer_note = v_note
  WHERE id = v.id;
END;
$$;

-- The company asks for a change on its work (tradeAskChange): only on a trade whose statement of work it
-- signed, on a job that is ours (portalCanAskChange). What changed, why, what it asks and the working days
-- it adds. Returns the request's id.
CREATE OR REPLACE FUNCTION public.gc_trade_ask_change(p_company_id uuid, p_package_id uuid, p_description text, p_reason text, p_amount numeric, p_days integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pkg record;
  v_sow public.gc_sows%ROWTYPE;
  v_text text := btrim(coalesce(p_description, ''));
  v_id uuid;
BEGIN
  SELECT k.id, k.project_id, k.ours, k.awarded_invite_id, g.stage INTO v_pkg
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  -- Signed is the status, never a row that merely exists; the award and the statement of work name the
  -- same ask, which gc_award writes together.
  IF v_pkg.stage = 'bidding' OR v_pkg.ours OR v_sow.id IS NULL OR v_sow.status <> 'signed'
    OR v_sow.company_id IS DISTINCT FROM p_company_id OR v_sow.invite_id IS DISTINCT FROM v_pkg.awarded_invite_id
  THEN
    RAISE EXCEPTION 'notAwarded' USING ERRCODE = 'P0001', DETAIL = 'A change is asked on work the company signed for, on a job that is ours.';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'descriptionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what changed.';
  END IF;
  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep it under 2,000 characters.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The reason is the customer, the field or the plans.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type what the company asks for the work.';
  END IF;
  IF p_days IS NULL OR p_days < 0 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The working days it adds are 0 or more.';
  END IF;
  INSERT INTO public.gc_trade_change_requests (project_id, package_id, company_id, sow_id, asked_on, description, reason, amount, days)
  VALUES (v_pkg.project_id, v_pkg.id, p_company_id, v_sow.id, public.app_today(), v_text, p_reason, p_amount, p_days)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) IS 'GC mode (P4a): charge a trade on its signed statement of work (backCharge); the company is the one on it, the answer day five days on. Refuses anyone but a dev first (devOnly), then unsigned work (sowNotSigned), an amount not above zero and a blank reason. Returns the id. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_keep_back_charge(uuid, text) IS 'GC mode (P4a): keep a charge after a dispute, or when no answer came by its day (settleBackCharge, keep), with a note; never one taken off a draw. Dev only (devOnly). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_drop_back_charge(uuid, text) IS 'GC mode (P4a): drop a charge not dropped yet and not taken off a draw (settleBackCharge, drop), with a note. Dev only (devOnly). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_answer_back_charge(uuid, uuid, boolean, text) IS 'GC mode (P4a): the company agrees to its charge or disputes it with a note (tradeAnswerBackCharge), while it is open and not taken, even after its answer day. Service role only.';
COMMENT ON FUNCTION public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer) IS 'GC mode (P4a): a change asked from the portal (tradeAskChange), only by the company on a signed statement of work on a job that is ours (portalCanAskChange), else notAwarded. Returns the id. Service role only.';

-- The office's three: signed-in users, and inside them a dev only, as above.
REVOKE ALL ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_keep_back_charge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_drop_back_charge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_keep_back_charge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_drop_back_charge(uuid, text) TO authenticated;

-- The trade's two, only the service role: the submit function, after it has turned a link into its company.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_answer_back_charge(uuid, uuid, boolean, text)',
    'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;

-- Training mode and digital twins: the new tables get their blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
