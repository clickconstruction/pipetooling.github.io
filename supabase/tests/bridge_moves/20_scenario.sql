-- The Bridge's call reaches its people (v2.6864, punch list #303 PR 4): bridge_my_moves hands a signed-in person
-- the open moves that carry their own account on the standing call, and bridge_mark_my_move_done stamps one of
-- them done. Here: the table stays closed to the office; each person reads only their own moves; a move that is
-- someone else's, or not on the call, is refused in words; Done stamps that one move and leaves the rest as they
-- were; and the moves leave once Friday is answered, the week has passed, a newer call stands, or the account is
-- archived. Made-up people and words. Fixtures made as postgres; the functions run as each person through RLS;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "bridge_moves PASSED". See scripts/pgtest-bridge-moves.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA bmv;
CREATE FUNCTION bmv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION bmv.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION bmv.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the caller's moves read as, in a few words.
CREATE FUNCTION bmv.mine() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(m.idx || ' ' || m.move_key || ' ' || m.title, ' | ' ORDER BY m.idx), 'none') FROM public.bridge_my_moves() m $$;
-- What the bed reads past RLS (as postgres): one move of a call, whole.
CREATE FUNCTION bmv.move(p_call uuid, p_idx int) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.moves -> p_idx FROM public.bridge_calls c WHERE c.id = p_call $$;
GRANT USAGE ON SCHEMA bmv TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bmv TO authenticated, anon;

-- Who: the owner, an assistant, an estimator, and an assistant whose account is archived (archived as the row is
-- made: the users guard lets nobody but the archive flow change that column afterwards).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000864a1', 'owner@bridge.test'),
  ('00000000-0000-0000-0000-0000000864a2', 'assistant@bridge.test'),
  ('00000000-0000-0000-0000-0000000864a3', 'estimator@bridge.test'),
  ('00000000-0000-0000-0000-0000000864a4', 'gone@bridge.test');
INSERT INTO public.users (id, email, name, role, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000864a1', 'owner@bridge.test', 'Sam Sample', 'master_technician', NULL),
  ('00000000-0000-0000-0000-0000000864a2', 'assistant@bridge.test', 'Dana Sample', 'assistant', NULL),
  ('00000000-0000-0000-0000-0000000864a3', 'estimator@bridge.test', 'Jorge Sample', 'estimator', NULL),
  ('00000000-0000-0000-0000-0000000864a4', 'gone@bridge.test', 'Lee Sample', 'assistant', now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;

-- This week's call, made two days ago: Dana bills, Sam prices, a third move names nobody with an account, and a
-- fourth names the archived one.
INSERT INTO public.bridge_calls (id, week_start, called_on, called_by_name, link, moves) VALUES
  ('00000000-0000-0000-0000-0000000864c1', (now() AT TIME ZONE 'America/Chicago')::date - 2, (now() AT TIME ZONE 'America/Chicago')::date - 2, 'Sam', 'bill',
   jsonb_build_array(
     jsonb_build_object('key', 'bill', 'title', 'Bill the 11 finished jobs.', 'who', 'Dana', 'whoId', '00000000-0000-0000-0000-0000000864a2', 'then', 142000),
     jsonb_build_object('key', 'price', 'title', 'Price the 4 jobs with no price.', 'who', 'Sam', 'whoId', '00000000-0000-0000-0000-0000000864a1', 'then', 4),
     jsonb_build_object('key', 'other', 'title', 'Take bank sorting off whoever bills.', 'who', 'the office', 'then', null),
     jsonb_build_object('key', 'approve', 'title', 'Approve the 93 hours waiting.', 'who', 'Lee', 'whoId', '00000000-0000-0000-0000-0000000864a4', 'then', 93)));

-- Nobody signed in reads nothing, and the anonymous key cannot call either function.
SELECT bmv.same('nobody signed in has no moves', bmv.mine(), 'none');
SET LOCAL ROLE anon;
SELECT bmv.refused('the anonymous key cannot read moves', $q$SELECT * FROM public.bridge_my_moves()$q$, 'permission denied');
SELECT bmv.refused('the anonymous key cannot mark a move', $q$SELECT public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 0)$q$, 'permission denied');
RESET ROLE;

-- The assistant: the table stays closed to her, and she reads her own move alone.
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a2');
SELECT bmv.same('the assistant still cannot read the calls', (SELECT count(*)::text FROM public.bridge_calls), '0');
SELECT bmv.same('the assistant reads her own move', bmv.mine(), '0 bill Bill the 11 finished jobs.');
-- The owner reads his, and the estimator, named on nothing, reads none.
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a1');
SELECT bmv.same('the owner reads his own move', bmv.mine(), '1 price Price the 4 jobs with no price.');
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a3');
SELECT bmv.same('a person named on nothing reads none', bmv.mine(), 'none');
SELECT bmv.same('and cannot mark a move that is not theirs', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 0)->>'error', 'That move is not yours.');

