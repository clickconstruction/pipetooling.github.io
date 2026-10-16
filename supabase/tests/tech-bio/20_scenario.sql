-- The tech's bio, the ground (v2.5587, punch list #114): the memory column on messages, the opener, the office adding,
-- changing, moving and removing a helper's lines through edit_bio_line with each refusal, who reads which lines
-- through RLS, and the helper's own veto through bio_line_say with each refusal. Runs as each person through RLS;
-- everything inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "tech-bio PASSED". See scripts/pgtest-tech-bio.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000073b1', 'helper@techbio.test'),
  ('00000000-0000-0000-0000-0000000073b2', 'assistant@techbio.test'),
  ('00000000-0000-0000-0000-0000000073b3', 'trainee@techbio.test'),
  ('00000000-0000-0000-0000-0000000073b4', 'other@techbio.test'),
  ('00000000-0000-0000-0000-0000000073b5', 'sub@techbio.test'),
  ('00000000-0000-0000-0000-0000000073b6', 'trainee-office@techbio.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000073b1', 'helper@techbio.test', 'Way Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000073b2', 'assistant@techbio.test', 'Bio Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000073b3', 'trainee@techbio.test', 'Bio Trainee', 'helpers'),
  ('00000000-0000-0000-0000-0000000073b4', 'other@techbio.test', 'Other Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000073b5', 'sub@techbio.test', 'Bio Sub', 'subcontractor'),
  ('00000000-0000-0000-0000-0000000073b6', 'trainee-office@techbio.test', 'Office Trainee', 'assistant')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
UPDATE public.users SET read_only = true WHERE id IN ('00000000-0000-0000-0000-0000000073b3', '00000000-0000-0000-0000-0000000073b6');

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
-- A person's live lines as one line: "position:text:spanish-or-dash:off".
CREATE FUNCTION tt.lines(p_user uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(l.position || ':' || l.text || ':' || COALESCE(l.text_es, '-') || ':' || (l.off_by_user_at IS NOT NULL)::text, '|' ORDER BY l.position, l.added_at, l.id), '(none)')
  FROM public.user_bio_lines l WHERE l.user_id = p_user AND l.removed_at IS NULL $$;
GRANT USAGE ON SCHEMA tt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tt TO authenticated, anon;

-- Sign in as one person for the statements that follow, through RLS.
CREATE FUNCTION tt.as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
         set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $$;
GRANT EXECUTE ON FUNCTION tt.as_user(uuid) TO authenticated, anon;

