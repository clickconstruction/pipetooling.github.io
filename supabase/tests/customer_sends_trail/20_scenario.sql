-- The scenario (v2.5636): after the migration ran twice over the seed, every send recorded before it has one line
-- with the right job, words, time and sender, and nothing else has one; a new send gets its line the moment it is
-- recorded; a dry run, a `sent` row, an affidavit and a bill's first copy write nothing; a line that cannot be
-- written never loses the record; nobody signed in can call the functions. In one transaction that rolls back.
\set ON_ERROR_STOP on
BEGIN;

-- 1. The backfill, by kind, and nothing doubled by the second run.
SELECT bedt.ok('the backfill wrote three reminders, four demand letters, four notices and one paper resend, and nothing twice',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'contract_reminded') = 3
  AND (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'demand_letter_sent') = 4
  AND (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'lien_notice_sent') = 4
  AND (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_resent') = 1
  AND (SELECT count(*) FROM public.job_activity_events) = 14);
SELECT bedt.ok('every new line is financial',
  NOT EXISTS (SELECT 1 FROM public.job_activity_events
              WHERE event_type IN ('contract_reminded', 'demand_letter_sent', 'lien_notice_sent', 'invoice_resent') AND NOT financial));
SELECT bedt.ok('the lines the old triggers wrote are untouched',
  (SELECT count(*) FROM public.job_activity_events WHERE event_type IN ('invoice_sent', 'contract_sent')) = 2);

-- 2. Contract reminders.
SELECT bedt.ok('a reminder the cron sent is the contract''s job''s, numbered, to its address, at its time, nobody''s',
  (SELECT job_id = '00000000-0000-0000-0000-000000000001'
          AND summary = 'Contract reminder 1 emailed to pat@example.test — Service agreement'
          AND occurred_at = '2026-10-10T15:00:00Z'::timestamptz AND actor_user_id IS NULL
          AND detail ->> 'contract_id' = '00000000-0000-0000-0000-0000000000c1' AND detail -> 'reminder' = '1'::jsonb
   FROM bedt.line('contract_reminded', '00000000-0000-0000-0000-0000000000e2')));
SELECT bedt.ok('the second reminder has its own line',
  (bedt.line('contract_reminded', '00000000-0000-0000-0000-0000000000e3')).summary = 'Contract reminder 2 emailed to pat@example.test — Service agreement');
