SET lock_timeout = '3s';

-- v2.2412: a directly-deleted price option (price_book_versions row) is restorable from
-- "Recently deleted" — the 2026-08-27 BP384 deletion (pbv 69491f86) previewed as
-- "Cannot restore — nothing was changed: price_book_entries.version_id … no longer exists".
--
-- Nothing was missing from the ARCHIVE (all five tables in the cascade have live
-- zzz_archive_on_delete triggers; every row was captured). The failure is bundle WIRING:
-- group keys split one user-level deletion across two bundles —
--
--   price_book_versions row            group_key = bid_id      (TG_ARGV 'bid_id')
--   bid_count_row_custom_prices        group_key = bid_id      ─┐ the pricing's satellites
--   bid_pricing_assignments            group_key = bid_id       ├ land in the bid-keyed
--   bid_count_row_submission_hides     group_key = bid_id      ─┘ "partial" bundle
--   price_book_entries                 group_key = version_id  → their own pbv-keyed bundle
--
-- Previewing the pbv-keyed bundle (the one a dev naturally picks — it matches the deleted
-- pricing) collects only the entries; their NOT NULL version_id FK then reads as a
-- hard blocker because the parent sits in the OTHER bundle.
--
-- Re-keying the satellite triggers to group under price_book_version_id was rejected: those
-- rows also cascade from bids_count_rows deletions (Clear-all-counts), and re-keying would
-- fragment THOSE bundles instead. The group keys stay as they are; the RESTORE learns to
-- assemble the whole deletion from either handle:
--
--   1. Seed also pulls the archived row whose record_id IS the group handle — the deleted
--      parent that was archived under a higher group (the pbv, archived under its bid).
--      Recursion then chains everything that groups under it (the entries).
--   2. Seed also pulls archived rows whose row_data->>'price_book_version_id' equals the
--      handle — the pricing's satellites, archived under the bid group. (This column is the
--      one intermediate-parent handle the group_key scheme cannot express; hardcoding it
--      here keeps the trigger wiring — and every other bundle shape — untouched.)
--   3. Inserts run newest-first per table with ON CONFLICT DO NOTHING: archived stale
--      generations (assignment/custom-price churn re-keyed by later edits, re-created
--      composite-PK hides) are skipped with a warning instead of aborting the whole
--      all-or-nothing restore on a unique-key collision. FK violations still abort.
--
-- Seeding by the bid-keyed partial bundle also assembles the full set (pbv row in seed via
-- group_key, entries + satellites via recursion/clause 2), so both list entries work.
-- Whole-bid and Clear-all-counts bundles are unchanged: their seeds collect the same rows
-- as before, clauses 1–2 only ADD rows when the handle is itself an archived record.
--
-- list_deleted_records gets the matching polish: the head-row lookup falls back to
-- record_id = group_key (so the pbv-keyed bundle is labeled from the archived pricing
-- itself instead of "Partial delete under 69491f86"), with a 'price option' kind and a
-- "<name> · Bid <number>" label. Return shape unchanged.
--
-- Function bodies below are based on the LIVE prod definitions (schema dump 2026-08-27,
-- verified equal to 20260716210000 / 20260811060705) — never the baseline bodies.

