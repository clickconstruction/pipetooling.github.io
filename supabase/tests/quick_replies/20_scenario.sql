-- Messages, cut 3 (migration *_quick_replies): the lines the office types every day. The migration's seed adds the
-- prototype's team lines once and nothing the second time. Rosa adds a line and changes its words, then Maria changes
-- its tags: two versions, each with who. A press in Priya's thread counts, and the team reads it. A removed line keeps
-- its history and comes back. A line marked mine stays Rosa's. Each refusal comes back in words; a superintendent, a
-- training account, a digital twin and someone signed out are refused, and nobody writes the tables by hand. Rosa sets
-- the title under Rosa's signature, and a fold moves a press with the person. Then R3 (*_quick_replies_phone_es): the
-- Spanish and the phone's place in one Save, each with its version, a Save with four arguments keeping both, and a sent
-- text letting go of a deleted line. The fixture is made as postgres,
-- standing in for the seed; the presses run as each user through RLS; everything rolls back. Raises on the first
-- failed assertion; ends with "quick_replies PASSED". See scripts/pgtest-quick-replies.sh. Never against prod.
\set ON_ERROR_STOP 1
\set rosa '00000000-0000-0000-0000-00000000a3d1'
\set maria '00000000-0000-0000-0000-00000000a3d2'
\set wendi '00000000-0000-0000-0000-00000000a3d3'
\set training '00000000-0000-0000-0000-00000000a3d4'
\set twin '00000000-0000-0000-0000-00000000a3d5'
\set dev '00000000-0000-0000-0000-00000000a3d6'
\set priya '00000000-0000-0000-0000-00000000a3e1'
\set priya2 '00000000-0000-0000-0000-00000000a3e2'
\set desk '00000000-0000-0000-0000-00000000a3e3'
BEGIN;

