-- They say they paid (punch list #129 PR 3a, migration *_paid_claim): the estimator of a job's bid writes a paid claim
-- through add_job_payment_claim with heard_by themselves; the per-job read lists it with its kind, method and amount
-- beside a promise; the company-wide reads and the pay-speed records answer promises only; the board's date is
-- untouched by a claim; a bad method, a zero amount, a missing day and a stranger are refused in words; a claim voids
-- as a promise does; the shape constraint holds under a direct write. Everything rolls back. Raises on the first failed
-- assertion; ends with "paid_claim PASSED". See scripts/pgtest-paid-claim.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Theo (estimator, bid B1), Rosa (assistant), Pat (primary on nothing), Mo (the master the customer belongs to).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e6a01', 'theo@claim.test'),
  ('00000000-0000-0000-0000-0000000e6a03', 'rosa@claim.test'),
  ('00000000-0000-0000-0000-0000000e6a05', 'pat@claim.test'),
  ('00000000-0000-0000-0000-0000000e6a07', 'mo@claim.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e6a01', 'theo@claim.test', 'Claim Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000e6a03', 'rosa@claim.test', 'Claim Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e6a05', 'pat@claim.test', 'Claim Pat', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e6a07', 'mo@claim.test', 'Claim Mo', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e6b01', 'Claim Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000e6c01', '00000000-0000-0000-0000-0000000e6a07', 'Dana Whitfield');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000e6d01', '00000000-0000-0000-0000-0000000e6a03', '00000000-0000-0000-0000-0000000e6a01', '00000000-0000-0000-0000-0000000e6b01', 'Whitfield repipe', '00000000-0000-0000-0000-0000000e6c01');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status, bid_id) VALUES
  ('00000000-0000-0000-0000-0000000e6f01', '00000000-0000-0000-0000-0000000e6a07', '00000000-0000-0000-0000-0000000e6b01', '1032', 'Whitfield repipe', 'Dana Whitfield', '00000000-0000-0000-0000-0000000e6c01', 'customer', 4200, 0, 'billed', '00000000-0000-0000-0000-0000000e6d01');

CREATE SCHEMA pcl;
CREATE FUNCTION pcl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pcl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pcl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The job's words as the signed-in person: "paid_claim Oct 20 check_mailed - by text heard by Claim Theo; promise Oct 25 - - ...".
CREATE FUNCTION pcl.words() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT string_agg((e->>'kind') || ' ' || to_char((e->>'promisedYmd')::date, 'Mon DD') || ' ' || coalesce(e->>'method', '-') || ' ' || coalesce(e->>'amount', '-') || ' by ' || (e->>'channel') || ' heard by ' || (e->>'heardByName'), '; ' ORDER BY e->>'createdAt' DESC)
    FROM jsonb_array_elements(public.list_job_payment_promises_for('00000000-0000-0000-0000-0000000e6f01')) e), 'NULL')
$$;
-- The company-wide reads, as text: how many rows each holds for the job.
CREATE FUNCTION pcl.company() RETURNS text LANGUAGE sql AS $$
  SELECT 'promises ' || coalesce((SELECT count(*) FROM jsonb_array_elements(public.list_job_payment_promises()) e WHERE e->>'jobId' = '00000000-0000-0000-0000-0000000e6f01')::text, 'NULL')
      || ', records ' || coalesce((SELECT count(*) FROM jsonb_array_elements(public.list_payment_promise_records()) e WHERE e->>'jobId' = '00000000-0000-0000-0000-0000000e6f01')::text, 'NULL')
