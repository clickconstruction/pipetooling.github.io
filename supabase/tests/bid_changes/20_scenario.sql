-- Bid history capture (v2.4598, punch list #73 PR 1): what record_bid_change() writes into
-- bid_changes, and what it never does. Saves run as an estimator through RLS, reads as each role;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion;
-- ends with "bid_changes PASSED". See scripts/pgtest-bid-changes.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c7e1', 'est@history.test'),
  ('00000000-0000-0000-0000-00000000c7e2', 'primary@history.test'),
  ('00000000-0000-0000-0000-00000000c7e3', 'am@history.test'),
  ('00000000-0000-0000-0000-00000000c7e4', 'super@history.test'),
  ('00000000-0000-0000-0000-00000000c7e5', 'dev@history.test'),
  ('00000000-0000-0000-0000-00000000c7e6', 'trainee@history.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-00000000c7e1', 'est@history.test', 'History Estimator', 'estimator'),
  ('00000000-0000-0000-0000-00000000c7e2', 'primary@history.test', 'History Primary', 'primary'),
  ('00000000-0000-0000-0000-00000000c7e3', 'am@history.test', 'History Account Manager', 'primary'),
  ('00000000-0000-0000-0000-00000000c7e4', 'super@history.test', 'History Superintendent', 'superintendent'),
  ('00000000-0000-0000-0000-00000000c7e5', 'dev@history.test', 'History Dev', 'dev'),
  ('00000000-0000-0000-0000-00000000c7e6', 'trainee@history.test', 'History Trainee', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-00000000c7e6';
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000c7a1', 'History Plumbing');
INSERT INTO public.fixture_types (id, service_type_id, name) VALUES ('00000000-0000-0000-0000-00000000c7f1', '00000000-0000-0000-0000-00000000c7a1', 'History WC');
INSERT INTO public.price_book_versions (id, name, service_type_id) VALUES ('00000000-0000-0000-0000-00000000c7b0', 'History book', '00000000-0000-0000-0000-00000000c7a1');
INSERT INTO public.price_book_entries (id, version_id, fixture_type_id, total_price) VALUES ('00000000-0000-0000-0000-00000000c7c0', '00000000-0000-0000-0000-00000000c7b0', '00000000-0000-0000-0000-00000000c7f1', 900);
INSERT INTO public.material_parts (id, name, service_type_id) VALUES
  ('00000000-0000-0000-0000-00000000c7d0', 'History P-trap', '00000000-0000-0000-0000-00000000c7a1'),
  ('00000000-0000-0000-0000-00000000c7d9', 'History closet carrier', '00000000-0000-0000-0000-00000000c7a1');

CREATE SCHEMA bct;
-- What the ledger holds for a bid after a given row, one line per row: table, op, label, and for
-- an update the columns that changed. Reads the whole ledger (definer), whoever is asking.
CREATE FUNCTION bct.log(p_bid uuid, p_after bigint) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(c.table_name || ' ' || c.op || ' ' || COALESCE(c.label, '-') ||
           CASE WHEN c.op = 'update' THEN ' ' || array_to_string(c.changed, ',') ELSE '' END, E'\n' ORDER BY c.id), '(none)')
  FROM public.bid_changes c WHERE c.bid_id = p_bid AND c.id > p_after $$;
CREATE FUNCTION bct.last() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(max(id), 0) FROM public.bid_changes $$;
CREATE FUNCTION bct.rows_after(p_after bigint) RETURNS SETOF public.bid_changes LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.bid_changes WHERE id > p_after ORDER BY id $$;
CREATE FUNCTION bct.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bct.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- The rows of a bid's history a person sees (RLS as them), then back to the estimator.
CREATE FUNCTION bct.visible_as(p_user uuid, p_bid uuid) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  SELECT count(*) INTO n FROM public.bid_changes WHERE bid_id = p_bid;
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION bct.visible_as(uuid, uuid) TO authenticated;
GRANT USAGE ON SCHEMA bct TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bct TO authenticated;
CREATE TEMP TABLE mark (id bigint) ON COMMIT DROP;
CREATE TEMP TABLE start (id bigint) ON COMMIT DROP;
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON mark, start, ids TO authenticated;
INSERT INTO mark SELECT bct.last();
INSERT INTO start SELECT bct.last();

-- The trigger is on the eighteen tables, and on bids only for the columns the ledger keeps.
SELECT bct.same('a trigger on each of the eighteen tables',
  (SELECT string_agg(c.relname, ',' ORDER BY c.relname) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE t.tgname = 'record_bid_change' AND NOT t.tgisinternal),
  (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(public.bid_changes_tables()) AS x));
SELECT bct.same('the bids trigger fires for the kept columns only',
  (SELECT string_agg(a.attname, ',' ORDER BY a.attname) FROM pg_trigger t JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = ANY (t.tgattr::int2[])
    WHERE t.tgname = 'record_bid_change' AND t.tgrelid = 'public.bids'::regclass),
  (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(public.bid_changes_bid_columns()) AS x));

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
SET LOCAL ROLE authenticated;

-- 1 · A new bid: one insert row, the kept columns only.
INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name, bid_value)
VALUES ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7e1', '00000000-0000-0000-0000-00000000c7e3',
        '00000000-0000-0000-0000-00000000c7a1', 'History: B494 restrooms', 120000);
SELECT bct.same('a new bid: one row', bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)), 'bids insert -');
SELECT bct.same('a new bid: what it says, by whom',
  (SELECT (changed @> ARRAY['project_name', 'bid_value', 'service_type_id', 'account_manager_id'])::text || ' ' ||
          (NOT changed && ARRAY['created_by', 'created_at', 'updated_at', 'robot_opt_out', 'robot_requested_at', 'last_contact', 'materials_model'])::text || ' ' ||
          (new_values ->> 'project_name') || ' ' || (changed_by = '00000000-0000-0000-0000-00000000c7e1')::text || ' ' || (old_values IS NULL)::text
     FROM bct.rows_after((SELECT id FROM mark))),
  'true true History: B494 restrooms true true');
UPDATE mark SET id = bct.last();

