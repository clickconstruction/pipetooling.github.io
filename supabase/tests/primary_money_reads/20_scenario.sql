-- A primary's money reads on one job (punch list #400 PR 2, migration *_primary_money_reads). Luis is a primary and
-- the account manager of J1. Pat is a primary on nothing. Kim is a primary on J3's crew and nothing more. J3 is the
-- office's. Each job has a money line and a plain line in its activity, a supply house bill, a tally part, a supply
-- house account and a payment with a line under it. Luis reads all of J1 and none of J3. Pat reads neither. Kim
-- reads J3's plain line, name and account as a crew member does, and none of its money. Rosa the assistant reads
-- both jobs, and Sam, a helper on J3's crew, reads what he read before. Everything rolls back. Raises on the first
-- failed assertion; ends with "primary_money_reads PASSED". See scripts/pgtest-primary-money-reads.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fda04', 'luis@moneyreads.test'),
  ('00000000-0000-0000-0000-0000000fda05', 'pat@moneyreads.test'),
  ('00000000-0000-0000-0000-0000000fda06', 'kim@moneyreads.test'),
  ('00000000-0000-0000-0000-0000000fda03', 'rosa@moneyreads.test'),
  ('00000000-0000-0000-0000-0000000fda07', 'mo@moneyreads.test'),
  ('00000000-0000-0000-0000-0000000fda08', 'sam@moneyreads.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fda04', 'luis@moneyreads.test', 'Reads Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fda05', 'pat@moneyreads.test', 'Reads Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fda06', 'kim@moneyreads.test', 'Reads Kim', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fda03', 'rosa@moneyreads.test', 'Reads Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fda07', 'mo@moneyreads.test', 'Reads Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000fda08', 'sam@moneyreads.test', 'Reads Sam', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- The adoption table pairs every master with every primary on prod; the bed says so outright.
INSERT INTO public.master_primaries (master_id, primary_id)
  SELECT '00000000-0000-0000-0000-0000000fda07', p FROM unnest(ARRAY['00000000-0000-0000-0000-0000000fda04', '00000000-0000-0000-0000-0000000fda05', '00000000-0000-0000-0000-0000000fda06']::uuid[]) p
  ON CONFLICT DO NOTHING;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fdb01', 'Money Reads Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fdc01', '00000000-0000-0000-0000-0000000fda07', 'Dana Whitfield');
-- J1 is Luis's. J3 is nobody's but the office's, with Kim and Sam on its crew.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fda07', '00000000-0000-0000-0000-0000000fdb01', '7101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fdc01', 'customer', 500, 40, 'billed', '00000000-0000-0000-0000-0000000fda04', 'primary'),
  ('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fda07', '00000000-0000-0000-0000-0000000fdb01', '7103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fdc01', 'customer', 900, 100, 'billed', NULL, NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fda06'),
  ('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fda08') ON CONFLICT DO NOTHING;
INSERT INTO public.job_activity_events (job_id, event_type, summary, financial, occurred_at) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', 'note', 'J1 money', true, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000fdf01', 'note', 'J1 plain', false, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000fdf03', 'note', 'J3 money', true, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000fdf03', 'note', 'J3 plain', false, now() - interval '1 hour');
INSERT INTO public.supply_houses (id, name) VALUES ('00000000-0000-0000-0000-0000000fde01', 'Reads Bed Supply');
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, invoice_date, amount) VALUES
  ('00000000-0000-0000-0000-0000000fd101', '00000000-0000-0000-0000-0000000fde01', 'RB-1', DATE '2026-11-10', 80),
  ('00000000-0000-0000-0000-0000000fd103', '00000000-0000-0000-0000-0000000fde01', 'RB-3', DATE '2026-11-11', 120);
INSERT INTO public.supply_house_invoice_job_allocations (invoice_id, job_id, pct) VALUES
  ('00000000-0000-0000-0000-0000000fd101', '00000000-0000-0000-0000-0000000fdf01', 100),
  ('00000000-0000-0000-0000-0000000fd103', '00000000-0000-0000-0000-0000000fdf03', 100);
INSERT INTO public.jobs_tally_parts (job_id, created_by_user_id, fixture_name) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fda08', 'J1 part'),
  ('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fda08', 'J3 part');
INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fde01', 'open'),
  ('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fde01', 'open');
INSERT INTO public.jobs_ledger_payments (id, job_id, amount) VALUES
  ('00000000-0000-0000-0000-0000000fdd01', '00000000-0000-0000-0000-0000000fdf01', 40),
  ('00000000-0000-0000-0000-0000000fdd03', '00000000-0000-0000-0000-0000000fdf03', 100);
INSERT INTO public.jobs_ledger_fixtures (job_id, name, count) VALUES
  ('00000000-0000-0000-0000-0000000fdf01', 'J1 line', 1),
  ('00000000-0000-0000-0000-0000000fdf03', 'J3 line', 1);