$$;
CREATE FUNCTION pcl.board() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT promised_date::text FROM public.job_promised_pay_dates WHERE job_id = '00000000-0000-0000-0000-0000000e6f01'), 'none')
$$;
CREATE FUNCTION pcl.pid(p_kind text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.job_payment_promises WHERE job_id = '00000000-0000-0000-0000-0000000e6f01' AND kind = p_kind AND voided_at IS NULL ORDER BY created_at DESC LIMIT 1
$$;
GRANT USAGE ON SCHEMA pcl TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcl TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- 1 · Theo writes a promise, then Dana's word that she paid; the per-job read names both kinds.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000e6a01');
SELECT pcl.same('Theo writes the promise', (public.add_job_payment_promise('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-25', 'Dana', 'text'))->>'promisedDate', '2026-10-25');
SELECT pcl.same('the board follows the promise', pcl.board(), '2026-10-25');
SELECT pcl.same('Theo writes the claim', (public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'check_mailed', NULL, 'Dana', 'text', 'Check #1187, she says'))->>'paidDate', '2026-10-20');
SELECT pcl.same('the job''s words, the claim first, each with its kind', pcl.words(), 'paid_claim Oct 20 check_mailed - by text heard by Claim Theo; promise Oct 25 - - by text heard by Claim Theo');
SELECT pcl.same('a claim leaves the board''s date alone', pcl.board(), '2026-10-25');
SELECT pcl.same('a claim with an amount keeps it', (public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-21', 'paid_online', 1500, NULL, NULL, NULL))->>'paidDate', '2026-10-21');
SELECT pcl.same('the amount reads back', (SELECT e->>'amount' FROM jsonb_array_elements(public.list_job_payment_promises_for('00000000-0000-0000-0000-0000000e6f01')) e WHERE e->>'method' = 'paid_online'), '1500');

-- 2 · The company-wide reads answer promises only.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000e6a03');
SELECT pcl.same('the office''s company-wide reads hold the promise and no claim', pcl.company(), 'promises 1, records 1');
SELECT pcl.same('the office''s per-job read holds all three', (SELECT count(*)::text FROM jsonb_array_elements(public.list_job_payment_promises_for('00000000-0000-0000-0000-0000000e6f01'))), '3');

-- 3 · The refusals.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000e6a01');
SELECT pcl.refused('a method that is not one', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'cash', NULL)$q$, 'Unknown method');
SELECT pcl.refused('no method', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', NULL, NULL)$q$, 'Unknown method');
SELECT pcl.refused('no day', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', NULL, 'check_mailed', NULL)$q$, 'A claim needs the day');
SELECT pcl.refused('nothing as an amount', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'check_mailed', 0)$q$, 'An amount must be more than nothing');
SELECT pcl.refused('a channel that is not one', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'check_mailed', NULL, 'Dana', 'portal')$q$, 'Unknown channel');
SELECT pcl.as_user('00000000-0000-0000-0000-0000000e6a05');
SELECT pcl.refused('Pat, a primary on nothing, is refused', $q$SELECT public.add_job_payment_claim('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'check_mailed', NULL)$q$, 'Not allowed to record payment promises');

-- 4 · A claim voids as a promise does.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000e6a01');
SELECT pcl.same('Theo voids the online claim', (public.void_job_payment_promise(pcl.pid('paid_claim')))->>'voided', 'true');
SELECT pcl.same('two words stay', (SELECT count(*)::text FROM jsonb_array_elements(public.list_job_payment_promises_for('00000000-0000-0000-0000-0000000e6f01'))), '2');

-- 5 · Below the functions: the shape holds.
RESET ROLE;
SELECT pcl.refused('a claim with no method', $q$INSERT INTO public.job_payment_promises (job_id, promised_date, kind) VALUES ('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'paid_claim')$q$, 'job_payment_promises_kind_shape');
SELECT pcl.refused('a promise with a method', $q$INSERT INTO public.job_payment_promises (job_id, promised_date, kind, method) VALUES ('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'promise', 'check_mailed')$q$, 'job_payment_promises_kind_shape');
SELECT pcl.refused('a kind that is not one', $q$INSERT INTO public.job_payment_promises (job_id, promised_date, kind) VALUES ('00000000-0000-0000-0000-0000000e6f01', DATE '2026-10-20', 'guess')$q$, 'job_payment_promises_kind_known');

DO $$ BEGIN RAISE NOTICE 'paid_claim PASSED'; END $$;
ROLLBACK;