-- 1. restore_deleted_records: extended seed + newest-first conflict-tolerant inserts.
CREATE OR REPLACE FUNCTION public.restore_deleted_records(p_group_key text, p_dry_run boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_caller      uuid;
  v_caller_role text;
  v_bundle      jsonb  := '[]'::jsonb;   -- [{id, table_name, record_id, row_data, deleted_at}]
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
  v_rc          int;
  v_tbl_ins     bigint;
  v_tbl_skip    bigint;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'dev' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can restore deleted records.');
  END IF;

  -- Seed on the group handle three ways (see header): rows grouped under it, the archived
  -- record that IS it, and satellites that point at it via price_book_version_id. The
  -- recursive term then chains grandchildren under any collected record, as before.
  WITH RECURSIVE bundle AS (
    SELECT a.id, a.table_name, a.record_id, a.row_data, a.deleted_at
    FROM public.deleted_records_archive a
    WHERE (a.group_key = p_group_key
           OR a.record_id = p_group_key
           -- Satellites join only when the pricing itself is among the deleted — restoring
           -- an entries-churn bundle for a LIVE pricing must not resurrect old unassignments.
           OR (a.row_data ->> 'price_book_version_id' = p_group_key
               AND EXISTS (SELECT 1 FROM public.deleted_records_archive pa
                           WHERE pa.record_id = p_group_key AND pa.restored_at IS NULL)))
      AND a.restored_at IS NULL
    UNION
    SELECT a2.id, a2.table_name, a2.record_id, a2.row_data, a2.deleted_at
    FROM public.deleted_records_archive a2
    JOIN bundle b ON (a2.group_key = b.record_id
                      OR a2.row_data ->> 'price_book_version_id' = b.record_id)
                 AND b.record_id IS NOT NULL
    WHERE a2.restored_at IS NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', b.id, 'table_name', b.table_name, 'record_id', b.record_id,
           'row_data', b.row_data, 'deleted_at', b.deleted_at)), '[]'::jsonb)
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
  FOR r IN SELECT * FROM jsonb_to_recordset(v_bundle) AS x(id uuid, table_name text, record_id text, row_data jsonb, deleted_at timestamptz)
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
                 'id', r.id, 'table_name', r.table_name, 'record_id', r.record_id,
                 'row_data', j, 'deleted_at', r.deleted_at));
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
      -- Newest generation first + ON CONFLICT DO NOTHING: when the bundle holds several
      -- archived generations of the same logical row (unique-key churn), the latest one
      -- lands and the stale ones are skipped — instead of a unique violation aborting the
      -- whole restore. FK violations still raise (and abort), as before.
      v_tbl_ins  := 0;
      v_tbl_skip := 0;
      FOR r IN
        SELECT * FROM jsonb_to_recordset(v_fixed) AS x(id uuid, table_name text, record_id text, row_data jsonb, deleted_at timestamptz)
        WHERE x.table_name = t.tbl
        ORDER BY x.deleted_at DESC NULLS LAST, x.id
      LOOP
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT DO NOTHING', t.tbl, t.tbl)
          USING r.row_data;
        GET DIAGNOSTICS v_rc = ROW_COUNT;
        v_total    := v_total + v_rc;
        v_tbl_ins  := v_tbl_ins + v_rc;
        IF v_rc = 0 THEN
          v_tbl_skip := v_tbl_skip + 1;
        END IF;
      END LOOP;

      IF v_tbl_ins > 0 THEN
        v_inserted := v_inserted || jsonb_build_object(t.tbl, v_tbl_ins);
      END IF;
      IF v_tbl_skip > 0 THEN
        v_warnings := v_warnings || format('%s: %s archived duplicate row(s) skipped — an identical-key row already exists',
                                           t.tbl, v_tbl_skip)::text;
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

COMMENT ON FUNCTION public.restore_deleted_records(text, boolean) IS 'Dev-only: re-insert a whole deleted_records_archive bundle parent->child. Seeds on group_key, the archived record whose record_id IS the handle, and rows whose row_data.price_book_version_id points at it (directly-deleted price options archive under their bid while their entries archive under the pbv). All-or-nothing; p_dry_run=true previews real per-table counts and rolls back (P0R01). Dangling nullable FKs are nulled with a warning; dangling NOT NULL FKs are blockers. Inserts run newest-first with ON CONFLICT DO NOTHING so stale archived generations are skipped (warned) instead of aborting. Nullable cycle back-edges are deferred and re-applied post-insert (bids<->bid_versions).';

