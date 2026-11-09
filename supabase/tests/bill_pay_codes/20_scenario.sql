-- The bill's ten-letter short code (punch list #290 PR 2, migration *_bill_pay_codes): the office asks bill_pay_code for
-- two bills and gets ten letters from the alphabet with no 0, O, 1, l or I, a second ask answers the same code, the two
-- bills differ; a primary, a training account, a twin and anon are refused; a bill not there is refused in words; the
-- unique index refuses a second bill with the same code. Everything rolls back. Raises on the first failed assertion;
-- ends with "bill_pay_codes PASSED". See scripts/pgtest-bill-pay-codes.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (an assistant), a primary, an assistant in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b9a01', 'assistant@paycode.test'),
  ('00000000-0000-0000-0000-0000000b9a02', 'primary@paycode.test'),
  ('00000000-0000-0000-0000-0000000b9a03', 'training@paycode.test'),
  ('00000000-0000-0000-0000-0000000b9a04', 'twin@paycode.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000b9a01', 'assistant@paycode.test', 'Code Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000b9a02', 'primary@paycode.test', 'Code Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000b9a03', 'training@paycode.test', 'Code Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000000b9a04', 'twin@paycode.test', 'Code Twin', 'assistant', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.customers (id, name) VALUES ('00000000-0000-0000-0000-0000000b9c01', 'Code Customer');
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000b9d01', '990', 'Pay code walk', 'Code Customer', '00000000-0000-0000-0000-0000000b9c01', 'customer', 1500, 0, 'billed');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, stripe_mode, hosted_invoice_url, stripe_invoice_status, external_send_channel) VALUES
  ('00000000-0000-0000-0000-0000000b9e01', '00000000-0000-0000-0000-0000000b9d01', 0, 'billed', 1000, 'in_pc1', 'test', 'https://invoice.stripe.com/pc1', 'open', 'stripe'),
  ('00000000-0000-0000-0000-0000000b9e02', '00000000-0000-0000-0000-0000000b9d01', 1, 'billed', 500, 'in_pc2', 'test', 'https://invoice.stripe.com/pc2', 'open', 'stripe');

CREATE SCHEMA bpc;
CREATE FUNCTION bpc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bpc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION bpc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION bpc.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END $$;
CREATE TABLE bpc.codes (n int PRIMARY KEY, code text);
GRANT USAGE ON SCHEMA bpc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bpc TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON bpc.codes TO authenticated;

-- 1 · The assistant asks for both bills' codes, and for the first a second time.
SET LOCAL ROLE authenticated;
SELECT bpc.as_user('00000000-0000-0000-0000-0000000b9a01');
INSERT INTO bpc.codes VALUES
  (1, public.bill_pay_code('00000000-0000-0000-0000-0000000b9e01')),
  (2, public.bill_pay_code('00000000-0000-0000-0000-0000000b9e02')),
  (3, public.bill_pay_code('00000000-0000-0000-0000-0000000b9e01'));
SELECT bpc.same('each code is ten letters from the 31 with no look-alikes',
  (SELECT bool_and(code ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{10}$')::text FROM bpc.codes), 'true');
SELECT bpc.same('a second ask answers the same code; the two bills differ',
  (SELECT ((SELECT code FROM bpc.codes WHERE n = 1) = (SELECT code FROM bpc.codes WHERE n = 3))::text || ' ' ||
          ((SELECT code FROM bpc.codes WHERE n = 1) <> (SELECT code FROM bpc.codes WHERE n = 2))::text), 'true true');
SELECT bpc.refused('a bill not there', $q$SELECT public.bill_pay_code('00000000-0000-0000-0000-0000000b9eff')$q$, 'not there');

-- 2 · The refusals: a primary (the table's policies), a training account (the read-only fence), a twin, anon.
SELECT bpc.as_user('00000000-0000-0000-0000-0000000b9a02');
SELECT bpc.refused('a primary', $q$SELECT public.bill_pay_code('00000000-0000-0000-0000-0000000b9e02')$q$, '');
SELECT bpc.as_user('00000000-0000-0000-0000-0000000b9a03');
SELECT bpc.refused('a training account', $q$SELECT public.bill_pay_code('00000000-0000-0000-0000-0000000b9e02')$q$, '');
SELECT bpc.as_user('00000000-0000-0000-0000-0000000b9a04');
SELECT bpc.refused('a digital twin', $q$SELECT public.bill_pay_code('00000000-0000-0000-0000-0000000b9e02')$q$, '');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT bpc.as_anon();
SELECT bpc.refused('anon', $q$SELECT public.bill_pay_code('00000000-0000-0000-0000-0000000b9e02')$q$, 'permission denied');
RESET ROLE;

-- 3 · The row keeps the code, the unique index holds, and the shape check refuses a look-alike.
SELECT bpc.same('the rows carry the codes the office got',
  (SELECT (i.pay_code = c.code)::text FROM public.jobs_ledger_invoices i JOIN bpc.codes c ON c.n = 1 WHERE i.id = '00000000-0000-0000-0000-0000000b9e01'), 'true');
SELECT bpc.refused('the same code on a second bill',
  format($q$UPDATE public.jobs_ledger_invoices SET pay_code = %L WHERE id = '00000000-0000-0000-0000-0000000b9e02'$q$, (SELECT code FROM bpc.codes WHERE n = 1)), 'jobs_ledger_invoices_pay_code_key');
SELECT bpc.refused('a code with a look-alike letter',
  $q$UPDATE public.jobs_ledger_invoices SET pay_code = 'abc1def0gh' WHERE id = '00000000-0000-0000-0000-0000000b9e02'$q$, 'jobs_ledger_invoices_pay_code_shape');
SELECT bpc.same('bill_pay_code runs as its caller', (SELECT prosecdef::text FROM pg_proc WHERE proname = 'bill_pay_code'), 'false');

DO $$ BEGIN RAISE NOTICE 'bill_pay_codes PASSED'; END $$;
ROLLBACK;
