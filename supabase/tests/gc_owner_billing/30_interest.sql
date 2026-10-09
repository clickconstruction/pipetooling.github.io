-- Bill the interest (GC mode, Owner Billing's O6b-2): an interest bill files as the job's next one with its bill on
-- the billing job, and raises the job's revenue to the contract plus the interest billed (gc_owner_billing_revenue),
-- which the restated send and certificate keep. O4a's own readings hold: with no interest billed, the revenue is the
-- contract. Presses run through RLS as a dev, the controller, an estimator and a dev in training mode; the fixture is
-- made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion;
-- ends with "gc_owner_billing_interest PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@interest.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@interest.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'estimator@interest.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'controller@interest.test'),
  ('00000000-0000-0000-0000-0000000007d5', 'owner@interest.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@interest.test', 'Interest Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000007d2', 'trainee@interest.test', 'Interest Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000007d3', 'estimator@interest.test', 'Interest Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000007d4', 'controller@interest.test', 'Interest Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000007d5', 'owner@interest.test', 'Interest Owner', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000007d2';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000007d5')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000007c1', 'Interest Test Owner LLC', '00000000-0000-0000-0000-0000000007d5', '{"email": "owner-ap@interest.test"}');
INSERT INTO public.projects (id, name, customer_id, address) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'Interest test P', '00000000-0000-0000-0000-0000000007c1', '200 Test Way, San Antonio, TX 78201');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000007a1', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a1', 'Plumbing', 1);

CREATE SCHEMA goi;
CREATE FUNCTION goi.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION goi.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- A statement refused for any reason (a lock, a policy, the read-only block), its writes going with it.
CREATE FUNCTION goi.stopped(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION goi.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION goi.m(v numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(round(v, 2)::text, 'null') $$;
CREATE FUNCTION goi.line(p_kind text, p_package uuid, p_label text, p_worth numeric, p_done numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_kind, 'packageId', p_package, 'changeOrderId', NULL, 'label', p_label, 'worth', p_worth, 'doneToDate', p_done, 'stored', 0) $$;
-- A pay application as the window sends it, its work added up from its lines and 10% held.
CREATE FUNCTION goi.app(p_number int, p_period date, p_lines jsonb, p_due numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('number', p_number, 'final', false, 'periodTo', p_period, 'sentOn', p_period,
    'retainagePct', 10, 'retainageStep', NULL, 'retainage', round(w.work / 10, 2), 'workToDate', w.work, 'due', p_due, 'lines', p_lines)
  FROM (SELECT sum((l ->> 'doneToDate')::numeric) AS work FROM jsonb_array_elements(p_lines) l) w $$;
CREATE FUNCTION goi.lines(p_elec numeric, p_plumb numeric, p_gc numeric, p_fee numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(
    goi.line('trade', '00000000-0000-0000-0000-0000000007b1', 'Electrical', 100000, p_elec),
    goi.line('trade', '00000000-0000-0000-0000-0000000007b2', 'Plumbing', 50000, p_plumb),
    goi.line('gc', NULL, 'General conditions', 20000, p_gc),
    goi.line('contingency', NULL, 'Contingency', 5000, 0),
    goi.line('fee', NULL, 'Fee', 10000, p_fee)) $$;
-- What the checks read, whoever is signed in: the billing job's revenue and its bills, and the interest bills.
CREATE FUNCTION goi.revenue() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT goi.m(j.revenue) FROM public.gc_projects g JOIN public.jobs_ledger j ON j.id = g.billing_job_id
  WHERE g.project_id = '00000000-0000-0000-0000-0000000007a1' $$;
CREATE FUNCTION goi.bills() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(concat_ws(' ', i.sequence_order, i.status, goi.m(i.amount), CASE WHEN i.estimated_bill_date = public.app_today() THEN 'today' ELSE i.estimated_bill_date::text END),
    E'\n' ORDER BY i.sequence_order)
  FROM public.gc_projects g JOIN public.jobs_ledger_invoices i ON i.job_id = g.billing_job_id
  WHERE g.project_id = '00000000-0000-0000-0000-0000000007a1' $$;
CREATE FUNCTION goi.interest_bills() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(concat_ws(' ', b.number, (b.sent_on = public.app_today())::text, goi.m(b.amount),
    CASE WHEN b.invoice_id IS NULL THEN 'no bill' ELSE 'its bill ' || i.sequence_order END,
    CASE b.created_by WHEN '00000000-0000-0000-0000-0000000007d4' THEN 'by the controller' ELSE coalesce(b.created_by::text, 'by nobody') END),
    E'\n' ORDER BY b.number), 'none')
  FROM public.gc_owner_interest_bills b LEFT JOIN public.jobs_ledger_invoices i ON i.id = b.invoice_id
  WHERE b.project_id = '00000000-0000-0000-0000-0000000007a1' $$;
GRANT USAGE ON SCHEMA goi TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA goi TO authenticated;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON ids TO authenticated;

-- 0 · The migration: the helper and the bill are the caller's rights, for the signed in only.
SELECT goi.same('the revenue helper and the interest bill: SECURITY INVOKER, nobody signed out',
  (SELECT count(*) || ' ' || bool_and(NOT prosecdef)::text FROM pg_proc WHERE proname IN ('gc_owner_billing_revenue', 'gc_send_owner_interest_bill')) || ' ' ||
  has_function_privilege('anon', 'public.gc_send_owner_interest_bill(uuid, numeric)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.gc_owner_billing_revenue(uuid)', 'EXECUTE')::text,
  '2 true false false');

-- 1 · As the dev, O4a's readings hold: the contract signed at 185,000, the first send opens the billing job at it,
-- and the certificate's bill keeps it there.
SELECT goi.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-0000000007a1', DATE '2026-09-01',
  '{"00000000-0000-0000-0000-0000000007b1": 100000, "00000000-0000-0000-0000-0000000007b2": 50000, "gc": 20000, "contingency": 5000, "fee": 10000}');
INSERT INTO ids SELECT 'app1', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000007a1', goi.app(1, DATE '2026-09-25', goi.lines(30000, 10000, 5000, 2500), 42750));
SELECT goi.same('the first send opens the billing job at the contract', goi.revenue(), '185000.00');
INSERT INTO ids SELECT 'bill1', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app1'), 42750, DATE '2026-09-30', '');
SELECT goi.same('the certificate''s bill keeps it at the contract', goi.revenue() || ' | ' || goi.bills(), '185000.00 | 0 billed 42750.00 2026-09-30');

-- 2 · As the controller: no rate, no interest bill; the rate and the days to pay are a plain update the money team
-- may make; then the interest bill, rounded to the cent, raises the revenue.
SELECT goi.as_user('00000000-0000-0000-0000-0000000007d4');
SELECT goi.refused('an interest bill on a job that charges none',
  $q$SELECT public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 284.92)$q$, 'This job charges no interest. Set its rate first.');
UPDATE public.gc_projects SET owner_late_interest_pct_per_month = 1.5, owner_pay_days = 5 WHERE project_id = '00000000-0000-0000-0000-0000000007a1';
SELECT goi.refused('nothing to bill',
  $q$SELECT public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 0)$q$, 'There is no interest to bill.');
