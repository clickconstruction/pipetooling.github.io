-- A primary's money verbs held to the job's people (punch list #400 PR 1, migration *_primary_money_verbs). Luis is a
-- primary and the account manager of J1 and J5. Pat is a primary on nothing. J3 and J6 are the office's. Pat is
-- refused on every verb against either job. Luis is refused on the office's jobs and passes on his own: he writes a
-- bill down, deletes a billed bill, a draft and a paid bill with no payment, sends a paid job back to billed, and
-- makes a job from the estimate he wrote. Moving a payment needs both jobs to be his. Rosa, the assistant, does each
-- as before. Everything rolls back. Raises on the first failed assertion; ends with "primary_money_verbs PASSED".
-- See scripts/pgtest-primary-money-verbs.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000faa04', 'luis@moneyverbs.test'),
  ('00000000-0000-0000-0000-0000000faa05', 'pat@moneyverbs.test'),
  ('00000000-0000-0000-0000-0000000faa03', 'rosa@moneyverbs.test'),
  ('00000000-0000-0000-0000-0000000faa07', 'mo@moneyverbs.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000faa04', 'luis@moneyverbs.test', 'Verbs Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000faa05', 'pat@moneyverbs.test', 'Verbs Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000faa03', 'rosa@moneyverbs.test', 'Verbs Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000faa07', 'mo@moneyverbs.test', 'Verbs Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000fab01', 'Money Verbs Plumbing');
-- create_job_from_estimate files its job under the service type named Plumbing.
INSERT INTO public.service_types (name) SELECT 'Plumbing' WHERE NOT EXISTS (SELECT 1 FROM public.service_types WHERE name = 'Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000fac01', '00000000-0000-0000-0000-0000000faa07', 'Dana Whitfield');
-- J1 and J5 are Luis's. J3 and J6 are nobody's but the office's. J5 and J6 are paid.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000faf01', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000fab01', '4101', 'Linda Lou vanity', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fac01', 'customer', 910, 40, 'billed', '00000000-0000-0000-0000-0000000faa04', 'primary'),
  ('00000000-0000-0000-0000-0000000faf03', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000fab01', '4103', 'Water heater removal', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fac01', 'customer', 910, 100, 'billed', NULL, NULL),
  ('00000000-0000-0000-0000-0000000faf05', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000fab01', '4105', 'Diane Falls drain', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fac01', 'customer', 300, 300, 'paid', '00000000-0000-0000-0000-0000000faa04', 'primary'),
  ('00000000-0000-0000-0000-0000000faf06', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000fab01', '4106', 'Laurel Field filter', 'Dana Whitfield', '00000000-0000-0000-0000-0000000fac01', 'customer', 300, 300, 'paid', NULL, NULL);
-- On each of J1 and J3: a billed bill to write down, a billed bill to send back, a draft, a paid bill with no
-- payment, and a paid bill that Stripe holds.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, stripe_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000fae11', '00000000-0000-0000-0000-0000000faf01', 0, 'billed', 500, NULL),
  ('00000000-0000-0000-0000-0000000fae12', '00000000-0000-0000-0000-0000000faf01', 1, 'billed', 200, NULL),
  ('00000000-0000-0000-0000-0000000fae13', '00000000-0000-0000-0000-0000000faf01', 2, 'ready_to_bill', 100, NULL),
  ('00000000-0000-0000-0000-0000000fae14', '00000000-0000-0000-0000-0000000faf01', 3, 'paid', 50, NULL),
  ('00000000-0000-0000-0000-0000000fae15', '00000000-0000-0000-0000-0000000faf01', 4, 'paid', 60, 'in_bed_luis'),
  ('00000000-0000-0000-0000-0000000fae31', '00000000-0000-0000-0000-0000000faf03', 0, 'billed', 500, NULL),
  ('00000000-0000-0000-0000-0000000fae32', '00000000-0000-0000-0000-0000000faf03', 1, 'billed', 200, NULL),
  ('00000000-0000-0000-0000-0000000fae33', '00000000-0000-0000-0000-0000000faf03', 2, 'ready_to_bill', 100, NULL),
  ('00000000-0000-0000-0000-0000000fae34', '00000000-0000-0000-0000-0000000faf03', 3, 'paid', 50, NULL),
  ('00000000-0000-0000-0000-0000000fae35', '00000000-0000-0000-0000-0000000faf03', 4, 'paid', 60, 'in_bed_office');
-- A payment on each job, tied to no bill.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount) VALUES
  ('00000000-0000-0000-0000-0000000fad01', '00000000-0000-0000-0000-0000000faf01', 40),
  ('00000000-0000-0000-0000-0000000fad03', '00000000-0000-0000-0000-0000000faf03', 100);
