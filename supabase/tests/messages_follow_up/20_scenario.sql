-- Messages, cut 2, Follow up (migration *_messages_follow_up): every press refuses no sign-in, a training account, a
-- digital twin and anyone off the office team in words; a message moves the conversation's state as it lands; who has
-- it and every change to what we owe write a gray line; a snooze runs to the coming Monday and wakes on its day or on
-- their message; what we owe is one open row a person and a team note marks it done; the badge counts each person once;
-- a heard day is written as a kind by who they are, and a plans question goes to the architect; highlights; the fold
-- keeps what we owe and the state; and who reads what. Presses run as each user through RLS; the fixture and the
-- arriving lines are made as postgres, standing in for the seed and the service role; everything rolls back. Raises on
-- the first failed assertion; ends with "messages_follow_up PASSED". See scripts/pgtest-messages-follow-up.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, the owner, an estimator, an assistant), a superintendent outside it, an estimator in training
-- mode, a digital twin, and an archived teammate.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@followup.test'),
  ('00000000-0000-0000-0000-0000000006d2', 'robert@followup.test'),
  ('00000000-0000-0000-0000-0000000006d3', 'rosa@followup.test'),
  ('00000000-0000-0000-0000-0000000006d4', 'wendi@followup.test'),
  ('00000000-0000-0000-0000-0000000006d5', 'owner@followup.test'),
  ('00000000-0000-0000-0000-0000000006d6', 'training@followup.test'),
  ('00000000-0000-0000-0000-0000000006d7', 'twin@followup.test'),
  ('00000000-0000-0000-0000-0000000006d8', 'gone@followup.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@followup.test', 'Follow Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000000006d2', 'robert@followup.test', 'Robert', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000000006d3', 'rosa@followup.test', 'Rosa', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000006d4', 'wendi@followup.test', 'Wendi', 'superintendent', false, false, NULL),
  ('00000000-0000-0000-0000-0000000006d5', 'owner@followup.test', 'Owner', 'master_technician', false, false, NULL),
  ('00000000-0000-0000-0000-0000000006d6', 'training@followup.test', 'Trainee', 'estimator', true, false, NULL),
  ('00000000-0000-0000-0000-0000000006d7', 'twin@followup.test', 'Twin', 'estimator', false, true, NULL),
  ('00000000-0000-0000-0000-0000000006d8', 'gone@followup.test', 'Gone', 'estimator', false, false, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A GC project with its customer and the person at it, and a trade partner with its main contact.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000006c1', 'Helotes Dental Office', '00000000-0000-0000-0000-0000000006d1', NULL);
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006c1', 'Dr. Priya Raman', '(210) 555-0144', 'priya@helotesdental.example');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000006f1', 'Follow Clinic', '00000000-0000-0000-0000-0000000006c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000006f1', 'buyout');
INSERT INTO public.gc_companies (id, name, trades, contact_name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Hillside Excavation', ARRAY['Sitework'], 'Greg Paulk', '(210) 555-0113', 'greg@hillside.example');

CREATE SCHEMA mfu;
CREATE FUNCTION mfu.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mfu.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- A statement tried, whatever it says; its writes go with any refusal.
CREATE FUNCTION mfu.tried(stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
-- app_settings' read policy asks auth.role(), which reads the role claim on its own (PostgREST sets both), as the
-- card switch's bed (gc_owner_billing/91_card_switch.sql) says.
CREATE FUNCTION mfu.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mfu.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A conversation as Follow up reads it: the state, the snooze's day, who has it and how.
CREATE FUNCTION mfu.state(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', state, coalesce(snoozed_until::text, '-'),
    CASE WHEN has_user_id IS NULL THEN '-' ELSE public.follow_up_user_name(has_user_id) END, coalesce(has_how, '-'))
  FROM public.contacts WHERE id = p_contact
$$;
-- A thread's gray lines, oldest first.
CREATE FUNCTION mfu.events(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(body, ' / ' ORDER BY at, id), '') FROM public.messages WHERE contact_id = p_contact AND channel = 'event'
$$;
-- What we owe a person, newest first: what, the day, how it got done.
CREATE FUNCTION mfu.owed(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(concat_ws('|', what, coalesce(by_day::text, by_words, '-'), coalesce(done_how, 'open')), ', ' ORDER BY marked_at DESC), '')
  FROM public.contact_owed WHERE contact_id = p_contact
$$;
-- A line arriving or going, as the service role will write it from cut 5.
CREATE FUNCTION mfu.line(p_contact uuid, p_channel text, p_direction text, p_ago interval, p_body text) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.messages (contact_id, channel, direction, at, body) VALUES (p_contact, p_channel, p_direction, now() - p_ago, p_body) RETURNING id
$$;
-- The service role too (v2.5596): the webhook's close is asserted as the role that makes it.
GRANT USAGE ON SCHEMA mfu TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mfu TO anon, authenticated, service_role;

-- The people, as the spine's seed makes them, and a number nobody knows.
SELECT public.messages_seed_contacts();
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-000000006011', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-000000006011', 'phone', '(830) 555-0172');
CREATE TEMP TABLE ids AS SELECT
  (SELECT id FROM public.contacts WHERE gc_company_id = '00000000-0000-0000-0000-0000000006a1') AS greg,
  (SELECT id FROM public.contacts WHERE customer_contact_person_id = '00000000-0000-0000-0000-0000000006e1') AS priya,
  '00000000-0000-0000-0000-000000006011'::uuid AS dee;
GRANT SELECT ON ids TO authenticated, service_role;

-- 1 · Every conversation starts closed, nobody has it, and the badge reads 0.
SELECT mfu.same('every conversation starts closed', (SELECT string_agg(DISTINCT state, ',') FROM public.contacts), 'done');
SELECT mfu.same('the names as the screens show them',
  (SELECT concat_ws(', ', public.contact_display_name(greg), public.contact_display_name(priya), public.contact_display_name(dee)) FROM ids),
  'Greg Paulk, Dr. Priya Raman, (830) 555-0172');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('the badge starts at 0', public.follow_up_count()::text, '0');
RESET ROLE;

-- 2 · Every press refuses, in words, whoever may not press it.
SET LOCAL ROLE anon;
SELECT mfu.refused('signed out, nothing is pressed', $q$SELECT public.take_it(gen_random_uuid())$q$, 'permission denied for function take_it');
SELECT mfu.refused('signed out, nothing is read', $q$SELECT count(*) FROM public.contact_owed$q$, 'permission denied for table contact_owed');
RESET ROLE;
SELECT mfu.signed_out();
SET LOCAL ROLE authenticated;
SELECT mfu.refused('no sign-in takes nothing', $q$SELECT public.take_it(greg) FROM ids$q$, 'Sign in to take a conversation.');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d6');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a training account takes nothing', $q$SELECT public.take_it(greg) FROM ids$q$, 'A training account cannot take a conversation.');
SELECT mfu.refused('a training account hands nothing on', $q$SELECT public.hand_to(greg, NULL) FROM ids$q$, 'A training account cannot hand a conversation on.');
SELECT mfu.refused('a training account snoozes nothing', $q$SELECT public.set_state(greg, 'snoozed') FROM ids$q$, 'A training account cannot reopen, snooze or close a conversation.');
SELECT mfu.refused('a training account marks nothing owed', $q$SELECT public.mark_owed(priya, 'the start date') FROM ids$q$, 'A training account cannot mark what we owe.');
SELECT mfu.refused('a training account marks nothing done', $q$SELECT public.owed_done(priya, 'done') FROM ids$q$, 'A training account cannot mark what we owe done.');
SELECT mfu.refused('a training account writes no promise down', $q$SELECT public.write_down(gen_random_uuid(), 'quote')$q$, 'A training account cannot write down a promise.');
SELECT mfu.refused('a training account sends no plans question', $q$SELECT public.read_question(gen_random_uuid(), 'asked')$q$, 'A training account cannot answer a plans question.');
SELECT mfu.refused('a training account writes no note', $q$SELECT public.add_note(priya, 'x') FROM ids$q$, 'A training account cannot write a team note.');
SELECT mfu.refused('a training account brings no note back', $q$SELECT public.set_back_day(gen_random_uuid(), current_date)$q$, 'A training account cannot bring a note back.');
SELECT mfu.refused('a training account clears no note''s day', $q$SELECT public.back_done(gen_random_uuid())$q$, 'A training account cannot clear a note''s day.');
SELECT mfu.refused('a training account highlights nothing', $q$SELECT public.highlight(gen_random_uuid(), 'x')$q$, 'A training account cannot highlight a message.');
SELECT mfu.refused('a training account removes no highlight', $q$SELECT public.unhighlight(gen_random_uuid())$q$, 'A training account cannot remove a highlight.');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d7');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a twin takes nothing', $q$SELECT public.take_it(greg) FROM ids$q$, 'A digital twin cannot take a conversation.');
SELECT mfu.refused('a twin marks nothing owed', $q$SELECT public.mark_owed(priya, 'the start date') FROM ids$q$, 'A digital twin cannot mark what we owe.');
SELECT mfu.refused('a twin writes no promise down', $q$SELECT public.write_down(gen_random_uuid(), 'quote')$q$, 'A digital twin cannot write down a promise.');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('the superintendent takes nothing', $q$SELECT public.take_it(greg) FROM ids$q$, 'Only the office team can take a conversation.');
SELECT mfu.refused('the superintendent marks nothing owed', $q$SELECT public.mark_owed(priya, 'the start date') FROM ids$q$, 'Only the office team can mark what we owe.');
RESET ROLE;

