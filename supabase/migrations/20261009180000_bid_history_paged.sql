SET lock_timeout = '3s';

-- Bid history, the row cap (punch list #73; docs/TROUBLESHOOTING.md [row-cap]). PostgREST answers
-- any read with at most 1,000 rows and no error, so a bid whose history passes that (for a dev, a
-- bid with a long delete archive already does) lost its oldest changes without a word. The client
-- now reads both functions a page at a time with .range(); this file gives each a total order so
-- the pages never shuffle, and lifts list_bid_history's own 2,000-row default cap.
--
-- Both bodies are their last versions (20261009060000, 20261009090000) with only the ORDER BY
-- (and the reader's default and LIMIT) changed. Same signatures, same grants, SECURITY INVOKER.

CREATE OR REPLACE FUNCTION public.list_bid_history(p_bid_id uuid, p_limit integer DEFAULT NULL)
RETURNS TABLE (
  source text,
  id bigint,
  archive_id uuid,
  bid_id uuid,
  bid_number text,
  table_name text,
  record_id uuid,
  count_row_id uuid,
  op text,
  changed text[],
  old_values jsonb,
  new_values jsonb,
  label text,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz,
  action text,
  by_app boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH RECURSIVE scope AS (
    SELECT b.id, b.bid_number FROM public.bids b WHERE b.id = p_bid_id
    UNION
    SELECT b.id, b.bid_number FROM public.bids b JOIN scope s ON b.adopted_into_bid_id = s.id
  ),
  estimates AS (
    SELECT ce.id FROM public.cost_estimates ce WHERE ce.bid_id IN (SELECT s.id FROM scope s)
  ),
  ledger AS (
    SELECT 'ledger'::text AS source, c.id, NULL::uuid AS archive_id, c.bid_id, c.table_name, c.record_id,
           c.count_row_id, c.op, c.changed, c.old_values, c.new_values, c.label, c.changed_by,
           c.changed_at, c.action, c.by_app
    FROM public.bid_changes c
    WHERE c.bid_id IN (SELECT s.id FROM scope s)
  ),
  archived AS (
    SELECT a.id AS archive_id, a.table_name, a.record_id, a.group_key, a.row_data, a.deleted_by, a.deleted_at
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL
      AND a.table_name = ANY (public.bid_changes_tables())
      AND a.table_name <> 'bids'
      AND a.record_id IS NOT NULL
      AND (
        a.group_key IN (SELECT s.id::text FROM scope s)
        OR (a.table_name LIKE 'cost\_estimate\_%' AND a.group_key IN (SELECT e.id::text FROM estimates e))
      )
      AND NOT EXISTS (
        SELECT 1 FROM ledger l
        WHERE l.op = 'delete' AND l.table_name = a.table_name AND l.record_id::text = a.record_id
      )
  ),
  archive AS (
    SELECT
      'archive'::text AS source,
      NULL::bigint AS id,
      x.archive_id,
      COALESCE(
        NULLIF(x.row_data ->> 'bid_id', '')::uuid,
        (SELECT ce.bid_id FROM public.cost_estimates ce WHERE ce.id::text = x.group_key),
        p_bid_id
      ) AS bid_id,
      x.table_name,
      x.record_id::uuid AS record_id,
      CASE
        WHEN x.table_name = 'bids_count_rows' THEN x.record_id::uuid
        ELSE NULLIF(x.row_data ->> 'count_row_id', '')::uuid
      END AS count_row_id,
      'delete'::text AS op,
      ARRAY(
        SELECT k FROM jsonb_object_keys(x.row_data) AS k
        WHERE k NOT IN ('id', 'created_at', 'updated_at', 'updated_by', 'applied_at', 'applied_by')
          AND x.row_data -> k <> 'null'::jsonb
        ORDER BY k
      ) AS changed,
      x.row_data AS old_values,
      NULL::jsonb AS new_values,
      CASE
        WHEN x.table_name = 'bids_count_rows' THEN x.row_data ->> 'fixture'
        WHEN x.table_name = 'bids_takeoff_rough_part_lines' THEN
          (SELECT mp.name FROM public.material_parts mp WHERE mp.id::text = x.row_data ->> 'part_id')
        WHEN x.row_data ? 'count_row_id' THEN COALESCE(
          (SELECT cr.fixture FROM public.bids_count_rows cr WHERE cr.id::text = x.row_data ->> 'count_row_id'),
          (SELECT s.row_data ->> 'fixture' FROM public.deleted_records_archive s
            WHERE s.table_name = 'bids_count_rows' AND s.record_id = x.row_data ->> 'count_row_id'
            ORDER BY s.deleted_at DESC LIMIT 1)
        )
        WHEN x.table_name IN ('cost_estimate_labor_rows', 'cost_estimate_labor_rows_unmatched') THEN x.row_data ->> 'fixture'
        WHEN x.table_name = 'bid_sov_lines' THEN x.row_data ->> 'label'
        WHEN x.table_name = 'bid_payment_schedule_rows' THEN x.row_data ->> 'timing'
        WHEN x.table_name = 'bid_versions' THEN x.row_data ->> 'name'
        WHEN x.table_name LIKE 'cost\_estimate\_%\_rows' THEN NULLIF(btrim(x.row_data ->> 'note'), '')
      END AS label,
      x.deleted_by AS changed_by,
      x.deleted_at AS changed_at,
      NULL::text AS action,
      NULL::boolean AS by_app
    FROM archived x
  ),
  everything AS (
    SELECT * FROM ledger
    UNION ALL
    SELECT * FROM archive
  )
  SELECT
    e.source, e.id, e.archive_id, e.bid_id, s.bid_number, e.table_name, e.record_id, e.count_row_id,
    e.op, e.changed, e.old_values, e.new_values, e.label, e.changed_by, u.name AS changed_by_name,
    e.changed_at, e.action, e.by_app
  FROM everything e
  LEFT JOIN scope s ON s.id = e.bid_id
  LEFT JOIN public.users u ON u.id = e.changed_by
  -- A total order, so the client's pages (PostgREST's .range()) never shuffle: an archive row has
  -- no ledger id, and a cascade removes many rows at one deleted_at, so its own id breaks the tie.
  ORDER BY e.changed_at DESC, e.id DESC NULLS LAST, e.archive_id DESC
  -- No cap of its own: the client reads a page at a time. p_limit, when given, still bounds it.
  LIMIT CASE WHEN p_limit IS NULL THEN NULL ELSE GREATEST(1, p_limit) END
$$;

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
  -- A total order, so the client's pages never shuffle.
  ORDER BY x.cell_key, x.kind, x.rank, x.name_key NULLS FIRST, x.changed_at DESC, x.label
$$;
