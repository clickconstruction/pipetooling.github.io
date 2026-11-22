-- Bids and permits, the read behind a bid's site (v2.8220, punch list #307, migration *_bid_site_permits_one_order):
-- bid_site_permits answers newest first, a permit with no day last, then by number, type and id, so one permit in
-- both of a city's feeds on one day falls the same way on every call; at the function's limit of 5,000 rows a tie on
-- the last place keeps the same twin every time; a house number is matched trimmed and lower-cased and asked twice
-- counts once; another house number and another city stay out; the office reads the same answer under its own access
-- and anon runs nothing. Fixtures are written as postgres; one read runs under RLS as the office; everything rolls
-- back. Raises on the first failed assertion; ends with "bid_site_permits PASSED". See
-- scripts/pgtest-bid-site-permits.sh. Never against prod. Every city, street and name is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000b517a1', 'dee@site.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-000000b517a1', 'dee@site.test', 'Dee Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- Bedtown, house number 4410. The twin with the later id is written first, so an order that left the tie to the
-- heap would more likely put it first. `tw1` and `tw2` are one permit in two feeds on one day: issued in one,
-- applied for in the other.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, address, address_key, submitted_on, issued_on) VALUES
  ('00000000-0000-0000-0000-000000b51702', 'Bedtown', 'bed-applied', 'COM-200', 'Commercial', 'building', 'applied', '4410 Larkspur Row', '4410 larkspur row', '2026-10-05', NULL),
  ('00000000-0000-0000-0000-000000b51701', 'Bedtown', 'bed-issued',  'COM-200', 'Commercial', 'building', 'issued',  '4410 Larkspur Row', '4410 larkspur row', '2026-09-01', '2026-10-05'),
  -- Newer than the twins: first.
  ('00000000-0000-0000-0000-000000b51703', 'Bedtown', 'bed-issued',  'COM-900', 'Commercial', 'building', 'issued',  '4410 Larkspur Row', '4410 larkspur row', NULL, '2026-11-01'),
  -- No day at all: last.
  ('00000000-0000-0000-0000-000000b51704', 'Bedtown', 'file',        'COM-001', 'Commercial', 'building', 'applied', '4410 Larkspur Row', '4410 larkspur row', NULL, NULL),
  -- The twins' day, an earlier number: before them.
  ('00000000-0000-0000-0000-000000b51705', 'Bedtown', 'bed-issued',  'COM-100', 'Commercial', 'building', 'issued',  '4410 Larkspur Row', '4410 larkspur row', NULL, '2026-10-05'),
  -- The twins' day and number, an earlier type: between the two.
  ('00000000-0000-0000-0000-000000b51706', 'Bedtown', 'bed-issued',  'COM-200', 'Alteration', 'building', 'issued',  '4410 Larkspur Row', '4410 larkspur row', NULL, '2026-10-05'),
  -- Another house number, another city, and a row with no address key: never in the answer.
  ('00000000-0000-0000-0000-000000b51707', 'Bedtown', 'bed-issued',  'COM-300', 'Commercial', 'building', 'issued',  '77 Larkspur Row',   '77 larkspur row',   NULL, '2026-10-20'),
  ('00000000-0000-0000-0000-000000b51708', 'Farfield', 'bed-issued', 'COM-400', 'Commercial', 'building', 'issued',  '4410 Larkspur Row', '4410 larkspur row', NULL, '2026-10-21'),
  ('00000000-0000-0000-0000-000000b51709', 'Bedtown', 'bed-issued',  'COM-500', 'Commercial', 'building', 'issued',  NULL,                NULL,                NULL, '2026-10-22');

