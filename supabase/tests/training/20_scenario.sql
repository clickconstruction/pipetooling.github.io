-- Training (v2.5565, punch list #111): the policy and the record behind the courses the crew takes at their own
-- pace, and training_state_for(), the SQL twin of src/lib/training/trainingState.ts. Runs as each person through
-- RLS; everything inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "training PASSED". See scripts/pgtest-training.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000071e1', 'helper@training.test'),
  ('00000000-0000-0000-0000-0000000071e2', 'assistant@training.test'),
  ('00000000-0000-0000-0000-0000000071e3', 'dev@training.test'),
  ('00000000-0000-0000-0000-0000000071e4', 'estimator@training.test'),
  ('00000000-0000-0000-0000-0000000071e5', 'trainee@training.test'),
  ('00000000-0000-0000-0000-0000000071e6', 'twin@training.test'),
  ('00000000-0000-0000-0000-0000000071e7', 'sample@training.test'),
  ('00000000-0000-0000-0000-0000000071e8', 'gone@training.test'),
  ('00000000-0000-0000-0000-0000000071e9', 'other@training.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000071e1', 'helper@training.test', 'Training Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000071e2', 'assistant@training.test', 'Training Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000071e3', 'dev@training.test', 'Training Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000071e4', 'estimator@training.test', 'Training Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000071e5', 'trainee@training.test', 'Training Trainee', 'helpers'),
  ('00000000-0000-0000-0000-0000000071e6', 'twin@training.test', 'Training Twin', 'helpers'),
  ('00000000-0000-0000-0000-0000000071e7', 'sample@training.test', 'Training Sample', 'helpers'),
  ('00000000-0000-0000-0000-0000000071e8', 'gone@training.test', 'Training Gone', 'helpers'),
  ('00000000-0000-0000-0000-0000000071e9', 'other@training.test', 'Training Other Helper', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000071e5';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000071e6';
UPDATE public.users SET is_sample = true WHERE id = '00000000-0000-0000-0000-0000000071e7';
UPDATE public.users SET archived_at = now() WHERE id = '00000000-0000-0000-0000-0000000071e8';

CREATE SCHEMA tt;
CREATE FUNCTION tt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- The standing one person reads for one person, as one line: "colour passed_on due_on days".
CREATE FUNCTION tt.standing(p_user uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(s.colour || ' ' || COALESCE(s.passed_on::text, '-') || ' ' || COALESCE(s.due_on::text, '-') || ' ' || COALESCE(s.days_to_due::text, '-'), ' | ' ORDER BY s.course_slug), '(none)')
  FROM public.training_state_for(p_user) s $$;
GRANT USAGE ON SCHEMA tt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tt TO authenticated, anon;

-- Sign in as one person for the statements that follow, through RLS.
CREATE FUNCTION tt.as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_user::text, true) $$;
GRANT EXECUTE ON FUNCTION tt.as_user(uuid) TO authenticated;

-- 0 · The seed: one course, off, required of the field roles.
SELECT tt.same('the seed row, off',
  (SELECT slug || ' ' || enabled::text || ' ' || array_to_string(required_roles, ',') || ' ' || good_for_months || ' ' || due_soon_days FROM public.training_courses WHERE slug = 'osha-30-refresher'),
  'osha-30-refresher false helpers,subcontractor,primary,master_technician,superintendent 12 30');
-- v2.5610: the second course, off, required of helpers, offered to every other role, good for 120 months.
SELECT tt.same('the second seed row, off and offered',
  (SELECT slug || ' ' || enabled::text || ' ' || offered::text || ' ' || array_to_string(required_roles, ',') || ' ' || good_for_months FROM public.training_courses WHERE slug = 'intro-to-plumbing'),
  'intro-to-plumbing false true helpers 120');

-- 1 · Off: a helper who must take it once it is on reads nothing yet.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('off: nothing to show', tt.standing('00000000-0000-0000-0000-0000000071e1'), '(none)');

-- 2 · Only a dev turns it on: the helper's update changes nothing under RLS; the dev's takes.
UPDATE public.training_courses SET enabled = true WHERE slug = 'osha-30-refresher';
RESET ROLE;
SELECT tt.same('a helper cannot switch a course on', (SELECT enabled::text FROM public.training_courses WHERE slug = 'osha-30-refresher'), 'false');
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET enabled = true, updated_by = auth.uid() WHERE slug = 'osha-30-refresher';
RESET ROLE;
SELECT tt.same('a dev switches it on', (SELECT enabled::text || ' ' || (updated_by = '00000000-0000-0000-0000-0000000071e3')::text FROM public.training_courses WHERE slug = 'osha-30-refresher'), 'true true');

-- 3 · Red with no pass; a lesson passed is one row, passed again is the same row; a final check under the bar is refused.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('red with no pass', tt.standing('00000000-0000-0000-0000-0000000071e1'), 'red - - -');
SELECT public.training_pass_lesson('osha-30-refresher', '19-trenches-soil-and-protection', 2);
SELECT public.training_pass_lesson('osha-30-refresher', '19-trenches-soil-and-protection', 3);
SELECT public.training_pass_lesson('osha-30-refresher', '01-how-safety-works-on-a-site', 1);
SELECT tt.same('two lessons passed, one row each, the retry kept',
  (SELECT string_agg(lesson_key || ':' || tries, ',' ORDER BY lesson_key) FROM public.training_lesson_passes WHERE user_id = auth.uid()),
  '01-how-safety-works-on-a-site:1,19-trenches-soil-and-protection:3');
SELECT tt.refused('a final check under the bar', $$SELECT public.training_finish_course('osha-30-refresher', 'abcdef01', 13, 20, 14, '{}'::jsonb)$$, 'Not a pass');
SELECT tt.refused('a course that does not exist', $$SELECT public.training_pass_lesson('no-such-course', '01-x', 1)$$, 'No course is named');
SELECT tt.refused('a score out of its total', $$SELECT public.training_finish_course('osha-30-refresher', 'abcdef01', 21, 20, 14, '{}'::jsonb)$$, 'right out of total');
SELECT tt.same('still red', tt.standing('00000000-0000-0000-0000-0000000071e1'), 'red - - -');

-- 4 · A pass: green, due twelve months from today, counted from the app's day.
SELECT tt.same('a pass returns its row', (SELECT (public.training_finish_course('osha-30-refresher', 'abcdef01', 15, 20, 14, '{"q1": 2}'::jsonb) IS NOT NULL)::text), 'true');
SELECT tt.same('green after the pass',
  tt.standing('00000000-0000-0000-0000-0000000071e1'),
  'green ' || public.app_today()::text || ' ' || (public.app_today() + interval '12 months')::date::text || ' ' || ((public.app_today() + interval '12 months')::date - public.app_today())::text);
SELECT tt.same('the pass row: the version, the score, the day',
  (SELECT content_version || ' ' || score || '/' || total || ' ' || passed_on::text || ' ' || (answers ->> 'q1') FROM public.training_passes WHERE user_id = auth.uid()),
  'abcdef01 15/20 ' || public.app_today()::text || ' 2');
RESET ROLE;

-- 5 · A window of 0 months reads amber for everyone at once; the retake stamp reads red; back to green.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET good_for_months = 0 WHERE slug = 'osha-30-refresher';
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('a window of 0 months: amber, due today', tt.standing('00000000-0000-0000-0000-0000000071e1'), 'amber ' || public.app_today()::text || ' ' || public.app_today()::text || ' 0');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET good_for_months = 12, retake_from = public.app_today() + 1 WHERE slug = 'osha-30-refresher';
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('everyone takes it again: red', tt.standing('00000000-0000-0000-0000-0000000071e1'), 'red - - -');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET retake_from = NULL WHERE slug = 'osha-30-refresher';
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('the stamp cleared: green again', (SELECT split_part(tt.standing('00000000-0000-0000-0000-0000000071e1'), ' ', 1)), 'green');
RESET ROLE;

-- 6 · A role the course is not required of reads nothing; a helper reads neither another's passes nor their standing;
--     the office reads both; standings leave out the sample, the twin and the archived account.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e4');
SET LOCAL ROLE authenticated;
SELECT tt.same('an estimator: nothing to show', tt.standing('00000000-0000-0000-0000-0000000071e4'), '(none)');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e9');
SET LOCAL ROLE authenticated;
SELECT tt.same('another helper reads no passes of the first', (SELECT count(*)::text FROM public.training_passes), '0');
SELECT tt.same('another helper reads no standing of the first', tt.standing('00000000-0000-0000-0000-0000000071e1'), '(none)');
SELECT tt.same('and their own is red', tt.standing('00000000-0000-0000-0000-0000000071e9'), 'red - - -');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e2');
SET LOCAL ROLE authenticated;
SELECT tt.same('the office reads the first helper''s pass', (SELECT count(*)::text FROM public.training_passes WHERE user_id = '00000000-0000-0000-0000-0000000071e1'), '1');
SELECT tt.same('the office reads the first helper''s standing', (SELECT split_part(tt.standing('00000000-0000-0000-0000-0000000071e1'), ' ', 1)), 'green');
SELECT tt.same('standings: the team who must take it, worst first, no sample, twin or archived account',
  (SELECT string_agg(name || ' ' || colour, ', ' ORDER BY colour, name) FROM public.training_standings('osha-30-refresher') WHERE name LIKE 'Training %'),
  'Training Helper green, Training Other Helper red, Training Trainee red');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('a helper gets no standings list', (SELECT count(*)::text FROM public.training_standings('osha-30-refresher')), '0');
RESET ROLE;

-- 7 · The house fences: a training-mode account and a digital twin are refused their own pass.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e5');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a training-mode account''s lesson pass', $$SELECT public.training_pass_lesson('osha-30-refresher', '01-how-safety-works-on-a-site', 1)$$, 'Read-only');
SELECT tt.refused('a training-mode account''s course pass', $$SELECT public.training_finish_course('osha-30-refresher', 'abcdef01', 20, 20, 14, '{}'::jsonb)$$, 'Read-only');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e6');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a digital twin''s lesson pass', $$SELECT public.training_pass_lesson('osha-30-refresher', '01-how-safety-works-on-a-site', 1)$$, '');
SELECT tt.refused('a digital twin''s course pass', $$SELECT public.training_finish_course('osha-30-refresher', 'abcdef01', 20, 20, 14, '{}'::jsonb)$$, '');
RESET ROLE;

