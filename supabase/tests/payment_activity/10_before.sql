-- Bug-era history, made with the old trigger before the migration runs.
INSERT INTO public.jobs_ledger (id) VALUES ('00000000-0000-0000-0000-00000000a001');

-- A check applied 9/21 and removed 9/24 (job 878's bounced check): the old trigger stamps the removal 9/21.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, created_at, payment_type)
VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000a001', 13680, '2026-09-21 15:06:44+00', 'checkDeposit');
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b1';
UPDATE public.deleted_records_archive SET deleted_at = '2026-09-24 13:43:04+00'
WHERE record_id = '00000000-0000-0000-0000-0000000000b1';

-- A removal from before the archive existed: no deletion time on record.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, created_at)
VALUES ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000a001', 500, '2026-03-16 19:29:24+00');
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b0';
DELETE FROM public.deleted_records_archive WHERE record_id = '00000000-0000-0000-0000-0000000000b0';

DO $$ BEGIN
  IF (SELECT occurred_at FROM public.job_activity_events
      WHERE event_type = 'payment_removed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b1')
     <> '2026-09-21 15:06:44+00' THEN
    RAISE EXCEPTION 'bed: the old trigger should stamp the removal at the add time';
  END IF;
  RAISE NOTICE 'before: bug reproduced PASSED';
END $$;