CREATE SCHEMA pmr;
CREATE FUNCTION pmr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Everything the signed-in person reads of one job, door by door. Invoker: the doors decide.
CREATE FUNCTION pmr.reads(p_job uuid, p_payment uuid) RETURNS text LANGUAGE sql AS $$
  SELECT 'gate ' || public.can_read_job_activity(p_job, true)::text || ' ' || public.can_read_job_activity(p_job, false)::text
      || ' · activity ' || coalesce((SELECT string_agg(right(summary, 5), ' ' ORDER BY summary) FROM public.list_job_activity_events(p_job) WHERE summary ~ '^J[13] (money|plain)$'), 'none')
      || ' · name ' || coalesce((SELECT hcp_number FROM public.job_account_job_identity(p_job)), 'none')
      || ' · accounts ' || (SELECT count(*) FROM public.job_supply_house_accounts WHERE job_id = p_job)::text
      || ' · bills ' || coalesce((SELECT round(invoice_amount)::text FROM public.get_invoice_amounts_for_jobs(ARRAY[p_job])), 'none')
      || ' · bill lines ' || (SELECT count(*) FROM public.get_invoice_allocation_lines_for_jobs(ARRAY[p_job]))::text
      || ' · parts ' || (SELECT count(*) FROM public.list_tally_parts_with_po() WHERE job_id = p_job)::text
      || ' · payment ' || CASE WHEN public.get_payment_line_items(p_payment) IS NULL THEN 'none' ELSE jsonb_array_length(public.get_payment_line_items(p_payment)->'items')::text END
      || ' · payments ' || (SELECT count(*) FROM jsonb_object_keys(coalesce(public.get_payment_line_items_bulk(ARRAY[p_payment]), '{}'::jsonb)))::text
$$;
-- A request for a supply house account on a job, as the signed-in person: "ok" or "refused".
CREATE FUNCTION pmr.ask_account(p_job uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, requested_by)
    VALUES (p_job, '00000000-0000-0000-0000-0000000fde02', 'requested', auth.uid());
  EXCEPTION WHEN insufficient_privilege THEN RETURN 'refused';
  END;
  RETURN 'ok';
END $$;
GRANT USAGE ON SCHEMA pmr TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmr TO anon, authenticated, service_role;
INSERT INTO public.supply_houses (id, name) VALUES ('00000000-0000-0000-0000-0000000fde02', 'Reads Bed Counter');

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing, reads neither job.
SELECT pmr.as_user('00000000-0000-0000-0000-0000000fda05');
SELECT pmr.same('Pat reads none of J3', pmr.reads('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fdd03'), 'gate false false · activity none · name none · accounts 0 · bills none · bill lines 0 · parts 0 · payment none · payments 0');
SELECT pmr.same('Pat reads none of J1', pmr.reads('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fdd01'), 'gate false false · activity none · name none · accounts 0 · bills none · bill lines 0 · parts 0 · payment none · payments 0');
SELECT pmr.same('Pat cannot ask for an account on J3', pmr.ask_account('00000000-0000-0000-0000-0000000fdf03'), 'refused');

-- 2 · Luis reads all of his own job and none of the office's.
SELECT pmr.as_user('00000000-0000-0000-0000-0000000fda04');
SELECT pmr.same('Luis reads all of J1', pmr.reads('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fdd01'), 'gate true true · activity money plain · name 7101 · accounts 1 · bills 80 · bill lines 1 · parts 1 · payment 1 · payments 1');
SELECT pmr.same('Luis reads none of J3', pmr.reads('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fdd03'), 'gate false false · activity none · name none · accounts 0 · bills none · bill lines 0 · parts 0 · payment none · payments 0');
SELECT pmr.same('Luis asks for an account on his own job', pmr.ask_account('00000000-0000-0000-0000-0000000fdf01'), 'ok');
SELECT pmr.same('Luis cannot ask for one on J3', pmr.ask_account('00000000-0000-0000-0000-0000000fdf03'), 'refused');

-- 3 · Kim, a primary on J3's crew, reads what a crew member reads there and none of its money.
SELECT pmr.as_user('00000000-0000-0000-0000-0000000fda06');
SELECT pmr.same('Kim reads J3 as its crew does', pmr.reads('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fdd03'), 'gate false true · activity plain · name 7103 · accounts 1 · bills none · bill lines 0 · parts 0 · payment none · payments 0');
SELECT pmr.same('Kim reads none of J1', pmr.reads('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fdd01'), 'gate false false · activity none · name none · accounts 0 · bills none · bill lines 0 · parts 0 · payment none · payments 0');

-- 4 · The office and the helper read as before.
SELECT pmr.as_user('00000000-0000-0000-0000-0000000fda03');
SELECT pmr.same('Rosa reads all of J3', pmr.reads('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fdd03'), 'gate true true · activity money plain · name 7103 · accounts 1 · bills 120 · bill lines 1 · parts 1 · payment 1 · payments 1');
SELECT pmr.same('Rosa reads all of J1', pmr.reads('00000000-0000-0000-0000-0000000fdf01', '00000000-0000-0000-0000-0000000fdd01'), 'gate true true · activity money plain · name 7101 · accounts 2 · bills 80 · bill lines 1 · parts 1 · payment 1 · payments 1');
SELECT pmr.as_user('00000000-0000-0000-0000-0000000fda08');
SELECT pmr.same('Sam reads J3 as its crew does', pmr.reads('00000000-0000-0000-0000-0000000fdf03', '00000000-0000-0000-0000-0000000fdd03'), 'gate false true · activity plain · name 7103 · accounts 1 · bills 120 · bill lines 1 · parts 1 · payment none · payments 0');

DO $$ BEGIN RAISE NOTICE 'primary_money_reads PASSED'; END $$;
ROLLBACK;
