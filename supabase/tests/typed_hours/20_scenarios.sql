-- Scenarios for typed_hours_second_look. Each step is its own transaction, because the ledger is
-- written at commit. t_as(person) signs a person in for the transaction; no t_as = a system write.

\set dev   '''00000000-0000-0000-0000-000000000001'''
\set tess  '''00000000-0000-0000-0000-000000000002'''
\set cora  '''00000000-0000-0000-0000-000000000003'''
\set mike  '''00000000-0000-0000-0000-000000000004'''
\set sam   '''00000000-0000-0000-0000-000000000005'''

INSERT INTO public.users (id, name, role, is_sample) VALUES
  (:dev,  'Owner Dev',   'dev',           false),
  (:tess, 'Office Tess', 'assistant',     false),
  (:cora, 'Ctrl Cora',   'controller',    false),
  (:mike, 'Field Mike',  'subcontractor', false),
  (:sam,  'Sample Sam',  'helpers',       true);

SELECT public.t_assert((SELECT value_text FROM public.app_settings WHERE key = 'typed_hours_second_look_v1') = 'test',
  'the migration seeds the switch as test');
UPDATE public.app_settings SET value_text = 'on' WHERE key = 'typed_hours_second_look_v1';

CREATE OR REPLACE FUNCTION public.t_at(p_days_ago int, p_time time) RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT ((current_date - p_days_ago) + p_time)::timestamptz
$$;
CREATE OR REPLACE FUNCTION public.t_entries(p_user uuid, p_days_ago int, p_kind text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int FROM public.clock_typed_entries WHERE user_id = p_user AND work_date = current_date - p_days_ago AND kind = p_kind
$$;

-- ── S1: a real punch, in and out, records nothing ───────────────────────────────────────────
BEGIN; SELECT public.t_as(:mike);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, work_date)
VALUES ('10000000-0000-0000-0000-000000000001', :mike, now(), current_date);
COMMIT;
BEGIN; SELECT public.t_as(:mike);
UPDATE public.clock_sessions SET clocked_out_at = now() + interval '20 seconds' WHERE id = '10000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert((SELECT COUNT(*) FROM public.clock_typed_entries) = 0, 'S1: a real punch was recorded as typed');

-- ── S2: the office types a missed day for someone; she cannot approve it, someone else can ───
BEGIN; SELECT public.t_as(:tess);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date, notes)
VALUES ('20000000-0000-0000-0000-000000000001', :mike, public.t_at(5, '10:00'), public.t_at(5, '21:00'), current_date - 5, 'App would not clock him in');
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 5, 'added') = 1, 'S2: one added entry');
SELECT public.t_assert((SELECT typed_seconds = 39600 AND day_seconds_before = 0 AND day_seconds_after = 39600 AND typed_by = :tess AND typed_by_name = 'Office Tess'
  FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 5), 'S2: 11 hours, nothing before, typed by Tess');

BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert(public.clock_session_approval_hold('20000000-0000-0000-0000-000000000001') = 'typed', 'S2: Tess is held as the typist');
SELECT public.t_assert((SELECT approved_count = 0 AND held_typed = 1 AND held_own = 0 AND error_message IS NULL
  FROM public.approve_clock_sessions_v2(ARRAY['20000000-0000-0000-0000-000000000001']::uuid[])), 'S2: her approve is skipped and says why');
COMMIT;
SELECT public.t_assert((SELECT approved_at IS NULL FROM public.clock_sessions WHERE id = '20000000-0000-0000-0000-000000000001'), 'S2: still pending');
SELECT public.t_assert(NOT EXISTS (SELECT 1 FROM public.people_hours WHERE person_name = 'Field Mike' AND work_date = current_date - 5), 'S2: nothing in the pay totals');

-- a direct write to the table is refused too
BEGIN; SELECT public.t_as(:tess);
DO $$
BEGIN
  BEGIN
    UPDATE public.clock_sessions SET approved_at = now(), approved_by = auth.uid() WHERE id = '20000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FAILED: S2: a direct approval by the typist went through';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'You typed these hours%' THEN RAISE EXCEPTION 'FAILED: S2: wrong refusal: %', SQLERRM; END IF;
  END;