-- 2 · An edit records the column that changed; a column the ledger does not keep (the robots' opt-out),
-- or a save that changes nothing, records nothing.
UPDATE public.bids SET notes = 'Ask Wendi about the SpaceX counts', robot_opt_out = true WHERE id = '00000000-0000-0000-0000-00000000c7d1';
UPDATE public.bids SET robot_opt_out = false WHERE id = '00000000-0000-0000-0000-00000000c7d1';
UPDATE public.bids SET notes = 'Ask Wendi about the SpaceX counts' WHERE id = '00000000-0000-0000-0000-00000000c7d1';
SELECT bct.same('an edit: the notes only', bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)), 'bids update - notes');
SELECT bct.same('an edit: before and after',
  (SELECT COALESCE(old_values ->> 'notes', 'null') || ' -> ' || (new_values ->> 'notes') FROM bct.rows_after((SELECT id FROM mark))),
  'null -> Ask Wendi about the SpaceX counts');
UPDATE mark SET id = bct.last();

-- 3 · Versions, count rows and a price typed three times (one of them the same value); a reorder records nothing.
INSERT INTO public.bid_versions (id, bid_id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-00000000c7a5', '00000000-0000-0000-0000-00000000c7d1', 'Base', 0),
  ('00000000-0000-0000-0000-00000000c7a6', '00000000-0000-0000-0000-00000000c7d1', 'Alt 1', 1);
INSERT INTO public.bids_count_rows (id, bid_id, bid_version_id, fixture, count, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'Lav-1', 4, 1),
  ('00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'SUMP', 2, 2),
  ('00000000-0000-0000-0000-00000000c703', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a6', 'Lav-1', 6, 1);
INSERT INTO public.bid_count_row_custom_prices (id, bid_id, count_row_id, price_book_version_id, unit_price) VALUES
  ('00000000-0000-0000-0000-00000000c711', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-00000000c7b0', 9800),
  ('00000000-0000-0000-0000-00000000c712', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c7b0', 3700);
UPDATE public.bid_count_row_custom_prices SET unit_price = 10300 WHERE id = '00000000-0000-0000-0000-00000000c711';
UPDATE public.bid_count_row_custom_prices SET unit_price = 10300.00 WHERE id = '00000000-0000-0000-0000-00000000c711';
UPDATE public.bid_count_row_custom_prices SET unit_price = 10450 WHERE id = '00000000-0000-0000-0000-00000000c711';
UPDATE public.bids_count_rows SET sequence_order = sequence_order + 10 WHERE bid_id = '00000000-0000-0000-0000-00000000c7d1';
SELECT bct.same('rows and prices: one line each, no reorder, no same-value save',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  E'bid_versions insert Base\nbid_versions insert Alt 1\nbids_count_rows insert Lav-1\nbids_count_rows insert SUMP\nbids_count_rows insert Lav-1\n' ||
  E'bid_count_row_custom_prices insert Lav-1\nbid_count_row_custom_prices insert SUMP\n' ||
  E'bid_count_row_custom_prices update Lav-1 unit_price\nbid_count_row_custom_prices update Lav-1 unit_price');
SELECT bct.same('rows and prices: the price''s past',
  (SELECT string_agg(trim_scale((old_values ->> 'unit_price')::numeric)::text || '->' || trim_scale((new_values ->> 'unit_price')::numeric)::text, ', ' ORDER BY id)
     FROM bct.rows_after((SELECT id FROM mark)) WHERE op = 'update'),
  '9800->10300, 10300->10450');
SELECT bct.same('rows and prices: each count row and price carries its count row and version',
  (SELECT string_agg(DISTINCT (count_row_id IS NOT NULL)::text || ' ' || (bid_version_id IS NOT NULL)::text, ';')
     FROM bct.rows_after((SELECT id FROM mark)) WHERE table_name IN ('bids_count_rows', 'bid_count_row_custom_prices')),
  'true true');
SELECT bct.same('rows and prices: a count row is its own count row; a version is its own version',
  (SELECT bool_and(count_row_id = record_id)::text FROM bct.rows_after((SELECT id FROM mark)) WHERE table_name = 'bids_count_rows') || ' ' ||
  (SELECT bool_and(bid_version_id = record_id)::text FROM bct.rows_after((SELECT id FROM mark)) WHERE table_name = 'bid_versions'),
  'true true');
UPDATE mark SET id = bct.last();

-- 4 · What hangs on a count row: an assignment, two part lines (each its part's name), a stage
-- split, a quoted cost for one house.
INSERT INTO public.bid_pricing_assignments (bid_id, count_row_id, price_book_entry_id, price_book_version_id) VALUES
  ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c7c0', '00000000-0000-0000-0000-00000000c7b0');
INSERT INTO public.bids_takeoff_rough_part_lines (id, bid_id, bid_version_id, count_row_id, part_id, quantity, unit_price, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000c721', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', '00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c7d0', 2, 14.5, 1),
  ('00000000-0000-0000-0000-00000000c722', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', '00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c7d9', 1, 300, 2);
INSERT INTO public.bid_takeoff_stage_splits (bid_id, count_row_id, line_id, rough_in, top_out, trim_set, source) VALUES
  ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c702', '00000000-0000-0000-0000-00000000c721', 1, 0, 0, 'hand');
INSERT INTO public.bid_count_row_custom_costs (bid_id, count_row_id, unit_materials_cents, house_name) VALUES
  ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c702', 125000, 'House B');
UPDATE public.bids_takeoff_rough_part_lines SET quantity = 3 WHERE id = '00000000-0000-0000-0000-00000000c721';
SELECT bct.same('under a count row: each named',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  E'bid_pricing_assignments insert SUMP\nbids_takeoff_rough_part_lines insert History P-trap\nbids_takeoff_rough_part_lines insert History closet carrier\n' ||
  E'bid_takeoff_stage_splits insert SUMP\nbid_count_row_custom_costs insert SUMP · House B\nbids_takeoff_rough_part_lines update History P-trap quantity');
SELECT bct.same('under a count row: on SUMP, in Base',
  (SELECT string_agg(DISTINCT (count_row_id = '00000000-0000-0000-0000-00000000c702')::text || ' ' || (bid_version_id = '00000000-0000-0000-0000-00000000c7a5')::text, ';')
     FROM bct.rows_after((SELECT id FROM mark))),
  'true true');
UPDATE mark SET id = bct.last();

-- 5 · Labor and direct costs reach the bid through the cost estimate; the schedule of values, the
-- payment schedule and a version's name.
INSERT INTO public.cost_estimates (id, bid_id, labor_rate) VALUES ('00000000-0000-0000-0000-00000000c731', '00000000-0000-0000-0000-00000000c7d1', 85);
INSERT INTO public.cost_estimate_labor_rows (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit, sequence_order, kind, unit)
VALUES ('00000000-0000-0000-0000-00000000c731', 'Lav-1', 4, 1.5, 0.5, 0.75, 1, 'fixture', 'each');
INSERT INTO public.cost_estimate_permit_rows (cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order)
VALUES ('00000000-0000-0000-0000-00000000c731', 'City permit', 450, 0, 0, 1);
UPDATE public.cost_estimate_labor_rows SET rough_in_hrs_per_unit = 2 WHERE cost_estimate_id = '00000000-0000-0000-0000-00000000c731';
UPDATE public.cost_estimates SET labor_rate = 92 WHERE id = '00000000-0000-0000-0000-00000000c731';
INSERT INTO public.bid_sov_lines (bid_id, label, value) VALUES ('00000000-0000-0000-0000-00000000c7d1', 'Underground', 30000);
INSERT INTO public.bid_payment_schedule_rows (bid_id, timing, percent) VALUES ('00000000-0000-0000-0000-00000000c7d1', 'after_rough_in', 40);
UPDATE public.bid_versions SET name = 'Base bid' WHERE id = '00000000-0000-0000-0000-00000000c7a5';
SELECT bct.same('labor, costs, SOV, schedule, version',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  E'cost_estimates insert -\ncost_estimate_labor_rows insert Lav-1\ncost_estimate_permit_rows insert City permit\n' ||
  E'cost_estimate_labor_rows update Lav-1 rough_in_hrs_per_unit\ncost_estimates update - labor_rate\n' ||
  E'bid_sov_lines insert Underground\nbid_payment_schedule_rows insert after_rough_in\nbid_versions update Base bid name');
UPDATE mark SET id = bct.last();

-- 5b · The other four direct-cost tables: each reaches the bid through its cost estimate and is
-- named by its note, on an insert, an update and a delete. A wrong branch here is silent in the
-- trigger (a warning, no row), so each is written and read back.
DO $$
DECLARE t text; v uuid;
BEGIN
  FOREACH t IN ARRAY ARRAY['cost_estimate_equipment_rows', 'cost_estimate_other_rows', 'cost_estimate_subcontractor_rows', 'cost_estimate_waste_rows'] LOOP
    EXECUTE format('INSERT INTO public.%I (cost_estimate_id, note, rough_in, top_out, trim_set, sequence_order) VALUES (%L, %L, 100, 0, 0, 1) RETURNING id',
      t, '00000000-0000-0000-0000-00000000c731', 'Line in ' || t) INTO v;
    EXECUTE format('UPDATE public.%I SET rough_in = 150 WHERE id = %L', t, v);
    EXECUTE format('DELETE FROM public.%I WHERE id = %L', t, v);
  END LOOP;
END $$;
SELECT bct.same('equipment, other, subcontractor, waste: each recorded, named, under the bid',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  (SELECT string_agg(t || ' insert Line in ' || t || E'\n' || t || ' update Line in ' || t || E' rough_in\n' || t || ' delete Line in ' || t, E'\n' ORDER BY o)
     FROM unnest(ARRAY['cost_estimate_equipment_rows', 'cost_estimate_other_rows', 'cost_estimate_subcontractor_rows', 'cost_estimate_waste_rows']) WITH ORDINALITY AS x(t, o)));
SELECT bct.same('equipment, other, subcontractor, waste: twelve rows, all under the bid, none written elsewhere',
  (SELECT count(*) FILTER (WHERE bid_id = '00000000-0000-0000-0000-00000000c7d1')::text || ' ' || count(*) FILTER (WHERE bid_id <> '00000000-0000-0000-0000-00000000c7d1')::text
     FROM bct.rows_after((SELECT id FROM mark))),
  '12 0');
UPDATE mark SET id = bct.last();

-- 5c · Set-aside labor rows (PR 0b, 20261008071000): the Labor sync's park and take-back, a rename,
--      and the band's Use for, each named by its fixture, under the bid, tagged as the client sends
--      them: the sync's own steps read as the app's, Use for as a press. Nothing is left set aside,
--      so case 8 removes the cost estimate as before.
SELECT set_config('request.headers', '{"x-bid-action":"labor-sync"}', true);
INSERT INTO public.cost_estimate_labor_rows (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, sequence_order)
VALUES ('00000000-0000-0000-0000-00000000c731', 'Floor drain', 2, 3, 2);
SELECT set_config('request.headers', '{"x-bid-action":"labor-park"}', true);
INSERT INTO public.cost_estimate_labor_rows_unmatched (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, labor_row_id)
  SELECT cost_estimate_id, fixture, count, rough_in_hrs_per_unit, id FROM public.cost_estimate_labor_rows WHERE fixture = 'Floor drain';
DELETE FROM public.cost_estimate_labor_rows WHERE fixture = 'Floor drain';
SELECT set_config('request.headers', '{"x-bid-action":"labor-take-back"}', true);
INSERT INTO public.cost_estimate_labor_rows (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, sequence_order)
  SELECT cost_estimate_id, fixture, count, rough_in_hrs_per_unit, 2 FROM public.cost_estimate_labor_rows_unmatched WHERE fixture = 'Floor drain';
DELETE FROM public.cost_estimate_labor_rows_unmatched WHERE fixture = 'Floor drain';
SELECT set_config('request.headers', '{"x-bid-action":"labor-rename"}', true);
UPDATE public.cost_estimate_labor_rows SET fixture = 'FLOOR DRAIN' WHERE fixture = 'Floor drain';
SELECT set_config('request.headers', '{"x-bid-action":"labor-park"}', true);
INSERT INTO public.cost_estimate_labor_rows_unmatched (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, labor_row_id)
  SELECT cost_estimate_id, fixture, count, rough_in_hrs_per_unit, id FROM public.cost_estimate_labor_rows WHERE fixture = 'FLOOR DRAIN';
DELETE FROM public.cost_estimate_labor_rows WHERE fixture = 'FLOOR DRAIN';
SELECT set_config('request.headers', '{"x-bid-action":"labor-use-parked"}', true);
UPDATE public.cost_estimate_labor_rows SET rough_in_hrs_per_unit = (SELECT rough_in_hrs_per_unit FROM public.cost_estimate_labor_rows_unmatched WHERE fixture = 'FLOOR DRAIN')
 WHERE cost_estimate_id = '00000000-0000-0000-0000-00000000c731' AND fixture = 'Lav-1';
DELETE FROM public.cost_estimate_labor_rows_unmatched WHERE fixture = 'FLOOR DRAIN';
SELECT set_config('request.headers', '', true);
SELECT bct.same('set-aside labor rows: parked, taken back, renamed, used, each named under the bid',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  E'cost_estimate_labor_rows insert Floor drain\ncost_estimate_labor_rows_unmatched insert Floor drain\ncost_estimate_labor_rows delete Floor drain\n' ||
  E'cost_estimate_labor_rows insert Floor drain\ncost_estimate_labor_rows_unmatched delete Floor drain\ncost_estimate_labor_rows update FLOOR DRAIN fixture\n' ||
  E'cost_estimate_labor_rows_unmatched insert FLOOR DRAIN\ncost_estimate_labor_rows delete FLOOR DRAIN\n' ||
  E'cost_estimate_labor_rows update Lav-1 rough_in_hrs_per_unit\ncost_estimate_labor_rows_unmatched delete FLOOR DRAIN');
SELECT bct.same('set-aside labor rows: the sync is the app, Use for is a press',
  (SELECT string_agg(COALESCE(action, '-') || ' ' || COALESCE(by_app::text, '-'), E'\n' ORDER BY id) FROM bct.rows_after((SELECT id FROM mark))),
  E'labor-sync true\nlabor-park true\nlabor-park true\nlabor-take-back true\nlabor-take-back true\nlabor-rename true\n' ||
  E'labor-park true\nlabor-park true\nlabor-use-parked false\nlabor-use-parked false');
SELECT bct.same('set-aside labor rows: none left', (SELECT count(*)::text FROM public.cost_estimate_labor_rows_unmatched WHERE cost_estimate_id = '00000000-0000-0000-0000-00000000c731'), '0');
SELECT bct.refused('set-aside labor rows: one per fixture on an estimate (v2.4903)',
  $$INSERT INTO public.cost_estimate_labor_rows_unmatched (cost_estimate_id, fixture) VALUES ('00000000-0000-0000-0000-00000000c731', 'Twice'), ('00000000-0000-0000-0000-00000000c731', 'Twice')$$,
  'duplicate key');
UPDATE mark SET id = bct.last();

-- 6 · SUMP removed: its row, and everything its delete took with it, each still named SUMP (the
-- archive's snapshot of the count row) and in Base. The quoted cost goes too: v2.4413 gave
-- bid_count_row_custom_costs its count-row key (ON DELETE CASCADE), so its row is named with its house.
DELETE FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c702';
SELECT bct.same('SUMP removed: named, in Base, by the estimator',
  (SELECT string_agg(table_name || ' ' || op || ' ' || COALESCE(label, '-') || ' ' || (bid_version_id = '00000000-0000-0000-0000-00000000c7a5')::text || ' ' ||
                     (changed_by = '00000000-0000-0000-0000-00000000c7e1')::text, E'\n' ORDER BY table_name, label)
     FROM bct.rows_after((SELECT id FROM mark))),
  E'bid_count_row_custom_costs delete SUMP · House B true true\nbid_count_row_custom_prices delete SUMP true true\nbid_pricing_assignments delete SUMP true true\nbid_takeoff_stage_splits delete SUMP true true\n' ||
  E'bids_count_rows delete SUMP true true\nbids_takeoff_rough_part_lines delete History closet carrier true true\nbids_takeoff_rough_part_lines delete History P-trap true true');
SELECT bct.same('SUMP removed: the price it had is kept',
  (SELECT trim_scale((old_values ->> 'unit_price')::numeric)::text FROM bct.rows_after((SELECT id FROM mark)) WHERE table_name = 'bid_count_row_custom_prices'),
  '3700');
UPDATE mark SET id = bct.last();

-- 7 · The Alt 1 version picked and then deleted: its count row is recorded, and so is the bid's
-- pick being cleared by the version's key.
UPDATE public.bids SET selected_bid_version_id = '00000000-0000-0000-0000-00000000c7a6' WHERE id = '00000000-0000-0000-0000-00000000c7d1';
DELETE FROM public.bid_versions WHERE id = '00000000-0000-0000-0000-00000000c7a6';
-- The two key actions fire in an order the schema decides, so the lines are compared sorted.
SELECT bct.same('a version deleted',
  (SELECT string_agg(l, E'\n' ORDER BY l) FROM unnest(string_to_array(bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)), E'\n')) AS l),
  E'bid_versions delete Alt 1\nbids update - selected_bid_version_id\nbids update - selected_bid_version_id\nbids_count_rows delete Lav-1');
SELECT bct.same('a version deleted: the Alt 1 row is in Alt 1',
  (SELECT (bid_version_id = '00000000-0000-0000-0000-00000000c7a6')::text FROM bct.rows_after((SELECT id FROM mark)) WHERE table_name = 'bids_count_rows'), 'true');
UPDATE mark SET id = bct.last();

-- 8 · The cost estimate removed while the bid lives: its rows are recorded under the bid (found
-- through the archive's snapshot of the cost estimate), never without one. Run as the table owner:
-- this is about what the trigger records, whoever removes it.
RESET ROLE;
DELETE FROM public.cost_estimates WHERE id = '00000000-0000-0000-0000-00000000c731';
SET LOCAL ROLE authenticated;
SELECT bct.same('a cost estimate removed: its rows, under the bid',
  (SELECT string_agg(l, E'\n' ORDER BY l) FROM unnest(string_to_array(bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)), E'\n')) AS l),
  E'cost_estimate_labor_rows delete Lav-1\ncost_estimate_permit_rows delete City permit\ncost_estimates delete -');
SELECT bct.same('a cost estimate removed: nothing written anywhere else',
  (SELECT count(*)::text FROM bct.rows_after((SELECT id FROM mark)) WHERE bid_id <> '00000000-0000-0000-0000-00000000c7d1'), '0');
UPDATE mark SET id = bct.last();

-- 9 · A broken ledger never stops a save: the table gone, then every write to it failing inside
-- the trigger. Each time an insert, an update and a delete that cascades all save, and nothing is
-- recorded.
INSERT INTO ids VALUES ('lav', '00000000-0000-0000-0000-00000000c701');
SAVEPOINT broken_table;
RESET ROLE;
ALTER TABLE public.bid_changes RENAME TO bid_changes_gone;
SET LOCAL ROLE authenticated;
INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, sequence_order)
  VALUES ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'Saved with the ledger gone', 1, 50);
UPDATE public.bid_count_row_custom_prices SET unit_price = 11000 WHERE id = '00000000-0000-0000-0000-00000000c711';
DELETE FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c701';
SELECT bct.same('ledger gone: the three saves went through, nothing recorded',
  (SELECT count(*)::text FROM public.bids_count_rows WHERE fixture = 'Saved with the ledger gone') || ' ' ||
  (SELECT count(*)::text FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c701') || ' ' ||
  (SELECT count(*)::text FROM public.bid_count_row_custom_prices WHERE id = '00000000-0000-0000-0000-00000000c711') || ' ' ||
  (SELECT count(*)::text FROM public.bid_changes_gone WHERE id > (SELECT id FROM mark)),
  '1 0 0 0');
ROLLBACK TO SAVEPOINT broken_table;

SAVEPOINT broken_writes;
RESET ROLE;
ALTER TABLE public.bid_changes ADD CONSTRAINT bct_every_write_fails CHECK (op = 'never') NOT VALID;
SET LOCAL ROLE authenticated;
INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, sequence_order)
  VALUES ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'Saved with the ledger refusing', 1, 51);
UPDATE public.bid_count_row_custom_prices SET unit_price = 11000 WHERE id = '00000000-0000-0000-0000-00000000c711';
DELETE FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c701';
SELECT bct.same('ledger refusing: the three saves went through, nothing recorded',
  (SELECT count(*)::text FROM public.bids_count_rows WHERE fixture = 'Saved with the ledger refusing') || ' ' ||
  (SELECT count(*)::text FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c701') || ' ' ||
  (SELECT count(*)::text FROM public.bid_count_row_custom_prices WHERE id = '00000000-0000-0000-0000-00000000c711') || ' ' ||
  (SELECT count(*)::text FROM bct.rows_after((SELECT id FROM mark))),
  '1 0 0 0');
ROLLBACK TO SAVEPOINT broken_writes;
SET LOCAL ROLE authenticated;

-- 10 · A trainee (read only) is refused by the bid table itself, before the ledger is reached.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e6","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e6', true);
SELECT bct.refused('a trainee''s save', $$UPDATE public.bids SET notes = 'training' WHERE id = '00000000-0000-0000-0000-00000000c7d1'$$, 'Read-only');

-- 11 · Who reads the history: whoever can read the bid. Nobody writes it but the trigger.
SELECT bct.same('who reads it: the estimator, the bid''s account manager; not another primary, not a superintendent',
  (bct.visible_as('00000000-0000-0000-0000-00000000c7e1', '00000000-0000-0000-0000-00000000c7d1') > 0)::text || ' ' ||
  (bct.visible_as('00000000-0000-0000-0000-00000000c7e3', '00000000-0000-0000-0000-00000000c7d1') > 0)::text || ' ' ||
  bct.visible_as('00000000-0000-0000-0000-00000000c7e2', '00000000-0000-0000-0000-00000000c7d1')::text || ' ' ||
  bct.visible_as('00000000-0000-0000-0000-00000000c7e4', '00000000-0000-0000-0000-00000000c7d1')::text,
  'true true 0 0');
SELECT bct.refused('a client writing the ledger', $$INSERT INTO public.bid_changes (bid_id, table_name, record_id, op, changed) VALUES ('00000000-0000-0000-0000-00000000c7d1', 'bids', gen_random_uuid(), 'update', '{}')$$, 'permission denied');
SELECT bct.refused('a client erasing the ledger', $$DELETE FROM public.bid_changes WHERE bid_id = '00000000-0000-0000-0000-00000000c7d1'$$, 'permission denied');
UPDATE mark SET id = bct.last();

-- 12 · A copy (the real duplicate): every row it makes is recorded under the new bid, named.
INSERT INTO ids SELECT 'copy', public.duplicate_bid_to_service_type('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a1');
SELECT bct.same('a copy: one insert row per row it made, each count row named by its fixture',
  (SELECT count(*)::text FROM bct.rows_after((SELECT id FROM mark)) c WHERE c.bid_id = (SELECT id FROM ids WHERE k = 'copy') AND c.op = 'insert' AND c.table_name = 'bids_count_rows'
     AND c.label = (SELECT r.fixture FROM public.bids_count_rows r WHERE r.id = c.record_id)) || ' of ' ||
  (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = (SELECT id FROM ids WHERE k = 'copy')),
  (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = (SELECT id FROM ids WHERE k = 'copy')) || ' of ' ||
  (SELECT count(*)::text FROM public.bids_count_rows WHERE bid_id = (SELECT id FROM ids WHERE k = 'copy')));
SELECT bct.same('a copy: the source bid''s history is untouched',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)), '(none)');
UPDATE mark SET id = bct.last();

-- 13 · The copy deleted whole: one row for the bid, none for its rows. Its history stays for a dev
-- (no foreign key) and is gone from everyone else's sight with the bid. Run as the table owner.
RESET ROLE;
DELETE FROM public.bids WHERE id = (SELECT id FROM ids WHERE k = 'copy');
SET LOCAL ROLE authenticated;
SELECT bct.same('a bid deleted: one row',
  (SELECT string_agg(table_name || ' ' || op, E'\n' ORDER BY id) FROM bct.rows_after((SELECT id FROM mark))), 'bids delete');
SELECT bct.same('a bid deleted: the estimator no longer reads its history; a dev does',
  bct.visible_as('00000000-0000-0000-0000-00000000c7e1', (SELECT id FROM ids WHERE k = 'copy'))::text || ' ' ||
  (bct.visible_as('00000000-0000-0000-0000-00000000c7e5', (SELECT id FROM ids WHERE k = 'copy')) > 0)::text,
  '0 true');
UPDATE mark SET id = bct.last();

-- 14 · A write with no person behind it (the service role, cron) has no author.
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
UPDATE public.bids SET notes = 'Set by a job' WHERE id = '00000000-0000-0000-0000-00000000c7d1';
SELECT bct.same('no person: no author', (SELECT COALESCE(changed_by::text, 'none') FROM bct.rows_after((SELECT id FROM mark))), 'none');

-- 15 · Every table the trigger is on recorded at least one row in this scenario.
SELECT bct.same('every one of the eighteen tables recorded something',
  (SELECT COALESCE(string_agg(t, ', ' ORDER BY t), '(none missing)') FROM unnest(public.bid_changes_tables()) AS t
    WHERE NOT EXISTS (SELECT 1 FROM bct.rows_after((SELECT id FROM start)) c WHERE c.table_name = t)),
  '(none missing)');

-- 16 · The request tag (PR 1b): a write tagged x-bid-action records the tag, the app's own actions
--      read as the app's, an untagged write records neither, and a tag that is not a slug is dropped.
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.headers', '{"x-bid-action":"counts-import","user-agent":"bed"}', true);
INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, sequence_order)
VALUES ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'Tagged WC', 1, 90);
SELECT set_config('request.headers', '{"x-bid-action":"labor-sync"}', true);
UPDATE public.bids_count_rows SET count = 2 WHERE fixture = 'Tagged WC';
SELECT set_config('request.headers', '{"x-bid-action":"Not A Slug!"}', true);
UPDATE public.bids_count_rows SET count = 3 WHERE fixture = 'Tagged WC';
SELECT set_config('request.headers', '', true);
UPDATE public.bids_count_rows SET count = 4 WHERE fixture = 'Tagged WC';
SELECT bct.same('the request tag: a press, the app, a bad tag, no tag',
  (SELECT string_agg(op || ' ' || COALESCE(action, '-') || ' ' || COALESCE(by_app::text, '-'), E'\n' ORDER BY id) FROM bct.rows_after((SELECT id FROM mark)) WHERE label = 'Tagged WC'),
  E'insert counts-import false\nupdate labor-sync true\nupdate - -\nupdate - -');