-- Cutville, house number 12: 4,999 permits of this month, then one permit in two feeds on an older day. The
-- function stops at 5,000 rows, so one twin is in and one is out. The later id is written first again.
INSERT INTO public.permits (city, source, permit_number, permit_type, kind, stage, address, address_key, issued_on)
SELECT 'Cutville', 'bed-issued', 'CUT-' || lpad(g::text, 5, '0'), 'Plumbing', 'plumbing', 'issued', '12 Quarry Lane', '12 quarry lane', DATE '2026-11-10'
FROM generate_series(1, 4999) AS g;
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, address, address_key, submitted_on, issued_on) VALUES
  ('00000000-0000-0000-0000-000000b517c2', 'Cutville', 'bed-applied', 'OLD-1', 'Commercial', 'building', 'applied', '12 Quarry Lane', '12 quarry lane', '2026-01-15', NULL),
  ('00000000-0000-0000-0000-000000b517c1', 'Cutville', 'bed-issued',  'OLD-1', 'Commercial', 'building', 'issued',  '12 Quarry Lane', '12 quarry lane', NULL, '2026-01-15');

CREATE SCHEMA bsp;
GRANT USAGE ON SCHEMA bsp TO authenticated, anon, service_role;
CREATE FUNCTION bsp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bsp.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The answer for one city and its numbers as the last two characters of each id, in the order returned.
CREATE FUNCTION bsp.answer(p_city text, p_numbers text[]) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(right(t.id::text, 2), ' ' ORDER BY t.ord)
  FROM public.bid_site_permits(p_city, p_numbers) WITH ORDINALITY AS t(id, permit_number, permit_type, kind, stage, work_type, project_name, address, submitted_on, issued_on, declared_value, area_sf, contact, builder_key, ord);
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bsp TO authenticated, anon, service_role;

-- 1. The order: the day, a permit with no day last, the number, the type, then the id.
SELECT bsp.same('newest first, then number, type and id, and no day last', bsp.answer('Bedtown', ARRAY['4410']), '03 05 06 01 02 04');
SELECT bsp.same('the same order on a second call', bsp.answer('Bedtown', ARRAY['4410']), '03 05 06 01 02 04');

-- 2. What is asked for.
SELECT bsp.same('a house number is trimmed and lower-cased, and asked twice counts once', bsp.answer('Bedtown', ARRAY[' 4410 ', '4410', '', NULL]), '03 05 06 01 02 04');
SELECT bsp.same('two house numbers in one ask', bsp.answer('Bedtown', ARRAY['77', '4410']), '03 07 05 06 01 02 04');
SELECT bsp.same('another city''s permit on the same number stays in its city', bsp.answer('Farfield', ARRAY['4410']), '08');
SELECT bsp.same('no numbers, no rows', (SELECT count(*)::text FROM public.bid_site_permits('Bedtown', NULL)), '0');

-- 3. The cut at 5,000: a tie on the last place keeps the twin with the earlier id, on every call.
SELECT bsp.same('the read stops at 5,000 rows', (SELECT count(*)::text FROM public.bid_site_permits('Cutville', ARRAY['12'])), '5000');
SELECT bsp.same('the last place goes to the twin with the earlier id',
  (SELECT string_agg(right(id::text, 2), ' ' ORDER BY id) FROM public.bid_site_permits('Cutville', ARRAY['12']) WHERE permit_number = 'OLD-1'), 'c1');
SELECT bsp.same('and again on a second call',
  (SELECT string_agg(right(id::text, 2), ' ' ORDER BY id) FROM public.bid_site_permits('Cutville', ARRAY['12']) WHERE permit_number = 'OLD-1'), 'c1');

-- 4. Rights: the office reads the same answer under its own access, and anon runs nothing.
SET LOCAL ROLE authenticated;
SELECT bsp.sign_in('00000000-0000-0000-0000-000000b517a1');
SELECT bsp.same('the office reads the same answer through its own access', bsp.answer('Bedtown', ARRAY['4410']), '03 05 06 01 02 04');
RESET ROLE;
SELECT bsp.same('anon cannot run it', has_function_privilege('anon', 'public.bid_site_permits(text, text[])', 'execute')::text, 'false');
SELECT bsp.same('it reads under the caller''s own access', (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.bid_site_permits(text, text[])'::regprocedure), 'false');

DO $$ BEGIN RAISE NOTICE 'bid_site_permits PASSED'; END $$;
ROLLBACK;
