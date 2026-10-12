-- Messages, cut 1, the spine (migration *_messages_spine): the seed makes one contact per person the app already has,
-- with their numbers and addresses, once; only the office team reads them; a number finds its person by its key, and a
-- number two people share lands on the one it last carried a message for; Who is this? re-points a contact or folds it
-- into the one already there, keeping the thread, and a company's row holds its own person and others by name; a line
-- is tied to a job and the star moves; training mode and a digital twin change nothing; deleting a customer contact
-- person or a roster person keeps their thread; merging two customers keeps both threads on the survivor; and a record
-- with a contact is not deleted from under it. Presses run as each user through RLS; the fixture and the messages are
-- made as postgres, standing in for the seed and the service role; everything rolls back. Raises on the first failed
-- assertion; ends with "messages_spine PASSED". See scripts/pgtest-messages-spine.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an estimator, an assistant), a superintendent outside it, an estimator in training mode and a
-- digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@spine.test'),
  ('00000000-0000-0000-0000-0000000005d2', 'estimator@spine.test'),
  ('00000000-0000-0000-0000-0000000005d3', 'assistant@spine.test'),
  ('00000000-0000-0000-0000-0000000005d4', 'super@spine.test'),
  ('00000000-0000-0000-0000-0000000005d6', 'training@spine.test'),
  ('00000000-0000-0000-0000-0000000005d7', 'twin@spine.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000005d1', 'dev@spine.test', 'Spine Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000005d2', 'estimator@spine.test', 'Spine Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000005d3', 'assistant@spine.test', 'Spine Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000005d4', 'super@spine.test', 'Spine Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000005d6', 'training@spine.test', 'Spine Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000005d7', 'twin@spine.test', 'Spine Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A GC project: its customer with a person at it, its architect with a person, its property owner with nobody named at
-- it (and a duplicate of the owner, to merge). A trade partner with its main contact and one more person; a roster
-- person.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000005c1', 'Spine Cibolo', '00000000-0000-0000-0000-0000000005d1', '{"phone": "(210) 555-0100"}'),
  ('00000000-0000-0000-0000-0000000005c2', 'Spine Marsh Architects', '00000000-0000-0000-0000-0000000005d1', NULL),
  ('00000000-0000-0000-0000-0000000005c3', 'Spine Bell Dental', '00000000-0000-0000-0000-0000000005d1', '{"phone": "(210) 555-0177", "email": "office@belldental.example"}'),
  ('00000000-0000-0000-0000-0000000005c4', 'Spine Bell Dental (dup)', '00000000-0000-0000-0000-0000000005d1', NULL);
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005c1', 'Elena Marchetti', '(210) 555-0188', 'elena@cibolocreek.example'),
  ('00000000-0000-0000-0000-0000000005e2', '00000000-0000-0000-0000-0000000005c2', 'Jonah Vale', NULL, 'jonah@marshvale.example');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000005f1', 'Spine Clinic', '00000000-0000-0000-0000-0000000005c1');
INSERT INTO public.gc_projects (project_id, stage, architect_customer_id, property_owner_customer_id) VALUES
  ('00000000-0000-0000-0000-0000000005f1', 'buyout', '00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-0000000005c3');
INSERT INTO public.gc_companies (id, name, trades, contact_name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000005a1', 'Spine Hillside', ARRAY['Sitework'], 'Greg Paulk', '(210) 555-0113', 'greg@hillside.example');
INSERT INTO public.gc_company_people (id, company_id, name, email) VALUES
  ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005a1', 'Dana Paulk', 'dana@hillside.example');
INSERT INTO public.people (id, master_user_id, kind, name, phone) VALUES
  ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005d1', 'sub', 'Sam Roster', '(210) 555-0170');

CREATE SCHEMA msp;
CREATE FUNCTION msp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION msp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION msp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- Who a contact is, in one word a line: the record's table, the record, the name it carries.
CREATE FUNCTION msp.who(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', kind,
    CASE WHEN customer_id IS NOT NULL THEN 'customer ' || customer_id
         WHEN customer_contact_person_id IS NOT NULL THEN 'person ' || customer_contact_person_id
         WHEN gc_company_id IS NOT NULL THEN 'company ' || gc_company_id
         WHEN gc_company_person_id IS NOT NULL THEN 'trade person ' || gc_company_person_id
         WHEN person_id IS NOT NULL THEN 'roster ' || person_id
         ELSE 'no record' END,
    coalesce(name, '-'))
  FROM public.contacts WHERE id = p_contact
$$;
-- A contact's thread, oldest first, by body.
CREATE FUNCTION msp.thread(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(body, ' / ' ORDER BY at), '') FROM public.messages WHERE contact_id = p_contact
$$;
GRANT USAGE ON SCHEMA msp TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA msp TO anon, authenticated;

-- 1 · The seed: a contact for each person, with their numbers and addresses, and nothing the second time.
SELECT msp.same('the seed makes five contacts', public.messages_seed_contacts()::text, '5');
SELECT msp.same('and none the second time', public.messages_seed_contacts()::text, '0');
SELECT msp.same('who each one is: a company with a person has no contact of its own',
  (SELECT string_agg(msp.who(id), ', ' ORDER BY msp.who(id)) FROM public.contacts),
  'arch|person 00000000-0000-0000-0000-0000000005e2|-, customer|customer 00000000-0000-0000-0000-0000000005c3|-, customer|person 00000000-0000-0000-0000-0000000005e1|-, trade|company 00000000-0000-0000-0000-0000000005a1|-, trade|trade person 00000000-0000-0000-0000-0000000005a2|-');
SELECT msp.same('their numbers and addresses, each by its key',
  (SELECT string_agg(kind || ' ' || key, ', ' ORDER BY kind, key) FROM public.contact_channels),
  'email dana@hillside.example, email elena@cibolocreek.example, email greg@hillside.example, email jonah@marshvale.example, email office@belldental.example, phone 2105550113, phone 2105550177, phone 2105550188');

CREATE TEMP TABLE ids AS SELECT
  (SELECT id FROM public.contacts WHERE gc_company_id = '00000000-0000-0000-0000-0000000005a1') AS greg,
  (SELECT id FROM public.contacts WHERE customer_contact_person_id = '00000000-0000-0000-0000-0000000005e1') AS elena,
  (SELECT id FROM public.contacts WHERE customer_contact_person_id = '00000000-0000-0000-0000-0000000005e2') AS jonah,
  (SELECT id FROM public.contacts WHERE customer_id = '00000000-0000-0000-0000-0000000005c3') AS bell;
GRANT SELECT ON ids TO authenticated;

-- 2 · Numbers nobody knows, and the lines (as the service role will make them from cut 5).
INSERT INTO public.contacts (id, kind) VALUES
  ('00000000-0000-0000-0000-000000005011', 'unknown'),
  ('00000000-0000-0000-0000-000000005012', 'unknown'),
  ('00000000-0000-0000-0000-000000005013', 'unknown'),
  ('00000000-0000-0000-0000-000000005014', 'unknown'),
  ('00000000-0000-0000-0000-000000005016', 'unknown'),
  ('00000000-0000-0000-0000-000000005017', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_at) VALUES
  ('00000000-0000-0000-0000-000000005011', 'phone', '(830) 555-0172', NULL),
  ('00000000-0000-0000-0000-000000005012', 'phone', '+1 210 555 0113', NULL),
  ('00000000-0000-0000-0000-000000005013', 'phone', '210.555.0170', NULL),
  ('00000000-0000-0000-0000-000000005014', 'phone', '(210) 555-0190', NULL),
  ('00000000-0000-0000-0000-000000005016', 'phone', '210-555-0188', now() - interval '1 day');
INSERT INTO public.messages (contact_id, channel_id, channel, direction, at, body)
SELECT ch.contact_id, ch.id, 'text', 'in', now() - v.ago, v.body
FROM (VALUES
  ((SELECT greg FROM ids), 'phone', interval '2 hours', 'Greg here.'),
  ('00000000-0000-0000-0000-000000005011'::uuid, 'phone', interval '30 minutes', 'Dee at the yard, new cell.'),
  ('00000000-0000-0000-0000-000000005012'::uuid, 'phone', interval '1 hour', 'Greg from my other phone.'),
  ('00000000-0000-0000-0000-000000005013'::uuid, 'phone', interval '40 minutes', 'Sam, running late.'),
  ('00000000-0000-0000-0000-000000005014'::uuid, 'phone', interval '3 hours', 'The dental office, about the bill.'),
  ('00000000-0000-0000-0000-000000005016'::uuid, 'phone', interval '26 hours', 'STOP')
) AS v(contact_id, kind, ago, body)
JOIN public.contact_channels ch ON ch.contact_id = v.contact_id AND ch.kind = v.kind;
INSERT INTO public.messages (contact_id, channel_id, channel, direction, at, body)
SELECT (SELECT elena FROM ids), ch.id, 'email', 'out', now() - interval '1 day', 'The start date goes Monday.'
FROM public.contact_channels ch WHERE ch.contact_id = (SELECT elena FROM ids) AND ch.kind = 'email';
INSERT INTO public.messages (contact_id, channel, direction, at, body, back_on)
VALUES ((SELECT elena FROM ids), 'note', 'team', now() - interval '20 hours', 'Tell her Monday.', current_date);
INSERT INTO public.messages (contact_id, channel_id, channel, direction, at, body)
SELECT (SELECT bell FROM ids), ch.id, 'email', 'in', now() - interval '2 days', 'Bell asks about the bill.'
FROM public.contact_channels ch WHERE ch.contact_id = (SELECT bell FROM ids) AND ch.kind = 'email';

-- 3 · What a row may say.
SELECT msp.refused('a known kind needs its record', $q$INSERT INTO public.contacts (kind) VALUES ('trade')$q$, 'contacts_one_record');
SELECT msp.refused('an unknown number has no record', $q$INSERT INTO public.contacts (kind, gc_company_id) VALUES ('unknown', '00000000-0000-0000-0000-0000000005a1')$q$, 'contacts_one_record');
SELECT msp.refused('one record, not two', $q$INSERT INTO public.contacts (kind, customer_id, person_id) VALUES ('customer', '00000000-0000-0000-0000-0000000005c4', '00000000-0000-0000-0000-0000000005b1')$q$, 'contacts_one_record');
SELECT msp.refused('a person''s row is one contact', $q$INSERT INTO public.contacts (kind, customer_contact_person_id) VALUES ('customer', '00000000-0000-0000-0000-0000000005e1')$q$, 'contacts_customer_person_once');
SELECT msp.refused('a company''s own person is one contact', $q$INSERT INTO public.contacts (kind, gc_company_id) VALUES ('trade', '00000000-0000-0000-0000-0000000005a1')$q$, 'contacts_gc_company_once');
SELECT msp.refused('an address never says STOP', $q$INSERT INTO public.contact_channels (contact_id, kind, value, opted_out_at) SELECT greg, 'email', 'x@hillside.example', now() FROM ids$q$, 'contact_channels_stop_is_a_number');
SELECT msp.refused('a channel must be a number or an address', $q$INSERT INTO public.contact_channels (contact_id, kind, value) SELECT greg, 'phone', 'call me' FROM ids$q$, 'contact_channels_usable');
SELECT msp.refused('a team line is a note or an event', $q$INSERT INTO public.messages (contact_id, channel, direction, body) SELECT greg, 'note', 'in', 'x' FROM ids$q$, 'messages_team_is_note_or_event');
SELECT msp.refused('an opt-out line rides on a text we sent', $q$INSERT INTO public.messages (contact_id, channel, direction, body, optout_line) SELECT greg, 'text', 'in', 'x', 'first' FROM ids$q$, 'messages_optout_on_texts');
SELECT msp.refused('a line is tied to one job at most', $q$INSERT INTO public.messages (contact_id, channel, direction, body, project_id, jobs_ledger_id) SELECT greg, 'text', 'in', 'x', '00000000-0000-0000-0000-0000000005f1', gen_random_uuid() FROM ids$q$, 'messages_one_job');

-- 4 · Who reads.
SET LOCAL ROLE anon;
SELECT msp.refused('no sign-in reads nothing', $q$SELECT count(*) FROM public.contacts$q$, 'permission denied for table contacts');
SELECT msp.refused('no sign-in reads no messages', $q$SELECT count(*) FROM public.messages$q$, 'permission denied for table messages');
RESET ROLE;
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d4');
SET LOCAL ROLE authenticated;
SELECT msp.same('a superintendent outside the office reads nothing',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.contacts), (SELECT count(*) FROM public.messages))), '0|0');
RESET ROLE;
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d2');
SET LOCAL ROLE authenticated;
SELECT msp.same('the office reads every contact and line',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.contacts), (SELECT count(*) FROM public.messages))), '11|9');
SELECT msp.refused('nobody makes a contact by hand', $q$INSERT INTO public.contacts (kind) VALUES ('unknown')$q$, 'permission denied for table contacts');
SELECT msp.refused('nobody writes a line by hand', $q$INSERT INTO public.messages (contact_id, channel, direction, body) SELECT greg, 'text', 'out', 'x' FROM ids$q$, 'permission denied for table messages');
SELECT msp.refused('nobody marks a STOP by hand', $q$UPDATE public.contact_channels SET opted_out_at = now()$q$, 'permission denied for table contact_channels');

