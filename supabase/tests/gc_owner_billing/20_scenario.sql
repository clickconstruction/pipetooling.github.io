-- Our bill to the customer (GC mode, Owner Billing's O4a-1): sending a pay application files it with its
-- lines and opens the project's billing job the first time, billing-only and kept at the contract; the
-- architect's certificate makes the bill on that job; the links and the certificate stay once written; and
-- every refusal comes in its words. Presses run through RLS as a dev, the controller, an estimator and a dev
-- in training mode; the fixture is made as postgres; everything runs inside one transaction that rolls back.
-- Raises on the first failed assertion; ends with "gc_owner_billing PASSED". See
-- scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, an estimator, the controller and the company owner (a leader).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000004d1', 'dev@billing.test'),
  ('00000000-0000-0000-0000-0000000004d2', 'trainee@billing.test'),
  ('00000000-0000-0000-0000-0000000004d3', 'estimator@billing.test'),
  ('00000000-0000-0000-0000-0000000004d4', 'controller@billing.test'),
  ('00000000-0000-0000-0000-0000000004d5', 'owner@billing.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000004d1', 'dev@billing.test', 'Billing Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000004d2', 'trainee@billing.test', 'Billing Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000004d3', 'estimator@billing.test', 'Billing Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000004d4', 'controller@billing.test', 'Billing Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000004d5', 'owner@billing.test', 'Billing Owner', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000004d2';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000004d5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;

-- Three GC projects for one customer: P building (Electrical, Plumbing), Q still bidding, R building with no
-- signed contract (Concrete).
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000004c1', 'Billing Test Owner LLC', '00000000-0000-0000-0000-0000000004d5',
   '{"email": " owner-ap@billing.test ", "phone": "210-555-0100"}');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-0000000004a1', 'Billing test P', '00000000-0000-0000-0000-0000000004c1', '100 Test Way, San Antonio, TX 78201'),
  ('00000000-0000-0000-0000-0000000004a2', 'Billing test Q', '00000000-0000-0000-0000-0000000004c1', NULL),
  ('00000000-0000-0000-0000-0000000004a3', 'Billing test R', '00000000-0000-0000-0000-0000000004c1', NULL);
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000004a1', 'building'),
  ('00000000-0000-0000-0000-0000000004a2', 'bidding'),
  ('00000000-0000-0000-0000-0000000004a3', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000004b1', '00000000-0000-0000-0000-0000000004a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000004b2', '00000000-0000-0000-0000-0000000004a1', 'Plumbing', 1),
  ('00000000-0000-0000-0000-0000000004b3', '00000000-0000-0000-0000-0000000004a3', 'Concrete', 0),
  ('00000000-0000-0000-0000-0000000004b4', '00000000-0000-0000-0000-0000000004a2', 'Concrete', 0);

CREATE SCHEMA gob;
CREATE FUNCTION gob.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction),
-- as a refused press's do.
CREATE FUNCTION gob.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gob.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- Money as text, the same at any scale.
CREATE FUNCTION gob.m(v numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(round(v, 2)::text, 'null') $$;
-- One line of a pay application, as the window sends it.
CREATE FUNCTION gob.line(p_kind text, p_package uuid, p_change_order uuid, p_label text, p_worth numeric, p_done numeric, p_stored numeric DEFAULT 0)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_kind, 'packageId', p_package, 'changeOrderId', p_change_order, 'label', p_label,
    'worth', p_worth, 'doneToDate', p_done, 'stored', p_stored) $$;
-- A pay application as the window sends it (ownerPayAppToSend), its work so far added up from its lines
-- unless `p_work` says otherwise, and 10% held.
CREATE FUNCTION gob.app(p_number int, p_period date, p_sent date, p_lines jsonb, p_due numeric,
  p_work numeric DEFAULT NULL, p_final boolean DEFAULT false) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', p_final, 'periodTo', p_period, 'sentOn', p_sent,
    'retainagePct', 10, 'retainageStep', NULL, 'retainage', round(coalesce(p_work, w.work) / 10, 2),
    'workToDate', coalesce(p_work, w.work), 'due', p_due, 'lines', p_lines)
  FROM (SELECT coalesce(sum(coalesce((l ->> 'doneToDate')::numeric, 0) + coalesce((l ->> 'stored')::numeric, 0)), 0) AS work
        FROM jsonb_array_elements(p_lines) l) w $$;