RESET ROLE;
UPDATE mark SET id = bct.last();

-- 17 · The reader (PR 2, 20261009060000): list_bid_history runs under the caller's own policies.
--      A bid adopted into B494 comes with it, each row carrying its bid number (the owner,
--      2026-10-08). A removal the ledger never saw (from before its push) sits in the delete
--      archive: a dev reads it in the history, an estimator does not (the archive stays dev-only).
--      Someone who cannot read the bid reads nothing.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name, bid_number)
VALUES ('00000000-0000-0000-0000-00000000c7d2', '00000000-0000-0000-0000-00000000c7e1', '00000000-0000-0000-0000-00000000c7e3',
        '00000000-0000-0000-0000-00000000c7a1', 'History: the adopted bid', 'B377');
INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order)
VALUES ('00000000-0000-0000-0000-00000000c7d2', 'Adopted WC', 1, 1);
RESET ROLE;
UPDATE public.bids SET adopted_into_bid_id = '00000000-0000-0000-0000-00000000c7d1' WHERE id = '00000000-0000-0000-0000-00000000c7d2';
INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_at)
VALUES ('bids_count_rows', '00000000-0000-0000-0000-00000000c7f9', '00000000-0000-0000-0000-00000000c7d1',
        jsonb_build_object('id', '00000000-0000-0000-0000-00000000c7f9', 'bid_id', '00000000-0000-0000-0000-00000000c7d1', 'fixture', 'Old SUMP', 'count', 2),
        now() - interval '20 days');
