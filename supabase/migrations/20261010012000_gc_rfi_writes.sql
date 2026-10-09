SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U5a (v2.5050): questions during construction (RFIs) on real data,
-- their presses, and the change order a cost answer starts. The office records an RFI with its number and the
-- work it holds, marks it sent to the architect, records the answer, and starts a change order from a cost answer;
-- a trade asks from its portal. Each refuses in words what the prototype's reducer refuses (addRfi, tradeAskRfi,
-- sendRfiToArchitect, answerRfi, draftChangeOrderFromRfi). The office's presses are SECURITY INVOKER, so RLS decides
-- who may: dev only until Building's door, and the money team for the change order, through Owner Billing's own
-- table policy and gc_draft_change_order. The change order's words and price come from the client's kernels
-- (rfiChangeOrderDescription, changeOrderPrice); this owns the RFI's state and the link. The trade's press is the
-- service role's only, and refuses with keys as the Portal's P2a verbs do. Plan: to-dos/gc-mode/mockups/building-u5.md
-- on spike/gc-mode. Tables: 20261008030000_gc_building_records. The change orders: 20261008010000 and 20261008110000.
-- The award: 20261009140000.

-- The change order a cost answer started (decision 3): the RFI keeps the link, and Owner Billing's table carries no
-- Building column. A change order is one RFI's. A deleted draft clears the link, so the answer can start another.
ALTER TABLE public.gc_rfis
  ADD COLUMN IF NOT EXISTS change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gc_rfis_change_order_once ON public.gc_rfis (change_order_id) WHERE change_order_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_rfis_change_order_from_cost' AND conrelid = 'public.gc_rfis'::regclass) THEN
    ALTER TABLE public.gc_rfis ADD CONSTRAINT gc_rfis_change_order_from_cost CHECK (change_order_id IS NULL OR impact = 'cost');
  END IF;
END $$;

COMMENT ON COLUMN public.gc_rfis.change_order_id IS
  'GC mode (v2.5050, Building U5a): the change order this RFI''s cost answer started (Rfi.changeOrderId), written by gc_rfi_change_order. Null: none yet, or its draft was deleted.';

