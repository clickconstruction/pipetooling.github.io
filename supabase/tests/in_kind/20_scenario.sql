-- In kind arrangements (v2.6827, punch list #301 PR 1, migration *_in_kind_arrangements): the three tables, who reads
-- and writes a deal, and what a line does to the bills it lands on. Fixtures are written as postgres; the tries run as
-- each account under RLS; everything rolls back. Raises on the first failed assertion; ends with "in_kind PASSED". See
-- scripts/pgtest-in-kind.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev; Tess is the office (an assistant); Pat is a primary; Hal is a helper; Rae is an assistant in training
-- (read only).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003010a1', 'dee@inkind.test'),
  ('00000000-0000-0000-0000-0000003010a2', 'tess@inkind.test'),
  ('00000000-0000-0000-0000-0000003010a3', 'pat@inkind.test'),
  ('00000000-0000-0000-0000-0000003010a4', 'hal@inkind.test'),
  ('00000000-0000-0000-0000-0000003010a5', 'rae@inkind.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003010a1', 'dee@inkind.test', 'Dee Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000003010a2', 'tess@inkind.test', 'Tess Office', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000003010a3', 'pat@inkind.test', 'Pat Primary', 'primary', false, false, NULL),
  ('00000000-0000-0000-0000-0000003010a4', 'hal@inkind.test', 'Hal Helper', 'helpers', false, false, NULL),
  ('00000000-0000-0000-0000-0000003010a5', 'rae@inkind.test', 'Rae Trainee', 'assistant', true, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, archived_at = EXCLUDED.archived_at;

-- Calloway Holdings is the landlord customer; Pecan Creek is another customer.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000003010c1', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010a1'),
  ('00000000-0000-0000-0000-0000003010c2', 'Pecan Creek Gravel', '00000000-0000-0000-0000-0000003010a1');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003010f9', 'In Kind Bed Work');
-- Five billed jobs for Calloway, oldest first by their bills, and one for Pecan Creek. J4's bill is on Stripe. J5 is
-- billed with no bill row.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000003010d1', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1101', 'Shop restroom rough-in', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010c1', 'customer', 2140.00, 0, 'billed'),
  ('00000000-0000-0000-0000-0000003010d2', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1104', 'Water heater', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010c1', 'customer', 1865.50, 0, 'billed'),
  ('00000000-0000-0000-0000-0000003010d3', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1109', 'Sewer line repair', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010c1', 'customer', 3420.00, 0, 'billed'),
  ('00000000-0000-0000-0000-0000003010d4', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1113', 'Kitchen repipe', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010c1', 'customer', 500.00, 0, 'billed'),
  ('00000000-0000-0000-0000-0000003010d5', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1120', 'Hose bibs', 'Calloway Holdings', '00000000-0000-0000-0000-0000003010c1', 'customer', 300.00, 0, 'billed'),
  ('00000000-0000-0000-0000-0000003010d6', '00000000-0000-0000-0000-0000003010a1', '00000000-0000-0000-0000-0000003010f9', '1163', 'Water line repair', 'Pecan Creek Gravel', '00000000-0000-0000-0000-0000003010c2', 'customer', 2400.00, 0, 'billed');
UPDATE public.jobs_ledger SET created_at = '2026-05-05 12:00+00' WHERE id = '00000000-0000-0000-0000-0000003010d5';
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at, stripe_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000003010e1', '00000000-0000-0000-0000-0000003010d1', 0, 'billed', 2140.00, '2026-05-01 12:00+00', NULL),
  ('00000000-0000-0000-0000-0000003010e2', '00000000-0000-0000-0000-0000003010d2', 0, 'billed', 1865.50, '2026-05-02 12:00+00', NULL),
  ('00000000-0000-0000-0000-0000003010e3', '00000000-0000-0000-0000-0000003010d3', 0, 'billed', 3420.00, '2026-05-03 12:00+00', NULL),
  ('00000000-0000-0000-0000-0000003010e4', '00000000-0000-0000-0000-0000003010d4', 0, 'billed', 500.00, '2026-05-04 12:00+00', 'in_inkind_bed'),
  ('00000000-0000-0000-0000-0000003010e6', '00000000-0000-0000-0000-0000003010d6', 0, 'billed', 2400.00, '2026-10-28 12:00+00', NULL);

CREATE SCHEMA ik;
GRANT USAGE ON SCHEMA ik TO authenticated;
CREATE FUNCTION ik.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ik.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A write's outcome as a word: 'ok', or the sqlstate it raised. Runs as the caller, under RLS.
CREATE FUNCTION ik.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- The amounts a call placed, as 'job:amount' in the order placed.
CREATE FUNCTION ik.placed(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg((x ->> 'hcp_number') || ':' || (x ->> 'amount') || CASE WHEN (x ->> 'pays_off')::boolean THEN ' off' ELSE '' END, ', ' ORDER BY ord), 'none')
  FROM jsonb_array_elements(p -> 'applied') WITH ORDINALITY AS t(x, ord);
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ik TO authenticated;
CREATE TABLE ik.kept (k text PRIMARY KEY, v jsonb);
GRANT ALL ON ik.kept TO authenticated;

-- The structure.
SELECT ik.same('each table carries the twin fence and the archived seal', (
  SELECT string_agg(tablename || ':' || n, ', ' ORDER BY tablename) FROM (
    SELECT tablename, count(*)::text AS n FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('in_kind_arrangements', 'in_kind_lines', 'in_kind_line_payments')
      AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
    GROUP BY tablename) t
), 'in_kind_arrangements:4, in_kind_line_payments:4, in_kind_lines:4');
SELECT ik.same('the functions are closed to anon', (
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'in_kind_%' AND has_function_privilege('anon', p.oid, 'EXECUTE')
), NULL);

SET LOCAL ROLE authenticated;

-- Who may make a deal.
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a4');
SELECT ik.same('a helper cannot make a deal', ik.try($$INSERT INTO public.in_kind_arrangements (customer_id, what_given, created_by) VALUES ('00000000-0000-0000-0000-0000003010c1', 'Rent credit', '00000000-0000-0000-0000-0000003010a4')$$), '42501');
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a3');
SELECT ik.same('a primary cannot make a deal', ik.try($$INSERT INTO public.in_kind_arrangements (customer_id, what_given, created_by) VALUES ('00000000-0000-0000-0000-0000003010c1', 'Rent credit', '00000000-0000-0000-0000-0000003010a3')$$), '42501');
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a5');
SELECT ik.same('an office person in training cannot make a deal', (ik.try($$INSERT INTO public.in_kind_arrangements (customer_id, what_given, created_by) VALUES ('00000000-0000-0000-0000-0000003010c1', 'Rent credit', '00000000-0000-0000-0000-0000003010a5')$$) <> 'ok')::text, 'true');
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a2');
SELECT ik.same('the office cannot make a deal in another person''s name', ik.try($$INSERT INTO public.in_kind_arrangements (customer_id, what_given, created_by) VALUES ('00000000-0000-0000-0000-0000003010c1', 'Rent credit', '00000000-0000-0000-0000-0000003010a1')$$), '42501');
SELECT ik.same('a monthly amount needs its first month', ik.try($$INSERT INTO public.in_kind_arrangements (customer_id, what_given, monthly_amount, created_by) VALUES ('00000000-0000-0000-0000-0000003010c1', 'Rent credit', 1500, '00000000-0000-0000-0000-0000003010a2')$$), '23514');
INSERT INTO public.in_kind_arrangements (id, customer_id, what_given, note, monthly_amount, monthly_due, bank_payee, starts_on, created_by) VALUES
  ('00000000-0000-0000-0000-0000003010b1', '00000000-0000-0000-0000-0000003010c1', 'Rent credit, the shop', 'We pay half the rent.', 1500, 3000, 'Calloway', '2026-05-01', '00000000-0000-0000-0000-0000003010a2');
SELECT ik.same('the office makes a deal, and it keeps the customer''s name', (SELECT partner_name FROM public.in_kind_arrangements WHERE id = '00000000-0000-0000-0000-0000003010b1'), 'Calloway Holdings');

-- Which jobs it pays.
SELECT ik.same('a job of another customer is refused', public.in_kind_arrangement_set_jobs('00000000-0000-0000-0000-0000003010b1', ARRAY['00000000-0000-0000-0000-0000003010d1', '00000000-0000-0000-0000-0000003010d6']::uuid[]) ->> 'error', 'A job in the list belongs to another customer.');
SELECT ik.same('its five jobs are set', public.in_kind_arrangement_set_jobs('00000000-0000-0000-0000-0000003010b1', ARRAY['00000000-0000-0000-0000-0000003010d1', '00000000-0000-0000-0000-0000003010d2', '00000000-0000-0000-0000-0000003010d3', '00000000-0000-0000-0000-0000003010d4', '00000000-0000-0000-0000-0000003010d5']::uuid[])::text, '{"ok": true, "jobs": 5}');
SELECT ik.same('the jobs carry the deal', (SELECT count(*)::text FROM public.jobs_ledger WHERE in_kind_arrangement_id = '00000000-0000-0000-0000-0000003010b1'), '5');

-- A helper and a primary read nothing and add nothing.
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a4');
SELECT ik.same('a helper reads no deal', (SELECT count(*)::text FROM public.in_kind_arrangements), '0');
SELECT ik.same('a helper adds no line', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 100, 'Rent credit') ->> 'error', 'Only the office records what was given in kind.');
SELECT ik.same('a helper sets no jobs', public.in_kind_arrangement_set_jobs('00000000-0000-0000-0000-0000003010b1', '{}') ->> 'error', 'Only the office changes an in kind arrangement.');
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a3');
SELECT ik.same('a primary adds no line', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 100, 'Rent credit') ->> 'error', 'Only the office records what was given in kind.');
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a5');
SELECT ik.same('an office person in training adds no line', (ik.try($$SELECT public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 100, 'Rent credit')$$) <> 'ok')::text, 'true');
SELECT ik.same('and nothing was written by any of them', (SELECT count(*)::text FROM public.jobs_ledger_payments WHERE job_id IN (SELECT id FROM public.jobs_ledger WHERE customer_id = '00000000-0000-0000-0000-0000003010c1')), '0');

