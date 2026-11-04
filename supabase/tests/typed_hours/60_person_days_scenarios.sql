-- Scenarios for people_pay_record_days (v2.6501): a person with no login holds imported days and a standing of
-- their own. Rides in the typed_hours bed beside the imported clock sessions, so the two import doors are held to
-- the same rules. Every name here is made up.

\set pdev   '''60000000-0000-0000-0000-000000000001'''
\set pctrl  '''60000000-0000-0000-0000-000000000002'''
\set pwork  '''60000000-0000-0000-0000-000000000003'''
\set poffc  '''60000000-0000-0000-0000-000000000004'''
\set phand  '''60000000-0000-0000-0000-000000000201'''
\set plink  '''60000000-0000-0000-0000-000000000202'''
\set pjob   '''60000000-0000-0000-0000-000000000101'''
\set pbill  '''60000000-0000-0000-0000-000000000102'''

INSERT INTO public.users (id, name, role, is_sample, charge_standing) VALUES
  (:pdev,  'Days Dev',    'dev',        false, NULL),
  (:pctrl, 'Days Cora',   'controller', false, NULL),
  (:pwork, 'Days Wade',   'primary',    false, 'master'),
  (:poffc, 'Days Olive',  'assistant',  false, NULL)
ON CONFLICT (id) DO NOTHING;
-- Hank has no login; Wade's People record is linked to his login.
INSERT INTO public.people (id, name, kind, account_user_id, charge_standing) VALUES
  (:phand, 'Days Hank', 'helper', NULL, 'helper'),
  (:plink, 'Days Wade', 'primary', :pwork, 'tech')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.jobs_ledger (id, billing_only) VALUES (:pjob, false), (:pbill, true) ON CONFLICT (id) DO NOTHING;

-- P1: a controller is refused at the import door
BEGIN; SELECT public.t_as(:pctrl);
DO $$
BEGIN
  BEGIN
    PERFORM public.import_person_days('[]'::jsonb);
    RAISE EXCEPTION 'P1: a controller imported';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- P2: the dev imports two days for Hank; P3: the same rows again insert nothing
BEGIN; SELECT public.t_as(:pdev);
SELECT public.t_assert(
  (SELECT r->>'inserted' = '2' AND r->>'skipped' = '0' AND jsonb_array_length(r->'refused') = 0
     FROM public.import_person_days(jsonb_build_array(
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-07', 'hours', 8, 'note', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-08', 'hours', 6.5, 'note', 'Imported from the bank: the week paid Apr 10 2025, 6.5 h'))) AS r),
  'P2: two rows inserted, none skipped, none refused');
SELECT public.t_assert(
  (SELECT r->>'inserted' = '0' AND r->>'skipped' = '2'
     FROM public.import_person_days(jsonb_build_array(
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-07', 'hours', 8, 'note', 'Imported from the bank: the week paid Apr 10 2025, 8 h a day'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-08', 'hours', 6.5, 'note', 'Imported from the bank: the week paid Apr 10 2025, 6.5 h'))) AS r),
  'P3: a second run skips both');
COMMIT;
SELECT public.t_assert(
  (SELECT COUNT(*) = 2 AND bool_and(origin = 'imported' AND approved_at IS NULL AND note <> '' AND created_by = '60000000-0000-0000-0000-000000000001')
     FROM public.people_pay_record_days WHERE person_id = '60000000-0000-0000-0000-000000000201'),
  'P2: two imported rows, unapproved, with their notes, stamped by the dev');

-- P4: each bad row is refused with its reason and the good row still goes in
BEGIN; SELECT public.t_as(:pdev);
SELECT public.t_assert(
  (SELECT r->>'inserted' = '1' AND jsonb_array_length(r->'refused') = 7
          AND (r->'refused'->0->>'reason') LIKE 'no such person%'
          AND (r->'refused'->1->>'reason') LIKE 'no such job%'
          AND (r->'refused'->2->>'reason') LIKE 'hours must be more than zero%'
          AND (r->'refused'->3->>'reason') LIKE 'a day of more than sixteen hours%'
          AND (r->'refused'->4->>'reason') LIKE 'work_date is after today%'
          AND (r->'refused'->5->>'reason') LIKE 'the note must name%'
          AND (r->'refused'->6->>'reason') LIKE 'a field would not read%'
     FROM public.import_person_days(jsonb_build_array(
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000299', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 8, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000102',
                          'work_date', '2025-04-09', 'hours', 8, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 0, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 17, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2999-01-01', 'hours', 8, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 8, 'note', '   '),
       jsonb_build_object('person_id', 'not-a-uuid', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 8, 'note', 'x'),
       jsonb_build_object('person_id', '60000000-0000-0000-0000-000000000201', 'job_ledger_id', '60000000-0000-0000-0000-000000000101',
                          'work_date', '2025-04-09', 'hours', 8, 'note', 'Imported from the trip ledger: on site Apr 9 2025'))) AS r),
  'P4: seven refusals with their reasons, one row in');
