-- The scenario (v2.5634): after the migration ran twice over the seed, the backfill gave the resend its line and
-- nothing else; a new resend gets its line the moment it is logged; a first send keeps its one invoice_sent line; an
-- orphan send and a second run change nothing. In one transaction that rolls back.
\set ON_ERROR_STOP on
BEGIN;

-- 1. The backfill: job 1's resend has one line, its first send none, job 2's one send none, the orphan none.
SELECT bedt.ok('the resend logged before the migration got its line',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_stripe_email_sent' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c2') = 1);
SELECT bedt.ok('its line is the job''s, the bill''s, at the send''s time, financial, nobody''s',
  (SELECT job_id = '00000000-0000-0000-0000-000000000001' AND detail ->> 'invoice_id' = '00000000-0000-0000-0000-0000000000b1'
          AND occurred_at = '2026-08-27T20:40:00Z'::timestamptz AND financial AND actor_user_id IS NULL
          AND summary = 'Invoice emailed to customer (Stripe)'
   FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c2'));
SELECT bedt.ok('a first send keeps its one invoice_sent line and gets no second',
  (SELECT count(*) FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000000001') = 2
  AND (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c1') = 0);
SELECT bedt.ok('a send ten seconds after its first-send line is that send, not a resend',
  (SELECT count(*) FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000000002') = 1);
SELECT bedt.ok('an orphan send writes nothing',
  (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c9') = 0);
SELECT bedt.ok('the second run of the migration doubled nothing',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_stripe_email_sent') = 1);

-- 2. A new resend from the Resend button: the service role, no signed-in id.
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (id, jobs_ledger_invoice_id, sent_at, stripe_invoice_id)
  VALUES ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b1', '2026-09-04T18:04:50Z', 'in_1');
SELECT bedt.ok('a new resend gets its line the moment it is logged',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_stripe_email_sent' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c4'
     AND job_id = '00000000-0000-0000-0000-000000000001' AND occurred_at = '2026-09-04T18:04:50Z'::timestamptz AND actor_user_id IS NULL) = 1);

-- 3. A bill's first send, in the function's order: the invoice trigger's line, then the log row with the same time.
INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial) VALUES
  ('00000000-0000-0000-0000-000000000003', 'invoice_sent', '2026-10-19T16:00:00Z', NULL, 'Invoice sent to customer (stripe)',
   jsonb_build_object('invoice_id', '00000000-0000-0000-0000-0000000000b3', 'source_id', '00000000-0000-0000-0000-0000000000b3', 'channel', 'stripe'), true);
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (id, jobs_ledger_invoice_id, sent_at, stripe_invoice_id)
  VALUES ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000b3', '2026-10-19T16:00:00Z', 'in_3');
SELECT bedt.ok('a first send keeps one line',
  (SELECT count(*) FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000000003') = 1);

-- 4. A resend by a signed-in person carries their id.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (id, jobs_ledger_invoice_id, sent_at, stripe_invoice_id)
  VALUES ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000b3', '2026-10-20T16:00:00Z', 'in_3');
SELECT bedt.ok('a resend by a signed-in person is theirs',
  (SELECT actor_user_id = '00000000-0000-0000-0000-0000000000a1' FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000c6'));
SELECT bedt.as_user(NULL);

-- 5. An orphan send now: no line, no error.
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (jobs_ledger_invoice_id, sent_at) VALUES ('00000000-0000-0000-0000-0000000000fe', now());
SELECT bedt.ok('an orphan send now writes nothing and raises nothing',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_stripe_email_sent') = 3);

DO $$ BEGIN RAISE NOTICE 'stripe_email_sends_trail PASSED'; END $$;
ROLLBACK;
