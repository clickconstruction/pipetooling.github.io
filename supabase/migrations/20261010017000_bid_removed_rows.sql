SET lock_timeout = '3s';

-- Bid history PR 5 (punch list #73, to-dos/bid-history): a bid's editors see the bid's own removed
-- rows and put one back. The owner, 2026-10-09: yes, a bid's editors see the bid's OWN removed rows
-- so they can Put them back.
--
-- The delete archive keeps its dev-only read. These functions read it as their definer, for one bid
-- at a time, and only for someone who can edit that bid (can_edit_bid). A whole bid still comes back
-- only from Settings -> Recently deleted, a dev's restore.
--
--   can_edit_bid(p_bid_id)            the bids update policy's rule, as one check
--   list_bid_removed_rows(p_bid_id)   the bid's own removed rows still out, newest first
--   restore_bid_removed_row(p_id)     one removed row back, with what was removed with it
--
-- Functions only: no table, no column, no lock beyond the rows a restore inserts.

-- ---------------------------------------------------------------------------------------------
-- Who may edit a bid, as one check: the parts of the bids update policy, each named. A SECURITY
-- DEFINER function cannot evaluate the caller's policies, so the definers below call this instead.
-- The rows a restore inserts are the bid's own rows, which the same people may write by hand.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_bid(p_bid_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bids b
    JOIN public.users u ON u.id = auth.uid()
    WHERE b.id = p_bid_id
      -- The bids update policy's roles (20260927210000).
      AND u.role::text IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary')
      -- primary_scope_bids (20260823171344): a primary edits only the bids they are on.
      AND (u.role::text <> 'primary' OR b.estimator_id = u.id OR b.account_manager_id = u.id OR b.created_by = u.id)
      -- Training mode's write blocks (20260713090000).
      AND NOT public.is_read_only()
      -- The twin fence (20261005222937): a digital twin edits only the bids it made or estimates.
      AND (NOT public.is_digital_twin() OR b.created_by = u.id OR b.estimator_id = u.id)
  );
$$;