-- 3 · A message moves the state; who has it writes a gray line.
SELECT mfu.line(greg, 'text', 'in', interval '2 hours', 'Is the detention pond in sitework or concrete?') FROM ids;
SELECT mfu.same('their message opens it', (SELECT mfu.state(greg) FROM ids), 'waiting|-|-|-');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT public.take_it(greg) FROM ids;
SELECT public.take_it(greg) FROM ids;
SELECT mfu.same('Robert takes it, once', (SELECT concat_ws(' || ', mfu.state(greg), mfu.events(greg)) FROM ids), 'waiting|-|Robert|took || Robert took Greg Paulk.');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.take_it(greg) FROM ids;
SELECT mfu.refused('a superintendent, outside the office, is handed nothing', $q$SELECT public.hand_to(greg, '00000000-0000-0000-0000-0000000006d4') FROM ids$q$, 'Pick a teammate in the office.');
SELECT public.hand_to(greg, '00000000-0000-0000-0000-0000000006d5') FROM ids;
SELECT mfu.same('handed to the owner', (SELECT mfu.state(greg) FROM ids), 'waiting|-|Owner|handed');
SELECT public.hand_to(greg, NULL) FROM ids;
SELECT mfu.refused('an archived teammate is handed nothing', $q$SELECT public.hand_to(greg, '00000000-0000-0000-0000-0000000006d8') FROM ids$q$, 'Pick a teammate in the office.');
SELECT public.hand_to(dee, '00000000-0000-0000-0000-0000000006d5') FROM ids;
SELECT mfu.same('every change in words',
  (SELECT concat_ws(' || ', mfu.events(greg), mfu.events(dee)) FROM ids),
  'Robert took Greg Paulk. / Rosa took Greg Paulk from Robert. / Rosa handed Greg Paulk to Owner. / Rosa put Greg Paulk back for whoever answers first. || Rosa gave (830) 555-0172 to Owner.');