-- 5 · Whose number it is: by its key, and a number two people share lands on the newest line's.
SELECT msp.same('Greg''s number, as a webhook writes it, is his other phone''s now: the newest line on it',
  (SELECT public.contact_for_channel('phone', '+1 (210) 555-0113') = '00000000-0000-0000-0000-000000005012')::text, 'true');
SELECT msp.same('his address, in capitals', (SELECT public.contact_for_channel('email', 'GREG@HILLSIDE.EXAMPLE') = greg FROM ids)::text, 'true');
SELECT msp.same('a number nobody has', coalesce(public.contact_for_channel('phone', '(512) 555-0199')::text, 'nobody'), 'nobody');
SELECT msp.same('words that are not a number', coalesce(public.contact_for_channel('phone', 'call me')::text, 'nobody'), 'nobody');
RESET ROLE;

-- 6 · Who is this? An assistant names the numbers.
-- A later cut's row on a contact moves with a fold through its own contacts_fold_<something>(uuid, uuid). One with any
-- other shape is never run.
CREATE TABLE msp.fold_rows (contact_id uuid, note text);
INSERT INTO msp.fold_rows VALUES ('00000000-0000-0000-0000-000000005012', 'we owe him a call back');
CREATE FUNCTION public.contacts_fold_test(p_from uuid, p_into uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE msp.fold_rows SET contact_id = p_into WHERE contact_id = p_from
$$;
CREATE FUNCTION public.contacts_fold_wrong_shape(p_from uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a contacts_fold_ function of another shape was run';
END $$;
GRANT ALL ON msp.fold_rows TO authenticated;
GRANT EXECUTE ON FUNCTION public.contacts_fold_test(uuid, uuid) TO authenticated;
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d3');
SET LOCAL ROLE authenticated;
-- Dee: a second person at the trade partner, known only by her cell, on the clinic.
SELECT msp.same('Dee keeps her own contact on the company, under her own name',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000005011', 'gc_companies', '00000000-0000-0000-0000-0000000005a1', 'trade', 'Dee', 'project', '00000000-0000-0000-0000-0000000005f1'))::text,
  '00000000-0000-0000-0000-000000005011');
SELECT msp.same('who Dee is', msp.who('00000000-0000-0000-0000-000000005011'), 'trade|company 00000000-0000-0000-0000-0000000005a1|Dee');
SELECT msp.same('the clinic is on her rail with the star, and her line is tied to it',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.contact_jobs WHERE contact_id = '00000000-0000-0000-0000-000000005011' AND project_id = '00000000-0000-0000-0000-0000000005f1' AND is_default),
    (SELECT project_id FROM public.messages WHERE contact_id = '00000000-0000-0000-0000-000000005011'))),
  '1|00000000-0000-0000-0000-0000000005f1');
