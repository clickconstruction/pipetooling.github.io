-- The Dashboard view's press (punch list #384 PR 1, migration *_dashboard_view_superintendent): set_dashboard_view
-- takes a leader's, a dev's and a superintendent's account, the office presses anyone's, a person presses his own
-- row and nobody else's, and a training account, a twin, an unknown view, an unknown id and nobody signed in are
-- each refused in words with the row left as it was. Everything rolls back. Raises on the first failed assertion;
-- ends with "dashboard_view PASSED". See scripts/pgtest-dashboard-view.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Mo (the leader), Dev (a dev), Rosa (assistant), Cory (controller), Sam and Lee (superintendents), Theo (estimator),
-- Pat (subcontractor), Tess (a superintendent in training mode), Twyla (a superintendent's twin).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000da001', 'mo@view.test'),
  ('00000000-0000-0000-0000-0000000da002', 'dev@view.test'),
  ('00000000-0000-0000-0000-0000000da003', 'rosa@view.test'),
  ('00000000-0000-0000-0000-0000000da004', 'cory@view.test'),
  ('00000000-0000-0000-0000-0000000da005', 'sam@view.test'),
  ('00000000-0000-0000-0000-0000000da006', 'lee@view.test'),
  ('00000000-0000-0000-0000-0000000da007', 'theo@view.test'),
  ('00000000-0000-0000-0000-0000000da008', 'pat@view.test'),
  ('00000000-0000-0000-0000-0000000da009', 'tess@view.test'),
  ('00000000-0000-0000-0000-0000000da010', 'twyla@view.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000da001', 'mo@view.test', 'View Mo', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000da002', 'dev@view.test', 'View Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000da003', 'rosa@view.test', 'View Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000da004', 'cory@view.test', 'View Cory', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000da005', 'sam@view.test', 'View Sam', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000da006', 'lee@view.test', 'View Lee', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000da007', 'theo@view.test', 'View Theo', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000da008', 'pat@view.test', 'View Pat', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000da009', 'tess@view.test', 'View Tess', 'superintendent', true, false),
  ('00000000-0000-0000-0000-0000000da010', 'twyla@view.test', 'View Twyla', 'superintendent', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA dvw;
CREATE FUNCTION dvw.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION dvw.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '{}' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The press as the signed-in person: "ok short" or the refusal's words.
CREATE FUNCTION dvw.press(p_user uuid, p_view text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN (r->>'ok')::boolean THEN 'ok ' || (r->>'view') ELSE r->>'error' END FROM (SELECT public.set_dashboard_view(p_user, p_view) AS r) x
$$;
-- What the row holds, read past row-level security: "short", "full" or "null".
CREATE FUNCTION dvw.holds(p_user uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT u.dashboard_view FROM public.users u WHERE u.id = p_user), 'null')
$$;
GRANT USAGE ON SCHEMA dvw TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dvw TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;

-- The office presses anyone's row that takes a view.
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da003');
SELECT dvw.same('the assistant sets a superintendent to Short', dvw.press('00000000-0000-0000-0000-0000000da005', 'short'), 'ok short');
SELECT dvw.same('the row holds it', dvw.holds('00000000-0000-0000-0000-0000000da005'), 'short');
SELECT dvw.same('the assistant sets a leader to Short, as before', dvw.press('00000000-0000-0000-0000-0000000da001', 'short'), 'ok short');
SELECT dvw.same('the assistant sets a dev to Short, as before', dvw.press('00000000-0000-0000-0000-0000000da002', 'short'), 'ok short');
SELECT dvw.same('an estimator''s account takes no view', dvw.press('00000000-0000-0000-0000-0000000da007', 'short'), 'A Dashboard view is for a leader''s or a superintendent''s account.');
SELECT dvw.same('the estimator''s row is untouched', dvw.holds('00000000-0000-0000-0000-0000000da007'), 'null');
SELECT dvw.same('the assistant''s own account takes no view', dvw.press('00000000-0000-0000-0000-0000000da003', 'short'), 'A Dashboard view is for a leader''s or a superintendent''s account.');
SELECT dvw.same('a view is Short or Full', dvw.press('00000000-0000-0000-0000-0000000da005', 'tiny'), 'The view is Short or Full.');
SELECT dvw.same('no view is refused too', dvw.press('00000000-0000-0000-0000-0000000da005', NULL), 'The view is Short or Full.');
SELECT dvw.same('an unknown id is named', dvw.press('00000000-0000-0000-0000-0000000daf99', 'short'), 'No account by that id.');
SELECT dvw.same('no id is no account', dvw.press(NULL, 'short'), 'No account by that id.');
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da001');
SELECT dvw.same('the leader sets a superintendent back to Full', dvw.press('00000000-0000-0000-0000-0000000da005', 'full'), 'ok full');
SELECT dvw.same('the row holds Full', dvw.holds('00000000-0000-0000-0000-0000000da005'), 'full');
SELECT dvw.same('the leader sets his own', dvw.press('00000000-0000-0000-0000-0000000da001', 'full'), 'ok full');

-- A superintendent presses his own row and nobody else's.
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da005');
SELECT dvw.same('a superintendent sets his own row to Short', dvw.press('00000000-0000-0000-0000-0000000da005', 'short'), 'ok short');
SELECT dvw.same('his row holds it', dvw.holds('00000000-0000-0000-0000-0000000da005'), 'short');
SELECT dvw.same('and back to Full', dvw.press('00000000-0000-0000-0000-0000000da005', 'full'), 'ok full');
SELECT dvw.same('he does not set another superintendent', dvw.press('00000000-0000-0000-0000-0000000da006', 'short'), 'Only the office sets another person''s Dashboard view.');
SELECT dvw.same('the other superintendent''s row is untouched', dvw.holds('00000000-0000-0000-0000-0000000da006'), 'null');
SELECT dvw.same('he does not set the leader', dvw.press('00000000-0000-0000-0000-0000000da001', 'short'), 'Only the office sets another person''s Dashboard view.');
SELECT dvw.same('the leader''s row is as the leader left it', dvw.holds('00000000-0000-0000-0000-0000000da001'), 'full');
SELECT dvw.same('no id from him is not his own row', dvw.press(NULL, 'short'), 'Only the office sets another person''s Dashboard view.');

-- A role that takes no view has no row to press, its own included.
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da007');
SELECT dvw.same('an estimator pressing his own row is told the role', dvw.press('00000000-0000-0000-0000-0000000da007', 'short'), 'A Dashboard view is for a leader''s or a superintendent''s account.');
SELECT dvw.same('an estimator does not set a superintendent', dvw.press('00000000-0000-0000-0000-0000000da005', 'short'), 'Only the office sets another person''s Dashboard view.');
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da008');
SELECT dvw.same('a sub pressing his own row is told the role', dvw.press('00000000-0000-0000-0000-0000000da008', 'short'), 'A Dashboard view is for a leader''s or a superintendent''s account.');
SELECT dvw.same('the sub''s row is untouched', dvw.holds('00000000-0000-0000-0000-0000000da008'), 'null');

-- Training mode and a twin look and press nothing, on their own rows too.
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da009');
SELECT dvw.same('a training account is refused on its own row', dvw.press('00000000-0000-0000-0000-0000000da009', 'short'), 'Training mode: you can look, but every change is blocked for your account.');
SELECT dvw.same('the training account''s row is untouched', dvw.holds('00000000-0000-0000-0000-0000000da009'), 'null');
SELECT dvw.as_user('00000000-0000-0000-0000-0000000da010');
SELECT dvw.same('a twin is refused on its own row', dvw.press('00000000-0000-0000-0000-0000000da010', 'short'), 'Training mode: you can look, but every change is blocked for your account.');

-- Nobody signed in.
SELECT dvw.as_user(NULL);
SELECT dvw.same('nobody signed in presses nothing', dvw.press('00000000-0000-0000-0000-0000000da005', 'short'), 'Only the office sets another person''s Dashboard view.');
SELECT dvw.same('the superintendent''s row is as he left it', dvw.holds('00000000-0000-0000-0000-0000000da005'), 'full');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'dashboard_view PASSED'; END $$;
ROLLBACK;
