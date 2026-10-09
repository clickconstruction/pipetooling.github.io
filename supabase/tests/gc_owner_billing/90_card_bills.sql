-- The customer pays a certified bill by card (GC mode, Owner Billing's O8a): their portal turns the bill to card as
-- the service role (begin, then finish once Stripe made the invoice), the 3% fee rides on the bill in fee_lines, and
-- the billing job's revenue counts it as a rider so the job never reads paid while a bill is open. The money team
-- takes a bill back to a check bill. A returned check fee on a GC bill counts too. Presses run as the service role
-- with no one signed in (as gc-card-bill calls them) and through RLS as a dev, the controller, an estimator and a dev
-- in training mode; the fixture is made as postgres; everything runs inside one transaction that rolls back. Raises on
-- the first failed assertion; ends with "gc_owner_billing_card_bills PASSED". See scripts/pgtest-gc-owner-billing.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000cd1', 'dev@card.test'),
  ('00000000-0000-0000-0000-000000000cd2', 'trainee@card.test'),
  ('00000000-0000-0000-0000-000000000cd3', 'estimator@card.test'),
  ('00000000-0000-0000-0000-000000000cd4', 'controller@card.test'),
  ('00000000-0000-0000-0000-000000000cd5', 'owner@card.test'),
  ('00000000-0000-0000-0000-000000000cd6', 'twin@card.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000cd1', 'dev@card.test', 'Card Dev', 'dev'),
  ('00000000-0000-0000-0000-000000000cd2', 'trainee@card.test', 'Card Trainee', 'dev'),
  ('00000000-0000-0000-0000-000000000cd3', 'estimator@card.test', 'Card Estimator', 'estimator'),
  ('00000000-0000-0000-0000-000000000cd4', 'controller@card.test', 'Card Controller', 'controller'),
  ('00000000-0000-0000-0000-000000000cd5', 'owner@card.test', 'Card Owner', 'master_technician'),
  ('00000000-0000-0000-0000-000000000cd6', 'twin@card.test', 'Card Twin', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-000000000cd2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-000000000cd6';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-000000000cd5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-000000000cc1', 'Card Test Owner LLC', '00000000-0000-0000-0000-000000000cd5', '{"email": "owner-ap@card.test"}');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-000000000ca1', 'Card test P', '00000000-0000-0000-0000-000000000cc1', '300 Test Way, San Antonio, TX 78201');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-000000000ca1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000ca1', 'Electrical', 0),
  ('00000000-0000-0000-0000-000000000cb2', '00000000-0000-0000-0000-000000000ca1', 'Plumbing', 1);

CREATE SCHEMA gcb;
CREATE FUNCTION gcb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gcb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gcb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION gcb.m(v numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(round(v, 2)::text, 'null') $$;
CREATE FUNCTION gcb.line(p_kind text, p_package uuid, p_label text, p_worth numeric, p_done numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_kind, 'packageId', p_package, 'changeOrderId', NULL, 'label', p_label, 'worth', p_worth, 'doneToDate', p_done, 'stored', 0) $$;
CREATE FUNCTION gcb.lines(p_elec numeric, p_plumb numeric, p_gc numeric, p_cont numeric, p_fee numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    gcb.line('trade', '00000000-0000-0000-0000-000000000cb1', 'Electrical', 60000, p_elec),
    gcb.line('trade', '00000000-0000-0000-0000-000000000cb2', 'Plumbing', 25000, p_plumb),
    gcb.line('gc', NULL, 'General conditions', 10000, p_gc),
    gcb.line('contingency', NULL, 'Contingency', 2000, p_cont),
    gcb.line('fee', NULL, 'Fee', 3000, p_fee)) $$;
-- A pay application as the window sends it, its work added up from its lines.
CREATE FUNCTION gcb.app(p_number int, p_period date, p_lines jsonb, p_due numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', false, 'periodTo', p_period, 'sentOn', p_period,
    'retainagePct', 0, 'retainageStep', NULL, 'retainage', 0, 'workToDate', w.work, 'due', p_due, 'lines', p_lines)
  FROM (SELECT sum((l ->> 'doneToDate')::numeric) AS work FROM jsonb_array_elements(p_lines) l) w $$;
-- What the checks read, whoever is signed in.
CREATE FUNCTION gcb.job() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT billing_job_id FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-000000000ca1' $$;
CREATE FUNCTION gcb.revenue() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT gcb.m(j.revenue) FROM public.jobs_ledger j WHERE j.id = gcb.job() $$;
CREATE FUNCTION gcb.left_owed() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' ', j.status, gcb.m(j.revenue - j.payments_made)) FROM public.jobs_ledger j WHERE j.id = gcb.job() $$;
-- One bill: its status, its amount, its Stripe id and mode, and its fee lines.
CREATE FUNCTION gcb.bill(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', i.status, gcb.m(i.amount), coalesce(i.stripe_invoice_id, 'no stripe'), coalesce(i.stripe_mode, 'no mode'),
    coalesce(i.external_send_channel, 'no channel'),
    coalesce((SELECT string_agg(concat_ws(' ', l ->> 'description', l ->> 'amount',
        CASE WHEN l ->> 'card_bill' = p_id::text THEN 'its card bill' WHEN l ? 'case_id' THEN 'a case' ELSE 'neither' END), '; ')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) l),
      CASE WHEN i.fee_lines IS NULL THEN 'no fee lines' ELSE 'empty fee lines' END))
  FROM public.jobs_ledger_invoices i WHERE i.id = p_id $$;
