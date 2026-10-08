SET lock_timeout = '3s';

-- Bid history PR 2 (punch list #73, to-dos/bid-history): the reader. PR 1 (v2.4598) writes every
-- change on a bid into bid_changes; this file is the one read the History window makes.
--
-- list_bid_history(p_bid_id, p_limit) returns, newest first:
--   * the ledger's rows for the bid, and for every bid adopted into it (the owner, 2026-10-08:
--     the history follows the adopt and shows both bids, each row with its bid number);
--   * the delete archive's rows for those bids that the ledger does not already hold (rows
--     removed before the ledger was pushed, kept 90 days), as op 'delete' with the snapshot as
--     the old values and source 'archive'.
--
-- SECURITY INVOKER on purpose. Everything it reads runs under the caller's own policies:
-- bid_changes is read by whoever can read the bid (the owner, 2026-10-08: every estimator sees
-- every change), bids decide the adopt scope and the numbers, users the names. The archive keeps
-- its dev-only read, so its rows reach a dev and nobody else; widening that read is a separate
-- decision, not made here.
--
-- Labels: a ledger row carries the name the trigger gave it. An archive row is named here the
-- same way record_bid_change() names a row: a count row by its fixture, what hangs on a count row
-- by that row's fixture (live, else its own archive snapshot), a part line by its part, a labor
-- row by its fixture, a direct-cost row by its note, an SOV line, a payment row and a version by
-- their own words.

CREATE OR REPLACE FUNCTION public.list_bid_history(p_bid_id uuid, p_limit integer DEFAULT 2000)
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
  ORDER BY e.changed_at DESC, e.id DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 2000), 10000))
$$;

COMMENT ON FUNCTION public.list_bid_history(uuid, integer) IS
  'Bid history PR 2 (punch list #73): a bid''s ledger rows and those of every bid adopted into it, plus the delete archive''s rows for them that the ledger does not hold, newest first, each with its bid number and author''s name. SECURITY INVOKER: every read runs under the caller''s own policies (the archive stays dev-only).';

REVOKE ALL ON FUNCTION public.list_bid_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_history(uuid, integer) TO authenticated;