-- Greg's other phone: his own name, in another case, is the company's own person. The number folds into his.
SELECT msp.same('Greg''s other phone folds into Greg', (SELECT public.name_contact('00000000-0000-0000-0000-000000005012', 'gc_companies', '00000000-0000-0000-0000-0000000005a1', 'trade', ' greg PAULK ') = greg FROM ids)::text, 'true');
SELECT msp.same('the empty contact is gone and both his lines are his, on his one number',
  (SELECT concat_ws('|',
    (SELECT count(*) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000005012'),
    msp.thread(greg),
    (SELECT count(*) FROM public.contact_channels WHERE contact_id = greg AND kind = 'phone'),
    (SELECT count(DISTINCT channel_id) FROM public.messages WHERE contact_id = greg))
   FROM ids),
  '0|Greg here. / Greg from my other phone.|1|1');
SELECT msp.same('so his number is his again', (SELECT public.contact_for_channel('phone', '2105550113') = greg FROM ids)::text, 'true');
SELECT msp.same('a later cut''s row on the folded contact moved with it, by its own contacts_fold_ function',
  (SELECT concat_ws('|', count(*), bool_and(f.contact_id = i.greg)::text) FROM msp.fold_rows f, ids i), '1|true');
RESET ROLE;
-- The customers and the roster are their masters' to see, and the dev's: the dev names the rest.
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d1');
SET LOCAL ROLE authenticated;
-- A number that sent STOP, which turns out to be Elena's: her number keeps the STOP.
SELECT msp.same('the STOP folds into Elena', (SELECT public.name_contact('00000000-0000-0000-0000-000000005016', 'customer_contact_persons', '00000000-0000-0000-0000-0000000005e1', 'customer') = elena FROM ids)::text, 'true');
SELECT msp.same('her number says STOP, once, and carries the STOP line',
  (SELECT concat_ws('|',
    (SELECT string_agg((opted_out_at IS NOT NULL)::text, ',') FROM public.contact_channels WHERE contact_id = elena AND kind = 'phone'),
    (SELECT count(*) FROM public.messages m JOIN public.contact_channels ch ON ch.id = m.channel_id WHERE m.body = 'STOP' AND ch.contact_id = elena AND ch.opted_out_at IS NOT NULL))
   FROM ids),
  'true|1');
-- A roster person and the duplicate customer.
SELECT msp.same('Sam is the roster person', (SELECT public.name_contact('00000000-0000-0000-0000-000000005013', 'people', '00000000-0000-0000-0000-0000000005b1', 'trade', 'ignored on a person''s row'))::text, '00000000-0000-0000-0000-000000005013');
SELECT msp.same('a person''s row holds the name, so the contact carries none', msp.who('00000000-0000-0000-0000-000000005013'), 'trade|roster 00000000-0000-0000-0000-0000000005b1|-');
SELECT msp.same('the dental office''s other number is the duplicate customer', (SELECT public.name_contact('00000000-0000-0000-0000-000000005014', 'customers', '00000000-0000-0000-0000-0000000005c4', 'customer'))::text, '00000000-0000-0000-0000-000000005014');
-- What is refused.
SELECT msp.refused('a contact already named', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005011', 'gc_companies', '00000000-0000-0000-0000-0000000005a1', 'trade')$q$, 'namedAlready');
SELECT msp.refused('no contact', $q$SELECT public.name_contact(gen_random_uuid(), 'gc_companies', '00000000-0000-0000-0000-0000000005a1', 'trade')$q$, 'notFound');
SELECT msp.refused('a kind we do not have', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'gc_companies', '00000000-0000-0000-0000-0000000005a1', 'boss')$q$, 'kindNeeded');
SELECT msp.refused('a table that holds no people', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'users', '00000000-0000-0000-0000-0000000005d1', 'trade')$q$, 'recordNeeded');
SELECT msp.refused('nobody with that id', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'people', gen_random_uuid(), 'trade')$q$, 'recordNotFound');
SELECT msp.refused('a job that is not there', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'people', '00000000-0000-0000-0000-0000000005b1', 'trade', NULL, 'bid', gen_random_uuid())$q$, 'jobNotFound');
SELECT msp.refused('a kind of job we do not have', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'people', '00000000-0000-0000-0000-0000000005b1', 'trade', NULL, 'ticket', gen_random_uuid())$q$, 'jobUnknown');
RESET ROLE;

