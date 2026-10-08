SET lock_timeout = '3s';

-- Bid history PR 3 (punch list #73, to-dos/bid-history): the read under the cells. With the past
-- shown, Pricing's prices, Counts' counts, Takeoffs' quantities and prices and Labor's hours each
-- show up to two earlier values under the box. Loading a bid's whole ledger to draw a tab would not
-- last, so this returns only what the cells draw, keyed the way each tab finds its cell:
--
--   price:<count row>:<pricing>          a Workbench price. The typed price lives in one of two
--                                        places (bid_count_row_custom_prices.unit_price, or
--                                        bid_pricing_assignments.unit_price_override when a book
--                                        pick exists); both are one price history here.
--   count:<count row>                    a count.
--   takeoff:<part line>:<column>         a takeoff line's quantity or unit price.
--   labor:<labor row>:<column>           a labor row's rough-in, top-out or trim-set hours.
--
-- For each cell: its last two earlier values (the old side of each update, newest first) and how
-- many changes there were in all ('changed'). For each removed row: the value it had when it went,
-- with a name key ('removed'), so a re-imported Lav-1 (a new row, a new id) can show "an earlier
-- Lav-1 row" — the label fallback the card planned for Wendi's case. Takeoff lines have no name
-- fallback: one part sits on many count rows.
--
-- SECURITY INVOKER: the ledger, and the live rows a price's pricing is read from, under the
-- caller's own policies (whoever can read the bid). The delete archive is not read here.

CREATE OR REPLACE FUNCTION public.latest_bid_cell_history(p_bid_id uuid)
RETURNS TABLE (
  cell_key text,
  name_key text,
  -- 'changed' = an update's old value (rank 1 the newest); 'removed' = the value when the row went.
  kind text,
  -- The column the value is worded by ('unit_price' for both price sources).
  column_name text,
  label text,
  value jsonb,
  changed_by_name text,
  changed_at timestamptz,
  rank integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH cells(table_name, column_name, words) AS (
    VALUES
      ('bid_count_row_custom_prices', 'unit_price', 'unit_price'),
      ('bid_pricing_assignments', 'unit_price_override', 'unit_price'),
      ('bids_count_rows', 'count', 'count'),
      ('bids_takeoff_rough_part_lines', 'quantity', 'quantity'),
      ('bids_takeoff_rough_part_lines', 'unit_price', 'unit_price'),
      ('cost_estimate_labor_rows', 'rough_in_hrs_per_unit', 'rough_in_hrs_per_unit'),
      ('cost_estimate_labor_rows', 'top_out_hrs_per_unit', 'top_out_hrs_per_unit'),
      ('cost_estimate_labor_rows', 'trim_set_hrs_per_unit', 'trim_set_hrs_per_unit')
  ),
  entries AS (
    SELECT
      c.id, c.op, c.label, c.changed_by, c.changed_at, k.words,
      -- An update's value before it; a removal's value when it went: the old side either way.
      c.old_values -> k.column_name AS value,
      CASE
        WHEN k.table_name IN ('bid_count_row_custom_prices', 'bid_pricing_assignments') THEN
          'price:' || c.count_row_id || ':' || COALESCE(
            c.old_values ->> 'price_book_version_id',
            (SELECT cp.price_book_version_id::text FROM public.bid_count_row_custom_prices cp
              WHERE k.table_name = 'bid_count_row_custom_prices' AND cp.id = c.record_id),
            (SELECT pa.price_book_version_id::text FROM public.bid_pricing_assignments pa
              WHERE k.table_name = 'bid_pricing_assignments' AND pa.id = c.record_id),
            '')
        WHEN k.table_name = 'bids_count_rows' THEN 'count:' || c.record_id
        WHEN k.table_name = 'bids_takeoff_rough_part_lines' THEN 'takeoff:' || c.record_id || ':' || k.column_name
        ELSE 'labor:' || c.record_id || ':' || k.column_name
      END AS cell_key,
      CASE
        WHEN c.label IS NULL OR btrim(c.label) = '' THEN NULL
        WHEN k.table_name IN ('bid_count_row_custom_prices', 'bid_pricing_assignments') THEN
          'price:' || COALESCE(c.old_values ->> 'price_book_version_id', '') || ':' || lower(btrim(c.label))
        WHEN k.table_name = 'bids_count_rows' THEN 'count:' || COALESCE(c.bid_version_id::text, '') || ':' || lower(btrim(c.label))
        WHEN k.table_name = 'cost_estimate_labor_rows' THEN 'labor:' || lower(btrim(c.label)) || ':' || k.column_name
      END AS name_key
    FROM public.bid_changes c
    JOIN cells k ON k.table_name = c.table_name
    WHERE c.bid_id = p_bid_id
      AND c.op IN ('update', 'delete')
      AND k.column_name = ANY (c.changed)
  ),
  changed AS (
    SELECT e.*, 'changed'::text AS kind,
           row_number() OVER (PARTITION BY e.cell_key ORDER BY e.changed_at DESC, e.id DESC)::integer AS rank,
           count(*) OVER (PARTITION BY e.cell_key)::integer AS total
    FROM entries e
    WHERE e.op = 'update'
  ),
  removed AS (
    SELECT e.*, 'removed'::text AS kind,
           row_number() OVER (PARTITION BY e.name_key ORDER BY e.changed_at DESC, e.id DESC)::integer AS rank,
           1 AS total
    FROM entries e
    WHERE e.op = 'delete' AND e.name_key IS NOT NULL
  )
  SELECT x.cell_key, x.name_key, x.kind, x.words AS column_name, x.label, x.value,
         u.name AS changed_by_name, x.changed_at, x.rank, x.total
  FROM (
    SELECT cell_key, name_key, kind, words, label, value, changed_by, changed_at, rank, total FROM changed WHERE rank <= 2
    UNION ALL
    SELECT cell_key, name_key, kind, words, label, value, changed_by, changed_at, rank, total FROM removed WHERE rank = 1
  ) x
  LEFT JOIN public.users u ON u.id = x.changed_by
  ORDER BY x.cell_key, x.kind, x.rank
$$;

COMMENT ON FUNCTION public.latest_bid_cell_history(uuid) IS
  'Bid history PR 3 (punch list #73): for the cells that show their past (prices from either source, counts, takeoff quantities and prices, labor hours), each cell''s last two earlier values and its count of changes, keyed as the tabs find their cells, plus each name''s newest removed value (the label fallback). SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.latest_bid_cell_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.latest_bid_cell_history(uuid) TO authenticated;
