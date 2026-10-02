-- A copy of a Combined takeoff keeps its stage boxes and order rules (v2.4388, punch list #78).
-- Runs as an estimator through RLS, inside one transaction that rolls back. Raises on the first
-- failed assertion; ends with "combined_copies PASSED". See scripts/pgtest-combined-copies.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000e1', 'estimator@bed.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000000e1', 'estimator@bed.test', 'Bed Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = 'estimator', name = 'Bed Estimator';
INSERT INTO public.service_types (id, name) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'Bed Plumbing'), ('00000000-0000-0000-0000-00000000a002', 'Bed HVAC');
INSERT INTO public.material_parts (id, name, service_type_id) VALUES
  ('00000000-0000-0000-0000-00000000b001', 'Bed closet carrier', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000b002', 'Bed 2 in copper', '00000000-0000-0000-0000-00000000a001');

CREATE SCHEMA bedt;
-- One takeoff with every kind of box: on a fixture, on a line, on a part inside a line.
CREATE FUNCTION bedt.seed(p_bid uuid, p_name text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE wc uuid; lav uuid; pipe uuid; l1 uuid; l2 uuid; ce uuid;
BEGIN
  INSERT INTO public.bids (id, created_by, service_type_id, project_name, materials_model)
  VALUES (p_bid, '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001', p_name, 'rough');
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order) VALUES (p_bid, 'WC-1', 3, 1) RETURNING id INTO wc;
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order) VALUES (p_bid, 'LAV-1', 2, 2) RETURNING id INTO lav;
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order, unit) VALUES (p_bid, 'Copper main', 105, 3, 'ft') RETURNING id INTO pipe;
  INSERT INTO public.bids_takeoff_rough_part_lines (bid_id, count_row_id, part_id, quantity, unit_price, sequence_order)
  VALUES (p_bid, wc, '00000000-0000-0000-0000-00000000b001', 1, 100, 1) RETURNING id INTO l1;
  INSERT INTO public.bids_takeoff_rough_part_lines (bid_id, count_row_id, part_id, quantity, unit_price, sequence_order)
  VALUES (p_bid, wc, '00000000-0000-0000-0000-00000000b002', 4, 9.5, 2) RETURNING id INTO l2;
  INSERT INTO public.bids_takeoff_rough_part_lines (bid_id, count_row_id, part_id, quantity, unit_price, sequence_order)
  VALUES (p_bid, lav, '00000000-0000-0000-0000-00000000b001', 2, 40, 1);
  INSERT INTO public.bids_takeoff_rough_part_lines (bid_id, count_row_id, part_id, quantity, unit_price, sequence_order, order_increment, order_increment_unit)
  VALUES (p_bid, pipe, '00000000-0000-0000-0000-00000000b002', 1, 9.5, 1, 20, 'ft_stick');
  INSERT INTO public.bid_takeoff_stage_splits (bid_id, count_row_id, line_id, part_id, rough_in, top_out, trim_set, source) VALUES
    (p_bid, wc,  NULL, NULL, 1, 0, 1, 'hand'),
    (p_bid, lav, NULL, NULL, 0, 0, 1, 'rule'),
    (p_bid, wc,  l1,   NULL, 0, 1, 0, 'book'),
    (p_bid, wc,  l2,   '00000000-0000-0000-0000-00000000b002', 70, 30, 0, 'assembly');
  INSERT INTO public.cost_estimates (bid_id, labor_rate, travel_people, travel_nights, travel_meals_rate, travel_hotel_rate)
  VALUES (p_bid, 55, 3, 2, 60, 140) RETURNING id INTO ce;
  INSERT INTO public.cost_estimate_labor_rows (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit, sequence_order, kind, unit, source, source_note) VALUES
    (ce, 'WC-1', 3, 1, 1, 1, 1, 'fixture', 'each', 'book', 'from the labor book'),
    (ce, 'Insulation sub', 1, 0, 0, 0, 2, 'sub', 'each', NULL, NULL),
    (ce, 'Copper main', 105, 2, 0, 0, 3, 'fixture', 'per_100ft', NULL, NULL);
END $$;

-- A takeoff's boxes, named by what they sit on, so two copies compare as text.
-- p_version: a version id, or NULL for the bid's unsplit rows.
CREATE FUNCTION bedt.boxes(p_bid uuid, p_version uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(
    c.fixture || '|' || COALESCE(lp.name || ' x' || l.quantity::float8, '-') || '|' || COALESCE(pp.name, '-') || '|' ||
    s.rough_in::float8 || '/' || s.top_out::float8 || '/' || s.trim_set::float8 || '|' || s.source ||
    CASE WHEN l.id IS NOT NULL AND l.count_row_id IS DISTINCT FROM s.count_row_id THEN '|LINE UNDER ANOTHER FIXTURE' ELSE '' END ||
    CASE WHEN l.id IS NOT NULL AND l.bid_version_id IS DISTINCT FROM p_version THEN '|LINE IN ANOTHER VERSION' ELSE '' END,
    E'\n' ORDER BY c.sequence_order, l.sequence_order NULLS FIRST, pp.name NULLS FIRST), '(none)')
  FROM public.bid_takeoff_stage_splits s
  JOIN public.bids_count_rows c ON c.id = s.count_row_id
  LEFT JOIN public.bids_takeoff_rough_part_lines l ON l.id = s.line_id
  LEFT JOIN public.material_parts lp ON lp.id = l.part_id
  LEFT JOIN public.material_parts pp ON pp.id = s.part_id
  WHERE s.bid_id = p_bid AND c.bid_id = p_bid AND c.bid_version_id IS NOT DISTINCT FROM p_version
