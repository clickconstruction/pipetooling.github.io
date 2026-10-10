-- The revenue riders bed's scenario (v2.5129), after the migration ran twice. One transaction that rolls back; each
-- check raises on a miss and prints an "ok:" line, and the last line is "revenue_riders PASSED".

BEGIN;
SELECT set_config('bed.uid', '11111111-1111-1111-1111-111111111111', true);

CREATE OR REPLACE FUNCTION pg_temp.check(p_label text, p_got anyelement, p_want anyelement) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'MISS %: got %, want %', p_label, p_got, p_want;
  END IF;
  RAISE NOTICE 'ok: %', p_label;
END $$;

-- 1. The backfill marked the two bills the function made and left the rest alone.
SELECT pg_temp.check('the old $99 trip charge on A carries its entry',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND stripe_invoice_memo = 'Trip charge — client not home'),
  '[{"trip_charge": "client_not_home", "amount": 99}]'::jsonb);
SELECT pg_temp.check('the old $250 trip charge on B carries its entry, once (the second run changed nothing)',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 250),
  '[{"trip_charge": "site_not_ready", "amount": 250}]'::jsonb);
SELECT pg_temp.check('exactly two bills carry a trip charge entry',
  (SELECT count(*) FROM public.jobs_ledger_invoices i, jsonb_array_elements(coalesce(i.fee_lines, '[]'::jsonb)) l WHERE l ? 'trip_charge'),
  2::bigint);
SELECT pg_temp.check('a trip charge whose memo the office renamed stays unmarked',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 80), NULL::jsonb);
SELECT pg_temp.check('a trip charge whose amount changed stays unmarked',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 120), NULL::jsonb);
SELECT pg_temp.check('a trip charge with a returned check fee on it keeps that entry alone',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 60),
  '[{"case_id": "case-9", "amount": 30, "description": "Returned check fee"}]'::jsonb);
SELECT pg_temp.check('hand-typed bills stay unmarked: a line on it, the primary, a split part, made yesterday, no note',
  (SELECT count(*) FROM public.jobs_ledger_invoices WHERE id IN (
     'bbbbbbbb-1111-0000-0000-000000000004', 'bbbbbbbb-1111-0000-0000-000000000005', 'bbbbbbbb-1111-0000-0000-000000000006',
     'bbbbbbbb-1111-0000-0000-000000000007', 'bbbbbbbb-1111-0000-0000-000000000008') AND fee_lines IS NULL),
  5::bigint);

-- 2. job_rider_fees counts the trip charge beside the other riders.
SELECT pg_temp.check('A''s riders: $200 hazmat + $30 check fee + $99 trip charge',
  public.job_rider_fees('aaaaaaaa-0000-0000-0000-000000000001'), 329::numeric);
SELECT pg_temp.check('a job with no rider reads 0', public.job_rider_fees('cccccccc-0000-0000-0000-000000000001'), 0::numeric);
SELECT pg_temp.check('an unknown job reads 0', public.job_rider_fees('99999999-0000-0000-0000-000000000001'), 0::numeric);

-- 3. A rewrite of the revenue from the line items keeps the trip charge (main wrote $1,720 here and lost the $99).
SELECT public.apply_job_discount('aaaaaaaa-0000-0000-0000-000000000001', 'Loyalty', NULL, 10, NULL, NULL);
SELECT pg_temp.check('Add discount after the old trip charge: 1,500 - 10 + 329',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1819::numeric);

-- 4. A trip charge made now carries its entry from the start, with no description for the paper.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001');
SELECT pg_temp.check('the new trip charge goes on',
  (public.create_turnaway_trip_charge('aaaaaaaa-0000-0000-0000-000000000001', 250, 'site_not_ready', 'd0000000-0000-0000-0000-0000000000a2') ->> 'ok'), 'true');
SELECT pg_temp.check('its bill carries {trip_charge, amount} and no description',
  (SELECT fee_lines FROM public.jobs_ledger_invoices WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND amount = 250),
  '[{"trip_charge": "site_not_ready", "amount": 250}]'::jsonb);
