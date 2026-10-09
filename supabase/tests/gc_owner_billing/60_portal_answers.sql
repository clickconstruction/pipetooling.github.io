-- The customer's own presses (GC mode, Owner Billing's O7c): gc_answer_change_order restated with the portal gate. Their
-- portal's answer runs only as the service role, the office's needs a sign-in, and a decline may carry the customer's
-- reason, one short line. Presses run through RLS as a dev and an estimator and as the service role; the fixture is
-- made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends
-- with "gc_owner_billing_portal_answers PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@portal-answers.test'),
  ('00000000-0000-0000-0000-000000000ad3', 'estimator@portal-answers.test'),
  ('00000000-0000-0000-0000-000000000ad5', 'owner@portal-answers.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000ad1', 'dev@portal-answers.test', 'Answers Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000ad3', 'estimator@portal-answers.test', 'Answers Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000ad5', 'owner@portal-answers.test', 'Answers Owner', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000ac1', 'Answers Test Owner LLC', '00000000-0000-0000-0000-000000000ad5');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-000000000aa1', 'Answers test P', '00000000-0000-0000-0000-000000000ac1', '600 Test Way, San Antonio, TX 78201');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000aa1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-000000000ab1', '00000000-0000-0000-0000-000000000aa1', 'Electrical', 0);

CREATE SCHEMA gpa;
CREATE FUNCTION gpa.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gpa.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gpa.stopped(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gpa.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A change order on a line: its number, status, the day it was answered against today, how, and the reason.
CREATE FUNCTION gpa.co(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', number, status, CASE WHEN answered_on IS NULL THEN 'unanswered' WHEN answered_on = public.app_today() THEN 'today' ELSE answered_on::text END,
    coalesce(answered_how, 'no one'), coalesce(nullif(declined_note, ''), 'no reason'))
  FROM public.gc_change_orders WHERE id = p_id $$;
GRANT USAGE ON SCHEMA gpa TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gpa TO authenticated, service_role;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;

-- 0 · The migration: one answer function, five arguments, the caller's rights, for the signed in and the service role.
SELECT gpa.same('one gc_answer_change_order, SECURITY INVOKER, for the signed in and the service role, not anon',
  (SELECT count(*) || ' ' || bool_and(NOT prosecdef)::text || ' ' || min(pronargs)::text FROM pg_proc WHERE proname = 'gc_answer_change_order') || ' ' ||
  has_function_privilege('authenticated', 'public.gc_answer_change_order(uuid, boolean, date, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('service_role', 'public.gc_answer_change_order(uuid, boolean, date, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_answer_change_order(uuid, boolean, date, text, text)', 'EXECUTE')::text,
  '1 true 5 true true false');
SELECT gpa.same('the reason''s column: empty to start, one short line',
  (SELECT column_default FROM information_schema.columns WHERE table_name = 'gc_change_orders' AND column_name = 'declined_note') || ' ' ||
  (SELECT count(*)::text FROM pg_constraint WHERE conname = 'gc_change_orders_declined_note_short'),
  ''''''::text || '::text 1');

-- 1 · As the dev: three change orders sent to the customer today.
SELECT gpa.as_user('00000000-0000-0000-0000-000000000ad1');
SET LOCAL ROLE authenticated;
INSERT INTO ids SELECT 'co1', public.gc_draft_change_order('00000000-0000-0000-0000-000000000aa1',
  '{"description": "Answers test: a floor box at the lobby", "reason": "owner", "cost": 1000, "price": 1500, "packageId": "00000000-0000-0000-0000-000000000ab1"}');
INSERT INTO ids SELECT 'co2', public.gc_draft_change_order('00000000-0000-0000-0000-000000000aa1',
  '{"description": "Answers test: a second hose bibb", "reason": "field", "cost": 600, "price": 800}');
INSERT INTO ids SELECT 'co3', public.gc_draft_change_order('00000000-0000-0000-0000-000000000aa1',
  '{"description": "Answers test: a larger water heater", "reason": "owner", "cost": 700, "price": 1000}');
SELECT public.gc_send_change_order(id, public.app_today()) FROM ids WHERE k IN ('co1', 'co2', 'co3');

-- 2 · Every refusal in its words.
SELECT gpa.refused('a signed-in user saying it came from their portal',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'portal')$q$,
  'Only the customer''s portal records an answer as theirs.');
SELECT gpa.refused('a way to answer that is neither',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'email')$q$,
  'The answer is recorded by the office or pressed in their portal.');
SELECT gpa.refused('a reason on two lines',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'office', E'Too much.\nMaybe later.')$q$,
  'Keep the reason to one short line.');
SELECT gpa.refused('a reason longer than a line',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'office', repeat('x', 301))$q$,
  'Keep the reason to one short line.');
SELECT gpa.same('nothing answered by a refusal', gpa.co((SELECT id FROM ids WHERE k = 'co1')), '1 | sent | unanswered | no one | no reason');

-- 3 · The office signs one by its old three arguments: no reason kept on a signature.
SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co2'), true, public.app_today());
SELECT gpa.same('signed at the office, the old way', gpa.co((SELECT id FROM ids WHERE k = 'co2')), '2 | signed | today | office | no reason');
SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co3'), false, public.app_today(), 'office', '   ');
SELECT gpa.same('declined at the office with no reason', gpa.co((SELECT id FROM ids WHERE k = 'co3')), '3 | declined | today | office | no reason');

-- 4 · An estimator answers nothing.
SELECT gpa.as_user('00000000-0000-0000-0000-000000000ad3');
SELECT gpa.stopped('an estimator''s answer', $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), true, public.app_today())$q$);
RESET ROLE;

-- 5 · Their portal, as the service role with no one signed in (as submit-portal-request calls it): the office's way is
-- refused, and their decline keeps its reason, trimmed.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT gpa.refused('the service role saying the office recorded it',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'office')$q$,
  'Sign in to record the customer''s answer.');
SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), false, public.app_today(), 'portal', '  Too much for this year''s budget.  ');
SELECT gpa.same('declined in their portal, with their reason', gpa.co((SELECT id FROM ids WHERE k = 'co1')), '1 | declined | today | portal | Too much for this year''s budget.');
SELECT gpa.refused('a second answer',
  $q$SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), true, public.app_today(), 'portal')$q$,
  'Change order 1 is not waiting on the customer.');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_portal_answers PASSED'; END $$;
ROLLBACK;
