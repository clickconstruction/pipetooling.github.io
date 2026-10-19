-- The money line under a won bid (punch list #129 PR 2, migration *_bid_money_strip): list_bid_money_strip answers the
-- bid's estimator with the job born of their bid, its bills, payments and live promises, and nothing for another's bid;
-- the office gets every bid's; a bid with no job yet, a bid that is not there and a helper get nothing; nobody signed
-- in gets nothing. Everything rolls back. Raises on the first failed assertion; ends with "bid_money_strip PASSED".
-- See scripts/pgtest-bid-money-strip.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Kim (estimator, bid B2), Rosa (assistant), Marcus (helper on J1's team), Mo (the master the
-- customer belongs to, since a customer's master must be a master or a dev).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e5a01', 'theo@strip.test'),
  ('00000000-0000-0000-0000-0000000e5a02', 'kim@strip.test'),
  ('00000000-0000-0000-0000-0000000e5a03', 'rosa@strip.test'),
  ('00000000-0000-0000-0000-0000000e5a06', 'marcus@strip.test'),
  ('00000000-0000-0000-0000-0000000e5a07', 'mo@strip.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e5a01', 'theo@strip.test', 'Strip Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e5a02', 'kim@strip.test', 'Strip Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e5a03', 'rosa@strip.test', 'Strip Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e5a06', 'marcus@strip.test', 'Strip Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e5a07', 'mo@strip.test', 'Strip Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e5b01', 'Strip Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000e5c01', '00000000-0000-0000-0000-0000000e5a07', 'Dana Whitfield');

-- B1 is Theo's, B2 Kim's, B3 Theo's with no job yet.
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5a03', '00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e5c01'),
  ('00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5a03', '00000000-0000-0000-0000-0000000e5a02', '00000000-0000-0000-0000-0000000e5b01', 'Park water heater', '00000000-0000-0000-0000-0000000e5c01'),
  ('00000000-0000-0000-0000-0000000e5d03', '00000000-0000-0000-0000-0000000e5a03', '00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5b01', 'Nothing yet', '00000000-0000-0000-0000-0000000e5c01');

-- J1 from B1 (an older J0 from B1 too, so the newest wins); J2 from B2.
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, customer_name, customer_id, customer_phone, customer_email, bill_to_party, revenue, payments_made, status, bid_id, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e5f00', '1031', 'Whitfield first try', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e5c01', NULL, NULL, 'customer', 100, 0, 'waiting', '00000000-0000-0000-0000-0000000e5d01', '2026-09-01T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e5f01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e5c01', '210-555-0100', 'dana@strip.test', 'customer', 4200, 1200, 'billed', '00000000-0000-0000-0000-0000000e5d01', '2026-09-12T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e5f02', '1040', 'Park water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e5c01', NULL, NULL, 'customer', 2900, 0, 'billed', '00000000-0000-0000-0000-0000000e5d02', '2026-10-01T15:00:00Z');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5a06');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, billed_at) VALUES
  ('00000000-0000-0000-0000-0000000e5e01', '00000000-0000-0000-0000-0000000e5f01', 0, 'billed', 4200, 'in_strip_1', '2026-09-30T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e5e02', '00000000-0000-0000-0000-0000000e5f02', 0, 'billed', 2900, NULL, '2026-10-01T15:00:00Z');
INSERT INTO public.jobs_ledger_payments (job_id, invoice_id, amount, paid_on, sequence_order) VALUES
  ('00000000-0000-0000-0000-0000000e5f01', '00000000-0000-0000-0000-0000000e5e01', 1200, '2026-10-02', 0);

