-- The starter quick replies (punch list #126 PR 4): the eleven seeded once, the office's read, the seed's door, the
-- skips when the office already has a line's words, its shortcut or its step, and a removed line left removed. Runs
-- as each person through RLS; everything inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "quick_replies_starter PASSED". See scripts/pgtest-quick-replies-starter.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000126e1', 'assistant@starter.test'),
  ('00000000-0000-0000-0000-0000000126e2', 'helper@starter.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000126e1', 'assistant@starter.test', 'Starter Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000126e2', 'helper@starter.test', 'Starter Helper', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

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
-- The live lines with a shortcut as one line: "shortcut:step:kind:scope:the app's", in shortcut order.
CREATE FUNCTION tt.starters() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(q.shortcut || ':' || COALESCE(q.step_key, '-') || ':' || q.for_kind || ':' || q.scope || ':' || (q.added_by IS NULL)::text, ',' ORDER BY q.shortcut), '(none)')
  FROM public.quick_replies q WHERE q.shortcut IS NOT NULL AND q.removed_at IS NULL $$;
-- A line's versions in order, a ! after one somebody wrote.
CREATE FUNCTION tt.versions_of(p_shortcut text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(v.kind || CASE WHEN v.by_user_id IS NULL THEN '' ELSE '!' END, ',' ORDER BY v.id), '(none)')
  FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id
  WHERE q.shortcut = p_shortcut AND q.removed_at IS NULL $$;
-- The live team line for customers on a step, or none.
CREATE FUNCTION tt.step_line(p_step text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(q.text, ' | ' ORDER BY q.added_at), '(none)')
  FROM public.quick_replies q WHERE q.step_key = p_step AND q.for_kind = 'customer' AND q.scope = 'team' AND q.removed_at IS NULL $$;
GRANT USAGE ON SCHEMA tt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tt TO authenticated, anon;

-- Sign in as one person for the statements that follow, through RLS.
CREATE FUNCTION tt.as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
         set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $$;
GRANT EXECUTE ON FUNCTION tt.as_user(uuid) TO authenticated, anon;

-- 0 · The seed, once: the bed applied the migration twice, and the eleven are there once each, team, for customers,
--     the app's own, with their shortcuts, the three on their steps, each with its added and shortcut versions by
--     nobody, no Spanish, none on the phone. The prototype's lines and the two phone lines are untouched.
SELECT tt.same('the eleven starter lines, once each', tt.starters(),
  'access:-:customer:team:true,back:-:customer:team:true,bill:-:customer:team:true,estimate:approved:customer:team:true,found:found:customer:team:true,gotit:-:customer:team:true,late:-:customer:team:true,paid:-:customer:team:true,photo:-:customer:team:true,remind:paid:customer:team:true,thanks:-:customer:team:true');
SELECT tt.same('the words as the owner wrote them',
  (SELECT q.text FROM public.quick_replies q WHERE q.shortcut = 'gotit'),
  '{first}, this is {me} with Click Plumbing. We got your message and will call you back today.');
SELECT tt.same('a second push added none', (SELECT count(*)::text FROM public.quick_replies q WHERE q.text LIKE '{first}, we are running behind.%'), '1');
SELECT tt.same('each line has its added and shortcut versions, by nobody', tt.versions_of('remind'), 'added,shortcut');
SELECT tt.same('the shortcut version goes from none to the word',
  (SELECT (v.from_text IS NULL)::text || ' ' || v.to_text FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id WHERE q.shortcut = 'bill' AND v.kind = 'shortcut'),
  'true bill');
SELECT tt.same('the added version keeps the step', (SELECT v.to_step_key FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id WHERE q.shortcut = 'found' AND v.kind = 'added'), 'found');
SELECT tt.same('no Spanish', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NOT NULL AND q.text_es IS NOT NULL), '0');
SELECT tt.same('none on the phone', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NOT NULL AND (q.phone_order IS NOT NULL OR q.phone_press IS NOT NULL)), '0');
SELECT tt.same('the two phone lines keep their presses', (SELECT string_agg(q.phone_press, ',' ORDER BY q.phone_press) FROM public.quick_replies q WHERE q.phone_press IS NOT NULL AND q.removed_at IS NULL), 'im_here,on_my_way');
SELECT tt.same('the prototype''s thirteen are still there', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NULL AND q.phone_press IS NULL AND q.added_by IS NULL), '13');
SELECT tt.same('What we found reads /found', tt.step_line('found'), '{first}, {tech} found {found}. We will send you a price shortly.');
SELECT tt.same('Approved reads /estimate', tt.step_line('approved'), '{first}, did you get a chance to look at the estimate for {job}? You can open it here: {link}');
SELECT tt.same('Paid reads /remind', tt.step_line('paid'), '{first}, a reminder that {amount} for {job} is still open. You can pay it here: {bill}');
SELECT tt.same('Booked, Working, Done and Billed get no line', tt.step_line('booked') || tt.step_line('working') || tt.step_line('done') || tt.step_line('billed'), '(none)(none)(none)(none)');
SELECT tt.same('a third run adds none', public.quick_replies_seed_starter()::text, '0');

