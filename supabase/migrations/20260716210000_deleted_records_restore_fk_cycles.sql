-- Fix for 20260716180000: restoring a BID bundle hung the connection, and could never have succeeded.
--
-- The bids tree contains a genuine FK cycle that the jobs tree does not:
--     bids.selected_bid_version_id -> bid_versions   (NULLABLE, added 20260610170000:63)
--     bid_versions.bid_id          -> bids           (NOT NULL,  added 20260610170000:16)
--
-- Two consequences, both invisible to the original job-bundle testing:
--
--   1. HANG. The topological `depth` CTE recursed with UNION ALL, guarded only by d < 50. A cycle makes
--      that explode combinatorially, so restore_deleted_records() (including a *dry run*) spun until
--      the connection was killed. With the v2.699 UI live, a dev previewing a deleted bid would hang.
--
--   2. NO VALID ORDER. Even without the hang, no parent->child order can satisfy a cycle: bids needs
--      bid_versions and bid_versions needs bids.
--
-- Fix: identify the nullable FK columns that are genuine CYCLE BACK-EDGES and defer only those. A
-- back-edge is a nullable FK child->parent where `parent` can reach `child` again through the FK graph
-- (reachability closure below). Those columns are inserted NULL and re-applied by a post-insert UPDATE
-- once their target exists — which is what actually breaks the cycle (bids lands with
-- selected_bid_version_id NULL, then bid_versions, then bids is updated). Every other edge, nullable or
-- not, still constrains insert order.
--
-- Deferring ALL nullable FKs would be simpler and WRONG twice over, which is why this is narrow:
--   * reports.job_ledger_id / project_id / bid_id are each nullable, but `reports_one_anchor` CHECKs that
--     exactly ONE is non-null — nulling the anchor would violate the CHECK.
--   * dropping nullable edges from the ordering would stop `reports` being ordered after `jobs_ledger`,
--     so a report could be inserted before the job it points at.
-- Neither table is in a cycle, so neither is deferred.
--
-- Everything else is unchanged from 20260716180000: dev gate, all-or-nothing, P0R01 dry-run sentinel,
-- dangling-nullable -> null+warn, dangling NOT NULL -> blocker, the jobs_ledger_team_members ->
-- job_schedule_blocks synthetic edge, and the created_by trigger fixup. list_deleted_records is untouched.