SELECT pg_temp.check('the revenue rose by $250', (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2069::numeric);
SELECT pg_temp.check('a second press on the closed request is a duplicate',
  (public.create_turnaway_trip_charge('aaaaaaaa-0000-0000-0000-000000000001', 250, 'site_not_ready', 'd0000000-0000-0000-0000-0000000000a2') ->> 'duplicate'), 'true');
SELECT pg_temp.check('and made no second bill',
  (SELECT count(*) FROM public.jobs_ledger_invoices WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND amount = 250), 1::bigint);
SELECT public.apply_job_discount('aaaaaaaa-0000-0000-0000-000000000001', 'Promo', NULL, 5, NULL, NULL);
SELECT pg_temp.check('Add discount after both trip charges: 1,500 - 15 + 579',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2064::numeric);

-- 5. Deleting a trip charge's bill takes the trip charge out at the next rewrite.
DELETE FROM public.jobs_ledger_invoices WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND amount = 250;
SELECT public.apply_job_discount('aaaaaaaa-0000-0000-0000-000000000001', 'Cleanup', NULL, 1, NULL, NULL);
SELECT pg_temp.check('after the $250 bill is deleted: 1,500 - 16 + 329',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1813::numeric);

-- 6. A deleted bill gives its returned check fee back to its case (v2.5144, punch list #105 gap 1).
SELECT pg_temp.check('the backfill gave case E its fee back, unstamped (its revenue was not lowered), so the press can run again',
  (SELECT fee_amount IS NULL AND fee_added_at IS NULL AND fee_added_by IS NULL AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'ce000000-0000-0000-0000-00000000000e'), true);
SELECT pg_temp.check('the backfill left case F, whose entry still rides on a live bill',
  (SELECT fee_added_at IS NOT NULL AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);
SELECT pg_temp.check('and case D, whose fee is on its bill',
  (SELECT fee_invoice_id FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d'),
  'dddddddd-1111-0000-0000-000000000001'::uuid);
SELECT pg_temp.check('neither run stamped a case', (SELECT count(*) FROM public.mercury_transaction_ar_returned WHERE fee_came_off_at IS NOT NULL), 0::bigint);
SELECT pg_temp.check('list_ar_return_case_fees returns fee_came_off_at',
  position('fee_came_off_at timestamp with time zone' in pg_get_function_result('public.list_ar_return_case_fees(uuid[])'::regprocedure)) > 0, true);

DELETE FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000001';
SELECT pg_temp.check('deleting bill 1 gives case D its fee back: amount, bill and day cleared, the stamp set, who kept',
  (SELECT fee_amount IS NULL AND fee_invoice_id IS NULL AND fee_added_at IS NULL AND fee_came_off_at IS NOT NULL
          AND fee_added_by = '11111111-1111-1111-1111-111111111111'
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d'), true);
SELECT pg_temp.check('D''s total loses the $30 at once: 1,060 - 30',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 1030::numeric);
SELECT pg_temp.check('which is what a rewrite would write: the $1,000 line + F''s $30 still on bill 2',
  1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001'), 1030::numeric);
SELECT pg_temp.check('the job''s history says so, once',
  (SELECT string_agg(summary, ' | ') FROM public.job_activity_events
   WHERE job_id = 'dddddddd-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_off'),
  'Returned check fee: $30.00 came off with bill 1. The case can add it again.');
SELECT pg_temp.check('case F keeps its fee: its entry is on bill 2, which stays',
  (SELECT fee_added_at IS NOT NULL FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);

-- An entry whose case id is not a uuid cannot stop a delete. With no case to give it back to, it is left to the next
-- rewrite, as a deleted trip charge is, so a restore of the bill would need nothing back either.
DELETE FROM public.jobs_ledger_invoices WHERE id = 'aaaaaaaa-1111-0000-0000-000000000001';
SELECT pg_temp.check('A''s bill with the "case-1" entry goes, and A''s total is left to the next rewrite: 1,813',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1813::numeric);
SELECT pg_temp.check('with no case to name, no history line', (SELECT count(*) FROM public.job_activity_events
  WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_off'), 0::bigint);

-- 7. A bill that comes back with the entry (review on #5283): a Split part, or a bill restored from Recently deleted.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, fee_lines) VALUES
  ('dddddddd-1111-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 530, 'ready_to_bill', 2, false,
   '[{"case_id": "cd000000-0000-0000-0000-00000000000d", "amount": 30, "description": "Returned check fee", "added_at": "2026-10-09T15:00:00+00:00"}]');
SELECT pg_temp.check('a part carrying D''s entry attaches case D to it, from the entry, and clears the stamp',
  (SELECT fee_invoice_id = 'dddddddd-1111-0000-0000-000000000003' AND fee_amount = 30 AND fee_added_at = '2026-10-09T15:00:00+00:00'::timestamptz
          AND fee_added_by = '11111111-1111-1111-1111-111111111111' AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d'), true);
SELECT pg_temp.check('D''s total gets the $30 back: 1,030 + 30, what a rewrite writes (1,000 + 60)',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001')
    = 1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001')
  AND (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001') = 1060, true);
SELECT pg_temp.check('the history says it is back, once',
  (SELECT string_agg(summary, ' | ') FROM public.job_activity_events
   WHERE job_id = 'dddddddd-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_back'),
  'Returned check fee: $30.00 is back on bill 3.');

CREATE OR REPLACE FUNCTION pg_temp.press(p_case uuid, p_bill uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.add_ar_return_case_fee(p_case, p_bill) ->> 'ok';
EXCEPTION WHEN others THEN
  RETURN SQLERRM;
END $$;
INSERT INTO public.jobs_ledger_payments (mercury_transaction_id, invoice_id) VALUES
  ('cd000000-0000-0000-0000-00000000000d', 'dddddddd-1111-0000-0000-000000000002'),
  ('c9000000-0000-0000-0000-000000000009', 'dddddddd-1111-0000-0000-000000000002');
SELECT pg_temp.check('so the press refuses a second fee for D',
  pg_temp.press('cd000000-0000-0000-0000-00000000000d', 'dddddddd-1111-0000-0000-000000000002'), 'This case already has its fee.');

-- Case G is released, but its entry sits on bill 2, written without the press: the restated press refuses it.
INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, source) VALUES ('c9000000-0000-0000-0000-000000000009', 'bank');
UPDATE public.jobs_ledger_invoices
SET fee_lines = fee_lines || '[{"case_id": "c9000000-0000-0000-0000-000000000009", "amount": 30}]'::jsonb
WHERE id = 'dddddddd-1111-0000-0000-000000000002';
SELECT pg_temp.check('a case whose entry is already on a live bill takes no second fee',
  pg_temp.press('c9000000-0000-0000-0000-000000000009', 'dddddddd-1111-0000-0000-000000000002'), 'A bill already carries this case''s fee.');
UPDATE public.jobs_ledger_invoices
SET fee_lines = '[{"case_id": "cf000000-0000-0000-0000-00000000000f", "amount": 30, "description": "Returned check fee"}]'
WHERE id = 'dddddddd-1111-0000-0000-000000000002';

-- The press after a came-off: bill 3 goes, D is released again, and the press puts the fee on bill 2.
CREATE TEMP TABLE kept_bill_3 AS SELECT * FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000003';
DELETE FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000003';
SELECT pg_temp.check('bill 3 going takes the $30 off again: 1,030', (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 1030::numeric);
SELECT pg_temp.check('the press runs again after the fee came off',
  pg_temp.press('cd000000-0000-0000-0000-00000000000d', 'dddddddd-1111-0000-0000-000000000002'), 'true');
SELECT pg_temp.check('D''s fee is on bill 2, its stamp cleared, and the total is 1,060 = 1,000 + 60 again',
  (SELECT fee_invoice_id = 'dddddddd-1111-0000-0000-000000000002' AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d')
  AND (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001') = 1060
  AND 1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001') = 1060, true);

-- Review on #5283: bill 3 restored now, with D's fee on bill 2, is refused in words; the restore rolls back whole.
CREATE OR REPLACE FUNCTION pg_temp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN others THEN
  RETURN SQLERRM;
END $$;
SELECT pg_temp.check('restoring bill 3 after D''s fee went on bill 2 is refused, in words',
  pg_temp.try('INSERT INTO public.jobs_ledger_invoices SELECT * FROM kept_bill_3'),
  'Bill 3 carries the returned check fee that is on bill 2 now. Take it off bill 2 first.');
SELECT pg_temp.check('so bill 3 is not back, D''s fee stays on bill 2, and the total is still what a rewrite writes',
  NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000003')
  AND (SELECT fee_invoice_id FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d') = 'dddddddd-1111-0000-0000-000000000002'
  AND (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001') = 1060
  AND 1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001') = 1060, true);

-- A bill written without the press goes, carrying two entries whose fees are elsewhere; each case keeps its fee.
-- Case H's fee is on bill 2 by its fee_invoice_id (and no other bill names it); case F's fee_invoice_id is null, but
-- its entry rides on bill 2. Each is held by its own clause of the delete trigger.
INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, source, fee_amount, fee_invoice_id, fee_added_at, fee_added_by) VALUES
  ('c8000000-0000-0000-0000-000000000008', 'bank', 30, 'dddddddd-1111-0000-0000-000000000002', now(), '11111111-1111-1111-1111-111111111111');
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle) VALUES
  ('dddddddd-1111-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 0.5, 'ready_to_bill', 3, false);
UPDATE public.jobs_ledger_invoices
SET fee_lines = '[{"case_id": "c8000000-0000-0000-0000-000000000008", "amount": 30}, {"case_id": "cf000000-0000-0000-0000-00000000000f", "amount": 30}]'
WHERE id = 'dddddddd-1111-0000-0000-000000000004';
DELETE FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000004';
SELECT pg_temp.check('a case whose fee_invoice_id is another live bill keeps its fee (H, on bill 2)',
  (SELECT fee_invoice_id = 'dddddddd-1111-0000-0000-000000000002' AND fee_added_at IS NOT NULL AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'c8000000-0000-0000-0000-000000000008'), true);
SELECT pg_temp.check('a case whose entry rides on another live bill keeps its fee (F, on bill 2)',
  (SELECT fee_added_at IS NOT NULL AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);
SELECT pg_temp.check('and the total and the history are left alone',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001') = 1060
  AND (SELECT count(*) FROM public.job_activity_events
       WHERE job_id = 'dddddddd-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_off'
         AND detail->>'invoice_id' = 'dddddddd-1111-0000-0000-000000000004') = 0, true);

-- Deleting the whole job, then restoring it: its bills go by cascade after its row, so the cases get their fee
-- back without a stamp, a revenue change or a history line; the restore attaches them again and raises nothing,
-- since the restored job row still holds the fees. Production keys the bills to the job with ON DELETE CASCADE; it
-- has no key on job_activity_events, so the bed adds one here, where a line written for a job that is gone fails.
ALTER TABLE public.jobs_ledger_invoices DROP CONSTRAINT jobs_ledger_invoices_job_id_fkey,
  ADD CONSTRAINT jobs_ledger_invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs_ledger (id) ON DELETE CASCADE;
ALTER TABLE public.job_activity_events
  ADD CONSTRAINT job_activity_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs_ledger (id) ON DELETE CASCADE;
CREATE TEMP TABLE kept_job AS SELECT * FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001';
CREATE TEMP TABLE kept_bills AS SELECT * FROM public.jobs_ledger_invoices WHERE job_id = 'dddddddd-0000-0000-0000-000000000001';
DELETE FROM public.jobs_ledger_fixtures WHERE job_id = 'dddddddd-0000-0000-0000-000000000001';
DELETE FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001';
SELECT pg_temp.check('deleting job D gives cases D and F their fees back, unstamped, without an error',
  (SELECT count(*) FROM public.mercury_transaction_ar_returned
   WHERE mercury_transaction_id IN ('cd000000-0000-0000-0000-00000000000d', 'cf000000-0000-0000-0000-00000000000f')
     AND fee_added_at IS NULL AND fee_invoice_id IS NULL AND fee_came_off_at IS NULL), 2::bigint);
INSERT INTO public.jobs_ledger SELECT * FROM kept_job;
INSERT INTO public.jobs_ledger_fixtures (job_id, name, count, sequence_order, line_unit_price) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'Repipe', 1, 0, 1000);
INSERT INTO public.jobs_ledger_invoices SELECT * FROM kept_bills;
SELECT pg_temp.check('restoring it attaches D and F to bill 2 again',
  (SELECT count(*) FROM public.mercury_transaction_ar_returned
   WHERE mercury_transaction_id IN ('cd000000-0000-0000-0000-00000000000d', 'cf000000-0000-0000-0000-00000000000f')
     AND fee_invoice_id = 'dddddddd-1111-0000-0000-000000000002' AND fee_added_at IS NOT NULL), 2::bigint);
SELECT pg_temp.check('and raises nothing: the restored total 1,060 is what a rewrite writes',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001') = 1060
  AND 1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001') = 1060, true);
SELECT pg_temp.check('with no history line', (SELECT count(*) FROM public.job_activity_events WHERE job_id = 'dddddddd-0000-0000-0000-000000000001'), 0::bigint);

DO $$ BEGIN RAISE NOTICE 'revenue_riders PASSED'; END $$;
ROLLBACK;