INSERT INTO ids SELECT 'ib1', public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 284.916);
SELECT goi.same('interest bill 1: today, to the cent, its bill second on the job, by the controller', goi.interest_bills(), '1 true 284.92 its bill 1 by the controller');
SELECT goi.same('its bill on the billing job, billed today', goi.bills(), E'0 billed 42750.00 2026-09-30\n1 billed 284.92 today');
SELECT goi.same('the revenue holds the contract and the interest; the contract stays the contract',
  goi.revenue() || ' | ' || goi.m(public.gc_owner_contract_now('00000000-0000-0000-0000-0000000007a1')), '185284.92 | 185000.00');

-- 3 · The restated send and certificate keep the interest in the revenue: pay application 2 goes and is certified.
INSERT INTO ids SELECT 'app2', public.gc_send_owner_pay_app('00000000-0000-0000-0000-0000000007a1', goi.app(2, DATE '2026-10-05', goi.lines(40000, 15000, 7000, 3100), 15840));
SELECT goi.same('the send keeps the interest in the revenue', goi.revenue(), '185284.92');
INSERT INTO ids SELECT 'bill2', public.gc_record_certificate((SELECT id FROM ids WHERE k = 'app2'), 15840, DATE '2026-10-06', '');
SELECT goi.same('so does the certificate', goi.revenue() || ' | ' || goi.bills(), E'185284.92 | 0 billed 42750.00 2026-09-30\n1 billed 284.92 today\n2 billed 15840.00 2026-10-06');
INSERT INTO ids SELECT 'ib2', public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 115.08);
SELECT goi.same('a second interest bill takes the next number, and the revenue follows',
  goi.interest_bills() || ' | ' || goi.revenue(), E'1 true 284.92 its bill 1 by the controller\n2 true 115.08 its bill 3 by the controller | 185400.00');

-- 4 · Off the money team: an estimator and a dev in training mode bill no interest.
SELECT goi.as_user('00000000-0000-0000-0000-0000000007d3');
SELECT goi.stopped('an estimator''s interest bill', $q$SELECT public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 50)$q$);
SELECT goi.as_user('00000000-0000-0000-0000-0000000007d2');
SELECT goi.stopped('a dev in training mode''s interest bill', $q$SELECT public.gc_send_owner_interest_bill('00000000-0000-0000-0000-0000000007a1', 50)$q$);
SELECT goi.same('nothing written off the money team', goi.interest_bills() || ' | ' || goi.revenue(),
  E'1 true 284.92 its bill 1 by the controller\n2 true 115.08 its bill 3 by the controller | 185400.00');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_interest PASSED'; END $$;
ROLLBACK;