END $$;
COMMIT;

BEGIN; SELECT public.t_as(:mike);
SELECT public.t_assert(public.clock_session_approval_hold('20000000-0000-0000-0000-000000000001') = 'own', 'S2: Mike is held on his own hours');
COMMIT;

BEGIN; SELECT public.t_as(:cora);
SELECT public.t_assert(public.clock_session_approval_hold('20000000-0000-0000-0000-000000000001') IS NULL, 'S2: Cora is not held');
SELECT public.t_assert((SELECT jsonb_array_length(entries) = 1 AND hold IS NULL AND (entries -> 0 ->> 'typed_by_name') = 'Office Tess' AND (entries -> 0 ->> 'self')::boolean = false
  FROM public.clock_typed_stamps(ARRAY['20000000-0000-0000-0000-000000000001']::uuid[])), 'S2: the stamp reads typed by Tess');
SELECT public.t_assert((SELECT COUNT(*) = 1 AND bool_and(state = 'pending' AND can_act) FROM public.list_typed_hours_waiting()), 'S2: it waits on Cora');
SELECT public.t_assert((SELECT approved_count = 1 AND held_typed = 0 AND held_own = 0
  FROM public.approve_clock_sessions_v2(ARRAY['20000000-0000-0000-0000-000000000001']::uuid[])), 'S2: Cora approves');
COMMIT;
SELECT public.t_assert((SELECT confirmed_by = :cora AND confirmed_by_name = 'Ctrl Cora' FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 5), 'S2: her approval is the second look');
SELECT public.t_assert((SELECT hours = 11 FROM public.people_hours WHERE person_name = 'Field Mike' AND work_date = current_date - 5), 'S2: 11 hours in the pay totals');
BEGIN; SELECT public.t_as(:cora);
SELECT public.t_assert((SELECT COUNT(*) = 0 FROM public.list_typed_hours_waiting()), 'S2: nothing waits any more');
COMMIT;

-- ── S3: nobody approves their own hours ─────────────────────────────────────────────────────
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('30000000-0000-0000-0000-000000000001', :tess, public.t_at(5, '08:00'), public.t_at(5, '16:00'), current_date - 5);
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT approved_count = 0 AND held_own = 1 AND held_typed = 0
  FROM public.approve_clock_sessions_v2(ARRAY['30000000-0000-0000-0000-000000000001']::uuid[])), 'S3: Tess cannot approve her own day');
COMMIT;
BEGIN; SELECT public.t_as(:cora);
SELECT public.t_assert((SELECT approved_count = 1 FROM public.approve_clock_sessions(ARRAY['30000000-0000-0000-0000-000000000001']::uuid[])), 'S3: Cora approves it (old RPC name)');
COMMIT;
SELECT public.t_assert((SELECT COUNT(*) = 0 FROM public.clock_typed_entries WHERE user_id = :tess), 'S3: a system-written punch is not typed');

-- ── S4: cutting a punched day into job segments (delete + insert) records nothing ───────────
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('40000000-0000-0000-0000-000000000001', :mike, public.t_at(4, '07:30'), public.t_at(4, '14:00'), current_date - 4);
BEGIN; SELECT public.t_as(:tess);
DELETE FROM public.clock_sessions WHERE id = '40000000-0000-0000-0000-000000000001';
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date) VALUES
  ('40000000-0000-0000-0000-000000000002', :mike, public.t_at(4, '07:30'), public.t_at(4, '10:00'), current_date - 4),
  ('40000000-0000-0000-0000-000000000003', :mike, public.t_at(4, '10:00'), public.t_at(4, '14:00'), current_date - 4);
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 4, 'added') = 0 AND public.t_entries(:mike, 4, 'trimmed') = 0, 'S4: a split recorded something');
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT approved_count = 2 FROM public.approve_clock_sessions_v2(ARRAY['40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003']::uuid[])), 'S4: she approves the punches she split');
COMMIT;

