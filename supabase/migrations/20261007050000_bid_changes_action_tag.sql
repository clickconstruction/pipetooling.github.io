SET lock_timeout = '3s';

-- Bid history, PR 1b (to-dos/bid-history, punch list #73): the request tag. Each REST call is its
-- own transaction and a bulk path writes one request per batch, so the ledger could not say that
-- 23 count rows arrived as one import, or that the Labor tab's load sync, not the person who
-- opened the tab, rewrote the hours. The client now sends `x-bid-action: <name>` on each call of a
-- bulk or app-own path (src/lib/bids/bidActionHeader.ts); PostgREST hands the request headers to
-- the database as request.headers, and the trigger stores the tag in bid_changes.action and marks
-- the app's own actions in by_app. A write with no tag records null in both, as every row did
-- before this file. The reader (PR 2) groups and captions by the tag.
--
-- Two things change: bid_change_action() reads the header, and record_bid_change() is replaced in
-- full (the newest definition, as the house rule has it) to fill the two columns PR 1 left for it.

-- The actions that are the app's own doing rather than a person's press: the ledger lays them at
-- "the app"'s door, not the viewer's. src/lib/bids/bidActionHeader.ts mirrors this list;
-- bidChangesCapture.test.ts fails CI when the two disagree.
CREATE OR REPLACE FUNCTION public.bid_changes_app_actions()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['labor-sync']::text[]
$$;

COMMENT ON FUNCTION public.bid_changes_app_actions() IS
  'The x-bid-action tags that are the app''s own writes (bid history, punch list #73): bid_changes.by_app is true for these, false for a tagged press of a person''s, null when no tag came.';

-- The request's tag, or null: PostgREST lowercases header names into request.headers (a JSON
-- object as text). Only a plain slug counts; anything else, or no request, is null. Never raises.
CREATE OR REPLACE FUNCTION public.bid_change_action()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := NULLIF(btrim(current_setting('request.headers', true)::json ->> 'x-bid-action'), '');
  IF v IS NULL OR v !~ '^[a-z][a-z0-9-]{1,40}$' THEN
    RETURN NULL;
  END IF;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.bid_change_action() FROM PUBLIC, anon;

COMMENT ON FUNCTION public.bid_change_action() IS
  'The x-bid-action request header as PostgREST hands it to the database (request.headers), as a slug, or null (bid history, punch list #73).';

-- record_bid_change(), whole, from 20261007040000_bid_changes: the same body with the tag read
-- just before the insert. Every table it reads is schema-qualified; it still records only real
-- changes and still catches its own errors so a bid save never fails because of the ledger.
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
