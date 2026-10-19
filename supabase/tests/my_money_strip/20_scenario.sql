-- Money on my bids (punch list #129 PR 5, migration *_my_money_strip): list_my_money_strip answers the estimator with
-- the jobs of the bids they estimated, the account manager with the jobs they hold on the job or the bid, the office
-- with what it holds and nothing more, a helper on a team and nobody signed in with none; each entry carries its bid,
-- its bills, payments and words. Everything rolls back. Raises on the first failed assertion; ends with
-- "my_money_strip PASSED". See scripts/pgtest-my-money-strip.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Kim (estimator, bid B2, its account manager too), Rosa (assistant, J3's account manager),
-- Luis (primary, J1's account manager), Marcus (helper on J1's team), Mo (the master).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e9a01', 'theo@mine.test'),
  ('00000000-0000-0000-0000-0000000e9a02', 'kim@mine.test'),
  ('00000000-0000-0000-0000-0000000e9a03', 'rosa@mine.test'),
  ('00000000-0000-0000-0000-0000000e9a04', 'luis@mine.test'),
  ('00000000-0000-0000-0000-0000000e9a06', 'marcus@mine.test'),
  ('00000000-0000-0000-0000-0000000e9a07', 'mo@mine.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e9a01', 'theo@mine.test', 'Mine Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e9a02', 'kim@mine.test', 'Mine Kim', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e9a03', 'rosa@mine.test', 'Mine Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e9a04', 'luis@mine.test', 'Mine Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e9a06', 'marcus@mine.test', 'Mine Marcus', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e9a07', 'mo@mine.test', 'Mine Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e9b01', 'Mine Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000e9c01', '00000000-0000-0000-0000-0000000e9a07', 'Dana Whitfield');
INSERT INTO public.bids (id, created_by, estimator_id, account_manager_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e9d01', '00000000-0000-0000-0000-0000000e9a03', '00000000-0000-0000-0000-0000000e9a01', NULL, '00000000-0000-0000-0000-0000000e9b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e9c01'),
  ('00000000-0000-0000-0000-0000000e9d02', '00000000-0000-0000-0000-0000000e9a03', '00000000-0000-0000-0000-0000000e9a02', '00000000-0000-0000-0000-0000000e9a02', '00000000-0000-0000-0000-0000000e9b01', 'Park water heater', '00000000-0000-0000-0000-0000000e9c01');
-- J1 from B1 with Luis as account manager; J2 from B2; J3 from no bid with Rosa as account manager; J4 from no bid, nobody's.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, bid_id, account_manager_user_id, account_manager_relationship, created_at) VALUES
  ('00000000-0000-0000-0000-0000000e9f01', '00000000-0000-0000-0000-0000000e9a07', '00000000-0000-0000-0000-0000000e9b01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e9c01', 'customer', 4200, 0, 'billed', '00000000-0000-0000-0000-0000000e9d01', '00000000-0000-0000-0000-0000000e9a04', 'primary', '2026-09-12T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e9f02', '00000000-0000-0000-0000-0000000e9a07', '00000000-0000-0000-0000-0000000e9b01', '1040', 'Park water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e9c01', 'customer', 2900, 0, 'billed', '00000000-0000-0000-0000-0000000e9d02', NULL, NULL, '2026-10-01T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e9f03', '00000000-0000-0000-0000-0000000e9a07', '00000000-0000-0000-0000-0000000e9b01', '1037', 'Ortega gas line', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e9c01', 'customer', 4800, 0, 'billed', NULL, '00000000-0000-0000-0000-0000000e9a03', 'primary', '2026-10-05T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000e9f04', '00000000-0000-0000-0000-0000000e9a07', '00000000-0000-0000-0000-0000000e9b01', '1050', 'Nobody''s job', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e9c01', 'customer', 100, 0, 'billed', NULL, NULL, NULL, '2026-10-06T15:00:00Z');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000e9f01', '00000000-0000-0000-0000-0000000e9a04'),
  ('00000000-0000-0000-0000-0000000e9f01', '00000000-0000-0000-0000-0000000e9a06'),
  ('00000000-0000-0000-0000-0000000e9f03', '00000000-0000-0000-0000-0000000e9a03');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id, billed_at) VALUES
  ('00000000-0000-0000-0000-0000000e9e01', '00000000-0000-0000-0000-0000000e9f01', 0, 'billed', 4200, 'in_mine_1', '2026-09-30T15:00:00Z');

CREATE SCHEMA mms;
CREATE FUNCTION mms.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mms.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Mine as the signed-in person, newest first: "J1037 bid -; J1032 bid 1 1 bill" or "none".
CREATE FUNCTION mms.mine() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg('J' || (e->'job'->>'hcp_number') || ' bid ' || CASE WHEN e->>'bidId' IS NULL THEN '-' ELSE right(e->>'bidId', 1) END || ' ' || jsonb_array_length(e->'invoices') || ' bill', '; ' ORDER BY e->'job'->>'created_at' DESC)
    FROM jsonb_array_elements(public.list_my_money_strip()) e), 'none')
$$;
GRANT USAGE ON SCHEMA mms TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mms TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

SELECT mms.as_user('00000000-0000-0000-0000-0000000e9a01');
SELECT mms.same('Theo gets the job of the bid he estimated, with its bill', mms.mine(), 'J1032 bid 1 1 bill');
SELECT mms.as_user('00000000-0000-0000-0000-0000000e9a02');
SELECT mms.same('Kim gets the job of her bid, as its estimator and account manager, once', mms.mine(), 'J1040 bid 2 0 bill');
SELECT mms.as_user('00000000-0000-0000-0000-0000000e9a04');
SELECT mms.same('Luis, the account manager on J1, gets it', mms.mine(), 'J1032 bid 1 1 bill');
SELECT mms.as_user('00000000-0000-0000-0000-0000000e9a03');
SELECT mms.same('Rosa, the office, gets only the job she account-manages', mms.mine(), 'J1037 bid - 0 bill');
SELECT mms.as_user('00000000-0000-0000-0000-0000000e9a06');
SELECT mms.same('Marcus, a helper on J1''s team, gets none', mms.mine(), 'none');
SELECT mms.as_user(NULL);
SELECT mms.same('nobody signed in gets none', mms.mine(), 'none');

DO $$ BEGIN RAISE NOTICE 'my_money_strip PASSED'; END $$;
ROLLBACK;