CREATE SCHEMA bms;
CREATE FUNCTION bms.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bms.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The strip for the three bids as the signed-in person, one line per entry: "B1 J1032 billed 1 bill 1 payment 1 word".
CREATE FUNCTION bms.strip() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg(
      'B' || right(e->>'bidId', 1) || ' J' || (e->'job'->>'hcp_number') || ' ' || (e->'job'->>'status')
      || ' ' || jsonb_array_length(e->'invoices') || ' bill ' || jsonb_array_length(e->'payments') || ' payment ' || jsonb_array_length(e->'promises') || ' word',
      '; ' ORDER BY e->>'bidId')
    FROM jsonb_array_elements(public.list_bid_money_strip(ARRAY['00000000-0000-0000-0000-0000000e5d01', '00000000-0000-0000-0000-0000000e5d02', '00000000-0000-0000-0000-0000000e5d03']::uuid[])) e), 'none')
$$;
GRANT USAGE ON SCHEMA bms TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bms TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Rosa writes Dana's word on J1, so the strip has one to carry.
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a03');
SELECT bms.same('the office writes a word on J1', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e5f01', DATE '2026-10-25', 'Dana', 'text'))->>'promisedDate', '2026-10-25');

-- 2 · Theo reads his bid's job, the newest of the two, with its bill, its payment and the word; Kim's bid and the bid with no job give nothing.
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a01');
SELECT bms.same('Theo gets the newest job of his bid, with its rows', bms.strip(), 'B1 J1032 billed 1 bill 1 payment 1 word');
SELECT bms.same('the job carries what the door needs', (SELECT (e->'job'->>'customer_name') || ' · ' || (e->'job'->>'customer_phone') || ' · ' || (e->'job'->>'customer_email') FROM jsonb_array_elements(public.list_bid_money_strip(ARRAY['00000000-0000-0000-0000-0000000e5d01']::uuid[])) e), 'Dana Whitfield · 210-555-0100 · dana@strip.test');
SELECT bms.same('the bill carries its Stripe id and billed day, the payment its day', (SELECT (e->'invoices'->0->>'stripe_invoice_id') || ' · ' || left(e->'invoices'->0->>'billed_at', 10) || ' · ' || (e->'payments'->0->>'amount') || ' on ' || (e->'payments'->0->>'paid_on') FROM jsonb_array_elements(public.list_bid_money_strip(ARRAY['00000000-0000-0000-0000-0000000e5d01']::uuid[])) e), 'in_strip_1 · 2026-09-30 · 1200 on 2026-10-02');
SELECT bms.same('the word is the promise read''s shape', (SELECT (e->'promises'->0->>'promisedYmd') || ' ' || (e->'promises'->0->>'channel') || ' ' || (e->'promises'->0->>'heardByName') FROM jsonb_array_elements(public.list_bid_money_strip(ARRAY['00000000-0000-0000-0000-0000000e5d01']::uuid[])) e), '2026-10-25 text Strip Rosa');

-- 3 · Kim gets only her bid's job; Rosa gets both; Marcus, on J1's team, nothing; nobody signed in, nothing.
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a02');
SELECT bms.same('Kim gets her bid''s job and not Theo''s', bms.strip(), 'B2 J1040 billed 1 bill 0 payment 0 word');
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a03');
SELECT bms.same('the office gets both', bms.strip(), 'B1 J1032 billed 1 bill 1 payment 1 word; B2 J1040 billed 1 bill 0 payment 0 word');
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a06');
SELECT bms.same('a helper on the team gets nothing', bms.strip(), 'none');
SELECT bms.as_user(NULL);
SELECT bms.same('nobody signed in gets nothing', bms.strip(), 'none');
SELECT bms.as_user('00000000-0000-0000-0000-0000000e5a01');
SELECT bms.same('no bids asked, no entries', coalesce(public.list_bid_money_strip(NULL)::text, 'NULL'), '[]');
SELECT bms.same('a bid that is not there, no entry', public.list_bid_money_strip(ARRAY['00000000-0000-0000-0000-0000000e5d99']::uuid[])::text, '[]');

DO $$ BEGIN RAISE NOTICE 'bid_money_strip PASSED'; END $$;
ROLLBACK;