-- Done: only her own move, only once, and nothing else on the call changes.
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a2');
SELECT bmv.same('the owner''s move is not hers to mark', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 1)->>'error', 'That move is not yours.');
SELECT bmv.same('a move with nobody''s account is not hers either', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 2)->>'error', 'That move is not yours.');
SELECT bmv.same('a move past the end is not on the call', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 9)->>'error', 'That move is not on the call.');
SELECT bmv.same('a call that does not exist is refused', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864ff', 0)->>'error', 'That move is not on the call.');
SELECT bmv.same('she marks her own move done', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 0)->>'ok', 'true');
SELECT bmv.same('and it leaves her list', bmv.mine(), 'none');
SELECT bmv.same('the move carries who said so', bmv.move('00000000-0000-0000-0000-0000000864c1', 0)->>'doneBy', 'Dana Sample');
SELECT bmv.same('and when', (bmv.move('00000000-0000-0000-0000-0000000864c1', 0)->>'doneAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')::text, 'true');
SELECT bmv.same('its own words are as they were', bmv.move('00000000-0000-0000-0000-0000000864c1', 0)->>'title', 'Bill the 11 finished jobs.');
SELECT bmv.same('the owner''s move is untouched', (bmv.move('00000000-0000-0000-0000-0000000864c1', 1) ? 'doneAt')::text, 'false');
CREATE TEMP TABLE bmv_first ON COMMIT DROP AS SELECT bmv.move('00000000-0000-0000-0000-0000000864c1', 0)->>'doneAt' AS at;
SELECT bmv.same('a second press says ok', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 0)->>'ok', 'true');
SELECT bmv.same('and changes nothing', bmv.move('00000000-0000-0000-0000-0000000864c1', 0)->>'doneAt', (SELECT at FROM bmv_first));
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a1');
SELECT bmv.same('the owner still has his', bmv.mine(), '1 price Price the 4 jobs with no price.');
RESET ROLE;

-- An archived account reads nothing and marks nothing, though a move carries it.
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a4');
SELECT bmv.same('an archived account has no moves', bmv.mine(), 'none');
SELECT bmv.same('and cannot mark one', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c1', 3)->>'error', 'This account is archived.');
RESET ROLE;
SELECT bmv.same('the archived account''s move is untouched', (bmv.move('00000000-0000-0000-0000-0000000864c1', 3) ? 'doneAt')::text, 'false');

-- Once Friday is answered the moves leave.
UPDATE public.bridge_calls SET outcome = 'moved', outcome_at = now() WHERE id = '00000000-0000-0000-0000-0000000864c1';
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a1');
SELECT bmv.same('an answered call hands out no moves', bmv.mine(), 'none');
RESET ROLE;
UPDATE public.bridge_calls SET outcome = NULL, outcome_at = NULL WHERE id = '00000000-0000-0000-0000-0000000864c1';

-- A call whose pay week has passed hands out none.
UPDATE public.bridge_calls SET week_start = (now() AT TIME ZONE 'America/Chicago')::date - 8, called_on = (now() AT TIME ZONE 'America/Chicago')::date - 8 WHERE id = '00000000-0000-0000-0000-0000000864c1';
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a1');
SELECT bmv.same('a call from a week that has passed hands out no moves', bmv.mine(), 'none');
RESET ROLE;
UPDATE public.bridge_calls SET week_start = (now() AT TIME ZONE 'America/Chicago')::date - 2, called_on = (now() AT TIME ZONE 'America/Chicago')::date - 2 WHERE id = '00000000-0000-0000-0000-0000000864c1';

-- The week is called again: the newest call is the call, and the first one's moves leave.
INSERT INTO public.bridge_calls (id, week_start, called_on, called_by_name, link, moves, created_at) VALUES
  ('00000000-0000-0000-0000-0000000864c2', (now() AT TIME ZONE 'America/Chicago')::date - 2, (now() AT TIME ZONE 'America/Chicago')::date - 1, 'Sam', 'collect',
   jsonb_build_array(jsonb_build_object('key', 'chase', 'title', 'Chase the 9 late invoices.', 'who', 'Dana', 'whoId', '00000000-0000-0000-0000-0000000864a2', 'then', 41000)),
   now() + interval '1 minute');
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a1');
SELECT bmv.same('the first call''s moves leave when the week is called again', bmv.mine(), 'none');
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a2');
SELECT bmv.same('and the new call''s move arrives', bmv.mine(), '0 chase Chase the 9 late invoices.');
RESET ROLE;

-- A call whose moves are not a list is read as no moves.
UPDATE public.bridge_calls SET moves = '{}'::jsonb WHERE id = '00000000-0000-0000-0000-0000000864c2';
SET LOCAL ROLE authenticated;
SELECT bmv.as_user('00000000-0000-0000-0000-0000000864a2');
SELECT bmv.same('moves that are not a list read as none', bmv.mine(), 'none');
SELECT bmv.same('and nothing in them can be marked', public.bridge_mark_my_move_done('00000000-0000-0000-0000-0000000864c2', 0)->>'error', 'That move is not on the call.');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'bridge_moves PASSED'; END $$;
ROLLBACK;