COMMIT;
SELECT public.t_assert(
  (SELECT COUNT(*) = 3 FROM public.people_pay_record_days WHERE person_id = '60000000-0000-0000-0000-000000000201'),
  'P4: three imported rows now');

-- P5: the approval door: a worker is refused, the assistant approves two of the three, the stamp is theirs, and the pay
--     never hears of it
BEGIN; SELECT public.t_as(:pwork);
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_person_days(ARRAY[]::uuid[]);
    RAISE EXCEPTION 'P5: a worker approved';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;
BEGIN; SELECT public.t_as(:poffc);
SELECT public.t_assert(
  (SELECT r->>'approved' = '2' AND r->>'skipped' = '0'
     FROM public.approve_person_days(ARRAY(SELECT id FROM public.people_pay_record_days
       WHERE person_id = '60000000-0000-0000-0000-000000000201' AND work_date IN ('2025-04-07', '2025-04-08'))) AS r),
  'P5: the assistant approves two');
SELECT public.t_assert(
  (SELECT r->>'approved' = '0' AND r->>'skipped' = '2'
     FROM public.approve_person_days(ARRAY(SELECT id FROM public.people_pay_record_days
       WHERE person_id = '60000000-0000-0000-0000-000000000201' AND work_date IN ('2025-04-07', '2025-04-08'))) AS r),
  'P5: approving them again stamps nothing and says so');
COMMIT;
SELECT public.t_assert(
  (SELECT COUNT(*) FILTER (WHERE approved_at IS NOT NULL AND approved_by = '60000000-0000-0000-0000-000000000004') = 2
      AND COUNT(*) FILTER (WHERE approved_at IS NULL) = 1
     FROM public.people_pay_record_days WHERE person_id = '60000000-0000-0000-0000-000000000201'),
  'P5: two approved by the assistant, one still waiting');
SELECT public.t_assert(
  (SELECT COUNT(*) = 0 FROM public.people_hours WHERE person_name = 'Days Hank'),
  'P5: nothing in the pay for a pay-record day');

-- P6: charge_standings() answers Hank as a row with person_id and no id, Wade's linked record not at all, and his login
--     with its own standing; the controller reads it, a worker is refused
BEGIN; SELECT public.t_as(:pctrl);
SELECT public.t_assert(
  (SELECT COUNT(*) = 1 FROM public.charge_standings() c
     WHERE c.person_id = '60000000-0000-0000-0000-000000000201' AND c.id IS NULL AND c.name = 'Days Hank' AND c.charge_standing = 'helper'),
  'P6: the unlinked People record answers with person_id and no id');
SELECT public.t_assert(
  (SELECT COUNT(*) = 0 FROM public.charge_standings() c WHERE c.person_id = '60000000-0000-0000-0000-000000000202'),
  'P6: a linked People record is not a row of its own');
SELECT public.t_assert(
  (SELECT COUNT(*) = 1 FROM public.charge_standings() c
     WHERE c.id = '60000000-0000-0000-0000-000000000003' AND c.person_id IS NULL AND c.charge_standing = 'master'),
  'P6: the login answers with its own standing');
COMMIT;
BEGIN; SELECT public.t_as(:pwork);
DO $$
BEGIN
  BEGIN
    PERFORM COUNT(*) FROM public.charge_standings();
    RAISE EXCEPTION 'P6: a worker read the standings';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- P7: the roster row's check admits the four standings and refuses another
DO $$
BEGIN
  BEGIN
    UPDATE public.people SET charge_standing = 'foreman' WHERE id = '60000000-0000-0000-0000-000000000201';
    RAISE EXCEPTION 'P7: an unknown standing went in';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
UPDATE public.people SET charge_standing = 'none' WHERE id = '60000000-0000-0000-0000-000000000201';
SELECT public.t_assert((SELECT charge_standing = 'none' FROM public.people WHERE id = '60000000-0000-0000-0000-000000000201'), 'P7: none saved');

DO $$ BEGIN RAISE NOTICE 'people_pay_record_days scenarios PASSED'; END $$;
