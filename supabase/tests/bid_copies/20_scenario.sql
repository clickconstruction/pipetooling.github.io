-- What a new version, a duplicate and an adopt carry (v2.4413, punch list #79): quoted fixture
-- costs, one version's rows only, and the bid's own prices. Runs as an estimator (and once as a
-- primary) through RLS, inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "bid_copies PASSED". See scripts/pgtest-bid-copies.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009e1', 'est@copies.test'), ('00000000-0000-0000-0000-0000000009e2', 'primary@copies.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009e1', 'est@copies.test', 'Copies Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000009e2', 'primary@copies.test', 'Copies Primary', 'primary')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.service_types (id, name) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Copies Plumbing'), ('00000000-0000-0000-0000-0000000009a2', 'Copies HVAC');
INSERT INTO public.fixture_types (id, service_type_id, name) VALUES
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009a1', 'Copies WC'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009a1', 'Copies LAV');
-- A shared price book (no bid): a copy keeps pointing at it.
INSERT INTO public.price_book_versions (id, name, service_type_id) VALUES ('00000000-0000-0000-0000-0000000009b0', 'Copies shared book', '00000000-0000-0000-0000-0000000009a1');
INSERT INTO public.price_book_entries (id, version_id, fixture_type_id, total_price) VALUES ('00000000-0000-0000-0000-0000000009c0', '00000000-0000-0000-0000-0000000009b0', '00000000-0000-0000-0000-0000000009f1', 900);

CREATE SCHEMA copt;
-- A bid with three count rows, its own price (an entry, an assignment, a custom price, a hidden
-- row), the price saved as the bid's, and quoted costs: one alone, two in a package.
CREATE FUNCTION copt.seed(p_bid uuid, p_name text, p_own_price boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
DECLARE wc uuid; lav uuid; ur uuid; price uuid; entry uuid; lot uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name)
  VALUES (p_bid, '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009a1', p_name);
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order) VALUES (p_bid, 'WC-1', 3, 1) RETURNING id INTO wc;
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order) VALUES (p_bid, 'LAV-1', 2, 2) RETURNING id INTO lav;
  INSERT INTO public.bids_count_rows (bid_id, fixture, count, sequence_order) VALUES (p_bid, 'UR-1', 1, 3) RETURNING id INTO ur;
  IF p_own_price THEN
    INSERT INTO public.price_book_versions (name, service_type_id, bid_id, sort_order) VALUES ('Own price', '00000000-0000-0000-0000-0000000009a1', p_bid, 0) RETURNING id INTO price;
    INSERT INTO public.price_book_entries (version_id, fixture_type_id, total_price, sequence_order) VALUES (price, '00000000-0000-0000-0000-0000000009f1', 1500, 1) RETURNING id INTO entry;
  ELSE
    price := '00000000-0000-0000-0000-0000000009b0'; entry := '00000000-0000-0000-0000-0000000009c0';
  END IF;
  INSERT INTO public.bid_pricing_assignments (bid_id, count_row_id, price_book_entry_id, price_book_version_id) VALUES (p_bid, wc, entry, price);
  INSERT INTO public.bid_count_row_custom_prices (bid_id, count_row_id, price_book_version_id, unit_price) VALUES (p_bid, lav, price, 640);
  INSERT INTO public.bid_count_row_submission_hides (bid_id, count_row_id, price_book_version_id) VALUES (p_bid, ur, price);
  UPDATE public.bids SET selected_price_book_version_id = price WHERE id = p_bid;
  INSERT INTO public.bid_count_row_custom_costs (bid_id, count_row_id, unit_materials_cents, house_name, lot_group_id, applied_by) VALUES
    (p_bid, wc, 41250, 'Moore Supply', NULL, '00000000-0000-0000-0000-0000000009e1'),
    (p_bid, lav, 18000, 'Ferguson', lot, '00000000-0000-0000-0000-0000000009e1'),
    (p_bid, ur, 22000, 'Ferguson', lot, '00000000-0000-0000-0000-0000000009e1');
END $$;

-- The count rows of a bid's version (NULL = unsplit), as text.
CREATE FUNCTION copt.rows(p_bid uuid, p_version uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(fixture || ' x' || count::float8, ', ' ORDER BY sequence_order, id), '(none)')
  FROM public.bids_count_rows WHERE bid_id = p_bid AND bid_version_id IS NOT DISTINCT FROM p_version $$;
