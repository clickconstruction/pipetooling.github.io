-- Pay calendar (punch list #323 PR 1, migration *_payer_pay_calendars): the office sets a payer's calendar through
-- set_payer_pay_calendar and the row stamps who set it; setting it again replaces the one row; a job carries its own
-- row, or an off switch, beside the payer's; clearing removes one row and leaves the other; the billed-money roles
-- read the table and a subcontractor reads nothing; a subcontractor, a primary and a read-only office account cannot set one (the
-- controller is assistant-like and can, as with a promised pay date); a pay
-- day, a cutoff and a month count out of range, an off switch with no job, an unknown payer and an unknown job are
-- refused in words; below the function the shape and the one-row-a-payer rules hold under a direct write. Everything
-- rolls back. Raises on the first failed assertion; ends with "pay_calendar PASSED". See scripts/pgtest-pay-calendar.sh.
-- Section 8 adds the day a payer accepted a bill (PR 4). Never against prod. Every name is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa (assistant), Mo (master), Pat (primary), Cora (controller), Hank (subcontractor), Tia (assistant, read only).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000ca101', 'rosa@paycal.test'),
  ('00000000-0000-0000-0000-0000000ca102', 'mo@paycal.test'),
  ('00000000-0000-0000-0000-0000000ca103', 'pat@paycal.test'),
  ('00000000-0000-0000-0000-0000000ca104', 'cora@paycal.test'),
  ('00000000-0000-0000-0000-0000000ca105', 'hank@paycal.test'),
  ('00000000-0000-0000-0000-0000000ca106', 'tia@paycal.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000ca101', 'rosa@paycal.test', 'Paycal Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000ca102', 'mo@paycal.test', 'Paycal Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000ca103', 'pat@paycal.test', 'Paycal Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000ca104', 'cora@paycal.test', 'Paycal Cora', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000ca105', 'hank@paycal.test', 'Paycal Hank', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000ca106', 'tia@paycal.test', 'Paycal Tia', 'assistant', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000cab01', 'Paycal Plumbing');
-- Larkfield Construction (the payer, a GC) and Dana Whitfield (a homeowner with no calendar).
INSERT INTO public.customers (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000ca102', 'Larkfield Construction'),
  ('00000000-0000-0000-0000-0000000cac02', '00000000-0000-0000-0000-0000000ca102', 'Dana Whitfield');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, gc_customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000caf01', '00000000-0000-0000-0000-0000000ca102', '00000000-0000-0000-0000-0000000cab01', '1406', 'Larkfield clinic, rough-in', 'Larkfield Construction', '00000000-0000-0000-0000-0000000cac01', 'gc', 22750, 0, 'billed'),
  ('00000000-0000-0000-0000-0000000caf02', '00000000-0000-0000-0000-0000000ca102', '00000000-0000-0000-0000-0000000cab01', '1412', 'Larkfield retail shell, underground', 'Larkfield Construction', '00000000-0000-0000-0000-0000000cac01', 'gc', 9600, 0, 'billed');

CREATE SCHEMA pcal;
CREATE FUNCTION pcal.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pcal.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION pcal.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the signed-in person reads, the payer's own row first. The job is named from its id, never read from
-- jobs_ledger: a primary reads a calendar and not every job. The words: "payer in by eom paid 10 +1; job 1412 in by 25 paid 30 +1".
CREATE FUNCTION pcal.reads() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg(
      CASE WHEN c.job_id IS NULL THEN 'payer' ELSE 'job ' || CASE right(c.job_id::text, 2) WHEN '01' THEN '1406' WHEN '02' THEN '1412' ELSE '?' END END
      || CASE WHEN c.off THEN ' off' ELSE ' in by ' || coalesce(c.cutoff_day::text, 'eom') || ' paid ' || c.pay_day || ' +' || c.months_after || CASE WHEN c.pay_when_paid THEN ' when paid' ELSE '' END END,
      '; ' ORDER BY (c.job_id IS NOT NULL), c.job_id)
    FROM public.payer_pay_calendars c WHERE c.payer_customer_id = '00000000-0000-0000-0000-0000000cac01'), 'nothing')
$$;
CREATE FUNCTION pcal.set_by() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT u.name FROM public.payer_pay_calendars c JOIN public.users u ON u.id = c.set_by WHERE c.payer_customer_id = '00000000-0000-0000-0000-0000000cac01' AND c.job_id IS NULL), 'nobody')
$$;
CREATE FUNCTION pcal.rows() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.payer_pay_calendars WHERE payer_customer_id = '00000000-0000-0000-0000-0000000cac01'
$$;
GRANT USAGE ON SCHEMA pcal TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcal TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Rosa sets the payer's calendar: in by the last day of the month, paid the 10th of the next.
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca101');
SELECT pcal.same('with no row the office reads nothing', pcal.reads(), 'nothing');
SELECT pcal.same('Rosa sets it', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"cutoffDay": null, "payDay": 10, "monthsAfter": 1, "clause": " § 5.2 ", "words": "Paid the 10th of the month after it is received."}'))->>'pay_day', '10');
SELECT pcal.same('the office reads it', pcal.reads(), 'payer in by eom paid 10 +1');
SELECT pcal.same('it is stamped with who set it', pcal.set_by(), 'Paycal Rosa');
SELECT pcal.same('the clause is trimmed', (SELECT clause FROM public.payer_pay_calendars WHERE payer_customer_id = '00000000-0000-0000-0000-0000000cac01' AND job_id IS NULL), '§ 5.2');

