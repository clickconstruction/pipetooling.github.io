-- The revenue riders bed's seed (v2.5129), made through the functions as main defines them, before the migration:
-- trip charges made the old way, which the backfill must mark, and bills it must leave alone.

SELECT set_config('bed.uid', '11111111-1111-1111-1111-111111111111', false);
INSERT INTO public.users (id, role) VALUES ('11111111-1111-1111-1111-111111111111', 'dev');

-- Southern Post (A): lines of $1,000 and 2 x $250, a $200 hazmat fee and a voided $75 one, a $30 returned check
-- fee on its first bill. Revenue $1,730 = 1,500 + 200 + 30.
INSERT INTO public.jobs_ledger (id, status, master_user_id, revenue) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'working', '11111111-1111-1111-1111-111111111111', 1730),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'working', '11111111-1111-1111-1111-111111111111', 0),
  ('cccccccc-0000-0000-0000-000000000001', 'working', '11111111-1111-1111-1111-111111111111', 400);
INSERT INTO public.jobs_ledger_fixtures (job_id, name, count, sequence_order, line_unit_price) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Water heater', 1, 0, 1000),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Hose bib', 2, 1, 250),
  ('cccccccc-0000-0000-0000-000000000001', 'Service call', 1, 0, 400);
INSERT INTO public.job_hazmat_incidents (job_id, fee_amount, voided_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 200, NULL),
  ('aaaaaaaa-0000-0000-0000-000000000001', 75, now());
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, fee_lines) VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 830, 'billed', 0, true,
   '[{"case_id": "case-1", "amount": 30, "description": "Returned check fee"}]');

-- A trip charge the old way on A: $99, client not home. Revenue $1,829.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001');
SELECT public.create_turnaway_trip_charge('aaaaaaaa-0000-0000-0000-000000000001', 99, 'client_not_home', 'd0000000-0000-0000-0000-0000000000a1');

-- Job B: one bill per backfill guard.
-- b-ok: made by the function, $250 site not ready. The backfill marks it.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000001');
SELECT public.create_turnaway_trip_charge('bbbbbbbb-0000-0000-0000-000000000001', 250, 'site_not_ready', 'd0000000-0000-0000-0000-0000000000b1');

-- b-edited: made by the function at $99, then its amount changed to $120. The note names $99.00, so it stays.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000b2', 'bbbbbbbb-0000-0000-0000-000000000001');
SELECT public.create_turnaway_trip_charge('bbbbbbbb-0000-0000-0000-000000000001', 99, 'client_not_home', 'd0000000-0000-0000-0000-0000000000b2');
UPDATE public.jobs_ledger_invoices SET amount = 120 WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 99;

-- b-has-fee: made by the function at $60, then a returned check fee went on it. It has a fee_lines entry, so it stays.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000b3', 'bbbbbbbb-0000-0000-0000-000000000001');
SELECT public.create_turnaway_trip_charge('bbbbbbbb-0000-0000-0000-000000000001', 60, 'client_not_home', 'd0000000-0000-0000-0000-0000000000b3');
UPDATE public.jobs_ledger_invoices SET fee_lines = '[{"case_id": "case-9", "amount": 30, "description": "Returned check fee"}]'
  WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 60;

-- b-renamed: made by the function at $80, site not ready, then the office renamed its memo. Not the function's memo, so it stays.
INSERT INTO public.dispatch_requests (id, job_ledger_id) VALUES ('d0000000-0000-0000-0000-0000000000b9', 'bbbbbbbb-0000-0000-0000-000000000001');
SELECT public.create_turnaway_trip_charge('bbbbbbbb-0000-0000-0000-000000000001', 80, 'site_not_ready', 'd0000000-0000-0000-0000-0000000000b9');
UPDATE public.jobs_ledger_invoices SET stripe_invoice_memo = 'Service visit fee'
  WHERE job_id = 'bbbbbbbb-0000-0000-0000-000000000001' AND amount = 80;