-- The quoted costs on those rows. Packages are numbered in order of first use, so two copies of
-- one takeoff read the same whatever their package ids.
CREATE FUNCTION copt.costs(p_bid uuid, p_version uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(c.fixture || '=' || k.unit_materials_cents || ' ' || COALESCE(k.house_name, '-') || ' ' ||
    COALESCE('package ' || dense_rank_of.n, 'alone'), ', ' ORDER BY c.sequence_order), '(none)')
  FROM public.bid_count_row_custom_costs k
  JOIN public.bids_count_rows c ON c.id = k.count_row_id AND c.bid_id = p_bid AND c.bid_version_id IS NOT DISTINCT FROM p_version
  LEFT JOIN LATERAL (SELECT count(DISTINCT k2.lot_group_id) AS n FROM public.bid_count_row_custom_costs k2
                       JOIN public.bids_count_rows c2 ON c2.id = k2.count_row_id AND c2.bid_id = p_bid AND c2.bid_version_id IS NOT DISTINCT FROM p_version
                      WHERE k2.lot_group_id IS NOT NULL AND c2.sequence_order <= (SELECT min(c3.sequence_order) FROM public.bid_count_row_custom_costs k3 JOIN public.bids_count_rows c3 ON c3.id = k3.count_row_id WHERE k3.lot_group_id = k.lot_group_id AND c3.bid_id = p_bid AND c3.bid_version_id IS NOT DISTINCT FROM p_version)) dense_rank_of ON k.lot_group_id IS NOT NULL
  WHERE k.bid_id = p_bid $$;
-- What the bid prices each row at, and whose price it is: 'own' (a price of this bid), 'shared'
-- (a template) or 'ANOTHER BID' (the gap).
CREATE FUNCTION copt.prices(p_bid uuid, p_version uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(string_agg(x.line, E'\n' ORDER BY x.seq, x.line), '(none)') FROM (
    SELECT c.sequence_order AS seq, c.fixture || ' entry $' || e.total_price::float8 || ' [' || CASE WHEN p.bid_id = p_bid THEN 'own' WHEN p.bid_id IS NULL THEN 'shared' ELSE 'ANOTHER BID' END ||
           CASE WHEN e.version_id <> a.price_book_version_id THEN ', ENTRY OF ANOTHER PRICE' ELSE '' END || ']' AS line
      FROM public.bid_pricing_assignments a JOIN public.bids_count_rows c ON c.id = a.count_row_id JOIN public.price_book_versions p ON p.id = a.price_book_version_id JOIN public.price_book_entries e ON e.id = a.price_book_entry_id
     WHERE a.bid_id = p_bid AND c.bid_version_id IS NOT DISTINCT FROM p_version
    UNION ALL
    SELECT c.sequence_order, c.fixture || ' custom $' || k.unit_price::float8 || ' [' || CASE WHEN p.bid_id = p_bid THEN 'own' WHEN p.bid_id IS NULL THEN 'shared' ELSE 'ANOTHER BID' END || ']'
      FROM public.bid_count_row_custom_prices k JOIN public.bids_count_rows c ON c.id = k.count_row_id JOIN public.price_book_versions p ON p.id = k.price_book_version_id
     WHERE k.bid_id = p_bid AND c.bid_version_id IS NOT DISTINCT FROM p_version
    UNION ALL
    SELECT c.sequence_order, c.fixture || ' hidden [' || CASE WHEN p.bid_id = p_bid THEN 'own' WHEN p.bid_id IS NULL THEN 'shared' ELSE 'ANOTHER BID' END || ']'
      FROM public.bid_count_row_submission_hides h JOIN public.bids_count_rows c ON c.id = h.count_row_id JOIN public.price_book_versions p ON p.id = h.price_book_version_id
     WHERE h.bid_id = p_bid AND c.bid_version_id IS NOT DISTINCT FROM p_version
  ) x $$;
-- The bid's saved price: whose it is.
CREATE FUNCTION copt.saved(p_bid uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT p.name || ' [' || CASE WHEN p.bid_id = p_bid THEN 'own' WHEN p.bid_id IS NULL THEN 'shared' ELSE 'ANOTHER BID' END || ']'
                     FROM public.bids b JOIN public.price_book_versions p ON p.id = b.selected_price_book_version_id WHERE b.id = p_bid), '(none)') $$;
CREATE FUNCTION copt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
GRANT USAGE ON SCHEMA copt TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA copt TO authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000009e1', true);
SET LOCAL ROLE authenticated;

SELECT copt.seed('00000000-0000-0000-0000-0000000009d1', 'Copies: versions');
SELECT copt.seed('00000000-0000-0000-0000-0000000009d2', 'Copies: duplicate me');
SELECT copt.seed('00000000-0000-0000-0000-0000000009d3', 'Copies: adopted');
SELECT copt.seed('00000000-0000-0000-0000-0000000009d4', 'Copies: package');
SELECT copt.seed('00000000-0000-0000-0000-0000000009d5', 'Copies: shared book', false);
SELECT copt.seed('00000000-0000-0000-0000-0000000009d6', 'Copies: a primary makes the version');

