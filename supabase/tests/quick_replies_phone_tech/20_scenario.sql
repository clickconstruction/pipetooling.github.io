-- The tech reads the phone's lines (Messages, residential R5, migration *_quick_replies_phone_tech): a primary and a
-- helper read the team's customer lines on the phone, with their Spanish, button name, place and step, and nothing
-- else; a line off the phone, a removed line, a trade partner's, anyone's and a line kept for one person stay the
-- office's; no tech reads a version; a subcontractor and anon read none; the office still reads every team line; and
-- a tech writes nothing. Everything rolls back. Raises on the first failed assertion; ends with
-- "quick_replies_phone_tech PASSED". See scripts/pgtest-quick-replies-phone-tech.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (Rosa, an assistant), Luis (primary) and Nico (helpers) in the field, a sub, and a tech in training mode.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e2a01', 'rosa@phone.test'),
  ('00000000-0000-0000-0000-0000000e2a02', 'luis@phone.test'),
  ('00000000-0000-0000-0000-0000000e2a03', 'nico@phone.test'),
  ('00000000-0000-0000-0000-0000000e2a04', 'sub@phone.test'),
  ('00000000-0000-0000-0000-0000000e2a05', 'training@phone.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e2a01', 'rosa@phone.test', 'Phone Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e2a02', 'luis@phone.test', 'Phone Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e2a03', 'nico@phone.test', 'Phone Nico', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e2a04', 'sub@phone.test', 'Phone Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000e2a05', 'training@phone.test', 'Phone Training', 'primary', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The lines, as the editor would leave them. Made-up words.
INSERT INTO public.quick_replies (id, text, for_kind, step_key, scope, added_by, removed_at, phone_order, phone_name, text_es) VALUES
  ('00000000-0000-0000-0000-0000000e2b01', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', 'customer', 'onway', 'team', '00000000-0000-0000-0000-0000000e2a01', NULL, 1, 'On my way',
   '{first}, soy {me} de Click Plumbing. Voy en camino, a unos {minutes} minutos.'),
  ('00000000-0000-0000-0000-0000000e2b02', '{first}, I am running late. The new window is {window}.', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e2a01', NULL, 2, NULL, NULL),
  ('00000000-0000-0000-0000-0000000e2b03', '{first}, thank you for having us today.', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e2a01', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000000e2b04', '{first}, we will be back {back day}.', 'customer', NULL, 'team', '00000000-0000-0000-0000-0000000e2a01', now(), 3, NULL, NULL),
  ('00000000-0000-0000-0000-0000000e2b05', 'Your draw is approved.', 'trade', NULL, 'team', '00000000-0000-0000-0000-0000000e2a01', NULL, 4, NULL, NULL),
  ('00000000-0000-0000-0000-0000000e2b06', 'Thanks, we got it.', 'any', NULL, 'team', '00000000-0000-0000-0000-0000000e2a01', NULL, 5, NULL, NULL),
  ('00000000-0000-0000-0000-0000000e2b07', '{first}, Luis here, I parked out front.', 'customer', NULL, 'mine', '00000000-0000-0000-0000-0000000e2a02', NULL, 6, NULL, NULL);
INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind, to_step_key, by_user_id) VALUES
  ('00000000-0000-0000-0000-0000000e2b01', 'added', '{first}, this is {me} with Click Plumbing. I am on my way, about {minutes} minutes out.', 'customer', 'onway', '00000000-0000-0000-0000-0000000e2a01');

CREATE SCHEMA qpt;
CREATE FUNCTION qpt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION qpt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION qpt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION qpt.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
GRANT USAGE ON SCHEMA qpt TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qpt TO anon, authenticated, service_role;

-- What the signed-in person reads of this bed's lines: "b1 1 On my way", in place order.
CREATE VIEW qpt.lines WITH (security_invoker = true) AS
  SELECT coalesce(string_agg('b' || right(q.id::text, 1) || ' ' || coalesce(q.phone_order::text, '-'), ', ' ORDER BY q.id), 'none') AS seen
  FROM public.quick_replies q WHERE q.id::text LIKE '00000000-0000-0000-0000-0000000e2b%';
GRANT SELECT ON qpt.lines TO anon, authenticated;

-- 1 · Luis, a primary, reads the two team customer lines on the phone, with their words.
SET LOCAL ROLE authenticated;
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a02');
SELECT qpt.same('a primary reads the team''s customer lines on the phone', (SELECT seen FROM qpt.lines), 'b1 1, b2 2');
SELECT qpt.same('with the words, the Spanish, the button name and the step', (
  SELECT phone_name || ' | ' || step_key || ' | ' || left(text_es, 20) || ' | ' || left(text, 16)
  FROM public.quick_replies WHERE id = '00000000-0000-0000-0000-0000000e2b01'), 'On my way | onway | {first}, soy {me} de | {first}, this is');
SELECT qpt.same('a primary reads no version', (
  SELECT count(*)::text FROM public.quick_reply_versions WHERE quick_reply_id::text LIKE '00000000-0000-0000-0000-0000000e2b%'), '0');
SELECT qpt.same('a line a primary kept for themself does not reach the phone', (
  SELECT count(*)::text FROM public.quick_replies WHERE id = '00000000-0000-0000-0000-0000000e2b07'), '0');
SELECT qpt.refused('a primary writes no line by hand',
  $q$UPDATE public.quick_replies SET phone_order = 9 WHERE id = '00000000-0000-0000-0000-0000000e2b01'$q$, 'permission denied');
SELECT qpt.refused('a primary adds no line by hand',
  $q$INSERT INTO public.quick_replies (text, for_kind, scope, phone_order) VALUES ('x', 'customer', 'team', 7)$q$, 'permission denied');

-- 2 · Nico, a helper, and a tech in training mode read the same two.
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a03');
SELECT qpt.same('a helper reads the same two', (SELECT seen FROM qpt.lines), 'b1 1, b2 2');
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a05');
SELECT qpt.same('a tech in training mode reads them too', (SELECT seen FROM qpt.lines), 'b1 1, b2 2');

-- 3 · A sub and anon read none.
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a04');
SELECT qpt.same('a subcontractor reads none', (SELECT seen FROM qpt.lines), 'none');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT qpt.as_anon();
SELECT qpt.refused('anon reads none', $q$SELECT count(*) FROM public.quick_replies$q$, 'permission denied');
RESET ROLE;

-- 4 · The office still reads every team line, on the phone or not, removed or not, and its version.
SET LOCAL ROLE authenticated;
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a01');
SELECT qpt.same('the office reads every team line', (SELECT seen FROM qpt.lines), 'b1 1, b2 2, b3 -, b4 3, b5 4, b6 5');
SELECT qpt.same('the office reads the version', (
  SELECT count(*)::text FROM public.quick_reply_versions WHERE quick_reply_id = '00000000-0000-0000-0000-0000000e2b01'), '1');
RESET ROLE;

-- 5 · A line taken off the phone, or removed, leaves the tech's phone.
UPDATE public.quick_replies SET phone_order = NULL WHERE id = '00000000-0000-0000-0000-0000000e2b02';
UPDATE public.quick_replies SET removed_at = now() WHERE id = '00000000-0000-0000-0000-0000000e2b01';
SET LOCAL ROLE authenticated;
SELECT qpt.as_user('00000000-0000-0000-0000-0000000e2a02');
SELECT qpt.same('off the phone and removed, the tech reads none', (SELECT seen FROM qpt.lines), 'none');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'quick_replies_phone_tech PASSED'; END $$;
ROLLBACK;
