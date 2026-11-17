-- The office marks a sub's note answered (migration *_sub_paper_ack_answered, punch list #371): only the office roles
-- who see sub pay, never a training account; a note is answered once and the first answer stands; only a note that
-- something is wrong can be answered; the note's own words never change. Fixtures are written as postgres;
-- everything rolls back. Raises on the first failed assertion; ends with "sub_paper_ack_answered PASSED". See
-- scripts/pgtest-sub-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Priya estimates and is not office staff. Tara is an assistant in training. Every name is made up.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000371b0a1', 'devon@subanswered.test'),
  ('00000000-0000-0000-0000-00000371b0a2', 'priya@subanswered.test'),
  ('00000000-0000-0000-0000-00000371b0a3', 'tara@subanswered.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000371b0a1', 'devon@subanswered.test', 'Devon Dev', 'dev', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000371b0a2', 'priya@subanswered.test', 'Priya Estimator', 'estimator', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000371b0a3', 'tara@subanswered.test', 'Tara Trainee', 'assistant', true, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000371b0e1', '00000000-0000-0000-0000-00000371b0a1', 'sub', 'Pat Sub Answerbed');
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number) VALUES
  ('00000000-0000-0000-0000-00000371b0b1', '00000000-0000-0000-0000-00000371b0a1', 'Pat Sub Answerbed', '2041');
-- What the sub said from their page: one note, and one payment marked received.
INSERT INTO public.sub_paper_acks (id, kind, person_id, labor_job_id, amount, note) VALUES
  ('00000000-0000-0000-0000-00000371b0f1', 'something_wrong', '00000000-0000-0000-0000-00000371b0e1', '00000000-0000-0000-0000-00000371b0b1', 60, 'The back-charge was never talked about with me.'),
  ('00000000-0000-0000-0000-00000371b0f2', 'received', '00000000-0000-0000-0000-00000371b0e1', NULL, 100, NULL);

CREATE SCHEMA sqa;
CREATE FUNCTION sqa.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sqa.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION sqa.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
GRANT USAGE ON SCHEMA sqa TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sqa TO authenticated, anon, service_role;

-- 0 · Who may call it.
SELECT sqa.same('a signed-in login may answer', has_function_privilege('authenticated', 'public.answer_sub_paper_ack(uuid)', 'EXECUTE')::text, 'true');
SELECT sqa.same('nobody signed out may answer', has_function_privilege('anon', 'public.answer_sub_paper_ack(uuid)', 'EXECUTE')::text, 'false');

-- 1 · Who may not: an estimator, and an assistant in training. The note still waits.
SELECT sqa.as_user('00000000-0000-0000-0000-00000371b0a2');
SET LOCAL ROLE authenticated;
SELECT sqa.refused('Priya answering', $q$SELECT public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0f1')$q$, 'Only the office roles');
RESET ROLE;
SELECT sqa.as_user('00000000-0000-0000-0000-00000371b0a3');
SET LOCAL ROLE authenticated;
SELECT sqa.refused('Tara answering in training', $q$SELECT public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0f1')$q$, 'A training account cannot');
RESET ROLE;
SELECT sqa.same('the note still waits', (SELECT (answered_at IS NULL)::text FROM public.sub_paper_acks WHERE id = '00000000-0000-0000-0000-00000371b0f1'), 'true');

-- 2 · Devon answers it. Only a note that something is wrong can be answered, and a note that is gone says so.
SELECT sqa.as_user('00000000-0000-0000-0000-00000371b0a1');
SET LOCAL ROLE authenticated;
SELECT sqa.refused('answering a payment marked received', $q$SELECT public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0f2')$q$, 'Only a note that something is wrong');
SELECT sqa.refused('answering a note that is gone', $q$SELECT public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0ff')$q$, 'That note is gone');
SELECT sqa.same('Devon''s answer hands back when', (public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0f1') IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT sqa.same('the note is answered, by whom, and its words are as the sub wrote them',
  (SELECT concat_ws('|', (answered_at IS NOT NULL)::text, answered_by, answered_by_name, note) FROM public.sub_paper_acks WHERE id = '00000000-0000-0000-0000-00000371b0f1'),
  'true|00000000-0000-0000-0000-00000371b0a1|Devon Dev|The back-charge was never talked about with me.');

-- 3 · Answered once: a second press hands back the first time and keeps the first name.
UPDATE public.sub_paper_acks SET answered_at = '2026-11-01T12:00:00Z', answered_by_name = 'The first answer' WHERE id = '00000000-0000-0000-0000-00000371b0f1';
SELECT sqa.as_user('00000000-0000-0000-0000-00000371b0a1');
SET LOCAL ROLE authenticated;
SELECT sqa.same('a second answer hands back the first time', (public.answer_sub_paper_ack('00000000-0000-0000-0000-00000371b0f1') = '2026-11-01T12:00:00Z'::timestamptz)::text, 'true');
RESET ROLE;
SELECT sqa.same('and keeps the first name', (SELECT answered_by_name FROM public.sub_paper_acks WHERE id = '00000000-0000-0000-0000-00000371b0f1'), 'The first answer');

-- 4 · The table is still read only by grant: the function is the one way a signed-in person writes it.
SELECT sqa.as_user('00000000-0000-0000-0000-00000371b0a1');
SET LOCAL ROLE authenticated;
SELECT sqa.refused('Devon stamping it by hand', $q$UPDATE public.sub_paper_acks SET answered_at = now()$q$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'sub_paper_ack_answered PASSED'; END $$;
ROLLBACK;
