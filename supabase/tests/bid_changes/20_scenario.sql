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
CREATE TEMP TABLE ids (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON mark, ids TO authenticated;
INSERT INTO mark SELECT bct.last();

-- The trigger is on the seventeen tables, and on bids only for the columns the ledger keeps.
SELECT bct.same('a trigger on each of the seventeen tables',
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
INSERT INTO public.bid_payment_schedule_rows (bid_id, timing, percent) VALUES ('00000000-0000-0000-0000-00000000c7d1', 'At rough-in', 40);
UPDATE public.bid_versions SET name = 'Base bid' WHERE id = '00000000-0000-0000-0000-00000000c7a5';
SELECT bct.same('labor, costs, SOV, schedule, version',
  bct.log('00000000-0000-0000-0000-00000000c7d1', (SELECT id FROM mark)),
  E'cost_estimates insert -\ncost_estimate_labor_rows insert Lav-1\ncost_estimate_permit_rows insert City permit\n' ||
  E'cost_estimate_labor_rows update Lav-1 rough_in_hrs_per_unit\ncost_estimates update - labor_rate\n' ||
  E'bid_sov_lines insert Underground\nbid_payment_schedule_rows insert At rough-in\nbid_versions update Base bid name');
UPDATE mark SET id = bct.last();

-- 6 · SUMP removed: its row, and everything its delete took with it, each still named SUMP (the
-- archive's snapshot of the count row) and in Base. The quoted cost has no key to its count row
-- (punch list #73, PR 0c), so it is not removed and not listed.
DELETE FROM public.bids_count_rows WHERE id = '00000000-0000-0000-0000-00000000c702';
SELECT bct.same('SUMP removed: named, in Base, by the estimator',
  (SELECT string_agg(table_name || ' ' || op || ' ' || COALESCE(label, '-') || ' ' || (bid_version_id = '00000000-0000-0000-0000-00000000c7a5')::text || ' ' ||
                     (changed_by = '00000000-0000-0000-0000-00000000c7e1')::text, E'\n' ORDER BY table_name, label)
     FROM bct.rows_after((SELECT id FROM mark))),
  E'bid_count_row_custom_prices delete SUMP true true\nbid_pricing_assignments delete SUMP true true\nbid_takeoff_stage_splits delete SUMP true true\n' ||
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

SELECT 'bid_changes PASSED' AS result;
ROLLBACK;