SELECT bedt.ok('a dry run sent nothing and has no line',
  (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000e4') = 0);
SELECT bedt.ok('a contract''s sent row is no reminder',
  (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000e1') = 0);
SELECT bedt.ok('an early reminder with no number and no address reads plainly, on its own job',
  (SELECT job_id = '00000000-0000-0000-0000-000000000004' AND summary = 'Contract reminder emailed to the customer — Contract'
   FROM bedt.line('contract_reminded', '00000000-0000-0000-0000-0000000000e5')));

-- 3. Demand letters.
SELECT bedt.ok('a letter recorded the day it went: its saved time, its sender, to whom, how, how much and by when',
  (SELECT job_id = '00000000-0000-0000-0000-000000000002'
          AND summary = 'Demand letter sent to Oak Homes LLC by certified mail — $4,720.00, pay by Nov 2, 2026'
          AND occurred_at = '2026-10-12T19:30:00Z'::timestamptz AND actor_user_id = '00000000-0000-0000-0000-0000000000a1'
          AND detail ->> 'sent_method' = 'certified_mail' AND detail ->> 'deadline_date' = '2026-11-02'
   FROM bedt.line('demand_letter_sent', '00000000-0000-0000-0000-0000000000d1')));
SELECT bedt.ok('a letter recorded a week after it went sits at noon in Chicago on the day it went',
  (SELECT summary = 'Demand letter sent to Oak Homes LLC by email — $4,720.00' AND occurred_at = '2026-10-01T17:00:00Z'::timestamptz
   FROM bedt.line('demand_letter_sent', '00000000-0000-0000-0000-0000000000d2')));
SELECT bedt.ok('a voided letter has no line',
  (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000d3') = 0);
SELECT bedt.ok('a letter saved at 9 PM in Chicago is that day''s, at its saved time, and a blank name reads the customer',
  (SELECT summary = 'Demand letter sent to the customer by courier — $1,250.50' AND occurred_at = '2026-10-14T02:00:00Z'::timestamptz
   FROM bedt.line('demand_letter_sent', '00000000-0000-0000-0000-0000000000d4')));
SELECT bedt.ok('a letter with no way and no day reads plainly at its saved time, nobody''s',
  (SELECT summary = 'Demand letter sent to the customer — $0.00' AND occurred_at = '2026-10-14T16:00:00Z'::timestamptz AND actor_user_id IS NULL
   FROM bedt.line('demand_letter_sent', '00000000-0000-0000-0000-0000000000d5')));

-- 4. Lien notices.
SELECT bedt.ok('a notice to both by certified mail names both and the way once, at its saved time, by its sender',
  (SELECT job_id = '00000000-0000-0000-0000-000000000003'
          AND summary = 'Lien notice sent to the owner and the original contractor by certified mail — $1,200.00'
          AND occurred_at = '2026-10-15T20:00:00Z'::timestamptz AND actor_user_id = '00000000-0000-0000-0000-0000000000a1'
          AND detail ->> 'kind' = 'notice_53_056'
   FROM bedt.line('lien_notice_sent', '00000000-0000-0000-0000-0000000000f1')));
SELECT bedt.ok('a retainage notice that went two ways names each, at noon on the earliest day',
  (SELECT summary = 'Retainage notice sent to the owner by certified mail and the original contractor by email — $300.00'
          AND occurred_at = '2026-10-01T17:00:00Z'::timestamptz AND detail ->> 'kind' = 'retainage_53_057'
   FROM bedt.line('lien_notice_sent', '00000000-0000-0000-0000-0000000000f2')));
SELECT bedt.ok('an affidavit and a voided notice have no line',
  (SELECT count(*) FROM public.job_activity_events
   WHERE detail ->> 'source_id' IN ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4')) = 0);
SELECT bedt.ok('a send by a way with no words and a day that is no date reads its recipient at the saved time',
  (SELECT summary = 'Lien notice sent to Acme Lenders — $50.00' AND occurred_at = '2026-10-17T16:00:00Z'::timestamptz
   FROM bedt.line('lien_notice_sent', '00000000-0000-0000-0000-0000000000f5')));
SELECT bedt.ok('sends that are not a list read as none',
  (bedt.line('lien_notice_sent', '00000000-0000-0000-0000-0000000000f6')).summary = 'Lien notice sent — $75.00');

-- 5. Paper bill resends.
SELECT bedt.ok('a paper resend is the bill''s job''s, to every address, at the copy''s time, by its sender',
  (SELECT job_id = '00000000-0000-0000-0000-000000000001'
          AND summary = 'Invoice emailed again to pat@example.test, ap@example.test'
          AND occurred_at = '2026-10-17T14:00:00Z'::timestamptz AND actor_user_id = '00000000-0000-0000-0000-0000000000a1'
          AND detail ->> 'invoice_id' = '00000000-0000-0000-0000-0000000000b1' AND detail ->> 'channel' = 'physical'
   FROM bedt.line('invoice_resent', '00000000-0000-0000-0000-000000000052')));
SELECT bedt.ok('a bill''s first copy, a demand letter''s copy, a resend of a bill that is gone and one that names no bill write nothing',
  (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' IN (
     '00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000053',
     '00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000055')) = 0);
SELECT bedt.ok('the bill''s first send keeps its one invoice_sent line',
  (SELECT count(*) FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000000001' AND event_type = 'invoice_sent') = 1);

-- 6. New sends, as the app records them.
-- The cron's reminder (the service role: nobody signed in), its dry run, and a view.
INSERT INTO public.job_contract_events (id, contract_id, event_type, metadata, occurred_at) VALUES
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000c2', 'reminded', '{"n": 2, "to": "ada@example.test", "revision": 2}', '2026-10-19T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000c2', 'reminded', '{"n": 3, "to": "ada@example.test", "dry_run": true}', '2026-10-19T15:01:00Z'),
  ('00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000c2', 'viewed', '{}', '2026-10-19T15:02:00Z');
SELECT bedt.ok('a new reminder gets its line the moment it is logged; its dry run and a view get none',
  (SELECT summary = 'Contract reminder 2 emailed to ada@example.test — Contract' AND occurred_at = '2026-10-19T15:00:00Z'::timestamptz
   FROM bedt.line('contract_reminded', '00000000-0000-0000-0000-0000000000e6'))
  AND (SELECT count(*) FROM public.job_activity_events
       WHERE detail ->> 'source_id' IN ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000e8')) = 0);

-- Lee records a letter and a notice from the Lien window, and an affidavit.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
INSERT INTO public.job_demand_letters (id, job_id, amount, deadline_date, recipient_name, sent_method, sent_at, created_by, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-000000000004', 980, '2026-11-09', 'Ada Example', 'email',
   '2026-10-19', '00000000-0000-0000-0000-0000000000a2', '2026-10-19T16:00:00Z');
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, sends, created_by, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-000000000004', 'notice_53_056', 980,
   '[{"recipient": "owner", "method": "email", "tracking": "resend:y", "sent_on": "2026-10-19"}]',
   '00000000-0000-0000-0000-0000000000a2', '2026-10-19T16:05:00Z'),
  ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-000000000004', 'affidavit', 980, '[]',
   '00000000-0000-0000-0000-0000000000a2', '2026-10-19T16:06:00Z');
SELECT bedt.as_user(NULL);
SELECT bedt.ok('a new letter is its recorder''s, at once',
  (SELECT summary = 'Demand letter sent to Ada Example by email — $980.00, pay by Nov 9, 2026'
          AND actor_user_id = '00000000-0000-0000-0000-0000000000a2' AND occurred_at = '2026-10-19T16:00:00Z'::timestamptz
   FROM bedt.line('demand_letter_sent', '00000000-0000-0000-0000-0000000000d6')));
SELECT bedt.ok('a new notice gets its line at once, a new affidavit none',
  (SELECT summary = 'Lien notice sent to the owner by email — $980.00' AND actor_user_id = '00000000-0000-0000-0000-0000000000a2'
   FROM bedt.line('lien_notice_sent', '00000000-0000-0000-0000-0000000000f7'))
  AND (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' = '00000000-0000-0000-0000-0000000000f8') = 0);

-- send-physical-invoice-email files its copies as the service role, naming the sender: a resend, a first send, an orphan.
INSERT INTO public.sent_documents (id, kind, how, recipient_emails, source_table, source_id, sent_at, sent_by) VALUES
  ('00000000-0000-0000-0000-000000000056', 'bill_resent', 'email', '{billing@oak.example.test}', 'jobs_ledger_invoices',
   '00000000-0000-0000-0000-0000000000b2', '2026-10-19T17:00:00Z', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000057', 'bill', 'email', '{billing@oak.example.test}', 'jobs_ledger_invoices',
   '00000000-0000-0000-0000-0000000000b2', '2026-10-19T17:01:00Z', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-000000000058', 'bill_resent', 'email', '{x@example.test}', 'jobs_ledger_invoices',
   '00000000-0000-0000-0000-0000000000fe', '2026-10-19T17:02:00Z', NULL);
SELECT bedt.ok('a new paper resend is its sender''s, on the bill''s job; a first copy and an orphan write nothing and raise nothing',
  (SELECT job_id = '00000000-0000-0000-0000-000000000002' AND summary = 'Invoice emailed again to billing@oak.example.test'
          AND actor_user_id = '00000000-0000-0000-0000-0000000000a2'
   FROM bedt.line('invoice_resent', '00000000-0000-0000-0000-000000000056'))
  AND (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'invoice_resent') = 2);

-- 7. A line that cannot be written never loses the record: the trail refuses every row for a moment.
ALTER TABLE public.job_activity_events ADD CONSTRAINT bed_refuses_all CHECK (false) NOT VALID;
INSERT INTO public.job_demand_letters (id, job_id, amount, recipient_name, sent_method, sent_at, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-000000000004', 10, 'Ada Example', 'hand', '2026-10-19', '2026-10-19T18:00:00Z');
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-000000000004', 'retainage_53_057', 10, '2026-10-19T18:00:00Z');
INSERT INTO public.job_contract_events (id, contract_id, event_type, metadata) VALUES
  ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000c2', 'reminded', '{"n": 3}');
INSERT INTO public.sent_documents (id, kind, how, source_table, source_id) VALUES
  ('00000000-0000-0000-0000-000000000059', 'bill_resent', 'email', 'jobs_ledger_invoices', '00000000-0000-0000-0000-0000000000b2');
ALTER TABLE public.job_activity_events DROP CONSTRAINT bed_refuses_all;
SELECT bedt.ok('the letter, the notice, the reminder and the copy were kept though their lines could not be',
  EXISTS (SELECT 1 FROM public.job_demand_letters WHERE id = '00000000-0000-0000-0000-0000000000d7')
  AND EXISTS (SELECT 1 FROM public.job_lien_filings WHERE id = '00000000-0000-0000-0000-0000000000f9')
  AND EXISTS (SELECT 1 FROM public.job_contract_events WHERE id = '00000000-0000-0000-0000-0000000000e9')
  AND EXISTS (SELECT 1 FROM public.sent_documents WHERE id = '00000000-0000-0000-0000-000000000059')
  AND (SELECT count(*) FROM public.job_activity_events WHERE detail ->> 'source_id' IN (
         '00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000f9',
         '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-000000000059')) = 0);

-- 8. The two helpers' edges.
SELECT bedt.ok('a day that is no date, or none, reads as the saved time',
  public.job_activity_send_at('2026-13-01', '2026-10-19T18:00:00Z') = '2026-10-19T18:00:00Z'::timestamptz
  AND public.job_activity_send_at(NULL, '2026-10-19T18:00:00Z') = '2026-10-19T18:00:00Z'::timestamptz
  AND public.job_activity_send_at('soon', '2026-10-19T18:00:00Z') = '2026-10-19T18:00:00Z'::timestamptz);
SELECT bedt.ok('noon in Chicago in winter is 18:00 UTC',
  public.job_activity_send_at('2026-12-01', '2026-12-09T18:00:00Z') = '2026-12-01T18:00:00Z'::timestamptz);
SELECT bedt.ok('the ways in words',
  public.job_activity_send_words('certified_mail') = 'certified mail' AND public.job_activity_send_words('traceable_courier') = 'courier'
  AND public.job_activity_send_words('email') = 'email' AND public.job_activity_send_words('hand') = 'hand'
  AND public.job_activity_send_words('') IS NULL AND public.job_activity_send_words(NULL) IS NULL);

-- 9. Nobody signed in can call them.
SELECT bedt.ok('neither a signed-in user nor anon can call the line functions or the helpers',
  NOT has_function_privilege('authenticated', 'public.job_activity_line_contract_reminder(public.job_contract_events)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.job_activity_line_demand_letter(public.job_demand_letters)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.job_activity_line_lien_notice(public.job_lien_filings)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.job_activity_line_bill_resent(public.sent_documents)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.job_activity_send_at(text, timestamptz)', 'execute')
  AND NOT has_function_privilege('anon', 'public.job_activity_send_words(text)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.sent_documents_to_activity()', 'execute'));

DO $$ BEGIN RAISE NOTICE 'customer_sends_trail PASSED'; END $$;
ROLLBACK;
