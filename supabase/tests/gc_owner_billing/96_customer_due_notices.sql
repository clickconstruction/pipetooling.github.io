-- The customer's notice 3 days before a bill is due (GC mode, Owner Billing's O12a): get_gc_customer_due_notices(
-- p_today, p_since), what the customers hear on a day, and gc_office_notices' pay_soon row. A certified pay application
-- still open hears from the third day before its due day through the day before, never on its certificate's own day,
-- once; its due day is the Monday email's (the newest promise, else the contract's days to pay here, the bed's
-- customers having no pay history). Not one waiting on the architect, paid, on card, certified before the switch's day,
-- or with no due day. The fixture is made as postgres with its days fixed in October 2026, and the list is read for a
-- named day, so the bed never depends on the day it runs. The switch is flipped as the owner and a dev. Everything
-- runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_owner_billing_customer_due_notices PASSED". See scripts/pgtest-gc-owner-billing.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000c0a01', 'pm@due.test'),
  ('00000000-0000-0000-0000-0000000c0a02', 'estimator@due.test'),
  ('00000000-0000-0000-0000-0000000c0a03', 'owner@due.test'),
  ('00000000-0000-0000-0000-0000000c0a04', 'dev@due.test'),
  ('00000000-0000-0000-0000-0000000c0a05', 'sample@due.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000c0a01', 'pm@due.test', 'Pat Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000c0a02', 'estimator@due.test', 'Eve Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000c0a03', 'owner@due.test', 'Owen Owner', 'master_technician'),
  ('00000000-0000-0000-0000-0000000c0a04', 'dev@due.test', 'Dee Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000c0a05', 'sample@due.test', 'Sam Sample', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET is_sample = true WHERE id = '00000000-0000-0000-0000-0000000c0a05';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000c0a03')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000c0e01', 'Due Bed Billing');

-- One customer; eight GC jobs, each with one pay application and what makes it hear or not:
--   A Oak Ridge Clinic: certified Oct 12, 10 days to pay, due Oct 22, $1,000 of $9,000 paid; its PM the controller.
--   B Elm Street Office: certified Oct 12, 2 days to pay, due Oct 14; its PM a sample account.
--   C Pine Hollow School: sent Oct 12, still with the architect.
--   D Cedar Point Bank: certified Oct 5, before the switch's day, due Oct 15.
--   E Birch Lane Clinic: certified Oct 12, due Oct 22, the customer on the card page (pending).
--   F Maple Court Offices: certified Oct 12, due Oct 22, put back to a check bill (undone).
--   G Walnut Ridge Hall: certified Oct 12, due Oct 22, paid in full Oct 14.
--   H Aspen Grove Lofts: certified Oct 12, no days to pay, then a promise made Oct 13 to pay by Oct 20.
INSERT INTO public.customers (id, name, master_user_id, billing_email) VALUES
  ('00000000-0000-0000-0000-0000000c0c01', 'Due Test Owner', '00000000-0000-0000-0000-0000000c0a03', 'owner-co@due.test');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000c0b01', 'Oak Ridge Clinic', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b02', 'Elm Street Office', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b03', 'Pine Hollow School', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b04', 'Cedar Point Bank', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b05', 'Birch Lane Clinic', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b06', 'Maple Court Offices', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b07', 'Walnut Ridge Hall', '00000000-0000-0000-0000-0000000c0c01'),
  ('00000000-0000-0000-0000-0000000c0b08', 'Aspen Grove Lofts', '00000000-0000-0000-0000-0000000c0c01');
-- The billing jobs carry no customer, so no payment here becomes pay history and the contract's days count.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, billing_only)
SELECT ('00000000-0000-0000-0000-0000000c1' || n || '01')::uuid, '00000000-0000-0000-0000-0000000c0a03', '00000000-0000-0000-0000-0000000c0e01', 'Due bed billing job ' || n, true
FROM generate_series(1, 8) n;
INSERT INTO public.gc_projects (project_id, stage, started_on, owner_contract_signed_on, owner_pay_days, project_manager_user_id, billing_job_id)
SELECT ('00000000-0000-0000-0000-0000000c0b0' || n)::uuid, 'building', '2026-09-01', '2026-08-20',
       CASE n WHEN 2 THEN 2 WHEN 8 THEN NULL ELSE 10 END,
       CASE n WHEN 2 THEN '00000000-0000-0000-0000-0000000c0a05'::uuid ELSE '00000000-0000-0000-0000-0000000c0a01'::uuid END,
       ('00000000-0000-0000-0000-0000000c1' || n || '01')::uuid