-- Record an RFI (addRfi): its number on the job, one up from the job's last; the question and the sheets; the trade
-- it is about (null: our own work); the company that asked by phone, the one awarded that trade (null: our own
-- people); the work it holds until answered; and the days before that work the answer is needed (3 unless said).
-- Refuses a training account, a digital twin, a job we are not building, a blank question, a trade not on the job,
-- a company that is not the trade's, and a hold on work that is not this job's.
CREATE OR REPLACE FUNCTION public.gc_add_rfi(r jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_stage text;
  v_lost date;
  v_question text := btrim(coalesce(r->>'question', ''));
  v_pkg uuid;
  v_company uuid;
  v_awarded uuid;
  v_holds uuid[];
  v_needed integer := 3;
  v_number integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  v_project := nullif(btrim(coalesce(r->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which job the RFI is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'bidding' OR v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'An RFI is for a job that is ours. While we bid, ask about the plans instead.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'closed' THEN
    RAISE EXCEPTION 'This job is closed. It takes no new RFI.' USING ERRCODE = 'P0001';
  END IF;
  IF v_question = '' THEN
    RAISE EXCEPTION 'Type the question first.' USING ERRCODE = 'P0001';
  END IF;
  v_pkg := nullif(btrim(coalesce(r->>'packageId', '')), '')::uuid;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = v_project) THEN
    RAISE EXCEPTION 'That trade is not on this job.' USING ERRCODE = 'P0001';
  END IF;
  -- A trade's question by phone names the company we awarded that trade (the lead's call 5).
  v_company := nullif(btrim(coalesce(r->>'askedByCompanyId', '')), '')::uuid;
  IF v_company IS NOT NULL THEN
    SELECT i.company_id INTO v_awarded
    FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
    WHERE k.id = v_pkg;
    IF v_awarded IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'The company that asked must be the one we awarded this trade.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- The work it holds: this job's scope lines, each once (decision 2).
  v_holds := ARRAY(
    SELECT DISTINCT btrim(h)::uuid
    FROM jsonb_array_elements_text(coalesce(r->'holds', '[]'::jsonb)) h
    WHERE btrim(h) <> ''
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_holds) h(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.gc_scope_items i JOIN public.gc_trade_packages k ON k.id = i.package_id
      WHERE i.id = h.id AND k.project_id = v_project
    )
  ) THEN
    RAISE EXCEPTION 'An RFI holds only this job’s work.' USING ERRCODE = 'P0001';
  END IF;
  -- The days before the held work the answer is needed: RFI_NEEDED_DAYS unless a number of none or more is given.
  IF jsonb_typeof(r->'neededDays') = 'number' AND (r->>'neededDays')::numeric >= 0 THEN
    v_needed := round((r->>'neededDays')::numeric)::integer;
  END IF;

  -- Its number: one up from the job's last (the reducer's rule), one press at a time on a job.
  PERFORM pg_advisory_xact_lock(hashtextextended('gc_rfi_number:' || v_project::text, 0));
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_rfis WHERE project_id = v_project;

  INSERT INTO public.gc_rfis (project_id, number, question, sheets, package_id, asked_by_company_id, asked_on, needed_days)
  VALUES (
    v_project,
    v_number,
    v_question,
    ARRAY(SELECT btrim(s) FROM jsonb_array_elements_text(coalesce(r->'sheets', '[]'::jsonb)) WITH ORDINALITY AS t(s, n) WHERE btrim(s) <> '' ORDER BY n),
    v_pkg,
    v_company,
    public.app_today(),
    v_needed
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_rfi_holds (rfi_id, scope_item_id)
  SELECT v_id, h FROM unnest(v_holds) h;
  RETURN v_id;
END;
$$;

-- Sent to the architect (sendRfiToArchitect): the day it went, and the email that took it there when
-- gc-architect-email sent it. No email: we sent it another way. Not once it is sent or answered.
CREATE OR REPLACE FUNCTION public.gc_send_rfi_to_architect(p_rfi_id uuid, p_email_send_log_id uuid DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_sent date;
  v_answered date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  SELECT sent_to_architect_on, answered_on INTO v_sent, v_answered FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'It is answered already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sent IS NOT NULL THEN
    RAISE EXCEPTION 'It went to the architect already.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_rfis SET sent_to_architect_on = v_today, email_send_log_id = p_email_send_log_id WHERE id = p_rfi_id;
  RETURN v_today;
END;
$$;

-- The answer (answerRfi): its words, by the architect or by us, and what it changes: nothing, the plans, or cost and
-- days. The architect answers only what was sent to them; we can answer our own any time. A cost answer has a cost
-- or days, each whole and never below none; any other answer has neither.
CREATE OR REPLACE FUNCTION public.gc_answer_rfi(p_rfi_id uuid, a jsonb)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_sent date;
  v_answered date;
  v_text text := btrim(coalesce(a->>'text', ''));
  v_by text := btrim(coalesce(a->>'by', ''));
  v_impact text := btrim(coalesce(a->>'impact', ''));
  v_cost numeric := 0;
  v_days integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  SELECT sent_to_architect_on, answered_on INTO v_sent, v_answered FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'It is answered already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'Type the answer first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_by NOT IN ('architect', 'us') THEN
    RAISE EXCEPTION 'Say who answered, the architect or us.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact NOT IN ('none', 'plans', 'cost') THEN
    RAISE EXCEPTION 'Pick what it changes: nothing, the plans, or cost and days.' USING ERRCODE = 'P0001';
  END IF;
  IF v_by = 'architect' AND v_sent IS NULL THEN
    RAISE EXCEPTION 'The architect answers only what went to them. Send it first, or answer it as us.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact = 'cost' THEN
    BEGIN
      v_cost := greatest(0, round(coalesce((a->>'cost')::numeric, 0)));
      v_days := greatest(0, round(coalesce((a->>'days')::numeric, 0)))::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'The cost and the days must be numbers.' USING ERRCODE = 'P0001';
    END;
    IF v_cost = 0 AND v_days = 0 THEN
      RAISE EXCEPTION 'A cost answer needs a cost or days.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.gc_rfis
  SET answered_on = v_today, answer_text = v_text, answered_by = v_by, impact = v_impact, cost = v_cost, days = v_days
  WHERE id = p_rfi_id;
  RETURN v_today;
END;
$$;

-- A change order from a cost answer (draftChangeOrderFromRfi): drafted through Owner Billing's own
-- gc_draft_change_order, a plan revision on the RFI's trade at the answer's cost and days, with the RFI's link to it,
-- in one transaction. The words and the price are the client's kernels'. Only the money team starts one, even after
-- Building's door (the lead's call 4). An answer that adds days only goes through the schedule's Ask for the days
-- (G-141), since a change order drafted here has a cost (call 3).
CREATE OR REPLACE FUNCTION public.gc_rfi_change_order(p_rfi_id uuid, p_description text, p_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_pkg uuid;
  v_impact text;
  v_cost numeric;
  v_days integer;
  v_linked uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a change order.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a change order.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team starts a change order.' USING ERRCODE = '42501';
  END IF;
  SELECT project_id, package_id, impact, cost, days, change_order_id
  INTO v_project, v_pkg, v_impact, v_cost, v_days, v_linked
  FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact IS DISTINCT FROM 'cost' THEN
    RAISE EXCEPTION 'Only an answer that adds cost starts a change order.' USING ERRCODE = 'P0001';
  END IF;
  IF v_linked IS NOT NULL THEN
    RAISE EXCEPTION 'It started a change order already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_cost = 0 THEN
    RAISE EXCEPTION 'This answer adds days only. Ask for the days on the schedule instead.' USING ERRCODE = 'P0001';
  END IF;

  v_id := public.gc_draft_change_order(v_project, jsonb_build_object(
    'description', p_description,
    'reason', 'plans',
    'packageId', v_pkg,
    'cost', v_cost,
    'price', p_price,
    'days', v_days
  ));
  UPDATE public.gc_rfis SET change_order_id = v_id WHERE id = p_rfi_id;
  RETURN v_id;
END;
$$;

-- A trade asks from its portal (tradeAskRfi), on a job being built, about a trade we awarded it (portalCanAskRfi).
-- The RFI holds the trade's next work not started, or the work under way when all of it has started
-- (rfiDefaultHolds: its next unfinished bar after today, else its earliest unfinished one; unfinished is no actual
-- finish until U6 brings the trades' reports). The answer is needed 3 days before that work.
CREATE OR REPLACE FUNCTION public.gc_trade_rfi_ask(p_company_id uuid, p_package_id uuid, p_question text, p_sheets text[] DEFAULT '{}')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_company uuid;
  v_question text := btrim(coalesce(p_question, ''));
  v_hold uuid;
  v_number integer;
  v_id uuid;
BEGIN
  SELECT k.project_id, g.stage, i.company_id INTO v_project, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can ask about its work.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Questions open once we are building the job.';
  END IF;
  IF v_question = '' THEN
    RAISE EXCEPTION 'questionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the question first.';
  END IF;
  IF length(v_question) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the question under 2,000 characters.';
  END IF;

  SELECT a.scope_item_id INTO v_hold
  FROM public.gc_schedule_activities a
  WHERE a.project_id = v_project AND a.kind = 'line' AND a.package_id = p_package_id AND a.actual_finish IS NULL
  ORDER BY (a.start > public.app_today()) DESC, a.start, a.position
  LIMIT 1;

  PERFORM pg_advisory_xact_lock(hashtextextended('gc_rfi_number:' || v_project::text, 0));
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_rfis WHERE project_id = v_project;
  -- Nobody of ours typed it in: the trade's portal did (recorded_by null).
  INSERT INTO public.gc_rfis (project_id, number, question, sheets, package_id, asked_by_company_id, recorded_by, asked_on, needed_days)
  VALUES (
    v_project,
    v_number,
    v_question,
    ARRAY(SELECT btrim(s) FROM unnest(coalesce(p_sheets, '{}'::text[])) WITH ORDINALITY AS t(s, n) WHERE btrim(s) <> '' ORDER BY n),
    p_package_id,
    p_company_id,
    NULL,
    public.app_today(),
    3
  )
  RETURNING id INTO v_id;
  IF v_hold IS NOT NULL THEN
    INSERT INTO public.gc_rfi_holds (rfi_id, scope_item_id) VALUES (v_id, v_hold);
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_add_rfi(jsonb) IS
  'GC mode (v2.5050): record an RFI on a GC job that is ours (addRfi), numbered one up from the job''s last, with the scope lines it holds. Refuses a training account, a digital twin, a job bidding, lost or closed, a blank question, a trade not on the job, a company that is not the trade''s and another job''s line. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) IS
  'GC mode (v2.5050): the RFI went to the architect today, with the email that took it (gc-architect-email) or none when sent another way. Not once sent or answered. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_answer_rfi(uuid, jsonb) IS
  'GC mode (v2.5050): the RFI''s answer (answerRfi): its words, by the architect (only once sent) or us, and what it changes; a cost answer has a cost or days. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) IS
  'GC mode (v2.5050): a draft change order from a cost answer through gc_draft_change_order, a plan revision at the answer''s cost and days with the client''s words and price, and the RFI''s link to it. The money team only; days only goes through Ask for the days. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) IS
  'GC mode (v2.5050): an RFI from the trade''s portal (tradeAskRfi) by the company awarded the trade, on a job being built, holding its next unfinished work: notFound, notOnTrade, jobNotBuilding, questionNeeded, tooLong. Service role only.';

REVOKE ALL ON FUNCTION public.gc_add_rfi(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_add_rfi(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_add_rfi(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_answer_rfi(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_answer_rfi(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_answer_rfi(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) TO authenticated;

-- Only the service role: the portal's submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) TO service_role;