-- What the checks read, whoever is signed in: the project's billing job, its bills and its pay applications.
CREATE FUNCTION gob.job(p_project uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT billing_job_id FROM public.gc_projects WHERE project_id = p_project $$;
CREATE FUNCTION gob.job_words(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', j.job_name, j.job_address, j.status, j.billing_only::text, coalesce(j.project_id::text, 'no project'),
    j.customer_name, j.customer_email, j.customer_phone, (j.customer_id = p.customer_id)::text,
    (j.master_user_id = '00000000-0000-0000-0000-0000000004d5')::text, st.name, st.billing_only::text, gob.m(j.revenue))
  FROM public.gc_projects g JOIN public.projects p ON p.id = g.project_id
  JOIN public.jobs_ledger j ON j.id = g.billing_job_id JOIN public.service_types st ON st.id = j.service_type_id
  WHERE g.project_id = p_project $$;
CREATE FUNCTION gob.bills(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(concat_ws(' ', i.sequence_order, i.status, gob.m(i.amount), i.estimated_bill_date,
    (i.billed_at = (i.estimated_bill_date + time '12:00') AT TIME ZONE 'America/Chicago')::text), E'\n' ORDER BY i.sequence_order), 'none')
  FROM public.jobs_ledger_invoices i WHERE i.job_id = gob.job(p_project) $$;
CREATE FUNCTION gob.app_words(p_project uuid, p_number int) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', a.number, a.final::text, a.period_to, a.sent_on, gob.m(a.retainage_pct), gob.m(a.retainage),
    gob.m(a.work_to_date), gob.m(a.due), gob.m(a.certified), coalesce(a.certified_on::text, 'waiting'),
    coalesce(nullif(a.certified_note, ''), 'no note'),
    CASE a.certified_by WHEN '00000000-0000-0000-0000-0000000004d1' THEN 'by the dev'
      WHEN '00000000-0000-0000-0000-0000000004d4' THEN 'by the controller' ELSE coalesce(a.certified_by::text, 'by nobody') END,
    CASE WHEN a.invoice_id IS NULL THEN 'no bill' ELSE 'its bill ' || i.sequence_order END)
  FROM public.gc_owner_pay_apps a LEFT JOIN public.jobs_ledger_invoices i ON i.id = a.invoice_id
  WHERE a.project_id = p_project AND a.number = p_number $$;
CREATE FUNCTION gob.app_lines(p_project uuid, p_number int) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(concat_ws(' ', l.position, l.line, l.label, gob.m(l.worth), gob.m(l.done_to_date), gob.m(l.stored),
    CASE WHEN l.package_id IS NOT NULL THEN 'trade ' || right(l.package_id::text, 3) WHEN l.change_order_id IS NOT NULL THEN 'a change order' ELSE 'ours' END),
    E'\n' ORDER BY l.position)
  FROM public.gc_owner_pay_app_lines l JOIN public.gc_owner_pay_apps a ON a.id = l.pay_app_id
  WHERE a.project_id = p_project AND a.number = p_number $$;
CREATE FUNCTION gob.count_of(p_sql text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint; BEGIN EXECUTE p_sql INTO v; RETURN v::text; END $$;
GRANT USAGE ON SCHEMA gob TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gob TO authenticated;
-- What a press returned, for the steps after it: a statement never sees what a function it calls wrote, so
-- each check reads in a statement of its own.
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
CREATE TEMP TABLE vals (k text PRIMARY KEY, v text) ON COMMIT DROP;
GRANT ALL ON ids, vals TO authenticated;

-- 0 · The migration: the service type once (the bed applied the migration twice), billing-only and last;
-- the two links, their grants and the trigger; nobody signed out reaches the functions.
SELECT gob.same('the service type: once, billing-only, last in the order',
  (SELECT count(*) || ' ' || bool_and(billing_only)::text || ' ' || bool_and(sequence_order = (SELECT max(sequence_order) FROM public.service_types))::text
   FROM public.service_types WHERE name = 'General contracting'),
  '1 true true');
SELECT gob.same('the links: their column grants, and no other column opened',
  has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'invoice_id', 'UPDATE')::text || ' ' ||
  has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'conditional_waiver_id', 'UPDATE')::text || ' ' ||
  has_column_privilege('authenticated', 'public.gc_owner_pay_apps', 'due', 'UPDATE')::text || ' ' ||
  has_column_privilege('authenticated', 'public.gc_owner_interest_bills', 'invoice_id', 'UPDATE')::text,
  'true true false false');
