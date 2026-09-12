SET lock_timeout = '3s';

-- v2.3369 — hours by default: a sent bid with a count sheet gets its labor rows
-- from the book without anyone opening the Labor tab.
-- Owner (2026-09-12): "zero people who have been bidding have been adding in
-- labor." 187 bids sent in 180 days, 57 with a count sheet, 7 with hours. The
-- Labor tab already mints labor rows from the count sheet with the book's
-- hours — but only when someone opens it. This does the same mint in SQL when
-- bids.bid_date_sent is first set (the per-GC send roll-up), and back-fills
-- every sent bid with a count sheet. Same rules as the client mint
-- (useBidPricingEngine.loadCostEstimateLaborRowsAndSync): the bid's chosen
-- book, else the first book by name for the bid's trade; hours by the entry's
-- fixture-type name or an alias (case-insensitive), else fixture_labor_defaults
-- by name, else zero (a zero row says nothing and waits in the New view's queue).
-- Existing rows are never overwritten; a zero row with no source gets filled.

CREATE OR REPLACE FUNCTION public.mint_labor_rows_from_book(p_bid_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid public.bids%ROWTYPE;
  v_est_id uuid;
  v_book uuid;
  v_book_name text;
  v_seq integer;
  v_minted integer := 0;
  r record;
  v_hit boolean;
  v_has boolean;
  v_r numeric; v_t numeric; v_tr numeric; v_unit text; v_kind text; v_src text; v_note text;
BEGIN
  SELECT * INTO v_bid FROM public.bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- The count sheet: the active version's rows, else the unversioned ones.
  IF NOT EXISTS (
    SELECT 1 FROM public.bids_count_rows c
     WHERE c.bid_id = p_bid_id AND (c.bid_version_id IS NOT DISTINCT FROM v_bid.selected_bid_version_id OR c.bid_version_id IS NULL)
  ) THEN
    RETURN 0;
  END IF;

  -- The book: the bid's, else the first by name for its trade (what the Labor tab auto-selects).
  v_book := v_bid.selected_labor_book_version_id;
  IF v_book IS NULL THEN
    SELECT id INTO v_book FROM public.labor_book_versions WHERE service_type_id = v_bid.service_type_id ORDER BY name ASC LIMIT 1;
  END IF;
  IF v_book IS NOT NULL THEN
    SELECT name INTO v_book_name FROM public.labor_book_versions WHERE id = v_book;
  END IF;

  -- The cost estimate row (one per bid).
  SELECT id INTO v_est_id FROM public.cost_estimates WHERE bid_id = p_bid_id;
  IF v_est_id IS NULL THEN
    INSERT INTO public.cost_estimates (bid_id) VALUES (p_bid_id)
    ON CONFLICT (bid_id) DO NOTHING;
    SELECT id INTO v_est_id FROM public.cost_estimates WHERE bid_id = p_bid_id;
  END IF;
  IF v_est_id IS NULL THEN RETURN 0; END IF;

  SELECT coalesce(max(sequence_order), 0) INTO v_seq FROM public.cost_estimate_labor_rows WHERE cost_estimate_id = v_est_id;

  FOR r IN
    SELECT c.fixture, sum(coalesce(c.count, 0)) AS cnt, min(c.sequence_order) AS seq
      FROM public.bids_count_rows c
     WHERE c.bid_id = p_bid_id AND (c.bid_version_id IS NOT DISTINCT FROM v_bid.selected_bid_version_id OR c.bid_version_id IS NULL)
     GROUP BY c.fixture
     ORDER BY min(c.sequence_order)
  LOOP
    -- Hours: book entry by fixture-type name, then by alias, then fixture_labor_defaults, then nothing.
    v_hit := false; v_r := 0; v_t := 0; v_tr := 0; v_unit := 'each'; v_kind := 'fixture'; v_src := NULL; v_note := NULL;
    IF v_book IS NOT NULL THEN
      SELECT e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.unit, e.kind, 'book', ft.name || CASE WHEN v_book_name IS NOT NULL THEN ' · ' || v_book_name ELSE '' END
        INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
        FROM public.labor_book_entries e JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
       WHERE e.version_id = v_book AND lower(trim(ft.name)) = lower(trim(r.fixture))
       ORDER BY e.sequence_order LIMIT 1;
      v_hit := FOUND;
      IF NOT v_hit THEN
        SELECT e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.unit, e.kind, 'alias', ft.name || CASE WHEN v_book_name IS NOT NULL THEN ' · ' || v_book_name ELSE '' END || ' (by alias)'
          INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
          FROM public.labor_book_entries e JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
         WHERE e.version_id = v_book
           AND EXISTS (SELECT 1 FROM unnest(coalesce(e.alias_names, '{}'::text[])) a WHERE lower(trim(a)) = lower(trim(r.fixture)))
         ORDER BY e.sequence_order LIMIT 1;
        v_hit := FOUND;
      END IF;
    END IF;
    IF NOT v_hit THEN
      SELECT d.rough_in_hrs, d.top_out_hrs, d.trim_set_hrs, 'each', 'fixture', 'book', 'fixture defaults'
        INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
        FROM public.fixture_labor_defaults d
       WHERE lower(trim(d.fixture)) = lower(trim(r.fixture))
       LIMIT 1;
      v_hit := FOUND;
    END IF;
    IF NOT v_hit THEN v_r := 0; v_t := 0; v_tr := 0; v_unit := 'each'; v_kind := 'fixture'; v_src := NULL; v_note := NULL; END IF;
    v_has := v_hit AND (coalesce(v_r, 0) + coalesce(v_t, 0) + coalesce(v_tr, 0)) > 0;

    IF NOT EXISTS (SELECT 1 FROM public.cost_estimate_labor_rows l WHERE l.cost_estimate_id = v_est_id AND l.fixture = r.fixture) THEN
      v_seq := v_seq + 1;
      INSERT INTO public.cost_estimate_labor_rows
        (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit, sequence_order, is_fixed, kind, unit, source, source_note)
      VALUES
        (v_est_id, r.fixture, r.cnt,
         coalesce(v_r, 0), coalesce(v_t, 0), coalesce(v_tr, 0),
         v_seq,
         coalesce(v_kind, 'fixture') = 'task',
         coalesce(v_kind, 'fixture'),
         coalesce(v_unit, 'each'),
         CASE WHEN v_has THEN v_src END,
         CASE WHEN v_has THEN v_note END);
      v_minted := v_minted + 1;
    ELSIF v_has THEN
      -- A row that says nothing yet (zero hours, no source) takes the book's hours; anything a person touched stays.
      UPDATE public.cost_estimate_labor_rows l
         SET rough_in_hrs_per_unit = v_r, top_out_hrs_per_unit = v_t, trim_set_hrs_per_unit = v_tr,
             kind = coalesce(v_kind, l.kind), unit = coalesce(v_unit, l.unit), is_fixed = coalesce(v_kind, l.kind) = 'task',
             source = v_src, source_note = v_note
       WHERE l.cost_estimate_id = v_est_id AND l.fixture = r.fixture
         AND l.source IS NULL AND l.kind <> 'sub'
         AND coalesce(l.rough_in_hrs_per_unit, 0) = 0 AND coalesce(l.top_out_hrs_per_unit, 0) = 0 AND coalesce(l.trim_set_hrs_per_unit, 0) = 0;
      IF FOUND THEN v_minted := v_minted + 1; END IF;
    END IF;
  END LOOP;

  RETURN v_minted;
END;
$$;
REVOKE ALL ON FUNCTION public.mint_labor_rows_from_book(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.mint_labor_rows_from_book(uuid) IS 'v2.3369: mint cost_estimate_labor_rows from the bid''s count sheet with the book''s hours (the Labor tab''s mint, in SQL). Never overwrites a row a person touched. Returns rows minted or filled.';

-- The send: bids.bid_date_sent first set (the per-GC roll-up writes it).
CREATE OR REPLACE FUNCTION public.bids_mint_labor_on_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bid_date_sent IS NOT NULL AND OLD.bid_date_sent IS NULL AND NOT public.is_digital_twin() THEN
    PERFORM public.mint_labor_rows_from_book(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bids_mint_labor_on_send ON public.bids;
CREATE TRIGGER bids_mint_labor_on_send
  AFTER UPDATE OF bid_date_sent ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.bids_mint_labor_on_send();

-- Back-fill: every sent bid with a count sheet (robot twins' ZZ bids included — they are bids with counts too, and read the same book).
DO $$
DECLARE r record; n_bids integer := 0; n_rows integer := 0; k integer;
BEGIN
  FOR r IN
    SELECT b.id FROM public.bids b
     WHERE b.bid_date_sent IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.bid_id = b.id)
  LOOP
    k := public.mint_labor_rows_from_book(r.id);
    IF k > 0 THEN n_bids := n_bids + 1; n_rows := n_rows + k; END IF;
  END LOOP;
  RAISE NOTICE 'labor_rows_from_book_on_send: % row(s) minted or filled across % sent bid(s)', n_rows, n_bids;
END $$;
