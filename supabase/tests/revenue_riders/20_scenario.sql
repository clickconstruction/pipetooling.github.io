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
SELECT pg_temp.check('the backfill gave case E its fee back, stamped, so the press can run again',
  (SELECT fee_amount IS NULL AND fee_added_at IS NULL AND fee_added_by IS NULL AND fee_came_off_at IS NOT NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'ce000000-0000-0000-0000-00000000000e'), true);
SELECT pg_temp.check('the backfill left case F, whose entry still rides on a live bill',
  (SELECT fee_added_at IS NOT NULL AND fee_came_off_at IS NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);
SELECT pg_temp.check('and case D, whose fee is on its bill',
  (SELECT fee_invoice_id FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d'),
  'dddddddd-1111-0000-0000-000000000001'::uuid);
SELECT pg_temp.check('the second run stamped no other case', (SELECT count(*) FROM public.mercury_transaction_ar_returned WHERE fee_came_off_at IS NOT NULL), 1::bigint);
SELECT pg_temp.check('list_ar_return_case_fees returns fee_came_off_at',
  position('fee_came_off_at timestamp with time zone' in pg_get_function_result('public.list_ar_return_case_fees(uuid[])'::regprocedure)) > 0, true);

DELETE FROM public.jobs_ledger_invoices WHERE id = 'dddddddd-1111-0000-0000-000000000001';
SELECT pg_temp.check('deleting bill 1 gives case D its fee back: amount, bill, day and who cleared, the stamp set',
  (SELECT fee_amount IS NULL AND fee_invoice_id IS NULL AND fee_added_at IS NULL AND fee_added_by IS NULL AND fee_came_off_at IS NOT NULL
   FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cd000000-0000-0000-0000-00000000000d'), true);
SELECT pg_temp.check('D''s total loses the $30 at once: 1,060 - 30',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 1030::numeric);
SELECT pg_temp.check('which is what a rewrite would write: the $1,000 line + F''s $30 still on bill 2',
  1000 + public.job_rider_fees('dddddddd-0000-0000-0000-000000000001'), 1030::numeric);
SELECT pg_temp.check('the job''s history says so, once',
  (SELECT string_agg(summary, ' | ') FROM public.job_activity_events
   WHERE job_id = 'dddddddd-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_off'),
  'Returned check fee: $30 came off with bill 1. The case can add it again.');
SELECT pg_temp.check('case F keeps its fee: its entry is on bill 2, which stays',
  (SELECT fee_added_at IS NOT NULL FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);

-- An entry whose case id is not a uuid cannot stop a delete; the job's total still loses it.
DELETE FROM public.jobs_ledger_invoices WHERE id = 'aaaaaaaa-1111-0000-0000-000000000001';
SELECT pg_temp.check('A''s bill with the "case-1" entry goes, and A''s total loses its $30: 1,813 - 30',
  (SELECT revenue FROM public.jobs_ledger WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1783::numeric);
SELECT pg_temp.check('with no case to name, no history line', (SELECT count(*) FROM public.job_activity_events
  WHERE job_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND event_type = 'returned_check_fee_off'), 0::bigint);

-- Deleting the whole job: its bills go by cascade after its row, so the case gets its fee back and no line is
-- written for a job that is gone. Production keys the bills to the job with ON DELETE CASCADE; it has no key on
-- job_activity_events, so the bed adds one here, where a line written for a job that is gone would fail.
ALTER TABLE public.jobs_ledger_invoices DROP CONSTRAINT jobs_ledger_invoices_job_id_fkey,
  ADD CONSTRAINT jobs_ledger_invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs_ledger (id) ON DELETE CASCADE;
ALTER TABLE public.job_activity_events
  ADD CONSTRAINT job_activity_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs_ledger (id) ON DELETE CASCADE;
DELETE FROM public.jobs_ledger_fixtures WHERE job_id = 'dddddddd-0000-0000-0000-000000000001';
DELETE FROM public.jobs_ledger WHERE id = 'dddddddd-0000-0000-0000-000000000001';
SELECT pg_temp.check('deleting job D gives case F its fee back, without an error',
  (SELECT fee_added_at IS NULL AND fee_came_off_at IS NOT NULL FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = 'cf000000-0000-0000-0000-00000000000f'), true);
SELECT pg_temp.check('and leaves no history line behind', (SELECT count(*) FROM public.job_activity_events WHERE job_id = 'dddddddd-0000-0000-0000-000000000001'), 0::bigint);

DO $$ BEGIN RAISE NOTICE 'revenue_riders PASSED'; END $$;
ROLLBACK;
