-- A one-word shortcut per quick reply (punch list #126 C, migration *_quick_replies_shortcut): the office sets,
-- repeats and clears a line's word through set_quick_reply_shortcut, a leading / and the case forgiven, one shortcut
-- version a change; a word another live team line holds is refused, and so is one of a person's own other lines,
-- while two people's own lines and a team line may share a word; a bad word, someone else's own line, a removed line,
-- a primary, a training account and a direct write are refused; a removed line frees its word, and brought back after
-- another line took it, it comes back without it; the unique indexes and the word's check hold below the functions.
-- Everything rolls back. Raises on the first failed assertion; ends with "quick_replies_shortcut PASSED". See
-- scripts/pgtest-quick-replies-shortcut.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (Rosa, an assistant; Ana, a controller), Luis (primary) in the field, and an assistant in training mode.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e3a01', 'rosa@shortcut.test'),
  ('00000000-0000-0000-0000-0000000e3a02', 'ana@shortcut.test'),
  ('00000000-0000-0000-0000-0000000e3a03', 'luis@shortcut.test'),
  ('00000000-0000-0000-0000-0000000e3a04', 'training@shortcut.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e3a01', 'rosa@shortcut.test', 'Shortcut Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e3a02', 'ana@shortcut.test', 'Shortcut Ana', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000e3a03', 'luis@shortcut.test', 'Shortcut Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e3a04', 'training@shortcut.test', 'Shortcut Training', 'assistant', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- v2.6064's migration (20261029200000_quick_replies_starter) seeds the eleven starter lines with their shortcuts, among
-- them /bill and /late, the words this bed gives its own lines. The eleven are set aside here (the quick-replies-starter
-- bed holds them); the transaction rolls back.
DELETE FROM public.quick_reply_versions WHERE quick_reply_id IN (SELECT id FROM public.quick_replies WHERE added_by IS NULL AND shortcut IS NOT NULL);
DELETE FROM public.quick_replies WHERE added_by IS NULL AND shortcut IS NOT NULL;

-- The lines. Made-up words. b1, b2 and b5 are the team's; b3 and b6 are Rosa's own; b4 is Ana's own.
INSERT INTO public.quick_replies (id, text, for_kind, step_key, scope, added_by) VALUES
  ('00000000-0000-0000-0000-0000000e3b01', '{first}, here is your bill for {job}. You can pay it here: {bill}', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e3a01'),
  ('00000000-0000-0000-0000-0000000e3b02', '{first}, we are running behind. The new window is {window}.', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e3a01'),
  ('00000000-0000-0000-0000-0000000e3b03', '{first}, Rosa here. I will call you after lunch.', 'customer', NULL, 'mine', '00000000-0000-0000-0000-0000000e3a01'),
  ('00000000-0000-0000-0000-0000000e3b04', '{first}, Ana here. Your statement is attached.', 'customer', NULL, 'mine', '00000000-0000-0000-0000-0000000e3a02'),
  ('00000000-0000-0000-0000-0000000e3b05', '{first}, here is a copy of your last bill: {bill}', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e3a01'),
  ('00000000-0000-0000-0000-0000000e3b06', '{first}, Rosa again. Running a little behind.', 'customer', NULL, 'mine', '00000000-0000-0000-0000-0000000e3a01');

CREATE SCHEMA qrs;
CREATE FUNCTION qrs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION qrs.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION qrs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Set a line's word as the signed-in person: the function's count, as text.
CREATE FUNCTION qrs.set(p_line text, p_word text) RETURNS text LANGUAGE sql AS $$
  SELECT public.set_quick_reply_shortcut(('00000000-0000-0000-0000-0000000e3b0' || p_line)::uuid, p_word)::text
$$;
-- Every bed line's word, "b1 bill, b2 -", and one line's history, "shortcut -> bill, removed".
CREATE VIEW qrs.words AS
  SELECT string_agg('b' || right(q.id::text, 1) || ' ' || coalesce(q.shortcut, '-'), ', ' ORDER BY q.id) AS seen
  FROM public.quick_replies q WHERE q.id::text LIKE '00000000-0000-0000-0000-0000000e3b%';
CREATE FUNCTION qrs.history(p_line text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(v.kind || CASE WHEN v.kind = 'shortcut' THEN ' ' || coalesce(v.from_text, '-') || ' -> ' || coalesce(v.to_text, '-') ELSE '' END, ', ' ORDER BY v.id), 'none')
  FROM public.quick_reply_versions v WHERE v.quick_reply_id = ('00000000-0000-0000-0000-0000000e3b0' || p_line)::uuid
$$;
GRANT USAGE ON SCHEMA qrs TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qrs TO anon, authenticated, service_role;
GRANT SELECT ON qrs.words TO authenticated;

-- 1 · Rosa gives the bill line its word: the slash and the capital forgiven, one version.
SET LOCAL ROLE authenticated;
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a01');
SELECT qrs.same('the office sets a word, a leading / and the case forgiven', qrs.set('1', '/Bill'), '1');
SELECT qrs.same('the same word again changes nothing', qrs.set('1', 'bill'), '0');
SELECT qrs.same('one shortcut version, from none to the word', qrs.history('1'), 'shortcut - -> bill');

-- 2 · A team line's word is the team's.
SELECT qrs.refused('another team line cannot take a team line''s word', $q$SELECT qrs.set('2', 'bill')$q$, '/bill is another line''s shortcut.');
SELECT qrs.refused('a line of one''s own cannot take a team line''s word', $q$SELECT qrs.set('3', 'bill')$q$, '/bill is another line''s shortcut.');

-- 3 · Own lines: one word each among a person's own, and a team line may share one with them.
SELECT qrs.same('Rosa gives her own line a word', qrs.set('3', 'late'), '1');
SELECT qrs.refused('not twice among her own lines', $q$SELECT qrs.set('6', 'late')$q$, '/late is another line''s shortcut.');
SELECT qrs.same('a team line may share a word with someone''s own line', qrs.set('2', 'late'), '1');
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a02');
SELECT qrs.refused('Ana cannot take a team line''s word for her own line', $q$SELECT qrs.set('4', 'late')$q$, '/late is another line''s shortcut.');
SELECT qrs.same('Ana gives her own line a word Rosa''s own line holds', qrs.set('4', 'call'), '1');
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a01');
SELECT qrs.same('Rosa''s other own line takes the same word as Ana''s', qrs.set('6', 'call'), '1');

-- 4 · Refusals in the function's words.
SELECT qrs.refused('two words are not a shortcut', $q$SELECT qrs.set('5', 'two words')$q$, 'A shortcut is one word');
SELECT qrs.refused('a word past 24 characters', $q$SELECT qrs.set('5', 'abcdefghijklmnopqrstuvwxy')$q$, 'A shortcut is one word');
SELECT qrs.refused('a word that starts with a dash', $q$SELECT qrs.set('5', '-bill')$q$, 'A shortcut is one word');
SELECT qrs.refused('someone else''s own line is not there for Rosa', $q$SELECT qrs.set('4', 'mine')$q$, 'That line is not there.');
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a03');
SELECT qrs.refused('a primary is off the office', $q$SELECT qrs.set('5', 'copy')$q$, 'Only the office can change a quick reply.');
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a04');
SELECT qrs.refused('a training account cannot', $q$SELECT qrs.set('5', 'copy')$q$, 'A training account cannot change a quick reply.');
SELECT qrs.as_user('00000000-0000-0000-0000-0000000e3a01');
SELECT qrs.refused('nobody writes the word past the function', $q$UPDATE public.quick_replies SET shortcut = 'copy' WHERE id = '00000000-0000-0000-0000-0000000e3b05'$q$, 'permission denied');

-- 5 · Clearing, a removed line freeing its word, and the line brought back without it.
SELECT qrs.same('a blank clears the word', qrs.set('1', ''), '1');
SELECT qrs.same('the word set again', qrs.set('1', 'bill'), '1');
SELECT public.remove_quick_reply('00000000-0000-0000-0000-0000000e3b01');
SELECT qrs.refused('a removed line''s word is not changed', $q$SELECT qrs.set('1', 'paid')$q$, 'Bring the line back before you change it.');
SELECT qrs.same('a removed line frees its word for another team line', qrs.set('5', 'bill'), '1');
SELECT public.restore_quick_reply('00000000-0000-0000-0000-0000000e3b01');
SELECT qrs.same('the words after it all', (SELECT seen FROM qrs.words), 'b1 -, b2 late, b3 late, b4 call, b5 bill, b6 call');
SELECT qrs.same('brought back without the word another line took, and the history says so',
  qrs.history('1'), 'shortcut - -> bill, shortcut bill -> -, shortcut - -> bill, removed, shortcut bill -> -, restored');
SELECT public.remove_quick_reply('00000000-0000-0000-0000-0000000e3b02');
SELECT public.restore_quick_reply('00000000-0000-0000-0000-0000000e3b02');
SELECT qrs.same('a line brought back whose word is free keeps it', (SELECT shortcut FROM public.quick_replies WHERE id = '00000000-0000-0000-0000-0000000e3b02'), 'late');

-- 6 · Below the functions: one live team line a word, one of a person's own a word among theirs, and the word's shape.
RESET ROLE;
SELECT qrs.refused('the team index holds', $q$INSERT INTO public.quick_replies (text, for_kind, scope, added_by, shortcut) VALUES ('x', 'customer', 'team', '00000000-0000-0000-0000-0000000e3a01', 'bill')$q$, 'quick_replies_shortcut_team_one');
SELECT qrs.refused('the own-lines index holds', $q$INSERT INTO public.quick_replies (text, for_kind, scope, added_by, shortcut) VALUES ('x', 'customer', 'mine', '00000000-0000-0000-0000-0000000e3a01', 'late')$q$, 'quick_replies_shortcut_mine_one');
SELECT qrs.refused('the word''s check holds', $q$UPDATE public.quick_replies SET shortcut = 'Bill' WHERE id = '00000000-0000-0000-0000-0000000e3b03'$q$, 'quick_replies_shortcut_word');
SELECT qrs.refused('a shortcut version keeps a word on one side', $q$INSERT INTO public.quick_reply_versions (quick_reply_id, kind) VALUES ('00000000-0000-0000-0000-0000000e3b03', 'shortcut')$q$, 'quick_reply_versions_kept');

DO $$ BEGIN RAISE NOTICE 'quick_replies_shortcut PASSED'; END $$;
ROLLBACK;
