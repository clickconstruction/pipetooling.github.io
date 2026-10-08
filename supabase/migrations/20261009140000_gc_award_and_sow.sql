SET lock_timeout = '3s';

-- GC mode, the Board's B6-a (to-dos/gc-mode/mockups/board-b6.md on spike/gc-mode, approved 2026-10-08):
-- the contract step for our number's money, award, and the statement of work standing alone (call 6).
-- No live table changes shape except gc_projects (the contract step) and esign_consents' record_type
-- CHECK (call E). Dev only while the Board is built; the Board's door opens the new tables.

-- 1) The contract step. B5-a (20261008130000) copied our number's three inputs to gc_project_money, and
-- since B5-c (v2.4930) no client or function reads gc_projects' copies. The doc reads both places on prod
-- before the push and finds them equal.
ALTER TABLE public.gc_projects
  DROP COLUMN IF EXISTS general_conditions,
  DROP COLUMN IF EXISTS contingency_pct,
  DROP COLUMN IF EXISTS fee_pct;

-- 2) Award on the trade: the ask whose quote we awarded, who decided and the company's day.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_invites_id_company' AND conrelid = 'public.gc_invites'::regclass) THEN
    ALTER TABLE public.gc_invites ADD CONSTRAINT gc_invites_id_company UNIQUE (id, company_id);
  END IF;
END $$;

