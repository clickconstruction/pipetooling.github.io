-- A payment Stripe recorded once but the books hold twice comes off (v2.5869, migration
-- *_stripe_double_row_comes_off). A $9,500 bill paid in Stripe whose webhook wrote the payment
-- twice, 2 ms apart. The later row comes off and the bill stays paid; the payment Stripe recorded is refused
-- before and after; two halves that together pay a Stripe bill are both refused. Everything rolls back. Raises on
-- the first failed assertion; ends with "stripe_double_row PASSED". See scripts/pgtest-stripe-double-row.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Mo, the master whose jobs these are.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000fd007', 'mo@double.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fd007', 'mo@double.test', 'Double Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fdb01', 'Double Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fdc01', '00000000-0000-0000-0000-0000000fd007', 'Example Builders');
-- J1 has the $9,500 Stripe bill held twice; J2 a $1,000 Stripe bill paid in two halves.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fd007', '00000000-0000-0000-0000-0000000fdb01', '931', 'Example office', 'Example Builders', '00000000-0000-0000-0000-0000000fdc01', 'customer', 48700, 0, 'working'),
  ('00000000-0000-0000-0000-0000000fdf02', '00000000-0000-0000-0000-0000000fd007', '00000000-0000-0000-0000-0000000fdb01', '932', 'Example halves', 'Example Builders', '00000000-0000-0000-0000-0000000fdc01', 'customer', 1000, 0, 'working');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at, stripe_invoice_id, stripe_invoice_status) VALUES
  ('00000000-0000-0000-0000-0000000fde01', '00000000-0000-0000-0000-0000000fdf01', 0, 'paid', 9500, '2026-08-07T18:00:00Z', 'in_bed_double', 'paid'),
  ('00000000-0000-0000-0000-0000000fde02', '00000000-0000-0000-0000-0000000fdf02', 0, 'paid', 1000, '2026-08-01T18:00:00Z', 'in_bed_halves', 'paid');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on, note, sequence_order, created_at) VALUES
  ('00000000-0000-0000-0000-0000000fd901', '00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fde01', 9500, '2026-08-10', 'Stripe', 0, '2026-08-10T20:59:21.832057Z'),
  ('00000000-0000-0000-0000-0000000fd902', '00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fde01', 9500, '2026-08-10', 'Stripe', 0, '2026-08-10T20:59:21.834427Z'),
  ('00000000-0000-0000-0000-0000000fd903', '00000000-0000-0000-0000-0000000fdf02', '00000000-0000-0000-0000-0000000fde02', 500, '2026-08-01', 'Stripe', 0, '2026-08-01T10:00:00Z'),
  ('00000000-0000-0000-0000-0000000fd904', '00000000-0000-0000-0000-0000000fdf02', '00000000-0000-0000-0000-0000000fde02', 500, '2026-08-02', 'Stripe', 1, '2026-08-02T10:00:00Z');

CREATE SCHEMA sdr;
CREATE FUNCTION sdr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sdr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION sdr.said(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN p->>'error' IS NOT NULL THEN 'refused: ' || left(p->>'error', 40) WHEN p->>'ok' = 'true' THEN 'ok' ELSE left(p::text, 60) END
$$;
CREATE FUNCTION sdr.books(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT string_agg(amount::text, ', ' ORDER BY created_at) FROM public.jobs_ledger_payments WHERE job_id = p_job), 'none')
    || ' · bill ' || (SELECT status FROM public.jobs_ledger_invoices WHERE job_id = p_job ORDER BY sequence_order LIMIT 1)
    || ' · paid ' || (SELECT payments_made::text FROM public.jobs_ledger WHERE id = p_job)
$$;
CREATE FUNCTION sdr.removed_reason(p_payment uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT kind || ' · ' || coalesce(reason, '') FROM public.jobs_ledger_payment_events WHERE payment_id = p_payment ORDER BY created_at DESC LIMIT 1), 'no line')
$$;
GRANT USAGE ON SCHEMA sdr TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sdr TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT sdr.as_user('00000000-0000-0000-0000-0000000fd007');

-- 1 · The payment Stripe recorded is refused while its double stands.
SELECT sdr.same('the first $9,500 is Stripe''s', sdr.said(public.remove_jobs_ledger_payment_and_reconcile('00000000-0000-0000-0000-0000000fd901')), 'refused: This bill is marked paid in Stripe — unwind th');

-- 2 · The double comes off; the bill stays paid at $9,500, with a history line that says why.
SELECT sdr.same('the double comes off', sdr.said(public.remove_jobs_ledger_payment_and_reconcile('00000000-0000-0000-0000-0000000fd902')), 'ok');
SELECT sdr.same('the books hold the payment once', sdr.books('00000000-0000-0000-0000-0000000fdf01'), '9500.00 · bill paid · paid 9500.00');
SELECT sdr.same('the history line names the double', sdr.removed_reason('00000000-0000-0000-0000-0000000fd902'), 'removed · double_on_stripe_bill');

-- 3 · With the double gone, the payment Stripe recorded is still refused.
SELECT sdr.same('the last $9,500 stays', sdr.said(public.remove_jobs_ledger_payment_and_reconcile('00000000-0000-0000-0000-0000000fd901')), 'refused: This bill is marked paid in Stripe — unwind th');

-- 4 · Two halves that together pay a Stripe bill are both Stripe's.
SELECT sdr.same('the first half stays', sdr.said(public.remove_jobs_ledger_payment_and_reconcile('00000000-0000-0000-0000-0000000fd903')), 'refused: This bill is marked paid in Stripe — unwind th');
SELECT sdr.same('the second half stays', sdr.said(public.remove_jobs_ledger_payment_and_reconcile('00000000-0000-0000-0000-0000000fd904')), 'refused: This bill is marked paid in Stripe — unwind th');
SELECT sdr.same('the halves are untouched', sdr.books('00000000-0000-0000-0000-0000000fdf02'), '500.00, 500.00 · bill paid · paid 1000.00');

DO $$ BEGIN RAISE NOTICE 'stripe_double_row PASSED'; END $$;
ROLLBACK;
