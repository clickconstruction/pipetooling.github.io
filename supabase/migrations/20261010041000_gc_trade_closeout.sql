SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U6c (v2.5115): closeout on real data. Once every line of a trade's
-- statement of work is billed, we accept the work when its punch list is done; the trade asks for the retainage we
-- hold with its final pay application; we approve it 10 days after the customer pays us ours and pay it; its
-- unconditional final release keeps the promise of its closeout papers (U6a's gc_draw_waiver_signed). Then we close
-- the job. A change the trade signed on paper is recorded by the office, as a pay application and a waiver that came
-- in are, so its line never waits for the portal. Each refuses in words what the prototype's reducer refuses
-- (acceptWork, tradeSendFinalPayApp, approveRetainage, closeJob, tradeSignChange). The release is the retainage held
-- (retainageHeldNow), so a back-charge taken off a draw is never paid back; the kernels' finalPayApplication says the
-- same once its line 7 counts what was certified before the charges. The office's presses are SECURITY INVOKER, so
-- RLS decides who may: dev only until Building's door, then the money roles (decision 4). Closing a job writes the
-- office's gc_projects, so it names the dev until that door. The trade's press is the service role's only, with keys
-- as the Portal's P2a verbs. Plan: to-dos/gc-mode/mockups/building-u6.md on spike/gc-mode. The draws: U6a
-- (20261010021000). The punch list: U1 (20261008030000). Our bills to the customer: 20261008010000 and 20261009200000.

-- The day we closed the job (decision 12), set with the stage `closed` by gc_close_job.
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS closed_on date;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed' AND conrelid = 'public.gc_projects'::regclass) THEN
    ALTER TABLE public.gc_projects ADD CONSTRAINT gc_projects_closed_on_when_closed CHECK (closed_on IS NULL OR stage = 'closed');
  END IF;
END $$;

COMMENT ON COLUMN public.gc_projects.closed_on IS
  'GC mode (v2.5115, Building U6c): the day we closed the job (GcProject.closedOn), set with the stage closed by gc_close_job. Null: not closed, or closed before U6c.';

-- A change the trade signed on paper or by email: who of ours recorded it, and the file it came as. Null: signed in the
-- portal (gc_trade_sign_change), or not signed yet.
ALTER TABLE public.gc_change_order_trade_sends
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS drive_url text;

COMMENT ON COLUMN public.gc_change_order_trade_sends.recorded_by IS
  'GC mode (v2.5115, Building U6c): who of ours recorded the trade''s signature on paper or by email (gc_trade_change_signed_in). Null: signed in the portal, or not signed yet.';

-- What we hold on a trade (retainageHeldNow): the retainage on every approved or paid draw, less a release once paid.
CREATE OR REPLACE FUNCTION public.gc_retainage_held(p_sow_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(sum(retainage) FILTER (WHERE NOT final AND status IN ('approved', 'paid')), 0)
       - coalesce(sum(net) FILTER (WHERE final AND status = 'paid'), 0)
  FROM public.gc_draws WHERE sow_id = p_sow_id
$$;

-- Every line billed (workAllBilled): each line of the statement of work at 100% on an approved or paid draw.
CREATE OR REPLACE FUNCTION public.gc_sow_all_billed(p_sow_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*) > 0 AND bool_and(coalesce(b.pct, 0) >= 100)
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (
    SELECT max(dl.to_pct) AS pct FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
    WHERE dl.sow_line_id = l.id AND d.status IN ('approved', 'paid') AND NOT d.final
  ) b ON true
  WHERE l.sow_id = p_sow_id
$$;

-- The day the customer paid us the retainage they held (ownerRetainagePaidOn): our final pay application's bill,
-- paid on the day its payments reach its amount, or on its last payment's day once it is marked paid for less
-- (billMoney in src/lib/gc/ownerBillingRows.ts, word for word; Owner Billing keeps the two equal). Null: not yet.
CREATE OR REPLACE FUNCTION public.gc_owner_retainage_paid_on(p_project_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bill AS (
    SELECT i.id, i.amount, i.status
    FROM public.gc_owner_pay_apps a JOIN public.jobs_ledger_invoices i ON i.id = a.invoice_id
    WHERE a.project_id = p_project_id AND a.final
    ORDER BY a.number DESC LIMIT 1
  ),
  paid AS (
    SELECT p.paid_on, sum(p.amount) OVER (ORDER BY p.paid_on ROWS UNBOUNDED PRECEDING) AS so_far
    FROM public.jobs_ledger_payments p JOIN bill b ON p.invoice_id = b.id
    WHERE p.paid_on IS NOT NULL
  )
  SELECT coalesce(
    (SELECT min(p.paid_on) FROM paid p CROSS JOIN bill b WHERE p.so_far >= b.amount - 0.005),
    (SELECT max(p.paid_on) FROM paid p CROSS JOIN bill b WHERE b.status = 'paid')
  )
$$;

-- Accept a trade's work (acceptWork): once every line is billed, and while nothing on its punch list waits to be
-- fixed or checked (punchClear: no item on the trade without its check). Not twice.
CREATE OR REPLACE FUNCTION public.gc_accept_work(p_package_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_left integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_sow_all_billed(v_sow.id) THEN
    RAISE EXCEPTION 'Accept the work once every line is billed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_left FROM public.gc_punch_items WHERE package_id = p_package_id AND checked_on IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'Their punch list has % % to fix or check first.', v_left, CASE WHEN v_left = 1 THEN 'item' ELSE 'items' END USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_sows SET accepted_on = public.app_today() WHERE id = v_sow.id;
  RETURN public.app_today();
END;
$$;

-- A final pay application (tradeSendFinalPayApp): the retainage we hold, with the conditional final release of lien.
-- Its gross is none, its retainage the release taken back, its net the release. The rules both ways in share it:
-- every line billed, the work accepted, no release asked yet, no draw waiting, and retainage held. With no waiver
-- owed, it keeps the promise of their closeout papers. Returns the draw, or raises its key and words.
CREATE OR REPLACE FUNCTION public.gc_final_pay_app_ask(p_sow_id uuid, p jsonb, p_recorded_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_project uuid;
  v_period date;
  v_signed_by text := btrim(coalesce(p->>'signedBy', ''));
  v_held numeric;
  v_number integer;
  v_id uuid;
BEGIN
  -- One of ours records it as themselves; the portal (the service role, no one signed in) records no one.
  IF auth.uid() IS DISTINCT FROM p_recorded_by THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Record it as yourself.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = p_sow_id FOR UPDATE;
  SELECT project_id INTO v_project FROM public.gc_trade_packages WHERE id = v_sow.package_id;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND final AND status <> 'sent_back') THEN
    RAISE EXCEPTION 'finalSent' USING ERRCODE = 'P0001', DETAIL = 'The final pay application went already.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND status = 'requested') THEN
    RAISE EXCEPTION 'drawWaiting' USING ERRCODE = 'P0001', DETAIL = 'The last pay application is still with us.';
  END IF;
  IF NOT public.gc_sow_all_billed(p_sow_id) OR v_sow.accepted_on IS NULL THEN
    RAISE EXCEPTION 'finalNotYet' USING ERRCODE = 'P0001', DETAIL = 'The final pay application opens once every line is billed and the work is accepted.';
  END IF;
  v_held := public.gc_retainage_held(p_sow_id);
  IF v_held <= 0 THEN
    RAISE EXCEPTION 'nothingToBill' USING ERRCODE = 'P0001', DETAIL = 'No retainage is held to pay back.';
  END IF;
  BEGIN
    v_period := nullif(btrim(coalesce(p->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The pay application needs its period.';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the name of who signs it.';
  END IF;
  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = p_sow_id AND status <> 'sent_back';
  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, final, period_to, address, license, signed_by, signed_title, signed_on, file_name, drive_url, recorded_by)
  VALUES (
    p_sow_id, v_number, public.app_today(), 0, -v_held, v_held, true,
    v_period, btrim(coalesce(p->>'address', '')), btrim(coalesce(p->>'license', '')), v_signed_by,
    btrim(coalesce(p->>'signedTitle', '')), public.app_today(),
    nullif(btrim(coalesce(p->>'fileName', '')), ''), nullif(btrim(coalesce(p->>'driveUrl', '')), ''), p_recorded_by
  )
  RETURNING id INTO v_id;
  IF NOT EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND status = 'paid' AND waiver = 'conditional') THEN
    PERFORM public.gc_keep_promises(v_sow.company_id, 'closeout', v_project, v_sow.package_id, public.app_today());
  END IF;
  RETURN v_id;
END;
$$;

-- The trade's final pay application from its portal: the company on its statement of work, on a job being built.
CREATE OR REPLACE FUNCTION public.gc_trade_final_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  SELECT g.stage INTO v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_stage IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can send its pay application.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Pay applications open once we are building the job.';
  END IF;
  RETURN public.gc_final_pay_app_ask(v_sow.id, p_app, NULL);
END;
$$;

-- A final pay application that came by email or on paper (new beside the prototype, as U6a's came-in is), in the
-- office's words.
CREATE OR REPLACE FUNCTION public.gc_final_pay_app_came_in(p_package_id uuid, p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_detail text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT g.stage INTO v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Pay applications are for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    RETURN public.gc_final_pay_app_ask(v_sow.id, p, v_uid);
  EXCEPTION WHEN raise_exception THEN
    -- The shared rules' keys, in the office's words.
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RAISE EXCEPTION '%', CASE SQLERRM
      WHEN 'finalSent' THEN 'Their final pay application is in already.'
      WHEN 'drawWaiting' THEN 'A pay application is waiting on us. Approve it or send it back first.'
      WHEN 'finalNotYet' THEN 'The final pay application comes once every line is billed and we accept the work.'
      WHEN 'nothingToBill' THEN 'We hold no retainage on this trade to pay back.'
      WHEN 'badRequest' THEN 'Say the day the pay application runs to.'
      WHEN 'nameNeeded' THEN 'Say who signed it.'
      ELSE coalesce(nullif(v_detail, ''), SQLERRM) END USING ERRCODE = 'P0001';
  END;
END;
$$;

-- Approve the retainage release (approveRetainage): 10 days after the customer pays us ours
-- (TRADE_RETAINAGE_WAIT_DAYS, tradeCloseout's canPay).
CREATE OR REPLACE FUNCTION public.gc_approve_retainage(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_project uuid;
  v_paid date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v.final THEN
    RAISE EXCEPTION 'Only a retainage release is approved here.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.project_id INTO v_project FROM public.gc_sows s JOIN public.gc_trade_packages k ON k.id = s.package_id WHERE s.id = v.sow_id;
  v_paid := public.gc_owner_retainage_paid_on(v_project);
  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'The customer has not paid us our retainage yet.' USING ERRCODE = 'P0001';
  END IF;
  IF public.app_today() < v_paid + 10 THEN
    RAISE EXCEPTION 'We pay their retainage from %, 10 days after the customer paid us ours.', to_char(v_paid + 10, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'approved', approved_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- A change the trade signed on paper or by email (new beside the prototype, the office's twin of gc_trade_sign_change, as
-- the pay application's and the waiver's came-in presses are): the same line on their statement of work for what the
-- change costs us, a credit counted as done at once, and who of ours recorded it with the file it came as.
CREATE OR REPLACE FUNCTION public.gc_trade_change_signed_in(p_change_order_id uuid, p_file_name text DEFAULT NULL, p_drive_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_send public.gc_change_order_trade_sends%ROWTYPE;
  v_sow public.gc_sows%ROWTYPE;
  co public.gc_change_orders%ROWTYPE;
  v_line uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a signature.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a signature.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_send FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Send the change to the trade first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_send.signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'They signed it already.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = v_send.sow_id;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  -- The same steps as gc_trade_sign_change: the change's line, and a credit reported done.
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id)
  VALUES (
    v_sow.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_sow_lines WHERE sow_id = v_sow.id),
    'Change order ' || co.number || ': ' || co.description,
    co.cost,
    co.id
  )
  RETURNING id INTO v_line;
  IF co.cost < 0 THEN
    INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
    VALUES (v_line, 100, public.app_today(), v_sow.company_id, v_uid);
  END IF;
  UPDATE public.gc_change_order_trade_sends
  SET signed_on = public.app_today(), sow_line_id = v_line, recorded_by = v_uid,
      file_name = nullif(btrim(coalesce(p_file_name, '')), ''), drive_url = nullif(btrim(coalesce(p_drive_url, '')), '')
  WHERE change_order_id = p_change_order_id;
  RETURN v_line;
END;
$$;

-- Close the job (closeJob): one we are building leaves Building for its own section on the board. The window offers
-- it once every trade is closed out (jobCloseout), as the prototype's reducer trusts its screen. It writes the
-- office's gc_projects, so it names the dev while Building is built; Building's door names the money roles.
CREATE OR REPLACE FUNCTION public.gc_close_job(p_project_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot close a job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot close a job.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Closing a job is a dev''s while Building is built.' USING ERRCODE = '42501';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'closed' THEN
    RAISE EXCEPTION 'This job is closed already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Only a job we are building is closed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_projects SET stage = 'closed', closed_on = public.app_today() WHERE project_id = p_project_id;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_retainage_held(uuid) IS
  'GC mode (v2.5115, Building U6c): what we hold on a trade (retainageHeldNow): the retainage on approved and paid draws, less a release once paid.';
COMMENT ON FUNCTION public.gc_sow_all_billed(uuid) IS
  'GC mode (v2.5115, Building U6c): every line of the statement of work at 100% on an approved or paid draw (workAllBilled).';
COMMENT ON FUNCTION public.gc_owner_retainage_paid_on(uuid) IS
  'GC mode (v2.5115, Building U6c): the day the customer paid our final pay application''s bill (ownerRetainagePaidOn by billMoney''s rule in src/lib/gc/ownerBillingRows.ts, kept equal with Owner Billing). Null: not yet.';
COMMENT ON FUNCTION public.gc_accept_work(uuid) IS
  'GC mode (v2.5115): accept a trade''s work (acceptWork) once every line is billed and its punch list is done (no item without its check). Not twice. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) IS
  'GC mode (v2.5115): the final pay application''s rules, shared by the trade''s and the office''s: the retainage held, once every line is billed and the work is accepted, one at a time; it keeps the closeout promise when no waiver is owed. Raises keys. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) IS
  'GC mode (v2.5115): the trade''s final pay application (tradeSendFinalPayApp): notFound, notOnTrade, sowNotSigned, jobNotBuilding, finalSent, drawWaiting, finalNotYet, nothingToBill, badRequest, nameNeeded. Service role only.';
COMMENT ON FUNCTION public.gc_final_pay_app_came_in(uuid, jsonb) IS
  'GC mode (v2.5115): record a final pay application that came by email or on paper, by the trade''s own rules, in the office''s words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_retainage(uuid) IS
  'GC mode (v2.5115): approve the retainage release (approveRetainage) 10 days after the customer paid us ours. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_change_signed_in(uuid, text, text) IS
  'GC mode (v2.5115): a change the trade signed on paper or by email, recorded by the office (the twin of gc_trade_sign_change): its line on their statement of work, a credit done at once, who recorded it and the file. Not before it was sent, nor twice. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_close_job(uuid) IS
  'GC mode (v2.5115): close a job we are building (closeJob): the stage closed and closed_on today. A dev''s while Building is built. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_retainage_held(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_retainage_held(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_sow_all_billed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_sow_all_billed(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_owner_retainage_paid_on(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_retainage_paid_on(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) TO authenticated, service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_accept_work(uuid)', 'public.gc_final_pay_app_came_in(uuid, jsonb)', 'public.gc_approve_retainage(uuid)',
    'public.gc_trade_change_signed_in(uuid, text, text)', 'public.gc_close_job(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) TO service_role';
END $$;
