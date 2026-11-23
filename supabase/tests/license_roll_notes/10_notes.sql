-- The State roll's notes and Leave off (punch list #411, step three), through RLS, inside one transaction that rolls
-- back. Raises on the first failed assertion; ends with "license_roll_notes notes PASSED".
-- See scripts/pgtest-license-roll-notes.sh. Never against prod. Every name and number is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000004a1', 'holder@bed.test'),
  ('00000000-0000-0000-0000-0000000004a2', 'other@bed.test'),
  ('00000000-0000-0000-0000-0000000004a3', 'noswitch@bed.test'),
  ('00000000-0000-0000-0000-0000000004a4', 'trainee@bed.test'),
  ('00000000-0000-0000-0000-0000000004a5', 'sub@bed.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000004a1', 'holder@bed.test', 'Bed Holder', 'assistant'),
  ('00000000-0000-0000-0000-0000000004a2', 'other@bed.test', 'Bed Other', 'master_technician'),
  ('00000000-0000-0000-0000-0000000004a3', 'noswitch@bed.test', 'Bed No Switch', 'assistant'),
  ('00000000-0000-0000-0000-0000000004a4', 'trainee@bed.test', 'Bed Trainee', 'assistant'),
  ('00000000-0000-0000-0000-0000000004a5', 'sub@bed.test', 'Bed Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET team_prospects_access = true
  WHERE id IN ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004a2', '00000000-0000-0000-0000-0000000004a4', '00000000-0000-0000-0000-0000000004a5');
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000004a4';

-- Three made-up licenses: one person at two ranks (same name and ZIP), and one of our own.
INSERT INTO public.license_roll (id, source, trade, license_class, license_number, status, licensed_on, expires_on, last_name, first_name, name_key, zip, county, ours, first_seen_on, last_seen_on) VALUES
  ('00000000-0000-0000-0000-00000004e001', 'tsbpe', 'plumbing', 'journeyman', 'J-90001', 'current', '2014-04-09', '2027-03-31', 'Sample', 'Pat', 'sample|pat||78000', '78000', 'BEXAR', false, '2026-11-21', '2026-11-23'),
  ('00000000-0000-0000-0000-00000004e002', 'tsbpe', 'plumbing', 'master', 'M-90002', 'current', '2026-11-05', '2027-11-05', 'Sample', 'Pat', 'sample|pat||78000', '78000', 'BEXAR', false, '2026-11-21', '2026-11-23'),
  ('00000000-0000-0000-0000-00000004e003', 'tsbpe', 'plumbing', 'journeyman', 'J-90003', 'current', '2019-01-01', '2027-01-31', 'Madeup', 'Lee', 'madeup|lee||78001', '78001', 'HAYS', true, '2026-11-21', '2026-11-23');
INSERT INTO public.license_roll_changes (roll_id, seen_on, kind) VALUES
  ('00000000-0000-0000-0000-00000004e001', '2026-11-21', 'first_seen');

CREATE SCHEMA bedt;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.as_user(p_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_id), true);
  PERFORM set_config('request.jwt.claim.sub', p_id, true);
END $$;
GRANT USAGE ON SCHEMA bedt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedt TO authenticated, anon;

-- 1 · a holder of the Hiring switch writes a note; who and when are the server's, whatever the client sent.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.license_roll_notes (source, license_class, license_number, name_key, body, noted_by, noted_by_name, noted_at)
VALUES ('tsbpe', 'journeyman', 'J-90001', 'sample|pat||78000', '  Met at the supply house.  ', '00000000-0000-0000-0000-0000000004a2', 'Someone Else', '2001-01-01');
SELECT bedt.ok('the holder reads the note', (SELECT count(*) = 1 FROM public.license_roll_notes));
SELECT bedt.ok('noted_by is the caller', (SELECT noted_by = '00000000-0000-0000-0000-0000000004a1' FROM public.license_roll_notes));
SELECT bedt.ok('noted_by_name is the caller''s name', (SELECT noted_by_name = 'Bed Holder' FROM public.license_roll_notes));
SELECT bedt.ok('noted_at is now', (SELECT noted_at > now() - interval '1 hour' FROM public.license_roll_notes));
SELECT bedt.ok('the body is trimmed', (SELECT body = 'Met at the supply house.' FROM public.license_roll_notes));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.license_roll_notes (source, license_class, license_number, body) VALUES ('tsbpe', 'journeyman', 'J-90001', '   ');
    RAISE EXCEPTION 'FAILED: an empty note was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: an empty note is refused';
  END;
END $$;
DO $$
BEGIN
  BEGIN
    UPDATE public.license_roll_notes SET body = 'changed';
    IF EXISTS (SELECT 1 FROM public.license_roll_notes WHERE body = 'changed') THEN RAISE EXCEPTION 'FAILED: a note was edited'; END IF;
    RAISE NOTICE 'ok: a note cannot be edited';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a note cannot be edited';
  END;
END $$;
RESET ROLE;

-- 2 · another holder reads it but cannot delete it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a2');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('another holder reads the note', (SELECT count(*) = 1 FROM public.license_roll_notes));
DELETE FROM public.license_roll_notes;
SELECT bedt.ok('another holder''s delete takes nothing', (SELECT count(*) = 1 FROM public.license_roll_notes));
INSERT INTO public.license_roll_notes (source, license_class, license_number, name_key, body)
VALUES ('tsbpe', 'master', 'M-90002', 'sample|pat||78000', 'Made master this month.');
RESET ROLE;