-- Two signed estimates with no job yet: Luis wrote the first, Mo the second.
INSERT INTO public.estimates (id, master_user_id, created_by, status) VALUES
  ('00000000-0000-0000-0000-0000000fa101', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000faa04', 'customer_accepted'),
  ('00000000-0000-0000-0000-0000000fa103', '00000000-0000-0000-0000-0000000faa07', '00000000-0000-0000-0000-0000000faa07', 'customer_accepted');

CREATE SCHEMA pmv;
CREATE FUNCTION pmv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pmv.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A verb's answer in a few words: "ok", "refused: <its error>", or "raised: <its exception>". The call runs as the
-- signed-in person, and a raise undoes only that call.
CREATE FUNCTION pmv.ask(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN
  BEGIN
    EXECUTE 'select to_jsonb((' || p_sql || '))' INTO v;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'raised: ' || left(SQLERRM, 60);
  END;
  IF jsonb_typeof(v) = 'object' AND v->>'error' IS NOT NULL THEN RETURN 'refused: ' || left(v->>'error', 60); END IF;
  IF jsonb_typeof(v) = 'object' AND (v->>'ok' = 'true' OR v->>'success' = 'true') THEN RETURN 'ok'; END IF;
  IF jsonb_typeof(v) = 'string' THEN RETURN 'ok'; END IF;
  RETURN left(v::text, 80);
END $$;
CREATE FUNCTION pmv.bill(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT status || ' ' || amount::text FROM public.jobs_ledger_invoices WHERE id = p_id), 'gone')
$$;
CREATE FUNCTION pmv.payment_job(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT right(job_id::text, 2) FROM public.jobs_ledger_payments WHERE id = p_id), 'gone')
$$;
CREATE FUNCTION pmv.job_status(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT status::text FROM public.jobs_ledger WHERE id = p_id
$$;
CREATE FUNCTION pmv.estimate_job(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT j.hcp_number FROM public.estimates e JOIN public.jobs_ledger j ON j.id = e.job_ledger_id WHERE e.id = p_id), 'no job')
$$;
GRANT USAGE ON SCHEMA pmv TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pmv TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing, is refused on every verb against the office's job.
SELECT pmv.as_user('00000000-0000-0000-0000-0000000faa05');
SELECT pmv.same('Pat cannot write down J3''s bill', pmv.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fae31', 450, 'agreed on the phone')$$), 'refused: Not authorized to update this job');
SELECT pmv.same('Pat cannot delete J3''s billed bill', pmv.ask($$public.delete_billed_invoice_on_send_back('00000000-0000-0000-0000-0000000fae32')$$), 'refused: Not authorized');
SELECT pmv.same('Pat cannot delete J3''s draft', pmv.ask($$public.delete_ready_to_bill_invoice('00000000-0000-0000-0000-0000000fae33')$$), 'refused: Not authorized');
SELECT pmv.same('Pat cannot delete J3''s paid bill', pmv.ask($$public.delete_marked_paid_invoice_without_payment('00000000-0000-0000-0000-0000000fae34')$$), 'refused: Not authorized');
SELECT pmv.same('Pat cannot take a Stripe payment off J3''s bill', pmv.ask($$public.revert_stripe_oob_invoice_payment('00000000-0000-0000-0000-0000000fae35', 'paid by mistake')$$), 'refused: Not authorized to update this job');
SELECT pmv.same('Pat cannot move J3''s payment', pmv.ask($$public.move_jobs_ledger_payment('00000000-0000-0000-0000-0000000fad03', '00000000-0000-0000-0000-0000000faf01', 'wrong job')$$), 'refused: Not authorized to update one of these jobs');
SELECT pmv.same('Pat cannot send J6 back to billed', pmv.ask($$public.update_job_status('00000000-0000-0000-0000-0000000faf06', 'billed')$$), 'refused: Not authorized to update job status');
SELECT pmv.same('Pat cannot apply Mo''s estimate to a job', pmv.ask($$public.apply_estimate_to_job('00000000-0000-0000-0000-0000000fa103', '00000000-0000-0000-0000-0000000faf03')$$), 'raised: not authorized to apply this estimate');
SELECT pmv.same('Pat cannot make a job from Mo''s estimate', pmv.ask($$public.create_job_from_estimate(p_estimate_id => '00000000-0000-0000-0000-0000000fa103', p_hcp_number => '4190', p_job_name => 'Thornbury filter', p_fixtures => '[]'::jsonb)$$), 'raised: not authorized to create job for this estimate');
SELECT pmv.same('Pat cannot apply Luis''s estimate either', pmv.ask($$public.apply_estimate_to_job('00000000-0000-0000-0000-0000000fa101', '00000000-0000-0000-0000-0000000faf03')$$), 'raised: not authorized to apply this estimate');
SELECT pmv.same('J3''s bills stand', pmv.bill('00000000-0000-0000-0000-0000000fae31') || ' · ' || pmv.bill('00000000-0000-0000-0000-0000000fae32') || ' · ' || pmv.bill('00000000-0000-0000-0000-0000000fae33') || ' · ' || pmv.bill('00000000-0000-0000-0000-0000000fae34'), 'billed 500.00 · billed 200.00 · ready_to_bill 100.00 · paid 50.00');
SELECT pmv.same('J3''s payment stays on J3', pmv.payment_job('00000000-0000-0000-0000-0000000fad03'), '03');
SELECT pmv.same('J6 stays paid', pmv.job_status('00000000-0000-0000-0000-0000000faf06'), 'paid');

-- 2 · Luis is refused on the office's jobs too, and a payment moves only between two jobs that are both his.
SELECT pmv.as_user('00000000-0000-0000-0000-0000000faa04');
SELECT pmv.same('Luis cannot write down J3''s bill', pmv.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fae31', 450, 'agreed on the phone')$$), 'refused: Not authorized to update this job');
SELECT pmv.same('Luis cannot delete J3''s billed bill', pmv.ask($$public.delete_billed_invoice_on_send_back('00000000-0000-0000-0000-0000000fae32')$$), 'refused: Not authorized');
SELECT pmv.same('Luis cannot pull J3''s payment onto his job', pmv.ask($$public.move_jobs_ledger_payment('00000000-0000-0000-0000-0000000fad03', '00000000-0000-0000-0000-0000000faf01', 'wrong job')$$), 'refused: Not authorized to update one of these jobs');
SELECT pmv.same('Luis cannot push his payment onto J3', pmv.ask($$public.move_jobs_ledger_payment('00000000-0000-0000-0000-0000000fad01', '00000000-0000-0000-0000-0000000faf03', 'wrong job')$$), 'refused: Not authorized to update one of these jobs');
SELECT pmv.same('Luis cannot send J6 back to billed', pmv.ask($$public.update_job_status('00000000-0000-0000-0000-0000000faf06', 'billed')$$), 'refused: Not authorized to update job status');
SELECT pmv.same('Luis cannot make a job from Mo''s estimate', pmv.ask($$public.create_job_from_estimate(p_estimate_id => '00000000-0000-0000-0000-0000000fa103', p_hcp_number => '4190', p_job_name => 'Thornbury filter', p_fixtures => '[]'::jsonb)$$), 'raised: not authorized to create job for this estimate');

-- 3 · Luis on his own jobs.
SELECT pmv.same('Luis writes down J1''s bill', pmv.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fae11', 450, 'agreed on the phone')$$), 'ok');
SELECT pmv.same('J1''s bill reads the agreed amount', pmv.bill('00000000-0000-0000-0000-0000000fae11'), 'billed 450.00');
SELECT pmv.same('Luis deletes J1''s billed bill', pmv.ask($$public.delete_billed_invoice_on_send_back('00000000-0000-0000-0000-0000000fae12')$$), 'ok');
SELECT pmv.same('Luis deletes J1''s draft', pmv.ask($$public.delete_ready_to_bill_invoice('00000000-0000-0000-0000-0000000fae13')$$), 'ok');
SELECT pmv.same('Luis deletes J1''s paid bill with no payment', pmv.ask($$public.delete_marked_paid_invoice_without_payment('00000000-0000-0000-0000-0000000fae14')$$), 'ok');
SELECT pmv.same('Luis passes the job check on his Stripe bill, which has no payment to take off', pmv.ask($$public.revert_stripe_oob_invoice_payment('00000000-0000-0000-0000-0000000fae15', 'paid by mistake')$$), 'refused: No applied payments found for this invoice');
SELECT pmv.same('Luis moves his payment between his two jobs', pmv.ask($$public.move_jobs_ledger_payment('00000000-0000-0000-0000-0000000fad01', '00000000-0000-0000-0000-0000000faf05', 'wrong job')$$), 'ok');
SELECT pmv.same('the payment is on J5', pmv.payment_job('00000000-0000-0000-0000-0000000fad01'), '05');
SELECT pmv.same('Luis sends J5 back to billed', pmv.ask($$public.update_job_status('00000000-0000-0000-0000-0000000faf05', 'billed')$$), 'ok');
SELECT pmv.same('J5 is billed', pmv.job_status('00000000-0000-0000-0000-0000000faf05'), 'billed');
SELECT pmv.same('Luis makes a job from the estimate he wrote', pmv.ask($$public.create_job_from_estimate(p_estimate_id => '00000000-0000-0000-0000-0000000fa101', p_hcp_number => '4191', p_job_name => 'Tison plans repipe', p_fixtures => '[]'::jsonb)$$), 'ok');
SELECT pmv.same('his estimate is on the new job', pmv.estimate_job('00000000-0000-0000-0000-0000000fa101'), '4191');

-- 4 · The office is untouched.
SELECT pmv.as_user('00000000-0000-0000-0000-0000000faa03');
SELECT pmv.same('Rosa writes down J3''s bill', pmv.ask($$public.apply_agreed_write_down_to_billed_invoice('00000000-0000-0000-0000-0000000fae31', 450, 'agreed on the phone')$$), 'ok');
SELECT pmv.same('Rosa deletes J3''s billed bill', pmv.ask($$public.delete_billed_invoice_on_send_back('00000000-0000-0000-0000-0000000fae32')$$), 'ok');
SELECT pmv.same('Rosa deletes J3''s draft', pmv.ask($$public.delete_ready_to_bill_invoice('00000000-0000-0000-0000-0000000fae33')$$), 'ok');
SELECT pmv.same('Rosa deletes J3''s paid bill with no payment', pmv.ask($$public.delete_marked_paid_invoice_without_payment('00000000-0000-0000-0000-0000000fae34')$$), 'ok');
SELECT pmv.same('Rosa moves J3''s payment onto J1', pmv.ask($$public.move_jobs_ledger_payment('00000000-0000-0000-0000-0000000fad03', '00000000-0000-0000-0000-0000000faf01', 'wrong job')$$), 'ok');
SELECT pmv.same('Rosa sends J6 back to billed', pmv.ask($$public.update_job_status('00000000-0000-0000-0000-0000000faf06', 'billed')$$), 'ok');
SELECT pmv.same('Rosa applies Mo''s estimate to J3', pmv.ask($$public.apply_estimate_to_job('00000000-0000-0000-0000-0000000fa103', '00000000-0000-0000-0000-0000000faf03')$$), 'ok');

DO $$ BEGIN RAISE NOTICE 'primary_money_verbs PASSED'; END $$;
ROLLBACK;
