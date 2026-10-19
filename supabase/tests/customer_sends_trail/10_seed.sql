-- Before the migration: what prod holds today, one row for each way a send can read (v2.5636).
--   Contract reminders on job 1: two the cron sent, a dry run that sent nothing, a `sent` row that is no reminder;
--     on job 4 an early reminder whose row names neither its number nor its address, on a contract with no name.
--   Demand letters on jobs 2 and 3: one recorded the day it went, one recorded a week after it went, one voided,
--     one recorded at 9 PM in Chicago (the next day in UTC), one with no way and no day.
--   Lien filings on jobs 3 and 4: a notice to both by certified mail, a retainage notice that went two ways on two
--     days, an affidavit, a voided notice, a notice to a lender by a way with no words and a day that is no date,
--     a notice whose sends are not a list.
--   Sent copies: a paper bill's first send (its own invoice_sent line), its resend, a resend of a bill that is gone,
--     a demand letter's copy, a resend that names no bill.
\set ON_ERROR_STOP on
INSERT INTO public.users (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Kim'),
  ('00000000-0000-0000-0000-0000000000a2', 'Lee');
INSERT INTO public.jobs_ledger (id, job_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bed job one'),
  ('00000000-0000-0000-0000-000000000002', 'Bed job two'),
  ('00000000-0000-0000-0000-000000000003', 'Bed job three'),
  ('00000000-0000-0000-0000-000000000004', 'Bed job four');
INSERT INTO public.jobs_ledger_invoices (id, job_id, status, amount, external_send_channel, sent_to_customer_at) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'billed', 4720, 'physical', '2026-10-16T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000002', 'billed', 1200, 'physical', '2026-10-01T15:00:00Z');

-- The lines the existing triggers already wrote: the bill's first send and the contract's send.
INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial) VALUES
  ('00000000-0000-0000-0000-000000000001', 'invoice_sent', '2026-10-16T15:00:00Z', '00000000-0000-0000-0000-0000000000a1', 'Invoice sent to customer (physical)',
   jsonb_build_object('invoice_id', '00000000-0000-0000-0000-0000000000b1', 'source_id', '00000000-0000-0000-0000-0000000000b1', 'channel', 'physical'), true),
  ('00000000-0000-0000-0000-000000000001', 'contract_sent', '2026-10-07T15:00:00Z', '00000000-0000-0000-0000-0000000000a1', 'Contract sent to pat@example.test — Service agreement',
   jsonb_build_object('source_id', '00000000-0000-0000-0000-0000000000c1:sent:1791380000', 'contract_id', '00000000-0000-0000-0000-0000000000c1'), true);

INSERT INTO public.job_contracts (id, job_id, status, template_name, recipient_email, reminder_count) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000001', 'sent', 'Service agreement', 'pat@example.test', 3),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000004', 'sent', NULL, NULL, 1);
INSERT INTO public.job_contract_events (id, contract_id, event_type, metadata, occurred_at) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'sent', '{}', '2026-10-07T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'reminded',
   '{"n": 1, "to": "pat@example.test", "revision": 1, "dry_run": false}', '2026-10-10T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', 'reminded',
   '{"n": 2, "to": "pat@example.test", "revision": 1, "dry_run": false}', '2026-10-13T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000c1', 'reminded',
   '{"n": 3, "to": "pat@example.test", "revision": 1, "dry_run": true}', '2026-10-16T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000c2', 'reminded', '{}', '2026-09-20T15:00:00Z');

INSERT INTO public.job_demand_letters (id, job_id, amount, deadline_date, recipient_name, sent_method, sent_at, created_by, created_at, voided_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000002', 4720, '2026-11-02', 'Oak Homes LLC', 'certified_mail',
   '2026-10-12', '00000000-0000-0000-0000-0000000000a1', '2026-10-12T19:30:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000002', 4720, NULL, 'Oak Homes LLC', 'email',
   '2026-10-01', '00000000-0000-0000-0000-0000000000a1', '2026-10-08T15:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000002', 4720, NULL, 'Oak Homes LLC', 'hand',
   '2026-10-09', '00000000-0000-0000-0000-0000000000a1', '2026-10-09T15:00:00Z', '2026-10-09T16:00:00Z'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000003', 1250.5, NULL, '  ', 'traceable_courier',
   '2026-10-13', '00000000-0000-0000-0000-0000000000a1', '2026-10-14T02:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-000000000003', 0, NULL, '', '',
   NULL, NULL, '2026-10-14T16:00:00Z', NULL);

INSERT INTO public.job_lien_filings (id, job_id, kind, amount, sends, created_by, created_at, voided_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000003', 'notice_53_056', 1200,
   '[{"recipient": "owner", "method": "certified_mail", "tracking": "", "sent_on": "2026-10-15"},
     {"recipient": "original_contractor", "method": "certified_mail", "tracking": "", "sent_on": "2026-10-15"}]',
   '00000000-0000-0000-0000-0000000000a1', '2026-10-15T20:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000003', 'retainage_53_057', 300,
   '[{"recipient": "owner", "method": "certified_mail", "tracking": "9407", "sent_on": "2026-10-02"},
     {"recipient": "original_contractor", "method": "email", "tracking": "resend:x", "sent_on": "2026-10-01"}]',
   '00000000-0000-0000-0000-0000000000a1', '2026-10-16T15:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000003', 'affidavit', 1200, '[]',
   '00000000-0000-0000-0000-0000000000a1', '2026-10-16T16:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000003', 'notice_53_056', 1200,
   '[{"recipient": "owner", "method": "hand", "tracking": "", "sent_on": "2026-10-14"}]',
   '00000000-0000-0000-0000-0000000000a1', '2026-10-14T16:00:00Z', '2026-10-14T17:00:00Z'),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000004', 'notice_53_056', 50,
   '[{"recipient": "Acme Lenders", "method": "mail", "tracking": "", "sent_on": "2026-02-30"}, "not a send"]',
   NULL, '2026-10-17T16:00:00Z', NULL),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-000000000004', 'notice_53_056', 75, '{"owner": true}',
   NULL, '2026-10-17T17:00:00Z', NULL);

INSERT INTO public.sent_documents (id, kind, how, recipient_emails, job_ids, source_table, source_id, sent_at, sent_by) VALUES
  ('00000000-0000-0000-0000-000000000051', 'bill', 'email', '{pat@example.test}', '{00000000-0000-0000-0000-000000000001}',
   'jobs_ledger_invoices', '00000000-0000-0000-0000-0000000000b1', '2026-10-16T15:00:02Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000052', 'bill_resent', 'email', '{pat@example.test,ap@example.test}', '{00000000-0000-0000-0000-000000000001}',
   'jobs_ledger_invoices', '00000000-0000-0000-0000-0000000000b1', '2026-10-17T14:00:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000053', 'bill_resent', 'email', '{x@example.test}', '{00000000-0000-0000-0000-000000000002}',
   'jobs_ledger_invoices', '00000000-0000-0000-0000-0000000000ff', '2026-10-17T15:00:00Z', NULL),
  ('00000000-0000-0000-0000-000000000054', 'demand_letter', 'email', '{billing@oak.example.test}', '{00000000-0000-0000-0000-000000000002}',
   '', NULL, '2026-10-12T19:29:00Z', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000055', 'bill_resent', 'email', '{}', '{00000000-0000-0000-0000-000000000002}',
   '', NULL, '2026-10-17T16:00:00Z', NULL);