CREATE OR REPLACE FUNCTION public.restore_deleted_records(p_group_key text, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_caller      uuid;
  v_caller_role text;
  v_bundle      jsonb  := '[]'::jsonb;   -- [{id, table_name, record_id, row_data}]
  v_fixed       jsonb  := '[]'::jsonb;   -- same, with dangling/deferred nullable FKs nulled
  v_deferred    jsonb  := '[]'::jsonb;   -- [{table_name, record_id, col, coltype, value}] re-applied after insert
  v_defer_cols  text[] := ARRAY[]::text[];  -- 'table.col' of nullable FKs that are cycle back-edges
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
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'dev' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can restore deleted records.');
  END IF;

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

  -- Which nullable FK columns are cycle back-edges? (child->parent where parent can reach child again).
  -- Only these get deferred; everything else keeps its value and is handled by insert order.
  WITH RECURSIVE e AS (
    SELECT cl.relname::text COLLATE "default" AS child,
           pcl.relname::text COLLATE "default" AS parent,
           a.attname::text AS col, a.attnotnull AS notnull
    FROM pg_constraint c
    JOIN pg_class cl     ON cl.oid = c.conrelid
    JOIN pg_namespace n  ON n.oid = cl.relnamespace
    JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
    JOIN pg_class pcl    ON pcl.oid = c.confrelid
    JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
      AND n.nspname = 'public' AND pn.nspname = 'public'
      AND cl.relname = ANY (v_tables) AND pcl.relname = ANY (v_tables)
      AND cl.relname <> pcl.relname
  ),
  -- NB: aliases here must NOT be `r`/`fk`/`t` — those are plpgsql record variables in this function, and
  -- plpgsql resolves `r.src` to the variable rather than the alias ("record r is not assigned yet").
  reach AS (
    SELECT e.child AS src, e.parent AS dst, ARRAY[e.child, e.parent] AS path FROM e
    UNION ALL
    SELECT rr.src, e2.parent, rr.path || e2.parent
    FROM reach rr JOIN e e2 ON e2.child = rr.dst
    WHERE NOT (e2.parent = ANY (rr.path)) AND array_length(rr.path, 1) < 50
  )
  SELECT COALESCE(array_agg(DISTINCT e.child || '.' || e.col), ARRAY[]::text[])
    INTO v_defer_cols
  FROM e
  WHERE NOT e.notnull
    AND EXISTS (SELECT 1 FROM reach rr WHERE rr.src = e.parent AND rr.dst = e.child);

  -- Pass 1 (read-only): classify every FK value — live / in-bundle / gone.
  FOR r IN SELECT * FROM jsonb_to_recordset(v_bundle) AS x(id uuid, table_name text, record_id text, row_data jsonb)
  LOOP
    j := r.row_data;
    FOR fk IN
      SELECT a.attname::text AS col, a.attnotnull AS notnull,
             format_type(a.atttypid, a.atttypmod) AS coltype,
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

      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I::text = $1)', fk.ref_schema, fk.ref_tbl, fk.ref_col)
        INTO v_exists USING v_val;
      CONTINUE WHEN v_exists;

      SELECT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(v_bundle) AS x(table_name text, record_id text)
        WHERE x.table_name = fk.ref_tbl AND x.record_id = v_val
      ) INTO v_in_bundle;

      IF v_in_bundle THEN
        -- The target is coming back in this same restore. Insert order covers it, UNLESS this column is
        -- a cycle back-edge (bids.selected_bid_version_id) — those must be deferred and re-applied.
        IF (r.table_name || '.' || fk.col) = ANY (v_defer_cols) THEN
          IF r.record_id IS NULL THEN
            v_blockers := v_blockers || format('%s.%s is a cycle back-edge but cannot be deferred — table has no id column',
                                               r.table_name, fk.col)::text;
          ELSE
            v_deferred := v_deferred || jsonb_build_array(jsonb_build_object(
                            'table_name', r.table_name, 'record_id', r.record_id,
                            'col', fk.col, 'coltype', fk.coltype, 'value', v_val));
            j := jsonb_set(j, ARRAY[fk.col], 'null'::jsonb, true);
          END IF;
        END IF;
        CONTINUE;
      END IF;

      -- Target is gone for good.
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

  BEGIN
    FOR t IN
      -- All FK edges EXCEPT the deferred cycle back-edges — removing those makes the graph acyclic while
      -- keeping every legitimate ordering constraint (e.g. reports must still follow jobs_ledger).
      -- COLLATE "default": name::text is "C"-collated and would otherwise clash with unnest(text[])
      -- (42P21). The path guard is a backstop against any residual cycle.
      WITH RECURSIVE edges AS (
        SELECT DISTINCT cl.relname::text COLLATE "default" AS child,
                        pcl.relname::text COLLATE "default" AS parent
        FROM pg_constraint c
        JOIN pg_class cl     ON cl.oid = c.conrelid
        JOIN pg_namespace n  ON n.oid = cl.relnamespace
        JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
        JOIN pg_class pcl    ON pcl.oid = c.confrelid
        JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
        WHERE c.contype = 'f' AND cardinality(c.conkey) = 1
          AND n.nspname = 'public' AND pn.nspname = 'public'
          AND cl.relname = ANY (v_tables) AND pcl.relname = ANY (v_tables)
          AND cl.relname <> pcl.relname
          AND NOT ((cl.relname::text || '.' || a.attname::text) = ANY (v_defer_cols))
        UNION
        SELECT 'job_schedule_blocks'::text COLLATE "default",
               'jobs_ledger_team_members'::text COLLATE "default"
        WHERE 'job_schedule_blocks' = ANY (v_tables) AND 'jobs_ledger_team_members' = ANY (v_tables)
      ),
      depth AS (
        SELECT x.tbl COLLATE "default" AS tbl, 0 AS d, ARRAY[x.tbl COLLATE "default"] AS path
        FROM unnest(v_tables) AS x(tbl)
        UNION ALL
        SELECT e.child, d.d + 1, d.path || e.child
        FROM edges e JOIN depth d ON d.tbl = e.parent
        WHERE NOT (e.child = ANY (d.path)) AND d.d < 50
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

    -- Re-apply the deferred nullable FKs now that their targets exist (this is what closes the cycle).
    FOR r IN
      SELECT * FROM jsonb_to_recordset(v_deferred) AS x(table_name text, record_id text, col text, coltype text, value text)
    LOOP
      EXECUTE format('UPDATE public.%I SET %I = $1::%s WHERE id::text = $2', r.table_name, r.col, r.coltype)
        USING r.value, r.record_id;
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

COMMENT ON FUNCTION public.restore_deleted_records(text, boolean) IS 'Dev-only: re-insert a whole deleted_records_archive bundle (group_key) parent->child. All-or-nothing. p_dry_run=true previews real per-table counts and rolls back (P0R01). Dangling nullable FKs are nulled with a warning; dangling NOT NULL FKs are blockers. Insert order is topologically sorted over NOT NULL FK edges only — nullable FKs into the bundle are deferred and re-applied after insert, which is what makes the bids<->bid_versions cycle restorable.';