ALTER FUNCTION public.can_edit_bid(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_edit_bid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_bid(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_edit_bid(uuid) IS
  'Bid history PR 5 (punch list #73): whether the caller may edit the bid, as the bids update policy rules it (its roles, a primary''s own bids, training mode, the twin fence). For SECURITY DEFINER functions, which cannot evaluate the caller''s policies.';

-- ---------------------------------------------------------------------------------------------
-- The bid's own removed rows still out: its tables' rows grouped under the bid, and the
-- direct-cost rows grouped under one of its estimates (live, or removed with the bid's estimate).
-- The bid's own rows only: an adopted bid's are its own editors' (the owner: "the bid's OWN").
-- Each row is named the way list_bid_history names an archive row. in_ledger says the ledger also
-- holds its removal, so the window draws the ledger's line and puts this row's Put back on it.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_bid_removed_rows(p_bid_id uuid)
RETURNS TABLE (
  archive_id uuid,
  table_name text,
  record_id uuid,
  count_row_id uuid,
  label text,
  old_values jsonb,
  changed text[],
  changed_by uuid,
  changed_by_name text,
  changed_at timestamptz,
  in_ledger boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_edit_bid(p_bid_id) THEN
    RAISE EXCEPTION 'Only someone who can edit this bid sees what was removed from it.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH estimates AS (
    SELECT ce.id::text AS id FROM public.cost_estimates ce WHERE ce.bid_id = p_bid_id
    UNION
    SELECT a.record_id FROM public.deleted_records_archive a
    WHERE a.table_name = 'cost_estimates' AND a.group_key = p_bid_id::text AND a.record_id IS NOT NULL
  ),
  removed AS (
    SELECT a.id, a.table_name, a.record_id, a.row_data, a.deleted_by, a.deleted_at
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL
      AND a.table_name = ANY (public.bid_changes_tables())
      AND a.table_name <> 'bids'
      AND a.record_id IS NOT NULL
      AND (
        a.group_key = p_bid_id::text
        OR (a.table_name LIKE 'cost\_estimate\_%' AND a.group_key IN (SELECT e.id FROM estimates e))
      )
  )
  SELECT
    x.id,
    x.table_name,
    x.record_id::uuid,
    CASE
      WHEN x.table_name = 'bids_count_rows' THEN x.record_id::uuid
      ELSE NULLIF(x.row_data ->> 'count_row_id', '')::uuid
    END,
    CASE
      WHEN x.table_name = 'bids_count_rows' THEN x.row_data ->> 'fixture'
      WHEN x.table_name = 'bids_takeoff_rough_part_lines' THEN
        (SELECT mp.name::text FROM public.material_parts mp WHERE mp.id::text = x.row_data ->> 'part_id')
      WHEN x.row_data ? 'count_row_id' THEN COALESCE(
        (SELECT cr.fixture::text FROM public.bids_count_rows cr WHERE cr.id::text = x.row_data ->> 'count_row_id'),
        (SELECT s.row_data ->> 'fixture' FROM public.deleted_records_archive s
          WHERE s.table_name = 'bids_count_rows' AND s.record_id = x.row_data ->> 'count_row_id'
          ORDER BY s.deleted_at DESC LIMIT 1)
      )
      WHEN x.table_name IN ('cost_estimate_labor_rows', 'cost_estimate_labor_rows_unmatched') THEN x.row_data ->> 'fixture'
      WHEN x.table_name = 'bid_sov_lines' THEN x.row_data ->> 'label'
      WHEN x.table_name = 'bid_payment_schedule_rows' THEN x.row_data ->> 'timing'
      WHEN x.table_name = 'bid_versions' THEN x.row_data ->> 'name'
      WHEN x.table_name LIKE 'cost\_estimate\_%\_rows' THEN NULLIF(btrim(x.row_data ->> 'note'), '')
    END::text,
    x.row_data,
    ARRAY(
      SELECT k FROM jsonb_object_keys(x.row_data) AS k
      WHERE k NOT IN ('id', 'created_at', 'updated_at', 'updated_by', 'applied_at', 'applied_by')
        AND x.row_data -> k <> 'null'::jsonb
      ORDER BY k
    ),
    x.deleted_by,
    u.name::text,
    x.deleted_at,
    EXISTS (
      -- The bid's own ledger rows only (bid_changes_bid_idx): every ledger row carries its bid.
      SELECT 1 FROM public.bid_changes c
      WHERE c.bid_id = p_bid_id AND c.op = 'delete' AND c.table_name = x.table_name AND c.record_id = x.record_id::uuid
    )
  FROM removed x
  LEFT JOIN public.users u ON u.id = x.deleted_by
  ORDER BY x.deleted_at DESC, x.id;
END;
$$;

ALTER FUNCTION public.list_bid_removed_rows(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_bid_removed_rows(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_removed_rows(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_bid_removed_rows(uuid) IS
  'Bid history PR 5 (punch list #73): the delete archive''s rows of one bid still out (its own tables, never the bid itself), newest first, named as list_bid_history names them, for whoever can edit the bid (can_edit_bid). The archive keeps its dev-only read.';

-- ---------------------------------------------------------------------------------------------
-- One removed row back, with what was removed with it: the rows of the same delete (the same
-- deleted_at, which is the deleting transaction's time) that hang on it by a foreign key, as a
-- count row's prices, costs, takeoff lines and submittal ticks do, whatever their table. Parents go in before children, in the order
-- the live foreign keys give (restore_deleted_records' sort). A reference to a row that is gone
-- is cleared when the column allows it, and refused in words when it does not ("Its count row
-- was removed too. Put that back first."). The inserts are tagged put-back, so the ledger records
-- them as the presser's put back. All or nothing.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_bid_removed_row(p_archive_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  seed public.deleted_records_archive%ROWTYPE;
  v_bid uuid;
  v_bundle jsonb;
  v_more jsonb;
  v_fixed jsonb := '[]'::jsonb;
  v_tables text[];
  v_warnings text[] := ARRAY[]::text[];
  v_refusal text;
  v_inserted jsonb := '{}'::jsonb;
  v_total integer := 0;
  v_rounds integer := 0;
  v_headers text;
  v_cols text;
  v_val text;
  v_exists boolean;
  r record;
  fk record;
  t record;
  j jsonb;
BEGIN
  SELECT * INTO seed FROM public.deleted_records_archive WHERE id = p_archive_id;
  IF NOT FOUND OR seed.restored_at IS NOT NULL THEN
    RAISE EXCEPTION 'That removed row is not waiting to be put back.' USING ERRCODE = 'P0002';
  END IF;
  IF seed.table_name = 'bids' OR NOT (seed.table_name = ANY (public.bid_changes_tables())) OR seed.record_id IS NULL THEN
    RAISE EXCEPTION 'That row cannot be put back here. A whole bid comes back from Recently deleted.' USING ERRCODE = '22023';
  END IF;

  -- Its bid: the row's own, else its estimate's (live, or removed with it).
  v_bid := COALESCE(
    NULLIF(seed.row_data ->> 'bid_id', '')::uuid,
    (SELECT ce.bid_id FROM public.cost_estimates ce WHERE ce.id::text = seed.group_key),
    (SELECT NULLIF(a.row_data ->> 'bid_id', '')::uuid FROM public.deleted_records_archive a
      WHERE a.table_name = 'cost_estimates' AND a.record_id = seed.group_key
      ORDER BY a.deleted_at DESC LIMIT 1)
  );
  IF v_bid IS NULL OR NOT EXISTS (SELECT 1 FROM public.bids b WHERE b.id = v_bid) THEN
    RAISE EXCEPTION 'Its bid was removed. A dev puts a whole bid back from Recently deleted.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_edit_bid(v_bid) THEN
    RAISE EXCEPTION 'Only someone who can edit this bid can put back what was removed from it.' USING ERRCODE = '42501';
  END IF;

  -- The bundle: the row, then every row of the same delete that hangs on a row already in it.
  v_bundle := jsonb_build_array(jsonb_build_object(
    'id', seed.id, 'table_name', seed.table_name, 'record_id', seed.record_id, 'row_data', seed.row_data));
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', a.id, 'table_name', a.table_name, 'record_id', a.record_id, 'row_data', a.row_data)), '[]'::jsonb)
      INTO v_more
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL
      AND a.deleted_at = seed.deleted_at
      AND a.table_name <> 'bids'
      AND a.record_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_bundle) x WHERE (x ->> 'id')::uuid = a.id)
      AND EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1] AND NOT att.attisdropped
        JOIN pg_class pcl ON pcl.oid = c.confrelid
        JOIN pg_attribute patt ON patt.attrelid = c.confrelid AND patt.attnum = c.confkey[1]
        JOIN jsonb_array_elements(v_bundle) b ON b ->> 'table_name' = pcl.relname::text
        WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
          AND n.nspname = 'public' AND cl.relname::text = a.table_name
          AND patt.attname = 'id'
          AND a.row_data ->> att.attname::text = b ->> 'record_id'
      );
    EXIT WHEN jsonb_array_length(v_more) = 0;
    v_bundle := v_bundle || v_more;
    v_rounds := v_rounds + 1;
    EXIT WHEN v_rounds > 20;
  END LOOP;

  -- Every reference must land on a live row or a row coming back with it.
  FOR r IN SELECT * FROM jsonb_to_recordset(v_bundle) AS x(id uuid, table_name text, record_id text, row_data jsonb)
  LOOP
    j := r.row_data;
    FOR fk IN
      SELECT a.attname::text AS col, a.attnotnull AS notnull, pcl.relname::text AS ref_tbl, pa.attname::text AS ref_col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      JOIN pg_class pcl ON pcl.oid = c.confrelid
      JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
      JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
        AND n.nspname = 'public' AND pn.nspname = 'public' AND cl.relname::text = r.table_name
    LOOP
      v_val := NULLIF(j ->> fk.col, '');
      CONTINUE WHEN v_val IS NULL;
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I::text = $1)', fk.ref_tbl, fk.ref_col)
        INTO v_exists USING v_val;
      CONTINUE WHEN v_exists;
      CONTINUE WHEN fk.ref_col = 'id' AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(v_bundle) AS x(table_name text, record_id text)
        WHERE x.table_name = fk.ref_tbl AND x.record_id = v_val
      );
      IF fk.notnull THEN
        v_refusal := COALESCE(v_refusal, CASE fk.ref_tbl
          WHEN 'bids_count_rows' THEN 'Its count row was removed too. Put that back first.'
          WHEN 'cost_estimates' THEN 'Its estimate was removed too. Put that back first.'
          WHEN 'bid_versions' THEN 'Its version was removed too. Put that back first.'
          WHEN 'bids' THEN 'Its bid was removed. A dev puts a whole bid back from Recently deleted.'
          ELSE format('What it belonged to (%s) was removed too, so it cannot come back alone.', fk.ref_tbl)
        END);
      ELSE
        j := jsonb_set(j, ARRAY[fk.col], 'null'::jsonb, true);
        v_warnings := v_warnings || format('%s.%s cleared: %s %s is gone', r.table_name, fk.col, fk.ref_tbl, v_val)::text;
      END IF;
    END LOOP;
    v_fixed := v_fixed || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'table_name', r.table_name, 'record_id', r.record_id, 'row_data', j));
  END LOOP;
  IF v_refusal IS NOT NULL THEN
    RAISE EXCEPTION '%', v_refusal USING ERRCODE = '23503';
  END IF;

  SELECT array_agg(DISTINCT x.table_name) INTO v_tables FROM jsonb_to_recordset(v_fixed) AS x(table_name text);

  -- The ledger records each insert as the presser's put back.
  v_headers := COALESCE(current_setting('request.headers', true), '');
  PERFORM set_config('request.headers',
    (COALESCE(NULLIF(v_headers, '')::jsonb, '{}'::jsonb) || jsonb_build_object('x-bid-action', 'put-back'))::text, true);

  BEGIN
    FOR t IN
      -- Parents before children: restore_deleted_records' longest-path sort over the live keys
      -- among the bundle's tables (relname pinned to the default collation, as there).
      WITH RECURSIVE edges AS (
        SELECT DISTINCT cl.relname::text COLLATE "default" AS child, pcl.relname::text COLLATE "default" AS parent
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_class pcl ON pcl.oid = c.confrelid
        JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
        WHERE c.contype = 'f' AND n.nspname = 'public' AND pn.nspname = 'public'
          AND cl.relname::text = ANY (v_tables) AND pcl.relname::text = ANY (v_tables)
          AND cl.relname <> pcl.relname
      ),
      depth AS (
        SELECT x.tbl COLLATE "default" AS tbl, 0 AS d FROM unnest(v_tables) AS x(tbl)
        UNION ALL
        SELECT e.child, d.d + 1 FROM edges e JOIN depth d ON d.tbl = e.parent WHERE d.d < 50
      )
      SELECT dd.tbl, max(dd.d) AS d FROM depth dd GROUP BY dd.tbl ORDER BY max(dd.d), dd.tbl
    LOOP
      FOR r IN
        SELECT * FROM jsonb_to_recordset(v_fixed) AS x(id uuid, table_name text, record_id text, row_data jsonb)
        WHERE x.table_name = t.tbl
      LOOP
        -- The columns the snapshot holds, so a column added since takes its default.
        SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO v_cols
        FROM pg_attribute a
        WHERE a.attrelid = format('public.%I', t.tbl)::regclass
          AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
          AND r.row_data ? a.attname::text;
        EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)', t.tbl, v_cols, v_cols, t.tbl)
          USING r.row_data;
        v_total := v_total + 1;
        v_inserted := v_inserted || jsonb_build_object(t.tbl, COALESCE((v_inserted ->> t.tbl)::integer, 0) + 1);
      END LOOP;
    END LOOP;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM set_config('request.headers', v_headers, true);
      RAISE EXCEPTION 'That row, or one like it, is already on the bid, so it cannot come back.' USING ERRCODE = '23505';
    WHEN foreign_key_violation THEN
      PERFORM set_config('request.headers', v_headers, true);
      RAISE EXCEPTION 'What it belonged to is gone, so it cannot come back.' USING ERRCODE = '23503';
  END;
  PERFORM set_config('request.headers', v_headers, true);

  UPDATE public.deleted_records_archive a
     SET restored_at = now(), restored_by = auth.uid()
   WHERE a.id IN (SELECT x.id FROM jsonb_to_recordset(v_fixed) AS x(id uuid));

  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid, 'restored', v_total, 'tables', v_inserted, 'warnings', to_jsonb(v_warnings));
END;
$fn$;

ALTER FUNCTION public.restore_bid_removed_row(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.restore_bid_removed_row(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_bid_removed_row(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.restore_bid_removed_row(uuid) IS
  'Bid history PR 5 (punch list #73): put one removed row of a bid back from the delete archive, with the rows of the same delete that hang on it, parents first, for whoever can edit the bid (can_edit_bid). Tagged put-back, so the ledger records it as the presser''s. A whole bid stays the dev''s restore (restore_deleted_records).';