SELECT gob.same('the links-once trigger is there',
  (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'gc_owner_pay_apps_links_once' AND NOT tgisinternal), '1');
SELECT gob.same('anon reaches none of the three functions',
  has_function_privilege('anon', 'public.gc_send_owner_pay_app(uuid, jsonb)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_record_certificate(uuid, numeric, date, text)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_owner_contract_now(uuid)', 'EXECUTE')::text,
  'false false false');

-- 1 · As the dev: P's contract signed by line, change order 1 signed, change order 2 only a draft.
SELECT gob.as_user('00000000-0000-0000-0000-0000000004d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000004a1', DATE '2026-09-01',
  '{"00000000-0000-0000-0000-0000000004b1": 100000, "00000000-0000-0000-0000-0000000004b2": 50000, "gc": 20000, "contingency": 5000, "fee": 10000}');
INSERT INTO ids SELECT 'co1', public.gc_draft_change_order('00000000-0000-0000-0000-0000000004a1',
  '{"description": "Billing test change: a floor box at the lobby", "reason": "owner", "cost": 1000, "price": 1500, "days": 2, "packageId": "00000000-0000-0000-0000-0000000004b1"}');
SELECT public.gc_send_change_order((SELECT id FROM ids WHERE k = 'co1'), DATE '2026-09-10');
SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co1'), true, DATE '2026-09-12', 'office');
INSERT INTO ids SELECT 'co2', public.gc_draft_change_order('00000000-0000-0000-0000-0000000004a1',
  '{"description": "Billing test change: a second hose bibb", "reason": "field", "cost": 600, "price": 800}');
SELECT gob.same('our price today: the contract and the signed change order, not the draft',
  gob.m(public.gc_owner_contract_now('00000000-0000-0000-0000-0000000004a1')), '186500.00');
-- Pay application 1's lines, kept for the presses below: both trades, our three lines and change order 1.
INSERT INTO vals SELECT 'lines1', jsonb_build_array(
  gob.line('trade', '00000000-0000-0000-0000-0000000004b1', NULL, 'Electrical', 100000, 30000),
  gob.line('trade', '00000000-0000-0000-0000-0000000004b2', NULL, 'Plumbing', 50000, 10000, 2000),
  gob.line('gc', NULL, NULL, 'General conditions', 20000, 5000),
  gob.line('contingency', NULL, NULL, 'Contingency', 5000, 0),
  gob.line('fee', NULL, NULL, 'Fee', 10000, 2500),
  gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co1'), 'Change order 1', 1500, 750))::text;
INSERT INTO vals SELECT 'next number', public.next_job_number_suggestion();

-- 2 · Every refusal of a send, in its words, and none of them opens a billing job.
SELECT gob.refused('a send on a job we still bid',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a2',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225))$q$,
  'We bill the customer only on a job we won.');
SELECT gob.refused('a send before the contract is signed',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a3',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', jsonb_build_array(gob.line('trade', '00000000-0000-0000-0000-0000000004b3', NULL, 'Concrete', 1000, 500)), 450))$q$,
  'Mark the contract with the customer signed before the first bill.');
SELECT gob.refused('a send with no pay application',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1', NULL)$q$,
  'Send the pay application as the window drafted it.');
SELECT gob.refused('a send that is not the next number',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(2, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225))$q$,
  'Another pay application went first.');
SELECT gob.refused('a final pay application before the customer accepts the work',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225, NULL, true))$q$,
  'The final pay application goes after the customer accepts the work.');
SELECT gob.refused('a send on a day still to come',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', public.app_today() + 1, (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225))$q$,
  'A pay application cannot go on a day still to come.');
SELECT gob.refused('a send with nothing due',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 0))$q$,
  'There is nothing to bill');
SELECT gob.refused('a send with no lines',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', '[]'::jsonb, 45225, 50250))$q$,
  'A pay application needs its lines.');
SELECT gob.refused('a send naming another project''s trade',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', jsonb_build_array(gob.line('trade', '00000000-0000-0000-0000-0000000004b3', NULL, 'Concrete', 1000, 500)), 450))$q$,
  'Each trade on the bill must be one of this project''s trades.');