FROM generate_series(1, 8) n;
-- Each certified bill: the certificate's amount, billed on the billing job.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status)
SELECT ('00000000-0000-0000-0000-0000000c2' || n || '01')::uuid, ('00000000-0000-0000-0000-0000000c1' || n || '01')::uuid, 9000, 'billed'
FROM generate_series(1, 8) n WHERE n <> 3;
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, certified, certified_on, invoice_id)
SELECT ('00000000-0000-0000-0000-0000000c0d0' || n)::uuid, ('00000000-0000-0000-0000-0000000c0b0' || n)::uuid, 1, false, '2026-09-25',
       CASE n WHEN 4 THEN '2026-10-04' ELSE '2026-10-11' END::date, 10, 1000, 10000, 9000,
       CASE n WHEN 3 THEN NULL ELSE 9000 END,
       CASE n WHEN 3 THEN NULL WHEN 4 THEN '2026-10-05' ELSE '2026-10-12' END::date,
       CASE n WHEN 3 THEN NULL ELSE ('00000000-0000-0000-0000-0000000c2' || n || '01')::uuid END
FROM generate_series(1, 8) n;
-- A: $1,000 paid. G: paid in full on Oct 14.
INSERT INTO public.jobs_ledger_payments (job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000c1101', '00000000-0000-0000-0000-0000000c2101', 1000, '2026-10-13'),
  ('00000000-0000-0000-0000-0000000c1701', '00000000-0000-0000-0000-0000000c2701', 9000, '2026-10-14');
-- E on the card page; F put back to a check bill.
INSERT INTO public.gc_owner_card_bills (invoice_id, project_id, base, fee_pct, fee, status, chosen_on, chosen_how) VALUES
  ('00000000-0000-0000-0000-0000000c2501', '00000000-0000-0000-0000-0000000c0b05', 9000, 3, 270, 'pending', '2026-10-13', 'portal');
INSERT INTO public.gc_owner_card_bills (invoice_id, project_id, base, fee_pct, fee, status, chosen_on, chosen_how, stripe_invoice_id, on_card_at, undone_on) VALUES
  ('00000000-0000-0000-0000-0000000c2601', '00000000-0000-0000-0000-0000000c0b06', 9000, 3, 270, 'undone', '2026-10-13', 'portal', 'in_test_due_bed', '2026-10-13 15:00+00', '2026-10-14');

CREATE SCHEMA gcd;
CREATE FUNCTION gcd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Who hears on a day: one line per notice, its job, its due day and the open amount.
CREATE FUNCTION gcd.due(p_today date, p_since date DEFAULT NULL) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(string_agg((n->>'project') || ' ' || (n->>'dueOn') || ' ' || trim_scale((n->>'open')::numeric)::text, E'\n'
                             ORDER BY n->>'project'), 'nothing')
  FROM jsonb_array_elements(public.get_gc_customer_due_notices(p_today, p_since)->'notices') n $$;
CREATE FUNCTION gcd.notice(p_today date, p_project text) RETURNS jsonb LANGUAGE sql VOLATILE AS $$
  SELECT n FROM jsonb_array_elements(public.get_gc_customer_due_notices(p_today)->'notices') n WHERE n->>'project' = p_project $$;
CREATE FUNCTION gcd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION gcd.try(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
END $$;
GRANT USAGE ON SCHEMA gcd TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcd TO authenticated;

-- 0 · The record and the switch.
SELECT gcd.same('pay_soon is a known kind, and only it names a due day: both checks validated',
  (SELECT string_agg(conname || ' ' || convalidated::text, ' ' ORDER BY conname) FROM pg_constraint
   WHERE conrelid = 'public.gc_office_notices'::regclass AND conname IN ('gc_office_notices_kind_known', 'gc_office_notices_due_said')),
  'gc_office_notices_due_said true gc_office_notices_kind_known true');
SELECT gcd.same('the switch starts off', (SELECT value_text FROM public.app_settings WHERE key = 'gc_customer_due_notices_on_v1'), 'false');
SELECT gcd.same('off, nobody hears', gcd.due('2026-10-20'), 'nothing');

-- 1 · On since Oct 10: who hears, day by day.
UPDATE public.app_settings SET value_text = '2026-10-10' WHERE key = 'gc_customer_due_notices_on_v1';
SELECT gcd.same('Oct 12, the certificates'' own day: nobody', gcd.due('2026-10-12'), 'nothing');
SELECT gcd.same('Oct 13: Elm Street, due tomorrow (2 days to pay, so only the day before)', gcd.due('2026-10-13'), 'Elm Street Office 2026-10-14 9000');
SELECT gcd.same('Oct 14: nobody (Elm Street is due today; Cedar Point was certified before the switch)', gcd.due('2026-10-14'), 'nothing');
SELECT gcd.same('Oct 18: nobody (Oak Ridge is 4 days off; Aspen Grove promised the 20th, 2 days off, has no days to pay and no promise yet)',
  gcd.due('2026-10-18'), 'nothing');

-- H's promise, made the day after its certificate: its due day is their word.
INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, source, created_at)
VALUES ('00000000-0000-0000-0000-0000000c1801', '00000000-0000-0000-0000-0000000c0c01', '2026-10-20', 'office', '2026-10-13 17:00+00');
SELECT gcd.same('Oct 17: Aspen Grove, by the promise', gcd.due('2026-10-17'), 'Aspen Grove Lofts 2026-10-20 9000');
SELECT gcd.same('Oct 19: Aspen Grove and Oak Ridge with what is still open; Maple Court back on a check bill; not the card page, the paid one or the one with the architect',
  gcd.due('2026-10-19'), E'Aspen Grove Lofts 2026-10-20 9000\nMaple Court Offices 2026-10-22 9000\nOak Ridge Clinic 2026-10-22 8000');
SELECT gcd.same('Oct 22: nobody, it is the due day', gcd.due('2026-10-22'), 'nothing');
SELECT gcd.same('since Oct 1, Cedar Point hears on Oct 12, three days off', gcd.due('2026-10-12', '2026-10-01'), 'Cedar Point Bank 2026-10-15 9000');

-- 2 · What a notice carries.
SELECT gcd.same('Oak Ridge: the customer, its billing job, Reply-To its project manager',
  (SELECT n->>'kind' || ' ' || (n->'to'->>'name') || ' ' || (n->>'billingJobId') || ' ' || (n->'replyTo'->>'name') || ' ' || (n->'replyTo'->>'email')
     || ' ' || (n->>'certifiedOn') || ' ' || trim_scale((n->>'certified')::numeric)::text || ' ' || (n->>'promised')
   FROM gcd.notice('2026-10-19', 'Oak Ridge Clinic') n),
  'pay_soon Due Test Owner 00000000-0000-0000-0000-0000000c1101 Pat Controller pm@due.test 2026-10-12 9000 false');
SELECT gcd.same('Elm Street: its project manager a sample account, so Reply-To the owner',
  (SELECT (n->'replyTo'->>'name') || ' ' || (n->'replyTo'->>'email') FROM gcd.notice('2026-10-13', 'Elm Street Office') n), 'Owen Owner owner@due.test');
SELECT gcd.same('Aspen Grove says the day is their word', (SELECT n->>'promised' FROM gcd.notice('2026-10-17', 'Aspen Grove Lofts') n), 'true');

-- 3 · Once: the row written before the send takes it off the list, and a second row is refused.
INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, due_on, recipient_customer_id, recipient_email)
VALUES ('00000000-0000-0000-0000-0000000c0b01', 'pay_soon', '00000000-0000-0000-0000-0000000c0d01', '2026-10-22', '00000000-0000-0000-0000-0000000c0c01', 'owner-co@due.test');
SELECT gcd.same('told on Oct 19, Oak Ridge is not listed on Oct 20',
  gcd.due('2026-10-20'), E'Maple Court Offices 2026-10-22 9000');
