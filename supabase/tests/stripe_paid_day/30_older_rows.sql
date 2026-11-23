-- The older Stripe rows go back to the day they were made (punch list #422, v2.8371, migration
-- *_stripe_paid_day_older_rows). scripts/pgtest-stripe-paid-day.sh runs this file in phases, each named by a psql
-- variable, around runs of the migration itself as db push runs it:
--   seed     rows written the way the old function wrote them, and rows that differ from them in one mark each;
--   check    after the correction (and again after a second run): the three late rows moved back a day, the rest stayed;
--   crowd    seven more late rows than the six read on prod;
--   crowded  after the correction refused them: nothing moved.
-- The container is thrown away, so the phases commit. Raises on the first failed assertion. Never against prod.
-- Every name and amount is made up. In November the company's day is UTC-6, from August to October UTC-5.
\set ON_ERROR_STOP 1

\if :{?seed}
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000005db1a1', 'ada@olderrows.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000005db1a1', 'ada@olderrows.test', 'Older Rows Ada', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000005db1b1', 'Older Rows Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000005db1c1', '00000000-0000-0000-0000-0000005db1a1', 'Ines Okafor');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1a1', '00000000-0000-0000-0000-0000005db1b1', '2291', 'Okafor repipe', 'Ines Okafor', '00000000-0000-0000-0000-0000005db1c1', 'customer', 12000, 0, 'billed');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000005db1e1', '00000000-0000-0000-0000-0000005db1f1', 0, 'billed', 9000, '2026-08-01T15:00:00Z'),
  ('00000000-0000-0000-0000-0000005db1e2', '00000000-0000-0000-0000-0000005db1f1', 1, 'billed', 3000, '2026-10-20T15:00:00Z');

