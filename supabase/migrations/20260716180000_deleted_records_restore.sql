-- Deleted-records archive — Phase 2: restore RPCs (dev-only).
--
-- Phase 1 (20260716120000) + the coverage fix (20260716150000) snapshot every deleted row of 42 tables
-- into deleted_records_archive, bundled by group_key (the top-level job/bid id). Recovery until now
-- meant a dev hand-reconstructing JSONB. This adds:
--
--   list_deleted_records(p_limit)                     -> one row per restorable bundle
--   restore_deleted_records(p_group_key, p_dry_run)   -> jsonb {ok, dry_run, inserted, warnings, blockers}
--
-- Semantics (decided with the owner):
--   * ALL-OR-NOTHING with a real dry-run preview. Blockers are collected and reported together, and a
--     preview is a genuine execution rolled back via the P0R01 sentinel (counts live in plpgsql vars,
--     so they survive the subtransaction rollback). P0M01 is merge_user_accounts' sentinel — do not reuse.
--   * A dangling reference through a NULLABLE column (e.g. jobs_ledger.customer_id -> a customer since
--     deleted) is NULLED with a warning, so the row comes back with an explicit gap rather than not at
--     all. Through a NOT NULL column (e.g. jobs_ledger.master_user_id) it is a BLOCKER.
--
-- Mechanics worth knowing (all learned the hard way from the schema):
--   * NO foreign key in this database is DEFERRABLE, so SET CONSTRAINTS ALL DEFERRED is a no-op and
--     inserts MUST go strictly parent->child. The order is computed by a topological sort over the LIVE
--     pg_constraint catalog rather than a hardcoded list — a static list is exactly what made Phase 1
--     miss four post-baseline bid tables.
--   * The FK graph cannot see trigger-induced ordering, so one synthetic edge is injected:
--     ensure_job_team_member_from_schedule_block (baseline:4736) inserts into jobs_ledger_team_members
--     ON CONFLICT DO NOTHING when a job_schedule_blocks row lands, which would then collide with our
--     archived team-member row. Restoring jobs_ledger_team_members FIRST makes the trigger a no-op.
--   * job_schedule_blocks_set_created_by overwrites created_by with the restorer -> corrected by a
--     post-insert UPDATE back to the archived value.
--   * Grandchildren group under an intermediate parent (report_reads->report_id,
--     cost_estimate_*_rows->cost_estimate_id, price_book_entries->version_id, ...), so the bundle is
--     collected with a recursive CTE, not a flat group_key match.
--   * Composite-PK tables have no id, so record_id is NULL for them; never key on record_id alone.
--   * plpgsql gotcha (cost this repo a follow-up migration): text[] || 'literal' parses the literal as
--     an array literal -> every bare literal appended to a text[] needs an explicit ::text.

-- 1. Mark-restored columns (additive; no FK on restored_by, consistent with deleted_by).
ALTER TABLE public.deleted_records_archive
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid;

COMMENT ON COLUMN public.deleted_records_archive.restored_at IS 'When this archived row was re-inserted by restore_deleted_records(). NULL = still restorable; the list RPC only shows NULL rows.';

CREATE INDEX IF NOT EXISTS idx_deleted_records_archive_unrestored
  ON public.deleted_records_archive (group_key) WHERE restored_at IS NULL;


