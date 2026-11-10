-- An In kind payment leaves pay speed (v2.6834, punch list #301, migration *_in_kind_leaves_pay_speed): a payment
-- written as In kind gets its exclusion row, by hand or by a line; the sampler then skips it; changing its kind away
-- takes the app's row back and never a person's. Everything rolls back. Ends with "in_kind_pay_speed PASSED". See
-- scripts/pgtest-in-kind.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000003020a1', 'dee@inkindps.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003020a1', 'dee@inkindps.test', 'Dee Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000003020c1', 'Calloway Holdings', '00000000-0000-0000-0000-0000003020a1');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003020f9', 'In Kind Pay Speed Bed');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000003020d1', '00000000-0000-0000-0000-0000003020a1', '00000000-0000-0000-0000-0000003020f9', '2101', 'Shop restroom', 'Calloway Holdings', '00000000-0000-0000-0000-0000003020c1', 'customer', 3000.00, 0, 'billed');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003020e1', '00000000-0000-0000-0000-0000003020d1', 0, 'billed', 3000.00, (public.app_today() - 40)::timestamptz + interval '18 hours');

CREATE SCHEMA ikp;
CREATE FUNCTION ikp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;

-- A cheque ten days after the bill is a sample. An In kind credit on the bill's own day is not.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, sequence_order, paid_on, payment_type, note) VALUES
  ('00000000-0000-0000-0000-0000003020b1', '00000000-0000-0000-0000-0000003020d1', '00000000-0000-0000-0000-0000003020e1', 500, 0, public.app_today() - 30, 'Check', NULL),
  ('00000000-0000-0000-0000-0000003020b2', '00000000-0000-0000-0000-0000003020d1', '00000000-0000-0000-0000-0000003020e1', 1000, 1, public.app_today() - 40, 'In kind', 'Rent credit'),
  ('00000000-0000-0000-0000-0000003020b3', '00000000-0000-0000-0000-0000003020d1', '00000000-0000-0000-0000-0000003020e1', 200, 2, public.app_today() - 39, 'in-kind', 'A load of gravel');
SELECT ikp.same('an In kind payment gets its exclusion row, in the app''s name', (
  SELECT string_agg(right(x.payment_id::text, 2) || ':' || x.excluded_by_name || ':' || (x.excluded_by IS NULL)::text, ', ' ORDER BY x.payment_id)
  FROM public.pay_speed_exclusions x WHERE x.payment_id::text LIKE '00000000-0000-0000-0000-0000003020b%'
), 'b2:The app:true, b3:The app:true');
SELECT ikp.same('pay speed samples the cheque and neither credit', (
  SELECT string_agg(right(s.payment_id::text, 2) || ':' || s.gap_days::text, ', ' ORDER BY s.payment_id) FROM public.pay_speed_samples() s WHERE s.job_id = '00000000-0000-0000-0000-0000003020d1'
), 'b1:10');

-- The kind changes.
UPDATE public.jobs_ledger_payments SET payment_type = 'Check' WHERE id = '00000000-0000-0000-0000-0000003020b3';
SELECT ikp.same('a payment that stops being In kind is counted again', (SELECT count(*)::text FROM public.pay_speed_exclusions WHERE payment_id = '00000000-0000-0000-0000-0000003020b3'), '0');
UPDATE public.jobs_ledger_payments SET payment_type = 'In kind' WHERE id = '00000000-0000-0000-0000-0000003020b1';
SELECT ikp.same('a payment that becomes In kind is left out', (SELECT count(*)::text FROM public.pay_speed_exclusions WHERE payment_id = '00000000-0000-0000-0000-0000003020b1'), '1');

-- A row a person made is theirs.
UPDATE public.pay_speed_exclusions SET excluded_by = '00000000-0000-0000-0000-0000003020a1', excluded_by_name = 'Dee Dev' WHERE payment_id = '00000000-0000-0000-0000-0000003020b1';
UPDATE public.jobs_ledger_payments SET payment_type = 'Check' WHERE id = '00000000-0000-0000-0000-0000003020b1';
SELECT ikp.same('a person''s own exclusion is never taken back', (SELECT excluded_by_name FROM public.pay_speed_exclusions WHERE payment_id = '00000000-0000-0000-0000-0000003020b1'), 'Dee Dev');
UPDATE public.jobs_ledger_payments SET amount = 1001 WHERE id = '00000000-0000-0000-0000-0000003020b2';
SELECT ikp.same('a change that is not the kind leaves the row alone', (SELECT count(*)::text FROM public.pay_speed_exclusions WHERE payment_id = '00000000-0000-0000-0000-0000003020b2'), '1');

-- A payment removed takes its row with it.
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000003020b2';
SELECT ikp.same('a removed payment takes its row with it', (SELECT count(*)::text FROM public.pay_speed_exclusions WHERE payment_id = '00000000-0000-0000-0000-0000003020b2'), '0');

DO $$ BEGIN RAISE NOTICE 'in_kind_pay_speed PASSED'; END $$;
ROLLBACK;
