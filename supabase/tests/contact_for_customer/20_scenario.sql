-- The door a customer's name opens their thread through (Messages, residential R2 PR 3a, migration
-- *_contact_for_customer): contact_for_customer finds the customer's own contact, or makes it with the number and the
-- address their row keeps, once, however often it is pressed; only the office team opens it, in words; a training
-- account and a digital twin find one and never make one; a customer deleted by the screens leaves their thread as a
-- number nobody has named that keeps the name, the people at the customer too. Fixtures are written as postgres;
-- presses run as each user; everything rolls back. Raises on the first failed assertion; ends with
-- "contact_for_customer PASSED". See scripts/pgtest-contact-for-customer.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an assistant), a superintendent outside it, an estimator in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c4d1', 'dev@door.test'),
  ('00000000-0000-0000-0000-00000000c4d2', 'assistant@door.test'),
  ('00000000-0000-0000-0000-00000000c4d3', 'super@door.test'),
  ('00000000-0000-0000-0000-00000000c4d4', 'training@door.test'),
  ('00000000-0000-0000-0000-00000000c4d5', 'twin@door.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000c4d1', 'dev@door.test', 'Door Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000c4d2', 'assistant@door.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000c4d3', 'super@door.test', 'Door Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000000c4d4', 'training@door.test', 'Door Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-00000000c4d5', 'twin@door.test', 'Door Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Dana Whitfield on Oakridge, with a number and an address as typed, and Mark at her house with a contact of his own.
-- Joe Ruiz, with nothing on file. The Hillside office, an architect the GC seed already made a contact for.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-00000000c4c1', 'Dana Whitfield', '00000000-0000-0000-0000-00000000c4d1',
   '{"phone": "+1 (512) 555-0182", "email": " Dana.Whitfield@Example.com "}'),
  ('00000000-0000-0000-0000-00000000c4c2', 'Joe Ruiz', '00000000-0000-0000-0000-00000000c4d1', '{}'),
  ('00000000-0000-0000-0000-00000000c4c3', 'Hillside Architects', '00000000-0000-0000-0000-00000000c4d1',
   '{"phone": "(210) 555-0140"}');
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone) VALUES
  ('00000000-0000-0000-0000-00000000c4b1', '00000000-0000-0000-0000-00000000c4c1', 'Mark Whitfield', '512-555-0190');
INSERT INTO public.contacts (id, kind, customer_contact_person_id) VALUES
  ('00000000-0000-0000-0000-00000000c4a1', 'customer', '00000000-0000-0000-0000-00000000c4b1');
