SET lock_timeout = '3s';

-- Bid history, PR 1 of 2 files (to-dos/bid-history, punch list #73): the ledger. Nothing on a bid
-- kept its old value: an edit overwrote it, a delete was kept for a dev for 90 days, and nobody
-- could see who changed what. This file makes the place the history goes; the next file
-- (20261007041000_bid_changes_triggers) attaches the trigger that writes it to the seventeen
-- tables that hold what people type on a bid.
--
--   bid_changes               — one row per insert, real change or delete of a row on those tables.
--   bid_changes_tables()      — the seventeen tables, in the order their triggers are created.
--   bid_changes_bid_columns() — the bids columns the ledger keeps.
--   record_bid_change()       — the one trigger function behind all seventeen triggers.
--
-- This file touches no existing table: the new table, its functions, its purge job and the
-- read-only blocks for it. The triggers are a file of their own so that their write locks on the
-- bid tables are held for seventeen catalog inserts and nothing else.
--
-- Capture only. Nothing reads the ledger until PR 2 (the pane); no client change here. PR 1b fills
-- `action` and `by_app` from the x-bid-action request tag; the columns are here so it needs no
-- table change. History starts the day the triggers are pushed: nothing before it can be shown.

-- ---------------------------------------------------------------------------
-- 1) The ledger
-- ---------------------------------------------------------------------------

-- Once the triggers are pushed, every bid save writes this table. On a re-run of this file,
-- CREATE INDEX IF NOT EXISTS (SHARE) and ENABLE ROW LEVEL SECURITY / CREATE POLICY (ACCESS
-- EXCLUSIVE) would lock it and hold every save behind them, so its whole setup sits behind one
-- existence check.
--
-- bid_id has no foreign key, on purpose. History outlives the archive's 90-day purge: when a bid
-- is deleted, its rows stay (readable by a dev, since nobody else can read the bid), and a bid put
-- back from Recently deleted keeps its id, so its history comes back with it. A key with ON DELETE
-- CASCADE would erase the history with the bid; a plain key would refuse the delete.
DO $setup$
BEGIN
  IF to_regclass('public.bid_changes') IS NOT NULL THEN
    RETURN;
  END IF;

  CREATE TABLE public.bid_changes (
    -- Strict order: every row of one request shares changed_at.
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bid_id uuid NOT NULL,
    -- The version the row belongs to: count rows and part lines their own; what hangs on a count
    -- row, its count row's; a version row its own id. Null for what every version shares.
    bid_version_id uuid,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    -- The count row the row hangs off (a count row's own id), so one filter finds a fixture and
    -- everything on it, even after it was removed.
    count_row_id uuid,
    op text NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
    -- The columns this row records: those that changed (update), or every non-empty one (insert,
    -- delete).
    changed text[] NOT NULL,
    old_values jsonb,
    new_values jsonb,
    -- The row's human name at write time, so the reader never joins back to a row that may be gone.
    label text,
    -- auth.uid(): null for the service role, cron and the robots. No foreign key, like the
    -- archive's deleted_by: a removed user's changes keep their author.
    changed_by uuid,
    changed_at timestamptz NOT NULL DEFAULT now(),
    -- PR 1b: the request's x-bid-action tag, and whether the write was the app's own doing rather
    -- than a person's press. Null on every row written before 1b.
    action text,
    by_app boolean
  );

  COMMENT ON TABLE public.bid_changes IS
    'Bid history (punch list #73): one row per insert, real change or delete on the tables that hold what people type on a bid, written by the record_bid_change() trigger. Read by whoever can read the bid (a dev also after it is deleted); no client writes. Kept three years (pg_cron purge-bid-changes). Every bid save writes here: build an index on it CONCURRENTLY, and keep any other DDL on it under a lock timeout.';

  -- The reader: a bid's history, newest first.
  CREATE INDEX bid_changes_bid_idx ON public.bid_changes (bid_id, id);

  ALTER TABLE public.bid_changes ENABLE ROW LEVEL SECURITY;

  -- Whoever can read the bid reads its history: the subquery runs under the caller's own policies
  -- on bids (the office roles, primary_scope_bids), so history is never wider than the bid.
  CREATE POLICY bid_changes_select ON public.bid_changes
    FOR SELECT TO authenticated
    USING ((SELECT public.is_dev()) OR EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_changes.bid_id));
  -- No INSERT / UPDATE / DELETE policy on purpose: the trigger writes it.

  REVOKE ALL ON TABLE public.bid_changes FROM anon;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.bid_changes FROM authenticated;
  GRANT SELECT ON TABLE public.bid_changes TO authenticated;
