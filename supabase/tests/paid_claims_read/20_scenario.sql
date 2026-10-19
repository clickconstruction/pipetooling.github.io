-- The office side of a paid claim (punch list #129 PR 4, migration *_paid_claims_read): list_paid_claims answers the
-- bid's estimator with the claims on the job born of their bid and not another's, the office with every claim, a
-- helper and nobody with none; a claim reads what landed on the job on or after the day they named, nothing until a
-- payment lands, then the sum and the day; a voided claim is gone; a promise is never among them. Everything rolls
-- back. Raises on the first failed assertion; ends with "paid_claims_read PASSED". See scripts/pgtest-paid-claims-read.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Kim (estimator, bid B2), Rosa (assistant), Marcus (helper on J1's team), Mo (the master).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e8a01', 'theo@claims.test'),
  ('00000000-0000-0000-0000-0000000e8a02', 'kim@claims.test'),
  ('00000000-0000-0000-0000-0000000e8a03', 'rosa@claims.test'),
  ('00000000-0000-0000-0000-0000000e8a06', 'marcus@claims.test'),
  ('00000000-0000-0000-0000-0000000e8a07', 'mo@claims.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e8a01', 'theo@claims.test', 'Claims Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e8a02', 'kim@claims.test', 'Claims Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e8a03', 'rosa@claims.test', 'Claims Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e8a06', 'marcus@claims.test', 'Claims Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e8a07', 'mo@claims.test', 'Claims Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e8b01', 'Claims Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000e8c01', '00000000-0000-0000-0000-0000000e8a07', 'Dana Whitfield');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e8d01', '00000000-0000-0000-0000-0000000e8a03', '00000000-0000-0000-0000-0000000e8a01', '00000000-0000-0000-0000-0000000e8b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e8c01'),
  ('00000000-0000-0000-0000-0000000e8d02', '00000000-0000-0000-0000-0000000e8a03', '00000000-0000-0000-0000-0000000e8a02', '00000000-0000-0000-0000-0000000e8b01', 'Park water heater', '00000000-0000-0000-0000-0000000e8c01');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, bid_id) VALUES
  ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a07', '00000000-0000-0000-0000-0000000e8b01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e8c01', 'customer', 4200, 0, 'billed', '00000000-0000-0000-0000-0000000e8d01'),
  ('00000000-0000-0000-0000-0000000e8f02', '00000000-0000-0000-0000-0000000e8a07', '00000000-0000-0000-0000-0000000e8b01', '1040', 'Park water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e8c01', 'customer', 2900, 0, 'billed', '00000000-0000-0000-0000-0000000e8d02');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000e8f01', '00000000-0000-0000-0000-0000000e8a06');

CREATE SCHEMA pcr;
CREATE FUNCTION pcr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pcr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The claims as the signed-in person, by day: "J1032 Oct 20 check_mailed - heard by Claims Theo landed 0 -; …" or "none".
CREATE FUNCTION pcr.claims() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg('J' || (e->>'jobNumber') || ' ' || to_char((e->>'paidYmd')::date, 'Mon DD') || ' ' || (e->>'method') || ' ' || coalesce(e->>'amount', '-') || ' heard by ' || (e->>'heardByName') || ' landed ' || (e->>'landedSince') || ' ' || coalesce(e->>'landedOn', '-'), '; ' ORDER BY e->>'paidYmd', e->>'jobNumber')
    FROM jsonb_array_elements(public.list_paid_claims()) e), 'none')
$$;
CREATE FUNCTION pcr.pid(p_job uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.job_payment_promises WHERE job_id = p_job AND kind = 'paid_claim' AND voided_at IS NULL LIMIT 1
$$;
GRANT USAGE ON SCHEMA pcr TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcr TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Theo writes a claim on his job and a promise beside it; Rosa writes a claim on Kim's job.
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a01');
SELECT pcr.same('Theo writes the claim on J1', (public.add_job_payment_claim('00000000-0000-0000-0000-0000000e8f01', DATE '2026-10-20', 'check_mailed', NULL, 'Dana', 'text'))->>'paidDate', '2026-10-20');
SELECT pcr.same('and a promise, which is no claim', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e8f01', DATE '2026-10-25', 'Dana', 'text'))->>'promisedDate', '2026-10-25');
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a03');
SELECT pcr.same('Rosa writes a claim on J2', (public.add_job_payment_claim('00000000-0000-0000-0000-0000000e8f02', DATE '2026-10-18', 'paid_online', 2900, 'Dana', 'phone'))->>'paidDate', '2026-10-18');

-- 2 · Who reads what.
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a01');
SELECT pcr.same('Theo reads his job''s claim, nothing landed yet, and not Kim''s', pcr.claims(), 'J1032 Oct 20 check_mailed - heard by Claims Theo landed 0 -');
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a02');
SELECT pcr.same('Kim reads her job''s', pcr.claims(), 'J1040 Oct 18 paid_online 2900 heard by Claims Rosa landed 0 -');
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a03');
SELECT pcr.same('the office reads both, by day', pcr.claims(), 'J1040 Oct 18 paid_online 2900 heard by Claims Rosa landed 0 -; J1032 Oct 20 check_mailed - heard by Claims Theo landed 0 -');
SELECT pcr.same('a claim carries its job and customer', (SELECT (e->>'jobName') || ' · ' || (e->>'customerName') || ' · ' || (e->>'jobStatus') || ' · ' || (e->>'channel') FROM jsonb_array_elements(public.list_paid_claims()) e WHERE e->>'jobNumber' = '1032'), 'Whitfield repipe · Dana Whitfield · billed · text');
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a06');
SELECT pcr.same('a helper on the team reads none', pcr.claims(), 'none');
SELECT pcr.as_user(NULL);
SELECT pcr.same('nobody signed in reads none', pcr.claims(), 'none');

-- 3 · A payment on or after the day they named reads as landed; one before it does not.
RESET ROLE;
INSERT INTO public.jobs_ledger_payments (job_id, amount, paid_on, sequence_order) VALUES ('00000000-0000-0000-0000-0000000e8f01', 1000, '2026-10-19', 0);
SET LOCAL ROLE authenticated;
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a01');
SELECT pcr.same('a payment before the day they named is not theirs', pcr.claims(), 'J1032 Oct 20 check_mailed - heard by Claims Theo landed 0 -');
RESET ROLE;
INSERT INTO public.jobs_ledger_payments (job_id, amount, paid_on, sequence_order) VALUES
  ('00000000-0000-0000-0000-0000000e8f01', 3000, '2026-10-22', 1),
  ('00000000-0000-0000-0000-0000000e8f01', 200, '2026-10-24', 2);
SET LOCAL ROLE authenticated;
SELECT pcr.as_user('00000000-0000-0000-0000-0000000e8a01');
SELECT pcr.same('what landed since, and the latest day', pcr.claims(), 'J1032 Oct 20 check_mailed - heard by Claims Theo landed 3200.00 2026-10-24');

-- 4 · A voided claim is gone.
SELECT pcr.same('Theo voids his claim', (public.void_job_payment_promise(pcr.pid('00000000-0000-0000-0000-0000000e8f01')))->>'voided', 'true');
SELECT pcr.same('and reads none', pcr.claims(), 'none');

DO $$ BEGIN RAISE NOTICE 'paid_claims_read PASSED'; END $$;
ROLLBACK;