SELECT gob.refused('a send billing a change order the customer has not signed',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', jsonb_build_array(gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co2'), 'Change order 2', 800, 400)), 360))$q$,
  'A change order is billed only once the customer signs it.');
SELECT gob.refused('a send with a line of no known kind',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', jsonb_build_array(gob.line('bonus', NULL, NULL, 'Bonus', 1000, 500)), 450))$q$,
  'Each line must be a trade, our own crew, general conditions, contingency, fee or a change order.');
SELECT gob.refused('a send whose work does not add up from its lines',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225, 50000))$q$,
  'does not add up from its lines');
-- The billing job's type is found by its flag: with no flagged type, the first send refuses in words.
RESET ROLE;
UPDATE public.service_types SET billing_only = false WHERE name = 'General contracting';
SET LOCAL ROLE authenticated;
SELECT gob.refused('a first send with no billing-only service type',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225))$q$,
  'The billing job''s service type is missing. Ask a dev to add General contracting back.');
RESET ROLE;
UPDATE public.service_types SET billing_only = true WHERE name = 'General contracting';
SET LOCAL ROLE authenticated;
SELECT gob.same('no refused send filed a pay application or opened a billing job',
  gob.count_of($q$SELECT count(*) FROM public.gc_owner_pay_apps$q$) || ' ' ||
  coalesce(gob.job('00000000-0000-0000-0000-0000000004a1')::text, 'no job') || ' ' ||
  gob.count_of($q$SELECT count(*) FROM public.jobs_ledger WHERE billing_only$q$),
  '0 no job 0');

-- 3 · Pay application 1, as the dev: filed as it went, its lines in order, and the billing job opened.
INSERT INTO ids SELECT 'app1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
  gob.app(1, DATE '2026-09-25', DATE '2026-09-25', (SELECT v::jsonb FROM vals WHERE k = 'lines1'), 45225));
SELECT gob.same('pay application 1 as it went',
  gob.app_words('00000000-0000-0000-0000-0000000004a1', 1),
  '1 | false | 2026-09-25 | 2026-09-25 | 10.00 | 5025.00 | 50250.00 | 45225.00 | null | waiting | no note | by nobody | no bill');
SELECT gob.same('pay application 1''s lines, in the bill''s order',
  gob.app_lines('00000000-0000-0000-0000-0000000004a1', 1),
  E'1 trade Electrical 100000.00 30000.00 0.00 trade 4b1\n2 trade Plumbing 50000.00 10000.00 2000.00 trade 4b2\n3 gc General conditions 20000.00 5000.00 0.00 ours\n4 contingency Contingency 5000.00 0.00 0.00 ours\n5 fee Fee 10000.00 2500.00 0.00 ours\n6 change_order Change order 1 1500.00 750.00 0.00 a change order');
SELECT gob.same('the billing job: billing-only, working, the project''s customer, the owner as master, at the contract',
  gob.job_words('00000000-0000-0000-0000-0000000004a1'),
  'Billing test P (GC) | 100 Test Way, San Antonio, TX 78201 | working | true | no project | Billing Test Owner LLC | owner-ap@billing.test | 210-555-0100 | true | true | General contracting | true | 186500.00');
SELECT gob.same('the billing job takes the next job number',
  (SELECT (j.hcp_number = (SELECT v FROM vals WHERE k = 'next number'))::text FROM public.jobs_ledger j WHERE j.id = gob.job('00000000-0000-0000-0000-0000000004a1')),
  'true');
SELECT gob.same('a send makes no bill: the bill waits on the certificate',
  gob.bills('00000000-0000-0000-0000-0000000004a1'), 'none');

-- 4 · The billing-only job's guards and searches hold for the job the send opened.
INSERT INTO ids SELECT 'job', gob.job('00000000-0000-0000-0000-0000000004a1');
SELECT gob.refused('nobody joins the billing job''s crew',
  $q$INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ((SELECT id FROM ids WHERE k = 'job'), '00000000-0000-0000-0000-0000000004d1')$q$,
  'That job only carries a GC job''s bills.');
SELECT gob.refused('nobody schedules the billing job',
  $q$INSERT INTO public.job_schedule_blocks (job_id, assignee_user_id, work_date, time_start, time_end)
    VALUES ((SELECT id FROM ids WHERE k = 'job'), '00000000-0000-0000-0000-0000000004d1', DATE '2026-10-01', '08:00', '12:00')$q$,
  'That job only carries a GC job''s bills.');