CREATE TEMP TABLE want ON COMMIT DROP AS SELECT
  'WC-1 x3, LAV-1 x2, UR-1 x1'::text AS rows,
  'WC-1=41250 Moore Supply alone, LAV-1=18000 Ferguson package 1, UR-1=22000 Ferguson package 1'::text AS costs,
  E'WC-1 entry $1500 [own]\nLAV-1 custom $640 [own]\nUR-1 hidden [own]'::text AS prices;
SELECT copt.same('the seed: rows', copt.rows('00000000-0000-0000-0000-0000000009d1', NULL), (SELECT rows FROM want));
SELECT copt.same('the seed: quoted costs', copt.costs('00000000-0000-0000-0000-0000000009d1', NULL), (SELECT costs FROM want));
SELECT copt.same('the seed: prices', copt.prices('00000000-0000-0000-0000-0000000009d1', NULL), (SELECT prices FROM want));

-- Gap 1 · a new version carries the quoted costs, and a package reverts on its own.
CREATE TEMP TABLE v ON COMMIT DROP AS SELECT public.materialize_bid_version('00000000-0000-0000-0000-0000000009d1', 'To Plans') AS base, NULL::uuid AS ve;
UPDATE v SET ve = public.create_bid_version('00000000-0000-0000-0000-0000000009d1', 'Value Engineered', base, true, NULL);
SELECT copt.same('new version: quoted costs', copt.costs('00000000-0000-0000-0000-0000000009d1', (SELECT ve FROM v)), (SELECT costs FROM want));
SELECT copt.same('new version: the source keeps its own', copt.costs('00000000-0000-0000-0000-0000000009d1', (SELECT base FROM v)), (SELECT costs FROM want));
DO $$ DECLARE src_lot uuid; new_lot uuid; BEGIN
  SELECT k.lot_group_id INTO src_lot FROM public.bid_count_row_custom_costs k JOIN public.bids_count_rows c ON c.id = k.count_row_id WHERE c.bid_version_id = (SELECT base FROM v) AND c.fixture = 'LAV-1';
  SELECT k.lot_group_id INTO new_lot FROM public.bid_count_row_custom_costs k JOIN public.bids_count_rows c ON c.id = k.count_row_id WHERE c.bid_version_id = (SELECT ve FROM v) AND c.fixture = 'LAV-1';
  ASSERT new_lot IS NOT NULL AND new_lot <> src_lot, 'the copy''s package has its own id';
  -- Reverting the package in the new version (the app deletes by lot_group_id) leaves the source's.
  DELETE FROM public.bid_count_row_custom_costs WHERE lot_group_id = new_lot;
END $$;
SELECT copt.same('reverting the package in the new version leaves the source alone', copt.costs('00000000-0000-0000-0000-0000000009d1', (SELECT base FROM v)), (SELECT costs FROM want));
SELECT copt.same('…and takes only the package from the new version', copt.costs('00000000-0000-0000-0000-0000000009d1', (SELECT ve FROM v)), 'WC-1=41250 Moore Supply alone');

-- Gap 1 · deleting a count row takes its quoted cost with it.
DO $$ DECLARE n integer; BEGIN
  DELETE FROM public.bids_count_rows WHERE bid_version_id = (SELECT ve FROM v) AND fixture = 'WC-1';
  SELECT count(*) INTO n FROM public.bid_count_row_custom_costs k WHERE NOT EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.id = k.count_row_id);
  ASSERT n = 0, 'no quoted cost is left without its count row, found ' || n;
  RAISE NOTICE 'ok: deleting a count row deletes its quoted cost';
END $$;

-- Gap 2 · a duplicate of a bid with versions copies the version it is on, as one plain bid.
CREATE TEMP TABLE d ON COMMIT DROP AS SELECT NULL::uuid AS split_copy, NULL::uuid AS same_trade, NULL::uuid AS other_trade, NULL::uuid AS shared_copy;
UPDATE public.bids SET selected_bid_version_id = (SELECT base FROM v) WHERE id = '00000000-0000-0000-0000-0000000009d1';
UPDATE d SET split_copy = public.duplicate_bid_to_service_type('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009a1');
SELECT copt.same('duplicate of a bid with versions: one version''s rows, not both', copt.rows((SELECT split_copy FROM d), NULL), (SELECT rows FROM want));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.bid_versions WHERE bid_id = (SELECT split_copy FROM d)) = 0, 'the copy is one plain bid';
  ASSERT (SELECT count(*) FROM public.bids_count_rows WHERE bid_id = (SELECT split_copy FROM d)) = 3, 'three rows in all';