-- ── S5: adding time to hours that are already approved ──────────────────────────────────────
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date, approved_at)
VALUES ('50000000-0000-0000-0000-000000000001', :mike, public.t_at(3, '07:30'), public.t_at(3, '14:00'), current_date - 3, now());
BEGIN; SELECT public.t_as(:tess);
UPDATE public.clock_sessions SET clocked_out_at = public.t_at(3, '16:30') WHERE id = '50000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert((SELECT typed_seconds = 9000 AND day_seconds_before = 23400 AND day_seconds_after = 32400
  FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 3 AND kind = 'added'), 'S5: 2.5 hours added, 6.5 → 9.0');
SELECT public.t_assert((SELECT approved_at IS NOT NULL FROM public.clock_sessions WHERE id = '50000000-0000-0000-0000-000000000001'), 'S5: the session stays approved');
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT COUNT(*) = 1 AND bool_and(state = 'approved' AND NOT can_act) FROM public.list_typed_hours_waiting()), 'S5: Tess sees it but cannot act');
SELECT public.t_assert((SELECT public.confirm_clock_typed_entry(id) LIKE 'You typed these hours%' FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 3 AND kind = 'added'), 'S5: the typist cannot give the second look');
COMMIT;
BEGIN; SELECT public.t_as(:mike);
SELECT public.t_assert((SELECT public.confirm_clock_typed_entry(id) = 'Only someone who approves hours can do this.' FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 3 AND kind = 'added'), 'S5: nor can the person whose hours they are');
COMMIT;
BEGIN; SELECT public.t_as(:cora);
SELECT public.t_assert((SELECT COUNT(*) = 1 AND bool_and(state = 'approved' AND can_act) FROM public.list_typed_hours_waiting()), 'S5: Cora can');
SELECT public.t_assert((SELECT public.confirm_clock_typed_entry(id) IS NULL FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 3 AND kind = 'added'), 'S5: Looks right');
COMMIT;
SELECT public.t_assert((SELECT confirmed_by = :cora FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 3 AND kind = 'added'), 'S5: recorded');

-- ── S6: trimming a forgotten clock-out is recorded but holds nothing ────────────────────────
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('60000000-0000-0000-0000-000000000001', :mike, public.t_at(2, '07:00'), public.t_at(2, '19:00'), current_date - 2);
BEGIN; SELECT public.t_as(:tess);
UPDATE public.clock_sessions SET clocked_out_at = public.t_at(2, '15:00') WHERE id = '60000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 2, 'trimmed') = 1 AND public.t_entries(:mike, 2, 'added') = 0, 'S6: one trimmed entry');
SELECT public.t_assert((SELECT typed_seconds = 14400 FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 2), 'S6: four hours off');
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT jsonb_array_length(entries) = 1 AND (entries -> 0 ->> 'kind') = 'trimmed' FROM public.clock_typed_stamps(ARRAY['60000000-0000-0000-0000-000000000001']::uuid[])), 'S6: the stamp shows the trim');
SELECT public.t_assert((SELECT approved_count = 1 FROM public.approve_clock_sessions_v2(ARRAY['60000000-0000-0000-0000-000000000001']::uuid[])), 'S6: the person who trimmed it may approve it');
COMMIT;

-- ── S7–S10: what is never typed ─────────────────────────────────────────────────────────────
-- S7 a system write (no signed-in person)
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date)
VALUES (:mike, public.t_at(8, '07:00'), public.t_at(8, '15:00'), current_date - 8);
SELECT public.t_assert(public.t_entries(:mike, 8, 'added') = 0, 'S7: a system write was recorded');
-- S9 a salary-schedule session written as the person
BEGIN; SELECT public.t_as(:cora);
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, origin)
VALUES (:cora, public.t_at(8, '08:00'), public.t_at(8, '16:00'), current_date - 8, 'salary_schedule');
COMMIT;
SELECT public.t_assert((SELECT COUNT(*) = 0 FROM public.clock_typed_entries WHERE user_id = :cora), 'S9: salary time was recorded as typed');
-- S10 a quick add
BEGIN; SELECT public.t_as(:mike);
INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, quick_add_minutes)
VALUES (:mike, public.t_at(9, '17:00'), public.t_at(9, '17:15'), current_date - 9, 15);
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 9, 'added') = 0, 'S10: a quick add was recorded as typed');
-- S14 moving a session to another day with the same times
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('14000000-0000-0000-0000-000000000001', :mike, public.t_at(11, '22:00'), public.t_at(10, '03:00'), current_date - 10);
BEGIN; SELECT public.t_as(:tess);
UPDATE public.clock_sessions SET work_date = current_date - 11, clocked_in_at = clocked_in_at, clocked_out_at = clocked_out_at WHERE id = '14000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 10, 'added') + public.t_entries(:mike, 10, 'trimmed') + public.t_entries(:mike, 11, 'added') + public.t_entries(:mike, 11, 'trimmed') = 0, 'S14: moving a day recorded something');

