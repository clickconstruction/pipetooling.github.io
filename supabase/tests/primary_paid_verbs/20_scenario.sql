-- Primary's paid verbs narrowed (punch list #129 PR 6, migration *_primary_paid_verbs): a primary who account-manages
-- a job marks it paid, marks its bill paid and removes the payment again; a primary on nothing is refused on each; the
-- office is untouched. Everything rolls back. Raises on the first failed assertion; ends with
-- "primary_paid_verbs PASSED". See scripts/pgtest-primary-paid-verbs.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Luis (primary, J1's account manager), Pat (primary on nothing), Rosa (assistant), Mo (the master).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000eaa04', 'luis@verbs.test'),
  ('00000000-0000-0000-0000-0000000eaa05', 'pat@verbs.test'),
  ('00000000-0000-0000-0000-0000000eaa03', 'rosa@verbs.test'),
  ('00000000-0000-0000-0000-0000000eaa07', 'mo@verbs.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000eaa04', 'luis@verbs.test', 'Verbs Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000eaa05', 'pat@verbs.test', 'Verbs Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000eaa03', 'rosa@verbs.test', 'Verbs Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000eaa07', 'mo@verbs.test', 'Verbs Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000eab01', 'Verbs Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000eac01', '00000000-0000-0000-0000-0000000eaa07', 'Dana Whitfield');
-- J1 is Luis's; J2 is nobody's but the office's.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, account_manager_user_id, account_manager_relationship) VALUES
  ('00000000-0000-0000-0000-0000000eaf01', '00000000-0000-0000-0000-0000000eaa07', '00000000-0000-0000-0000-0000000eab01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000eac01', 'customer', 4200, 0, 'billed', '00000000-0000-0000-0000-0000000eaa04', 'primary'),
  ('00000000-0000-0000-0000-0000000eaf02', '00000000-0000-0000-0000-0000000eaa07', '00000000-0000-0000-0000-0000000eab01', '1040', 'Park water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000eac01', 'customer', 2900, 0, 'billed', NULL, NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000eaf01', '00000000-0000-0000-0000-0000000eaa04');
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000000eae01', '00000000-0000-0000-0000-0000000eaf01', 0, 'billed', 4200, '2026-09-30T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000eae02', '00000000-0000-0000-0000-0000000eaf02', 0, 'billed', 2900, '2026-10-01T15:00:00Z');

CREATE SCHEMA ppv;
CREATE FUNCTION ppv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ppv.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- "ok" or the error's first words, from a verb's jsonb answer.
CREATE FUNCTION ppv.said(p jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN p->>'error' IS NOT NULL THEN 'refused: ' || left(p->>'error', 40) WHEN p->>'ok' = 'true' THEN 'ok' ELSE left(p::text, 60) END
$$;
CREATE FUNCTION ppv.payments(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT string_agg(amount::text, ', ' ORDER BY sequence_order) FROM public.jobs_ledger_payments WHERE job_id = p_job), 'none')
$$;
CREATE FUNCTION ppv.pid(p_job uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.jobs_ledger_payments WHERE job_id = p_job ORDER BY sequence_order DESC LIMIT 1
$$;
GRANT USAGE ON SCHEMA ppv TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ppv TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Pat, a primary on nothing, is refused on every verb against Luis's job.
SELECT ppv.as_user('00000000-0000-0000-0000-0000000eaa05');
SELECT ppv.same('Pat cannot mark J1 paid by the job', ppv.said(public.mark_job_paid('00000000-0000-0000-0000-0000000eaf01', 100::numeric)), 'refused: Not authorized to update this job');
SELECT ppv.same('Pat cannot mark J1 paid by the day', ppv.said(public.mark_job_paid('00000000-0000-0000-0000-0000000eaf01', DATE '2026-10-19')), 'refused: Not authorized to update this job');
SELECT ppv.same('Pat cannot mark J1''s bill paid', ppv.said(public.mark_invoice_paid('00000000-0000-0000-0000-0000000eae01', 100::numeric)), 'refused: Not authorized to update this job');
SELECT ppv.same('nothing landed on J1', ppv.payments('00000000-0000-0000-0000-0000000eaf01'), 'none');

-- 2 · Luis, J1's account manager, marks a payment on it and takes it off again.
SELECT ppv.as_user('00000000-0000-0000-0000-0000000eaa04');
SELECT ppv.same('Luis marks $100 paid on J1', ppv.said(public.mark_job_paid('00000000-0000-0000-0000-0000000eaf01', 100::numeric)), 'ok');
SELECT ppv.same('the payment is on J1', ppv.payments('00000000-0000-0000-0000-0000000eaf01'), '100.00');
SELECT ppv.same('Luis marks J1''s bill paid in part', ppv.said(public.mark_invoice_paid('00000000-0000-0000-0000-0000000eae01', 50::numeric)), 'ok');
SELECT ppv.same('Luis cannot mark J2 paid: not his', ppv.said(public.mark_job_paid('00000000-0000-0000-0000-0000000eaf02', 100::numeric)), 'refused: Not authorized to update this job');
SELECT ppv.as_user('00000000-0000-0000-0000-0000000eaa05');
SELECT ppv.same('Pat cannot remove Luis''s payment', ppv.said(public.remove_jobs_ledger_payment_and_reconcile(ppv.pid('00000000-0000-0000-0000-0000000eaf01'))), 'refused: Not authorized to update this job');
SELECT ppv.as_user('00000000-0000-0000-0000-0000000eaa04');
SELECT ppv.same('Luis removes the bill''s payment', ppv.said(public.remove_jobs_ledger_payment_and_reconcile(ppv.pid('00000000-0000-0000-0000-0000000eaf01'))), 'ok');

-- 3 · The office is untouched.
SELECT ppv.as_user('00000000-0000-0000-0000-0000000eaa03');
SELECT ppv.same('Rosa marks J2 paid', ppv.said(public.mark_job_paid('00000000-0000-0000-0000-0000000eaf02', 2900::numeric)), 'ok');
SELECT ppv.same('Rosa marks J1''s bill paid', ppv.said(public.mark_invoice_paid('00000000-0000-0000-0000-0000000eae01', 25::numeric)), 'ok');

DO $$ BEGIN RAISE NOTICE 'primary_paid_verbs PASSED'; END $$;
ROLLBACK;