-- 2. list_deleted_records: head-row fallback by record_id + 'price option' labeling.
--    Body is the live 20260811060705 definition; only the head LATERAL and the two CASEs change.
CREATE OR REPLACE FUNCTION public.list_deleted_records(p_limit int DEFAULT 50)
RETURNS TABLE (
  group_key       text,
  kind            text,
  label           text,
  row_count       bigint,
  tables          text[],
  deleted_by      uuid,
  deleted_by_name text,
  deleted_at      timestamptz,
  table_counts    jsonb,
  preview_items   jsonb,
  money_total     numeric,
  head_created_at timestamptz,
  owner_user_id   uuid,
  owner_name      text
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
  counts AS (
    SELECT t.gk, jsonb_object_agg(t.table_name, t.n) AS table_counts
    FROM (
      SELECT a.group_key AS gk, a.table_name, count(*) AS n
      FROM public.deleted_records_archive a
      WHERE a.restored_at IS NULL AND a.group_key IS NOT NULL
      GROUP BY a.group_key, a.table_name
    ) t
    GROUP BY t.gk
  ),
  money AS (
    SELECT a.group_key AS gk,
           sum(
             COALESCE(
               CASE WHEN jsonb_typeof(a.row_data -> 'amount')       = 'number' THEN (a.row_data ->> 'amount')::numeric END,
               CASE WHEN jsonb_typeof(a.row_data -> 'total')        = 'number' THEN (a.row_data ->> 'total')::numeric END,
               CASE WHEN jsonb_typeof(a.row_data -> 'gross_pay')    = 'number' THEN (a.row_data ->> 'gross_pay')::numeric END,
               CASE WHEN jsonb_typeof(a.row_data -> 'total_amount') = 'number' THEN (a.row_data ->> 'total_amount')::numeric END,
               0
             )
           ) AS money_total
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL AND a.group_key IS NOT NULL
    GROUP BY a.group_key
  ),
  head AS (
    SELECT b.*, h.table_name AS head_table, h.row_data AS head_row
    FROM bundles b
    LEFT JOIN LATERAL (
      -- Fallback on record_id alone: a directly-deleted intermediate parent (e.g. a price
      -- option) is archived under a HIGHER group (its bid) while its children bundle under
      -- its own id — it is still this bundle's head. Prefer the classic exact match.
      SELECT x.table_name, x.row_data
      FROM public.deleted_records_archive x
      WHERE x.record_id = b.gk AND x.restored_at IS NULL
      ORDER BY (x.group_key = b.gk) DESC
      LIMIT 1
    ) h ON true
  ),
  head_owner AS (
    SELECT h.*,
           CASE WHEN (h.head_row ->> 'created_at') ~ '^\d{4}-\d{2}-\d{2}'
                THEN (h.head_row ->> 'created_at')::timestamptz END AS head_created_at,
           COALESCE(
             CASE WHEN (h.head_row ->> 'user_id')    ~ '^[0-9a-fA-F-]{36}$' THEN (h.head_row ->> 'user_id')::uuid END,
             CASE WHEN (h.head_row ->> 'created_by') ~ '^[0-9a-fA-F-]{36}$' THEN (h.head_row ->> 'created_by')::uuid END
           ) AS owner_user_id
    FROM head h
  )
  SELECT h.gk,
         CASE h.head_table
           WHEN 'jobs_ledger'           THEN 'job'
           WHEN 'bids'                  THEN 'bid'
           WHEN 'customers'             THEN 'customer'
           WHEN 'projects'              THEN 'project'
           WHEN 'estimates'             THEN 'estimate'
           WHEN 'pay_stubs'             THEN 'pay stub'
           WHEN 'clock_sessions'        THEN 'clock session'
           WHEN 'supply_house_invoices' THEN 'supply house invoice'
           WHEN 'people_labor_jobs'     THEN 'sub labor job'
           WHEN 'purchase_orders'       THEN 'purchase order'
           WHEN 'material_templates'    THEN 'material template'
           WHEN 'person_licenses'       THEN 'licence'
           WHEN 'writeups'              THEN 'writeup'
           WHEN 'people'                THEN 'person'
           WHEN 'price_book_versions'   THEN 'price option'
           ELSE COALESCE(h.head_table, 'partial')
         END,
         CASE
           WHEN h.head_table = 'jobs_ledger' THEN
             COALESCE(NULLIF(h.head_row ->> 'hcp_number', ''), NULLIF(h.head_row ->> 'click_number', ''), '—')
             || ' · ' || COALESCE(NULLIF(h.head_row ->> 'job_name', ''), 'Job')
           WHEN h.head_table = 'bids' THEN
             'Bid ' || COALESCE(NULLIF(h.head_row ->> 'bid_number', ''), '—')
           WHEN h.head_table = 'clock_sessions' THEN
             COALESCE(
               (SELECT u.name || ' · ' FROM public.users u WHERE u.id::text = h.head_row ->> 'user_id'),
               ''
             )
             || COALESCE(NULLIF(h.head_row ->> 'work_date', ''), left(h.gk, 8))
             || COALESCE(
                  (SELECT ' · ' || COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), 'job')
                   FROM public.jobs_ledger j WHERE j.id::text = h.head_row ->> 'job_ledger_id'),
                  ''
                )
           WHEN h.head_table = 'price_book_versions' THEN
             COALESCE(NULLIF(h.head_row ->> 'name', ''), 'Price option')
             || COALESCE(
                  (SELECT ' · Bid ' || COALESCE(NULLIF(bd.bid_number, ''), '—')
                   FROM public.bids bd WHERE bd.id::text = h.head_row ->> 'bid_id'),
                  ''
                )
           WHEN h.head_table IS NOT NULL THEN
             COALESCE(
               NULLIF(h.head_row ->> 'name', ''),
               NULLIF(h.head_row ->> 'project_name', ''),
               NULLIF(h.head_row ->> 'title', ''),
               NULLIF(h.head_row ->> 'invoice_number', ''),
               NULLIF(h.head_row ->> 'estimate_number', ''),
               NULLIF(h.head_row ->> 'person_name', ''),
               NULLIF(h.head_row ->> 'work_date', ''),
               left(h.gk, 8)
             )
           ELSE
             COALESCE(
               (SELECT 'Under job ' || COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), '—')
                       || ' · ' || COALESCE(NULLIF(j.job_name, ''), 'Job')
                FROM public.jobs_ledger j WHERE j.id::text = h.gk),
               (SELECT 'Under bid ' || COALESCE(NULLIF(bd.bid_number, ''), '—')
                FROM public.bids bd WHERE bd.id::text = h.gk),
               (SELECT 'Under customer ' || c.name
                FROM public.customers c WHERE c.id::text = h.gk),
               (SELECT 'Under project ' || COALESCE(NULLIF(p.name, ''), '—')
                FROM public.projects p WHERE p.id::text = h.gk),
               (SELECT 'Under estimate ' || COALESCE(e.estimate_number::text, '—')
                FROM public.estimates e WHERE e.id::text = h.gk),
               'Partial delete under ' || left(h.gk, 8)
             )
         END,
         h.row_count, h.tables, h.deleted_by,
         (SELECT u.name FROM public.users u WHERE u.id = h.deleted_by),
         h.deleted_at,
         c.table_counts,
         pv.preview_items,
         COALESCE(m.money_total, 0),
         h.head_created_at,
         h.owner_user_id,
         (SELECT u.name FROM public.users u WHERE u.id = h.owner_user_id)
  FROM head_owner h
  LEFT JOIN counts c ON c.gk = h.gk
  LEFT JOIN money m ON m.gk = h.gk
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object('table_name', p.table_name, 'fields', p.fields)
             ORDER BY p.pri, p.deleted_at, p.id
           ) AS preview_items
    FROM (
      SELECT x.id, x.table_name, x.deleted_at,
             CASE WHEN x.table_name IN
               ('invoices', 'payments_made', 'pay_stubs', 'supply_house_invoices', 'purchase_orders')
               THEN 0 ELSE 1 END AS pri,
             (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
              FROM jsonb_each(x.row_data) e
              WHERE e.key = ANY (ARRAY[
                'job_name', 'project_name', 'person_name', 'name', 'title', 'label',
                'invoice_number', 'bid_number', 'estimate_number', 'po_number',
                'part_name', 'description', 'fixture_name', 'item_name',
                'work_date', 'date', 'due_date', 'invoice_date', 'scheduled_date', 'block_date',
                'amount', 'total', 'gross_pay', 'total_amount', 'price', 'cost',
                'quantity', 'hours', 'hours_total',
                'user_id', 'created_by', 'created_at',
                'clocked_in_at', 'clocked_out_at', 'approved_at', 'rejected_at', 'revoked_at', 'notes',
                'template_name', 'created_by_name',
                'time_start', 'time_end',
                'sequence_order', 'status', 'stripe_invoice_status', 'custom_price'
              ])) AS fields
      FROM public.deleted_records_archive x
      WHERE x.group_key = h.gk
        AND x.restored_at IS NULL
        AND x.record_id IS DISTINCT FROM h.gk
      ORDER BY pri, x.deleted_at, x.id
      LIMIT 5
    ) p
  ) pv ON true
  WHERE public.is_dev()
  ORDER BY h.deleted_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;