SELECT public.take_it(greg) FROM ids;
RESET ROLE;
SELECT mfu.line(greg, 'text', 'out', interval '1 hour', 'Concrete. Addendum 2 settles it.') FROM ids;
SELECT mfu.same('our reply closes it and puts it back', (SELECT mfu.state(greg) FROM ids), 'done|-|-|-');
SELECT mfu.line(greg, 'email', 'in', interval '3 hours', 'An older email, read in late.') FROM ids;
SELECT mfu.same('a line older than our reply moves nothing', (SELECT mfu.state(greg) FROM ids), 'done|-|-|-');
SELECT mfu.line(greg, 'text', 'in', interval '30 minutes', 'And the rock clause?') FROM ids;
SELECT mfu.line(greg, 'email', 'out', interval '4 hours', 'An older email of ours.') FROM ids;
SELECT mfu.line(greg, 'event', 'team', interval '20 minutes', 'An event.') FROM ids;
SELECT mfu.same('theirs reopens it; an older line of ours and an event move nothing', (SELECT mfu.state(greg) FROM ids), 'waiting|-|-|-');

-- 4 · Remind me Monday runs to the coming Monday, and wakes on its day or on their message.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('snoozed to the coming Monday',
  (SELECT public.set_state(greg, 'snoozed')::text FROM ids),
  (public.app_today() + (8 - extract(isodow FROM public.app_today())::int))::text);
SELECT mfu.same('a Monday, after today',
  (SELECT concat_ws('|', extract(isodow FROM snoozed_until), (snoozed_until > public.app_today())::text) FROM public.contacts WHERE id = (SELECT greg FROM ids)),
  '1|true');
SELECT mfu.same('a snooze leaves the badge', public.follow_up_count()::text, '0');
RESET ROLE;
UPDATE public.contacts SET snoozed_until = public.app_today() WHERE id = (SELECT greg FROM ids);
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('its day wakes it', public.follow_up_count()::text, '1');
SELECT public.set_state(greg, 'snoozed') FROM ids;
RESET ROLE;
SELECT mfu.line(greg, 'text', 'in', interval '0 minutes', 'One more thing.') FROM ids;
SELECT mfu.same('their message wakes it sooner', (SELECT mfu.state(greg) FROM ids), 'waiting|-|-|-');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT public.take_it(greg) FROM ids;
SELECT public.set_state(greg, 'done') FROM ids;
SELECT mfu.same('No reply needed closes it and puts it back', (SELECT mfu.state(greg) FROM ids), 'done|-|-|-');
SELECT public.set_state(greg, 'waiting') FROM ids;
SELECT mfu.same('Reopen opens it', (SELECT mfu.state(greg) FROM ids), 'waiting|-|-|-');
SELECT mfu.refused('three states only', $q$SELECT public.set_state(greg, 'later') FROM ids$q$, 'A conversation is Open, Snoozed or Done.');
SELECT mfu.refused('no such conversation', $q$SELECT public.take_it(gen_random_uuid())$q$, 'That conversation is not there.');
SELECT mfu.refused('no such message to highlight', $q$SELECT public.highlight(gen_random_uuid(), 'x')$q$, 'That message is not there.');
RESET ROLE;

-- 5 · What we owe: one open row a person, every change a gray line.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.mark_owed(priya, 'the start date', '2026-10-05') FROM ids;
SELECT public.mark_owed(priya, 'a call back', '2026-10-05') FROM ids;
SELECT public.mark_owed(priya, 'a call back', NULL, 'after the award') FROM ids;
SELECT public.mark_owed(priya, 'a call back', NULL, NULL) FROM ids;
SELECT public.mark_owed(priya, 'a call back', NULL, NULL) FROM ids;
SELECT mfu.same('marked, changed and moved, in words; nothing changed writes nothing',
  (SELECT mfu.events(priya) FROM ids),
  'Rosa marked that we owe Dr. Priya Raman the start date by Mon Oct 5. / Rosa changed what we owe Dr. Priya Raman: a call back, not the start date, by Mon Oct 5. / Rosa set the day we owe Dr. Priya Raman a call back to after the award. / Rosa set the day we owe Dr. Priya Raman a call back to no day.');
SELECT mfu.same('one open row', (SELECT mfu.owed(priya) FROM ids), 'a call back|-|open');
SELECT mfu.refused('what comes first', $q$SELECT public.mark_owed(priya, '  ') FROM ids$q$, 'Say what first. The day is optional.');
SELECT mfu.refused('a day is a date or words', $q$SELECT public.mark_owed(priya, 'the plans', '2026-10-05', 'Friday') FROM ids$q$, 'A day is a date or the words typed, not both.');
SELECT public.mark_owed(priya, 'the start date', NULL, 'after the award') FROM ids;
SELECT mfu.same('a day in words is kept as words', (SELECT mfu.owed(priya) FROM ids), 'the start date|after the award|open');
RESET ROLE;
SELECT mfu.refused('a second open row is refused', $q$INSERT INTO public.contact_owed (contact_id, what) SELECT priya, 'x' FROM ids$q$, 'contact_owed_one_open');

-- 6 · The badge counts each person once, across all three sections, and a newer note's day replaces an older one.
SELECT mfu.line(priya, 'text', 'in', interval '1 hour', 'Any word on the start date?') FROM ids;
INSERT INTO public.messages (contact_id, channel, direction, at, body, back_on)
  SELECT priya, 'note', 'team', now() - interval '50 minutes', 'Tell her Monday.', public.app_today() FROM ids;
