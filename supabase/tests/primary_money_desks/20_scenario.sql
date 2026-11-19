-- The money desks close to a primary (punch list #400 PR 5, migration *_primary_money_desks). Pat is a primary on
-- nothing and Luis is a primary who account-manages J1. Neither opens a desk door: the bank payments desk, returned
-- checks and disputes, the pay speed lines or the GC review week. The reads the Bill tab of a primary's own job
-- draws from stay open to both, as before: the pay speeds, the promised dates, the promises and the returned-check
-- payers. Rosa the assistant, Cal the controller and Mo the master pass every door as before.
-- Everything rolls back. Raises on the first failed assertion; ends with "primary_money_desks PASSED". See
-- scripts/pgtest-primary-money-desks.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000fca04', 'luis@moneydesks.test'),
  ('00000000-0000-0000-0000-0000000fca05', 'pat@moneydesks.test'),
  ('00000000-0000-0000-0000-0000000fca03', 'rosa@moneydesks.test'),
  ('00000000-0000-0000-0000-0000000fca06', 'cal@moneydesks.test'),
  ('00000000-0000-0000-0000-0000000fca07', 'mo@moneydesks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000fca04', 'luis@moneydesks.test', 'Desks Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fca05', 'pat@moneydesks.test', 'Desks Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000fca03', 'rosa@moneydesks.test', 'Desks Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000fca06', 'cal@moneydesks.test', 'Desks Cal', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000fca07', 'mo@moneydesks.test', 'Desks Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fcb01', 'Money Desks Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fcc01', '00000000-0000-0000-0000-0000000fca07', 'Dana Whitfield');
-- J1 is Luis's. J3 is nobody's but the office's.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000fcf01', '00000000-0000-0000-0000-0000000fca07', '00000000-0000-0000-0000-0000000fcb01', '6101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fcc01', 'customer', 500, 0, 'billed', '00000000-0000-0000-0000-0000000fca04', 'primary'),
  ('00000000-0000-0000-0000-0000000fcf03', '00000000-0000-0000-0000-0000000fca07', '00000000-0000-0000-0000-0000000fcb01', '6103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fcc01', 'customer', 900, 100, 'billed', NULL, NULL);
-- A payment on J3 that no bank deposit carries, a promise on each job, and one open case of each kind.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, paid_on) VALUES ('00000000-0000-0000-0000-0000000fcd03', '00000000-0000-0000-0000-0000000fcf03', 100, current_date);
INSERT INTO public.job_payment_promises (job_id, promised_date) VALUES
  ('00000000-0000-0000-0000-0000000fcf01', current_date + 3),
  ('00000000-0000-0000-0000-0000000fcf03', current_date + 4);
INSERT INTO public.ar_stripe_cases (kind, stripe_object_id, amount) VALUES ('dispute', 'dp_money_desks_bed', 50);
INSERT INTO public.ar_unbanked_check_cases (payment_id, amount) VALUES ('00000000-0000-0000-0000-0000000fcd03', 100);