-- 3 · a person without the switch, and a subcontractor, read nothing and write nothing.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a3');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('no switch reads no note', (SELECT count(*) = 0 FROM public.license_roll_notes));
SELECT bedt.ok('no switch reads no roll row', (SELECT count(*) = 0 FROM public.license_roll));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.license_roll_notes (source, license_class, license_number, body) VALUES ('tsbpe', 'journeyman', 'J-90001', 'x');
    RAISE EXCEPTION 'FAILED: a person without the switch wrote a note';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a person without the switch cannot write a note';
  END;
END $$;
DO $$
BEGIN
  BEGIN
    PERFORM public.license_roll_leave_off('00000000-0000-0000-0000-00000004e001', '');
    RAISE EXCEPTION 'FAILED: a person without the switch left someone off';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a person without the switch cannot leave someone off';
  END;
END $$;
RESET ROLE;
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a5');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('a subcontractor reads no note', (SELECT count(*) = 0 FROM public.license_roll_notes));
RESET ROLE;

-- 4 · a training account with the switch reads, but writes nothing and leaves nobody off.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a4');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('the trainee reads the notes', (SELECT count(*) = 2 FROM public.license_roll_notes));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.license_roll_notes (source, license_class, license_number, body) VALUES ('tsbpe', 'journeyman', 'J-90001', 'x');
    RAISE EXCEPTION 'FAILED: a training account wrote a note';
  EXCEPTION
    -- The training fence's statement trigger refuses before row security does, with its own words.
    WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a training account cannot write a note';
    WHEN raise_exception THEN
      IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
      RAISE NOTICE 'ok: a training account cannot write a note';
  END;
END $$;
DO $$
BEGIN
  BEGIN
    PERFORM public.license_roll_leave_off('00000000-0000-0000-0000-00000004e001', '');
    RAISE EXCEPTION 'FAILED: a training account left someone off';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a training account cannot leave someone off';
  END;
END $$;
RESET ROLE;

-- 5 · the author deletes their own note.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a2');
SET LOCAL ROLE authenticated;
DELETE FROM public.license_roll_notes WHERE license_number = 'M-90002';
SELECT bedt.ok('the author deletes their own note', (SELECT count(*) = 1 FROM public.license_roll_notes));
RESET ROLE;

-- 6 · Leave off refuses one of our own.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a1');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.license_roll_leave_off('00000000-0000-0000-0000-00000004e003', '');
    RAISE EXCEPTION 'FAILED: one of our own was left off';
  EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: one of our own stays on the roll';
  END;
END $$;

-- 7 · Leave off takes the person off by number and by name and ZIP, and their history goes. Our notes stay.
SELECT bedt.ok('the press answers what it took off',
  (SELECT (r ->> 'taken_off')::int = 2 AND r ->> 'shown_as' = 'Pat Sample, journeyman J-90001'
   FROM (SELECT public.license_roll_leave_off('00000000-0000-0000-0000-00000004e001', 'Asked by phone.') AS r) x));
SELECT bedt.ok('both of the person''s rows are off the roll',
  (SELECT count(*) = 0 FROM public.license_roll WHERE name_key = 'sample|pat||78000'));
SELECT bedt.ok('our own row stays', (SELECT count(*) = 1 FROM public.license_roll WHERE license_number = 'J-90003'));
SELECT bedt.ok('the left-off row holds the number, the name key and who', (SELECT count(*) = 1 FROM public.license_roll_left_off
  WHERE license_number = 'J-90001' AND name_key = 'sample|pat||78000' AND note = 'Asked by phone.' AND noted_by_name = 'Bed Holder'
    AND shown_as = 'Pat Sample, journeyman J-90001'));
SELECT bedt.ok('our note on them stays', (SELECT count(*) = 1 FROM public.license_roll_notes WHERE license_number = 'J-90001'));
RESET ROLE;
SELECT bedt.ok('their line of history went with the rows',
  (SELECT count(*) = 0 FROM public.license_roll_changes WHERE roll_id = '00000000-0000-0000-0000-00000004e001'));

-- 8 · Put back: a person without the switch cannot; a holder can.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a3');
SET LOCAL ROLE authenticated;
DELETE FROM public.license_roll_left_off;
RESET ROLE;
SELECT bedt.ok('a person without the switch put nobody back', (SELECT count(*) = 1 FROM public.license_roll_left_off));
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a4');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    DELETE FROM public.license_roll_left_off;
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT bedt.ok('a training account put nobody back', (SELECT count(*) = 1 FROM public.license_roll_left_off));
SELECT bedt.as_user('00000000-0000-0000-0000-0000000004a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.license_roll_left_off WHERE license_number = 'J-90001';
SELECT bedt.ok('a holder puts the person back on the list', (SELECT count(*) = 0 FROM public.license_roll_left_off));
RESET ROLE;

-- 9 · nobody signed out runs the press.
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.license_roll_leave_off('00000000-0000-0000-0000-00000004e003', '');
    RAISE EXCEPTION 'FAILED: anon ran Leave off';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anon cannot run Leave off';
  END;
END $$;
RESET ROLE;

SELECT 'license_roll_notes notes PASSED';
ROLLBACK;