-- What a line refuses.
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a2');
SELECT ik.same('a line needs a memo', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 100, '  ') ->> 'error', 'Say what was given instead of money.');
SELECT ik.same('a line with no month needs an amount', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 0, 'Nothing') ->> 'error', 'Enter an amount above zero.');
SELECT ik.same('a line needs a date', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', NULL, 100, 'Rent credit') ->> 'error', 'Pick the date it was given.');
SELECT ik.same('a date that has not come is refused', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', public.app_today() + 30, 100, 'Rent credit') ->> 'error', 'That date has not come yet.');

-- The dry run says where it would go and writes nothing.
SELECT ik.same('a dry run places $3,000 on the two oldest bills', ik.placed(public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 3000, 'Rent credit, May 2026', NULL, '2026-05-01', true)), '1101:2140.00 off, 1104:860.00');
SELECT ik.same('and writes nothing', (SELECT count(*)::text FROM public.in_kind_lines) || '/' || (SELECT count(*)::text FROM public.jobs_ledger_payments WHERE payment_type = 'In kind'), '0/0');

-- May: no rent paid, the whole $3,000.
INSERT INTO ik.kept VALUES ('may', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 3000, 'Rent credit, May 2026', NULL, '2026-05-01'));
SELECT ik.same('May''s line lands on the two oldest bills', ik.placed((SELECT v FROM ik.kept WHERE k = 'may')), '1101:2140.00 off, 1104:860.00');
SELECT ik.same('as two In kind payments, each saying its part', (
  SELECT string_agg(p.amount::text || ' | ' || p.payment_type || ' | ' || p.note || ' | ' || p.paid_on::text, E'\n' ORDER BY p.amount DESC)
  FROM public.jobs_ledger_payments p JOIN public.in_kind_line_payments lp ON lp.payment_id = p.id
  WHERE lp.line_id = ((SELECT v FROM ik.kept WHERE k = 'may') ->> 'line_id')::uuid
), E'2140.00 | In kind | Rent credit, May 2026: $2,140.00 of the $3,000.00 given | 2026-05-03\n860.00 | In kind | Rent credit, May 2026: $860.00 of the $3,000.00 given | 2026-05-03');
SELECT ik.same('the first job is Paid and its bill too', (SELECT j.status || '/' || i.status FROM public.jobs_ledger j JOIN public.jobs_ledger_invoices i ON i.job_id = j.id WHERE j.id = '00000000-0000-0000-0000-0000003010d1'), 'paid/paid');
SELECT ik.same('the second job is part paid', (SELECT status || '/' || payments_made::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003010d2'), 'billed/860.00');
SELECT ik.same('a month takes one line', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-20', 1500, 'Rent credit, May 2026', NULL, '2026-05-01') ->> 'error', 'That month already has its line.');

-- June: the whole rent was paid, so no credit. The month is settled with a line of zero.
SELECT ik.same('a month with no credit is a line of zero', (public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-06-30', 0, 'No credit, June 2026. The rent was paid in full.', NULL, '2026-06-01') ->> 'ok'), 'true');
SELECT ik.same('and it writes no payment', (SELECT count(*)::text FROM public.jobs_ledger_payments WHERE payment_type = 'In kind'), '2');

-- A line outside the schedule, counted on a job: it finishes the second bill, pays the third, passes over the bill on
-- Stripe and lands on the job that was billed with no bill row.
INSERT INTO ik.kept VALUES ('big', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-07-10', 5000, '10 yards of concrete', '00000000-0000-0000-0000-0000003010d3'));
SELECT ik.same('a big line fills the open bills in order', ik.placed((SELECT v FROM ik.kept WHERE k = 'big')), '1104:1005.50 off, 1109:3420.00 off, 1120:300.00 off');
SELECT ik.same('the bill on Stripe is passed over and named', (SELECT (v -> 'held' -> 0 ->> 'hcp_number') || ' ' || (v -> 'held' -> 0 ->> 'why') || ' ' || (v -> 'held' -> 0 ->> 'open') FROM ik.kept WHERE k = 'big'), '1113 stripe 500.00');
SELECT ik.same('what found no bill is said', (SELECT v ->> 'unapplied' FROM ik.kept WHERE k = 'big'), '274.50');
SELECT ik.same('the job with no bill row is Paid by a payment on the job', (SELECT j.status || '/' || (SELECT count(*)::text FROM public.jobs_ledger_payments p WHERE p.job_id = j.id AND p.invoice_id IS NULL AND p.payment_type = 'In kind') FROM public.jobs_ledger j WHERE j.id = '00000000-0000-0000-0000-0000003010d5'), 'paid/1');
SELECT ik.same('the Stripe bill is untouched', (SELECT status || '/' || payments_made::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003010d4'), 'billed/0.00');
SELECT ik.same('the line counts on the job it was put on', (SELECT cost_job_id::text FROM public.in_kind_lines WHERE id = ((SELECT v FROM ik.kept WHERE k = 'big') ->> 'line_id')::uuid), '00000000-0000-0000-0000-0000003010d3');
SELECT ik.same('with nothing open, a line stands on no bill', ik.placed(public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-07-11', 100, 'A load of gravel', NULL, NULL, true)), 'none');

-- What a line counts as.
SELECT ik.same('a line moves to overhead', public.in_kind_line_set_cost(((SELECT v FROM ik.kept WHERE k = 'big') ->> 'line_id')::uuid, NULL)::text, '{"ok": true}');
SELECT ik.same('and reads as overhead', (SELECT (cost_job_id IS NULL)::text FROM public.in_kind_lines WHERE id = ((SELECT v FROM ik.kept WHERE k = 'big') ->> 'line_id')::uuid), 'true');
SELECT ik.same('the office cannot write a line by hand', ik.try($$UPDATE public.in_kind_lines SET amount = 1 WHERE amount > 0$$), '42501');
SELECT ik.same('or insert one', ik.try($$INSERT INTO public.in_kind_lines (arrangement_id, given_on, amount, memo) VALUES ('00000000-0000-0000-0000-0000003010b1', '2026-07-12', 5, 'By hand')$$), '42501');

-- A deal with lines on it is not deleted.
DELETE FROM public.in_kind_arrangements WHERE id = '00000000-0000-0000-0000-0000003010b1';
SELECT ik.same('a deal with lines on it stays', (SELECT count(*)::text FROM public.in_kind_arrangements), '1');

-- Taking May back: both payments leave, the bills reopen, the row stays as the record, and May is free again.
SELECT ik.same('May is taken back', public.in_kind_line_remove(((SELECT v FROM ik.kept WHERE k = 'may') ->> 'line_id')::uuid)::text, '{"ok": true, "payments_removed": 2}');
SELECT ik.same('the first job and its bill are Billed again', (SELECT j.status || '/' || i.status || '/' || j.payments_made::text FROM public.jobs_ledger j JOIN public.jobs_ledger_invoices i ON i.job_id = j.id WHERE j.id = '00000000-0000-0000-0000-0000003010d1'), 'billed/billed/0.00');
SELECT ik.same('the line stays as the record', (SELECT (removed_at IS NOT NULL)::text || '/' || (removed_by = '00000000-0000-0000-0000-0000003010a2')::text FROM public.in_kind_lines WHERE id = ((SELECT v FROM ik.kept WHERE k = 'may') ->> 'line_id')::uuid), 'true/true');
SELECT ik.same('a line is taken back once', public.in_kind_line_remove(((SELECT v FROM ik.kept WHERE k = 'may') ->> 'line_id')::uuid) ->> 'error', 'That line was already taken back.');
SELECT ik.same('May can be entered again', ik.placed(public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-05-03', 1500, 'Rent credit, May 2026', NULL, '2026-05-01')), '1101:1500.00');

RESET ROLE;
-- A payment removed from its bill by hand drops out of its line.
DELETE FROM public.jobs_ledger_payments WHERE id = (SELECT lp.payment_id FROM public.in_kind_line_payments lp JOIN public.in_kind_lines l ON l.id = lp.line_id WHERE l.amount = 5000 LIMIT 1);
SELECT ik.same('a payment removed by hand leaves its line', (SELECT count(*)::text FROM public.in_kind_line_payments lp JOIN public.in_kind_lines l ON l.id = lp.line_id WHERE l.amount = 5000), '2');
SET LOCAL ROLE authenticated;
SELECT ik.sign_in('00000000-0000-0000-0000-0000003010a2');

-- The deal ends: its jobs are let go, and it takes no more lines.
UPDATE public.in_kind_arrangements SET ended_at = now() WHERE id = '00000000-0000-0000-0000-0000003010b1';
SELECT ik.same('an ended deal lets its jobs go and says who ended it', (SELECT count(*)::text FROM public.jobs_ledger WHERE in_kind_arrangement_id IS NOT NULL) || '/' || (SELECT (ended_by = '00000000-0000-0000-0000-0000003010a2')::text FROM public.in_kind_arrangements WHERE id = '00000000-0000-0000-0000-0000003010b1'), '0/true');
SELECT ik.same('and takes no more lines', public.in_kind_line_add('00000000-0000-0000-0000-0000003010b1', '2026-07-12', 100, 'Late') ->> 'error', 'This arrangement has ended.');

-- A deal made by mistake, with nothing on it, goes.
INSERT INTO public.in_kind_arrangements (id, customer_id, what_given, created_by) VALUES
  ('00000000-0000-0000-0000-0000003010b2', '00000000-0000-0000-0000-0000003010c2', 'Road base, by the load', '00000000-0000-0000-0000-0000003010a2');
SELECT ik.same('a second deal takes the other customer''s job', public.in_kind_arrangement_set_jobs('00000000-0000-0000-0000-0000003010b2', ARRAY['00000000-0000-0000-0000-0000003010d6']::uuid[]) ->> 'ok', 'true');
DELETE FROM public.in_kind_arrangements WHERE id = '00000000-0000-0000-0000-0000003010b2';
SELECT ik.same('an empty deal is deleted and its job is let go', (SELECT count(*)::text FROM public.in_kind_arrangements WHERE id = '00000000-0000-0000-0000-0000003010b2') || '/' || (SELECT (in_kind_arrangement_id IS NULL)::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000003010d6'), '0/true');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'in_kind PASSED'; END $$;
ROLLBACK;