$$;
CREATE FUNCTION bedt.lines(p_bid uuid, p_version uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(c.fixture || '|' || p.name || '|' || l.quantity::float8 || '|' || l.unit_price::float8 || '|' ||
    COALESCE(l.order_increment::float8::text, '-') || '|' || COALESCE(l.order_increment_unit, '-'),
    E'\n' ORDER BY c.sequence_order, l.sequence_order), '(none)')
  FROM public.bids_takeoff_rough_part_lines l
  JOIN public.bids_count_rows c ON c.id = l.count_row_id AND c.bid_version_id IS NOT DISTINCT FROM p_version
  JOIN public.material_parts p ON p.id = l.part_id
  WHERE l.bid_id = p_bid AND l.bid_version_id IS NOT DISTINCT FROM p_version
$$;
CREATE FUNCTION bedt.labor(p_bid uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT ce.labor_rate::float8 || ' travel ' || ce.travel_people || '/' || ce.travel_nights || '/' || COALESCE(ce.travel_meals_rate::float8::text, '-') || '/' || COALESCE(ce.travel_hotel_rate::float8::text, '-') || E'\n' ||
    (SELECT string_agg(r.fixture || '|' || r.count::float8 || '|' || r.kind || '|' || r.unit || '|' || COALESCE(r.source, '-') || '|' || COALESCE(r.source_note, '-'), E'\n' ORDER BY r.sequence_order)
       FROM public.cost_estimate_labor_rows r WHERE r.cost_estimate_id = ce.id)
  FROM public.cost_estimates ce WHERE ce.bid_id = p_bid
$$;
CREATE FUNCTION bedt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
GRANT USAGE ON SCHEMA bedt TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bedt TO authenticated;

-- Everything below runs as the estimator, through RLS.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
SET LOCAL ROLE authenticated;

SELECT bedt.seed('00000000-0000-0000-0000-00000000c001', 'Bed versions');
SELECT bedt.seed('00000000-0000-0000-0000-00000000c002', 'Bed duplicate');
SELECT bedt.seed('00000000-0000-0000-0000-00000000c003', 'Bed adopted');
SELECT bedt.seed('00000000-0000-0000-0000-00000000c004', 'Bed package');

CREATE TEMP TABLE want ON COMMIT DROP AS
  SELECT bedt.boxes('00000000-0000-0000-0000-00000000c001', NULL) AS boxes,
         bedt.lines('00000000-0000-0000-0000-00000000c001', NULL) AS lines,
         bedt.labor('00000000-0000-0000-0000-00000000c001') AS labor;
DO $$ BEGIN
  ASSERT (SELECT boxes FROM want) = E'WC-1|-|-|1/0/1|hand\nWC-1|Bed closet carrier x1|-|0/1/0|book\nWC-1|Bed 2 in copper x4|Bed 2 in copper|70/30/0|assembly\nLAV-1|-|-|0/0/1|rule',
    'the seed reads as written: ' || (SELECT boxes FROM want);
  ASSERT (SELECT lines FROM want) LIKE '%Copper main|Bed 2 in copper|1|9.5|20|ft_stick', 'the seeded order rule: ' || (SELECT lines FROM want);
END $$;

-- 1. The first split keeps the boxes (the rows keep their ids), and a new version copies them.
CREATE TEMP TABLE v ON COMMIT DROP AS
  SELECT public.materialize_bid_version('00000000-0000-0000-0000-00000000c001', 'To Plans') AS base, NULL::uuid AS ve, NULL::uuid AS third;
UPDATE v SET ve = public.create_bid_version('00000000-0000-0000-0000-00000000c001', 'Value Engineered', base, true, NULL);
SELECT bedt.same('first split keeps the boxes', bedt.boxes('00000000-0000-0000-0000-00000000c001', (SELECT base FROM v)), (SELECT boxes FROM want));
SELECT bedt.same('new version: lines and order rules', bedt.lines('00000000-0000-0000-0000-00000000c001', (SELECT ve FROM v)), (SELECT lines FROM want));
SELECT bedt.same('new version: stage boxes', bedt.boxes('00000000-0000-0000-0000-00000000c001', (SELECT ve FROM v)), (SELECT boxes FROM want));
SELECT bedt.same('new version: the source keeps its own', bedt.boxes('00000000-0000-0000-0000-00000000c001', (SELECT base FROM v)), (SELECT boxes FROM want));

-- 2. A version of that version: the copy of a copy.
UPDATE public.bid_takeoff_stage_splits s SET rough_in = 2, top_out = 1, trim_set = 0, source = 'hand'
  FROM public.bids_count_rows c WHERE c.id = s.count_row_id AND c.bid_version_id = (SELECT ve FROM v) AND c.fixture = 'LAV-1' AND s.line_id IS NULL;
UPDATE v SET third = public.create_bid_version('00000000-0000-0000-0000-00000000c001', 'Third', ve, false, NULL);
SELECT bedt.same('version of a version: stage boxes', bedt.boxes('00000000-0000-0000-0000-00000000c001', (SELECT third FROM v)),
  replace((SELECT boxes FROM want), 'LAV-1|-|-|0/0/1|rule', 'LAV-1|-|-|2/1/0|hand'));
SELECT bedt.same('version of a version: the base is untouched', bedt.boxes('00000000-0000-0000-0000-00000000c001', (SELECT base FROM v)), (SELECT boxes FROM want));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.bid_takeoff_stage_splits WHERE bid_id = '00000000-0000-0000-0000-00000000c001') = 12, 'three versions, four boxes each';
END $$;