-- 2 · Mo sets it again: one row, replaced, with the month count defaulted and pay when paid kept.
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca102');
SELECT pcal.same('Mo replaces it', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"cutoffDay": 25, "payDay": 30, "payWhenPaid": true}'))->>'cutoff_day', '25');
SELECT pcal.same('one row, the new one', pcal.reads(), 'payer in by 25 paid 30 +1 when paid');
SELECT pcal.same('stamped again', pcal.set_by(), 'Paycal Mo');

-- 3 · A job carries its own, another switches the payer's off; clearing one leaves the rest.
SELECT pcal.same('job 1412 gets its own', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000caf02', '{"cutoffDay": 20, "payDay": 10, "monthsAfter": 2}'))->>'months_after', '2');
SELECT pcal.same('job 1406 switches it off', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000caf01', '{"off": true}'))->>'off', 'true');
SELECT pcal.same('three rows read', pcal.reads(), 'payer in by 25 paid 30 +1 when paid; job 1406 off; job 1412 in by 20 paid 10 +2');
SELECT pcal.same('clearing job 1406', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000caf01', NULL))->>'cleared', 'true');
SELECT pcal.same('leaves the other two', pcal.reads(), 'payer in by 25 paid 30 +1 when paid; job 1412 in by 20 paid 10 +2');
SELECT pcal.same('clearing the payer''s', (public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, NULL))->>'cleared', 'true');
SELECT pcal.same('leaves the job''s', pcal.reads(), 'job 1412 in by 20 paid 10 +2');

-- 4 · Who reads: the billed-money roles. A subcontractor reads nothing though the row is there.
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca103');
SELECT pcal.same('Pat, a primary, reads', pcal.reads(), 'job 1412 in by 20 paid 10 +2');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca104');
SELECT pcal.same('Cora, the controller, reads', pcal.reads(), 'job 1412 in by 20 paid 10 +2');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca105');
SELECT pcal.same('Hank, a subcontractor, reads nothing', pcal.reads(), 'nothing');
SELECT pcal.same('though one row is there', pcal.rows(), '1');

-- 5 · Who cannot set one.
SELECT pcal.refused('Hank cannot set one', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 10}')$q$, 'Not allowed to set a pay calendar');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca103');
SELECT pcal.refused('Pat reads and cannot set', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 10}')$q$, 'Not allowed to set a pay calendar');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca106');
SELECT pcal.refused('Tia, in training mode, cannot set one', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 10}')$q$, '');
SELECT pcal.refused('nobody writes the table directly', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id, pay_day) VALUES ('00000000-0000-0000-0000-0000000cac02', 10)$q$, 'permission denied');