SELECT gob.refused('nobody clocks in on the billing job',
  $q$INSERT INTO public.clock_sessions (user_id, job_ledger_id, clocked_in_at, work_date)
    VALUES ('00000000-0000-0000-0000-0000000004d1', (SELECT id FROM ids WHERE k = 'job'), now(), DATE '2026-10-01')$q$,
  'That job only carries a GC job''s bills.');
SELECT gob.refused('the billing job stays billing-only',
  $q$UPDATE public.jobs_ledger SET billing_only = false WHERE id = (SELECT id FROM ids WHERE k = 'job')$q$,
  'stays that way');
SELECT gob.same('the crew searches leave it out, the office''s finds it',
  (SELECT count(*) FROM public.search_jobs_ledger('Billing test P'))::text || ' ' ||
  (SELECT count(*) FROM public.search_jobs_ledger('Billing test P', true))::text || ' ' ||
  (SELECT count(*) FROM public.search_jobs_for_self_schedule('Billing test P'))::text,
  '0 1 0');

-- 5 · The certificate on pay application 1: every refusal in its words, then what they certified.
SELECT gob.refused('a certificate above what we asked',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45225.01, DATE '2026-09-30', 'more')$q$,
  'They cannot certify more than we asked for.');
SELECT gob.refused('a certificate for less, with no why',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45000, DATE '2026-09-30', '  ')$q$,
  'They certified less than we asked. Say why.');
SELECT gob.refused('a certificate before the pay application went',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45225, DATE '2026-09-24', '')$q$,
  'The architect certified it before it went.');
SELECT gob.refused('a certificate on a day still to come',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45225, public.app_today() + 1, '')$q$,
  'The day they certified it cannot be still to come.');
SELECT gob.refused('a certificate below zero',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), -1, DATE '2026-09-30', 'below')$q$,
  'What they certified cannot be below zero.');
SELECT gob.refused('a certificate with no amount',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), NULL, DATE '2026-09-30', '')$q$,
  'Type what the architect certified and the day they signed.');
INSERT INTO ids SELECT 'bill1', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45000, DATE '2026-09-30',
  'Held back 225 for the lobby punch item.');
SELECT gob.same('the certificate makes the bill: billed that day at noon Central, first on the job',
  gob.bills('00000000-0000-0000-0000-0000000004a1'), '0 billed 45000.00 2026-09-30 true');
SELECT gob.same('pay application 1 keeps its certificate and its bill',
  gob.app_words('00000000-0000-0000-0000-0000000004a1', 1),
  '1 | false | 2026-09-25 | 2026-09-25 | 10.00 | 5025.00 | 50250.00 | 45225.00 | 45000.00 | 2026-09-30 | Held back 225 for the lobby punch item. | by the dev | its bill 0');
SELECT gob.same('the job''s last bill day moves to the certificate''s',
  (SELECT last_bill_date::text FROM public.jobs_ledger WHERE id = (SELECT id FROM ids WHERE k = 'job')), '2026-09-30');

-- 6 · Once written, it stays: the certificate, the bill's link and the waiver's link.
SELECT gob.refused('a second certificate',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 45225, DATE '2026-10-01', '')$q$,
  'The certificate on pay application 1 is recorded already.');
SELECT gob.refused('the bill''s link cleared by hand',
  $q$UPDATE public.gc_owner_pay_apps SET invoice_id = NULL WHERE id = (SELECT id FROM ids WHERE k = 'app1')$q$,
  'Pay application 1 has its bill, so it keeps it.');
SELECT gob.refused('the certificate rewritten by hand',
  $q$UPDATE public.gc_owner_pay_apps SET certified_note = 'Changed my mind.' WHERE id = (SELECT id FROM ids WHERE k = 'app1')$q$,
  'The certificate on pay application 1 is recorded, and its bill made from it.');
SELECT gob.refused('what went cannot be changed',
  $q$UPDATE public.gc_owner_pay_apps SET due = 1 WHERE id = (SELECT id FROM ids WHERE k = 'app1')$q$,
  'permission denied');