-- Typed by hand, each with a dispatch request closed today with the function's exact note, so only one guard decides:
-- b-line: a line item is on it.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, stripe_invoice_memo) VALUES
  ('bbbbbbbb-1111-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 75, 'ready_to_bill', 10, false, 'Trip charge — client not home');
INSERT INTO public.jobs_ledger_fixtures (job_id, name, count, sequence_order, line_unit_price, invoice_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Trip charge', 1, 0, 75, 'bbbbbbbb-1111-0000-0000-000000000004');
-- b-primary: the job's primary bill.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, stripe_invoice_memo) VALUES
  ('bbbbbbbb-1111-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 50, 'ready_to_bill', 11, true, 'Trip charge — client not home');
-- b-split: a part of a split bill, its memo renamed.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, stripe_invoice_memo) VALUES
  ('bbbbbbbb-1111-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000001', 45, 'ready_to_bill', 12, false, 'Trip charge — client not home (1 of 2)');
-- b-yesterday: made yesterday; the matching note was closed today.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, stripe_invoice_memo, created_at) VALUES
  ('bbbbbbbb-1111-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000001', 35, 'ready_to_bill', 13, false, 'Trip charge — site not ready', now() - interval '1 day');
-- b-no-note: no dispatch request names it.
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, stripe_invoice_memo) VALUES
  ('bbbbbbbb-1111-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000001', 400, 'ready_to_bill', 14, false, 'Trip charge — site not ready');
INSERT INTO public.dispatch_requests (job_ledger_id, status, closed_at, closed_note) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'closed', now(), 'Trip charge created — $75.00 (client not home)'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'closed', now(), 'Trip charge created — $50.00 (client not home)'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'closed', now(), 'Trip charge created — $45.00 (client not home)'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'closed', now(), 'Trip charge created — $35.00 (site not ready)');

-- Returned check fees (v2.5144, punch list #105 gap 1). Job D: a $1,000 line, two bills of $530. Bill 1 carries
-- case D's $30, which the case records; bill 2 carries case F's $30. Revenue $1,060 = 1,000 + 30 + 30.
-- Case E's fee left with a bill before the trigger: no bill names it, fee_invoice_id is null, fee_added_at is set.
-- Case F's fee_invoice_id is null too, but its entry still rides on a live bill, so the backfill leaves it.
INSERT INTO public.jobs_ledger (id, status, master_user_id, revenue) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'billed', '11111111-1111-1111-1111-111111111111', 1060);
INSERT INTO public.jobs_ledger_fixtures (job_id, name, count, sequence_order, line_unit_price) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'Repipe', 1, 0, 1000);
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, status, sequence_order, is_primary_rtb_bundle, fee_lines) VALUES
  ('dddddddd-1111-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 530, 'billed', 0, true,
   '[{"case_id": "cd000000-0000-0000-0000-00000000000d", "amount": 30, "description": "Returned check fee"}]'),
  ('dddddddd-1111-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 530, 'billed', 1, false,
   '[{"case_id": "cf000000-0000-0000-0000-00000000000f", "amount": 30, "description": "Returned check fee"}]');
INSERT INTO public.mercury_transaction_ar_returned (mercury_transaction_id, source, fee_amount, fee_invoice_id, fee_added_at, fee_added_by) VALUES
  ('cd000000-0000-0000-0000-00000000000d', 'bank', 30, 'dddddddd-1111-0000-0000-000000000001', now() - interval '1 hour', '11111111-1111-1111-1111-111111111111'),
  ('ce000000-0000-0000-0000-00000000000e', 'bank', 30, NULL, now() - interval '1 day', '11111111-1111-1111-1111-111111111111'),
  ('cf000000-0000-0000-0000-00000000000f', 'hand', 30, NULL, now() - interval '1 day', '11111111-1111-1111-1111-111111111111');
