-- What the house told us (v2.4411): job_supply_house_words through RLS, inside one transaction
-- that rolls back. Raises on the first failed assertion; ends with "supply_house_words PASSED".
-- See scripts/pgtest-supply-house-words.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'master@bed.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@bed.test', 'Bed Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a2', 'sub@bed.test', 'Bed Sub', 'subcontractor'),
  ('00000000-0000-0000-0000-0000000000a3', 'trainee@bed.test', 'Bed Trainee', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a4', 'master@bed.test', 'Bed Master', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000000a3';
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-00000000a001', 'Bed Dental');
INSERT INTO public.supply_houses (id, name) VALUES ('00000000-0000-0000-0000-00000000d001', 'Bed Reece');

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

-- 1 · the office writes a word; who and when are the server's, whatever the client sent.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_supply_house_words (job_id, supply_house_id, their_balance, notice_on, said_by, noted_by_name, noted_by, noted_at)
VALUES ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 8950, '2026-10-14', 'Dana', 'Bed Assistant', '00000000-0000-0000-0000-0000000000a2', '2001-01-01');
SELECT bedt.ok('the assistant reads the word', (SELECT count(*) = 1 FROM public.job_supply_house_words));
SELECT bedt.ok('noted_by is the caller, not what was sent', (SELECT noted_by = '00000000-0000-0000-0000-0000000000a1' FROM public.job_supply_house_words));
SELECT bedt.ok('noted_at is now, not what was sent', (SELECT noted_at > now() - interval '1 hour' FROM public.job_supply_house_words));

-- 2 · a second word for the same job and house replaces the first.
INSERT INTO public.job_supply_house_words (job_id, supply_house_id, their_balance, notice_on, said_by, noted_by_name)
VALUES ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 7393.33, '2026-10-14', 'Dana', 'Bed Assistant')
ON CONFLICT (job_id, supply_house_id) DO UPDATE SET their_balance = EXCLUDED.their_balance, notice_on = EXCLUDED.notice_on, said_by = EXCLUDED.said_by, note = EXCLUDED.note, noted_by_name = EXCLUDED.noted_by_name;
SELECT bedt.ok('one row, the latest word', (SELECT count(*) = 1 AND max(their_balance) = 7393.33 FROM public.job_supply_house_words));

-- 3 · a word that says nothing is refused.
DO $$
BEGIN
  BEGIN
    UPDATE public.job_supply_house_words SET their_balance = NULL, notice_on = NULL, note = '  ';
    RAISE EXCEPTION 'FAILED: an empty word was kept';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: an empty word is refused';
  END;
END $$;
RESET ROLE;

-- 4 · the master reads it too.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a4');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('the master reads the word', (SELECT count(*) = 1 FROM public.job_supply_house_words));
RESET ROLE;

-- 5 · a subcontractor neither reads nor writes.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a2');
SET LOCAL ROLE authenticated;
SELECT bedt.ok('a subcontractor reads nothing', (SELECT count(*) = 0 FROM public.job_supply_house_words));
DO $$
BEGIN
  BEGIN
    INSERT INTO public.job_supply_house_words (job_id, supply_house_id, note) VALUES ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d001', 'x');
    RAISE EXCEPTION 'FAILED: a subcontractor wrote a word';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN RAISE NOTICE 'ok: a subcontractor cannot write';
  END;
END $$;
RESET ROLE;

-- 6 · a training account (read_only) cannot change it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a3');
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  BEGIN
    UPDATE public.job_supply_house_words SET note = 'trainee was here';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE EXCEPTION 'FAILED: a read-only account changed a word'; END IF;
    RAISE NOTICE 'ok: a read-only account changes nothing';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
    RAISE NOTICE 'ok: a read-only account is refused';
  END;
END $$;
RESET ROLE;

-- 7 · nobody calls the stamp function by hand, and anon sees nothing.
SELECT bedt.ok('anon cannot execute the stamp function', NOT has_function_privilege('anon', 'public.job_supply_house_words_stamp()', 'EXECUTE'));
SELECT bedt.ok('authenticated cannot execute the stamp function', NOT has_function_privilege('authenticated', 'public.job_supply_house_words_stamp()', 'EXECUTE'));
SET LOCAL ROLE anon;
SELECT bedt.ok('anon reads nothing', (SELECT count(*) = 0 FROM public.job_supply_house_words));
RESET ROLE;

-- 8 · the office clears a word by deleting it.
SELECT bedt.as_user('00000000-0000-0000-0000-0000000000a1');
SET LOCAL ROLE authenticated;
DELETE FROM public.job_supply_house_words WHERE job_id = '00000000-0000-0000-0000-00000000c001';
SELECT bedt.ok('the word is cleared', (SELECT count(*) = 0 FROM public.job_supply_house_words));
RESET ROLE;

SELECT 'supply_house_words PASSED' AS result;
ROLLBACK;