SELECT mfu.line(priya, 'text', 'in', interval '40 minutes', 'Thanks!') FROM ids;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('Priya is in all three and counts once, with Greg', public.follow_up_count()::text, '2');
RESET ROLE;
INSERT INTO public.messages (contact_id, channel, direction, at, body, back_on)
  SELECT dee, 'note', 'team', now() - interval '20 minutes', 'Call Dee about the pad.', public.app_today() FROM ids;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('a note whose day has come counts', public.follow_up_count()::text, '3');
RESET ROLE;
INSERT INTO public.messages (contact_id, channel, direction, at, body, back_on)
  SELECT dee, 'note', 'team', now() - interval '10 minutes', 'Not before Thursday.', public.app_today() + 3 FROM ids;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('a newer note''s day replaces the older one', public.follow_up_count()::text, '2');
SELECT public.back_done((SELECT id FROM public.messages WHERE body = 'Not before Thursday.'));
SELECT mfu.same('once it is done, nothing older comes back', public.follow_up_count()::text, '2');
RESET ROLE;

-- 7 · A team note marks it done, and closes the row as any note does.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.take_it(priya) FROM ids;
SELECT mfu.refused('the note is what marks it done', $q$SELECT public.owed_done(priya, ' ') FROM ids$q$, 'Say how it got done, or press Not done yet.');
SELECT public.owed_done(priya, 'Told her the start date. The award came in.') FROM ids;
SELECT mfu.same('done by the note, which is on her thread; the row closes',
  (SELECT concat_ws(' || ', mfu.owed(priya), mfu.state(priya),
    (SELECT m.body FROM public.contact_owed o JOIN public.messages m ON m.id = o.done_note_message_id WHERE o.contact_id = priya AND o.done_how = 'note'))
   FROM ids),
  'the start date|after the award|note || done|-|-|- || Told her the start date. The award came in.');
SELECT mfu.refused('nothing owed, nothing done', $q$SELECT public.owed_done(priya, 'again') FROM ids$q$, 'Nothing is owed to them now.');
RESET ROLE;
INSERT INTO public.contact_owed (contact_id, what) SELECT greg, 'the plans or an addendum' FROM ids;
SELECT mfu.refused('only their team note, or our message, marks it done',
  $q$UPDATE public.contact_owed SET done_at = now(), done_how = 'note', done_note_message_id = (SELECT id FROM public.messages WHERE body = 'And the rock clause?') WHERE contact_id = (SELECT greg FROM ids) AND done_at IS NULL$q$,
  'Only their team note, or a message we sent them, marks what we owe done.');
SELECT mfu.refused('done says how', $q$UPDATE public.contact_owed SET done_at = now() WHERE contact_id = (SELECT greg FROM ids) AND done_at IS NULL$q$, 'contact_owed_done_said');
DELETE FROM public.contact_owed WHERE contact_id = (SELECT greg FROM ids);

-- 8 · A heard day is written as a kind by who they are; a double kind writes its first unless told.
CREATE TEMP TABLE heard AS SELECT
  mfu.line(greg, 'voicemail', 'in', interval '15 minutes', 'I''ll have Boerne sitework over by Wednesday the 7th.') AS start_vm,
  mfu.line(greg, 'text', 'in', interval '14 minutes', 'Insurance comes end of the month.') AS papers_text,
  mfu.line(greg, 'text', 'in', interval '13 minutes', 'Maybe Friday, maybe not.') AS talk_text,
  mfu.line(priya, 'voicemail', 'in', interval '12 minutes', 'The check goes out Friday the 9th.') AS pay_vm
FROM ids;
GRANT SELECT ON heard TO authenticated;
INSERT INTO public.message_promises (message_id, day, day_words)
  SELECT start_vm, DATE '2026-10-07', NULL FROM heard
  UNION ALL SELECT papers_text, NULL, 'end of the month' FROM heard
  UNION ALL SELECT talk_text, DATE '2026-10-09', NULL FROM heard
  UNION ALL SELECT pay_vm, DATE '2026-10-09', NULL FROM heard;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a trade partner promises no payment', $q$SELECT public.write_down(start_vm, 'payment') FROM heard$q$, 'That is not a promise a trade partner makes.');
SELECT mfu.refused('a start writes a start or a delivery', $q$SELECT public.write_down(start_vm, 'start', 'w9') FROM heard$q$, 'A start or delivery writes a start or a delivery');
SELECT public.write_down(start_vm, 'start') FROM heard;
SELECT mfu.refused('a day said once', $q$SELECT public.write_down(start_vm, 'quote') FROM heard$q$, 'Someone has said what that day is already.');
SELECT public.write_down(papers_text, 'papers', 'w9') FROM heard;
SELECT public.write_down(talk_text, NULL) FROM heard;
SELECT mfu.refused('a customer promises no quote', $q$SELECT public.write_down(pay_vm, 'quote') FROM heard$q$, 'That is not a promise a customer makes.');
SELECT public.write_down(pay_vm, 'payment') FROM heard;
SELECT mfu.refused('a line with no day heard', $q$SELECT public.write_down((SELECT id FROM public.messages WHERE body = 'Thanks!'), 'payment')$q$, 'No day was heard on that line.');
SELECT mfu.same('each day, as it was read',
  (SELECT string_agg(concat_ws('|', m.body, coalesce(p.kind, '-'), p.state, coalesce(p.writes, '-'), public.follow_up_user_name(p.decided_by)), ' / ' ORDER BY m.at)
   FROM public.message_promises p JOIN public.messages m ON m.id = p.message_id),
  'I''ll have Boerne sitework over by Wednesday the 7th.|start|written|start|Robert / Insurance comes end of the month.|papers|written|w9|Robert / Maybe Friday, maybe not.|-|no|-|Robert / The check goes out Friday the 9th.|payment|written|-|Robert');