INSERT INTO public.contacts (id, kind, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000c4a3', 'arch', '00000000-0000-0000-0000-00000000c4c3');

CREATE SCHEMA cfc;
CREATE FUNCTION cfc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION cfc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION cfc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION cfc.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- A contact as one line: its kind, which record, its name, and its channels' keys in order.
CREATE FUNCTION cfc.contact(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT x.kind || ' ' || coalesce(right(x.customer_id::text, 4), '-') || ' ' || coalesce(right(x.customer_contact_person_id::text, 4), '-')
    || ' ' || coalesce(x.name, '-') || ' [' || coalesce((SELECT string_agg(ch.kind || ':' || ch.key, ', ' ORDER BY ch.kind) FROM public.contact_channels ch WHERE ch.contact_id = x.id), '') || ']'
  FROM public.contacts x WHERE x.id = p_id
$$;
CREATE TABLE cfc.got (label text PRIMARY KEY, id uuid);
GRANT USAGE ON SCHEMA cfc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cfc TO anon, authenticated, service_role;
GRANT ALL ON cfc.got TO authenticated;

-- 1 · Who may open the door: the office team, said in words; nobody signed out.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d3');
SET LOCAL ROLE authenticated;
SELECT cfc.refused('a superintendent opens no customer''s messages', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')$q$,
  'Only the office opens a customer''s messages.');
RESET ROLE;
SELECT cfc.as_anon();
SET LOCAL ROLE anon;
SELECT cfc.refused('nobody signed out opens it', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')$q$, 'permission denied');
RESET ROLE;
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d2');
SET LOCAL ROLE authenticated;
SELECT cfc.refused('a customer not there', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-00000000c4ff')$q$,
  'That customer is not there.');
RESET ROLE;

-- 2 · Training mode and a twin make nothing, in words, and nothing is made.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d4');
SET LOCAL ROLE authenticated;
SELECT cfc.refused('a training account starts no thread', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')$q$,
  'A training account cannot start a customer''s thread.');
RESET ROLE;
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d5');
SET LOCAL ROLE authenticated;
SELECT cfc.refused('a twin starts no thread', $q$SELECT public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')$q$,
  'A digital twin cannot start a customer''s thread.');
RESET ROLE;
SELECT cfc.same('nothing was made for Dana', (
  SELECT count(*)::text FROM public.contacts WHERE customer_id = '00000000-0000-0000-0000-00000000c4c1'), '0');

-- 3 · The office makes Dana's own contact, with her number and address as keys, and Mark keeps his.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d2');
SET LOCAL ROLE authenticated;
INSERT INTO cfc.got VALUES ('dana', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1'));
RESET ROLE;
SELECT cfc.same('Dana''s own contact, her number and her address', cfc.contact((SELECT id FROM cfc.got WHERE label = 'dana')),
  'customer c4c1 - - [email:dana.whitfield@example.com, phone:5125550182]');
SELECT cfc.same('Mark keeps his own', cfc.contact('00000000-0000-0000-0000-00000000c4a1'), 'customer - c4b1 - []');

-- 4 · Pressed again, by anyone on the team, it is the same contact: one contact, two channels.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d1');
SET LOCAL ROLE authenticated;
SELECT cfc.same('a second press finds the same contact', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')::text,
  (SELECT id::text FROM cfc.got WHERE label = 'dana'));
RESET ROLE;
SELECT cfc.same('still one contact on Dana''s row and two channels', (
  SELECT count(*)::text || ' ' || (SELECT count(*) FROM public.contact_channels ch JOIN public.contacts x ON x.id = ch.contact_id WHERE x.customer_id = '00000000-0000-0000-0000-00000000c4c1')::text
  FROM public.contacts WHERE customer_id = '00000000-0000-0000-0000-00000000c4c1'), '1 2');

-- 5 · Training mode and a twin find the contact once it is there: a find is a read.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d4');
SET LOCAL ROLE authenticated;
SELECT cfc.same('a training account finds Dana''s', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')::text,
  (SELECT id::text FROM cfc.got WHERE label = 'dana'));
RESET ROLE;
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d5');
SET LOCAL ROLE authenticated;
SELECT cfc.same('a twin finds Dana''s', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c1')::text,
  (SELECT id::text FROM cfc.got WHERE label = 'dana'));
RESET ROLE;

-- 6 · Nothing on file makes a contact with no channel; a contact already there keeps its kind.
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d2');
SET LOCAL ROLE authenticated;
INSERT INTO cfc.got VALUES ('joe', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c2'));
SELECT cfc.same('the architect''s contact the seed made', public.contact_for_customer('00000000-0000-0000-0000-00000000c4c3')::text,
  '00000000-0000-0000-0000-00000000c4a3');
RESET ROLE;
SELECT cfc.same('Joe, with nothing on file', cfc.contact((SELECT id FROM cfc.got WHERE label = 'joe')), 'customer c4c2 - - []');
SELECT cfc.same('Hillside stays an architect with no channel added', cfc.contact('00000000-0000-0000-0000-00000000c4a3'), 'arch c4c3 - - []');

-- 7 · A customer deleted by the screens leaves the thread: Dana and Mark become numbers that keep their names.
INSERT INTO public.messages (contact_id, channel, direction, body)
SELECT id, 'text', 'in', 'Is Luis still coming at nine?' FROM cfc.got WHERE label = 'dana';
SELECT cfc.as_user('00000000-0000-0000-0000-00000000c4d1');
SET LOCAL ROLE authenticated;
DELETE FROM public.customers WHERE id = '00000000-0000-0000-0000-00000000c4c1';
RESET ROLE;
SELECT cfc.same('Dana is gone from Customers', (SELECT count(*)::text FROM public.customers WHERE id = '00000000-0000-0000-0000-00000000c4c1'), '0');
SELECT cfc.same('her contact keeps her name, her number and her line', cfc.contact((SELECT id FROM cfc.got WHERE label = 'dana'))
  || ' ' || (SELECT count(*)::text FROM public.messages m JOIN cfc.got g ON g.id = m.contact_id WHERE g.label = 'dana'),
  'unknown - - Dana Whitfield [email:dana.whitfield@example.com, phone:5125550182] 1');
SELECT cfc.same('Mark''s keeps his name', cfc.contact('00000000-0000-0000-0000-00000000c4a1'), 'unknown - - Mark Whitfield []');

DO $$ BEGIN RAISE NOTICE 'contact_for_customer PASSED'; END $$;
ROLLBACK;