-- 6 · The refusals, in words.
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca101');
SELECT pcal.refused('no pay day', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"cutoffDay": 25}')$q$, 'The pay day is a day of the month');
SELECT pcal.refused('a pay day no month has', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 32}')$q$, 'The pay day is a day of the month');
SELECT pcal.refused('a cutoff past the 28th', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 10, "cutoffDay": 30}')$q$, 'The cutoff is the last day of the month');
SELECT pcal.refused('three months on', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"payDay": 10, "monthsAfter": 3}')$q$, 'The pay day is in the same month');
SELECT pcal.refused('an off switch with no job', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', NULL, '{"off": true}')$q$, 'Only a job can switch a pay calendar off');
SELECT pcal.refused('a payer that is not one', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac99', NULL, '{"payDay": 10}')$q$, 'Payer not found');
SELECT pcal.refused('a job that is not one', $q$SELECT public.set_payer_pay_calendar('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000caf99', '{"payDay": 10}')$q$, 'Job not found');
SELECT pcal.same('a refused set leaves the job''s row and adds none', pcal.reads(), 'job 1412 in by 20 paid 10 +2');

-- 7 · Below the function: the shape and the one row a payer.
RESET ROLE;
SELECT pcal.refused('a calendar with no pay day', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id) VALUES ('00000000-0000-0000-0000-0000000cac02')$q$, 'payer_pay_calendars_shape_check');
SELECT pcal.refused('an off switch on the payer''s own row', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id, off) VALUES ('00000000-0000-0000-0000-0000000cac02', true)$q$, 'payer_pay_calendars_shape_check');
SELECT pcal.refused('a cutoff on the 29th', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id, pay_day, cutoff_day) VALUES ('00000000-0000-0000-0000-0000000cac02', 10, 29)$q$, 'payer_pay_calendars_cutoff_day_check');
INSERT INTO public.payer_pay_calendars (payer_customer_id, pay_day) VALUES ('00000000-0000-0000-0000-0000000cac02', 10);
SELECT pcal.refused('a second row for one payer', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id, pay_day) VALUES ('00000000-0000-0000-0000-0000000cac02', 15)$q$, 'payer_pay_calendars_payer_uidx');
SELECT pcal.refused('a second row for one payer and job', $q$INSERT INTO public.payer_pay_calendars (payer_customer_id, job_id, pay_day) VALUES ('00000000-0000-0000-0000-0000000cac01', '00000000-0000-0000-0000-0000000caf02', 15)$q$, 'payer_pay_calendars_payer_job_uidx');
-- A payer that is deleted takes its calendars with it.
DELETE FROM public.customers WHERE id = '00000000-0000-0000-0000-0000000cac02';
SELECT pcal.same('a deleted payer''s calendar goes with it', (SELECT count(*)::text FROM public.payer_pay_calendars WHERE payer_customer_id = '00000000-0000-0000-0000-0000000cac02'), '0');

-- 8 · The day a payer accepted a bill (PR 4, migration *_invoice_payer_acceptances): the office sets it on one bill,
-- a second set replaces it, the billed-money roles read it and a subcontractor reads nothing, a primary and a
-- subcontractor cannot set it, an unknown bill is refused in words, and clearing leaves no row.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount) VALUES
  ('00000000-0000-0000-0000-0000000cad01', '00000000-0000-0000-0000-0000000caf01', 1, 'billed', 22750);
CREATE FUNCTION pcal.accepted() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((SELECT accepted_on::text FROM public.invoice_payer_acceptances WHERE invoice_id = '00000000-0000-0000-0000-0000000cad01'), 'none')
$$;
CREATE FUNCTION pcal.accepted_by() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT u.name FROM public.invoice_payer_acceptances a JOIN public.users u ON u.id = a.marked_by WHERE a.invoice_id = '00000000-0000-0000-0000-0000000cad01'), 'nobody')
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcal TO anon, authenticated, service_role;
SET LOCAL ROLE authenticated;
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca101');
SELECT pcal.same('no accepted day to begin with', pcal.accepted(), 'none');
SELECT pcal.same('Rosa sets the accepted day', (public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad01', DATE '2026-12-02'))->>'acceptedOn', '2026-12-02');
SELECT pcal.same('the office reads it', pcal.accepted(), '2026-12-02');
SELECT pcal.same('stamped with who marked it', pcal.accepted_by(), 'Paycal Rosa');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca102');
SELECT pcal.same('Mo replaces it', (public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad01', DATE '2026-12-03'))->>'acceptedOn', '2026-12-03');
SELECT pcal.same('one row, the new day', pcal.accepted(), '2026-12-03');
SELECT pcal.same('stamped again', pcal.accepted_by(), 'Paycal Mo');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca103');
SELECT pcal.same('Pat, a primary, reads it', pcal.accepted(), '2026-12-03');
SELECT pcal.refused('Pat cannot set it', $q$SELECT public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad01', DATE '2026-12-04')$q$, 'Not allowed to set the day a bill was accepted');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca105');
SELECT pcal.same('Hank, a subcontractor, reads nothing', pcal.accepted(), 'none');
SELECT pcal.refused('Hank cannot set it', $q$SELECT public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad01', DATE '2026-12-04')$q$, 'Not allowed to set the day a bill was accepted');
SELECT pcal.as_user('00000000-0000-0000-0000-0000000ca101');
SELECT pcal.refused('a bill that is not one', $q$SELECT public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad99', DATE '2026-12-04')$q$, 'Bill not found');
SELECT pcal.refused('nobody writes the table directly', $q$INSERT INTO public.invoice_payer_acceptances (invoice_id, accepted_on) VALUES ('00000000-0000-0000-0000-0000000cad01', DATE '2026-12-05')$q$, 'permission denied');
SELECT pcal.same('clearing it', (public.set_invoice_payer_accepted_on('00000000-0000-0000-0000-0000000cad01', NULL))->>'cleared', 'true');
SELECT pcal.same('leaves no row', pcal.accepted(), 'none');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'pay_calendar PASSED'; END $$;
ROLLBACK;
