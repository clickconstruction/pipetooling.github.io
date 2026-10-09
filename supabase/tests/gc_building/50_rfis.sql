-- The RFIs' presses (v2.5050, the Building lane's U5a): gc_add_rfi numbers an RFI one up from the job's last and
-- keeps the work it holds; gc_send_rfi_to_architect and gc_answer_rfi walk it; gc_rfi_change_order drafts a change
-- order from a cost answer through Owner Billing's gc_draft_change_order and links it; gc_trade_rfi_ask is the trade's
-- question from its portal, holding its next unfinished work. Each refuses in words what the prototype's reducer
-- refuses. A training account, a digital twin, a role outside Building's dev door and anyone outside the money team
-- for the change order are refused; the trade's press is the service role's only. Presses run through RLS, the
-- fixture made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on Building's
-- tables while they are built, and not the money team).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d2', 'trainee@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'twin@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d4', 'estimator@rfis.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@rfis.test', 'RFIs Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000008d2', 'trainee@rfis.test', 'RFIs Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000008d3', 'twin@rfis.test', 'RFIs Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000008d4', 'estimator@rfis.test', 'RFIs Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000008d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000008d3';

-- Three GC jobs: A being built, with Concrete awarded to Ridgeway Concrete, Steel asked of Halverson Steel and not
-- awarded, and our own Plumbing; B still bidding, its Electrical awarded to Ridgeway; C closed, its Roofing awarded
-- to Halverson. A's schedule has Concrete's footings finished and its slab starting in three days.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000008c1', 'RFIs Test Owner', '00000000-0000-0000-0000-0000000008d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'RFIs test A', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a2', 'RFIs test B', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a3', 'RFIs test C', '00000000-0000-0000-0000-0000000008c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'building', public.app_today() - 20),
  ('00000000-0000-0000-0000-0000000008a2', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000008a3', 'closed', public.app_today() - 200);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000008e1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000008e2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000008b3', '00000000-0000-0000-0000-0000000008a1', 'Plumbing', 2, true),
  ('00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-0000000008a2', 'Electrical', 0, false),
  ('00000000-0000-0000-0000-0000000008b5', '00000000-0000-0000-0000-0000000008a3', 'Roofing', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008f2', '00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008e2'),
  ('00000000-0000-0000-0000-0000000008f3', '00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008f4', '00000000-0000-0000-0000-0000000008b5', '00000000-0000-0000-0000-0000000008e2');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f1', awarded_on = public.app_today() - 30 WHERE id = '00000000-0000-0000-0000-0000000008b1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f3', awarded_on = public.app_today() - 2 WHERE id = '00000000-0000-0000-0000-0000000008b4';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f4', awarded_on = public.app_today() - 250 WHERE id = '00000000-0000-0000-0000-0000000008b5';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-0000000008b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-0000000008b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000080003', '00000000-0000-0000-0000-0000000008b2', 'Frame', 0),
  ('00000000-0000-0000-0000-000000080004', '00000000-0000-0000-0000-0000000008b4', 'Rough-in', 0);
-- The fixture draws the schedule as a plan write does (gc_schedule_bump's flag): the guard lets a plan change in no other way.
SELECT set_config('gc.schedule_plan_write', 'on', true);
INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES ('00000000-0000-0000-0000-0000000008a1', public.app_today() - 25);
INSERT INTO public.gc_schedule_activities (project_id, kind, position, scope_item_id, package_id, start, finish, actual_start, actual_finish) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'line', 0, '00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-0000000008b1', public.app_today() - 10, public.app_today() - 5, public.app_today() - 10, public.app_today() - 5),
  ('00000000-0000-0000-0000-0000000008a1', 'line', 1, '00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-0000000008b1', public.app_today() + 3, public.app_today() + 6, NULL, NULL);
SELECT set_config('gc.schedule_plan_write', '', true);

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- An RFI on job A by its number.
CREATE FUNCTION gbt.rfi(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_rfis WHERE project_id = '00000000-0000-0000-0000-0000000008a1' AND number = p_number $$;
-- An RFI as the window sends it, on job A unless `extra` says otherwise.
CREATE FUNCTION gbt.ask(question text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a1', 'question', question) || extra $$;
-- An answer as the window sends it.
CREATE FUNCTION gbt.answer(by_whom text, impact text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('text', 'Use the detail on S-102.', 'by', by_whom, 'impact', impact) || extra $$;
-- What job A's RFIs read: each one's number, trade, who asked, sheets, the work it holds, the needed days, sent,
-- the answer and the change order it started.
CREATE FUNCTION gbt.rfis() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    'RFI-' || r.number
      || ' ' || coalesce((SELECT k.trade FROM public.gc_trade_packages k WHERE k.id = r.package_id), 'ours')
      || ' by ' || coalesce((SELECT c.name FROM public.gc_companies c WHERE c.id = r.asked_by_company_id), 'us')
      || ' sheets ' || coalesce(nullif(array_to_string(r.sheets, ','), ''), '-')
      || ' holds ' || coalesce((SELECT string_agg(i.label, ',' ORDER BY i.position) FROM public.gc_rfi_holds h JOIN public.gc_scope_items i ON i.id = h.scope_item_id WHERE h.rfi_id = r.id), '-')
      || ' needed ' || r.needed_days
      || CASE WHEN r.sent_to_architect_on IS NOT NULL THEN ' sent' ELSE '' END
      || CASE WHEN r.answered_on IS NOT NULL THEN ' answered ' || r.answered_by || ':' || r.impact || ':' || r.cost || ':' || r.days ELSE '' END
      || coalesce(' co ' || (SELECT co.number FROM public.gc_change_orders co WHERE co.id = r.change_order_id), ''),
    E'\n' ORDER BY r.number)
  FROM public.gc_rfis r WHERE r.project_id = '00000000-0000-0000-0000-0000000008a1' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses for signed-in callers, the trade's for the
-- service role only.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_add_rfi', 'gc_send_rfi_to_architect', 'gc_answer_rfi', 'gc_rfi_change_order', 'gc_trade_rfi_ask')),
  'gc_add_rfi:false,gc_answer_rfi:false,gc_rfi_change_order:false,gc_send_rfi_to_architect:false,gc_trade_rfi_ask:false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_add_rfi(jsonb)', 'public.gc_send_rfi_to_architect(uuid, uuid)', 'public.gc_answer_rfi(uuid, jsonb)', 'public.gc_rfi_change_order(uuid, text, numeric)', 'public.gc_trade_rfi_ask(uuid, uuid, text, text[])']) f),
  'public.gc_add_rfi(jsonb):false/true/true,public.gc_send_rfi_to_architect(uuid, uuid):false/true/true,public.gc_answer_rfi(uuid, jsonb):false/true/true,public.gc_rfi_change_order(uuid, text, numeric):false/true/true,public.gc_trade_rfi_ask(uuid, uuid, text, text[]):false/false/true');
