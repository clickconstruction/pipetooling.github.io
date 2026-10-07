SET lock_timeout = '3s';

-- Bid history PR 0b (punch list #73, to-dos/bid-history): the Labor tab's load sync stops deleting
-- typed hours. Labor rows are keyed by fixture name and belong to the bid, while count rows belong
-- to a version, so the sync deleted every labor row no counted name claimed and minted the book's
-- hours for every counted name with no row. Typed hours were lost on a re-import that renamed a
-- fixture, on a switch to a version without it, and when a fixture was removed and counted again.
--
-- The client (src/lib/bids/laborSyncPlan.ts) now renames a row whose name changed only in case,
-- spacing or a [Group] prefix, and moves a row no counted name claims HERE instead of deleting it.
-- A parked row cannot stay in cost_estimate_labor_rows: pricing history, job budgets, baselines,
-- the estimate breakdown and the copies all sum that table, and a fixed (task) row counts its hours
-- at any count. When its fixture is counted again the sync takes it back before it reaches for the
-- book; the Labor tab's band offers "Use for <fixture>" and "Remove".
--
-- 1. The table: the labor row's own columns, plus where it came from and when it was parked.
-- 2. RLS as cost_estimate_labor_rows (whoever can price the bid), the delete archive, the
--    read-only and twin fences.
-- 3. Bid history: the table joins bid_changes_tables() (eighteen), record_bid_change() labels its
--    rows by fixture as it does a labor row's, its trigger is attached, and the sync's three new
--    tags (labor-rename, labor-park, labor-take-back) join the app's own actions.

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.cost_estimate_labor_rows_unmatched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_estimate_id uuid NOT NULL REFERENCES public.cost_estimates (id) ON DELETE CASCADE,
  fixture text NOT NULL,
  count numeric(12,2) NOT NULL DEFAULT 0,
  rough_in_hrs_per_unit numeric(8,2) NOT NULL DEFAULT 0,
  top_out_hrs_per_unit numeric(8,2) NOT NULL DEFAULT 0,
  trim_set_hrs_per_unit numeric(8,2) NOT NULL DEFAULT 0,
  is_fixed boolean NOT NULL DEFAULT false,
  kind text NOT NULL DEFAULT 'fixture',
  unit text NOT NULL DEFAULT 'each',
  source text,
  source_note text,
  -- The live row it was parked from; no FK, that row is gone.
  labor_row_id uuid,
  parked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cost_estimate_labor_rows_unmatched IS
  'Labor rows the Labor tab''s load sync took off the bid because no counted fixture claims them (a version switch, a removed or renamed fixture), kept with their hours and out of every total. The sync takes one back when its fixture is counted again; the tab''s band uses or removes them (bid history PR 0b, punch list #73).';

CREATE INDEX IF NOT EXISTS cost_estimate_labor_rows_unmatched_estimate_idx
  ON public.cost_estimate_labor_rows_unmatched (cost_estimate_id, parked_at DESC);

-- 2. Who reaches it: the labor rows' own rule (celr_*), whoever can price the bid.
ALTER TABLE public.cost_estimate_labor_rows_unmatched ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS celru_select ON public.cost_estimate_labor_rows_unmatched;
CREATE POLICY celru_select ON public.cost_estimate_labor_rows_unmatched FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.can_access_bid_for_pricing(ce.bid_id)));
DROP POLICY IF EXISTS celru_insert ON public.cost_estimate_labor_rows_unmatched;
CREATE POLICY celru_insert ON public.cost_estimate_labor_rows_unmatched FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.can_access_bid_for_pricing(ce.bid_id)));
DROP POLICY IF EXISTS celru_update ON public.cost_estimate_labor_rows_unmatched;
CREATE POLICY celru_update ON public.cost_estimate_labor_rows_unmatched FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.can_access_bid_for_pricing(ce.bid_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.can_access_bid_for_pricing(ce.bid_id)));
DROP POLICY IF EXISTS celru_delete ON public.cost_estimate_labor_rows_unmatched;
CREATE POLICY celru_delete ON public.cost_estimate_labor_rows_unmatched FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.can_access_bid_for_pricing(ce.bid_id)));

REVOKE ALL ON TABLE public.cost_estimate_labor_rows_unmatched FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cost_estimate_labor_rows_unmatched TO authenticated;

-- A removed bid or cost estimate keeps its parked rows in Recently deleted, grouped as the labor
-- rows are (under the cost estimate).
DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.cost_estimate_labor_rows_unmatched;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.cost_estimate_labor_rows_unmatched
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record('cost_estimate_id');

-- 3. Bid history. The tables the ledger records, in trigger-creation order (bids last); the
--    eighteenth is new, so its trigger below locks nothing anyone is using.
CREATE OR REPLACE FUNCTION public.bid_changes_tables()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'cost_estimate_labor_rows_unmatched',
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

-- The sync's writes are the app's own: its load sync as before, and now the rename, the park and
-- the take-back, each tagged so the ledger reads them as such. src/lib/bids/bidActionHeader.ts
-- mirrors this list; bidActionHeader.test.ts fails CI when the two disagree.
CREATE OR REPLACE FUNCTION public.bid_changes_app_actions()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['labor-sync', 'labor-rename', 'labor-park', 'labor-take-back']::text[]
$$;

COMMENT ON FUNCTION public.bid_changes_app_actions() IS
  'The x-bid-action tags that are the app''s own writes (bid history, punch list #73): bid_changes.by_app is true for these, false for a tagged press of a person''s, null when no tag came.';

-- record_bid_change(), whole, from 20261007050000_bid_changes_action_tag: the same body, with a
-- parked labor row labelled by its fixture as a live one is.
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
  v_action text;
  v_by_app boolean;
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
    ELSIF TG_TABLE_NAME IN ('cost_estimate_labor_rows', 'cost_estimate_labor_rows_unmatched') THEN
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

    -- PR 1b: the request's tag, and whether it names one of the app's own actions.
    v_action := public.bid_change_action();
    v_by_app := CASE WHEN v_action IS NULL THEN NULL ELSE v_action = ANY (public.bid_changes_app_actions()) END;

    INSERT INTO public.bid_changes
      (bid_id, bid_version_id, table_name, record_id, count_row_id, op, changed, old_values, new_values, label, changed_by, action, by_app)
    VALUES
      (v_bid, v_version, TG_TABLE_NAME, (v_row ->> 'id')::uuid, v_count_row, lower(TG_OP), v_changed,
       v_old_values, v_new_values, v_label, auth.uid(), v_action, v_by_app);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_bid_change on %: % (%)', TG_TABLE_NAME, SQLERRM, SQLSTATE;
  END;
  -- AFTER trigger: the return value is ignored.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.record_bid_change() IS
  'AFTER INSERT/UPDATE/DELETE row trigger on the tables bid_changes_tables() lists: writes the change to bid_changes with its bid, label, count row, version, and (PR 1b) the request''s x-bid-action tag and whether it was the app''s own write. Records only real changes; catches its own errors (RAISE WARNING) so a bid save never fails because of the ledger.';

-- The new table's trigger. CREATE TRIGGER locks only this table, which nothing uses yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.cost_estimate_labor_rows_unmatched'::regclass
      AND tg.tgname = 'record_bid_change'
      AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER record_bid_change AFTER INSERT OR UPDATE OR DELETE ON public.cost_estimate_labor_rows_unmatched
      FOR EACH ROW EXECUTE FUNCTION public.record_bid_change();
  END IF;
END $$;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