RESET ROLE;
INSERT INTO public.job_lien_releases (id, job_id, amount, form_type) VALUES
  ('00000000-0000-0000-0000-0000000004e1', (SELECT id FROM ids WHERE k = 'job'), 45225, 'conditional_progress'),
  ('00000000-0000-0000-0000-0000000004e2', (SELECT id FROM ids WHERE k = 'job'), 45225, 'conditional_progress');
SET LOCAL ROLE authenticated;
UPDATE public.gc_owner_pay_apps SET conditional_waiver_id = '00000000-0000-0000-0000-0000000004e1' WHERE id = (SELECT id FROM ids WHERE k = 'app1');
SELECT gob.same('our conditional waiver links once',
  gob.count_of($q$SELECT count(*) FROM public.gc_owner_pay_apps WHERE conditional_waiver_id = '00000000-0000-0000-0000-0000000004e1'$q$), '1');
SELECT gob.refused('the waiver''s link moved',
  $q$UPDATE public.gc_owner_pay_apps SET conditional_waiver_id = '00000000-0000-0000-0000-0000000004e2' WHERE id = (SELECT id FROM ids WHERE k = 'app1')$q$,
  'Pay application 1 has its waiver, so it keeps it.');

-- 7 · As the controller (the money team since the Owner Billing door): change order 3 signed, a bill day
-- before the last refused, then pay application 2 keeps the job's revenue at the new contract and its
-- certificate makes the second bill.
SELECT gob.as_user('00000000-0000-0000-0000-0000000004d4');
INSERT INTO ids SELECT 'co3', public.gc_draft_change_order('00000000-0000-0000-0000-0000000004a1',
  '{"description": "Billing test change: a larger water heater", "reason": "owner", "cost": 700, "price": 1000, "packageId": "00000000-0000-0000-0000-0000000004b2"}');
SELECT public.gc_send_change_order((SELECT id FROM ids WHERE k = 'co3'), DATE '2026-10-01');
SELECT public.gc_answer_change_order((SELECT id FROM ids WHERE k = 'co3'), true, DATE '2026-10-02', 'office');
INSERT INTO vals SELECT 'lines2', jsonb_build_array(
  gob.line('trade', '00000000-0000-0000-0000-0000000004b1', NULL, 'Electrical', 100000, 40000),
  gob.line('trade', '00000000-0000-0000-0000-0000000004b2', NULL, 'Plumbing', 50000, 15000),
  gob.line('gc', NULL, NULL, 'General conditions', 20000, 7000),
  gob.line('contingency', NULL, NULL, 'Contingency', 5000, 0),
  gob.line('fee', NULL, NULL, 'Fee', 10000, 3100),
  gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co1'), 'Change order 1', 1500, 1500),
  gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co3'), 'Change order 3', 1000, 500))::text;
SELECT gob.refused('a bill day before the last pay application''s',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(2, DATE '2026-09-20', DATE '2026-10-02', (SELECT v::jsonb FROM vals WHERE k = 'lines2'), 15390))$q$,
  'Its bill day is before the last pay application''s.');
INSERT INTO ids SELECT 'app2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
  gob.app(2, DATE '2026-10-02', DATE '2026-10-02', (SELECT v::jsonb FROM vals WHERE k = 'lines2'), 15390));
SELECT gob.same('pay application 2, sent by the controller',
  gob.app_words('00000000-0000-0000-0000-0000000004a1', 2),
  '2 | false | 2026-10-02 | 2026-10-02 | 10.00 | 6710.00 | 67100.00 | 15390.00 | null | waiting | no note | by nobody | no bill');
SELECT gob.same('the same billing job, its revenue now the contract with change order 3',
  gob.count_of($q$SELECT count(*) FROM public.jobs_ledger WHERE billing_only$q$) || ' ' ||
  (SELECT gob.m(revenue) FROM public.jobs_ledger WHERE id = (SELECT id FROM ids WHERE k = 'job')),
  '1 187500.00');
INSERT INTO ids SELECT 'bill2', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app2'), 15390, DATE '2026-10-05', '');
SELECT gob.same('the controller''s certificate makes the second bill',
  gob.bills('00000000-0000-0000-0000-0000000004a1'), E'0 billed 45000.00 2026-09-30 true\n1 billed 15390.00 2026-10-05 true');