-- ── S11: an open session started "three hours ago" by the office ────────────────────────────
BEGIN; SELECT public.t_as(:tess);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, work_date)
VALUES ('11000000-0000-0000-0000-000000000001', :sam, now() - interval '3 hours', current_date);
COMMIT;
SELECT public.t_assert((SELECT typed_seconds BETWEEN 10100 AND 10300 FROM public.clock_typed_entries WHERE user_id = :sam AND kind = 'added'), 'S11: about 2h50 added');
-- the person clocks out for real: nothing more
BEGIN; SELECT public.t_as(:sam);
UPDATE public.clock_sessions SET clocked_out_at = now() WHERE id = '11000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert((SELECT COUNT(*) = 1 FROM public.clock_typed_entries WHERE user_id = :sam), 'S11: the real clock-out added nothing');

-- ── S12: a worker files his own missed day; anyone else who approves is the second look ─────
BEGIN; SELECT public.t_as(:mike);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date, notes)
VALUES ('12000000-0000-0000-0000-000000000001', :mike, public.t_at(6, '10:00'), public.t_at(6, '21:00'), current_date - 6, 'It did not clock me in');
SELECT public.t_assert(public.clock_session_approval_hold('12000000-0000-0000-0000-000000000001') = 'own', 'S12: his own');
COMMIT;
SELECT public.t_assert((SELECT typed_by = :mike AND typed_seconds = 39600 FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 6), 'S12: typed by himself');
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT (entries -> 0 ->> 'self')::boolean AND hold IS NULL FROM public.clock_typed_stamps(ARRAY['12000000-0000-0000-0000-000000000001']::uuid[])), 'S12: the stamp says he typed it himself');
SELECT public.t_assert((SELECT approved_count = 1 FROM public.approve_clock_sessions_v2(ARRAY['12000000-0000-0000-0000-000000000001']::uuid[])), 'S12: Tess approves');
COMMIT;
SELECT public.t_assert((SELECT confirmed_by = :tess FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 6), 'S12: and that is the second look');

-- ── S15 / S16: an open session — a real clock-out, and a clock-out forced to the past ───────
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, work_date)
VALUES ('15000000-0000-0000-0000-000000000001', :mike, now() - interval '5 hours', current_date),
       ('16000000-0000-0000-0000-000000000001', :tess, now() - interval '5 hours', current_date);
BEGIN; SELECT public.t_as(:mike);
UPDATE public.clock_sessions SET clocked_out_at = now() WHERE id = '15000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert(public.t_entries(:mike, 0, 'added') + public.t_entries(:mike, 0, 'trimmed') = 0, 'S15: a real clock-out recorded something');
BEGIN; SELECT public.t_as(:cora);
UPDATE public.clock_sessions SET clocked_out_at = now() - interval '3 hours' WHERE id = '16000000-0000-0000-0000-000000000001';
COMMIT;
SELECT public.t_assert((SELECT typed_seconds BETWEEN 10100 AND 10300 AND typed_by = :cora FROM public.clock_typed_entries WHERE user_id = :tess AND kind = 'trimmed'), 'S16: about 2h50 trimmed by Cora');