-- 8 · No sign-in, and anon: refused.
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE authenticated;
SELECT tt.refused('no sign-in', $$SELECT public.training_pass_lesson('osha-30-refresher', '01-how-safety-works-on-a-site', 1)$$, 'Sign in');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tt.refused('anon cannot pass a lesson', $$SELECT public.training_pass_lesson('osha-30-refresher', '01-how-safety-works-on-a-site', 1)$$, 'permission denied');
SELECT tt.refused('anon cannot read the standings', $$SELECT * FROM public.training_state_for('00000000-0000-0000-0000-0000000071e1')$$, 'permission denied');
RESET ROLE;

-- 9 · An offered course (v2.5610, punch list #119): once on, a role it is not required of reads no colour for it and may
--     still pass it; the office reads the pass; requiring that role later turns the old pass green at once.
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET enabled = true WHERE slug = 'intro-to-plumbing';
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e4');
SET LOCAL ROLE authenticated;
SELECT tt.same('offered: an estimator reads no colour for it', tt.standing('00000000-0000-0000-0000-0000000071e4'), '(none)');
SELECT public.training_pass_lesson('intro-to-plumbing', '01-two-systems-one-house', 1);
SELECT tt.same('offered: the estimator passed a lesson', (SELECT count(*)::text FROM public.training_lesson_passes WHERE course_slug = 'intro-to-plumbing'), '1');
SELECT public.training_finish_course('intro-to-plumbing', 'abcdef01', 18, 20, 14, '{}'::jsonb);
SELECT tt.same('offered: the estimator passed the course and still reads no colour', tt.standing('00000000-0000-0000-0000-0000000071e4'), '(none)');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e2');
SET LOCAL ROLE authenticated;
SELECT tt.same('the office reads the offered pass', (SELECT count(*)::text FROM public.training_passes WHERE course_slug = 'intro-to-plumbing'), '1');
SELECT tt.same('standings of the offered course: the helpers who must take it, none of them the estimator',
  (SELECT string_agg(name || ' ' || colour, ', ' ORDER BY colour, name) FROM public.training_standings('intro-to-plumbing') WHERE name LIKE 'Training %'),
  'Training Helper red, Training Other Helper red, Training Trainee red');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e3');
SET LOCAL ROLE authenticated;
UPDATE public.training_courses SET required_roles = ARRAY['helpers', 'estimator'] WHERE slug = 'intro-to-plumbing';
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000071e4');
SET LOCAL ROLE authenticated;
SELECT tt.same('required of estimators later: the old pass is green at once', (SELECT split_part(tt.standing('00000000-0000-0000-0000-0000000071e4'), ' ', 1)), 'green');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'training PASSED'; END $$;
ROLLBACK;
