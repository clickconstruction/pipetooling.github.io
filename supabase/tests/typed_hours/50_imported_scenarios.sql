-- Scenarios for imported_clock_sessions (v2.6425): the dev-only import door, one row a person, a day and a job.
-- Rides in the typed_hours bed so the typed-hours triggers and the approval door are the real ones.

\set idev  '''50000000-0000-0000-0000-000000000001'''
\set ictrl '''50000000-0000-0000-0000-000000000002'''
\set iwork '''50000000-0000-0000-0000-000000000003'''
\set isamp '''50000000-0000-0000-0000-000000000004'''
\set ijob  '''50000000-0000-0000-0000-000000000101'''
\set ibill '''50000000-0000-0000-0000-000000000102'''

INSERT INTO public.users (id, name, role, is_sample) VALUES
  (:idev,  'Import Dev',   'dev',        false),
  (:ictrl, 'Import Cora',  'controller', false),
  (:iwork, 'Import Wade',  'primary',    false),
  (:isamp, 'Import Sam',   'helpers',    true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.jobs_ledger (id, billing_only) VALUES (:ijob, false), (:ibill, true) ON CONFLICT (id) DO NOTHING;

-- I1: the check admits the third origin and still refuses an unknown one
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, origin)
    VALUES ('50000000-0000-0000-0000-000000000003', '2025-04-07 13:00+00', '2025-04-07 21:00+00', '2025-04-07', 'typed');
    RAISE EXCEPTION 'I1: an unknown origin went in';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- I2: a controller is refused at the door
BEGIN; SELECT public.t_as(:ictrl);
DO $$
BEGIN
  BEGIN
    PERFORM public.import_clock_sessions('[]'::jsonb);
    RAISE EXCEPTION 'I2: a controller imported';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- I3: the dev imports two days; I4: the same rows again insert nothing
BEGIN; SELECT public.t_as(:idev);
SELECT public.t_assert(
  (SELECT r->>'inserted' = '2' AND r->>'skipped' = '0' AND jsonb_array_length(r->'refused') = 0
     FROM public.import_clock_sessions(jsonb_build_array(
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-07', 'clocked_in_at', '2025-04-07T13:00:00Z', 'clocked_out_at', '2025-04-07T21:00:00Z',
                          'notes', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-08', 'clocked_in_at', '2025-04-08T13:00:00Z', 'clocked_out_at', '2025-04-08T21:00:00Z',
                          'notes', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'))) AS r),
  'I3: two rows inserted, none skipped, none refused');
SELECT public.t_assert(
  (SELECT r->>'inserted' = '0' AND r->>'skipped' = '2'
     FROM public.import_clock_sessions(jsonb_build_array(
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-07', 'clocked_in_at', '2025-04-07T13:00:00Z', 'clocked_out_at', '2025-04-07T21:00:00Z',
                          'notes', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-08', 'clocked_in_at', '2025-04-08T13:00:00Z', 'clocked_out_at', '2025-04-08T21:00:00Z',
                          'notes', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'))) AS r),
  'I4: a second run skips both');
COMMIT;
SELECT public.t_assert(
  (SELECT COUNT(*) = 2 AND bool_and(origin = 'imported' AND approved_at IS NULL AND notes <> '')
     FROM public.clock_sessions WHERE user_id = '50000000-0000-0000-0000-000000000003'),
  'I3: two imported rows, unapproved, with their notes');

-- I5: each bad row is refused with its reason and the good row still goes in
BEGIN; SELECT public.t_as(:idev);
SELECT public.t_assert(
  (SELECT r->>'inserted' = '1' AND jsonb_array_length(r->'refused') = 6
          AND (r->'refused'->0->>'reason') LIKE 'no such person%'
          AND (r->'refused'->1->>'reason') LIKE 'no such job%'
          AND (r->'refused'->2->>'reason') LIKE 'clocked_out_at must be after%'
          AND (r->'refused'->3->>'reason') LIKE 'work_date must be the calendar day%'
          AND (r->'refused'->4->>'reason') LIKE 'the note must name%'
          AND (r->'refused'->5->>'reason') LIKE 'a field would not read%'
     FROM public.import_clock_sessions(jsonb_build_array(
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000004', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z', 'notes', 'x'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000102',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z', 'notes', 'x'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T21:00:00Z', 'clocked_out_at', '2025-04-09T13:00:00Z', 'notes', 'x'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-10', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z', 'notes', 'x'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z', 'notes', '   '),
       jsonb_build_object('user_id', 'not-a-uuid', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z', 'notes', 'x'),
       jsonb_build_object('user_id', '50000000-0000-0000-0000-000000000003', 'job_ledger_id', '50000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'clocked_in_at', '2025-04-09T13:00:00Z', 'clocked_out_at', '2025-04-09T21:00:00Z',
                          'notes', 'Imported from the trip ledger: on site Apr 9 2025'))) AS r),
  'I5: six refusals with their reasons, one row in');
COMMIT;
SELECT public.t_assert(
  (SELECT COUNT(*) = 3 FROM public.clock_sessions WHERE user_id = '50000000-0000-0000-0000-000000000003' AND origin = 'imported'),
  'I5: three imported rows now');

-- I6: an imported row records no typed entry, so the dev who imported it may approve it, and the day lands in the pay
SELECT public.t_assert(
  (SELECT COUNT(*) = 0 FROM public.clock_typed_entries WHERE user_id = '50000000-0000-0000-0000-000000000003'),
  'I6: nothing typed for an imported row');
BEGIN; SELECT public.t_as(:idev);
SELECT public.t_assert(
  (SELECT approved_count = 1 AND held_typed = 0 AND held_own = 0
     FROM public.approve_clock_sessions_v2(ARRAY[(SELECT id FROM public.clock_sessions
       WHERE user_id = '50000000-0000-0000-0000-000000000003' AND work_date = '2025-04-07')])),
  'I6: the importing dev approves the row');
COMMIT;
SELECT public.t_assert(
  (SELECT approved_at IS NOT NULL FROM public.clock_sessions
     WHERE user_id = '50000000-0000-0000-0000-000000000003' AND work_date = '2025-04-07'),
  'I6: approved');
SELECT public.t_assert(
  (SELECT COALESCE(SUM(hours), 0) = 8 FROM public.people_hours WHERE person_name = 'Import Wade' AND work_date = '2025-04-07'),
  'I6: eight hours in the pay for the day');

DO $$ BEGIN RAISE NOTICE 'imported_clock_sessions scenarios PASSED'; END $$;
