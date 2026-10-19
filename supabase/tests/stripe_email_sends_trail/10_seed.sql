-- Before the migration: what prod holds today. Job 1's bill was sent on Aug 26 (the invoice trigger's one
-- invoice_sent line, and the function's log row with the same sent_at) and resent on Aug 27 (a log row, no line).
-- Job 2's bill was sent once. Job 3's bill is not sent yet. A fourth log row names a bill that does not exist.
\set ON_ERROR_STOP on
INSERT INTO public.users (id, name) VALUES ('00000000-0000-0000-0000-0000000000a1', 'Taunya');
INSERT INTO public.jobs_ledger (id, job_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Palmer 251'),
  ('00000000-0000-0000-0000-000000000002', 'Dudley 410'),
  ('00000000-0000-0000-0000-000000000003', 'Whitfield 2148');
INSERT INTO public.jobs_ledger_invoices (id, job_id, status, amount, stripe_invoice_id, external_send_channel, sent_to_customer_at) VALUES
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'billed', 4720, 'in_1', 'stripe', '2026-08-27T20:40:00Z'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000002', 'billed', 1200, 'in_2', 'stripe', '2026-09-01T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000003', 'billed', 900, 'in_3', NULL, NULL);
-- The invoice trigger's first-send lines, as prod has them.
INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial) VALUES
  ('00000000-0000-0000-0000-000000000001', 'invoice_sent', '2026-08-26T19:09:53Z', NULL, 'Invoice sent to customer (stripe)',
   jsonb_build_object('invoice_id', '00000000-0000-0000-0000-0000000000b1', 'source_id', '00000000-0000-0000-0000-0000000000b1', 'channel', 'stripe'), true),
  ('00000000-0000-0000-0000-000000000002', 'invoice_sent', '2026-09-01T15:00:00Z', NULL, 'Invoice sent to customer (stripe)',
   jsonb_build_object('invoice_id', '00000000-0000-0000-0000-0000000000b2', 'source_id', '00000000-0000-0000-0000-0000000000b2', 'channel', 'stripe'), true);
-- The function's log, every send: job 1's first send and its resend, job 2's one send, and an orphan.
INSERT INTO public.jobs_ledger_invoice_stripe_email_sends (id, jobs_ledger_invoice_id, sent_at, stripe_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '2026-08-26T19:09:53Z', 'in_1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', '2026-08-27T20:40:00Z', 'in_1'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', '2026-09-01T15:00:10Z', 'in_2'),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000ff', '2026-09-02T15:00:00Z', 'in_x');
