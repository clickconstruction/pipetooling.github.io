-- A check typed in by hand that never reached the bank (v2.4902, punch list #76 piece 3):
-- open_ar_unbanked_check_cases, the two self-closes, the list rows, the office's close and reopen.
-- One transaction that rolls back; raises on the first failed assertion; ends with
-- "ar_unbanked_checks PASSED". See scripts/pgtest-ar-unbanked-checks.sh. Never against prod.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('bed.today', '2026-10-08', true);

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.case_of(p uuid) RETURNS public.ar_unbanked_check_cases LANGUAGE sql AS
  $$ SELECT * FROM public.ar_unbanked_check_cases WHERE payment_id = p $$;

INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test', 'Bed Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test', 'Bed Sub', 'subcontractor');
INSERT INTO public.customers (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'DRF'),
  ('00000000-0000-0000-0000-0000000000c2', 'Owner Person'),
  ('00000000-0000-0000-0000-0000000000c3', 'Heron Construction');
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, customer_name, customer_id, gc_customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000a0001', '777', 'DRF pool house', 'DRF', '00000000-0000-0000-0000-0000000000c1', NULL, 'customer', 3000, 3000, 'paid'),
  ('00000000-0000-0000-0000-0000000a0002', '1002', 'Terrell sewer', 'Owner Person', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', 'gc', 4000, 2000, 'billed');

-- The deposits: $300 two days before p5 (inside the window), $400 four days before p6 (outside it),
-- $600 the day after p7 but used up by another payment, $700 the day after p8 but failed.
INSERT INTO public.mercury_transactions (id, amount, kind, status, posted_at, counterparty_name) VALUES
  ('00000000-0000-0000-0000-0000000d0300', 300, 'checkDeposit', 'sent', '2026-09-08T15:00:00Z', 'Owner Person'),
  ('00000000-0000-0000-0000-0000000d0400', 400, 'checkDeposit', 'sent', '2026-09-06T15:00:00Z', 'Owner Person'),
  ('00000000-0000-0000-0000-0000000d0600', 600, 'checkDeposit', 'sent', '2026-09-13T15:00:00Z', 'DRF'),
  ('00000000-0000-0000-0000-0000000d0700', 700, 'checkDeposit', 'failed', '2026-09-13T15:00:00Z', 'Heron'),
  ('00000000-0000-0000-0000-0000000d0250', 250, 'checkDeposit', 'sent', '2026-08-20T15:00:00Z', 'DRF');

INSERT INTO public.jobs_ledger_payments (id, job_id, amount, paid_on, payment_type, reference_number, mercury_transaction_id) VALUES
  -- p1: a $1,000 check, and no unused check deposit that large since Aug 16 → a case.
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000a0001', 1000, '2026-08-19', 'Check', '2662', NULL),
  -- p2: typed in 8 days ago → too soon.
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000a0001', 185, '2026-09-30', 'Check', NULL, NULL),
  -- p3: before the floor → not a case.
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000a0001', 1200, '2026-06-15', 'Check', '2745', NULL),
  -- p4: a card → not a check.
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000a0002', 500, '2026-09-01', 'Card (external)', NULL, NULL),
  -- p5: an unused $300 check deposit posted two days before it → it may be this check: no case.
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000a0002', 300, '2026-09-10', 'ck', NULL, NULL),
  -- p6: the only $400 deposit posted four days before it → outside the window: a case.
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000a0002', 400, '2026-09-10', 'Cheque', NULL, NULL),
  -- p7: the $600 deposit is used up by px → a case.
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000a0001', 600, '2026-09-12', 'Check', NULL, NULL),
  -- p8: the $700 deposit failed → a case, on the GC job (the GC pays).
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000a0002', 700, '2026-09-12', 'Check', NULL, NULL),
  -- p9: linked to its deposit → never a case.
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000a0001', 250, '2026-08-20', 'checkDeposit', NULL, '00000000-0000-0000-0000-0000000d0250'),
  -- px: uses up the $600 deposit.
  ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000a0001', 600, '2026-09-13', 'checkDeposit', NULL, '00000000-0000-0000-0000-0000000d0600');

-- 1 · the sweep opens exactly the four.
SELECT bedt.ok('the sweep opens four cases', (SELECT (public.open_ar_unbanked_check_cases() ->> 'opened')::int = 4));
SELECT bedt.ok('p1, p6, p7 and p8 are the cases', (
  SELECT array_agg(payment_id ORDER BY payment_id) = ARRAY[
    '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f6',
    '00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000f8']::uuid[]
  FROM public.ar_unbanked_check_cases));
SELECT bedt.ok('a check typed in eight days ago waits', (bedt.case_of('00000000-0000-0000-0000-0000000000f2')).id IS NULL);
SELECT bedt.ok('a check before the floor is no case', (bedt.case_of('00000000-0000-0000-0000-0000000000f3')).id IS NULL);
SELECT bedt.ok('a card is no case', (bedt.case_of('00000000-0000-0000-0000-0000000000f4')).id IS NULL);
SELECT bedt.ok('an unused deposit of at least the amount posted since three days before closes the window', (bedt.case_of('00000000-0000-0000-0000-0000000000f5')).id IS NULL);
SELECT bedt.ok('a deposit posted four days before is outside the window', (bedt.case_of('00000000-0000-0000-0000-0000000000f6')).id IS NOT NULL);
SELECT bedt.ok('a deposit used up by another payment does not count', (bedt.case_of('00000000-0000-0000-0000-0000000000f7')).id IS NOT NULL);
SELECT bedt.ok('a failed deposit does not count', (bedt.case_of('00000000-0000-0000-0000-0000000000f8')).id IS NOT NULL);
SELECT bedt.ok('a linked payment is never a case', (bedt.case_of('00000000-0000-0000-0000-0000000000f9')).id IS NULL);
SELECT bedt.ok('the case keeps the job, the amount, the day and the check number', (
  SELECT job_id = '00000000-0000-0000-0000-0000000a0001' AND amount = 1000 AND paid_on = '2026-08-19' AND reference_number = '2662' AND notified_at IS NULL
  FROM public.ar_unbanked_check_cases WHERE payment_id = '00000000-0000-0000-0000-0000000000f1'));
SELECT bedt.ok('a second run opens nothing', (SELECT (public.open_ar_unbanked_check_cases() ->> 'opened')::int = 0));

-- 2 · the self-closes.
UPDATE public.jobs_ledger_payments SET mercury_transaction_id = '00000000-0000-0000-0000-0000000d0400' WHERE id = '00000000-0000-0000-0000-0000000000f1';
SELECT bedt.ok('linking the payment to a deposit closes the case as deposited, naming the deposit', (
  SELECT closed_at IS NOT NULL AND closed_reason = 'deposited' AND deposited_mercury_transaction_id = '00000000-0000-0000-0000-0000000d0400'
  FROM public.ar_unbanked_check_cases WHERE payment_id = '00000000-0000-0000-0000-0000000000f1'));
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000f6';
SELECT bedt.ok('taking the payment off its job closes the case as taken off, and the case stays', (
  SELECT closed_at IS NOT NULL AND closed_reason = 'taken_off' AND amount = 400
  FROM public.ar_unbanked_check_cases WHERE payment_id = '00000000-0000-0000-0000-0000000000f6'));

-- 3 · the list, as the service role (the notifier) and as the office.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT bedt.ok('the open list reads the two open cases as unbanked', (
  SELECT count(*) = 2 FROM public.list_ar_return_cases(false) WHERE source = 'unbanked'));
SELECT bedt.ok('with the closed ones, four', (
  SELECT count(*) = 4 FROM public.list_ar_return_cases(true) WHERE source = 'unbanked'));
SELECT bedt.ok('the case''s own id rides in mercury_transaction_id, the payment in recorded_payment', (
  SELECT l.mercury_transaction_id = c.id AND (l.recorded_payment ->> 'payment_id')::uuid = c.payment_id
     AND l.recorded_payment ->> 'job_number' = '777' AND (l.recorded_payment ->> 'amount')::numeric = 600
     AND l.recorded_payment ->> 'paid_on' = '2026-09-12' AND l.live_payments = '[]'::jsonb AND l.last_job IS NULL
  FROM public.list_ar_return_cases(false) l
  JOIN public.ar_unbanked_check_cases c ON c.id = l.mercury_transaction_id
  WHERE c.payment_id = '00000000-0000-0000-0000-0000000000f7'));
SELECT bedt.ok('the payer on a job the GC pays is the GC', (
  SELECT l.counterparty_name = 'Heron Construction'
  FROM public.list_ar_return_cases(false) l
  JOIN public.ar_unbanked_check_cases c ON c.id = l.mercury_transaction_id
  WHERE c.payment_id = '00000000-0000-0000-0000-0000000000f8'));
SELECT bedt.ok('a taken-off case still reads its amount and job from the case', (
  SELECT (l.recorded_payment ->> 'amount')::numeric = 400 AND l.recorded_payment ->> 'job_number' = '1002' AND l.closed_reason = 'taken_off'
  FROM public.list_ar_return_cases(true) l
  JOIN public.ar_unbanked_check_cases c ON c.id = l.mercury_transaction_id
  WHERE c.payment_id = '00000000-0000-0000-0000-0000000000f6'));

-- 4 · the office closes and reopens; a subcontractor cannot; a deposited case does not reopen.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SELECT public.close_ar_unbanked_check_case((bedt.case_of('00000000-0000-0000-0000-0000000000f7')).id, 'not_coming', 'Customer says it was lost');
SELECT bedt.ok('the office closes a case as not coming, with the note and who', (
  SELECT closed_reason = 'not_coming' AND closed_note = 'Customer says it was lost' AND closed_by = '00000000-0000-0000-0000-0000000000a1'
  FROM public.ar_unbanked_check_cases WHERE payment_id = '00000000-0000-0000-0000-0000000000f7'));
SELECT public.reopen_ar_unbanked_check_case((bedt.case_of('00000000-0000-0000-0000-0000000000f7')).id);
SELECT bedt.ok('and reopens it', (bedt.case_of('00000000-0000-0000-0000-0000000000f7')).closed_at IS NULL);
DO $$
BEGIN
  BEGIN
    PERFORM public.reopen_ar_unbanked_check_case((bedt.case_of('00000000-0000-0000-0000-0000000000f1')).id);
    RAISE EXCEPTION 'FAILED: a deposited case reopened';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a deposited case does not reopen';
  END;
  BEGIN
    PERFORM public.close_ar_unbanked_check_case((bedt.case_of('00000000-0000-0000-0000-0000000000f7')).id, 'deposited', NULL);
    RAISE EXCEPTION 'FAILED: the office closed a case as deposited';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: only settled another way or not coming close by hand';
  END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.close_ar_unbanked_check_case((bedt.case_of('00000000-0000-0000-0000-0000000000f8')).id, 'not_coming', NULL);
    RAISE EXCEPTION 'FAILED: a subcontractor closed a case';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a subcontractor cannot close a case';
  END;
END $$;

-- 5 · the quiet backfill marks new cases told; the next run's cases are not.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, paid_on, payment_type) VALUES
  ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000a0001', 950, '2026-09-01', 'Check');
SELECT public.open_ar_unbanked_check_cases(10, '2026-07-01', true);
SELECT bedt.ok('a quiet run opens the case already told', (bedt.case_of('00000000-0000-0000-0000-0000000000fb')).notified_at IS NOT NULL);
SELECT bedt.ok('the earlier cases were opened loud', (bedt.case_of('00000000-0000-0000-0000-0000000000f8')).notified_at IS NULL);

-- 6 · grants: the sweep is the service role's; the office reads the cases through RLS.
SELECT bedt.ok('authenticated cannot run the sweep', NOT has_function_privilege('authenticated', 'public.open_ar_unbanked_check_cases(integer, date, boolean)', 'EXECUTE'));
SELECT bedt.ok('authenticated can close and reopen', has_function_privilege('authenticated', 'public.close_ar_unbanked_check_case(uuid, text, text)', 'EXECUTE') AND has_function_privilege('authenticated', 'public.reopen_ar_unbanked_check_case(uuid)', 'EXECUTE'));
SELECT bedt.ok('anon cannot list', NOT has_function_privilege('anon', 'public.list_ar_return_cases(boolean)', 'EXECUTE'));
SELECT bedt.ok('the check test names checks and nothing else', (
  public.ar_check_payment_type('Check') AND public.ar_check_payment_type('cheque') AND public.ar_check_payment_type('checkDeposit')
  AND public.ar_check_payment_type('ck') AND NOT public.ar_check_payment_type('Card (external)') AND NOT public.ar_check_payment_type('ACH')
  AND NOT public.ar_check_payment_type(NULL) AND NOT public.ar_check_payment_type('Stock')));

SELECT 'ar_unbanked_checks PASSED' AS result;
ROLLBACK;