-- 7 · A line's job and the star: an estimator ties Elena's email to the clinic, stars it, takes the star away, unties it.
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d2');
SET LOCAL ROLE authenticated;
SELECT public.tie_message((SELECT id FROM public.messages WHERE body = 'The start date goes Monday.'), 'project', '00000000-0000-0000-0000-0000000005f1');
SELECT msp.same('the line is on the clinic, and the clinic is on her rail without the star',
  (SELECT concat_ws('|', (SELECT project_id FROM public.messages WHERE body = 'The start date goes Monday.'),
    (SELECT string_agg(is_default::text, ',') FROM public.contact_jobs WHERE contact_id = elena)) FROM ids),
  '00000000-0000-0000-0000-0000000005f1|false');
SELECT public.set_default_job(elena, 'project', '00000000-0000-0000-0000-0000000005f1') FROM ids;
SELECT public.set_default_job(elena, 'project', '00000000-0000-0000-0000-0000000005f1') FROM ids;
SELECT msp.same('one star, on the clinic', (SELECT string_agg(is_default::text, ',') FROM public.contact_jobs WHERE contact_id = (SELECT elena FROM ids)), 'true');
SELECT public.set_default_job(elena, NULL, NULL) FROM ids;
SELECT public.tie_message((SELECT id FROM public.messages WHERE body = 'The start date goes Monday.'), NULL, NULL);
SELECT msp.same('no star, and the line on the person again',
  (SELECT concat_ws('|', (SELECT count(*) FROM public.contact_jobs WHERE contact_id = elena AND is_default),
    coalesce((SELECT project_id::text FROM public.messages WHERE body = 'The start date goes Monday.'), 'on the person')) FROM ids),
  '0|on the person');
