-- The Away note (v2.6587, punch list #256 PR 8, migration *_away_notes): the table the office reads and the service role
-- writes, and my_away_note(), the one RPC the seal lets an archived caller reach. Fixtures are written as postgres; the
-- tries run as each account under RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "away_notes PASSED". See scripts/pgtest-away-notes.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Ava left on 2026-11-03 and is archived; Ben is a dev still here; Cal is a controller; Hal is a helper.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000256b0a1', 'ava@away.test'),
  ('00000000-0000-0000-0000-00000256b0a2', 'ben@away.test'),
  ('00000000-0000-0000-0000-00000256b0a3', 'cal@away.test'),
  ('00000000-0000-0000-0000-00000256b0a4', 'hal@away.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-00000256b0a1', 'ava@away.test', 'Ava Away', 'helpers', false, false, '2026-11-04 15:00+00'),
  ('00000000-0000-0000-0000-00000256b0a2', 'ben@away.test', 'Ben Here', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-00000256b0a3', 'cal@away.test', 'Cal Counts', 'controller', false, false, NULL),
  ('00000000-0000-0000-0000-00000256b0a4', 'hal@away.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name, start_date, end_date, account_user_id) VALUES
  ('00000000-0000-0000-0000-00000256b0b1', '00000000-0000-0000-0000-00000256b0a2', 'helper', 'Ava Away', '2024-03-04', '2026-11-03', '00000000-0000-0000-0000-00000256b0a1');
INSERT INTO public.app_settings (key, value_text) VALUES
  ('office_address_v1', '{"address":"12925 FM 20, Kingsbury, TX 78638","lat":29.65,"lng":-97.81}'),
  ('field_dispatch_phone_v1', '(512) 555-0142')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;

CREATE SCHEMA away;
GRANT USAGE ON SCHEMA away TO authenticated;
CREATE FUNCTION away.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION away.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION away.gate(p_path text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.path', p_path, true);
  PERFORM set_config('request.method', 'GET', true);
  PERFORM public.archived_pre_request();
  RETURN 'passes';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- A write's outcome as a word: 'wrote', or the sqlstate it raised.
CREATE FUNCTION away.try_insert(p_user uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.away_notes (user_id, words) VALUES (p_user, 'a note from the wrong hand');
  RETURN 'wrote';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA away TO authenticated;

-- The structure.
SELECT away.same('away_notes carries the training and twin fences', (
  SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'away_notes' AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
), 'archived_fence, digital_twin_write_fence_delete, digital_twin_write_fence_insert, digital_twin_write_fence_update');
SELECT away.same('the fence is on the table', (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'away_notes' AND policyname = 'archived_fence'), '1');
SELECT away.same('the RPC is open to authenticated and closed to anon', (
  SELECT (has_function_privilege('authenticated', 'public.my_away_note()', 'EXECUTE')::text || ' ' || has_function_privilege('anon', 'public.my_away_note()', 'EXECUTE')::text)
), 'true false');
SELECT away.same('the alert needs a day', (
  SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'away_notes_alert_needs_day') THEN 'held' ELSE 'missing' END
), 'held');

-- The service role writes Ava's note (the away-note function's hand).
INSERT INTO public.away_notes (user_id, words, countdown_ymd, show_where, show_call, alert_on_day, created_by)
  VALUES ('00000000-0000-0000-0000-00000256b0a1', 'Ava, your spot is waiting.', '2029-11-05', true, true, false, '00000000-0000-0000-0000-00000256b0a2');

-- Ben, a dev: reads the row, writes none under RLS (no write policy for anyone).
SET ROLE authenticated;
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a2');
SELECT away.same('Ben reads the note', (SELECT words FROM public.away_notes WHERE user_id = '00000000-0000-0000-0000-00000256b0a1'), 'Ava, your spot is waiting.');
SELECT away.same('Ben cannot write a note by hand', away.try_insert('00000000-0000-0000-0000-00000256b0a4'), '42501');
SELECT away.same('Ben, active, gets no Away note of his own', coalesce(public.my_away_note()::text, 'null'), 'null');
-- Cal, a controller: reads too.
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a3');
SELECT away.same('Cal reads the note', (SELECT count(*)::text FROM public.away_notes), '1');
-- Hal, a helper: reads nothing.
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a4');
SELECT away.same('Hal reads no note', (SELECT count(*)::text FROM public.away_notes), '0');

-- Ava, archived with a note: the RPC answers her screen; the gate passes her to it alone.
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a1');
SELECT away.same('Ava is archived', public.caller_is_archived()::text, 'true');
SELECT away.same('the gate passes Ava to the note', away.gate('/rpc/my_away_note'), 'passes');
SELECT away.same('the gate refuses Ava on the table', away.gate('/away_notes'), 'PT403');
SELECT away.same('Ava reads no row of the table itself', (SELECT count(*)::text FROM public.away_notes), '0');
SELECT away.same('Ava gets her note', (
  SELECT n->>'first_name' || ' | ' || (n->>'words') || ' | ' || (n->>'countdown_ymd') || ' | ' || (n->>'show_where') || ' | ' || (n->>'show_call') || ' | ' || (n->>'left_ymd') || ' | ' || (n->>'office_phone') || ' | ' || ((n->>'office_address')::jsonb->>'address')
  FROM public.my_away_note() n
), 'Ava | Ava, your spot is waiting. | 2029-11-05 | true | true | 2026-11-03 | (512) 555-0142 | 12925 FM 20, Kingsbury, TX 78638');
SELECT away.same('the updated day is today', (SELECT (public.my_away_note()->>'updated_ymd') = (now() AT TIME ZONE 'America/Chicago')::date::text), 'true');
RESET ROLE;

-- The note taken down (restore-user's hand, or away-note clear): Ava gets null.
DELETE FROM public.away_notes WHERE user_id = '00000000-0000-0000-0000-00000256b0a1';
SET ROLE authenticated;
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a1');
SELECT away.same('Ava with no note gets null', coalesce(public.my_away_note()::text, 'null'), 'null');
RESET ROLE;

-- The day she left falls back to the archive day when the roster row has no end date.
UPDATE public.people SET end_date = NULL WHERE id = '00000000-0000-0000-0000-00000256b0b1';
INSERT INTO public.away_notes (user_id, words) VALUES ('00000000-0000-0000-0000-00000256b0a1', 'Short note.');
SET ROLE authenticated;
SELECT away.sign_in('00000000-0000-0000-0000-00000256b0a1');
SELECT away.same('with no end date the day left is the archive day', (SELECT public.my_away_note()->>'left_ymd'), '2026-11-04');
RESET ROLE;

-- The alert without a day is refused by the table itself.
DO $$
BEGIN
  UPDATE public.away_notes SET alert_on_day = true WHERE user_id = '00000000-0000-0000-0000-00000256b0a1';
  RAISE EXCEPTION 'the alert with no day was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'ok: the alert with no day is refused';
END $$;

SELECT 'away_notes PASSED';
ROLLBACK;