-- 1 · The office reads the eleven through RLS; a helper, off the office team, reads none.
SELECT tt.as_user('00000000-0000-0000-0000-0000000126e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('the office reads the eleven', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NOT NULL), '11');
SELECT tt.same('the office reads their versions', (SELECT count(*)::text FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id WHERE q.shortcut IS NOT NULL), '22');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000126e2');
SET LOCAL ROLE authenticated;
SELECT tt.same('a helper reads none', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NOT NULL), '0');
RESET ROLE;

-- 2 · The seed is the database's own.
SELECT tt.as_user('00000000-0000-0000-0000-0000000126e1');
SET LOCAL ROLE authenticated;
SELECT tt.refused('the office cannot run the seed', $$SELECT public.quick_replies_seed_starter()$$, 'permission denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tt.refused('anon cannot run the seed', $$SELECT public.quick_replies_seed_starter()$$, 'permission denied');
RESET ROLE;

-- 3 · The skips, as the push would meet them: four starter lines taken away, and the office's own lines in the way
--     of three. /gotit's words are on a line of theirs (a capital changed), /late's word is on a line of theirs, and
--     Paid has a team line of theirs. The seed adds back /photo alone.
DELETE FROM public.quick_reply_versions v USING public.quick_replies q WHERE q.id = v.quick_reply_id AND q.shortcut IN ('gotit', 'late', 'remind', 'photo');
DELETE FROM public.quick_replies q WHERE q.shortcut IN ('gotit', 'late', 'remind', 'photo');
SELECT tt.same('four lines taken away', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut IS NOT NULL), '7');
SELECT tt.as_user('00000000-0000-0000-0000-0000000126e1');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE theirs AS SELECT
  public.add_quick_reply('{first}, this is {me} with Click plumbing. We got your message and will call you back today.', 'customer', NULL, false) AS words_id,
  public.add_quick_reply('Running behind, sorry. The new window is {window}.', 'customer', NULL, false) AS late_id,
  public.add_quick_reply('Your bill for {job} is still open. Pay it here: {bill}', 'customer', 'paid', false) AS paid_id;
SELECT public.set_quick_reply_shortcut((SELECT late_id FROM theirs), 'late');
RESET ROLE;
SELECT tt.same('the seed adds back only the line nothing stands in the way of', public.quick_replies_seed_starter()::text, '1');
SELECT tt.same('/photo is back, the app''s own', (SELECT (q.added_by IS NULL)::text FROM public.quick_replies q WHERE q.shortcut = 'photo'), 'true');
SELECT tt.same('the office''s own words keep /gotit out', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut = 'gotit'), '0');
SELECT tt.same('the office''s /late keeps its line', (SELECT q.text FROM public.quick_replies q WHERE q.shortcut = 'late' AND q.removed_at IS NULL), 'Running behind, sorry. The new window is {window}.');
SELECT tt.same('Paid keeps the office''s line', tt.step_line('paid'), 'Your bill for {job} is still open. Pay it here: {bill}');
SELECT tt.same('/remind stays out', (SELECT count(*)::text FROM public.quick_replies q WHERE q.shortcut = 'remind'), '0');
SELECT tt.same('run again, it adds none', public.quick_replies_seed_starter()::text, '0');

-- 4 · A line the office removed stays removed: its words are still on the row.
SELECT tt.as_user('00000000-0000-0000-0000-0000000126e1');
SET LOCAL ROLE authenticated;
SELECT public.remove_quick_reply((SELECT q.id FROM public.quick_replies q WHERE q.shortcut = 'access'));
RESET ROLE;
SELECT tt.same('the seed leaves a removed line removed', public.quick_replies_seed_starter()::text, '0');
SELECT tt.same('/access is off the list', (SELECT (q.removed_at IS NOT NULL)::text FROM public.quick_replies q WHERE q.shortcut = 'access'), 'true');

DO $$ BEGIN RAISE NOTICE 'quick_replies_starter PASSED'; END $$;
ROLLBACK;