-- Rosa in the office (an assistant), Maria on the money team (the controller, in the office too), a superintendent
-- outside the office, an assistant in training mode, a digital twin, and a dev who keeps the customer.
INSERT INTO auth.users (id, email) VALUES
  (:'rosa', 'rosa@qr.test'), (:'maria', 'maria@qr.test'), (:'wendi', 'super@qr.test'),
  (:'training', 'training@qr.test'), (:'twin', 'twin@qr.test'), (:'dev', 'dev@qr.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (:'rosa', 'rosa@qr.test', 'Rosa', 'assistant', false, false),
  (:'maria', 'maria@qr.test', 'Maria', 'controller', false, false),
  (:'wendi', 'super@qr.test', 'Wendi', 'superintendent', false, false),
  (:'training', 'training@qr.test', 'Training', 'assistant', true, false),
  (:'twin', 'twin@qr.test', 'Twin', 'estimator', false, true),
  (:'dev', 'dev@qr.test', 'Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Helotes Dental Office, with Priya, the customer's other Priya, and the front desk, for the presses and the fold.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00000000a3c1', 'Helotes Dental Office', :'dev');
INSERT INTO public.contacts (id, kind, customer_id, name) VALUES
  (:'priya', 'customer', '00000000-0000-0000-0000-00000000a3c1', 'Dr. Priya Raman'),
  (:'priya2', 'customer', '00000000-0000-0000-0000-00000000a3c1', 'Priya Raman'),
  (:'desk', 'customer', '00000000-0000-0000-0000-00000000a3c1', 'Front desk');

CREATE SCHEMA qr;
CREATE FUNCTION qr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION qr.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION qr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- Signed in as no one: the role's claims with no user in them.
CREATE FUNCTION qr.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
GRANT USAGE ON SCHEMA qr TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qr TO anon, authenticated;

-- 0 · The migration ran twice: its seed added the prototype's thirteen team lines that read for any job, once, as the
-- app's, each with the version it was added with, in the prototype's words and tags. The three that name a demo job
-- are not among them.
SELECT qr.same('the thirteen team lines, once, as the app''s',
  (SELECT count(*) || ':' || count(*) FILTER (WHERE scope = 'team' AND added_by IS NULL AND removed_at IS NULL) FROM public.quick_replies),
  '13:13');
SELECT qr.same('each with the version it was added with, by the app',
  (SELECT count(*) || ':' || count(*) FILTER (WHERE kind = 'added' AND by_user_id IS NULL) FROM public.quick_reply_versions), '13:13');
SELECT qr.same('the prototype''s tags, and a line for anyone on no step',
  (SELECT string_agg(for_kind || '/' || coalesce(step_key, '-'), ',' ORDER BY text) FROM public.quick_replies
   WHERE text IN ('Checking on the number. Still good for today?', 'Got it, thank you.',
                  'The site is open from 7. Check in with the super when you arrive.')),
  'trade/ask,any/-,trade/-');
SELECT qr.same('none of the three that name a demo job',
  (SELECT count(*)::text FROM public.quick_replies
   WHERE text IN ('Understood. You will have it by 9 AM Thursday.', 'Addendum 2 is in the portal; the pond is in sitework.',
                  'Pay application 3 is in for your certificate.')),
  '0');
SELECT qr.same('a third run adds nothing', public.quick_replies_seed()::text, '0');

-- 1 · Who reads the team's lines: the office.
SET LOCAL ROLE authenticated;
SELECT qr.as_user(:'rosa');
SELECT qr.same('Rosa reads the team''s thirteen', (SELECT count(*)::text FROM public.quick_replies), '13');
SELECT qr.refused('the seed is the database''s', $q$SELECT public.quick_replies_seed()$q$, 'permission denied');
SELECT qr.as_user(:'wendi');
SELECT qr.same('the superintendent reads no line', (SELECT count(*)::text FROM public.quick_replies), '0');

-- 2 · Rosa adds a line for the team, and the prototype's late line as one of Rosa's own, which stays Rosa's.
SELECT qr.as_user(:'rosa');
SELECT public.add_quick_reply('The insurance certificate came through, thank you.', 'trade', 'papers') AS line \gset
SELECT qr.same('a line for the team, with the version it was added with, by Rosa',
  (SELECT q.scope || ':' || q.for_kind || ':' || q.step_key || ':' || (q.added_by = :'rosa') || ' / '
       || v.kind || ':' || v.to_text || ':' || v.to_for_kind || ':' || v.to_step_key || ':' || (v.by_user_id = :'rosa')
   FROM public.quick_replies q JOIN public.quick_reply_versions v ON v.quick_reply_id = q.id WHERE q.id = :'line'),
  'team:trade:papers:true / added:The insurance certificate came through, thank you.:trade:papers:true');
SELECT public.add_quick_reply('  Running about 20 minutes late, sorry.  ', 'any', 'papers', true) AS mine \gset
SELECT qr.same('one of Rosa''s own, for anyone so on no step, its words trimmed',
  (SELECT scope || ':' || for_kind || ':' || coalesce(step_key, '-') || ':' || text FROM public.quick_replies WHERE id = :'mine'),
  'mine:any:-:Running about 20 minutes late, sorry.');
SELECT qr.same('Rosa reads fifteen lines', (SELECT count(*)::text FROM public.quick_replies), '15');
SELECT qr.as_user(:'maria');
SELECT qr.same('Maria reads fourteen, and not Rosa''s own', (SELECT count(*)::text FROM public.quick_replies), '14');
SELECT qr.same('nor its version', (SELECT count(*)::text FROM public.quick_reply_versions), '14');
SELECT qr.as_user(:'rosa');
SELECT qr.refused('a blank line', $q$SELECT public.add_quick_reply('   ', 'trade', NULL)$q$, 'Write the line first.');
SELECT qr.refused('a line for no one we know', $q$SELECT public.add_quick_reply('Hello', 'vendor', NULL)$q$, 'Say who the line is for');
SELECT qr.refused('a step that is no step''s id', $q$SELECT public.add_quick_reply('Hello', 'trade', 'Asked to quote')$q$, 'Pick the step from the flow.');
SELECT qr.refused('a line past 1,000 characters', $q$SELECT public.add_quick_reply(repeat('a', 1001), 'trade', NULL)$q$, '1,000 characters at most');

-- 3 · Rosa changes its words, then Maria its tags: one version each, with who.
SELECT qr.same('Rosa changes the words: one version',
  public.edit_quick_reply(:'line', 'The insurance certificate is here, thank you.', 'trade', 'papers')::text, '1');
SELECT qr.as_user(:'maria');
SELECT qr.same('Maria changes the tags: one version',
  public.edit_quick_reply(:'line', 'The insurance certificate is here, thank you.', 'customer', 'contract')::text, '1');
SELECT qr.same('the two versions, in order, each with who and what it was before',
  (SELECT string_agg(v.kind || ' by ' || CASE v.by_user_id WHEN :'rosa' THEN 'Rosa' WHEN :'maria' THEN 'Maria' ELSE '?' END || ': '
       || CASE v.kind WHEN 'words' THEN v.from_text || ' > ' || v.to_text
            ELSE v.from_for_kind || '/' || coalesce(v.from_step_key, '-') || ' > ' || v.to_for_kind || '/' || coalesce(v.to_step_key, '-') END,
       ' | ' ORDER BY v.id)
   FROM public.quick_reply_versions v WHERE v.quick_reply_id = :'line' AND v.kind IN ('words', 'tags')),
  'words by Rosa: The insurance certificate came through, thank you. > The insurance certificate is here, thank you. | tags by Maria: trade/papers > customer/contract');
SELECT qr.same('words and tags in one save: two versions',
  public.edit_quick_reply(:'line', 'The certificate is here, thank you.', 'trade', 'papers')::text, '2');
SELECT qr.same('read back in the order written, the words first',
  (SELECT string_agg(kind, ',' ORDER BY id) FROM public.quick_reply_versions WHERE quick_reply_id = :'line'), 'added,words,tags,words,tags');
SELECT qr.same('the line holds the last words and tags',
  (SELECT text || ':' || for_kind || ':' || step_key FROM public.quick_replies WHERE id = :'line'), 'The certificate is here, thank you.:trade:papers');
SELECT qr.refused('nothing changed',
  format($q$SELECT public.edit_quick_reply(%L, 'The certificate is here, thank you.', 'trade', 'papers')$q$, :'line'), 'Nothing changed.');
SELECT qr.refused('a blank save', format($q$SELECT public.edit_quick_reply(%L, ' ', 'trade', 'papers')$q$, :'line'), 'Write something, or Cancel.');
SELECT qr.refused('Maria changes Rosa''s own line', format($q$SELECT public.edit_quick_reply(%L, 'Mine now', 'any', NULL)$q$, :'mine'),
  'That line is not there.');

-- 4 · Rosa presses it in Priya's thread and once outside a thread, and presses Rosa's own; the team reads the presses
-- on the team's line.
SELECT qr.as_user(:'rosa');
SELECT public.press_quick_reply(:'line', :'priya');
SELECT public.press_quick_reply(:'line');
SELECT public.press_quick_reply(:'mine', :'priya');
SELECT qr.as_user(:'maria');
SELECT qr.same('Maria reads Rosa''s two presses on the team''s line, one in Priya''s thread',
  (SELECT count(*) || ':' || count(*) FILTER (WHERE user_id = :'rosa') || ':' || count(*) FILTER (WHERE contact_id = :'priya')
   FROM public.quick_reply_uses WHERE quick_reply_id = :'line'),
  '2:2:1');
SELECT qr.same('and none on Rosa''s own line', (SELECT count(*)::text FROM public.quick_reply_uses WHERE quick_reply_id = :'mine'), '0');
SELECT qr.refused('Maria presses Rosa''s own line', format($q$SELECT public.press_quick_reply(%L)$q$, :'mine'), 'That line is not there.');
SELECT qr.refused('a press in a thread that is not there',
  format($q$SELECT public.press_quick_reply(%L, '00000000-0000-0000-0000-00000000a3ff')$q$, :'line'), 'That person is not there.');

-- 5 · Rosa removes it: off the list, still in the history. Maria brings it back.
SELECT qr.as_user(:'rosa');
SELECT public.remove_quick_reply(:'line');
SELECT qr.same('removed, it stays, with a removed version by Rosa',
  (SELECT (q.removed_at IS NOT NULL) || ':' || v.kind || ':' || (v.by_user_id = :'rosa')
   FROM public.quick_replies q JOIN public.quick_reply_versions v ON v.quick_reply_id = q.id
   WHERE q.id = :'line' ORDER BY v.id DESC LIMIT 1),
  'true:removed:true');
SELECT qr.refused('removed twice', format($q$SELECT public.remove_quick_reply(%L)$q$, :'line'), 'That line is removed already.');
SELECT qr.refused('a removed line is not changed', format($q$SELECT public.edit_quick_reply(%L, 'Changed', 'trade', NULL)$q$, :'line'),
  'Bring the line back before you change it.');
SELECT qr.refused('nor pressed', format($q$SELECT public.press_quick_reply(%L)$q$, :'line'), 'That line was removed.');
SELECT qr.as_user(:'maria');
SELECT public.restore_quick_reply(:'line');
SELECT qr.refused('brought back twice', format($q$SELECT public.restore_quick_reply(%L)$q$, :'line'), 'That line is on the list already.');
SELECT qr.same('back on the list, its history whole',
  (SELECT (q.removed_at IS NULL) || ':' || (SELECT string_agg(v.kind, ',' ORDER BY v.id) FROM public.quick_reply_versions v WHERE v.quick_reply_id = q.id)
   FROM public.quick_replies q WHERE q.id = :'line'),
  'true:added,words,tags,words,tags,removed,restored');

-- 6 · Outside the office, in training, a twin, signed out: refused in words. Nobody writes the tables by hand, and
-- anon reaches nothing.
SELECT qr.as_user(:'wendi');
SELECT qr.refused('the superintendent adds a line', $q$SELECT public.add_quick_reply('Hello', 'trade', NULL)$q$,
  'Only the office can add a quick reply.');
SELECT qr.refused('or presses one', format($q$SELECT public.press_quick_reply(%L)$q$, :'line'), 'Only the office can use a quick reply.');
SELECT qr.as_user(:'training');
SELECT qr.refused('a training account changes one', format($q$SELECT public.edit_quick_reply(%L, 'Changed', 'trade', NULL)$q$, :'line'),
  'A training account cannot change a quick reply.');
SELECT qr.as_user(:'twin');
SELECT qr.refused('a twin removes one', format($q$SELECT public.remove_quick_reply(%L)$q$, :'line'), 'A digital twin cannot remove a quick reply.');
SELECT qr.signed_out();
SELECT qr.refused('someone signed out brings one back', format($q$SELECT public.restore_quick_reply(%L)$q$, :'line'),
  'Sign in to bring back a quick reply.');
SELECT qr.as_user(:'rosa');
SELECT qr.refused('Rosa writes a line by hand', $q$INSERT INTO public.quick_replies (text, for_kind) VALUES ('By hand', 'any')$q$,
  'permission denied');
SELECT qr.refused('or changes one by hand', format($q$UPDATE public.quick_replies SET text = 'By hand' WHERE id = %L$q$, :'line'), 'permission denied');
SELECT qr.refused('or writes a version', format($q$INSERT INTO public.quick_reply_versions (quick_reply_id, kind) VALUES (%L, 'removed')$q$, :'line'),
  'permission denied');
SELECT qr.refused('or a press', format($q$INSERT INTO public.quick_reply_uses (quick_reply_id) VALUES (%L)$q$, :'line'), 'permission denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT qr.refused('anon calls none of them', $q$SELECT public.add_quick_reply('Hello', 'any', NULL)$q$, 'permission denied');
SELECT qr.refused('and reads no line', $q$SELECT count(*) FROM public.quick_replies$q$, 'permission denied');
RESET ROLE;
SET LOCAL ROLE authenticated;

-- 7 · Rosa sets the title under Rosa's signature; Maria has none.
SELECT qr.as_user(:'rosa');
UPDATE public.users SET title = 'Office manager' WHERE id = :'rosa';
SELECT qr.same('Rosa''s title', (SELECT title FROM public.users WHERE id = :'rosa'), 'Office manager');
SELECT qr.refused('a title past 80 characters', format($q$UPDATE public.users SET title = %L WHERE id = %L$q$, repeat('a', 81), :'rosa'),
  'users_title_short');
SELECT qr.as_user(:'maria');
SELECT qr.same('Maria has no title', (SELECT coalesce(title, '-') FROM public.users WHERE id = :'maria'), '-');

-- 8 · Rosa folds Priya into the customer's other Priya: the presses in Priya's thread follow. Outside a fold, a call
-- from the superintendent moves nothing.
SELECT qr.as_user(:'rosa');
SELECT public.contacts_fold(:'priya', :'priya2');
SELECT qr.same('both of Rosa''s presses in Priya''s thread are in the other Priya''s now',
  (SELECT count(*) FILTER (WHERE contact_id = :'priya2') || ':' || count(*) FILTER (WHERE contact_id IS NULL) FROM public.quick_reply_uses),
  '2:1');
SELECT qr.as_user(:'wendi');
SELECT public.contacts_fold_quick_replies(:'priya2', :'desk');
SELECT qr.as_user(:'rosa');
SELECT qr.same('a call outside a fold, by the superintendent, moves nothing',
  (SELECT count(*)::text FROM public.quick_reply_uses WHERE contact_id = :'priya2'), '2');
RESET ROLE;

-- 9 · R3 (migration *_quick_replies_phone_es): Rosa adds a team line for customers and saves its Spanish and its place
-- on the tech's phone in one Save, an es version and a phone version with the place before and after. A Save with
-- four arguments keeps both. A new name alone is a phone version with no place; a move and a cleared Spanish are two;
-- 0 takes it off the phone. The phone refuses a line kept for one person, a line for trades, a place below 0 and a
-- long name. A line for leads is one of the seven kinds now. Each kind keeps only its own columns. One edit_quick_reply, the signed in's alone. A sent text's
-- quick_reply_id lets go when its line is deleted.
SET LOCAL ROLE authenticated;
SELECT qr.as_user(:'rosa');
SELECT public.add_quick_reply('{first}, we are on our way.', 'customer', NULL) AS onway \gset
SELECT qr.same('the Spanish and the phone in one Save: two versions',
  public.edit_quick_reply(:'onway', '{first}, we are on our way.', 'customer', NULL, '  {first}, vamos en camino. ', 1, 'On our way')::text, '2');
SELECT qr.same('the line holds them, the Spanish trimmed',
  (SELECT text_es || ':' || phone_order || ':' || phone_name FROM public.quick_replies WHERE id = :'onway'),
  '{first}, vamos en camino.:1:On our way');
SELECT qr.same('an es version with the Spanish after, a phone version with the place after, both by Rosa',
  (SELECT string_agg(kind || ':' || coalesce(from_text, '-') || '>' || coalesce(to_text, '-') || ':'
       || coalesce(from_phone_order::text, '-') || '>' || coalesce(to_phone_order::text, '-') || ':' || (by_user_id = :'rosa'), ' | ' ORDER BY id)
   FROM public.quick_reply_versions WHERE quick_reply_id = :'onway' AND kind IN ('es', 'phone')),
  'es:->{first}, vamos en camino.:->-:true | phone:->-:->1:true');
SELECT qr.same('a Save with four arguments changes the words and keeps the Spanish and the phone',
  public.edit_quick_reply(:'onway', '{first}, we are on our way now.', 'customer', NULL)::text, '1');
SELECT qr.same('both kept', (SELECT text_es || ':' || phone_order || ':' || phone_name FROM public.quick_replies WHERE id = :'onway'),
  '{first}, vamos en camino.:1:On our way');
SELECT qr.same('a new name alone: one phone version',
  public.edit_quick_reply(:'onway', '{first}, we are on our way now.', 'customer', NULL, NULL, NULL, 'Heading over')::text, '1');
SELECT qr.same('moved to 3 with the Spanish cleared: two versions',
  public.edit_quick_reply(:'onway', '{first}, we are on our way now.', 'customer', NULL, '   ', 3, NULL)::text, '2');
SELECT qr.same('0 takes it off the phone',
  public.edit_quick_reply(:'onway', '{first}, we are on our way now.', 'customer', NULL, NULL, 0, NULL)::text, '1');
SELECT qr.same('the history: the Spanish set, put on, the name, the Spanish cleared, moved, taken off',
  (SELECT string_agg(CASE kind WHEN 'es' THEN 'es:' || CASE WHEN to_text IS NULL THEN 'cleared' ELSE 'set' END
       ELSE 'phone:' || coalesce(from_phone_order::text, '-') || '>' || coalesce(to_phone_order::text, '-') END, ',' ORDER BY id)
   FROM public.quick_reply_versions WHERE quick_reply_id = :'onway' AND kind IN ('es', 'phone')),
  'es:set,phone:->1,phone:->-,es:cleared,phone:1>3,phone:3>-');
SELECT qr.same('the line is off the phone, its name kept, no Spanish',
  (SELECT coalesce(text_es, '-') || ':' || coalesce(phone_order::text, '-') || ':' || phone_name FROM public.quick_replies WHERE id = :'onway'),
  '-:-:Heading over');
SELECT qr.refused('nothing changed, the three kept',
  format($q$SELECT public.edit_quick_reply(%L, '{first}, we are on our way now.', 'customer', NULL)$q$, :'onway'), 'Nothing changed.');
SELECT qr.refused('the phone on a line kept for Rosa',
  format($q$SELECT public.edit_quick_reply(%L, 'Running about 20 minutes late, sorry.', 'customer', NULL, NULL, 2, NULL)$q$, :'mine'),
  'Only the team''s lines for customers go on the phone.');
SELECT qr.refused('the phone on a line for trades',
  format($q$SELECT public.edit_quick_reply(%L, 'The certificate is here, thank you.', 'trade', 'papers', NULL, 2, NULL)$q$, :'line'),
  'Only the team''s lines for customers go on the phone.');
SELECT qr.refused('a place below 0',
  format($q$SELECT public.edit_quick_reply(%L, '{first}, we are on our way now.', 'customer', NULL, NULL, -1, NULL)$q$, :'onway'),
  'Put the line on the phone at 1 or later');
SELECT qr.refused('a name past 60 characters',
  format($q$SELECT public.edit_quick_reply(%L, '{first}, we are on our way now.', 'customer', NULL, NULL, NULL, %L)$q$, :'onway', repeat('a', 61)),
  '60 characters at most');
SELECT public.add_quick_reply('Thanks for asking about the estimate. We will call you today.', 'lead', NULL) AS lead \gset
SELECT qr.same('a line for leads, one of the seven kinds',
  (SELECT q.for_kind || ':' || v.kind || ':' || v.to_for_kind FROM public.quick_replies q
   JOIN public.quick_reply_versions v ON v.quick_reply_id = q.id WHERE q.id = :'lead'),
  'lead:added:lead');
SELECT qr.same('its tags to subs: one version',
  public.edit_quick_reply(:'lead', 'Thanks for asking about the estimate. We will call you today.', 'sub', NULL)::text, '1');
SELECT qr.same('the tags version from leads to subs',
  (SELECT from_for_kind || '>' || to_for_kind FROM public.quick_reply_versions WHERE quick_reply_id = :'lead' AND kind = 'tags'), 'lead>sub');
SELECT qr.refused('a line for vendors is still no kind',
  $q$SELECT public.add_quick_reply('Hello', 'vendor', NULL)$q$, 'supply houses, candidates or anyone');
RESET ROLE;
SELECT qr.same('one edit_quick_reply, with the three trailing parameters, the signed in''s and never anon''s',
  (SELECT count(*) || ':' || string_agg(oidvectortypes(p.proargtypes), ';') FROM pg_proc p
   WHERE p.proname = 'edit_quick_reply' AND p.pronamespace = 'public'::regnamespace)
  || ':' || has_function_privilege('authenticated', 'public.edit_quick_reply(uuid, text, text, text, text, integer, text)', 'EXECUTE')
  || ':' || has_function_privilege('anon', 'public.edit_quick_reply(uuid, text, text, text, text, integer, text)', 'EXECUTE'),
  '1:uuid, text, text, text, text, integer, text:true:false');
SELECT qr.refused('a phone version keeps no words',
  format($q$INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text) VALUES (%L, 'phone', 'x')$q$, :'onway'), 'quick_reply_versions_kept');
SELECT qr.refused('and only a phone version keeps a place',
  format($q$INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text, to_phone_order) VALUES (%L, 'words', 'a', 'b', 2)$q$, :'onway'),
  'quick_reply_versions_kept');
SELECT qr.refused('an es version that changes nothing',
  format($q$INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text) VALUES (%L, 'es', 'hola', 'hola')$q$, :'onway'),
  'quick_reply_versions_kept');
SELECT qr.refused('a line at place 0, written by hand as the database',
  format($q$UPDATE public.quick_replies SET phone_order = 0 WHERE id = %L$q$, :'onway'), 'quick_replies_phone_order_counts');
INSERT INTO public.messages (contact_id, channel, direction, body, quick_reply_id)
  VALUES (:'priya2', 'text', 'out', 'Priya, we are on our way now.', :'onway') RETURNING id AS sent \gset
DELETE FROM public.quick_replies WHERE id = :'onway';
SELECT qr.same('the sent text stays, and lets go of its deleted line',
  (SELECT coalesce(quick_reply_id::text, '-') || ':' || body FROM public.messages WHERE id = :'sent'), '-:Priya, we are on our way now.');

DO $$ BEGIN RAISE NOTICE 'quick_replies PASSED'; END $$;
ROLLBACK;
