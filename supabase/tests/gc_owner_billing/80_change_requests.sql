-- A trade's ask for a change, answered by the office (GC mode, Owner Billing's O3b): gc_draft_change_order_from_request
-- and gc_turn_down_change_request through RLS as a dev, the controller, an estimator, a dev in training mode and a
-- digital twin. The asks are made the trade's way, as the service role through gc_trade_ask_change (P4a). The fixture
-- is made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion;
-- ends with "gc_owner_billing_change_requests PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@change-requests.test'),
  ('00000000-0000-0000-0000-000000000ed2', 'controller@change-requests.test'),
  ('00000000-0000-0000-0000-000000000ed3', 'estimator@change-requests.test'),
  ('00000000-0000-0000-0000-000000000ed4', 'trainee@change-requests.test'),
  ('00000000-0000-0000-0000-000000000ed5', 'twin@change-requests.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@change-requests.test', 'Requests Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000ed2', 'controller@change-requests.test', 'Requests Controller', 'controller'),
  ('00000000-0000-0000-0000-000000000ed3', 'estimator@change-requests.test', 'Requests Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000ed4', 'trainee@change-requests.test', 'Requests Trainee', 'dev'),
  ('00000000-0000-0000-0000-000000000ed5', 'twin@change-requests.test', 'Requests Twin', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-000000000ed4';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-000000000ed5';

-- The shop, building: Drywall awarded to Iron Horse and signed, Paint awarded to Brushstroke and signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-000000000ec1', 'Requests Test Owner', '00000000-0000-0000-0000-000000000ed1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-000000000ea1', 'Requests test shop', '00000000-0000-0000-0000-000000000ec1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000ea1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ea1', 'Drywall', 0, 50000, false),
  ('00000000-0000-0000-0000-000000000eb2', '00000000-0000-0000-0000-000000000ea1', 'Paint', 1, 15000, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000e11', 'Iron Horse Drywall', '{Drywall}'),
  ('00000000-0000-0000-0000-000000000e12', 'Brushstroke Paint', '{Paint}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-000000000e21', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000e11', 'bid'),
  ('00000000-0000-0000-0000-000000000e22', '00000000-0000-0000-0000-000000000eb2', '00000000-0000-0000-0000-000000000e12', 'bid');
-- The awards and their statements of work, as gc_award writes them together.
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000e21', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-000000000eb1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-000000000e22', awarded_on = DATE '2026-10-01' WHERE id = '00000000-0000-0000-0000-000000000eb2';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000000e31', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000e21', '00000000-0000-0000-0000-000000000e11', 'signed', 48000, DATE '2026-10-01', DATE '2026-10-02'),
  ('00000000-0000-0000-0000-000000000e32', '00000000-0000-0000-0000-000000000eb2', '00000000-0000-0000-0000-000000000e22', '00000000-0000-0000-0000-000000000e12', 'signed', 12000, DATE '2026-10-01', DATE '2026-10-02');

CREATE SCHEMA gcr;
CREATE FUNCTION gcr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A press refused in its words and its code. Its writes go with the refusal (a subtransaction).
CREATE FUNCTION gcr.refused(label text, stmt text, want text, want_code text DEFAULT 'P0001') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want OR SQLSTATE IS DISTINCT FROM want_code THEN
      RAISE EXCEPTION '% was refused for another reason: % (%)', label, SQLERRM, SQLSTATE;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gcr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gcr.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
CREATE FUNCTION gcr.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- An ask as it stands: its change order's number and status, or its turn-down's day against today and its words.
CREATE FUNCTION gcr.ask(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN r.change_order_id IS NOT NULL THEN 'change order ' || c.number || ' ' || c.status
    WHEN r.turned_down_on IS NOT NULL THEN 'turned down ' || CASE WHEN r.turned_down_on = public.app_today() THEN 'today' ELSE r.turned_down_on::text END || ' [' || r.turned_down_note || ']'
    ELSE 'asked' END
  FROM public.gc_trade_change_requests r LEFT JOIN public.gc_change_orders c ON c.id = r.change_order_id
  WHERE r.id = p_id $$;
-- A change order as the customer would read it: number, status, reason, trade, cost, price, days and words.
CREATE FUNCTION gcr.co(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', c.number, c.status, c.reason, coalesce(k.trade, 'ours'), c.cost, c.price, c.days, c.schedule_words, c.description)
  FROM public.gc_change_orders c LEFT JOIN public.gc_trade_packages k ON k.id = c.package_id WHERE c.id = p_id $$;
GRANT USAGE ON SCHEMA gcr TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcr TO authenticated, service_role;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;
CREATE FUNCTION gcr.id(p_k text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM ids WHERE k = p_k $$;
GRANT EXECUTE ON FUNCTION gcr.id(text) TO authenticated, service_role;

-- 0 · The migration: two presses with the caller's rights, for the signed in, not anon.
SELECT gcr.same('two presses, SECURITY INVOKER, for the signed in and not anon',
  (SELECT count(*) || ' ' || bool_and(NOT prosecdef)::text FROM pg_proc WHERE proname IN ('gc_draft_change_order_from_request', 'gc_turn_down_change_request')) || ' ' ||
  has_function_privilege('authenticated', 'public.gc_draft_change_order_from_request(uuid, jsonb)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('authenticated', 'public.gc_turn_down_change_request(uuid, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_draft_change_order_from_request(uuid, jsonb)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_turn_down_change_request(uuid, text)', 'EXECUTE')::text,
  '2 true true true false false');

-- 1 · Iron Horse asks for three changes from its portal, the trade's way.
SELECT gcr.as_service();
SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'r1', public.gc_trade_ask_change('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000eb1',
  'Hidden rot behind the east wall of unit 3. Two sheets and blocking to replace.', 'field', 14820, 2);
INSERT INTO ids SELECT 'r2', public.gc_trade_ask_change('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000eb1',
  'The customer asked for a level 5 finish in the lobby.', 'owner', 3200, 0);
INSERT INTO ids SELECT 'r3', public.gc_trade_ask_change('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000eb1',
  'Revision 2 moved the corridor wall a foot east.', 'plans', 2400, 1);
RESET ROLE;
SELECT gcr.same('three asks, each waiting on us', (SELECT string_agg(gcr.ask(id), ', ' ORDER BY k) FROM ids), 'asked, asked, asked');

-- 2 · Who may answer: the money team, and a dev while the asks are dev only. Each refusal is said before the ask is read.
SELECT gcr.as_nobody();
SET LOCAL ROLE authenticated;
SELECT gcr.refused('no one signed in cannot make an ask a change order', format($q$SELECT public.gc_draft_change_order_from_request(%L, '{}')$q$, gcr.id('r1')), 'Sign in first.');
SELECT gcr.refused('no one signed in cannot turn an ask down', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')), 'Sign in first.');
RESET ROLE;
SELECT gcr.as_user('00000000-0000-0000-0000-000000000ed3');
SET LOCAL ROLE authenticated;
SELECT gcr.refused('an estimator cannot make an ask a change order', format($q$SELECT public.gc_draft_change_order_from_request(%L, '{}')$q$, gcr.id('r1')),
  'Only the money team answers a trade''s ask for a change.', '42501');
SELECT gcr.refused('an estimator cannot turn an ask down', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')),
  'Only the money team answers a trade''s ask for a change.', '42501');
RESET ROLE;
SELECT gcr.as_user('00000000-0000-0000-0000-000000000ed2');
SET LOCAL ROLE authenticated;
SELECT gcr.refused('the controller, on the money team, waits for the asks'' door', format($q$SELECT public.gc_draft_change_order_from_request(%L, '{}')$q$, gcr.id('r1')),
  'Only a dev answers a trade''s ask while GC mode is built.', '42501');
SELECT gcr.refused('the controller cannot turn an ask down yet either', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')),
  'Only a dev answers a trade''s ask while GC mode is built.', '42501');
RESET ROLE;
SELECT gcr.as_user('00000000-0000-0000-0000-000000000ed4');
SET LOCAL ROLE authenticated;
SELECT gcr.refused('a dev in training mode cannot make an ask a change order', format($q$SELECT public.gc_draft_change_order_from_request(%L, '{}')$q$, gcr.id('r1')),
  'A training account cannot answer a trade''s ask.', '42501');
SELECT gcr.refused('a dev in training mode cannot turn an ask down', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')),
  'A training account cannot answer a trade''s ask.', '42501');
RESET ROLE;
SELECT gcr.as_user('00000000-0000-0000-0000-000000000ed5');
SET LOCAL ROLE authenticated;
SELECT gcr.refused('a digital twin cannot make an ask a change order', format($q$SELECT public.gc_draft_change_order_from_request(%L, '{}')$q$, gcr.id('r1')),
  'A digital twin cannot answer a trade''s ask.', '42501');
SELECT gcr.refused('a digital twin cannot turn an ask down', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')),
  'A digital twin cannot answer a trade''s ask.', '42501');
RESET ROLE;
SELECT gcr.same('no refusal touched an ask or made a change order', (
  SELECT string_agg(gcr.ask(id), ', ' ORDER BY k) || ' · ' || (SELECT count(*) FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-000000000ea1') FROM ids),
  'asked, asked, asked · 0');

-- 3 · As a dev: the ask becomes a change order on its own trade and reason, at what the office confirmed.
SELECT gcr.as_user('00000000-0000-0000-0000-000000000ed1');
SET LOCAL ROLE authenticated;
SELECT gcr.refused('an ask that is not there', $q$SELECT public.gc_draft_change_order_from_request('00000000-0000-0000-0000-000000000999', '{}')$q$,
  'No change request with that id.');
SELECT gcr.refused('a draft on another trade', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Rot repair", "cost": 14820, "price": 16302, "days": 2, "packageId": "00000000-0000-0000-0000-000000000eb2"}')$q$, gcr.id('r1')),
  'A trade''s ask stays on its own trade.');
SELECT gcr.refused('a draft as our own work', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Rot repair", "cost": 14820, "price": 16302, "days": 2, "packageId": null}')$q$, gcr.id('r1')),
  'A trade''s ask stays on its own trade.');
SELECT gcr.refused('a draft with another reason', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Rot repair", "cost": 14820, "price": 16302, "days": 2, "reason": "owner"}')$q$, gcr.id('r1')),
  'A trade''s ask keeps the reason it gave.');
SELECT gcr.refused('a draft with no words, in gc_draft_change_order''s own', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "  ", "cost": 14820, "price": 16302, "days": 2}')$q$, gcr.id('r1')),
  'Say what is changing.');
SELECT gcr.refused('a draft with no cost', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Rot repair", "cost": 0, "price": 16302, "days": 2}')$q$, gcr.id('r1')),
  'Type what it costs us. A credit is a cost below zero.');
SELECT gcr.refused('a draft with days below zero', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Rot repair", "cost": 14820, "price": 16302, "days": -1}')$q$, gcr.id('r1')),
  'The days it adds cannot be below zero.');
SELECT gcr.same('no refused draft touched the ask', gcr.ask(gcr.id('r1')), 'asked');
-- The trade and the reason it names in agreement pass; the office's words and price stand over the ask's.
INSERT INTO ids SELECT 'co1', public.gc_draft_change_order_from_request(gcr.id('r1'), jsonb_build_object(
  'description', 'Replace rotted drywall and blocking behind the east wall of unit 3', 'cost', 14820, 'price', 16302, 'days', 2,
  'packageId', '00000000-0000-0000-0000-000000000eb1', 'reason', 'field'));
SELECT gcr.same('change order 1, a draft on Drywall for a field condition, at the confirmed cost, price and days', gcr.co(gcr.id('co1')),
  '1 | draft | field | Drywall | 14820 | 16302 | 2 | +2 days | Replace rotted drywall and blocking behind the east wall of unit 3');
SELECT gcr.same('the ask points at its change order', gcr.ask(gcr.id('r1')), 'change order 1 draft');
SELECT gcr.refused('an ask becomes one change order', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Again", "cost": 1, "price": 1}')$q$, gcr.id('r1')),
  'It became change order 1 already.');
SELECT gcr.refused('an ask made a change order is not turned down', format($q$SELECT public.gc_turn_down_change_request(%L, 'No.')$q$, gcr.id('r1')),
  'It became change order 1 already.');

-- 4 · As a dev: turning an ask down says why, in words the company reads.
SELECT gcr.refused('a turn-down with no reason', format($q$SELECT public.gc_turn_down_change_request(%L, '   ')$q$, gcr.id('r2')), 'Say why, for the company.');
SELECT gcr.refused('a turn-down with no reason at all', format($q$SELECT public.gc_turn_down_change_request(%L, NULL)$q$, gcr.id('r2')), 'Say why, for the company.');
SELECT gcr.refused('a reason past 2,000 characters', format($q$SELECT public.gc_turn_down_change_request(%L, %L)$q$, gcr.id('r2'), repeat('x', 2001)),
  'Keep the reason under 2,000 characters.');
SELECT public.gc_turn_down_change_request(gcr.id('r2'), '  The lobby finish was in the bid: sheet A-201.  ');
SELECT gcr.same('turned down today, with its reason trimmed', gcr.ask(gcr.id('r2')), 'turned down today [The lobby finish was in the bid: sheet A-201.]');
SELECT gcr.refused('an ask is turned down once', format($q$SELECT public.gc_turn_down_change_request(%L, 'Still no.')$q$, gcr.id('r2')),
  'It was turned down on ' || to_char(public.app_today(), 'Mon FMDD') || '.');
SELECT gcr.refused('an ask turned down is not made a change order', format($q$SELECT public.gc_draft_change_order_from_request(%L,
  '{"description": "Level 5 finish", "cost": 3200, "price": 3520}')$q$, gcr.id('r2')),
  'It was turned down on ' || to_char(public.app_today(), 'Mon FMDD') || '.');

-- 5 · The link: deleting the draft frees the ask to be drafted again; once the change order went, the link stays.
DELETE FROM public.gc_change_orders WHERE id = gcr.id('co1');
SELECT gcr.same('deleting the draft frees the ask', gcr.ask(gcr.id('r1')), 'asked');
INSERT INTO ids SELECT 'co2', public.gc_draft_change_order_from_request(gcr.id('r1'), '{"description": "Rot repair, unit 3", "cost": 14820, "price": 16302, "days": 2}');
SELECT gcr.same('drafted again, as the job''s change order 1', gcr.ask(gcr.id('r1')), 'change order 1 draft');
SELECT public.gc_send_change_order(gcr.id('co2'), public.app_today());
SELECT gcr.same('sent to the customer', gcr.ask(gcr.id('r1')), 'change order 1 sent');
SELECT gcr.refused('a change order that went cannot be deleted', format($q$DELETE FROM public.gc_change_orders WHERE id = %L$q$, gcr.id('co2')),
  'Change order 1 went to the customer, so it stays on the record.');
SELECT gcr.same('so its ask keeps its link', gcr.ask(gcr.id('r1')), 'change order 1 sent');
-- r3, with its days and the plans as its reason, carries both onto change order 2.
INSERT INTO ids SELECT 'co3', public.gc_draft_change_order_from_request(gcr.id('r3'), '{"description": "Move the corridor wall a foot east", "cost": 2400, "price": 2640, "days": 1}');
SELECT gcr.same('change order 2, a plan revision with its day', gcr.co(gcr.id('co3')), '2 | draft | plans | Drywall | 2400 | 2640 | 1 | +1 day | Move the corridor wall a foot east');
RESET ROLE;

SELECT gcr.same('the three asks at the end', (SELECT string_agg(gcr.ask(id), ', ' ORDER BY k) FROM ids WHERE k LIKE 'r%'),
  'change order 1 sent, turned down today [The lobby finish was in the bid: sheet A-201.], change order 2 draft');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_change_requests PASSED'; END $$;
ROLLBACK;