END
$setup$;

-- ---------------------------------------------------------------------------
-- 2) What is recorded
-- ---------------------------------------------------------------------------

-- The tables that hold what people type on a bid, in the order the next file creates their
-- triggers: the least written first and bids last, so the hottest locks are held the shortest.
-- bids_takeoff_template_mappings is not here: it is By Stage's, and nothing has written it since
-- v2.4396. src/lib/bids/bidChangesCapture.test.ts fails CI when a name here is not a table.
CREATE OR REPLACE FUNCTION public.bid_changes_tables()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'bid_payment_schedule_rows',
    'bid_sov_lines',
    'cost_estimate_waste_rows',
    'cost_estimate_subcontractor_rows',
    'cost_estimate_permit_rows',
    'cost_estimate_other_rows',
    'cost_estimate_equipment_rows',
    'bid_count_row_custom_costs',
    'bid_takeoff_stage_splits',
    'bid_versions',
    'cost_estimates',
    'cost_estimate_labor_rows',
    'bid_pricing_assignments',
    'bid_count_row_custom_prices',
    'bids_takeoff_rough_part_lines',
    'bids_count_rows',
    'bids'
  ]::text[]
$$;

COMMENT ON FUNCTION public.bid_changes_tables() IS
  'The tables whose writes record_bid_change() records into bid_changes (bid history, punch list #73), in trigger-creation order.';

-- The bids columns the ledger keeps: everything Edit Bid saves (src/lib/bids/bidFormPayload.ts,
-- less robot_opt_out and the creation-only last_contact), the picks Pricing, Cover Letter and the
-- schedule of values write, and outcome_at. Not the stamps (acknowledgements, reviews, follow-ups,
-- the board), the robot and twin columns, bid_tab_*, materials_model or updated_at. History cannot
-- be filled in later, so this keeps wide and the reader chooses what to show.
-- The bids trigger's UPDATE OF list is built from this (next file), so robot, follow-up and board
-- writes to bids never call the function. src/lib/bids/bidChangesCapture.test.ts fails CI when a
-- name here is not a bids column. To change the list, redefine this function in a new migration
-- and replace the bids trigger there with the same CREATE OR REPLACE TRIGGER statement.
CREATE OR REPLACE FUNCTION public.bid_changes_bid_columns()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'accepted_alternate_tags',
    'account_manager_id',
    'address',
    'agreed_value',
    'alternate_group_tags',
    'bid_date_sent',
    'bid_due_date',
    'bid_due_time',
    'bid_number',
    'bid_submission_link',
    'bid_to_marked_plans',
    'bid_value',
    'count_tooling_plans_link',
    'cover_letter_alt_texts',
    'customer_id',
    'declined_alternate_tags',
    'design_drawing_plan_date',
    'distance_from_office',
    'drive_link',
    'estimated_job_start_date',
    'estimator_id',
    'gc_builder_id',
    'gc_contact_email',
    'gc_contact_name',
    'gc_contact_phone',
    'include_materials_by_stage',
    'include_payment_schedule',
    'include_schedule_of_values',
    'itb_links',
    'loss_category',
    'loss_reason',
    'notes',
    'outcome',
    'outcome_at',
    'plans_link',
    'profit',
    'project_id',
    'project_name',
    'selected_bid_version_id',
    'selected_labor_book_version_id',
    'selected_price_book_version_id',
    'selected_takeoff_book_version_id',
    'service_type_id',
    'sov_letter_total_only',
    'sov_material_factor',
    'sov_shape',
    'sov_split_labor_material',
    'submitted_to'
  ]::text[]
$$;

COMMENT ON FUNCTION public.bid_changes_bid_columns() IS
  'The bids columns bid_changes records, and the bids trigger''s UPDATE OF list: what a person types or picks on Edit Bid, Pricing, Cover Letter and the schedule of values.';

