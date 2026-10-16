-- On my way and I'm here (v2.5573, punch list #112): the seeds, the press moving between lines, each refusal, a
-- geocoded address's point for a helper, and a helper's own two stamps on a clock session. Runs as each person
-- through RLS; everything inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "on-my-way PASSED". See scripts/pgtest-on-my-way.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000072e1', 'helper@onmyway.test'),
  ('00000000-0000-0000-0000-0000000072e2', 'assistant@onmyway.test'),
  ('00000000-0000-0000-0000-0000000072e3', 'trainee@onmyway.test'),
  ('00000000-0000-0000-0000-0000000072e4', 'other@onmyway.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000072e1', 'helper@onmyway.test', 'Way Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000072e2', 'assistant@onmyway.test', 'Way Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000072e3', 'trainee@onmyway.test', 'Way Trainee', 'helpers'),
  ('00000000-0000-0000-0000-0000000072e4', 'other@onmyway.test', 'Way Other Helper', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000072e3';

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
-- The live press lines as one line: "press:name:scope:kind:on_phone".
CREATE FUNCTION tt.presses() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(q.phone_press || ':' || COALESCE(q.phone_name, '-') || ':' || q.scope || ':' || q.for_kind || ':' || (q.phone_order IS NOT NULL)::text, ',' ORDER BY q.phone_press), '(none)')
  FROM public.quick_replies q WHERE q.phone_press IS NOT NULL AND q.removed_at IS NULL $$;
CREATE FUNCTION tt.phone_versions() RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT count(*)::integer FROM public.quick_reply_versions v WHERE v.kind = 'phone' $$;
GRANT USAGE ON SCHEMA tt TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tt TO authenticated, anon;

-- Sign in as one person for the statements that follow, through RLS.
CREATE FUNCTION tt.as_user(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', CASE WHEN p_user IS NULL THEN '' ELSE json_build_object('sub', p_user, 'role', 'authenticated')::text END, true),
         set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true) $$;
GRANT EXECUTE ON FUNCTION tt.as_user(uuid) TO authenticated, anon;

-- 0 · The seeds: the prototype's lines hold no {minutes}, so both lines were added, on the phone, team, for customers.
SELECT tt.same('the two seeded press lines', tt.presses(), 'im_here:I’m here:team:customer:true,on_my_way:On my way:team:customer:true');
SELECT tt.same('each seeded line has its added and phone versions',
  (SELECT string_agg(v.kind, ',' ORDER BY v.kind) FROM public.quick_reply_versions v JOIN public.quick_replies q ON q.id = v.quick_reply_id WHERE q.phone_press = 'on_my_way'),
  'added,phone');
SELECT tt.same('the On my way line uses the minutes blank',
  (SELECT (q.text LIKE '%{minutes}%')::text FROM public.quick_replies q WHERE q.phone_press = 'on_my_way'), 'true');
SELECT tt.same('the I’m here line uses the address blank',
  (SELECT (q.text LIKE '%{address}%')::text FROM public.quick_replies q WHERE q.phone_press = 'im_here'), 'true');

-- 1 · A helper reads both press lines through the phone's policy, press and all.
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('a helper reads the two press lines', (SELECT count(*)::text FROM public.quick_replies WHERE phone_press IS NOT NULL), '2');
RESET ROLE;

-- 2 · The office points On my way at another line on the phone; the press leaves the old line; the same again is nothing; clear and set back.
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e2');
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE ids AS SELECT public.add_quick_reply('{first}, {me} here. About {minutes} minutes out, see you soon.', 'customer', NULL, false) AS second_id;
SELECT public.edit_quick_reply((SELECT second_id FROM ids), '{first}, {me} here. About {minutes} minutes out, see you soon.', 'customer', NULL, NULL, 9, 'Soon');
SELECT tt.same('a press moves: one line cleared, one set', public.set_quick_reply_press((SELECT second_id FROM ids), 'on_my_way')::text, '2');
SELECT tt.same('the second line holds On my way now', tt.presses(), 'im_here:I’m here:team:customer:true,on_my_way:Soon:team:customer:true');
SELECT tt.same('the same press again changes nothing', public.set_quick_reply_press((SELECT second_id FROM ids), 'on_my_way')::text, '0');
SELECT tt.same('a clear takes the press off', public.set_quick_reply_press((SELECT second_id FROM ids), NULL)::text, '1');
SELECT tt.same('no line holds On my way', tt.presses(), 'im_here:I’m here:team:customer:true');
-- The seed wrote one phone version per line (2) and the edit one (the place); the three moves wrote 2 + 0 + 1.
SELECT tt.same('a phone version per line that changed', (tt.phone_versions() - 2 - 1)::text, '3');
SELECT public.set_quick_reply_press((SELECT q.id FROM public.quick_replies q WHERE q.phone_name = 'On my way' AND q.removed_at IS NULL), 'on_my_way');
SELECT tt.same('set back on the seeded line', tt.presses(), 'im_here:I’m here:team:customer:true,on_my_way:On my way:team:customer:true');