SELECT gbt.same('the link to the change order is new, one per change order, and only on a cost answer',
  (SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.gc_rfis'::regclass AND conname IN ('gc_rfis_change_order_from_cost', 'gc_rfis_change_order_id_fkey'))
    || ' ' || (SELECT count(*) FROM pg_indexes WHERE indexname = 'gc_rfis_change_order_once'),
  'gc_rfis_change_order_from_cost,gc_rfis_change_order_id_fkey 1');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;

-- Two RFIs: Ridgeway's by phone on Concrete, with its sheets and the work it holds, and our own with nothing held.
SELECT public.gc_add_rfi(gbt.ask(' Which slab thickness at grid C? ', jsonb_build_object(
  'packageId', '00000000-0000-0000-0000-0000000008b1', 'askedByCompanyId', '00000000-0000-0000-0000-0000000008e1',
  'sheets', jsonb_build_array(' S-101 ', '', 'S-102'),
  'holds', jsonb_build_array('00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-000000080002'),
  'neededDays', 5)));
SELECT public.gc_add_rfi(gbt.ask('Where does the mop sink drain?', jsonb_build_object('neededDays', -1)));
SELECT gbt.same('numbered one up, with their trade, who asked, sheets, holds and days', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5\nRFI-2 ours by us sheets - holds - needed 3');
SELECT gbt.same('what a new RFI keeps', (SELECT question || ' | ' || (asked_on - public.app_today()) || ' | ' || (recorded_by = '00000000-0000-0000-0000-0000000008d1') FROM public.gc_rfis WHERE id = gbt.rfi(1)),
  'Which slab thickness at grid C? | 0 | true');

-- The refusals of a new RFI, in words.
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a2')))$s$, 'An RFI is for a job that is ours');
SELECT gbt.refused('a closed job', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a3')))$s$, 'This job is closed');
SELECT gbt.refused('a blank question', $s$SELECT public.gc_add_rfi(gbt.ask('   '))$s$, 'Type the question first');
SELECT gbt.refused('another job''s trade', $s$SELECT public.gc_add_rfi(gbt.ask('Panel location?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b4')))$s$, 'That trade is not on this job');
SELECT gbt.refused('a company not awarded the trade', $s$SELECT public.gc_add_rfi(gbt.ask('Pour sequence?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b1', 'askedByCompanyId', '00000000-0000-0000-0000-0000000008e2')))$s$, 'must be the one we awarded this trade');
SELECT gbt.refused('a company with no trade named', $s$SELECT public.gc_add_rfi(gbt.ask('Pour sequence?', jsonb_build_object('askedByCompanyId', '00000000-0000-0000-0000-0000000008e1')))$s$, 'must be the one we awarded this trade');
SELECT gbt.refused('a hold on another job''s work', $s$SELECT public.gc_add_rfi(gbt.ask('Panel height?', jsonb_build_object('holds', jsonb_build_array('00000000-0000-0000-0000-000000080004'))))$s$, 'holds only this job');
SELECT gbt.refused('no job named', $s$SELECT public.gc_add_rfi(jsonb_build_object('question', 'Panel height?'))$s$, 'Which job the RFI is for is missing');
SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_add_rfi(gbt.ask('Panel height?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008ff')))$s$, 'No GC project with that id');

