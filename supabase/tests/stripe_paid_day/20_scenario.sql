-- A Stripe payment is filed on the company's day (punch list #422, PR 2, migration *_stripe_paid_day_is_the_company_day).
-- mark_invoice_paid_from_stripe, called as stripe-webhook calls it: with no day for a customer's own payment, with a
-- day for a bill marked paid outside Stripe, and twice for the two events Stripe sends. Everything rolls back. Raises
-- on the first failed assertion; ends with "stripe_paid_day PASSED". See scripts/pgtest-stripe-paid-day.sh. Never
-- against prod. Every name and amount is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000005daa07', 'mo@paidday.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000005daa07', 'mo@paidday.test', 'Paid Day Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000005dab01', 'Paid Day Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000005dac01', '00000000-0000-0000-0000-0000005daa07', 'Tamsin Reyes');
-- J1 is paid by the customer through Stripe. J2 is a Stripe bill marked paid outside Stripe, by check.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000005daf01', '00000000-0000-0000-0000-0000005daa07', '00000000-0000-0000-0000-0000005dab01', '1436', 'Reyes water heater', 'Tamsin Reyes', '00000000-0000-0000-0000-0000005dac01', 'customer', 1750, 0, 'billed'),
  ('00000000-0000-0000-0000-0000005daf02', '00000000-0000-0000-0000-0000005daa07', '00000000-0000-0000-0000-0000005dab01', '1437', 'Reyes hose bib', 'Tamsin Reyes', '00000000-0000-0000-0000-0000005dac01', 'customer', 640, 0, 'billed');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000005dae01', '00000000-0000-0000-0000-0000005daf01', 0, 'billed', 1750, '2026-11-20T15:00:00Z'),
  ('00000000-0000-0000-0000-0000005dae02', '00000000-0000-0000-0000-0000005daf02', 0, 'billed', 640, '2026-11-20T15:00:00Z');

CREATE SCHEMA spd;
CREATE FUNCTION spd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- "ok" or the error's first words, from the function's jsonb answer.
CREATE FUNCTION spd.said(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN p->>'error' IS NOT NULL THEN 'refused: ' || left(p->>'error', 40) WHEN p->>'ok' = 'true' THEN 'ok' ELSE left(p::text, 60) END
$$;
-- A bill's payment rows as one line each: amount, day, type, number, note.
CREATE FUNCTION spd.rows_of(p_invoice uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT string_agg(concat_ws(' | ', amount::text, paid_on::text, coalesce(payment_type, '-'), coalesce(reference_number, '-'), coalesce(note, '-')), E'\n' ORDER BY sequence_order) FROM public.jobs_ledger_payments WHERE invoice_id = p_invoice), 'none')
$$;
GRANT USAGE ON SCHEMA spd TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spd TO anon, authenticated, service_role;

-- 0 · The function no longer reads the UTC clock for a day, at any hour this bed runs, and only the service role runs it.
SELECT spd.same('the body names no UTC day', (position('AT TIME ZONE ''UTC''' IN pg_get_functiondef('public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)'::regprocedure)) = 0)::text, 'true');
SELECT spd.same('the body asks for the company''s day', (position('public.app_today()' IN pg_get_functiondef('public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)'::regprocedure)) > 0)::text, 'true');
SELECT spd.same('anon cannot run it', has_function_privilege('anon', 'public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)', 'EXECUTE')::text, 'false');
SELECT spd.same('a signed-in person cannot run it', has_function_privilege('authenticated', 'public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)', 'EXECUTE')::text, 'false');
SELECT spd.same('the service role can', has_function_privilege('service_role', 'public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid)', 'EXECUTE')::text, 'true');

-- The webhook's own role.
SET LOCAL ROLE service_role;

-- 1 · A customer pays through Stripe: no day is named, so the row takes the company's day, with the note Stripe.
SELECT spd.same('Stripe says J1''s bill is paid', spd.said(public.mark_invoice_paid_from_stripe('00000000-0000-0000-0000-0000005dae01')), 'ok');
SELECT spd.same('one row for the whole bill, on the company''s day', spd.rows_of('00000000-0000-0000-0000-0000005dae01'), '1750.00 | ' || (now() AT TIME ZONE 'America/Chicago')::date::text || ' | - | - | Stripe');
SELECT spd.same('that day is app_today', (SELECT paid_on::text FROM public.jobs_ledger_payments WHERE invoice_id = '00000000-0000-0000-0000-0000005dae01'), public.app_today()::text);
SELECT spd.same('the bill is paid', (SELECT status FROM public.jobs_ledger_invoices WHERE id = '00000000-0000-0000-0000-0000005dae01'), 'paid');
SELECT spd.same('the job is paid', (SELECT status FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-0000005daf01'), 'paid');

-- 2 · Stripe sends two events for one payment: the second changes nothing.
SELECT spd.same('the second event is answered ok', spd.said(public.mark_invoice_paid_from_stripe('00000000-0000-0000-0000-0000005dae01')), 'ok');
SELECT spd.same('still one row', spd.rows_of('00000000-0000-0000-0000-0000005dae01'), '1750.00 | ' || public.app_today()::text || ' | - | - | Stripe');

-- 3 · A bill marked paid outside Stripe names its own day, type and number: the day named stands.
SELECT spd.same('a check on J2''s bill, dated by the office', spd.said(public.mark_invoice_paid_from_stripe('00000000-0000-0000-0000-0000005dae02', 'Check', '4417', DATE '2026-10-19', NULL, '00000000-0000-0000-0000-0000005daa07')), 'ok');
SELECT spd.same('the row keeps the day the office named', spd.rows_of('00000000-0000-0000-0000-0000005dae02'), '640.00 | 2026-10-19 | Check | 4417 | -');
SELECT spd.same('and who recorded it', (SELECT created_by::text FROM public.jobs_ledger_payments WHERE invoice_id = '00000000-0000-0000-0000-0000005dae02'), '00000000-0000-0000-0000-0000005daa07');

-- 4 · A bill it does not know is refused in words.
SELECT spd.same('an unknown bill', spd.said(public.mark_invoice_paid_from_stripe('00000000-0000-0000-0000-0000005dae99')), 'refused: Invoice not found');

DO $$ BEGIN RAISE NOTICE 'stripe_paid_day PASSED'; END $$;
ROLLBACK;