RESET ROLE;
SELECT mfu.refused('a day is a date or words', $q$INSERT INTO public.message_promises (message_id, day, day_words) SELECT talk_text, current_date, 'Friday' FROM heard$q$, 'message_promises_promise');

-- 9 · A plans question goes to the architect; the person stays waiting on the answer.
CREATE TEMP TABLE asked AS SELECT mfu.line(greg, 'text', 'in', interval '5 minutes', 'Is the detention pond in sitework?') AS q FROM ids;
GRANT SELECT ON asked TO authenticated;
INSERT INTO public.message_promises (message_id, kind) SELECT q, 'question' FROM asked;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('to the architect, or ours to answer', $q$SELECT public.read_question(q, 'maybe') FROM asked$q$, 'A plans question goes to the architect, or we answer it ourselves.');
SELECT public.read_question(q, 'asked') FROM asked;
SELECT mfu.same('the thread records it, and Greg still waits',
  (SELECT concat_ws(' || ', (SELECT body FROM public.messages WHERE contact_id = greg AND channel = 'event' ORDER BY at DESC, id DESC LIMIT 1), mfu.state(greg)) FROM ids),
  'Sent to the architect as a plan question: “Is the detention pond in sitework?” || waiting|-|-|-');
SELECT mfu.refused('asked once', $q$SELECT public.read_question(q, 'answered') FROM asked$q$, 'That plans question is dealt with already.');
SELECT mfu.refused('a line that is no question', $q$SELECT public.read_question(start_vm, 'asked') FROM heard$q$, 'That line is not a plans question.');
RESET ROLE;
SELECT mfu.refused('a question has no day', $q$INSERT INTO public.message_promises (message_id, kind, day) SELECT talk_text, 'question', current_date FROM heard$q$, 'message_promises_question');

-- 10 · A note's day: written with the note in one statement, a team note only, a date or words, and Done with it.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a note has words', $q$SELECT public.add_note(priya, '  ') FROM ids$q$, 'Write the note first.');
SELECT mfu.refused('a note''s day is a date or words, once', $q$SELECT public.add_note(priya, 'x', NULL, NULL, current_date, 'Friday') FROM ids$q$, 'A day is a date or the words typed, not both.');
SELECT public.add_note(priya, 'Call her when the award lands.', 'project', '00000000-0000-0000-0000-0000000006f1', NULL, 'when the award lands') FROM ids;
SELECT mfu.same('the note, its job and its day in words, by Rosa, in one write',
  (SELECT concat_ws('|', who_text, (project_id IS NOT NULL)::text, coalesce(back_on::text, '-'), back_words, public.follow_up_user_name(back_by))
   FROM public.messages WHERE body = 'Call her when the award lands.'),
  'Rosa|true|-|when the award lands|Rosa');
SELECT mfu.refused('only a team note comes back', $q$SELECT public.set_back_day((SELECT id FROM public.messages WHERE body = 'Thanks!'), current_date)$q$, 'Only a team note comes back on a day.');
SELECT mfu.refused('a note''s day is a date or words', $q$SELECT public.set_back_day((SELECT id FROM public.messages WHERE body = 'Tell her Monday.'), current_date, 'Friday')$q$, 'A day is a date or the words typed, not both.');
SELECT public.set_back_day((SELECT id FROM public.messages WHERE body = 'Tell her Monday.'), NULL, 'after the award');
SELECT mfu.same('a day in words, set by Rosa',
  (SELECT concat_ws('|', coalesce(back_on::text, '-'), back_words, public.follow_up_user_name(back_by)) FROM public.messages WHERE body = 'Tell her Monday.'),
  '-|after the award|Rosa');
SELECT public.set_back_day((SELECT id FROM public.messages WHERE body = 'Tell her Monday.'), NULL, NULL);
SELECT mfu.refused('no day, nothing to clear', $q$SELECT public.back_done((SELECT id FROM public.messages WHERE body = 'Tell her Monday.'))$q$, 'That note has no day to clear.');
RESET ROLE;

-- 11 · Highlights: the message's own words, once.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('the same words twice are one highlight',
  (SELECT (public.highlight(m.id, 'detention pond') = public.highlight(m.id, ' detention pond '))::text
   FROM public.messages m WHERE m.body = 'Is the detention pond in sitework or concrete?'),
  'true');
SELECT mfu.same('kept once', (SELECT count(*) FROM public.message_highlights)::text, '1');
SELECT mfu.refused('words from the message itself', $q$SELECT public.highlight((SELECT id FROM public.messages WHERE body = 'Is the detention pond in sitework or concrete?'), 'concrete truck')$q$, 'Highlight words from the message itself.');
SELECT public.unhighlight((SELECT id FROM public.message_highlights WHERE text = 'detention pond'));
SELECT mfu.refused('gone once', $q$SELECT public.unhighlight((SELECT id FROM public.message_highlights WHERE text = 'detention pond'))$q$, 'That highlight is gone already.');
RESET ROLE;

-- 12 · The fold keeps what we owe and the state: Who is this? names Dee as Hillside's own person.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.mark_owed(dee, 'a call back') FROM ids;
SELECT public.mark_owed(greg, 'the plans or an addendum', '2026-10-09') FROM ids;
SELECT public.set_state(greg, 'done') FROM ids;
SELECT public.hand_to(dee, '00000000-0000-0000-0000-0000000006d5') FROM ids;
RESET ROLE;
SELECT mfu.line(dee, 'text', 'in', interval '1 minute', 'Can we quote the concrete?') FROM ids;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('Who is this? folds Dee into Hillside''s own person',
  (SELECT (public.name_contact(dee, 'gc_companies', '00000000-0000-0000-0000-0000000006a1', 'trade') = greg)::text FROM ids), 'true');