-- 0–2 late: the old function's own write for a customer's payment, made in the evening and filed on the UTC date.
-- 3–4 on their day: made in the daytime, or just after midnight. 5–9 late-looking, but one mark says a person
-- named the day or it is not the function's row. 10–11 written on or after the day the fix went in.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, sequence_order, paid_on, note, payment_type, reference_number, created_by, created_at) VALUES
  ('00000000-0000-0000-0000-0000005db200', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1', 1750.00,  0, '2026-11-09', 'Stripe', NULL, NULL, NULL, '2026-11-09T03:40:24Z'),
  ('00000000-0000-0000-0000-0000005db201', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  640.00,  1, '2026-08-15', 'Stripe', NULL, NULL, NULL, '2026-08-15T04:59:02Z'),
  ('00000000-0000-0000-0000-0000005db202', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1', 2210.00,  2, '2026-10-01', 'Stripe', NULL, NULL, NULL, '2026-10-01T03:30:00Z'),
  ('00000000-0000-0000-0000-0000005db203', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  315.50,  3, '2026-11-03', 'Stripe', NULL, NULL, NULL, '2026-11-03T18:00:00Z'),
  ('00000000-0000-0000-0000-0000005db204', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  980.00,  4, '2026-11-10', 'Stripe', NULL, NULL, NULL, '2026-11-10T06:30:00Z'),
  ('00000000-0000-0000-0000-0000005db205', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  120.00,  5, '2026-11-09', 'Stripe', 'Card', NULL, NULL, '2026-11-09T03:00:00Z'),
  ('00000000-0000-0000-0000-0000005db206', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  120.00,  6, '2026-11-09', 'Stripe', NULL, '8812', NULL, '2026-11-09T03:00:00Z'),
  ('00000000-0000-0000-0000-0000005db207', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  120.00,  7, '2026-11-09', 'Stripe', NULL, NULL, '00000000-0000-0000-0000-0000005db1a1', '2026-11-09T03:00:00Z'),
  ('00000000-0000-0000-0000-0000005db208', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  450.00,  8, '2026-11-09', 'Check', NULL, NULL, NULL, '2026-11-09T03:00:00Z'),
  ('00000000-0000-0000-0000-0000005db209', '00000000-0000-0000-0000-0000005db1f1', NULL,                                     75.00,  9, '2026-11-09', 'Stripe', NULL, NULL, NULL, '2026-11-09T03:00:00Z'),
  ('00000000-0000-0000-0000-0000005db20a', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  300.00, 10, '2026-11-24', 'Stripe', NULL, NULL, NULL, '2026-11-24T02:00:00Z'),
  ('00000000-0000-0000-0000-0000005db20b', '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e1',  260.00, 11, '2026-11-24', 'Stripe', NULL, NULL, NULL, '2026-11-25T02:00:00Z');

CREATE SCHEMA spo;
CREATE FUNCTION spo.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION spo.day(p_seq integer) RETURNS text LANGUAGE sql AS $$
  SELECT paid_on::text FROM public.jobs_ledger_payments WHERE job_id = '00000000-0000-0000-0000-0000005db1f1' AND sequence_order = p_seq
$$;
-- What must not change: the money, who recorded a row, and the job's running total.
CREATE TABLE spo.before AS
  SELECT (SELECT sum(amount) FROM public.jobs_ledger_payments WHERE job_id = '00000000-0000-0000-0000-0000005db1f1')::text AS paid_sum,
         (SELECT string_agg(sequence_order || ' ' || coalesce(created_by::text, '-'), ',' ORDER BY sequence_order) FROM public.jobs_ledger_payments WHERE job_id = '00000000-0000-0000-0000-0000005db1f1') AS recorders,
         (SELECT payments_made::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000005db1f1') AS payments_made;
SELECT spo.same('the seeded late row sits on the UTC date', spo.day(0), '2026-11-09');
DO $$ BEGIN RAISE NOTICE 'older_rows seeded'; END $$;
\endif

\if :{?check}
-- 0–2 move back a day.
SELECT spo.same('a Sunday-night payment in November goes back to the Sunday', spo.day(0), '2026-11-08');
SELECT spo.same('a payment a minute before midnight in summer goes back a day', spo.day(1), '2026-08-14');
SELECT spo.same('a payment on the last evening of September goes back into September', spo.day(2), '2026-09-30');
-- 3–4 were on their day.
SELECT spo.same('a payment made at noon stays', spo.day(3), '2026-11-03');
SELECT spo.same('a payment made just after midnight stays', spo.day(4), '2026-11-10');
-- 5–9 carry a mark the function's own late row does not.
SELECT spo.same('a row with a payment type stays', spo.day(5), '2026-11-09');
SELECT spo.same('a row with a number stays', spo.day(6), '2026-11-09');
SELECT spo.same('a row a person recorded stays', spo.day(7), '2026-11-09');
SELECT spo.same('a row whose note is not Stripe stays', spo.day(8), '2026-11-09');
SELECT spo.same('a row on no bill stays', spo.day(9), '2026-11-09');
-- 10–11 were written on or after the day the fix went in.
SELECT spo.same('a day named after the fix stands', spo.day(10), '2026-11-24');
SELECT spo.same('a row the fixed function wrote stays', spo.day(11), '2026-11-24');
-- Nothing else moved.
SELECT spo.same('no amount changed', (SELECT sum(amount)::text FROM public.jobs_ledger_payments WHERE job_id = '00000000-0000-0000-0000-0000005db1f1'), (SELECT paid_sum FROM spo.before));
SELECT spo.same('who recorded each row is unchanged', (SELECT string_agg(sequence_order || ' ' || coalesce(created_by::text, '-'), ',' ORDER BY sequence_order) FROM public.jobs_ledger_payments WHERE job_id = '00000000-0000-0000-0000-0000005db1f1'), (SELECT recorders FROM spo.before));
SELECT spo.same('the job''s paid total is unchanged', (SELECT payments_made::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000005db1f1'), (SELECT payments_made FROM spo.before));
DO $$ BEGIN RAISE NOTICE 'older_rows check PASSED'; END $$;
\endif

\if :{?crowd}
-- Seven more late rows than the six read on prod, on the second bill: the correction must refuse them all.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, sequence_order, paid_on, note, created_at)
SELECT ('00000000-0000-0000-0000-0000005db2' || to_char(20 + n, 'FM00'))::uuid, '00000000-0000-0000-0000-0000005db1f1', '00000000-0000-0000-0000-0000005db1e2',
       100.00, 20 + n, DATE '2026-11-02' + n, 'Stripe', (DATE '2026-11-02' + n)::timestamp AT TIME ZONE 'UTC' + interval '2 hours'
FROM generate_series(0, 6) AS n;
SELECT spo.same('seven late rows on the second bill', (SELECT count(*)::text FROM public.jobs_ledger_payments WHERE invoice_id = '00000000-0000-0000-0000-0000005db1e2' AND paid_on = (created_at AT TIME ZONE 'UTC')::date), '7');
DO $$ BEGIN RAISE NOTICE 'older_rows crowd seeded'; END $$;
\endif

\if :{?crowded}
SELECT spo.same('the seven still sit on the UTC date', (SELECT count(*)::text FROM public.jobs_ledger_payments WHERE invoice_id = '00000000-0000-0000-0000-0000005db1e2' AND paid_on = (created_at AT TIME ZONE 'UTC')::date), '7');
SELECT spo.same('the rows moved before stay where they went', spo.day(0) || ' ' || spo.day(1) || ' ' || spo.day(2), '2026-11-08 2026-08-14 2026-09-30');
DO $$ BEGIN RAISE NOTICE 'older_rows crowded PASSED'; END $$;
\endif
