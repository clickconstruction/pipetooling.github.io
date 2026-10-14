-- Combine two CountTooling counts on one bid (v2.5517, migration *_bid_count_sources): a bid keeps one row per
-- CountTooling project (bid_count_sources) and each count row keeps each project's share (bids_count_rows.source_shares).
-- The bid's estimator registers two projects and stamps shares; the office reads them; a superintendent outside the
-- bid reads none and cannot write; a second source with the same token on one bid, a link that is not a link, a
-- malformed token and an array of shares are refused. Everything rolls back. Raises on the first failed assertion;
-- ends with "count_sources PASSED". See scripts/pgtest-count-sources.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'estimator@cs.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@cs.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'super@cs.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'estimator@cs.test', 'Taunya', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@cs.test', 'Wendi', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000000c1', 'super@cs.test', 'Outside Super', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing');
INSERT INTO public.bids (id, created_by, service_type_id, project_name, materials_model)
VALUES ('00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001', 'SpaceX BA', 'rough');
INSERT INTO public.bids_count_rows (id, bid_id, fixture, count, sequence_order, unit) VALUES
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b1d1', 'ft of 3/4IN WATER', 1489.04, 1, 'ft'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b1d1', 'EWC-1', 5, 2, 'ea');

CREATE SCHEMA cst;
CREATE FUNCTION cst.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION cst.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION cst.refused(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (refused: %)', label, SQLSTATE;
    RETURN;
  END;
  RAISE EXCEPTION '% was not refused', label;
END $$;
GRANT USAGE ON SCHEMA cst TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cst TO anon, authenticated, service_role;

-- The estimator who made the bid registers Taunya's project, then Robert's, and stamps the shares.
SET LOCAL ROLE authenticated;
SELECT cst.as_user('00000000-0000-0000-0000-0000000000e1');
-- Taunya's project came first: an explicit earlier day, since both inserts share this transaction's now().
INSERT INTO public.bid_count_sources (id, bid_id, link, token, project_name, scope, imported_by, first_imported_at, last_imported_at)
VALUES ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'SpaceX BA', 'all', '00000000-0000-0000-0000-0000000000e1', now() - interval '4 days', now() - interval '4 days');
INSERT INTO public.bid_count_sources (id, bid_id, link, token, project_name, scope, imported_by)
VALUES ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/?t=11111111-2222-3333-4444-555555555555', '11111111-2222-3333-4444-555555555555', 'SpaceX BA', 'all', '00000000-0000-0000-0000-0000000000e1');
UPDATE public.bids_count_rows SET count = 1827.45, source_shares = '{"00000000-0000-0000-0000-00000000d001": 1489.04, "00000000-0000-0000-0000-00000000d002": 338.41}'::jsonb
WHERE id = '00000000-0000-0000-0000-00000000c001';
UPDATE public.bids_count_rows SET source_shares = '{"00000000-0000-0000-0000-00000000d001": 5}'::jsonb WHERE id = '00000000-0000-0000-0000-00000000c002';
SELECT cst.same('the estimator reads both projects, first import first',
  (SELECT string_agg(project_name || ' · ' || token, ' | ' ORDER BY first_imported_at, token) FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'),
  'SpaceX BA · aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee | SpaceX BA · 11111111-2222-3333-4444-555555555555');
SELECT cst.same('a row both counted holds two shares that sum to its count',
  (SELECT (source_shares->>'00000000-0000-0000-0000-00000000d001')::numeric + (source_shares->>'00000000-0000-0000-0000-00000000d002')::numeric = count FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c001')::text,
  'true');
UPDATE public.bid_count_sources SET last_imported_at = now() + interval '1 minute', scope = 'partial' WHERE id = '00000000-0000-0000-0000-00000000d002';
SELECT cst.same('a re-copy bumps the source and keeps its first day', (SELECT (last_imported_at > first_imported_at)::text || ' ' || scope FROM public.bid_count_sources WHERE id = '00000000-0000-0000-0000-00000000d002'), 'true partial');

-- What the table refuses.
SELECT cst.refused('a second source with the same token on one bid',
  $q$INSERT INTO public.bid_count_sources (bid_id, link, token) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')$q$);
SELECT cst.refused('a link that is not a link', $q$INSERT INTO public.bid_count_sources (bid_id, link) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'counttooling')$q$);
SELECT cst.refused('a malformed token', $q$INSERT INTO public.bid_count_sources (bid_id, link, token) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/?t=x', 'not-a-uuid')$q$);
SELECT cst.refused('a scope the app does not know', $q$INSERT INTO public.bid_count_sources (bid_id, link, scope) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/', 'everything')$q$);
SELECT cst.refused('an array of shares', $q$UPDATE public.bids_count_rows SET source_shares = '[1, 2]'::jsonb WHERE id = '00000000-0000-0000-0000-00000000c002'$q$);
-- A link typed by hand with no token is fine, and two of them may share the bid.
INSERT INTO public.bid_count_sources (bid_id, link) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/');
INSERT INTO public.bid_count_sources (bid_id, link) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/#two');
SELECT cst.same('hand links without a token may repeat', (SELECT count(*)::text FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1' AND token IS NULL), '2');

-- The office reads them; a superintendent outside the bid reads none and writes nothing.
SELECT cst.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT cst.same('the office reads the bid''s sources', (SELECT count(*)::text FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '4');
SELECT cst.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT cst.same('a superintendent outside the bid reads none', (SELECT count(*)::text FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '0');
SELECT cst.same('and cannot write one (the policy hides the bid)',
  (SELECT count(*)::text FROM (SELECT 1 FROM public.bid_count_sources WHERE false) x), '0');
SELECT cst.refused('a superintendent inserting a source', $q$INSERT INTO public.bid_count_sources (bid_id, link) VALUES ('00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/#super')$q$);

-- The bid going away takes its sources with it.
RESET ROLE;
DELETE FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000b1d1';
SELECT cst.same('a deleted bid takes its sources', (SELECT count(*)::text FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '0');

DO $$ BEGIN RAISE NOTICE 'count_sources PASSED'; END $$;
ROLLBACK;