-- 3. A duplicate into another trade, and one in the same trade.
CREATE TEMP TABLE d ON COMMIT DROP AS
  SELECT public.duplicate_bid_to_service_type('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a002') AS other_trade, NULL::uuid AS same_trade;
UPDATE d SET same_trade = public.duplicate_bid_to_service_type('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a001');
SELECT bedt.same('duplicate, another trade: lines and order rules', bedt.lines((SELECT other_trade FROM d), NULL), (SELECT lines FROM want));
SELECT bedt.same('duplicate, another trade: stage boxes', bedt.boxes((SELECT other_trade FROM d), NULL), (SELECT boxes FROM want));
SELECT bedt.same('duplicate, another trade: labor rows and travel', bedt.labor((SELECT other_trade FROM d)), (SELECT labor FROM want));
SELECT bedt.same('duplicate, same trade: stage boxes', bedt.boxes((SELECT same_trade FROM d), NULL), (SELECT boxes FROM want));
SELECT bedt.same('duplicate: the source keeps its own', bedt.boxes('00000000-0000-0000-0000-00000000c002', NULL), (SELECT boxes FROM want));

-- 4. Adopt: the boxes move to the package with their rows.
CREATE TEMP TABLE a ON COMMIT DROP AS
  SELECT public.adopt_bid_as_version('00000000-0000-0000-0000-00000000c004', '00000000-0000-0000-0000-00000000c003', 'Adopted', 'To Plans') AS adopted;
SELECT bedt.same('adopt: the boxes are the package''s', bedt.boxes('00000000-0000-0000-0000-00000000c004', (SELECT adopted FROM a)), (SELECT boxes FROM want));
SELECT bedt.same('adopt: lines and order rules', bedt.lines('00000000-0000-0000-0000-00000000c004', (SELECT adopted FROM a)), (SELECT lines FROM want));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.bid_takeoff_stage_splits WHERE bid_id = '00000000-0000-0000-0000-00000000c003') = 0, 'nothing left under the retired bid';
  ASSERT (SELECT count(*) FROM public.bid_takeoff_stage_splits WHERE bid_id = '00000000-0000-0000-0000-00000000c004') = 8, 'the package holds its own four and the adopted four';
END $$;

RESET ROLE;

-- 5. The migration's repair: a box an earlier adopt left under the retired bid goes to the bid its
-- fixture now belongs to, and a second run finds nothing.
UPDATE public.bid_takeoff_stage_splits SET bid_id = '00000000-0000-0000-0000-00000000c003' WHERE bid_id = '00000000-0000-0000-0000-00000000c004'
  AND count_row_id IN (SELECT id FROM public.bids_count_rows WHERE bid_version_id = (SELECT adopted FROM a));
SELECT bedt.same('an orphaned box is not read', bedt.boxes('00000000-0000-0000-0000-00000000c004', (SELECT adopted FROM a)), '(none)');
DO $$ DECLARE n integer; BEGIN
  UPDATE public.bid_takeoff_stage_splits s SET bid_id = c.bid_id FROM public.bids_count_rows c WHERE c.id = s.count_row_id AND s.bid_id IS DISTINCT FROM c.bid_id;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 4, 'the repair moves the four orphans, moved ' || n;
  UPDATE public.bid_takeoff_stage_splits s SET bid_id = c.bid_id FROM public.bids_count_rows c WHERE c.id = s.count_row_id AND s.bid_id IS DISTINCT FROM c.bid_id;
  GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'a second run finds none, moved ' || n;
END $$;
SELECT bedt.same('the repair gives the boxes back', bedt.boxes('00000000-0000-0000-0000-00000000c004', (SELECT adopted FROM a)), (SELECT boxes FROM want));

SELECT 'combined_copies PASSED' AS result;
ROLLBACK;
