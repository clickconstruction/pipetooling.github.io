-- Presses nothing takes back (punch list #443, row 13, migration *_test_note_delete_dev): a developer deletes a note
-- on a ZZ test job, and nobody deletes any other note. Fixtures made as postgres; presses run as each user through
-- RLS; everything rolls back. Raises on the first failed assertion; ends with "job_note_tags PASSED". See
-- scripts/pgtest-job-note-tags.sh. Never against prod. Every person and job is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jdd;
CREATE FUNCTION jdd.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004413' || p)::uuid $$;
CREATE FUNCTION jdd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jdd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A delete tried as the signed-in person: how many rows it reached, or the refusal's words.
CREATE FUNCTION jdd.try_delete(p_note uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.jobs_ledger_thread_notes WHERE id = p_note;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- What stands, past RLS: the notes by their last two hex digits, and the tags.
CREATE FUNCTION jdd.notes() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(id::text, 2), ' ' ORDER BY id), '-') FROM public.jobs_ledger_thread_notes WHERE job_id IN (jdd.id('b1'), jdd.id('b2'))
$$;
CREATE FUNCTION jdd.tags() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(note_id::text, 2) || '>' || coalesce(right(answer_note_id::text, 2), '-'), ' ' ORDER BY id), '-') FROM public.jobs_ledger_note_tags WHERE job_id IN (jdd.id('b1'), jdd.id('b2'))
$$;
CREATE FUNCTION jdd.kept() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(right(record_id, 2), ' ' ORDER BY record_id), '-') FROM public.deleted_records_archive WHERE table_name = 'jobs_ledger_thread_notes' AND group_key IN (jdd.id('b1')::text, jdd.id('b2')::text)
$$;
GRANT USAGE ON SCHEMA jdd TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jdd TO authenticated, service_role;

-- Who: Devon the dev, Dana the office, Hector a helper on both jobs.
INSERT INTO auth.users (id, email) VALUES (jdd.id('a1'), 'devon@notedelete.test'), (jdd.id('a2'), 'dana@notedelete.test'), (jdd.id('a4'), 'hector@notedelete.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  (jdd.id('a1'), 'devon@notedelete.test', 'Devon Dev Jdd', 'dev', false, false, false, NULL),
  (jdd.id('a2'), 'dana@notedelete.test', 'Dana Office Jdd', 'assistant', false, false, false, NULL),
  (jdd.id('a4'), 'hector@notedelete.test', 'Hector Helper Jdd', 'helpers', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.service_types (id, name) VALUES (jdd.id('f9'), 'Note delete bed work');
-- Two jobs: a ZZ test job and a real-named one.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  (jdd.id('b1'), jdd.id('a1'), jdd.id('f9'), 'ZZ Test note delete job', 'J4413'),
  (jdd.id('b2'), jdd.id('a1'), jdd.id('f9'), 'Harbor Row loft rough-in', 'J4414');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (jdd.id('b1'), jdd.id('a4')), (jdd.id('b2'), jdd.id('a4')) ON CONFLICT DO NOTHING;
-- Notes. c1 a plain note on the test job; c2 a tagged question on the test job, answered by c3; c4 a note on the real job.
INSERT INTO public.jobs_ledger_thread_notes (id, job_id, author_user_id, body, created_at) VALUES
  (jdd.id('c1'), jdd.id('b1'), jdd.id('a2'), 'ZZ walk note one', now() - interval '3 hours'),
  (jdd.id('c2'), jdd.id('b1'), jdd.id('a2'), 'Hector, which bay first? @Hector Helper Jdd', now() - interval '2 hours'),
  (jdd.id('c3'), jdd.id('b1'), jdd.id('a4'), 'Bay two.', now() - interval '1 hour'),
  (jdd.id('c4'), jdd.id('b2'), jdd.id('a2'), 'A note on a real job', now() - interval '1 hour');
INSERT INTO public.jobs_ledger_note_tags (id, note_id, job_id, tagged_user_id, tagged_name, tagger_user_id, created_at, cleared_at, cleared_how, answer_note_id) VALUES
  (jdd.id('d1'), jdd.id('c2'), jdd.id('b1'), jdd.id('a4'), 'Hector Helper Jdd', jdd.id('a2'), now() - interval '2 hours', now() - interval '1 hour', 'answered', jdd.id('c3'));
SELECT jdd.same('four notes and one answered tag stand', jdd.notes() || ' · ' || jdd.tags(), 'c1 c2 c3 c4 · c2>c3');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The office cannot delete a note, test job or not.
SELECT jdd.as_user(jdd.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jdd.same('an assistant''s delete reaches no row', jdd.try_delete(jdd.id('c1')), '0 row');
SELECT jdd.same('nothing changed', jdd.notes(), 'c1 c2 c3 c4');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. The dev: a real job's note stays, an answer another tag names stays, a test job's note goes with its tag, and
--    Deleted records keeps the note.
SELECT jdd.as_user(jdd.id('a1'));
SET LOCAL ROLE authenticated;
SELECT jdd.same('a note on a real job reaches no row', jdd.try_delete(jdd.id('c4')), '0 row');
SELECT jdd.same('a note a tag names as its answer reaches no row', jdd.try_delete(jdd.id('c3')), '0 row');
SELECT jdd.same('a plain note on the test job goes', jdd.try_delete(jdd.id('c1')), '1 row');
SELECT jdd.same('the tagged question goes, and its tag with it', jdd.try_delete(jdd.id('c2')), '1 row');
SELECT jdd.same('what stands', jdd.notes() || ' · ' || jdd.tags(), 'c3 c4 · -');
SELECT jdd.same('Deleted records keeps both notes', jdd.kept(), 'c1 c2');
SELECT jdd.same('a second delete of the same note reaches no row', jdd.try_delete(jdd.id('c1')), '0 row');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Signed out, nothing.
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT jdd.same('anon is refused', (jdd.try_delete(jdd.id('c3')) LIKE '%permission denied%')::text, 'true');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'job_note_tags PASSED'; END $$;
SELECT 'job_note_tags PASSED';
ROLLBACK;
