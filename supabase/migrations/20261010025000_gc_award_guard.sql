SET lock_timeout = '3s';

-- GC mode, the Board (v2.5100): only gc_award writes a trade's award (to-dos/gc-mode/mockups/board-b6.md on
-- spike/gc-mode, "The award guard"). B6-a (20261009140000) added the three award columns to gc_trade_packages
-- and said "Written by gc_award only", but the table carries door 1's gc_trade_packages_team policy, every verb
-- for gc_office_team(), and nothing held the columns. Any of the office team could set or clear an award with a
-- plain UPDATE, past gc_award's gate. A trigger now holds them, and gc_award turns on a flag around its own write.
-- No table is created, and no other column, policy or function changes.

-- 1) The guard. A signed-in person changes the three columns only inside gc_award, which turns this
-- transaction's gc.award_write flag on for its UPDATE and off after it (the house pattern of
-- gc_schedule_plan_guard). Two writes pass without it: a key letting go inside its own trigger (an ask's or a
-- user's ON DELETE SET NULL; an ask's delete still meets the award's day CHECK and the statement of work's key),
-- and server code with no person (auth.uid() IS NULL: the service role, a migration, a bed's fixtures, as
-- gc_projects_owner_terms_guard lets them). No role is named, so a dev's plain UPDATE is refused too, and the
-- award's door (call W) changes only gc_award's own gate.
CREATE OR REPLACE FUNCTION public.gc_trade_packages_award_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.awarded_invite_id IS NOT NULL OR NEW.awarded_by IS NOT NULL OR NEW.awarded_on IS NOT NULL;
  ELSE
    v_changed := (NEW.awarded_invite_id, NEW.awarded_by, NEW.awarded_on)
      IS DISTINCT FROM (OLD.awarded_invite_id, OLD.awarded_by, OLD.awarded_on);
  END IF;
  IF v_changed AND current_setting('gc.award_write', true) IS DISTINCT FROM 'on'
     AND pg_trigger_depth() < 2 AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'A trade''s award changes only through Award and draft the statement of work in Compare quotes.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_packages_award_guard() IS
  'GC mode (v2.5100): the trigger that lets a signed-in person change a trade''s award (awarded_invite_id, awarded_by, awarded_on) only inside gc_award, which sets gc.award_write for its UPDATE. A cascade passes (pg_trigger_depth() > 1), and so does server code with no person (auth.uid() IS NULL). No role is named.';

-- Every row of every INSERT and UPDATE, not UPDATE OF, so no other trigger's change slips past it.
CREATE OR REPLACE TRIGGER gc_trade_packages_award_guard BEFORE INSERT OR UPDATE ON public.gc_trade_packages
  FOR EACH ROW EXECUTE FUNCTION public.gc_trade_packages_award_guard();

COMMENT ON COLUMN public.gc_trade_packages.awarded_invite_id IS
  'GC mode (B6-a, v2.4934): the ask whose quote this trade is awarded to. Written by gc_award only, with awarded_by and awarded_on; gc_trade_packages_award_guard holds the three (v2.5100).';

-- 2) gc_award as B6-a made it (20261009140000), with the flag turned on for its UPDATE and off after it:
-- the gate re-checked in SQL against the company's vetting (canAward's words), the award written, and the
-- statement of work drafted as sowFromBid draws it. One transaction.
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

  PERFORM set_config('gc.award_write', 'on', true);
  UPDATE public.gc_trade_packages
  SET awarded_invite_id = p_invite_id, awarded_by = coalesce(p_estimator, auth.uid()), awarded_on = public.app_today()
  WHERE id = v_ask.package_id;
  PERFORM set_config('gc.award_write', '', true);

  -- sowFromBid: the price, retainage 10, the newest plan set, their own schedule of values and what they
  -- will not do (a unit price only when there is one, as sowExcluded), then one line per scope item, the
  -- price split evenly in hundreds with the rest on the last.
  SELECT q.sov, q.exclusions INTO v_quote
  FROM public.gc_quotes q WHERE q.invite_id = p_invite_id ORDER BY q.created_at DESC, q.id DESC LIMIT 1;
  SELECT coalesce(max(s.rev), 0) INTO v_rev FROM public.gc_plan_sets s WHERE s.project_id = v_ask.project_id;
  SELECT CASE WHEN jsonb_array_length(coalesce(v_quote.exclusions, '[]'::jsonb)) = 0 THEN NULL ELSE jsonb_agg(
           jsonb_build_object('name', e ->> 'name', 'by', (
             SELECT k.by FROM public.gc_scope_exclusions k
             WHERE k.package_id = v_ask.package_id AND public.gc_exclusion_key(k.label) = public.gc_exclusion_key(e ->> 'name')
             ORDER BY k.position, k.created_at LIMIT 1
           )) || CASE WHEN coalesce(e -> 'unitPrice', 'null'::jsonb) <> 'null'::jsonb THEN jsonb_build_object('unitPrice', e -> 'unitPrice') ELSE '{}'::jsonb END
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
  'GC mode (B6-a, v2.4934; the award guard v2.5100): award a trade to one ask''s quote, dev only until call W. Refuses our own trade, a lost project, a trade already awarded and an ask with no quote; re-checks canAward against the leveled total in SQL; writes the award under gc.award_write, the flag gc_trade_packages_award_guard reads; drafts the statement of work as sowFromBid does. Returns the statement of work''s id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_award(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_award(uuid, uuid) TO authenticated;