CREATE SCHEMA pmd;
CREATE FUNCTION pmd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A door's answer in a few words: "shut" when it raises or answers its not-authorized refusal, "null" when it
-- answers nothing at all, and "open" for anything else, a later refusal about the made-up id included.
CREATE FUNCTION pmd.ask(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  BEGIN
    EXECUTE 'select to_jsonb((' || p_sql || '))' INTO v;
  EXCEPTION WHEN OTHERS THEN
    RETURN CASE WHEN SQLERRM ~* 'not authorized|only the office' THEN 'shut' ELSE 'open' END;
  END;
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN 'null'; END IF;
  IF jsonb_typeof(v) = 'object' AND v->>'error' ~* 'not authorized|not allowed' THEN RETURN 'shut'; END IF;
  RETURN 'open';
END $$;
-- Every desk door that refuses outright, asked with a made-up id where it takes one. One line per door.
CREATE FUNCTION pmd.desk_doors() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  z text := '''00000000-0000-0000-0000-000000000000''::uuid';
  r record;
  out text := '';
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('list_mercury_transactions_for_bank_payments', '(select count(*) from public.list_mercury_transactions_for_bank_payments(''{}''::jsonb))'),
    ('count_mercury_transactions_for_bank_payments', 'public.count_mercury_transactions_for_bank_payments(''{}''::jsonb)'),
    ('list_ar_allocations_for_mercury_transaction', '(select count(*) from public.list_ar_allocations_for_mercury_transaction(' || z || '))'),
    ('list_ar_deposit_trails', '(select count(*) from public.list_ar_deposit_trails(array[' || z || ']))'),
    ('ar_book_applied_deposit_income', 'public.ar_book_applied_deposit_income(' || z || ')'),
    ('ar_deposit_booking', 'coalesce(public.ar_deposit_booking(' || z || '), ''{}''::jsonb)'),
    ('set_mercury_transaction_ar_closed', 'public.set_mercury_transaction_ar_closed(' || z || ', ''other'', ''bed'')'),
    ('close_out_ar_deposit', 'public.close_out_ar_deposit(' || z || ', ''other'', ''bed'', null)'),
    ('set_mercury_transaction_ar_returned', 'public.set_mercury_transaction_ar_returned(' || z || ', true)'),
    ('take_returned_check_off_jobs', 'public.take_returned_check_off_jobs(' || z || ')'),
    ('list_ar_return_cases', '(select count(*) from public.list_ar_return_cases(false))'),
    ('list_ar_return_case_fees', '(select count(*) from public.list_ar_return_case_fees(array[' || z || ']))'),
    ('add_ar_return_case_fee', 'public.add_ar_return_case_fee(' || z || ', ' || z || ')'),
    ('put_back_lost_dispute_bill', 'public.put_back_lost_dispute_bill(' || z || ')'),
    ('close_ar_return_case', 'public.close_ar_return_case(' || z || ', ''other'', ''bed'', null)'),
    ('reopen_ar_return_case', 'public.reopen_ar_return_case(' || z || ')'),
    ('close_ar_stripe_case', 'public.close_ar_stripe_case(' || z || ', ''other'', ''bed'')'),
    ('reopen_ar_stripe_case', 'public.reopen_ar_stripe_case(' || z || ')'),
    ('close_ar_unbanked_check_case', 'public.close_ar_unbanked_check_case(' || z || ', ''other'', ''bed'')'),
    ('reopen_ar_unbanked_check_case', 'public.reopen_ar_unbanked_check_case(' || z || ')'),
    ('gc_review_week_status', 'public.gc_review_week_status(current_date)')
  ) t(door, q) LOOP
    out := out || r.door || ' ' || pmd.ask(r.q) || E'\n';
  END LOOP;
  RETURN out;
END $$;
-- The doors that answer nothing instead of refusing. The first five are the Bill tab's reads and stay open to a
-- primary. The pay speed lines, the unlinked payments and the two case tables are the desks' and close.
CREATE FUNCTION pmd.quiet_doors() RETURNS text LANGUAGE sql AS $$
  SELECT 'promise gate ' || public.can_read_payment_promises()::text
      || ' · pay speeds ' || CASE WHEN public.get_billed_customer_pay_speeds() IS NULL THEN 'null' ELSE 'open' END
      || ' · pay speed lines ' || CASE WHEN public.get_pay_speed_transactions() IS NULL THEN 'null' ELSE 'open' END
      || ' · promised dates ' || CASE WHEN public.list_job_promised_pay_dates() IS NULL THEN 'null' ELSE 'open' END
      || ' · promises ' || CASE WHEN public.list_job_payment_promises() IS NULL THEN 'null' ELSE 'open' END
      || ' · promise records ' || CASE WHEN public.list_payment_promise_records() IS NULL THEN 'null' ELSE 'open' END
      || ' · returned check payers ' || (SELECT CASE WHEN count(*) >= 0 THEN 'open' END FROM public.list_ar_returned_check_payers(5))
      || ' · unlinked payments ' || (SELECT count(*) FROM public.list_unlinked_payments_for_bank_payments() WHERE payment_id = '00000000-0000-0000-0000-0000000fcd03')::text
      || ' · stripe cases ' || (SELECT count(*) FROM public.ar_stripe_cases WHERE stripe_object_id = 'dp_money_desks_bed')::text
      || ' · check cases ' || (SELECT count(*) FROM public.ar_unbanked_check_cases WHERE payment_id = '00000000-0000-0000-0000-0000000fcd03')::text
$$;
-- The promise on one job, as the job's own read answers it.
CREATE FUNCTION pmd.promise_on(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN public.list_job_payment_promises_for(p_job) IS NULL THEN 'null' ELSE jsonb_array_length(public.list_job_payment_promises_for(p_job))::text || ' promise' END
$$;
GRANT USAGE ON SCHEMA pmd TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmd TO anon, authenticated, service_role;

-- What a shut desk and an open desk read like, door by door.
CREATE TEMP TABLE pmd_want ON COMMIT DROP AS
SELECT string_agg(d || ' shut', E'\n' ORDER BY n) || E'\n' AS shut, string_agg(d || ' open', E'\n' ORDER BY n) || E'\n' AS open
FROM unnest(ARRAY['list_mercury_transactions_for_bank_payments', 'count_mercury_transactions_for_bank_payments', 'list_ar_allocations_for_mercury_transaction', 'list_ar_deposit_trails', 'ar_book_applied_deposit_income', 'ar_deposit_booking', 'set_mercury_transaction_ar_closed', 'close_out_ar_deposit', 'set_mercury_transaction_ar_returned', 'take_returned_check_off_jobs', 'list_ar_return_cases', 'list_ar_return_case_fees', 'add_ar_return_case_fee', 'put_back_lost_dispute_bill', 'close_ar_return_case', 'reopen_ar_return_case', 'close_ar_stripe_case', 'reopen_ar_stripe_case', 'close_ar_unbanked_check_case', 'reopen_ar_unbanked_check_case', 'gc_review_week_status']) WITH ORDINALITY AS t(d, n);
GRANT SELECT ON pmd_want TO authenticated;

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing: every desk door is shut and the quiet ones answer nothing.
SELECT pmd.as_user('00000000-0000-0000-0000-0000000fca05');
SELECT pmd.same('every desk door is shut to Pat', pmd.desk_doors(), (SELECT shut FROM pmd_want));
SELECT pmd.same('Pat keeps the Bill tab''s reads and loses the desks', pmd.quiet_doors(), 'promise gate true · pay speeds open · pay speed lines null · promised dates open · promises open · promise records open · returned check payers open · unlinked payments 0 · stripe cases 0 · check cases 0');

-- 2 · Luis, a primary with a job: the desks are shut to him too, and he reads the promise on his own job as before.
SELECT pmd.as_user('00000000-0000-0000-0000-0000000fca04');
SELECT pmd.same('every desk door is shut to Luis', pmd.desk_doors(), (SELECT shut FROM pmd_want));
SELECT pmd.same('Luis keeps the Bill tab''s reads and loses the desks', pmd.quiet_doors(), 'promise gate true · pay speeds open · pay speed lines null · promised dates open · promises open · promise records open · returned check payers open · unlinked payments 0 · stripe cases 0 · check cases 0');
SELECT pmd.same('Luis reads the promise on his own job', pmd.promise_on('00000000-0000-0000-0000-0000000fcf01'), '1 promise');

-- 3 · The office passes every door, as before.
SELECT pmd.as_user('00000000-0000-0000-0000-0000000fca03');
SELECT pmd.same('every desk door is open to Rosa', pmd.desk_doors(), (SELECT open FROM pmd_want));
SELECT pmd.same('the quiet doors answer Rosa', pmd.quiet_doors(), 'promise gate true · pay speeds open · pay speed lines open · promised dates open · promises open · promise records open · returned check payers open · unlinked payments 1 · stripe cases 1 · check cases 1');
SELECT pmd.same('Rosa reads the promise on the office''s job', pmd.promise_on('00000000-0000-0000-0000-0000000fcf03'), '1 promise');
SELECT pmd.as_user('00000000-0000-0000-0000-0000000fca06');
SELECT pmd.same('every desk door is open to Cal', pmd.desk_doors(), (SELECT open FROM pmd_want));
SELECT pmd.same('the quiet doors answer Cal', pmd.quiet_doors(), 'promise gate true · pay speeds open · pay speed lines open · promised dates open · promises open · promise records open · returned check payers open · unlinked payments 1 · stripe cases 1 · check cases 1');
SELECT pmd.as_user('00000000-0000-0000-0000-0000000fca07');
SELECT pmd.same('every desk door is open to Mo', pmd.desk_doors(), (SELECT open FROM pmd_want));
SELECT pmd.same('the quiet doors answer Mo', pmd.quiet_doors(), 'promise gate true · pay speeds open · pay speed lines open · promised dates open · promises open · promise records open · returned check payers open · unlinked payments 1 · stripe cases 1 · check cases 1');

DO $$ BEGIN RAISE NOTICE 'primary_money_desks PASSED'; END $$;
ROLLBACK;