-- Sent and answered: the architect answers only what went to them; we can answer our own any time.
SELECT gbt.refused('the architect''s answer before it went to them', $s$SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('architect', 'plans'))$s$, 'The architect answers only what went to them');
SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('us', 'plans', jsonb_build_object('cost', 50, 'days', 1)));
SELECT gbt.refused('an answer twice', $s$SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('us', 'none'))$s$, 'It is answered already');
SELECT gbt.refused('a send once answered', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(2))$s$, 'It is answered already');
SELECT gbt.same('sent another way, today', (public.gc_send_rfi_to_architect(gbt.rfi(1)) - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(1))$s$, 'It went to the architect already');
SELECT gbt.refused('a blank answer', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'none', jsonb_build_object('text', ' ')))$s$, 'Type the answer first');
SELECT gbt.refused('an answer by someone unknown', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('owner', 'none'))$s$, 'Say who answered, the architect or us');
SELECT gbt.refused('an impact the register does not know', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'maybe'))$s$, 'Pick what it changes');
SELECT gbt.refused('a cost that is not a number', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 'lots')))$s$, 'The cost and the days must be numbers');
SELECT gbt.refused('a cost answer with neither', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 0, 'days', 0)))$s$, 'A cost answer needs a cost or days');
SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 3800.4, 'days', 2)));
SELECT gbt.same('the answers as kept: a plans answer keeps no cost', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5 sent answered architect:cost:3800:2\nRFI-2 ours by us sheets - holds - needed 3 answered us:plans:0:0');

-- The change order a cost answer starts, through Owner Billing's own draft.
SELECT gbt.refused('a plans answer', $s$SELECT public.gc_rfi_change_order(gbt.rfi(2), 'RFI-002: drain', 100)$s$, 'Only an answer that adds cost starts a change order');
SELECT gbt.refused('no price', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: slab', NULL)$s$, 'Type what it adds to their price');
SELECT gbt.refused('no words', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), '  ', 4180)$s$, 'Say what is changing');
SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: Pour the slab 6 in. thick (S-101, S-102)', 4180);
SELECT gbt.same('the draft it made, and the link', (SELECT co.number || ' ' || co.status || ' ' || co.reason || ' ' || co.cost || ' ' || co.price || ' ' || co.days || ' ' || (co.package_id = '00000000-0000-0000-0000-0000000008b1') || ' ' || co.description FROM public.gc_change_orders co JOIN public.gc_rfis r ON r.change_order_id = co.id WHERE r.id = gbt.rfi(1)),
  '1 draft plans 3800 4180 2 true RFI-001: Pour the slab 6 in. thick (S-101, S-102)');
