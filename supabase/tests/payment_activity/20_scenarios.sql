-- Runs after the migration. Each block raises on its first failed assertion.

-- 1. The one-time correction re-dated the archived removal and left the pre-archive one alone.
DO $$ BEGIN
  IF (SELECT occurred_at FROM public.job_activity_events
      WHERE event_type = 'payment_removed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b1')
     <> '2026-09-24 13:43:04+00' THEN
    RAISE EXCEPTION 'correction: the removal should now read 9/24, the archive''s deleted_at';
  END IF;
  IF (SELECT occurred_at FROM public.job_activity_events
      WHERE event_type = 'payment_added' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b1')
     <> '2026-09-21 15:06:44+00' THEN
    RAISE EXCEPTION 'correction: the add must keep its own time';
  END IF;
  IF (SELECT occurred_at FROM public.job_activity_events
      WHERE event_type = 'payment_removed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b0')
     <> '2026-03-16 19:29:24+00' THEN
    RAISE EXCEPTION 'correction: a removal with no archive row must be left as it was';
  END IF;
  RAISE NOTICE '1 correction PASSED';
END $$;

-- 2. A payment added days ago and removed now reads "removed" now, by the person who removed it.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, created_at)
VALUES ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000a001', 6077.51, now() - interval '1 day');
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b2';
DO $$
DECLARE v_add timestamptz; v_rm timestamptz; v_arch timestamptz; v_actor uuid;
BEGIN
  SELECT occurred_at INTO v_add FROM public.job_activity_events
  WHERE event_type = 'payment_added' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b2';
  SELECT occurred_at, actor_user_id INTO v_rm, v_actor FROM public.job_activity_events
  WHERE event_type = 'payment_removed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b2';
  SELECT deleted_at INTO v_arch FROM public.deleted_records_archive
  WHERE record_id = '00000000-0000-0000-0000-0000000000b2';
  IF v_add > now() - interval '23 hours' THEN RAISE EXCEPTION 'insert: the add should keep created_at (%)', v_add; END IF;
  IF v_rm IS DISTINCT FROM v_arch THEN RAISE EXCEPTION 'delete: removal % should be the deletion time %', v_rm, v_arch; END IF;
  IF v_actor IS DISTINCT FROM '00000000-0000-0000-0000-0000000000c1' THEN RAISE EXCEPTION 'delete: actor should be the remover'; END IF;
  RAISE NOTICE '2 removal stamped when removed PASSED';
END $$;

-- 3. Restored with the same id, then removed again: both show, in order.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount, created_at)
VALUES ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000a001', 6077.51, now() - interval '1 day');
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b2';
DO $$
DECLARE v_seq text;
BEGIN
  SELECT string_agg(event_type, ',' ORDER BY occurred_at, event_type = 'payment_removed') INTO v_seq
  FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b2';
  IF v_seq <> 'payment_added,payment_removed,payment_added,payment_removed' THEN
    RAISE EXCEPTION 'restore: expected add, remove, add, remove — got %', v_seq;
  END IF;
  RAISE NOTICE '3 restore and remove again PASSED';
END $$;

-- 4. Delete and re-insert with the same id in one transaction: the re-add is still logged.
INSERT INTO public.jobs_ledger_payments (id, job_id, amount)
VALUES ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000a001', 100);
BEGIN;
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b3';
INSERT INTO public.jobs_ledger_payments (id, job_id, amount)
VALUES ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000a001', 100);
COMMIT;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.job_activity_events
      WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000b3') <> 3 THEN
    RAISE EXCEPTION 'same-transaction re-insert: expected add, remove, add';
  END IF;
  RAISE NOTICE '4 same-transaction re-insert PASSED';
END $$;

-- 5. The add stays idempotent: a row re-inserted with no logged removal in between (a replay,
--    or a delete made with the triggers off) logs nothing new.
CREATE TEMP TABLE replay AS SELECT * FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b3';
CREATE TEMP TABLE n0 AS SELECT count(*) AS n FROM public.job_activity_events;
ALTER TABLE public.jobs_ledger_payments DISABLE TRIGGER zzz_archive_on_delete;
ALTER TABLE public.jobs_ledger_payments DISABLE TRIGGER jobs_ledger_payments_to_activity_del;
DELETE FROM public.jobs_ledger_payments WHERE id = '00000000-0000-0000-0000-0000000000b3';
ALTER TABLE public.jobs_ledger_payments ENABLE TRIGGER jobs_ledger_payments_to_activity_del;
ALTER TABLE public.jobs_ledger_payments ENABLE TRIGGER zzz_archive_on_delete;
INSERT INTO public.jobs_ledger_payments SELECT * FROM replay;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.job_activity_events) <> (SELECT n FROM n0) THEN
    RAISE EXCEPTION 'idempotency: an insert whose add is already the latest event must log nothing';
  END IF;
  RAISE NOTICE '5 add idempotent PASSED';
END $$;