RESET ROLE;
SELECT mfu.same('the newest owed stands, the other closes as folded; open because Dee was waiting; who had Dee has it',
  (SELECT concat_ws(' || ', mfu.owed(greg), mfu.state(greg), (SELECT count(*) FROM public.contacts WHERE id = dee)) FROM ids),
  'the plans or an addendum|2026-10-09|open, a call back|-|folded || waiting|-|Owner|handed || 0');

-- 13 · Who reads it, and the one line a person writes by hand.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfu.same('the superintendent reads nothing, and no badge',
  concat_ws('|', (SELECT count(*) FROM public.contact_owed), (SELECT count(*) FROM public.message_promises), public.follow_up_count()), '0|0|0');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('nobody writes their text by hand',
  $q$INSERT INTO public.messages (contact_id, channel, direction, who_user_id, body) SELECT greg, 'text', 'in', '00000000-0000-0000-0000-0000000006d2', 'forged' FROM ids$q$,
  'row-level security');
SELECT mfu.refused('nor a note as someone else',
  $q$INSERT INTO public.messages (contact_id, channel, direction, who_user_id, body) SELECT greg, 'note', 'team', '00000000-0000-0000-0000-0000000006d3', 'forged' FROM ids$q$,
  'row-level security');
INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body)
  SELECT greg, 'note', 'team', '00000000-0000-0000-0000-0000000006d2', 'Robert', 'Called him back.' FROM ids;
SELECT mfu.same('a note of his own is his to write, and closes the row', (SELECT mfu.state(greg) FROM ids), 'done|-|-|-');
RESET ROLE;

-- 14 · Who gets a new message: the seats are the owner's and dev's to set.
SELECT mfu.same('the rule starts with no seats',
  (SELECT value_text FROM public.app_settings WHERE key = 'messages_assign_rule_v1'), '{"customer": null, "trade": null, "arch": null}');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.tried($q$UPDATE public.app_settings SET value_text = '{"customer": null, "trade": "x", "arch": null}' WHERE key = 'messages_assign_rule_v1'$q$);
RESET ROLE;
SELECT mfu.same('an estimator sets no seat',
  (SELECT value_text FROM public.app_settings WHERE key = 'messages_assign_rule_v1'), '{"customer": null, "trade": null, "arch": null}');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d5');
SET LOCAL ROLE authenticated;
UPDATE public.app_settings SET value_text = '{"customer": "00000000-0000-0000-0000-0000000006d3", "trade": "00000000-0000-0000-0000-0000000006d2", "arch": null}'
  WHERE key = 'messages_assign_rule_v1';
RESET ROLE;
SELECT mfu.same('the owner sets the seats',
  (SELECT value_text::jsonb ->> 'customer' FROM public.app_settings WHERE key = 'messages_assign_rule_v1'), '00000000-0000-0000-0000-0000000006d3');

-- 15 · A message we sent gets what we owe done (cut 2's addendum, 20261013030000): one of ours to them, once.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.mark_owed(priya, 'the start date', '2026-10-05') FROM ids;
RESET ROLE;
CREATE TEMP TABLE sent AS SELECT
  mfu.line(priya, 'text', 'in', interval '3 minutes', 'When do you start?') AS theirs,
  mfu.line(greg, 'text', 'out', interval '2 minutes', 'Monday.') AS to_greg,
  mfu.line(priya, 'email', 'out', interval '1 minute', 'We start Monday, Oct 5.') AS ours
FROM ids;
GRANT SELECT ON sent TO authenticated;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d6');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a training account marks nothing done by a message', $q$SELECT public.owed_sent_done(priya, ours) FROM ids, sent$q$, 'A training account cannot mark what we owe done.');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('their own line gets nothing done', $q$SELECT public.owed_sent_done(priya, theirs) FROM ids, sent$q$, 'Only their team note, or a message we sent them, marks what we owe done.');
SELECT mfu.refused('our line to someone else gets nothing done', $q$SELECT public.owed_sent_done(priya, to_greg) FROM ids, sent$q$, 'Only their team note, or a message we sent them, marks what we owe done.');
SELECT mfu.refused('no line gets nothing done', $q$SELECT public.owed_sent_done(priya, NULL) FROM ids$q$, 'Only their team note, or a message we sent them, marks what we owe done.');
SELECT public.owed_sent_done(priya, ours) FROM ids, sent;
RESET ROLE;
SELECT mfu.same('our email got it done, by that line',
  (SELECT concat_ws('|', o.what, o.by_day::text, o.done_how, (o.done_note_message_id = s.ours)::text)
   FROM public.contact_owed o, sent s WHERE o.contact_id = (SELECT priya FROM ids) AND o.done_how = 'message'),
  'the start date|2026-10-05|message|true');
SELECT mfu.same('the thread says so in the kernel''s words',
  (SELECT body FROM public.messages WHERE contact_id = (SELECT priya FROM ids) AND channel = 'event' ORDER BY at DESC, id DESC LIMIT 1),
  'Rosa sent the start date. It is done.');
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('done once', $q$SELECT public.owed_sent_done(priya, ours) FROM ids, sent$q$, 'Nothing is owed to them now.');
RESET ROLE;

-- 13 · Calls to make (v2.5596, *_call_tasks): Add to my calls, a second add moves the day, I called with a note, Skip,
--      Tomorrow, the webhook's close, the badge, who may not, the fences.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE calls (what text, id uuid);
GRANT SELECT, INSERT ON calls TO authenticated;
INSERT INTO calls SELECT 'first', public.call_task_add(priya, 'estimate', 'project', '00000000-0000-0000-0000-0000000006f1', public.app_today() + 1, ' about the estimate ', 'Hi Priya, this is Rosa.') FROM ids;
SELECT mfu.same('a call is added for its day, with its words, by who',
  (SELECT concat_ws('|', t.what, (t.due_on = public.app_today() + 1)::text, t.script, public.follow_up_user_name(t.made_by), coalesce(t.done_how, 'open'))
   FROM public.call_tasks t WHERE t.id = (SELECT id FROM calls WHERE what = 'first')),
  'about the estimate|true|Hi Priya, this is Rosa.|Rosa|open');