ALTER TABLE public.gc_trade_packages
  ADD COLUMN IF NOT EXISTS awarded_invite_id uuid,
  ADD COLUMN IF NOT EXISTS awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_on date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_awarded_on_this_trade' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    -- An ask on this trade. An awarded ask cannot be deleted: its statement of work points at it too.
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_awarded_on_this_trade
      FOREIGN KEY (awarded_invite_id, id) REFERENCES public.gc_invites (id, package_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_trade_packages_awarded_with_day' AND conrelid = 'public.gc_trade_packages'::regclass) THEN
    ALTER TABLE public.gc_trade_packages ADD CONSTRAINT gc_trade_packages_awarded_with_day
      CHECK ((awarded_invite_id IS NULL) = (awarded_on IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.gc_trade_packages.awarded_invite_id IS
  'GC mode (B6-a, v2.4934): the ask whose quote this trade is awarded to. Written by gc_award only, with awarded_by and awarded_on.';
COMMENT ON COLUMN public.gc_trade_packages.awarded_by IS
  'GC mode (B6-a, v2.4934): the estimator who decided the award.';
COMMENT ON COLUMN public.gc_trade_packages.awarded_on IS
  'GC mode (B6-a, v2.4934): the company''s day of the award (public.app_today()).';

-- 3) The statement of work, standing alone (call 6): step_commitments is not touched.
CREATE TABLE IF NOT EXISTS public.gc_sows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL UNIQUE REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT gc_sows_status_known CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  price numeric NOT NULL
    CONSTRAINT gc_sows_price_not_negative CHECK (price >= 0),
  retainage_pct numeric NOT NULL DEFAULT 10
    CONSTRAINT gc_sows_retainage_range CHECK (retainage_pct >= 0 AND retainage_pct <= 100),
  -- The plan set it is based on (gc_plan_sets.rev).
  based_on_rev integer NOT NULL DEFAULT 0,
  -- Their own schedule of values from the quote, [{label, amount}]. Null: they sent none.
  their_sov jsonb
    CONSTRAINT gc_sows_their_sov_array CHECK (their_sov IS NULL OR jsonb_typeof(their_sov) = 'array'),
  -- What they will not do, [{name, by, unitPrice?}], from the quote awarded. Null: it named nothing.
  excluded jsonb
    CONSTRAINT gc_sows_excluded_array CHECK (excluded IS NULL OR jsonb_typeof(excluded) = 'array'),
  sent_on date,
  signed_on date,
  -- The ESIGN fields, as step_commitments' offer signing has them; the trade's sign verb writes them.
  signer_printed_name text,
  signer_signature_storage_path text,
  signer_consented_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  -- Closeout: the day we accepted their work.
  accepted_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The ask awarded: an ask of this company, on this trade.
  CONSTRAINT gc_sows_ask_of_company FOREIGN KEY (invite_id, company_id) REFERENCES public.gc_invites (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT gc_sows_ask_on_trade FOREIGN KEY (invite_id, package_id) REFERENCES public.gc_invites (id, package_id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.gc_sows IS
  'GC mode (B6-a, v2.4934): a trade''s statement of work with the company awarded (TradePackage.sow), drafted by gc_award from the quote and signed in the trade''s portal. Stands alone: step_commitments is not touched (board-b6.md call 6).';

CREATE TABLE IF NOT EXISTS public.gc_sow_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  amount numeric NOT NULL
    CONSTRAINT gc_sow_lines_amount_not_negative CHECK (amount >= 0),
  -- The kernels' SovLine.id: the scope item, or the change order that added the line.
  scope_item_id uuid REFERENCES public.gc_scope_items(id) ON DELETE RESTRICT,
  change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE RESTRICT,
  CONSTRAINT gc_sow_lines_one_source CHECK ((scope_item_id IS NULL) <> (change_order_id IS NULL)),
  CONSTRAINT gc_sow_lines_scope_once UNIQUE (sow_id, scope_item_id)
);

COMMENT ON TABLE public.gc_sow_lines IS
  'GC mode (B6-a, v2.4934): a statement of work''s schedule of values, one line per scope item (or change order). Draws, back charges and sent-backs point at these ids.';

ALTER TABLE public.gc_sows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_sow_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_sows_dev ON public.gc_sows;
CREATE POLICY gc_sows_dev ON public.gc_sows FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_sow_lines_dev ON public.gc_sow_lines;
CREATE POLICY gc_sow_lines_dev ON public.gc_sow_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
REVOKE ALL ON public.gc_sows, public.gc_sow_lines FROM anon;

-- 4) The e-sign ledger takes a signed statement of work (call E), with nothing else changed.
ALTER TABLE public.esign_consents DROP CONSTRAINT IF EXISTS esign_consents_record_type_check;
ALTER TABLE public.esign_consents
  ADD CONSTRAINT esign_consents_record_type_check
  CHECK (record_type IN ('estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room', 'lien_owner_record_request', 'gc_sow'));

-- 5) The leveled total in SQL, as leveledTotal (src/lib/gc/bids.ts) reads it (call G): the newest quote,
-- plus the ask's plug on each scope line it does not say yes to, its taken alternates, and its cover on
-- each exclusion beyond the trade's Known exclusions. exclusionCoversTotal matches names by fold().
-- src/lib/gc/awardSql.test.ts and supabase/tests/gc_award hold this copy to the kernel.
CREATE OR REPLACE FUNCTION public.gc_exclusion_key(p_words text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(replace(lower(coalesce(p_words, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g'))
$$;

COMMENT ON FUNCTION public.gc_exclusion_key(text) IS
  'GC mode (B6-a, v2.4934): exclusions.ts'' fold() in SQL: "Permits & fees" and "permits and fees" are one key.';

CREATE OR REPLACE FUNCTION public.gc_leveled_total(p_invite_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ask AS (
    SELECT i.id, i.package_id, i.plugs, i.exclusion_covers, i.taken_alternates FROM public.gc_invites i WHERE i.id = p_invite_id
  ), quote AS (
    SELECT q.* FROM public.gc_quotes q WHERE q.invite_id = p_invite_id ORDER BY q.created_at DESC, q.id DESC LIMIT 1
  )
  SELECT quote.amount
    + coalesce((
        SELECT sum(coalesce((ask.plugs ->> s.id::text)::numeric, 0))
        FROM public.gc_scope_items s
        WHERE s.package_id = ask.package_id AND coalesce(quote.includes ->> s.id::text, '') <> 'yes'
      ), 0)
    + coalesce((
        SELECT sum((a ->> 'amount')::numeric)
        FROM jsonb_array_elements(coalesce(quote.alternates, '[]'::jsonb)) a
        WHERE (a ->> 'label') = ANY (coalesce(ask.taken_alternates, '{}'))
      ), 0)
    + coalesce((
        SELECT sum(coalesce((ask.exclusion_covers ->> (e ->> 'name'))::numeric, 0))
        FROM jsonb_array_elements(coalesce(quote.exclusions, '[]'::jsonb)) e
        WHERE public.gc_exclusion_key(e ->> 'name') NOT IN (
          SELECT public.gc_exclusion_key(k.label) FROM public.gc_scope_exclusions k WHERE k.package_id = ask.package_id
        )
      ), 0)
  FROM ask JOIN quote ON true
$$;

COMMENT ON FUNCTION public.gc_leveled_total(uuid) IS
  'GC mode (B6-a, v2.4934): an ask''s all-in number, as leveledTotal reads it. Null when no quote is in. SECURITY INVOKER.';

-- 6) Award: the gate re-checked in SQL against the company's vetting (canAward's words), the award
-- written, and the statement of work drafted as sowFromBid draws it. One transaction.
CREATE OR REPLACE FUNCTION public.gc_award(p_invite_id uuid, p_estimator uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ask record;
  v_total numeric;
  v_rev integer;
  v_count integer;
  v_each numeric;
  v_sow uuid;
  v_quote record;
  v_excluded jsonb;
  v_dollars text;
BEGIN
  -- Who may award (call W, the owner's): dev while built. Door 2 opened the trades to the office, so the
  -- refusal is said here, before any write, rather than left to gc_sows' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev awards a trade while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;
  SELECT i.id AS invite_id, i.company_id, k.id AS package_id, k.trade, k.ours, k.awarded_invite_id,
         g.project_id, g.lost_on, p.name AS project_name,
         c.name AS company, c.vetting_status, c.vetting_limit, c.vetting_note,
         EXISTS (SELECT 1 FROM public.gc_company_vetting_forms f WHERE f.company_id = c.id) AS form_in
  INTO v_ask
  FROM public.gc_invites i
  JOIN public.gc_trade_packages k ON k.id = i.package_id
  JOIN public.gc_projects g ON g.project_id = k.project_id
  JOIN public.projects p ON p.id = g.project_id
  JOIN public.gc_companies c ON c.id = i.company_id
  WHERE i.id = p_invite_id
  FOR UPDATE OF k;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That ask is not on a GC trade.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.ours THEN
    RAISE EXCEPTION 'We do % ourselves, so it is not awarded.', v_ask.trade USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.lost_on IS NOT NULL THEN
    RAISE EXCEPTION '% is lost. Bring it back before you award a trade.', v_ask.project_name USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.awarded_invite_id IS NOT NULL THEN
    RAISE EXCEPTION '% is already awarded.', v_ask.trade USING ERRCODE = 'P0001';
  END IF;

  v_total := public.gc_leveled_total(p_invite_id);
  IF v_total IS NULL THEN
    RAISE EXCEPTION '% has not sent a quote for %.', v_ask.company, v_ask.trade USING ERRCODE = 'P0001';
  END IF;

  -- canAward (src/lib/gc/vetting.ts), word for word. A company with no vetting is one we know.
  IF v_ask.vetting_status = 'new' THEN
    IF v_ask.form_in THEN
      RAISE EXCEPTION '% is not vetted yet. Their form came in. Approve them on Trade partners first.', v_ask.company USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION '% is not vetted yet. They have not sent their form.', v_ask.company USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.vetting_status = 'declined' THEN
    RAISE EXCEPTION '%', 'We declined ' || v_ask.company
      || CASE WHEN coalesce(v_ask.vetting_note, '') <> '' THEN ': ' || v_ask.vetting_note ELSE '' END || '.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ask.vetting_limit IS NOT NULL AND v_total > v_ask.vetting_limit THEN
    v_dollars := '$' || to_char(round(v_ask.vetting_limit), 'FM999,999,999,990');
    RAISE EXCEPTION '% is approved up to %. This award is %.', v_ask.company, v_dollars,
      '$' || to_char(round(v_total), 'FM999,999,999,990') USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_trade_packages
  SET awarded_invite_id = p_invite_id, awarded_by = coalesce(p_estimator, auth.uid()), awarded_on = public.app_today()
  WHERE id = v_ask.package_id;

  -- sowFromBid: the price, retainage 10, the newest plan set, their own schedule of values and what they
  -- will not do, then one line per scope item, the price split evenly in hundreds with the rest on the last.
  SELECT q.sov, q.exclusions INTO v_quote
  FROM public.gc_quotes q WHERE q.invite_id = p_invite_id ORDER BY q.created_at DESC, q.id DESC LIMIT 1;
  SELECT coalesce(max(s.rev), 0) INTO v_rev FROM public.gc_plan_sets s WHERE s.project_id = v_ask.project_id;
  SELECT CASE WHEN jsonb_array_length(coalesce(v_quote.exclusions, '[]'::jsonb)) = 0 THEN NULL ELSE jsonb_agg(
           jsonb_build_object('name', e ->> 'name', 'by', (
             SELECT k.by FROM public.gc_scope_exclusions k
             WHERE k.package_id = v_ask.package_id AND public.gc_exclusion_key(k.label) = public.gc_exclusion_key(e ->> 'name')
             ORDER BY k.position, k.created_at LIMIT 1
           )) || CASE WHEN e ? 'unitPrice' THEN jsonb_build_object('unitPrice', e -> 'unitPrice') ELSE '{}'::jsonb END
           ORDER BY ord) END
  INTO v_excluded
  FROM jsonb_array_elements(coalesce(v_quote.exclusions, '[]'::jsonb)) WITH ORDINALITY AS x(e, ord);

  INSERT INTO public.gc_sows (package_id, invite_id, company_id, price, retainage_pct, based_on_rev, their_sov, excluded)
  VALUES (
    v_ask.package_id, p_invite_id, v_ask.company_id, v_total, 10, v_rev,
    CASE WHEN jsonb_array_length(coalesce(v_quote.sov, '[]'::jsonb)) > 0 THEN v_quote.sov END,
    v_excluded
  )
  RETURNING id INTO v_sow;

  SELECT count(*) INTO v_count FROM public.gc_scope_items s WHERE s.package_id = v_ask.package_id;
  v_each := floor(v_total / greatest(1, v_count) / 100) * 100;
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, scope_item_id)
  SELECT v_sow, n - 1, s.label,
         CASE WHEN n = v_count THEN v_total - v_each * (v_count - 1) ELSE v_each END,
         s.id
  FROM (
    SELECT s.*, row_number() OVER (ORDER BY s.position, s.id) AS n FROM public.gc_scope_items s WHERE s.package_id = v_ask.package_id
  ) s;

  RETURN v_sow;
END;
$$;

COMMENT ON FUNCTION public.gc_award(uuid, uuid) IS
  'GC mode (B6-a, v2.4934): award a trade to one ask''s quote, dev only until call W. Refuses our own trade, a lost project, a trade already awarded and an ask with no quote; re-checks canAward against the leveled total in SQL; writes the award; drafts the statement of work as sowFromBid does. Returns the statement of work''s id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_exclusion_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_leveled_total(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_award(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_exclusion_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_leveled_total(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_award(uuid, uuid) TO authenticated;

-- 7) Training mode and digital twins: the new tables get their blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