SET LOCAL ROLE authenticated;
SELECT bct.same('the reader: B494''s rows and the adopted bid''s, the adopted ones with its number',
  (SELECT (count(*) FILTER (WHERE bid_id = '00000000-0000-0000-0000-00000000c7d1'))::text || ' ' ||
          (count(*) FILTER (WHERE bid_id = '00000000-0000-0000-0000-00000000c7d2' AND bid_number = 'B377' AND label = 'Adopted WC'))::text || ' ' ||
          (count(*) FILTER (WHERE bid_id NOT IN ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7d2')))::text
     FROM public.list_bid_history('00000000-0000-0000-0000-00000000c7d1')),
  (SELECT count(*)::text FROM public.bid_changes WHERE bid_id = '00000000-0000-0000-0000-00000000c7d1') || ' 1 0');
SELECT bct.same('the reader: newest first',
  (SELECT bool_and(ok)::text FROM (SELECT changed_at >= lead(changed_at) OVER (ORDER BY ordinality) OR lead(changed_at) OVER (ORDER BY ordinality) IS NULL AS ok
     FROM public.list_bid_history('00000000-0000-0000-0000-00000000c7d1') WITH ORDINALITY) t),
  'true');
SELECT bct.same('the reader: an estimator gets no archive row',
  (SELECT count(*)::text FROM public.list_bid_history('00000000-0000-0000-0000-00000000c7d1') WHERE source = 'archive'), '0');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e5","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e5', true);
SELECT bct.same('the reader: a dev gets the removal the ledger never saw, named, and no archive copy of what the ledger holds',
  (SELECT string_agg(source || ' ' || op || ' ' || COALESCE(label, '-'), ', ') FROM public.list_bid_history('00000000-0000-0000-0000-00000000c7d1') WHERE source = 'archive'),
  'archive delete Old SUMP');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e4","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e4', true);
SELECT bct.same('the reader: someone who cannot read the bid reads nothing',
  (SELECT count(*)::text FROM public.list_bid_history('00000000-0000-0000-0000-00000000c7d1')), '0');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
RESET ROLE;
UPDATE mark SET id = bct.last();

-- 18 · The cells' read (PR 3, 20261009090000): latest_bid_cell_history, under the caller's own
--      policies. A cell's two newest earlier values and its count of changes, keyed as the tabs
--      find their cells; both price sources are one price history (an override typed on a book
--      pick joins the custom price's past); each removed row's value under its name key, so a
--      re-imported row of the same name can show it. Someone who cannot read the bid reads nothing.
SET LOCAL ROLE authenticated;
INSERT INTO public.bid_pricing_assignments (bid_id, count_row_id, price_book_entry_id, price_book_version_id, unit_price_override) VALUES
  ('00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c701', '00000000-0000-0000-0000-00000000c7c0', '00000000-0000-0000-0000-00000000c7b0', 500);
UPDATE public.bid_pricing_assignments SET unit_price_override = 650 WHERE count_row_id = '00000000-0000-0000-0000-00000000c701';
SELECT bct.same('the cells: a price''s two newest earlier values from either source, of three changes, with who',
  (SELECT string_agg(kind || ' ' || rank || ' ' || column_name || ' ' || trim_scale((value #>> '{}')::numeric) || ' ' || total || ' ' || changed_by_name, E'\n' ORDER BY rank)
     FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells WHERE cell_key = 'price:00000000-0000-0000-0000-00000000c701:00000000-0000-0000-0000-00000000c7b0'),
  E'changed 1 unit_price 500 3 History Estimator\nchanged 2 unit_price 10300 3 History Estimator');
SELECT bct.same('the cells: a count, a takeoff quantity, and Lav-1''s rough-in hours (typed, then Use for)',
  (SELECT string_agg(kind || ' ' || rank || ' ' || trim_scale((value #>> '{}')::numeric) || ' ' || total, ', ' ORDER BY rank) FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells
     WHERE cell_key = 'count:' || (SELECT id FROM public.bids_count_rows WHERE fixture = 'Tagged WC')) || ' | ' ||
  (SELECT string_agg(kind || ' ' || rank || ' ' || trim_scale((value #>> '{}')::numeric) || ' ' || total, ', ' ORDER BY rank) FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells
     WHERE cell_key = 'takeoff:00000000-0000-0000-0000-00000000c721:quantity') || ' | ' ||
  (SELECT string_agg(kind || ' ' || rank || ' ' || trim_scale((value #>> '{}')::numeric) || ' ' || total, ', ' ORDER BY rank) FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells
     WHERE kind = 'changed' AND cell_key LIKE 'labor:%:rough_in_hrs_per_unit'),
  'changed 1 3 3, changed 2 2 3 | changed 1 2 1 | changed 1 2 2, changed 2 1.5 2');
SELECT bct.same('the cells: SUMP''s price and count when it went, under their names',
  (SELECT string_agg(name_key || ' ' || kind || ' ' || trim_scale((value #>> '{}')::numeric), E'\n' ORDER BY name_key) FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells
     WHERE name_key IN ('price:00000000-0000-0000-0000-00000000c7b0:sump', 'count:00000000-0000-0000-0000-00000000c7a5:sump')),
  E'count:00000000-0000-0000-0000-00000000c7a5:sump removed 2\nprice:00000000-0000-0000-0000-00000000c7b0:sump removed 3700');
SELECT bct.same('the cells: at most two earlier values a cell, one removed value a name',
  (SELECT count(*)::text FROM (SELECT cell_key FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells WHERE kind = 'changed' GROUP BY cell_key HAVING count(*) > 2) t) || ' ' ||
  (SELECT count(*)::text FROM (SELECT name_key FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1') cells WHERE kind = 'removed' GROUP BY name_key HAVING count(*) > 1) t),
  '0 0');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e4","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e4', true);
SELECT bct.same('the cells: someone who cannot read the bid reads nothing',
  (SELECT count(*)::text FROM public.latest_bid_cell_history('00000000-0000-0000-0000-00000000c7d1')), '0');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
RESET ROLE;
UPDATE mark SET id = bct.last();

-- 19 · Put back (PR 4, 20261009110000): put_back_bid_change writes a change's old value back under
--      the caller's own policies. The estimator puts Lav-1's price back to $10,300; the ledger
--      records it as hers, tagged put-back, a press not the app's. A trainee (read only) and
--      someone who cannot read the bid are refused, and the price stays.
-- The change that took Lav-1's price from $10,300 to $10,450 (case 3), read as the caller.
CREATE FUNCTION pg_temp.price_change() RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT id FROM public.bid_changes WHERE table_name = 'bid_count_row_custom_prices' AND record_id = '00000000-0000-0000-0000-00000000c711'
    AND op = 'update' AND (new_values ->> 'unit_price')::numeric = 10450 ORDER BY id DESC LIMIT 1 $$;
-- A new function carries no PUBLIC EXECUTE since 20261010007000, so the role that calls it is granted it.
GRANT EXECUTE ON FUNCTION pg_temp.price_change() TO authenticated;
SET LOCAL ROLE authenticated;
SELECT bct.same('put back: the price, before and after',
  (SELECT trim_scale((r -> 'before' ->> 'unit_price')::numeric) || ' -> ' || trim_scale((r -> 'after' ->> 'unit_price')::numeric)
     FROM public.put_back_bid_change(pg_temp.price_change()) AS r),
  '10450 -> 10300');
SELECT bct.same('put back: the price is $10,300 again',
  (SELECT trim_scale(unit_price)::text FROM public.bid_count_row_custom_prices WHERE id = '00000000-0000-0000-0000-00000000c711'), '10300');
SELECT bct.same('put back: recorded as her change, tagged put-back, a press',
  (SELECT string_agg(op || ' ' || array_to_string(changed, ',') || ' ' || COALESCE(action, '-') || ' ' || COALESCE(by_app::text, '-') || ' ' ||
                     (changed_by = '00000000-0000-0000-0000-00000000c7e1')::text, E'\n' ORDER BY id) FROM bct.rows_after((SELECT id FROM mark))),
  'update unit_price put-back false true');
SELECT bct.same('put back: the tag ends with the call', COALESCE(public.bid_change_action(), 'none'), 'none');
SELECT bct.refused('put back: a removal is not a changed value',
  $$SELECT public.put_back_bid_change((SELECT max(id) FROM public.bid_changes WHERE op = 'delete' AND bid_id = '00000000-0000-0000-0000-00000000c7d1'))$$,
  'Only a changed value');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e6","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e6', true);
SELECT bct.refused('put back: a trainee (read only) is refused', $$SELECT public.put_back_bid_change(pg_temp.price_change())$$, '');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e4","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e4', true);
SELECT bct.refused('put back: someone who cannot read the bid is refused',
  format('SELECT public.put_back_bid_change(%s)', (SELECT max(id) FROM bct.rows_after(0) WHERE table_name = 'bid_count_row_custom_prices' AND op = 'update')),
  'not in this bid''s history');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
SELECT bct.same('put back: the trainee and the stranger changed nothing',
  (SELECT trim_scale(unit_price)::text FROM public.bid_count_row_custom_prices WHERE id = '00000000-0000-0000-0000-00000000c711'), '10300');
RESET ROLE;
UPDATE mark SET id = bct.last();

-- 20 · A removed row put back (PR 5, 20261010017000): the bid's editors list its own removed rows and
--      put one back with what was removed with it. A fresh count row with a price and a part line is
--      removed; the price alone is refused while its count row is out; the count row comes back with
--      both, recorded as the estimator's put back. A superintendent cannot list, a trainee cannot put
--      back. (The whole scenario is one transaction, so every delete shares a time: the rows a put back
--      takes are only those that hang on it.)
SET LOCAL ROLE authenticated;
INSERT INTO public.bids_count_rows (id, bid_id, bid_version_id, fixture, count, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000c790', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', 'History DRAIN', 3, 40);
INSERT INTO public.bid_count_row_custom_prices (id, bid_id, count_row_id, price_book_version_id, unit_price) VALUES
  ('00000000-0000-0000-0000-00000000c791', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c790', '00000000-0000-0000-0000-00000000c7b0', 450);
INSERT INTO public.bids_takeoff_rough_part_lines (id, bid_id, bid_version_id, count_row_id, part_id, quantity, unit_price, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000c792', '00000000-0000-0000-0000-00000000c7d1', '00000000-0000-0000-0000-00000000c7a5', '00000000-0000-0000-0000-00000000c790', '00000000-0000-0000-0000-00000000c7d0', 1, 12, 9);
DELETE FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c790';
SELECT bct.same('removed rows: the estimator lists the drain, its price and its part line, each named, each in the ledger',
  (SELECT string_agg(table_name || ' ' || COALESCE(label, '-') || ' ' || in_ledger::text, E'\n' ORDER BY table_name COLLATE "C")
     FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1')
    WHERE record_id IN ('00000000-0000-0000-0000-00000000c790', '00000000-0000-0000-0000-00000000c791', '00000000-0000-0000-0000-00000000c792')),
  E'bid_count_row_custom_prices History DRAIN true\nbids_count_rows History DRAIN true\nbids_takeoff_rough_part_lines History P-trap true');
SELECT bct.refused('removed rows: the price alone waits for its count row',
  format('SELECT public.restore_bid_removed_row(%L)', (SELECT archive_id FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1') WHERE record_id = '00000000-0000-0000-0000-00000000c791')),
  'Its count row was removed too. Put that back first.');
-- The drain's archive row, as the estimator's list names it: the archive itself is a dev's read, so a
-- lookup made as anyone else finds nothing and every refusal below would be "not waiting".
INSERT INTO ids SELECT 'drain archive', archive_id FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1') WHERE record_id = '00000000-0000-0000-0000-00000000c790';
SELECT bct.same('removed rows: the drain has one archive row waiting', (SELECT count(id)::text FROM ids WHERE k = 'drain archive'), '1');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e4","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e4', true);
SELECT bct.refused('removed rows: a superintendent cannot list them',
  $$SELECT * FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1')$$, 'Only someone who can edit this bid');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e6","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e6', true);
SELECT bct.refused('removed rows: a trainee (read only) cannot put one back',
  format('SELECT public.restore_bid_removed_row(%L)', (SELECT id FROM ids WHERE k = 'drain archive')),
  'Only someone who can edit this bid');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c7e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c7e1', true);
UPDATE mark SET id = bct.last();
SELECT bct.same('removed rows: the drain comes back with its price and its part line',
  (SELECT (r ->> 'restored') || ' ' || (r -> 'tables' ->> 'bids_count_rows') || ' ' || (r -> 'tables' ->> 'bid_count_row_custom_prices') || ' ' || (r -> 'tables' ->> 'bids_takeoff_rough_part_lines')
     FROM public.restore_bid_removed_row((SELECT archive_id FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1') WHERE record_id = '00000000-0000-0000-0000-00000000c790')) AS r),
  '3 1 1 1');
SELECT bct.same('removed rows: all three are live again, as they were',
  (SELECT count(*)::text FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c790' AND fixture = 'History DRAIN' AND count = 3) || ' ' ||
  (SELECT trim_scale(unit_price)::text FROM public.bid_count_row_custom_prices WHERE id = '00000000-0000-0000-0000-00000000c791') || ' ' ||
  (SELECT count(*)::text FROM public.bids_takeoff_rough_part_lines WHERE id = '00000000-0000-0000-0000-00000000c792'),
  '1 450 1');
SELECT bct.same('removed rows: recorded as her put back, a press',
  (SELECT string_agg(table_name || ' ' || op || ' ' || COALESCE(action, '-') || ' ' || COALESCE(by_app::text, '-') || ' ' || (changed_by = '00000000-0000-0000-0000-00000000c7e1')::text, E'\n' ORDER BY table_name COLLATE "C")
     FROM bct.rows_after((SELECT id FROM mark))),
  E'bid_count_row_custom_prices insert put-back false true\nbids_count_rows insert put-back false true\nbids_takeoff_rough_part_lines insert put-back false true');
SELECT bct.same('removed rows: the tag ends with the call', COALESCE(public.bid_change_action(), 'none'), 'none');
SELECT bct.same('removed rows: the three leave the list',
  (SELECT count(*)::text FROM public.list_bid_removed_rows('00000000-0000-0000-0000-00000000c7d1')
    WHERE record_id IN ('00000000-0000-0000-0000-00000000c790', '00000000-0000-0000-0000-00000000c791', '00000000-0000-0000-0000-00000000c792')),
  '0');
SELECT bct.refused('removed rows: a row already put back is not waiting',
  format('SELECT public.restore_bid_removed_row(%L)', (SELECT id FROM ids WHERE k = 'drain archive')),
  'not waiting to be put back');
RESET ROLE;
UPDATE mark SET id = bct.last();

SELECT 'bid_changes PASSED' AS result;
ROLLBACK;