-- The trigger function. The contract-text history's pattern (20260928050129): SECURITY DEFINER,
-- records only a real change (IS DISTINCT FROM, column by column), and catches its own errors so a
-- bid save can never fail because of the ledger. Every table it reads is schema-qualified.
--
-- Per row, at write time:
--   bid_id          the row's own (bids: its id). The six cost_estimate_*_rows tables reach it
--                   through cost_estimates, or, when the cost estimate was removed in the same
--                   statement, through the delete archive's snapshot of it. No bid found, or the
--                   bid itself deleted: nothing is written (the bid's own delete row stands for
--                   its rows, and the archive keeps the bundle).
--   count_row_id    a count row's own id; prices, custom costs, assignments, part lines and stage
--                   splits carry theirs.
--   label           count row: its fixture · price, custom cost (· house), assignment, stage
--                   split: its count row's fixture · part line: the part's name (none for an
--                   assembly line) · labor row: its fixture · direct-cost row: its note · SOV
--                   line: its label · payment schedule row: its timing · version: its name ·
--                   bids, cost_estimates: none (the reader words each column).
--   bid_version_id  count rows and part lines their own; what hangs on a count row, its count
--                   row's; a version its id.
-- A count row removed in the same statement (Clear all, a version deleted) can no longer be read
-- by the rows its delete cascades to: their fixture and version come from the delete archive's
-- BEFORE DELETE snapshot of it.
-- Updates record the columns that changed; ids, created/updated/applied stamps and the two ordering
-- columns never count as a change (a reorder writes nothing). Inserts and deletes record every
-- non-empty column.
CREATE OR REPLACE FUNCTION public.record_bid_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_keep text[];
  v_changed text[];
  v_old_values jsonb;
  v_new_values jsonb;
  v_bid uuid;
  v_version uuid;
  v_count_row uuid;
  v_label text;