CREATE FUNCTION gcb.card(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT concat_ws(' ', c.status, gcb.m(c.base), trim_scale(c.fee_pct)::text, gcb.m(c.fee),
      coalesce(c.stripe_invoice_id, 'no stripe'), CASE WHEN c.chosen_on = public.app_today() THEN 'today' ELSE c.chosen_on::text END,
      c.chosen_how,
      CASE WHEN c.undone_on IS NULL THEN 'not undone' WHEN c.undone_on = public.app_today() THEN 'undone today' ELSE 'undone ' || c.undone_on END,
      CASE c.undone_by WHEN '00000000-0000-0000-0000-000000000cd4' THEN 'by the controller' ELSE coalesce(c.undone_by::text, 'by nobody') END)
    FROM public.gc_owner_card_bills c WHERE c.invoice_id = p_id), 'no card row') $$;
CREATE FUNCTION gcb.begun(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws(' ', p ->> 'state', p ->> 'base', p ->> 'fee_pct', p ->> 'fee', p ->> 'total', p ->> 'number', p ->> 'final',
    p ->> 'owner_pay_days', coalesce(p ->> 'hosted_invoice_url', 'no url')) $$;
GRANT USAGE ON SCHEMA gcb TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcb TO authenticated, service_role;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated, service_role;

-- 0 · The migration: the table with its policies and the fences; begin and finish for the service role only, undo
-- for the signed in and the service role, every function the caller's rights; the revenue for the service role too.
SELECT gcb.same('the card bills table: row security on, two policies of its own, the fences on it',
  (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.gc_owner_card_bills'::regclass) || ' ' ||
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_owner_card_bills' AND policyname LIKE 'gc_owner_card_bills_money_%') || ' ' ||
  ((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gc_owner_card_bills' AND permissive = 'RESTRICTIVE') > 0)::text || ' ' ||
  ((SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.gc_owner_card_bills'::regclass AND NOT tgisinternal) > 0)::text,
  'true 2 true true');
SELECT gcb.same('who runs what',
  (SELECT count(*) || ' ' || bool_and(NOT prosecdef)::text FROM pg_proc
    WHERE proname IN ('gc_card_bill_begin', 'gc_card_bill_finish', 'gc_card_bill_undo', 'job_rider_fees', 'gc_owner_billing_revenue')) || ' | ' ||
  has_function_privilege('authenticated', 'public.gc_card_bill_begin(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('service_role', 'public.gc_card_bill_begin(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('authenticated', 'public.gc_card_bill_finish(uuid, text, text, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('service_role', 'public.gc_card_bill_finish(uuid, text, text, text, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_card_bill_undo(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('authenticated', 'public.gc_card_bill_undo(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('service_role', 'public.gc_card_bill_undo(uuid)', 'EXECUTE')::text || ' | ' ||
  has_function_privilege('service_role', 'public.gc_owner_billing_revenue(uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_owner_billing_revenue(uuid)', 'EXECUTE')::text || ' | ' ||
  has_table_privilege('authenticated', 'public.gc_owner_card_bills', 'INSERT')::text || ' ' ||
  has_table_privilege('authenticated', 'public.gc_owner_card_bills', 'DELETE')::text || ' ' ||
  has_table_privilege('anon', 'public.gc_owner_card_bills', 'SELECT')::text,
  '5 true | false true false true false true true | true false | false false false');

-- 1 · As the dev: the contract signed at 100,000; three pay applications certified (42,750, 12,345.50 and 15,840), each
-- its bill on the billing job; a rate, and an interest bill of 100.
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-000000000ca1', DATE '2026-09-01',
  '{"00000000-0000-0000-0000-000000000cb1": 60000, "00000000-0000-0000-0000-000000000cb2": 25000, "gc": 10000, "contingency": 2000, "fee": 3000}');
INSERT INTO ids SELECT 'app1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ca1', gcb.app(1, DATE '2026-09-05', gcb.lines(30000, 10000, 2000, 0, 750), 42750));
INSERT INTO ids SELECT 'bill1', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 42750, DATE '2026-09-08', '');
INSERT INTO ids SELECT 'app2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ca1', gcb.app(2, DATE '2026-09-12', gcb.lines(40000, 11345.50, 2750, 0, 1000), 12345.50));
INSERT INTO ids SELECT 'bill2', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app2'), 12345.50, DATE '2026-09-15', '');
INSERT INTO ids SELECT 'app3', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ca1', gcb.app(3, DATE '2026-09-19', gcb.lines(50000, 15000, 4435.50, 0, 1500), 15840));
INSERT INTO ids SELECT 'bill3', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app3'), 15840, DATE '2026-09-22', '');
UPDATE public.gc_projects SET owner_late_interest_pct_per_month = 1.5, owner_pay_days = 30 WHERE project_id = '00000000-0000-0000-0000-000000000ca1';
INSERT INTO ids SELECT 'ib1', public.gc_send_owner_interest_bill('00000000-0000-0000-0000-000000000ca1', 100);
INSERT INTO ids SELECT 'ibill', invoice_id FROM public.gc_owner_interest_bills WHERE id = (SELECT id FROM ids WHERE k = 'ib1');
SELECT gcb.same('the revenue is the contract and the interest, with no riders yet', gcb.revenue(), '100100.00');

-- 2 · Signed in, nobody turns a bill to card (the grant stops them before the function's own words), and an undo
-- finds nothing on card.
SELECT gcb.refused('a dev''s begin', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill1'))$q$,
  'permission denied for function gc_card_bill_begin');
SELECT gcb.refused('a dev''s finish', $q$SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill1'), 'in_x1', 'https://invoice.stripe.com/i/x1', 'open', 'test')$q$,
  'permission denied for function gc_card_bill_finish');
SELECT gcb.refused('an undo with nothing on card', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill1'))$q$,
  'That bill is not on card.');
RESET ROLE;

-- 3 · As the service role, with no one signed in (as gc-card-bill calls it): the refusals first. A staff Stripe bill is
-- made by hand on bill 3 for the one check, and taken off again.
UPDATE public.jobs_ledger_invoices SET stripe_invoice_id = 'in_staff' WHERE id = (SELECT id FROM ids WHERE k = 'bill3');
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT gcb.refused('an interest bill', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'ibill'))$q$,
  'Only a certified bill goes on card.');
SELECT gcb.refused('a bill that is not there', $q$SELECT public.gc_card_bill_begin('00000000-0000-0000-0000-00000000c0de')$q$,
  'That bill is not there.');
SELECT gcb.refused('a bill on Stripe already', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill3'))$q$,
  'This bill is on Stripe already.');
RESET ROLE;
UPDATE public.jobs_ledger_invoices SET stripe_invoice_id = NULL WHERE id = (SELECT id FROM ids WHERE k = 'bill3');
SET LOCAL ROLE service_role;

-- 4 · Bill 1 turns to card: 3% of 42,750 is 1,282.50. A second press while the page is made waits; a page that never
-- came back is cleared and begun again; a page that came back broken is refused; then finish writes it onto the bill.
SELECT gcb.same('begin answers the figures the Stripe invoice needs',
  gcb.begun(public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill1'))), 'pending 42750.00 3 1282.50 44032.50 1 false 30 no url');
SELECT gcb.same('the pending row, chosen today in their portal', gcb.card((SELECT id FROM ids WHERE k = 'bill1')),
  'pending 42750.00 3 1282.50 no stripe today portal not undone by nobody');
SELECT gcb.refused('a second press while the page is made', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill1'))$q$,
  'This bill is being set up for card. Try again in a minute.');
SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill1'));
SELECT gcb.same('a page that never came back: the pending row cleared, the bill as it was',
  gcb.card((SELECT id FROM ids WHERE k = 'bill1')) || ' | ' || gcb.bill((SELECT id FROM ids WHERE k = 'bill1')),
  'no card row | billed | 42750.00 | no stripe | no mode | no channel | no fee lines');
SELECT gcb.begun(public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill1')));
SELECT gcb.refused('a page that came back broken', $q$SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill1'), 'not-an-invoice', 'https://invoice.stripe.com/i/x1', 'open', 'test')$q$,
  'The card page did not come back whole.');
SELECT gcb.refused('a page in no mode', $q$SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill1'), 'in_test1', 'https://invoice.stripe.com/i/x1', 'open', 'sandbox')$q$,
  'The card page did not come back whole.');
SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill1'), 'in_test1', 'https://invoice.stripe.com/i/test1', 'open', 'test');
SELECT gcb.same('bill 1 on card: the total, the Stripe columns, the fee as its rider',
  gcb.bill((SELECT id FROM ids WHERE k = 'bill1')),
  'billed | 44032.50 | in_test1 | test | stripe | Credit card fee (3%) 1282.50 its card bill');
SELECT gcb.same('its card row on card', gcb.card((SELECT id FROM ids WHERE k = 'bill1')),
  'on_card 42750.00 3 1282.50 in_test1 today portal not undone by nobody');
SELECT gcb.same('the rider counted, and the revenue the contract, the interest and the fee',
  gcb.m(public.job_rider_fees(gcb.job())) || ' | ' || gcb.revenue(), '1282.50 | 101382.50');
SELECT gcb.same('a second press opens the card page it has',
  gcb.begun(public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill1'))), 'on_card 42750.00 1282.50 44032.50 https://invoice.stripe.com/i/test1');
SELECT gcb.refused('a second finish', $q$SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill1'), 'in_test9', 'https://invoice.stripe.com/i/test9', 'open', 'test')$q$,
  'That bill is not being set up for card.');

-- 5 · Bill 2's 3% falls on a half cent: 370.365 rounds to 370.37.
SELECT gcb.same('the half cent rounds up', gcb.begun(public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill2'))),
  'pending 12345.50 3 370.37 12715.87 2 false 30 no url');
SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill2'), 'in_test2', 'https://invoice.stripe.com/i/test2', 'open', 'test');
SELECT gcb.same('both fees ride on the revenue', gcb.revenue(), '101752.87');
RESET ROLE;

-- 6 · As the controller, the money team: pay application 4 certified at 5,000. The certificate lays the revenue again
-- and keeps both riders, read through the controller's own rights.
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd4');
SET LOCAL ROLE authenticated;
INSERT INTO ids SELECT 'app4', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ca1', gcb.app(4, DATE '2026-09-26', gcb.lines(52000, 16500, 5435.50, 0, 2000), 5000));
INSERT INTO ids SELECT 'bill4', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app4'), 5000, DATE '2026-09-29', '');
SELECT gcb.same('the controller''s certificate keeps the riders in the revenue', gcb.revenue(), '101752.87');
RESET ROLE;

-- 7 · Bill 4 turns to card (150.00), then goes back to a check bill: an estimator, a dev in training mode and a
-- digital twin are each refused in words, the controller takes it back. The row stays, undone, so their portal cannot turn it again.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT gcb.begun(public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill4')));
SELECT public.gc_card_bill_finish((SELECT id FROM ids WHERE k = 'bill4'), 'in_test4', 'https://invoice.stripe.com/i/test4', 'open', 'test');
SELECT gcb.same('bill 4 on card', gcb.bill((SELECT id FROM ids WHERE k = 'bill4')) || ' | ' || gcb.revenue(),
  'billed | 5150.00 | in_test4 | test | stripe | Credit card fee (3%) 150.00 its card bill | 101902.87');
SELECT gcb.refused('the service role taking a bill on card back', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill4'))$q$,
  'Only the office takes a bill off card.');
RESET ROLE;
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd3');
SET LOCAL ROLE authenticated;
SELECT gcb.refused('an estimator''s undo', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill4'))$q$,
  'Only the money team takes a bill off card.');
SELECT gcb.same('an estimator reads no card rows', (SELECT count(*)::text FROM public.gc_owner_card_bills), '0');
RESET ROLE;
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd2');
SET LOCAL ROLE authenticated;
SELECT gcb.refused('a dev in training mode''s undo', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill4'))$q$,
  'A training account cannot take a bill off card.');
RESET ROLE;
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd6');
SET LOCAL ROLE authenticated;
SELECT gcb.refused('a digital twin''s undo', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill4'))$q$,
  'A digital twin cannot take a bill off card.');
RESET ROLE;
SELECT gcb.same('nothing moved off the money team', gcb.card((SELECT id FROM ids WHERE k = 'bill4')),
  'on_card 5000.00 3 150.00 in_test4 today portal not undone by nobody');
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd4');
SET LOCAL ROLE authenticated;
SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill4'));
SELECT gcb.same('back to a check bill: the base, no Stripe, the rider off, the fee out of the revenue',
  gcb.bill((SELECT id FROM ids WHERE k = 'bill4')) || ' | ' || gcb.revenue(),
  'billed | 5000.00 | no stripe | no mode | no channel | no fee lines | 101752.87');
SELECT gcb.same('its row kept, undone today by the controller', gcb.card((SELECT id FROM ids WHERE k = 'bill4')),
  'undone 5000.00 3 150.00 in_test4 today portal undone today by the controller');
SELECT gcb.same('the money team reads the three rows', (SELECT count(*)::text FROM public.gc_owner_card_bills), '3');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT gcb.refused('their portal turning it again', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill4'))$q$,
  'This bill went back to a check bill. Call our office to pay it by card.');
RESET ROLE;

-- 8 · As the dev: the last pay application certified at 24,064.50, so the bills hold the whole contract.
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd1');
SET LOCAL ROLE authenticated;
INSERT INTO ids SELECT 'app5', public.gc_send_owner_pay_app('00000000-0000-0000-0000-000000000ca1', gcb.app(5, DATE '2026-10-03', gcb.lines(60000, 25000, 10000, 2000, 3000), 24064.50));
INSERT INTO ids SELECT 'bill5', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app5'), 24064.50, DATE '2026-10-06', '');
SELECT gcb.same('the revenue holds', gcb.revenue(), '101752.87');

-- 9 · Money in. A part payment on bill 3 keeps it off card. Then every bill is paid but bill 2's fee: its certified
-- 12,345.50 only. Without the riders the revenue would be 100,100.00, below the 101,382.50 paid, and the job would
-- read paid with bill 2 still open. With them it keeps its status (a billing job works until it is paid), and what is
-- left owed is bill 2's fee.
SELECT gcb.same('a part payment on bill 3', (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill3'), 1000))::text, '{"ok": true}');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT gcb.refused('a bill with a payment', $q$SELECT public.gc_card_bill_begin((SELECT id FROM ids WHERE k = 'bill3'))$q$,
  'A payment is on this bill already, so it cannot move to card.');
RESET ROLE;
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd1');
SET LOCAL ROLE authenticated;
SELECT gcb.same('the rest paid',
  concat_ws(' ',
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill3'), 14840))::text,
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill1'), 44032.50))::text,
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill4'), 5000))::text,
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill5'), 24064.50))::text,
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'ibill'), 100))::text,
    (public.mark_invoice_paid((SELECT id FROM ids WHERE k = 'bill2'), 12345.50))::text),
  '{"ok": true} {"ok": true} {"ok": true} {"ok": true} {"ok": true} {"ok": true}');
SELECT gcb.same('bill 2 still open by its fee, and the billing job not paid early',
  split_part(gcb.bill((SELECT id FROM ids WHERE k = 'bill2')), ' | ', 1) || ' | ' || gcb.left_owed(), 'billed | working 370.37');
SELECT gcb.same('a bill paid by card: its card bill paid with its fee', gcb.bill((SELECT id FROM ids WHERE k = 'bill1')),
  'paid | 44032.50 | in_test1 | test | stripe | Credit card fee (3%) 1282.50 its card bill');
RESET ROLE;

-- 10 · A bill paid by card stays on card.
SELECT gcb.as_user('00000000-0000-0000-0000-000000000cd4');
SET LOCAL ROLE authenticated;
SELECT gcb.refused('taking a paid card bill back', $q$SELECT public.gc_card_bill_undo((SELECT id FROM ids WHERE k = 'bill1'))$q$,
  'A payment is on this bill, so it stays on card.');
RESET ROLE;

-- 11 · A returned check fee on a GC bill rides too (v2.5091 left it to the GC crew), beside the card fees.
UPDATE public.jobs_ledger_invoices
SET amount = amount + 30,
    fee_lines = coalesce(fee_lines, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'description', 'Returned check fee', 'amount', 30, 'case_id', '00000000-0000-0000-0000-00000000cafe', 'added_at', now()))
WHERE id = (SELECT id FROM ids WHERE k = 'bill5');
SELECT gcb.same('the riders: both card fees and the check fee',
  gcb.m(public.job_rider_fees(gcb.job())) || ' | ' || gcb.m(public.gc_owner_billing_revenue('00000000-0000-0000-0000-000000000ca1')),
  '1682.87 | 101782.87');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_card_bills PASSED'; END $$;
ROLLBACK;
