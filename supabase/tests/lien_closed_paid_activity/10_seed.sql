-- What prod holds before the migration (v2.7359): one notice the run closed as paid before the trigger existed,
-- and the rows that must never write a line. Made-up figures.
\set ON_ERROR_STOP on

INSERT INTO public.users (id, name) VALUES ('00000000-0000-0000-0000-0000000000a1', 'ZZ Office');
INSERT INTO public.jobs_ledger (id, job_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ZZ Test Job One'),
  ('00000000-0000-0000-0000-000000000002', 'ZZ Test Job Two'),
  ('00000000-0000-0000-0000-000000000003', 'ZZ Test Job Three');

INSERT INTO public.job_lien_desk_items (id, job_id, kind, months, status, fields, printed_at, voided_at) VALUES
  -- Closed as paid before the migration: the backfill writes its line.
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'notice_53_056', '{2026-09,2026-08}', 'approved',
   '{"notice": {"claimAmount": "2400.00"}, "runClosedPaid": {"at": "2026-11-15T18:00:00Z", "by": "00000000-0000-0000-0000-0000000000a1", "byName": "ZZ Office", "printedAt": "2026-10-08T15:00:00Z", "paperClaim": 2400}}',
   '2026-10-08T15:00:00Z', '2026-11-15T18:00:00Z'),
  -- Live, printed: the scenario closes it.
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000002', 'notice_53_056', '{2026-09}', 'approved',
   '{"notice": {"claimAmount": "6150.75"}}', '2026-10-09T15:00:00Z', NULL),
  -- Set aside by a job combine: voided, no close on it.
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000003', 'notice_53_056', '{2026-09}', 'drafted',
   '{"notice": {"claimAmount": "900.00"}}', NULL, '2026-11-03T12:00:00Z'),
  -- An affidavit that somehow carries the record: not a monthly notice, no line.
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000003', 'affidavit', '{2026-09}', 'drafted',
   '{"runClosedPaid": {"at": "2026-11-15T18:00:00Z", "byName": "ZZ Office"}}', NULL, '2026-11-15T18:00:00Z'),
  -- Live, never printed, no months: the scenario closes it with a thin record.
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000003', 'notice_53_056', '{}', 'held',
   '{}', NULL, NULL);