SELECT gbt.refused('a second change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: again', 4180)$s$, 'It started a change order already');
SELECT public.gc_add_rfi(gbt.ask('Can we skip the vapor barrier?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b1')));
SELECT public.gc_answer_rfi(gbt.rfi(3), gbt.answer('us', 'cost', jsonb_build_object('days', 4)));
SELECT gbt.refused('an answer that adds days only', $s$SELECT public.gc_rfi_change_order(gbt.rfi(3), 'RFI-003: barrier', 0)$s$, 'This answer adds days only. Ask for the days on the schedule instead');
-- A deleted draft clears the link, so the answer can start another.
RESET ROLE;
DELETE FROM public.gc_change_orders WHERE id = (SELECT change_order_id FROM public.gc_rfis WHERE id = gbt.rfi(1));
SET LOCAL ROLE authenticated;
SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: Pour the slab 6 in. thick (S-101, S-102)', 4180);
SELECT gbt.same('a new draft after the old one went', (SELECT co.number FROM public.gc_change_orders co JOIN public.gc_rfis r ON r.change_order_id = co.id WHERE r.id = gbt.rfi(1))::text, '1');

-- The trade's question from its portal, as the service role. A refusal is a key and its reason.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008ff', 'Pour sequence?')$s$, 'notFound', 'No trade with that id.');
SELECT gbt.trade_refused('another company''s trade', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b1', 'Pour sequence?')$s$, 'notOnTrade', 'Only the company we awarded this trade can ask about its work.');
SELECT gbt.trade_refused('a trade not awarded', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b2', 'Frame size?')$s$, 'notOnTrade', 'Only the company we awarded this trade can ask about its work.');
SELECT gbt.trade_refused('a job still bidding', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b4', 'Panel location?')$s$, 'jobNotBuilding', 'Questions open once we are building the job.');
SELECT gbt.trade_refused('a closed job', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b5', 'Flashing?')$s$, 'jobNotBuilding', 'Questions open once we are building the job.');
SELECT gbt.trade_refused('no question', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', '  ')$s$, 'questionNeeded', 'Type the question first.');
SELECT gbt.trade_refused('a question too long', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', repeat('x', 2001))$s$, 'tooLong', 'Keep the question under 2,000 characters.');
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Control joints at 12 ft?', ARRAY['S-201', ' ']);
RESET ROLE;
-- Once the slab is under way too, the trade's question holds the work under way.
SELECT set_config('gc.schedule_plan_write', 'on', true);
UPDATE public.gc_schedule_activities SET start = public.app_today() - 1 WHERE scope_item_id = '00000000-0000-0000-0000-000000080002';
SELECT set_config('gc.schedule_plan_write', '', true);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Finish on the slab?');
RESET ROLE;
-- With all its work finished, it holds nothing.
UPDATE public.gc_schedule_activities SET actual_start = public.app_today() - 1, actual_finish = public.app_today() WHERE scope_item_id = '00000000-0000-0000-0000-000000080002';
SET LOCAL ROLE service_role;
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Cure time?');
RESET ROLE;
SELECT gbt.same('the trade''s questions hold its next unfinished work, the work under way, then nothing', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5 sent answered architect:cost:3800:2 co 1\nRFI-2 ours by us sheets - holds - needed 3 answered us:plans:0:0\nRFI-3 Concrete by us sheets - holds - needed 3 answered us:cost:0:4\nRFI-4 Concrete by Ridgeway Concrete sheets S-201 holds Slab needed 3\nRFI-5 Concrete by Ridgeway Concrete sheets - holds Slab needed 3\nRFI-6 Concrete by Ridgeway Concrete sheets - holds - needed 3');
SELECT gbt.same('a trade''s question names no one of ours', (SELECT count(*) FROM public.gc_rfis WHERE number >= 4 AND recorded_by IS NOT NULL)::text, '0');

-- Who may not.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'A training account cannot record an RFI');
SELECT gbt.refused('a training account starts a change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'x', 1)$s$, 'A training account cannot start a change order');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin records', $s$SELECT public.gc_answer_rfi(gbt.rfi(4), gbt.answer('us', 'none'))$s$, 'A digital twin cannot record an RFI');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d4');
SET LOCAL ROLE authenticated;
-- An estimator reads the job but neither adds nor sees an RFI, and is not the money team.
SELECT gbt.refused('an estimator records, outside Building''s dev door', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'row-level security');
SELECT gbt.refused('an estimator sends, outside the door', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(4))$s$, 'No RFI with that id');
SELECT gbt.refused('an estimator starts a change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'x', 1)$s$, 'Only the money team starts a change order');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Q?')$s$, 'permission denied');
RESET ROLE;
SELECT gbt.same('nobody but the dev and the trade wrote an RFI', (SELECT count(*) FROM public.gc_rfis WHERE project_id = '00000000-0000-0000-0000-0000000008a1')::text, '6');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