-- 3 · The refusals, in words.
SELECT tt.refused('an unknown press', $$SELECT public.set_quick_reply_press((SELECT second_id FROM ids), 'arrived')$$, 'The phone has no such big button.');
SELECT tt.refused('a line that is not there', $$SELECT public.set_quick_reply_press('00000000-0000-0000-0000-000000000000', 'im_here')$$, 'That line is not there.');
SELECT tt.refused('a line off the phone', $$SELECT public.set_quick_reply_press((SELECT q.id FROM public.quick_replies q WHERE q.text = 'Got it, thank you.' LIMIT 1), 'im_here')$$, 'Only a team line for customers on the phone can be a big button.');
SELECT public.remove_quick_reply((SELECT second_id FROM ids));
SELECT tt.refused('a removed line', $$SELECT public.set_quick_reply_press((SELECT second_id FROM ids), 'on_my_way')$$, 'Bring the line back before you change it.');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e1');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a helper cannot point a press', $$SELECT public.set_quick_reply_press((SELECT q.id FROM public.quick_replies q WHERE q.phone_press = 'im_here'), 'on_my_way')$$, 'Only the office can change a quick reply.');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e3');
SET LOCAL ROLE authenticated;
SELECT tt.refused('a training account cannot', $$SELECT public.set_quick_reply_press((SELECT q.id FROM public.quick_replies q WHERE q.phone_press = 'im_here'), 'on_my_way')$$, 'A training account cannot change a quick reply.');
RESET ROLE;
SELECT tt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT tt.refused('no sign-in', $$SELECT public.set_quick_reply_press((SELECT q.id FROM public.quick_replies q WHERE q.phone_press = 'im_here'), 'on_my_way')$$, 'Sign in to change a quick reply.');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT tt.refused('anon has no execute', $$SELECT public.set_quick_reply_press('00000000-0000-0000-0000-000000000000', 'im_here')$$, 'permission denied');
RESET ROLE;

-- 4 · The point: a helper reads a geocoded address through the definer; an address never placed reads nothing; no sign-in is refused.
INSERT INTO public.address_geocodes (address_normalized, lat, lng) VALUES ('1208 mesquite ln', 29.653, -97.797);
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e1');
SET LOCAL ROLE authenticated;
SELECT tt.same('a helper reads the point', (SELECT lat::text || ',' || lng::text FROM public.address_point('1208 mesquite ln')), '29.653,-97.797');
SELECT tt.same('an address never placed reads nothing', (SELECT count(*)::text FROM public.address_point('9 nowhere ct')), '0');
SELECT tt.same('the table itself stays closed to a helper', (SELECT count(*)::text FROM public.address_geocodes), '0');
RESET ROLE;
SELECT tt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT tt.refused('no sign-in reads no point', $$SELECT * FROM public.address_point('1208 mesquite ln')$$, 'Sign in to read an address');
RESET ROLE;

-- 5 · The stamps: a helper's own session takes travel_started_at on the insert and arrived_at on the press; another helper changes nothing.
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e1');
SET LOCAL ROLE authenticated;
INSERT INTO public.clock_sessions (user_id, clocked_in_at, work_date, notes, travel_started_at)
VALUES ('00000000-0000-0000-0000-0000000072e1', now() - interval '19 minutes', current_date, 'On my way to PLUM 512 · Whitfield water heater, about 20 min', now() - interval '19 minutes');
UPDATE public.clock_sessions SET arrived_at = now(), arrived_lat = 29.653, arrived_lng = -97.797, arrived_location_source = 'gps'
WHERE user_id = '00000000-0000-0000-0000-0000000072e1' AND clocked_out_at IS NULL AND arrived_at IS NULL;
SELECT tt.same('the two stamps on the helper''s own row',
  (SELECT (travel_started_at IS NOT NULL)::text || ' ' || (arrived_at >= travel_started_at)::text || ' ' || arrived_location_source FROM public.clock_sessions WHERE user_id = '00000000-0000-0000-0000-0000000072e1'),
  'true true gps');
RESET ROLE;
SELECT tt.as_user('00000000-0000-0000-0000-0000000072e4');
SET LOCAL ROLE authenticated;
UPDATE public.clock_sessions SET arrived_at = NULL WHERE user_id = '00000000-0000-0000-0000-0000000072e1';
RESET ROLE;
SELECT tt.same('another helper''s update touches nothing',
  (SELECT (arrived_at IS NOT NULL)::text FROM public.clock_sessions WHERE user_id = '00000000-0000-0000-0000-0000000072e1'), 'true');

DO $$ BEGIN RAISE NOTICE 'on-my-way PASSED'; END $$;
ROLLBACK;