SELECT mfu.same('the thread says so',
  (SELECT body FROM public.messages WHERE contact_id = (SELECT priya FROM ids) AND channel = 'event' ORDER BY at DESC, id DESC LIMIT 1),
  'Rosa added a call to Dr. Priya Raman about the estimate for ' || public.follow_up_day(public.app_today() + 1) || '.');
INSERT INTO calls SELECT 'again', public.call_task_add(priya, 'estimate', 'project', '00000000-0000-0000-0000-0000000006f1', public.app_today() + 3, 'about the estimate', NULL) FROM ids;
SELECT mfu.same('a second add for the same step and job moves the open call instead',
  (SELECT (a.id = b.id)::text || '|' || (SELECT (due_on = public.app_today() + 3)::text FROM public.call_tasks WHERE id = a.id) FROM calls a, calls b WHERE a.what = 'first' AND b.what = 'again'),
  'true|true');
SELECT mfu.same('one open call for her', (SELECT count(*)::text FROM public.call_tasks WHERE contact_id = (SELECT priya FROM ids) AND done_at IS NULL), '1');
SELECT mfu.refused('a call says what it is about', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, public.app_today(), '  ', NULL) FROM ids$q$, 'Say what the call is about');
SELECT mfu.refused('a call says its day', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, NULL, 'about the visit', NULL) FROM ids$q$, 'Say which day to call');
SELECT public.call_task_move((SELECT id FROM calls WHERE what = 'first'), public.app_today());
SELECT mfu.same('Tomorrow moves the day', (SELECT (due_on = public.app_today())::text FROM public.call_tasks WHERE id = (SELECT id FROM calls WHERE what = 'first')), 'true');
SELECT mfu.refused('a call is never moved to a day gone by', $q$SELECT public.call_task_move((SELECT id FROM calls WHERE what = 'first'), public.app_today() - 1)$q$, 'Pick today or a day to come');
-- The badge: a person with nothing else open counts once for an open call, and not once it closes.
RESET ROLE;
-- Done, so nothing but the call could count them: a new row starts waiting.
INSERT INTO public.contacts (id, kind, state) VALUES ('00000000-0000-0000-0000-000000006012', 'unknown', 'done');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES ('00000000-0000-0000-0000-000000006012', 'phone', '(830) 555-0190');
CREATE TEMP TABLE badge (what text, n integer);
GRANT SELECT, INSERT ON badge TO authenticated;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
INSERT INTO badge SELECT 'before', public.follow_up_count();
INSERT INTO calls SELECT 'badge', public.call_task_add('00000000-0000-0000-0000-000000006012', NULL, NULL, NULL, public.app_today() + 1, 'about the pad', NULL);
SELECT mfu.same('the badge counts a person once for an open call', public.follow_up_count()::text, (SELECT (n + 1)::text FROM badge WHERE what = 'before'));
SELECT public.call_task_done((SELECT id FROM calls WHERE what = 'badge'), 'skipped', NULL);
SELECT mfu.same('and not once the call closes', public.follow_up_count()::text, (SELECT n::text FROM badge WHERE what = 'before'));
-- I called, with the app's note.
SELECT public.call_task_done((SELECT id FROM calls WHERE what = 'first'), 'called', NULL);
SELECT mfu.same('I called closes it with a note in the thread',
  (SELECT concat_ws('|', t.done_how, public.follow_up_user_name(t.done_by), m.channel, m.body) FROM public.call_tasks t JOIN public.messages m ON m.id = t.done_message_id WHERE t.id = (SELECT id FROM calls WHERE what = 'first')),
  'called|Rosa|note|Called Dr. Priya Raman about the estimate.');
SELECT mfu.refused('a closed call is not closed again', $q$SELECT public.call_task_done((SELECT id FROM calls WHERE what = 'first'), 'skipped', NULL)$q$, 'That call is not open');
SELECT mfu.refused('done says how', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, public.app_today(), 'about the visit', NULL) FROM ids; SELECT public.call_task_done((SELECT id FROM public.call_tasks WHERE step_key = 'booked' AND done_at IS NULL), 'rang', NULL)$q$, 'Say how');
-- Skip, with a gray line.
INSERT INTO calls SELECT 'skip', public.call_task_add(greg, 'portal', NULL, NULL, public.app_today(), 'about the portal', NULL) FROM ids;
SELECT public.call_task_done((SELECT id FROM calls WHERE what = 'skip'), 'skipped', NULL);
SELECT mfu.same('Skip closes it with a gray line',
  (SELECT t.done_how || '|' || (SELECT body FROM public.messages WHERE contact_id = t.contact_id AND channel = 'event' ORDER BY at DESC, id DESC LIMIT 1) FROM public.call_tasks t WHERE t.id = (SELECT id FROM calls WHERE what = 'skip')),
  'skipped|Rosa skipped the call to Greg Paulk about the portal.');