-- ── S8: the switch ──────────────────────────────────────────────────────────────────────────
UPDATE public.app_settings SET value_text = 'off' WHERE key = 'typed_hours_second_look_v1';
BEGIN; SELECT public.t_as(:tess);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('80000000-0000-0000-0000-000000000001', :mike, public.t_at(12, '08:00'), public.t_at(12, '12:00'), current_date - 12);
COMMIT;
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert((SELECT approved_count = 1 AND held_typed = 0 FROM public.approve_clock_sessions_v2(ARRAY['80000000-0000-0000-0000-000000000001']::uuid[])), 'S8: off — the typist approves');
COMMIT;
SELECT public.t_assert((SELECT confirmed_at IS NULL FROM public.clock_typed_entries WHERE user_id = :mike AND work_date = current_date - 12), 'S8: off — but her own approval is not a second look');
BEGIN; SELECT public.t_as(:cora);
SELECT public.t_assert((SELECT COUNT(*) = 1 AND bool_and(state = 'approved' AND can_act) FROM public.list_typed_hours_waiting() WHERE work_date = current_date - 12), 'S8: off — so it still waits for one');
SELECT public.t_assert((SELECT COUNT(*) = 1 AND bool_and(state = 'pending' AND person_name = 'Sample Sam') FROM public.list_typed_hours_waiting() WHERE user_id = '00000000-0000-0000-0000-000000000005'), 'S8: and the S11 hours still wait for an approval');
COMMIT;

UPDATE public.app_settings SET value_text = 'test' WHERE key = 'typed_hours_second_look_v1';
BEGIN; SELECT public.t_as(:tess);
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date) VALUES
  ('80000000-0000-0000-0000-000000000002', :mike, public.t_at(13, '08:00'), public.t_at(13, '12:00'), current_date - 13),
  ('80000000-0000-0000-0000-000000000003', :sam,  public.t_at(13, '08:00'), public.t_at(13, '12:00'), current_date - 13);
COMMIT;
BEGIN; SELECT public.t_as(:tess);
SELECT public.t_assert(public.clock_session_approval_hold('80000000-0000-0000-0000-000000000002') IS NULL, 'S8: test — a real person is not held');
SELECT public.t_assert(public.clock_session_approval_hold('80000000-0000-0000-0000-000000000003') = 'typed', 'S8: test — a sample account is');
COMMIT;

-- ── S18: a session cannot be written already approved by a signed-in person ────────────────
UPDATE public.app_settings SET value_text = 'on' WHERE key = 'typed_hours_second_look_v1';
BEGIN; SELECT public.t_as(:tess);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.clock_sessions (user_id, clocked_in_at, clocked_out_at, work_date, approved_at, approved_by)
    VALUES ('00000000-0000-0000-0000-000000000004', public.t_at(16, '08:00'), public.t_at(16, '12:00'), current_date - 16, now(), auth.uid());
    RAISE EXCEPTION 'FAILED: S18: a session was typed in already approved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Hours typed in start unapproved%' THEN RAISE EXCEPTION 'FAILED: S18: wrong refusal: %', SQLERRM; END IF;
  END;
END $$;
COMMIT;
UPDATE public.app_settings SET value_text = 'test' WHERE key = 'typed_hours_second_look_v1';

-- ── S17: the ledger never stops a write — a failure inside it is a warning, not an error ────
-- A signed-in id with no users row: the ledger insert breaks its typed_by foreign key.
BEGIN; SELECT public.t_as('00000000-0000-0000-0000-0000000000ff');
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date)
VALUES ('17000000-0000-0000-0000-000000000001', :mike, public.t_at(15, '08:00'), public.t_at(15, '12:00'), current_date - 15);
COMMIT;
SELECT public.t_assert(EXISTS (SELECT 1 FROM public.clock_sessions WHERE id = '17000000-0000-0000-0000-000000000001'), 'S17: the session was lost with the ledger row');
SELECT public.t_assert(public.t_entries(:mike, 15, 'added') = 0, 'S17: and no ledger row was written');

DO $$ BEGIN RAISE NOTICE 'typed_hours scenarios PASSED'; END $$;
