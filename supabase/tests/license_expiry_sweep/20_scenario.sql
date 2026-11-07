-- The license-expiry notices sweep (v2.6630, punch list #253, migration *_license_expiry_notices_sweep): with no
-- signed-in user, as pg_cron runs it, the sweep files one open dispatch_requests row under the portal's sender for
-- every license inside the thirty-day window whose stamp is null and stamps each one; a license expiring today is
-- inside the window and one already lapsed, one 45 days out and one already stamped are left alone; a second run
-- files nothing; with the portal setting gone the first dev is the sender; a signed-in assistant is refused in words
-- and files nothing while a signed-in dev may run it; and the Save path still files its row under the saver's own
-- name through the shared row-maker, once. Fixtures are written as postgres; everything rolls back. Raises on the
-- first failed assertion; ends with "license_expiry_sweep PASSED". See scripts/pgtest-license-expiry-sweep.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Pat is the portal's sender (an assistant); Dee is a dev; Ann is an assistant outside the Dispatch group.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000253a0a1', 'pat@sweep.test'),
  ('00000000-0000-0000-0000-00000253a0a2', 'dee@sweep.test'),
  ('00000000-0000-0000-0000-00000253a0a3', 'ann@sweep.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000253a0a1', 'pat@sweep.test', 'Pat Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000253a0a2', 'dee@sweep.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000253a0a3', 'ann@sweep.test', 'Ann Assist', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.dispatch_group_members (user_id) VALUES ('00000000-0000-0000-0000-00000253a0a1');
INSERT INTO public.app_settings (key, value_text) VALUES ('portal_requests_from_user_id', '00000000-0000-0000-0000-00000253a0a1')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;

-- Five licenses: ten days out (null stamp), today (null stamp), ten days out but already stamped, lapsed 40 days ago,
-- 45 days out.
INSERT INTO public.person_licenses (id, person_name, license_type, date_of_expiry, expiry_dispatch_notified_at) VALUES
  ('00000000-0000-0000-0000-00000253b001', 'ZZ Test Ten', 'Journeyman Plumber J-1001', CURRENT_DATE + 10, NULL),
  ('00000000-0000-0000-0000-00000253b002', 'ZZ Test Today', 'Tradesman Plumber T-1002', CURRENT_DATE, NULL),
  ('00000000-0000-0000-0000-00000253b003', 'ZZ Test Stamped', 'Master Plumber M-1003', CURRENT_DATE + 10, now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000253b004', 'ZZ Test Lapsed', 'Journeyman Plumber J-1004', CURRENT_DATE - 40, NULL),
  ('00000000-0000-0000-0000-00000253b005', 'ZZ Test Far', 'Journeyman Plumber J-1005', CURRENT_DATE + 45, NULL);

CREATE SCHEMA les;
CREATE FUNCTION les.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION les.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION les.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- The notices on file for the bed's licenses: person · sender's last two · status, in expiry order.
CREATE FUNCTION les.notices() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(regexp_replace(title, '^License expiring: (.*) — .*$', '\1') || ' / from ' || right(from_user_id::text, 2) || ' / ' || status, ' ; ' ORDER BY title), '(none)')
  FROM public.dispatch_requests WHERE title LIKE 'License expiring: ZZ Test %'
$$;
CREATE FUNCTION les.stamped() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT string_agg(person_name || ':' || CASE WHEN expiry_dispatch_notified_at IS NULL THEN 'null' ELSE 'stamped' END, ' ; ' ORDER BY id)
  FROM public.person_licenses WHERE person_name LIKE 'ZZ Test %'
$$;
CREATE FUNCTION les.sweep() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.license_expiry_notices_sweep() $$;
GRANT USAGE ON SCHEMA les TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA les TO authenticated;

-- 1 · The morning run: no signed-in user, as pg_cron runs it.
SELECT les.as_nobody();
SELECT les.same('the first run files two and names the sender', (SELECT (r->>'ok') || ' / filed ' || (r->>'filed') || ' / from ' || right(r->>'from_user_id', 2) FROM les.sweep() r), 'true / filed 2 / from a1');
SELECT les.same('ten days out and today are asked about, under Pat', les.notices(), 'ZZ Test Ten / from a1 / open ; ZZ Test Today / from a1 / open');
SELECT les.same('the two are stamped; stamped, lapsed and far stay as they were', les.stamped(), 'ZZ Test Ten:stamped ; ZZ Test Today:stamped ; ZZ Test Stamped:stamped ; ZZ Test Lapsed:null ; ZZ Test Far:null');
SELECT les.same('the row carries the Licenses tab link', (SELECT links[1] FROM public.dispatch_requests WHERE title LIKE 'License expiring: ZZ Test Ten%'), 'https://clicktooling.com/people?tab=licenses');
SELECT les.same('the title reads as the Save path''s does', (SELECT title FROM public.dispatch_requests WHERE title LIKE 'License expiring: ZZ Test Ten%'), 'License expiring: ZZ Test Ten — Journeyman Plumber J-1001 expires ' || (CURRENT_DATE + 10)::text || ' · Open [1]');

-- 2 · A second run files nothing: the stamp is the once-only.
SELECT les.same('a second run files nothing', (SELECT (r->>'ok') || ' / filed ' || (r->>'filed') FROM les.sweep() r), 'true / filed 0');
SELECT les.same('still two notices', (SELECT count(*)::text FROM public.dispatch_requests WHERE title LIKE 'License expiring: ZZ Test %'), '2');

-- 3 · With the portal setting gone, the first dev is the sender.
DELETE FROM public.app_settings WHERE key = 'portal_requests_from_user_id';
UPDATE public.users SET archived_at = NULL WHERE id = '00000000-0000-0000-0000-00000253a0a2';
INSERT INTO public.person_licenses (id, person_name, license_type, date_of_expiry, expiry_dispatch_notified_at) VALUES
  ('00000000-0000-0000-0000-00000253b006', 'ZZ Test Six', 'Journeyman Plumber J-1006', CURRENT_DATE + 6, NULL);
SELECT les.same('with no setting the sender is a dev', (SELECT (SELECT role::text FROM public.users WHERE id = (r->>'from_user_id')::uuid) || ' / filed ' || (r->>'filed') FROM les.sweep() r), 'dev / filed 1');

-- 4 · A signed-in assistant is refused in words and files nothing; a signed-in dev may run it.
INSERT INTO public.person_licenses (id, person_name, license_type, date_of_expiry, expiry_dispatch_notified_at) VALUES
  ('00000000-0000-0000-0000-00000253b007', 'ZZ Test Seven', 'Journeyman Plumber J-1007', CURRENT_DATE + 7, NULL);
SELECT les.as_user('00000000-0000-0000-0000-00000253a0a3');
SET LOCAL ROLE authenticated;
SELECT les.same('an assistant is refused', (SELECT (r->>'ok') || ' / ' || (r->>'reason') FROM les.sweep() r), 'false / Only the morning sweep or a dev runs the license notices sweep.');
RESET ROLE;
SELECT les.same('and nothing was filed for Seven', les.stamped(), 'ZZ Test Ten:stamped ; ZZ Test Today:stamped ; ZZ Test Stamped:stamped ; ZZ Test Lapsed:null ; ZZ Test Far:null ; ZZ Test Six:stamped ; ZZ Test Seven:null');
SELECT les.as_user('00000000-0000-0000-0000-00000253a0a2');
SET LOCAL ROLE authenticated;
SELECT les.same('a dev may run it now', (SELECT (r->>'ok') || ' / filed ' || (r->>'filed') FROM les.sweep() r), 'true / filed 1');
RESET ROLE;

-- 5 · The Save path still files under the saver's own name, once, through the shared row-maker.
INSERT INTO public.person_licenses (id, person_name, license_type, date_of_expiry, expiry_dispatch_notified_at) VALUES
  ('00000000-0000-0000-0000-00000253b008', 'ZZ Test Eight', 'Journeyman Plumber J-1008', CURRENT_DATE + 8, NULL);
SELECT les.as_user('00000000-0000-0000-0000-00000253a0a3');
SET LOCAL ROLE authenticated;
SELECT les.same('Ann''s Save files a row under her name', (SELECT right(from_user_id::text, 2) FROM public.dispatch_requests WHERE id = public.notify_dispatch_license_expiry_if_needed('00000000-0000-0000-0000-00000253b008', 'https://clicktooling.com/people?tab=licenses')), 'a3');
SELECT les.same('a second Save files nothing', COALESCE(public.notify_dispatch_license_expiry_if_needed('00000000-0000-0000-0000-00000253b008', 'https://clicktooling.com/people?tab=licenses')::text, 'null'), 'null');
SELECT les.same('the lapsed license is never asked about', COALESCE(public.notify_dispatch_license_expiry_if_needed('00000000-0000-0000-0000-00000253b004', 'https://clicktooling.com/people?tab=licenses')::text, 'null'), 'null');
RESET ROLE;
SELECT les.as_nobody();
SELECT les.same('the sweep after the Save files nothing more', (SELECT (r->>'filed') FROM les.sweep() r), '0');
SELECT les.same('five notices in all', (SELECT count(*)::text FROM public.dispatch_requests WHERE title LIKE 'License expiring: ZZ Test %'), '5');

DO $$ BEGIN RAISE NOTICE 'license_expiry_sweep PASSED'; END $$;
ROLLBACK;