-- 0 · The ground: the table, the memory column, the opener from the first word of the name.
SELECT tt.same('the lines table is there', (SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_bio_lines'), '1');
SELECT tt.same('the memory column is on messages', (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'introduces_user_id'), '1');
SELECT tt.same('the opener takes the first name', public.bio_opener('00000000-0000-0000-0000-0000000073b1', 'en'), 'A little about Way: ');
SELECT tt.same('the Spanish opener', public.bio_opener('00000000-0000-0000-0000-0000000073b1', 'es'), 'Un poco sobre Way: ');
SELECT tt.same('a helper has no lines yet', tt.lines('00000000-0000-0000-0000-0000000073b1'), '(none)');

-- 1 · The office writes three lines for the helper; each takes the next place.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b2');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE ids AS SELECT
  public.edit_bio_line('00000000-0000-0000-0000-0000000073b1', NULL, 'Way has been a plumber for twelve years.', 'Es plomero desde hace doce años.', NULL, false) AS l1;
ALTER TABLE ids ADD COLUMN l2 uuid;
ALTER TABLE ids ADD COLUMN l3 uuid;
UPDATE ids SET l2 = public.edit_bio_line('00000000-0000-0000-0000-0000000073b1', NULL, '  Water heaters are his specialty.  ', '   ', NULL, false);
UPDATE ids SET l3 = public.edit_bio_line('00000000-0000-0000-0000-0000000073b1', NULL, 'He coaches Little League.', 'Entrena béisbol infantil.', NULL, false);
RESET ROLE;
SELECT tt.same('three lines in order, trimmed, blank Spanish as none', tt.lines('00000000-0000-0000-0000-0000000073b1'),
  '1:Way has been a plumber for twelve years.:Es plomero desde hace doce años.:false|2:Water heaters are his specialty.:-:false|3:He coaches Little League.:Entrena béisbol infantil.:false');
SELECT tt.same('the office is written on each line', (SELECT count(*)::text FROM public.user_bio_lines WHERE user_id = '00000000-0000-0000-0000-0000000073b1' AND added_by = '00000000-0000-0000-0000-0000000073b2'), '3');

-- 2 · The office changes words and Spanish, moves a line, removes one; each refusal in words.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b2');
SET LOCAL ROLE authenticated;
SELECT tt.same('a change answers the same id', public.edit_bio_line('00000000-0000-0000-0000-0000000073b1', (SELECT l2 FROM ids), 'Water heaters and repipes are his specialty.', 'Su especialidad son los calentadores.', 5, false)::text, (SELECT l2::text FROM ids));
SELECT tt.same('a removal answers the id', public.edit_bio_line('00000000-0000-0000-0000-0000000073b1', (SELECT l3 FROM ids), NULL, NULL, NULL, true)::text, (SELECT l3::text FROM ids));
SELECT tt.refused('a removed line cannot be changed',
  format('SELECT public.edit_bio_line(%L, %L, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', (SELECT l3 FROM ids), 'x'), 'That line was removed.');
SELECT tt.refused('a line that is not there',
  format('SELECT public.edit_bio_line(%L, %L, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', gen_random_uuid(), 'x'), 'That line is not there.');
SELECT tt.refused('a line under the wrong person',
  format('SELECT public.edit_bio_line(%L, %L, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b4', (SELECT l1 FROM ids), 'x'), 'That line is not there.');
SELECT tt.refused('a removal with no line',
  format('SELECT public.edit_bio_line(%L, NULL, NULL, NULL, NULL, true)', '00000000-0000-0000-0000-0000000073b1'), 'That line is not there.');
SELECT tt.refused('an empty line',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', '   '), 'Write the line first.');
SELECT tt.refused('a line with a line break',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', E'one\ntwo'), 'A line is one line.');
SELECT tt.refused('a bio past the cap',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', repeat('x', 300)), '320 is the most.');
SELECT tt.refused('a Spanish bio past the cap',
  format('SELECT public.edit_bio_line(%L, NULL, %L, %L, NULL, false)', '00000000-0000-0000-0000-0000000073b1', 'Short.', repeat('y', 300)), 'The Spanish bio would run');
SELECT tt.refused('a person with no account',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', gen_random_uuid(), 'x'), 'That person has no account here.');
RESET ROLE;
SELECT tt.same('after the change, the move and the removal', tt.lines('00000000-0000-0000-0000-0000000073b1'),
  '1:Way has been a plumber for twelve years.:Es plomero desde hace doce años.:false|5:Water heaters and repipes are his specialty.:Su especialidad son los calentadores.:false');
SELECT tt.same('the removed line keeps its row, with who removed it',
  (SELECT (removed_at IS NOT NULL)::text || ':' || removed_by::text FROM public.user_bio_lines WHERE id = (SELECT l3 FROM ids)), 'true:00000000-0000-0000-0000-0000000073b2');
SELECT tt.same('the whole fits the cap after the change', (length(public.bio_opener('00000000-0000-0000-0000-0000000073b1', 'en')) < 320)::text, 'true');

-- 3 · Who reads: the helper their own, the office everyone's, nobody else's.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b1');
SET LOCAL ROLE authenticated;
SELECT tt.same('the helper reads their own lines, the removed one too', (SELECT count(*)::text FROM public.user_bio_lines), '3');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b4');
SET LOCAL ROLE authenticated;
SELECT tt.same('another helper reads none of them', (SELECT count(*)::text FROM public.user_bio_lines), '0');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b5');
SET LOCAL ROLE authenticated;
SELECT tt.same('a sub reads none of them', (SELECT count(*)::text FROM public.user_bio_lines), '0');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b2');
SET LOCAL ROLE authenticated;
SELECT tt.same('the office reads them all', (SELECT count(*)::text FROM public.user_bio_lines), '3');
SELECT tt.refused('the office writes the table only through the function',
  format('INSERT INTO public.user_bio_lines (user_id, text) VALUES (%L, %L)', '00000000-0000-0000-0000-0000000073b1', 'straight in'), 'permission denied');
RESET ROLE;

-- 4 · The helper's own veto: off, off again keeps the first stamp, on; each refusal in words.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b1');
SET LOCAL ROLE authenticated;
SELECT public.bio_line_say((SELECT l1 FROM ids), false);
SELECT tt.same('the line is off', (SELECT (off_by_user_at IS NOT NULL)::text FROM public.user_bio_lines WHERE id = (SELECT l1 FROM ids)), 'true');
CREATE TEMP TABLE stamp AS SELECT off_by_user_at AS at FROM public.user_bio_lines WHERE id = (SELECT l1 FROM ids);
SELECT public.bio_line_say((SELECT l1 FROM ids), false);
SELECT tt.same('off again keeps the first stamp', (SELECT (l.off_by_user_at = s.at)::text FROM public.user_bio_lines l, stamp s WHERE l.id = (SELECT l1 FROM ids)), 'true');
SELECT public.bio_line_say((SELECT l1 FROM ids), true);
SELECT tt.same('the line is said again', (SELECT (off_by_user_at IS NULL)::text FROM public.user_bio_lines WHERE id = (SELECT l1 FROM ids)), 'true');
SELECT tt.refused('a removed line cannot be turned', format('SELECT public.bio_line_say(%L, false)', (SELECT l3 FROM ids)), 'That line was removed.');
SELECT tt.refused('the helper cannot write a line of their own',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', 'I am great.'), 'Only the office can change a tech''s bio.');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b4');
SET LOCAL ROLE authenticated;
SELECT tt.refused('another helper cannot turn the line', format('SELECT public.bio_line_say(%L, false)', (SELECT l1 FROM ids)), 'That line is not yours.');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b3');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a training account cannot turn a line', format('SELECT public.bio_line_say(%L, false)', (SELECT l1 FROM ids)), 'A training account cannot change a bio.');
RESET ROLE;
SELECT tt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT tt.refused('nobody signed in cannot turn a line', format('SELECT public.bio_line_say(%L, false)', (SELECT l1 FROM ids)), 'Sign in to change your bio.');
SELECT tt.refused('nobody signed in cannot write a line',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', 'x'), 'Sign in to change a tech''s bio.');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tt.refused('anon holds neither function', format('SELECT public.bio_line_say(%L, false)', (SELECT l1 FROM ids)), 'permission denied');
SELECT tt.refused('anon reads no line', 'SELECT count(*) FROM public.user_bio_lines', 'permission denied');
RESET ROLE;

-- 5 · Who writes: the office only, and not a training account.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b5');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a sub cannot write a line',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', 'x'), 'Only the office can change a tech''s bio.');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b6');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a training account in the office cannot write a line',
  format('SELECT public.edit_bio_line(%L, NULL, %L, NULL, NULL, false)', '00000000-0000-0000-0000-0000000073b1', 'x'), 'A training account cannot change a tech''s bio.');
RESET ROLE;

-- 6 · The office writes a line for an office member too, since the owner works jobs.
SELECT tt.as_user('00000000-0000-0000-0000-0000000073b2');
SET LOCAL ROLE authenticated;
SELECT tt.same('an office member takes a line', (public.edit_bio_line('00000000-0000-0000-0000-0000000073b2', NULL, 'Bio runs the office.', NULL, NULL, false) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT tt.same('the office member’s own line', tt.lines('00000000-0000-0000-0000-0000000073b2'), '1:Bio runs the office.:-:false');

DO $$ BEGIN RAISE NOTICE 'tech-bio PASSED'; END $$;
ROLLBACK;