END $$;
SELECT copt.same('duplicate of a bid with versions: that version''s prices, its own', copt.prices((SELECT split_copy FROM d), NULL), (SELECT prices FROM want));
SELECT copt.same('duplicate of a bid with versions: that version''s quoted costs', copt.costs((SELECT split_copy FROM d), NULL), (SELECT costs FROM want));

-- Gap 3 · a duplicate has its own copy of the bid's prices.
UPDATE d SET same_trade = public.duplicate_bid_to_service_type('00000000-0000-0000-0000-0000000009d2', '00000000-0000-0000-0000-0000000009a1');
SELECT copt.same('duplicate: prices are the copy''s own', copt.prices((SELECT same_trade FROM d), NULL), (SELECT prices FROM want));
SELECT copt.same('duplicate: the saved price is the copy''s own', copt.saved((SELECT same_trade FROM d)), 'Own price [own]');
SELECT copt.same('duplicate: the source keeps its prices', copt.prices('00000000-0000-0000-0000-0000000009d2', NULL), (SELECT prices FROM want));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.price_book_versions WHERE bid_id = (SELECT same_trade FROM d)) = 1, 'the copy owns one price';
  ASSERT (SELECT count(*) FROM public.price_book_versions WHERE bid_id = '00000000-0000-0000-0000-0000000009d2') = 1, 'the source still owns one';
  ASSERT (SELECT count(*) FROM public.price_book_entries e JOIN public.price_book_versions p ON p.id = e.version_id WHERE p.bid_id = (SELECT same_trade FROM d)) = 1, 'with its entry';
END $$;
-- Gap 1 · same trade: the quoted costs come along, without the other bid's quote line.
SELECT copt.same('duplicate, same trade: quoted costs', copt.costs((SELECT same_trade FROM d), NULL), (SELECT costs FROM want));
-- …another trade: the quote is the other trade's, so the costs stay behind. The prices still come.
UPDATE d SET other_trade = public.duplicate_bid_to_service_type('00000000-0000-0000-0000-0000000009d2', '00000000-0000-0000-0000-0000000009a2');
SELECT copt.same('duplicate, another trade: no quoted costs', copt.costs((SELECT other_trade FROM d), NULL), '(none)');
SELECT copt.same('duplicate, another trade: prices are the copy''s own', copt.prices((SELECT other_trade FROM d), NULL), (SELECT prices FROM want));
-- A bid priced on a shared book keeps pointing at the shared book.
UPDATE d SET shared_copy = public.duplicate_bid_to_service_type('00000000-0000-0000-0000-0000000009d5', '00000000-0000-0000-0000-0000000009a1');
SELECT copt.same('duplicate of a bid on a shared book: still the shared book', copt.prices((SELECT shared_copy FROM d), NULL), replace(replace((SELECT prices FROM want), '[own]', '[shared]'), '$1500', '$900'));
SELECT copt.same('duplicate of a bid on a shared book: the saved price', copt.saved((SELECT shared_copy FROM d)), 'Copies shared book [shared]');

-- Gap 1 · adopt: the quoted costs move to the package.
CREATE TEMP TABLE a ON COMMIT DROP AS SELECT public.adopt_bid_as_version('00000000-0000-0000-0000-0000000009d4', '00000000-0000-0000-0000-0000000009d3', 'Adopted', 'To Plans') AS adopted;
SELECT copt.same('adopt: the quoted costs are the package''s', copt.costs('00000000-0000-0000-0000-0000000009d4', (SELECT adopted FROM a)), (SELECT costs FROM want));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.bid_count_row_custom_costs WHERE bid_id = '00000000-0000-0000-0000-0000000009d3') = 0, 'none left under the retired bid';
END $$;

-- A primary may make a version and may not write quoted costs (ACCESS_CONTROL.md): the version is
-- made, without them, and nothing fails.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009e2","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000009e2', true);
CREATE TEMP TABLE pv ON COMMIT DROP AS SELECT public.materialize_bid_version('00000000-0000-0000-0000-0000000009d6', 'To Plans') AS base, NULL::uuid AS ve;
UPDATE pv SET ve = public.create_bid_version('00000000-0000-0000-0000-0000000009d6', 'By a primary', base, true, NULL);
SELECT copt.same('a primary''s new version: the rows', copt.rows('00000000-0000-0000-0000-0000000009d6', (SELECT ve FROM pv)), (SELECT rows FROM want));
RESET ROLE;
SELECT copt.same('a primary''s new version: no quoted costs, and no error', copt.costs('00000000-0000-0000-0000-0000000009d6', (SELECT ve FROM pv)), '(none)');

SELECT 'bid_copies PASSED' AS result;
ROLLBACK;
