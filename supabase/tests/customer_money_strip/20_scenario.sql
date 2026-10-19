-- The word from the thread (punch list #129 PR 3b, migration *_customer_money_strip): list_customer_money_strip answers
-- the bid's estimator with the customer's job born of their bid, its bills, payments and live words, and not the
-- customer's job of another's bid; the office gets both; a helper on the team, a stranger customer and nobody signed
-- in get nothing. Everything rolls back. Raises on the first failed assertion; ends with "customer_money_strip PASSED".
-- See scripts/pgtest-customer-money-strip.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Kim (estimator, bid B2), Rosa (assistant), Marcus (helper on J1's team), Mo (the master the
-- customer belongs to).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e7a01', 'theo@cstrip.test'),
  ('00000000-0000-0000-0000-0000000e7a02', 'kim@cstrip.test'),
  ('00000000-0000-0000-0000-0000000e7a03', 'rosa@cstrip.test'),
  ('00000000-0000-0000-0000-0000000e7a06', 'marcus@cstrip.test'),
  ('00000000-0000-0000-0000-0000000e7a07', 'mo@cstrip.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e7a01', 'theo@cstrip.test', 'CStrip Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e7a02', 'kim@cstrip.test', 'CStrip Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e7a03', 'rosa@cstrip.test', 'CStrip Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e7a06', 'marcus@cstrip.test', 'CStrip Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e7a07', 'mo@cstrip.test', 'CStrip Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e7b01', 'CStrip Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000000e7c01', '00000000-0000-0000-0000-0000000e7a07', 'Dana Whitfield'),
  ('00000000-0000-0000-0000-0000000e7c02', '00000000-0000-0000-0000-0000000e7a07', 'Lee Park');

-- B1 is Theo's, B2 Kim's; both jobs are Dana's.
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e7d01', '00000000-0000-0000-0000-0000000e7a03', '00000000-0000-0000-0000-0000000e7a01', '00000000-0000-0000-0000-0000000e7b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e7c01'),
  ('00000000-0000-0000-0000-0000000e7d02', '00000000-0000-0000-0000-0000000e7a03', '00000000-0000-0000-0000-0000000e7a02', '00000000-0000-0000-0000-0000000e7b01', 'Whitfield water heater', '00000000-0000-0000-0000-0000000e7c01');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, customer_phone, customer_email, bill_to_party, revenue, payments_made, status, bid_id, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7a07', '00000000-0000-0000-0000-0000000e7b01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e7c01', '210-555-0100', 'dana@cstrip.test', 'customer', 4200, 1200, 'billed', '00000000-0000-0000-0000-0000000e7d01', '2026-09-12T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e7f02', '00000000-0000-0000-0000-0000000e7a07', '00000000-0000-0000-0000-0000000e7b01', '1040', 'Whitfield water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e7c01', NULL, NULL, 'customer', 2900, 0, 'billed', '00000000-0000-0000-0000-0000000e7d02', '2026-10-01T15:00:00Z');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7a06');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, billed_at) VALUES
  ('00000000-0000-0000-0000-0000000e7e01', '00000000-0000-0000-0000-0000000e7f01', 0, 'billed', 4200, 'in_cstrip_1', '2026-09-30T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e7e02', '00000000-0000-0000-0000-0000000e7f02', 0, 'billed', 2900, NULL, '2026-10-01T15:00:00Z');
INSERT INTO public.jobs_ledger_payments (job_id, invoice_id, amount, paid_on, sequence_order) VALUES
  ('00000000-0000-0000-0000-0000000e7f01', '00000000-0000-0000-0000-0000000e7e01', 1200, '2026-10-02', 0);

CREATE SCHEMA cms;
CREATE FUNCTION cms.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION cms.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Dana's strip as the signed-in person, one line per job, newest first: "J1040 billed 1 bill 0 payment 0 word; J1032 …".
CREATE FUNCTION cms.strip(p_customer uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg(
      'J' || (e->'job'->>'hcp_number') || ' ' || (e->'job'->>'status') || ' bid ' || CASE WHEN e->>'bidId' IS NULL THEN '-' ELSE right(e->>'bidId', 1) END
      || ' ' || jsonb_array_length(e->'invoices') || ' bill ' || jsonb_array_length(e->'payments') || ' payment ' || jsonb_array_length(e->'promises') || ' word',
      '; ' ORDER BY e->'job'->>'hcp_number' DESC)
    FROM jsonb_array_elements(public.list_customer_money_strip(p_customer)) e), 'none')
$$;
GRANT USAGE ON SCHEMA cms TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cms TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Rosa writes Dana's word on J1, so the strip has one to carry.
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a03');
SELECT cms.same('the office writes a word on J1', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e7f01', DATE '2026-10-25', 'Dana', 'text'))->>'promisedDate', '2026-10-25');

-- 2 · Theo reads Dana's job born of his bid, with its rows, and not the one of Kim's bid.
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a01');
SELECT cms.same('Theo gets the job of his bid, with its rows, and not the other', cms.strip('00000000-0000-0000-0000-0000000e7c01'), 'J1032 billed bid 1 1 bill 1 payment 1 word');
SELECT cms.same('the job carries what the sheet needs', (SELECT (e->'job'->>'customer_name') || ' · ' || (e->'job'->>'customer_phone') || ' · ' || left(e->'invoices'->0->>'billed_at', 10) || ' · ' || (e->'payments'->0->>'amount') || ' · ' || (e->'promises'->0->>'promisedYmd') FROM jsonb_array_elements(public.list_customer_money_strip('00000000-0000-0000-0000-0000000e7c01')) e), 'Dana Whitfield · 210-555-0100 · 2026-09-30 · 1200.00 · 2026-10-25');
SELECT cms.same('a customer with no job of his gives nothing', cms.strip('00000000-0000-0000-0000-0000000e7c02'), 'none');

-- 3 · Kim gets only her bid's job; Rosa both, newest first; Marcus, on J1's team, nothing; nobody signed in, nothing.
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a02');
SELECT cms.same('Kim gets her bid''s job and not Theo''s', cms.strip('00000000-0000-0000-0000-0000000e7c01'), 'J1040 billed bid 2 1 bill 0 payment 0 word');
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a03');
SELECT cms.same('the office gets both', cms.strip('00000000-0000-0000-0000-0000000e7c01'), 'J1040 billed bid 2 1 bill 0 payment 0 word; J1032 billed bid 1 1 bill 1 payment 1 word');
SELECT cms.same('the office''s read comes newest first', (SELECT e->'job'->>'hcp_number' FROM jsonb_array_elements(public.list_customer_money_strip('00000000-0000-0000-0000-0000000e7c01')) WITH ORDINALITY AS t(e, n) WHERE n = 1), '1040');
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a06');
SELECT cms.same('a helper on the team gets nothing', cms.strip('00000000-0000-0000-0000-0000000e7c01'), 'none');
SELECT cms.as_user(NULL);
SELECT cms.same('nobody signed in gets nothing', cms.strip('00000000-0000-0000-0000-0000000e7c01'), 'none');
SELECT cms.as_user('00000000-0000-0000-0000-0000000e7a01');
SELECT cms.same('no customer, no entries', coalesce(public.list_customer_money_strip(NULL)::text, 'NULL'), '[]');

DO $$ BEGIN RAISE NOTICE 'customer_money_strip PASSED'; END $$;
ROLLBACK;