SELECT msp.refused('no such line', $q$SELECT public.tie_message(gen_random_uuid(), 'project', '00000000-0000-0000-0000-0000000005f1')$q$, 'notFound');
SELECT msp.refused('a job needs its kind and its id', $q$SELECT public.set_default_job(elena, 'project', NULL) FROM ids$q$, 'jobUnknown');
RESET ROLE;

-- 8 · Training mode and the digital twin change nothing.
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d6');
SET LOCAL ROLE authenticated;
SELECT msp.refused('training mode ties no line', $q$SELECT public.tie_message((SELECT id FROM public.messages WHERE body = 'Greg here.'), 'project', '00000000-0000-0000-0000-0000000005f1')$q$, 'notFound');
SELECT msp.refused('training mode names nobody', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000005017', 'people', '00000000-0000-0000-0000-0000000005b1', 'trade')$q$, 'notFound');
RESET ROLE;
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d7');
SET LOCAL ROLE authenticated;
SELECT msp.refused('a twin ties no line', $q$SELECT public.tie_message((SELECT id FROM public.messages WHERE body = 'Greg here.'), 'project', '00000000-0000-0000-0000-0000000005f1')$q$, 'notFound');
SELECT msp.refused('a twin moves no star', $q$SELECT public.set_default_job(greg, 'project', '00000000-0000-0000-0000-0000000005f1') FROM ids$q$, 'notFound');
RESET ROLE;
SELECT msp.same('Greg''s line is still on the person', coalesce((SELECT project_id::text FROM public.messages WHERE body = 'Greg here.'), 'on the person'), 'on the person');

-- 9 · The app's screens delete a customer contact person and a roster person: the threads stay.
DELETE FROM public.customer_contact_persons WHERE id = '00000000-0000-0000-0000-0000000005e1';
SELECT msp.same('Elena''s contact is on the customer now, under her name, with her thread',
  (SELECT concat_ws('|', msp.who(elena), msp.thread(elena)) FROM ids),
  'customer|customer 00000000-0000-0000-0000-0000000005c1|Elena Marchetti|STOP / The start date goes Monday. / Tell her Monday.');
DELETE FROM public.people WHERE id = '00000000-0000-0000-0000-0000000005b1';
SELECT msp.same('Sam is a number again, keeping his name and his thread',
  concat_ws('|', msp.who('00000000-0000-0000-0000-000000005013'), msp.thread('00000000-0000-0000-0000-000000005013')),
  'unknown|no record|Sam Roster|Sam, running late.');

-- 10 · Merging the duplicate customer into the dental office keeps both threads, on the survivor.
SELECT msp.as_user('00000000-0000-0000-0000-0000000005d1');
SELECT public.merge_customers('00000000-0000-0000-0000-0000000005c3', '00000000-0000-0000-0000-0000000005c4', '{}'::jsonb);
SELECT msp.same('the duplicate and its contact are gone; both lines are the dental office''s, on its two numbers',
  (SELECT concat_ws('|',
    (SELECT count(*) FROM public.customers WHERE id = '00000000-0000-0000-0000-0000000005c4'),
    (SELECT count(*) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000005014'),
    msp.thread(bell),
    (SELECT string_agg(kind || ' ' || key, ', ' ORDER BY kind, key) FROM public.contact_channels WHERE contact_id = bell))
   FROM ids),
  '0|0|Bell asks about the bill. / The dental office, about the bill.|email office@belldental.example, phone 2105550177, phone 2105550190');

-- 11 · A record with a contact is not deleted from under it.
SELECT msp.refused('the trade partner stays while its contacts do', $q$DELETE FROM public.gc_companies WHERE id = '00000000-0000-0000-0000-0000000005a1'$q$, 'violates foreign key constraint');
SELECT msp.refused('a contact with a thread stays', $q$DELETE FROM public.contacts WHERE id = (SELECT greg FROM ids)$q$, 'violates foreign key constraint');

DO $$ BEGIN RAISE NOTICE 'messages_spine PASSED'; END $$;
ROLLBACK;