BEGIN
  -- A history row must never be the reason a bid save fails.
  BEGIN
    IF TG_OP <> 'INSERT' THEN
      v_old := to_jsonb(OLD);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_new := to_jsonb(NEW);
    END IF;
    v_row := COALESCE(v_new, v_old);
    IF TG_TABLE_NAME = 'bids' THEN
      v_keep := public.bid_changes_bid_columns();
    END IF;

    IF TG_OP = 'UPDATE' THEN
      SELECT array_agg(k ORDER BY k), jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
        INTO v_changed, v_old_values, v_new_values
      FROM jsonb_object_keys(v_new) AS k
      WHERE k NOT IN ('id', 'created_at', 'updated_at', 'updated_by', 'applied_at', 'applied_by', 'sequence_order', 'sort_order')
        AND (v_keep IS NULL OR k = ANY (v_keep))
        AND (v_old -> k) IS DISTINCT FROM (v_new -> k);
    ELSE
      SELECT array_agg(e.key ORDER BY e.key), jsonb_object_agg(e.key, e.value)
        INTO v_changed, v_new_values
      FROM jsonb_each(v_row) AS e
      WHERE e.key NOT IN ('id', 'created_at', 'updated_at', 'updated_by', 'applied_at', 'applied_by')
        AND (v_keep IS NULL OR e.key = ANY (v_keep))
        AND e.value <> 'null'::jsonb;
      IF TG_OP = 'DELETE' THEN
        v_old_values := v_new_values;
        v_new_values := NULL;
      END IF;
    END IF;

    IF v_changed IS NULL THEN
      RETURN NULL;
    END IF;

    IF TG_TABLE_NAME = 'bids' THEN
      v_bid := (v_row ->> 'id')::uuid;
    ELSIF v_row ? 'bid_id' THEN
      v_bid := (v_row ->> 'bid_id')::uuid;
    ELSE
      SELECT ce.bid_id INTO v_bid FROM public.cost_estimates ce WHERE ce.id = (v_row ->> 'cost_estimate_id')::uuid;
      IF NOT FOUND THEN
        SELECT (a.row_data ->> 'bid_id')::uuid INTO v_bid
        FROM public.deleted_records_archive a
        WHERE a.table_name = 'cost_estimates' AND a.record_id = v_row ->> 'cost_estimate_id'
        ORDER BY a.deleted_at DESC
        LIMIT 1;
      END IF;
    END IF;
    IF v_bid IS NULL
       OR (TG_TABLE_NAME <> 'bids' AND NOT EXISTS (SELECT 1 FROM public.bids b WHERE b.id = v_bid)) THEN
      RETURN NULL;
    END IF;

    IF TG_TABLE_NAME = 'bids_count_rows' THEN
      v_count_row := (v_row ->> 'id')::uuid;
      v_label := v_row ->> 'fixture';
      v_version := (v_row ->> 'bid_version_id')::uuid;
    ELSIF TG_TABLE_NAME IN ('bid_count_row_custom_prices', 'bid_count_row_custom_costs', 'bid_pricing_assignments',
                            'bids_takeoff_rough_part_lines', 'bid_takeoff_stage_splits') THEN
      v_count_row := (v_row ->> 'count_row_id')::uuid;
      SELECT cr.fixture, cr.bid_version_id INTO v_label, v_version
      FROM public.bids_count_rows cr WHERE cr.id = v_count_row;
      IF NOT FOUND THEN
        SELECT a.row_data ->> 'fixture', (a.row_data ->> 'bid_version_id')::uuid INTO v_label, v_version
        FROM public.deleted_records_archive a
        WHERE a.table_name = 'bids_count_rows' AND a.record_id = v_count_row::text
        ORDER BY a.deleted_at DESC
        LIMIT 1;
      END IF;
      IF TG_TABLE_NAME = 'bids_takeoff_rough_part_lines' THEN
        v_version := COALESCE((v_row ->> 'bid_version_id')::uuid, v_version);
        -- No row (an assembly line has no part): SELECT INTO leaves the label null.
        SELECT mp.name INTO v_label FROM public.material_parts mp WHERE mp.id = (v_row ->> 'part_id')::uuid;
      ELSIF TG_TABLE_NAME = 'bid_count_row_custom_costs' AND NULLIF(btrim(v_row ->> 'house_name'), '') IS NOT NULL THEN
        v_label := concat_ws(' · ', v_label, btrim(v_row ->> 'house_name'));
      END IF;
    ELSIF TG_TABLE_NAME = 'cost_estimate_labor_rows' THEN
      v_label := v_row ->> 'fixture';
    ELSIF TG_TABLE_NAME = 'bid_sov_lines' THEN
      v_label := v_row ->> 'label';
    ELSIF TG_TABLE_NAME = 'bid_payment_schedule_rows' THEN
      v_label := v_row ->> 'timing';
    ELSIF TG_TABLE_NAME = 'bid_versions' THEN
      v_label := v_row ->> 'name';
      v_version := (v_row ->> 'id')::uuid;
    ELSIF TG_TABLE_NAME LIKE 'cost_estimate\_%\_rows' THEN
      v_label := NULLIF(btrim(v_row ->> 'note'), '');
    END IF;

    INSERT INTO public.bid_changes
      (bid_id, bid_version_id, table_name, record_id, count_row_id, op, changed, old_values, new_values, label, changed_by)
    VALUES
      (v_bid, v_version, TG_TABLE_NAME, (v_row ->> 'id')::uuid, v_count_row, lower(TG_OP), v_changed,
       v_old_values, v_new_values, v_label, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_bid_change on %: % (%)', TG_TABLE_NAME, SQLERRM, SQLSTATE;
  END;
  -- AFTER trigger: the return value is ignored.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.record_bid_change() IS
  'AFTER INSERT/UPDATE/DELETE row trigger on the tables bid_changes_tables() lists: writes the change to bid_changes with its bid, label, count row and version. Records only real changes; catches its own errors (RAISE WARNING) so a bid save never fails because of the ledger.';

-- ---------------------------------------------------------------------------
-- 3) Three years, then purged (pg_cron, like the delete archive's 90 days)
-- ---------------------------------------------------------------------------

-- id grows with time, so the oldest rows have the lowest ids: the cutoff is found by walking the
-- primary key from the bottom, and the write path carries no index on changed_at.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-bid-changes') THEN
      PERFORM cron.unschedule('purge-bid-changes');
    END IF;
    PERFORM cron.schedule(
      'purge-bid-changes', '20 9 * * *',
      $cmd$DELETE FROM public.bid_changes WHERE id < COALESCE((SELECT min(c.id) FROM public.bid_changes c WHERE c.changed_at >= now() - interval '3 years'), (SELECT max(c.id) + 1 FROM public.bid_changes c))$cmd$
    );
  ELSE
    RAISE WARNING 'pg_cron not installed; bid_changes three-year purge not scheduled';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) House rules for a new table
-- ---------------------------------------------------------------------------

-- The read-only (training mode) blocks. Both skip tables already covered, so they touch
-- bid_changes alone. apply_digital_twin_write_blocks() is not called: bid_changes has no client
-- write for a twin to be fenced from, and that function drops and recreates three policies on
-- every RLS table in public (ACCESS EXCLUSIVE on each, held to commit).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