-- 8 · Pay application 3, certified at nothing: no bill.
INSERT INTO ids SELECT 'app3', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
  gob.app(3, DATE '2026-10-06', DATE '2026-10-06', jsonb_build_array(
    gob.line('trade', '00000000-0000-0000-0000-0000000004b1', NULL, 'Electrical', 100000, 45000),
    gob.line('trade', '00000000-0000-0000-0000-0000000004b2', NULL, 'Plumbing', 50000, 15000),
    gob.line('gc', NULL, NULL, 'General conditions', 20000, 7500),
    gob.line('contingency', NULL, NULL, 'Contingency', 5000, 0),
    gob.line('fee', NULL, NULL, 'Fee', 10000, 3400),
    gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co1'), 'Change order 1', 1500, 1500),
    gob.line('change_order', NULL, (SELECT id FROM ids WHERE k = 'co3'), 'Change order 3', 1000, 500)), 5220));
INSERT INTO ids SELECT 'bill3', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app3'), 0, DATE '2026-10-07',
  'Nothing certified this month, per the architect.');
SELECT gob.same('a certificate of nothing makes no bill',
  coalesce((SELECT id::text FROM ids WHERE k = 'bill3'), 'no bill') || ' | ' ||
  gob.app_words('00000000-0000-0000-0000-0000000004a1', 3) || ' | ' ||
  gob.count_of($q$SELECT count(*) FROM public.jobs_ledger_invoices WHERE job_id = (SELECT billing_job_id FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000004a1')$q$),
  'no bill | 3 | false | 2026-10-06 | 2026-10-06 | 10.00 | 7290.00 | 72900.00 | 5220.00 | 0.00 | 2026-10-07 | Nothing certified this month, per the architect. | by the controller | no bill | 2');

-- 9 · Outside the money team: an estimator reaches neither press, and a dev in training mode writes nothing.
SELECT gob.as_user('00000000-0000-0000-0000-0000000004d3');
SELECT gob.refused('an estimator''s send',
  $q$SELECT public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
    gob.app(1, DATE '2026-10-07', DATE '2026-10-07', jsonb_build_array(gob.line('trade', '00000000-0000-0000-0000-0000000004b1', NULL, 'Electrical', 100000, 50000)), 1000))$q$,
  'row-level security');
SELECT gob.refused('an estimator''s certificate',
  $q$SELECT public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app3'), 0, DATE '2026-10-07', 'no')$q$,
  'That pay application is not there.');
SELECT gob.as_user('00000000-0000-0000-0000-0000000004d2');
DO $$
BEGIN
  BEGIN
    PERFORM public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000004a1',
      gob.app(4, DATE '2026-10-07', DATE '2026-10-07', jsonb_build_array(gob.line('trade', '00000000-0000-0000-0000-0000000004b1', NULL, 'Electrical', 100000, 50000)), 1000));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: a dev in training mode is refused (%)', SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'a dev in training mode sent a pay application';
END $$;
SELECT gob.same('nothing written outside the money team',
  gob.count_of($q$SELECT count(*) FROM public.gc_owner_pay_apps$q$), '3');

-- 10 · A link goes to null only when its bill is deleted; the project's delete takes its pay applications
-- and lines, and the billing job stays with its history.
SELECT gob.as_user('00000000-0000-0000-0000-0000000004d1');
DELETE FROM public.jobs_ledger_invoices WHERE id = (SELECT id FROM ids WHERE k = 'bill2');
SELECT gob.same('the deleted bill''s link is cleared',
  gob.app_words('00000000-0000-0000-0000-0000000004a1', 2),
  '2 | false | 2026-10-02 | 2026-10-02 | 10.00 | 6710.00 | 67100.00 | 15390.00 | 15390.00 | 2026-10-05 | no note | by the controller | no bill');
RESET ROLE;
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000004a1';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT gob.same('the project''s delete takes its pay applications and lines; the billing job and its bill stay',
  gob.count_of($q$SELECT count(*) FROM public.gc_owner_pay_apps$q$) || ' ' ||
  gob.count_of($q$SELECT count(*) FROM public.gc_owner_pay_app_lines$q$) || ' ' ||
  gob.count_of($q$SELECT count(*) FROM public.jobs_ledger WHERE billing_only$q$) || ' ' ||
  gob.count_of($q$SELECT count(*) FROM public.jobs_ledger_invoices i JOIN public.jobs_ledger j ON j.id = i.job_id WHERE j.billing_only$q$),
  '0 0 1 1');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing PASSED'; END $$;
ROLLBACK;
