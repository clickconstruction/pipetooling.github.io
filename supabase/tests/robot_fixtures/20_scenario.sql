-- Robot fixtures, the ground (v2.6180, punch list #221, migration *_robot_fixtures): the robot's pull lands under the
-- human bid; the estimator takes two rows and updates one of hers (her book prices the one it knows, the robot's
-- price lands as a custom price on the one it does not, the run reads assisted); sets a row aside and puts it back
-- at her number; Undo takes the untouched rows off and leaves the assisted stamp; the send writes the fixtures score
-- with her change, her set-aside and the row the robot missed. A superintendent outside the bid reads none and is
-- refused the doors; a reason off the list and a door on a sent bid are refused. Everything rolls back. Raises on
-- the first failed assertion; ends with "robot_fixtures PASSED". See scripts/pgtest-robot-fixtures.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'estimator@rf.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@rf.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'super@rf.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'robot@rf.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'estimator@rf.test', 'Taunya', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000000a1', 'assistant@rf.test', 'Wendi', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000000c1', 'super@rf.test', 'Outside Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000000d1', 'robot@rf.test', 'Robot Estimator', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing');
INSERT INTO public.fixture_types (id, service_type_id, name) VALUES
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000a001', 'Water closet'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000a001', 'Floor drain'),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000a001', 'Mop sink');
-- Her book knows a water closet and a floor drain; it has no mop sink.
INSERT INTO public.price_book_versions (id, name, service_type_id) VALUES ('00000000-0000-0000-0000-0000000009b1', 'Default 2026', '00000000-0000-0000-0000-00000000a001');
INSERT INTO public.price_book_entries (id, version_id, fixture_type_id, total_price) VALUES
  ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-00000000f001', 398),
  ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-00000000f002', 214);
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, materials_model, plans_link, selected_price_book_version_id)
VALUES ('00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001', 'Brushy Creek Bed', 'rough', 'https://drive.google.com/drive/folders/bed', '00000000-0000-0000-0000-0000000009b1');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, materials_model, twin_source_bid_id, count_tooling_plans_link)
VALUES ('00000000-0000-0000-0000-00000000b1d2', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000a001', 'ZZ Twin Brushy Creek Bed (shadow)', 'rough', '00000000-0000-0000-0000-00000000b1d1', 'https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
INSERT INTO public.bid_versions (id, bid_id, name) VALUES ('00000000-0000-0000-0000-00000000ae01', '00000000-0000-0000-0000-00000000b1d1', 'Base');
INSERT INTO public.bids_count_rows (id, bid_id, bid_version_id, fixture, count, sequence_order, unit) VALUES
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-00000000ae01', 'Floor drain', 6, 1, 'ea'),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-00000000ae01', 'Lav', 5, 2, 'ea');
INSERT INTO public.twin_shadow_runs (id, shadow_bid_id, reference_bid_id, twin_user_id, status, locked_total, locked_at)
VALUES ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000b1d2', '00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-0000000000d1', 'locked', 100000, now());
-- What put_fixtures writes (the service role): one pull, five rows.
INSERT INTO public.bid_fixture_pulls (id, bid_id, shell_bid_id, shadow_run_id, plan_link, ct_link, sheet_count, source, check_summary, robot_total, created_by)
VALUES ('00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-00000000b1d2', '00000000-0000-0000-0000-00000000e001',
        'https://drive.google.com/drive/folders/bed', 'https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 31, 'robot', '{"agree": 4, "conflict": 1, "unverifiable": 0}', 6038, '00000000-0000-0000-0000-0000000000d1');
INSERT INTO public.bid_fixture_pull_rows (id, pull_id, bid_id, tag, name, count, unit, per_sheet, backing, scope_flag, confidence, agreement, remark, robot_book_entry, robot_unit_price, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000ff01', '00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', 'WC-1', 'Water closet', 5, 'ea',
   '[{"sheet": "P-201", "page": 14, "count": 3, "pins": [{"x": 0.2, "y": 0.3}]}, {"sheet": "P-202", "page": 15, "count": 2}]',
   '[{"kind": "schedule", "sheet": "P-601", "page": 28, "text": "WC-1 WATER CLOSET, FLOOR MOUNTED", "flags": []}]', NULL, 0.92, 'agree', 'Five drawn, the riser shows five.', 'Water closet', 412, 1),
  ('00000000-0000-0000-0000-00000000ff02', '00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', 'MS-1', 'Mop sink', 1, 'ea',
   '[{"sheet": "P-202", "page": 15, "count": 1}]', '[]', NULL, 0.88, 'agree', NULL, 'Mop sink', 386, 2),
  ('00000000-0000-0000-0000-00000000ff03', '00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', 'FD-1', 'Floor drain', 8, 'ea',
   '[{"sheet": "P-201", "page": 14, "count": 5}, {"sheet": "P-202", "page": 15, "count": 3}]', '[]', NULL, 0.9, 'agree', NULL, 'Floor drain', 212, 3),
  ('00000000-0000-0000-0000-00000000ff04', '00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', 'HB-2', 'Hose bibb', 0, 'ea',
   '[]', '[]', NULL, 0.4, 'conflict', 'On the schedule, none drawn.', 'Hose bibb', 164, 4),
  ('00000000-0000-0000-0000-00000000ff05', '00000000-0000-0000-0000-00000000dd01', '00000000-0000-0000-0000-00000000b1d1', 'BFP-1', 'Backflow preventer', 1, 'ea',
   '[{"sheet": "P-101", "page": 3, "count": 1}]', '[{"kind": "note", "sheet": "P-001", "page": 1, "text": "BACKFLOW PREVENTER BY SITE UTILITY CONTRACTOR", "flags": ["by_others"]}]', 'by_others', 0.95, 'agree', NULL, 'Backflow preventer', 1940, 5);

CREATE SCHEMA rft;
CREATE FUNCTION rft.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION rft.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION rft.refused(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (refused: % %)', label, SQLSTATE, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was not refused', label;
END $$;
CREATE FUNCTION rft.robot_source() RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1' AND source_kind = 'robot' LIMIT 1 $$;
CREATE FUNCTION rft.run_words() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE((assisted_at IS NOT NULL)::text, 'null') || ' ' || COALESCE(assist_kind, 'none') || ' ' || status
    FROM public.twin_shadow_runs WHERE id = '00000000-0000-0000-0000-00000000e001' $$;
GRANT USAGE ON SCHEMA rft TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rft TO anon, authenticated, service_role;

-- Who reads the pull.
SET LOCAL ROLE authenticated;
SELECT rft.as_user('00000000-0000-0000-0000-0000000000e1');
SELECT rft.same('the estimator reads the five rows', (SELECT count(*)::text FROM public.bid_fixture_pull_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '5');
SELECT rft.as_user('00000000-0000-0000-0000-0000000000a1');
SELECT rft.same('the office reads them too', (SELECT count(*)::text FROM public.bid_fixture_pulls WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '1');
SELECT rft.as_user('00000000-0000-0000-0000-0000000000c1');
SELECT rft.same('a superintendent outside the bid reads none', (SELECT count(*)::text FROM public.bid_fixture_pull_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '0');
SELECT rft.refused('a superintendent at the door', $q$SELECT public.take_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff01']::uuid[], '00000000-0000-0000-0000-00000000ae01', '[]'::jsonb)$q$);
SELECT rft.refused('nobody writes a pull row directly', $q$UPDATE public.bid_fixture_pull_rows SET count = 99 WHERE id = '00000000-0000-0000-0000-00000000ff01'$q$);

-- Add 2 fixtures · update 1: the estimator takes WC-1 and MS-1 as rows of their own and FD-1 onto her Floor drain.
SELECT rft.as_user('00000000-0000-0000-0000-0000000000e1');
SELECT rft.same('take lands two and updates one',
  (SELECT (r->>'added') || ' ' || (r->>'updated') || ' ' || (r->>'priced_by_book') || ' ' || (r->>'priced_by_robot') || ' ' || (r->>'unpriced')
     FROM (SELECT public.take_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff01', '00000000-0000-0000-0000-00000000ff02']::uuid[], '00000000-0000-0000-0000-00000000ae01',
          '[{"row_id": "00000000-0000-0000-0000-00000000ff03", "count_row_id": "00000000-0000-0000-0000-00000000c001"}]'::jsonb) AS r) t),
  '2 1 1 1 0');
SELECT rft.same('the sheet holds her two rows and the robot''s two', (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '4');
SELECT rft.same('the water closet landed with its tag, its pages and the robot''s share',
  (SELECT count::text || ' · ' || plan_tag || ' · ' || page || ' · ' || (source_shares->>rft.robot_source()::text) FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1' AND fixture = 'Water closet'),
  '5.00 · WC-1 · 14, 15 · 5.00');
SELECT rft.same('her book priced the water closet; the robot priced the mop sink',
  (SELECT string_agg(tag || ':' || priced_as, ' ' ORDER BY sequence_order) FROM public.bid_fixture_pull_rows WHERE taken_at IS NOT NULL AND taken_as = 'added'),
  'WC-1:her_book MS-1:robot');
SELECT rft.same('the mop sink carries the robot''s price as a custom price on her book',
  (SELECT k.unit_price::text FROM public.bid_count_row_custom_prices k JOIN public.bids_count_rows c ON c.id = k.count_row_id WHERE c.fixture = 'Mop sink' AND k.price_book_version_id = '00000000-0000-0000-0000-0000000009b1'),
  '386.00');
SELECT rft.same('her floor drain reads the robot''s count with the robot''s share, and remembers hers',
  (SELECT c.count::text || ' · ' || (c.source_shares->>rft.robot_source()::text) || ' · ' || x.prior_count::text || ' · ' || x.taken_as FROM public.bids_count_rows c JOIN public.bid_fixture_pull_rows x ON x.count_row_id = c.id WHERE c.id = '00000000-0000-0000-0000-00000000c001'),
  '8.00 · 8.00 · 6.00 · updated');
SELECT rft.same('the robot is a count source on the bid, with its project link',
  (SELECT project_name || ' · ' || scope || ' · ' || link FROM public.bid_count_sources WHERE id = rft.robot_source()),
  'Robot · all · https://counttooling.com/app/?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
SELECT rft.same('the run reads assisted', rft.run_words(), 'true fixtures locked');
SELECT rft.same('the ledger says what was taken', (SELECT count(*)::text FROM public.bids_submission_entries WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1' AND notes LIKE '[robot fixtures] took 3 of 5 (2 added, 1 updated;%'), '1');
SELECT rft.same('robot_progress reads the fixtures',
  (SELECT fixtures_found::text || ' ' || fixtures_sure || ' ' || fixtures_taken || ' ' || fixtures_set_aside || ' ' || (assisted_at IS NOT NULL)::text || ' ' || (fixtures_at IS NOT NULL)::text
     FROM public.robot_progress(ARRAY['00000000-0000-0000-0000-00000000b1d1']::uuid[])),
  '5 3 3 0 true true');
SELECT rft.same('list_shadow_runs carries the fixtures and the assisted stamp',
  (SELECT fixtures_found::text || ' ' || fixtures_taken || ' ' || fixtures_set_aside || ' ' || (assisted_at IS NOT NULL)::text || ' ' || (reference_bid_id = '00000000-0000-0000-0000-00000000b1d1')::text
     FROM public.list_shadow_runs() WHERE id = '00000000-0000-0000-0000-00000000e001'),
  '5 3 0 true true');
SELECT rft.refused('a second take of a taken row changes nothing and a row from another bid is refused',
  $q$SELECT public.take_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff01']::uuid[], '00000000-0000-0000-0000-00000000ae02', '[]'::jsonb)$q$);

-- Set aside, never delete: the mop sink leaves her count with her reason and comes back at her number.
SELECT rft.same('set aside takes the mop sink off', (SELECT (r->>'set_aside') FROM (SELECT public.set_aside_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff02']::uuid[], 'not_sure') AS r) t), '1');
SELECT rft.same('the sheet holds three rows', (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '3');
SELECT rft.same('the row waits with her reason and her number',
  (SELECT set_aside_reason || ' · ' || taken_count::text || ' · ' || (taken_at IS NULL)::text || ' · ' || (count_row_id IS NULL)::text FROM public.bid_fixture_pull_rows WHERE id = '00000000-0000-0000-0000-00000000ff02'),
  'not_sure · 1.00 · true · true');
SELECT rft.same('its custom price went with the row', (SELECT count(*)::text FROM public.bid_count_row_custom_prices WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '0');
SELECT rft.same('put back lands it again', (SELECT (r->>'put_back') || ' ' || (r->>'landed') FROM (SELECT public.put_back_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff02']::uuid[]) AS r) t), '1 1');
SELECT rft.same('the mop sink is on her count again at the robot''s price',
  (SELECT c.count::text || ' · ' || x.priced_as || ' · ' || (x.set_aside_at IS NULL)::text || ' · ' || (SELECT count(*) FROM public.bid_count_row_custom_prices k WHERE k.count_row_id = c.id)::text
     FROM public.bid_fixture_pull_rows x JOIN public.bids_count_rows c ON c.id = x.count_row_id WHERE x.id = '00000000-0000-0000-0000-00000000ff02'),
  '1.00 · robot · true · 1');
SELECT rft.same('a row never taken is set aside too', (SELECT (r->>'set_aside') FROM (SELECT public.set_aside_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff05']::uuid[], 'by_others') AS r) t), '1');
SELECT rft.same('the sheet still holds four rows', (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '4');
SELECT rft.refused('a reason off the list', $q$SELECT public.set_aside_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff04']::uuid[], 'because')$q$);
SELECT rft.same('robot_progress reads the set-aside',
  (SELECT fixtures_taken::text || ' ' || fixtures_set_aside FROM public.robot_progress(ARRAY['00000000-0000-0000-0000-00000000b1d1']::uuid[])), '3 1');

-- Undo: the rows it added go, her floor drain goes back to her number, the source goes, the assisted stamp stays.
SELECT rft.same('undo takes the untouched rows off', (SELECT (r->>'removed') || ' ' || (r->>'restored') || ' ' || (r->>'kept') FROM (SELECT public.untake_robot_fixtures('00000000-0000-0000-0000-00000000dd01') AS r) t), '2 1 0');
SELECT rft.same('her two rows are all that is left', (SELECT string_agg(fixture || ':' || count::text, ' ' ORDER BY sequence_order) FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), 'Floor drain:6.00 Lav:5.00');
SELECT rft.same('her floor drain carries no robot share', (SELECT (source_shares IS NULL)::text FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c001'), 'true');
SELECT rft.same('the robot source went with the rows', (SELECT count(*)::text FROM public.bid_count_sources WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), '0');
SELECT rft.same('the set-aside row stayed set aside', (SELECT set_aside_reason FROM public.bid_fixture_pull_rows WHERE id = '00000000-0000-0000-0000-00000000ff05'), 'by_others');
SELECT rft.same('the run stays assisted: she saw them', rft.run_words(), 'true fixtures locked');

-- She takes the water closet and the floor drain again, changes the water closet to 6, and the bid is sent.
SELECT rft.same('take again', (SELECT (r->>'added') || ' ' || (r->>'updated') FROM (SELECT public.take_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff01']::uuid[], '00000000-0000-0000-0000-00000000ae01',
  '[{"row_id": "00000000-0000-0000-0000-00000000ff03", "count_row_id": "00000000-0000-0000-0000-00000000c001"}]'::jsonb) AS r) t), '1 1');
UPDATE public.bids_count_rows SET count = 6 WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1' AND fixture = 'Water closet';
-- v2.6237: Undo on the toast takes back only what that press took.
SELECT rft.same('a second press takes the mop sink', (SELECT (r->>'added') FROM (SELECT public.take_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff02']::uuid[], '00000000-0000-0000-0000-00000000ae01', '[]'::jsonb) AS r) t), '1');
SELECT rft.same('its Undo takes back the mop sink alone', (SELECT (r->>'removed') || ' ' || (r->>'restored') || ' ' || (r->>'kept') FROM (SELECT public.untake_robot_fixture_rows('00000000-0000-0000-0000-00000000dd01', ARRAY['00000000-0000-0000-0000-00000000ff02']::uuid[]) AS r) t), '1 0 0');
SELECT rft.same('the first press stays on her count', (SELECT string_agg(fixture || ':' || count::text, ' ' ORDER BY sequence_order) FROM public.bids_count_rows WHERE bid_id = '00000000-0000-0000-0000-00000000b1d1'), 'Floor drain:8.00 Lav:5.00 Water closet:6.00');
RESET ROLE;
UPDATE public.bids SET bid_date_sent = current_date, bid_value = 110000 WHERE id = '00000000-0000-0000-0000-00000000b1d1';
SELECT public.score_locked_shadows('00000000-0000-0000-0000-00000000b1d1');
SELECT rft.same('the send scored the run', rft.run_words(), 'true fixtures scored');
SELECT rft.same('the fixtures score reads her take, her change, her set-aside and the row the robot missed',
  (SELECT (fixtures_score->>'found') || ' ' || (fixtures_score->>'taken') || ' ' || (fixtures_score->>'changed') || ' ' || (fixtures_score->>'set_aside') || ' ' || (fixtures_score->>'left') || ' ' || (fixtures_score->>'missed') || ' ' || (fixtures_score->'reasons')::text
     FROM public.twin_shadow_runs WHERE id = '00000000-0000-0000-0000-00000000e001'),
  '5 1 1 1 2 1 {"by_others": 1}');
SELECT rft.same('the score is on both ledgers',
  (SELECT count(*)::text FROM public.bids_submission_entries WHERE notes LIKE '[robot fixtures SCORE] 1 of 5 taken as found, 1 changed, 1 set aside, 2 left, 1 the robot missed.' AND bid_id IN ('00000000-0000-0000-0000-00000000b1d1', '00000000-0000-0000-0000-00000000b1d2')),
  '2');
SET LOCAL ROLE authenticated;
SELECT rft.as_user('00000000-0000-0000-0000-0000000000e1');
SELECT rft.refused('a door on a sent bid', $q$SELECT public.set_aside_robot_fixtures(ARRAY['00000000-0000-0000-0000-00000000ff01']::uuid[], 'other')$q$);
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'robot_fixtures PASSED'; END $$;
ROLLBACK;