RESET ROLE;
-- The webhook's close: an answered call to her closes every open call, with its line.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
INSERT INTO calls SELECT 'webhook', public.call_task_add(priya, 'approved', 'project', '00000000-0000-0000-0000-0000000006f1', public.app_today() + 2, 'about the estimate', NULL) FROM ids;
SELECT mfu.refused('the office does not close by call', $q$SELECT public.call_tasks_close_by_call(priya, NULL) FROM ids$q$, 'permission denied');
RESET ROLE;
CREATE TEMP TABLE the_call AS SELECT mfu.line((SELECT priya FROM ids), 'call', 'out', interval '1 minute', 'Rosa called Dr. Priya Raman, 4:12') AS id;
GRANT SELECT ON the_call TO service_role;
SET LOCAL ROLE service_role;
SELECT mfu.same('the webhook closes the open call with its line', public.call_tasks_close_by_call((SELECT priya FROM ids), (SELECT id FROM the_call))::text, '1');
RESET ROLE;
SELECT mfu.same('closed by the call', (SELECT t.done_how || '|' || (t.done_message_id = (SELECT id FROM the_call))::text FROM public.call_tasks t WHERE t.id = (SELECT id FROM calls WHERE what = 'webhook')), 'call|true');
-- Who may not: a superintendent reads none and adds none; training mode and a twin are refused in words; anon reads nothing.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfu.same('a superintendent reads no call', (SELECT count(*)::text FROM public.call_tasks), '0');
SELECT mfu.refused('a superintendent adds no call', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, public.app_today(), 'about the visit', NULL) FROM ids$q$, 'Only the office team can');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d6');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('training mode adds no call', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, public.app_today(), 'about the visit', NULL) FROM ids$q$, 'training account');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d7');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a twin adds no call', $q$SELECT public.call_task_add(priya, 'booked', NULL, NULL, public.app_today(), 'about the visit', NULL) FROM ids$q$, 'digital twin');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT mfu.refused('anon reads no call', $q$SELECT count(*) FROM public.call_tasks$q$, 'permission denied');
RESET ROLE;
SELECT mfu.same('the new table carries the office policy and the read-only and twin blocks', (
  SELECT (SELECT string_agg(polname, ',' ORDER BY polname COLLATE "C") FROM pg_policy WHERE polrelid = c.oid)
    || ':' || (SELECT count(*) FROM pg_trigger WHERE tgrelid = c.oid AND tgname = 'read_only_block_stmt')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'call_tasks'),
  'call_tasks_select,digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1');
SELECT mfu.same('the residential flow''s scripts are seeded',
  (SELECT string_agg(s.step_key, ',' ORDER BY s.step_key) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential' AND s.call_script IS NOT NULL AND s.call_script_es IS NOT NULL),
  'approved,booked,estimate');

-- 14 · The customer's say (v2.5597): the office sets text, email or either with a gray line; the same word again writes
--      nothing; My way is each person's own row.
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d3');
SET LOCAL ROLE authenticated;
SELECT public.contact_set_prefers(priya, 'email') FROM ids;
SELECT mfu.same('the office sets how she hears from us, with a gray line',
  (SELECT concat_ws('|', c.prefers, c.prefers_how, (c.prefers_at IS NOT NULL)::text,
     (SELECT body FROM public.messages WHERE contact_id = c.id AND channel = 'event' ORDER BY at DESC, id DESC LIMIT 1))
   FROM public.contacts c WHERE c.id = (SELECT priya FROM ids)),
  'email|office|true|Rosa set how Dr. Priya Raman hears from us: email.');
SELECT public.contact_set_prefers(priya, 'email') FROM ids;
SELECT mfu.same('the same word again writes no second line',
  (SELECT count(*)::text FROM public.messages WHERE contact_id = (SELECT priya FROM ids) AND channel = 'event' AND body LIKE 'Rosa set how % hears from us: email.'), '1');
SELECT public.contact_set_prefers(priya, 'either') FROM ids;
SELECT mfu.same('either stands as a word of its own', (SELECT prefers FROM public.contacts WHERE id = (SELECT priya FROM ids)), 'either');
SELECT mfu.refused('a known word only', $q$SELECT public.contact_set_prefers(priya, 'fax') FROM ids$q$, 'Say text, email or either');
-- My way: Rosa's own row, and nobody else reads or writes it.
INSERT INTO public.tell_customer_prefs (user_id, booked) VALUES ('00000000-0000-0000-0000-0000000006d3', 'send');
SELECT mfu.same('Rosa reads her own way', (SELECT booked || '|' || estimate FROM public.tell_customer_prefs WHERE user_id = '00000000-0000-0000-0000-0000000006d3'), 'send|ask');
SELECT mfu.refused('a way is ask or send', $q$UPDATE public.tell_customer_prefs SET estimate = 'maybe' WHERE user_id = '00000000-0000-0000-0000-0000000006d3'$q$, 'tell_customer_prefs_estimate_known');
SELECT mfu.refused('nobody writes another''s way', $q$INSERT INTO public.tell_customer_prefs (user_id, booked) VALUES ('00000000-0000-0000-0000-0000000006d2', 'send')$q$, 'row-level security');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfu.same('Robert reads no row of Rosa''s', (SELECT count(*)::text FROM public.tell_customer_prefs), '0');
RESET ROLE;
SELECT mfu.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfu.refused('a superintendent sets nothing', $q$SELECT public.contact_set_prefers(priya, 'text') FROM ids$q$, 'Only the office team can');
RESET ROLE;
SELECT mfu.same('the prefs table carries the read-only and twin blocks', (
  SELECT (SELECT string_agg(polname, ',' ORDER BY polname COLLATE "C") FROM pg_policy WHERE polrelid = c.oid)
    || ':' || (SELECT count(*) FROM pg_trigger WHERE tgrelid = c.oid AND tgname = 'read_only_block_stmt')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'tell_customer_prefs'),
  'digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update,tell_customer_prefs_own:1');

DO $$ BEGIN RAISE NOTICE 'messages_follow_up PASSED'; END $$;
ROLLBACK;