SELECT gcd.same('a second pay_soon row on the same pay application is refused',
  gcd.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, due_on, recipient_email) VALUES ('00000000-0000-0000-0000-0000000c0b01', 'pay_soon', '00000000-0000-0000-0000-0000000c0d01', '2026-10-25', 'x@due.test')$q$), 'refused');
SELECT gcd.same('a pay_soon row must name its due day',
  gcd.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, recipient_email) VALUES ('00000000-0000-0000-0000-0000000c0b06', 'pay_soon', '00000000-0000-0000-0000-0000000c0d06', 'x@due.test')$q$), 'refused');
SELECT gcd.same('an office notice may not',
  gcd.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, due_on, recipient_email) VALUES ('00000000-0000-0000-0000-0000000c0b06', 'certify_reminder', '00000000-0000-0000-0000-0000000c0d06', '2026-10-22', 'x@due.test')$q$), 'refused');

-- 4 · Who may read the list, and who may flip the switch.
SELECT gcd.as_user('00000000-0000-0000-0000-0000000c0a04');
SET LOCAL ROLE authenticated;
SELECT gcd.same('a dev may not read the list itself (the service role''s)',
  gcd.try($q$SELECT public.get_gc_customer_due_notices('2026-10-19')$q$), 'refused');
SELECT gcd.same('a dev turns the switch on', gcd.try($q$UPDATE public.app_settings SET value_text = '2026-10-11' WHERE key = 'gc_customer_due_notices_on_v1'$q$), '1');
RESET ROLE;
SELECT gcd.as_user('00000000-0000-0000-0000-0000000c0a03');
SET LOCAL ROLE authenticated;
SELECT gcd.same('the owner turns it off', gcd.try($q$UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gc_customer_due_notices_on_v1'$q$), '1');
RESET ROLE;
SELECT gcd.as_user('00000000-0000-0000-0000-0000000c0a01');
SET LOCAL ROLE authenticated;
SELECT gcd.same('the controller may not', gcd.try($q$UPDATE public.app_settings SET value_text = '2026-10-11' WHERE key = 'gc_customer_due_notices_on_v1'$q$), '0');
RESET ROLE;
SELECT gcd.as_user('00000000-0000-0000-0000-0000000c0a02');
SET LOCAL ROLE authenticated;
SELECT gcd.same('nor an estimator', gcd.try($q$UPDATE public.app_settings SET value_text = '2026-10-11' WHERE key = 'gc_customer_due_notices_on_v1'$q$), '0');
RESET ROLE;
SELECT gcd.same('off again, nobody hears', gcd.due('2026-10-19'), 'nothing');

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_customer_due_notices PASSED'; END $$;
ROLLBACK;