-- 2. list_deleted_records: one row per restorable bundle, newest first. Dev-only via the WHERE clause
--    (same idiom as list_job_activity_events): a non-dev simply gets zero rows.
CREATE OR REPLACE FUNCTION public.list_deleted_records(p_limit int DEFAULT 50)
RETURNS TABLE (
  group_key       text,
  kind            text,
  label           text,
  row_count       bigint,
  tables          text[],
  deleted_by      uuid,
  deleted_by_name text,
  deleted_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bundles AS (
    SELECT a.group_key AS gk,
           count(*)                                              AS row_count,
           array_agg(DISTINCT a.table_name ORDER BY a.table_name) AS tables,
           max(a.deleted_at)                                     AS deleted_at,
           (array_agg(a.deleted_by ORDER BY a.deleted_at DESC))[1] AS deleted_by
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL AND a.group_key IS NOT NULL
    GROUP BY a.group_key
  ),
  head AS (
    SELECT b.*,
           h.table_name AS head_table,
           h.row_data   AS head_row
    FROM bundles b
    LEFT JOIN LATERAL (
      SELECT x.table_name, x.row_data
      FROM public.deleted_records_archive x
      WHERE x.group_key = b.gk AND x.record_id = b.gk AND x.restored_at IS NULL
      LIMIT 1
    ) h ON true
  )
  SELECT h.gk,
         CASE
           WHEN h.head_table = 'jobs_ledger' THEN 'job'
           WHEN h.head_table = 'bids'        THEN 'bid'
           ELSE COALESCE(h.head_table, 'partial')
         END,
         CASE
           WHEN h.head_table = 'jobs_ledger' THEN
             COALESCE(NULLIF(h.head_row ->> 'hcp_number', ''), NULLIF(h.head_row ->> 'click_number', ''), '—')
             || ' · ' || COALESCE(NULLIF(h.head_row ->> 'job_name', ''), 'Job')
           WHEN h.head_table = 'bids' THEN
             'Bid ' || COALESCE(NULLIF(h.head_row ->> 'bid_number', ''), '—')
           WHEN h.head_table IS NOT NULL THEN
             h.head_table || ' ' || left(h.gk, 8)
           ELSE
             'Partial delete under ' || left(h.gk, 8)
         END,
         h.row_count, h.tables, h.deleted_by,
         (SELECT u.name FROM public.users u WHERE u.id = h.deleted_by),
         h.deleted_at
  FROM head h
  WHERE public.is_dev()
  ORDER BY h.deleted_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.list_deleted_records(int) IS 'Dev-only: restorable bundles in deleted_records_archive (restored_at IS NULL), newest first, one row per group_key. Non-devs get zero rows.';

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;


-- 3. restore_deleted_records: re-insert a whole bundle, all-or-nothing, with a real dry-run preview.
CREATE OR REPLACE FUNCTION public.restore_deleted_records(p_group_key text, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_caller      uuid;
  v_caller_role text;
  v_bundle      jsonb  := '[]'::jsonb;   -- [{id, table_name, record_id, row_data}]
  v_fixed       jsonb  := '[]'::jsonb;   -- same, with dangling nullable FKs nulled
  v_tables      text[];
  v_warnings    text[] := ARRAY[]::text[];
  v_blockers    text[] := ARRAY[]::text[];
  v_inserted    jsonb  := '{}'::jsonb;
  r             record;
  fk            record;
  t             record;
  j             jsonb;
  v_val         text;
  v_exists      boolean;
  v_in_bundle   boolean;
  v_n           bigint;
  v_total       bigint := 0;
BEGIN
  -- Dev gate (inlined, returning a code rather than raising — mirrors merge_user_accounts).
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'dev' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can restore deleted records.');
  END IF;

  -- Collect the bundle: seed on group_key, then pull rows that group under any already-collected
  -- record_id (grandchildren). UNION (not UNION ALL) dedupes and terminates.
  WITH RECURSIVE bundle AS (
    SELECT a.id, a.table_name, a.record_id, a.row_data
    FROM public.deleted_records_archive a
    WHERE a.group_key = p_group_key AND a.restored_at IS NULL
    UNION
    SELECT a2.id, a2.table_name, a2.record_id, a2.row_data
    FROM public.deleted_records_archive a2
    JOIN bundle b ON a2.group_key = b.record_id AND b.record_id IS NOT NULL
    WHERE a2.restored_at IS NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', b.id, 'table_name', b.table_name, 'record_id', b.record_id, 'row_data', b.row_data)), '[]'::jsonb)
    INTO v_bundle
  FROM bundle b;

  IF jsonb_array_length(v_bundle) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found',
                              'error', format('No restorable archived rows for group %s.', p_group_key));
  END IF;

  SELECT array_agg(DISTINCT x.table_name) INTO v_tables
  FROM jsonb_to_recordset(v_bundle) AS x(table_name text);

  -- Pass 1 (read-only): per-row FK pre-check. Nothing is inserted yet, so returning here leaves no trace.
  FOR r IN SELECT * FROM jsonb_to_recordset(v_bundle) AS x(id uuid, table_name text, record_id text, row_data jsonb)
  LOOP
    j := r.row_data;
    FOR fk IN
      SELECT a.attname::text AS col, a.attnotnull AS notnull,
             pn.nspname::text AS ref_schema, pcl.relname::text AS ref_tbl, pa.attname::text AS ref_col
      FROM pg_constraint c
      JOIN pg_class cl      ON cl.oid = c.conrelid
      JOIN pg_namespace n   ON n.oid = cl.relnamespace
      JOIN pg_attribute a   ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      JOIN pg_class pcl     ON pcl.oid = c.confrelid
      JOIN pg_namespace pn  ON pn.oid = pcl.relnamespace
      JOIN pg_attribute pa  ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
        AND n.nspname = 'public' AND cl.relname = r.table_name
    LOOP
      v_val := NULLIF(j ->> fk.col, '');
      CONTINUE WHEN v_val IS NULL;

      -- Does the target already exist live?
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I::text = $1)', fk.ref_schema, fk.ref_tbl, fk.ref_col)
        INTO v_exists USING v_val;
      CONTINUE WHEN v_exists;

      -- Or is it being restored in this same bundle?
      SELECT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(v_bundle) AS x(table_name text, record_id text)
        WHERE x.table_name = fk.ref_tbl AND x.record_id = v_val
      ) INTO v_in_bundle;
      CONTINUE WHEN v_in_bundle;

      IF fk.notnull THEN
        v_blockers := v_blockers || format('%s.%s -> %s.%s %s no longer exists (required)',
                                           r.table_name, fk.col, fk.ref_schema, fk.ref_tbl, v_val)::text;
      ELSE
        j := jsonb_set(j, ARRAY[fk.col], 'null'::jsonb, true);
        v_warnings := v_warnings || format('%s.%s cleared — %s %s no longer exists',
                                           r.table_name, fk.col, fk.ref_tbl, v_val)::text;
      END IF;
    END LOOP;

    v_fixed := v_fixed || jsonb_build_array(jsonb_build_object(
                 'id', r.id, 'table_name', r.table_name, 'record_id', r.record_id, 'row_data', j));
  END LOOP;

  IF cardinality(v_blockers) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'blocked',
                              'error', 'Cannot restore: ' || array_to_string(v_blockers, '; '),
                              'blockers', to_jsonb(v_blockers), 'warnings', to_jsonb(v_warnings));
  END IF;

  -- Pass 2 (mutating): insert parent->child, then fix up, then mark restored. All inside one nested
  -- block so the P0R01 dry-run sentinel — or any error — rolls the whole thing back.
  BEGIN
    FOR t IN
      -- Topological sort over live FK edges among this bundle's tables, plus the synthetic
      -- trigger-ordering edge. Longest-path depth; the d < 50 guard is a cycle backstop.
      -- NOTE: pg_class.relname is `name`, whose ::text carries collation "C", while unnest(text[])
      -- is collation "default" — mixing them in a recursive CTE errors with 42P21. Pin both to
      -- "default" so the base and recursive terms agree.
      WITH RECURSIVE edges AS (
        SELECT DISTINCT cl.relname::text COLLATE "default" AS child,
                        pcl.relname::text COLLATE "default" AS parent
        FROM pg_constraint c
        JOIN pg_class cl     ON cl.oid = c.conrelid
        JOIN pg_namespace n  ON n.oid = cl.relnamespace
        JOIN pg_class pcl    ON pcl.oid = c.confrelid
        JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
        WHERE c.contype = 'f' AND n.nspname = 'public' AND pn.nspname = 'public'
          AND cl.relname = ANY (v_tables) AND pcl.relname = ANY (v_tables)
          AND cl.relname <> pcl.relname
        UNION
        SELECT 'job_schedule_blocks'::text COLLATE "default",
               'jobs_ledger_team_members'::text COLLATE "default"
        WHERE 'job_schedule_blocks' = ANY (v_tables) AND 'jobs_ledger_team_members' = ANY (v_tables)
      ),
      depth AS (
        -- Every table seeds at 0 (so none can be dropped by a cycle), and each FK edge pushes the
        -- child deeper; max(d) per table is its longest path from a root = a valid insert order.
        SELECT x.tbl COLLATE "default" AS tbl, 0 AS d
        FROM unnest(v_tables) AS x(tbl)
        UNION ALL
        SELECT e.child, d.d + 1
        FROM edges e JOIN depth d ON d.tbl = e.parent
        WHERE d.d < 50
      )
      SELECT dd.tbl, max(dd.d) AS d FROM depth dd GROUP BY dd.tbl ORDER BY max(dd.d), dd.tbl
    LOOP
      FOR r IN
        SELECT * FROM jsonb_to_recordset(v_fixed) AS x(id uuid, table_name text, record_id text, row_data jsonb)
        WHERE x.table_name = t.tbl
      LOOP
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', t.tbl, t.tbl)
          USING r.row_data;
        v_total := v_total + 1;
      END LOOP;

      SELECT count(*) INTO v_n
      FROM jsonb_to_recordset(v_fixed) AS x(table_name text) WHERE x.table_name = t.tbl;
      IF v_n > 0 THEN
        v_inserted := v_inserted || jsonb_build_object(t.tbl, v_n);
      END IF;
    END LOOP;

    -- Undo job_schedule_blocks_set_created_by(), which stamps the restorer over the archived author.
    IF 'job_schedule_blocks' = ANY (v_tables) THEN
      FOR r IN
        SELECT * FROM jsonb_to_recordset(v_fixed) AS x(record_id text, row_data jsonb, table_name text)
        WHERE x.table_name = 'job_schedule_blocks' AND NULLIF(x.row_data ->> 'created_by', '') IS NOT NULL
      LOOP
        UPDATE public.job_schedule_blocks
           SET created_by = (r.row_data ->> 'created_by')::uuid
         WHERE id = r.record_id::uuid;
      END LOOP;
    END IF;

    -- A replacement job may have reused the number (jobs_ledger has no unique beyond its PK).
    IF 'jobs_ledger' = ANY (v_tables) THEN
      FOR r IN
        SELECT * FROM jsonb_to_recordset(v_fixed) AS x(record_id text, row_data jsonb, table_name text)
        WHERE x.table_name = 'jobs_ledger'
      LOOP
        SELECT count(*) INTO v_n FROM public.jobs_ledger jl
        WHERE jl.id <> r.record_id::uuid
          AND (
            (NULLIF(r.row_data ->> 'hcp_number', '') IS NOT NULL AND jl.hcp_number = r.row_data ->> 'hcp_number')
            OR (NULLIF(r.row_data ->> 'click_number', '') IS NOT NULL AND jl.click_number = r.row_data ->> 'click_number')
          );
        IF v_n > 0 THEN
          v_warnings := v_warnings || format('job number %s is now also used by %s other job(s) — deduplicate manually',
                          COALESCE(NULLIF(r.row_data ->> 'hcp_number', ''), NULLIF(r.row_data ->> 'click_number', ''), '?'),
                          v_n)::text;
        END IF;
      END LOOP;
    END IF;

    UPDATE public.deleted_records_archive a
       SET restored_at = now(), restored_by = v_caller
     WHERE a.id IN (SELECT x.id FROM jsonb_to_recordset(v_fixed) AS x(id uuid));

    IF p_dry_run THEN
      RAISE EXCEPTION USING errcode = 'P0R01', message = 'dry run rollback';
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0R01' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'group_key', p_group_key,
                                'inserted', v_inserted, 'total', v_total,
                                'warnings', to_jsonb(v_warnings), 'blockers', to_jsonb(v_blockers));
  END;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'group_key', p_group_key,
                            'inserted', v_inserted, 'total', v_total,
                            'warnings', to_jsonb(v_warnings), 'blockers', to_jsonb(v_blockers));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'error', SQLERRM);
END $fn$;

COMMENT ON FUNCTION public.restore_deleted_records(text, boolean) IS 'Dev-only: re-insert a whole deleted_records_archive bundle (group_key) parent->child in topological order. All-or-nothing. p_dry_run=true previews real per-table counts and rolls back (P0R01). Dangling nullable FKs are nulled with a warning; dangling NOT NULL FKs are blockers.';

GRANT EXECUTE ON FUNCTION public.restore_deleted_records(text, boolean) TO authenticated;
