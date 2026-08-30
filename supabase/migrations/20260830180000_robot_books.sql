SET lock_timeout = '3s';

-- Robot books (owner decision 2026-08-30, straight out of the first M5 run): the twins
-- get their OWN default takeoff book, labor book, and price book — plus robot-owned
-- assemblies — that they can add to as they learn each job. Same pattern as the Robot
-- Board: identical machinery, robot scope. Humans can always read, edit, and promote
-- robot entries; the write fence keeps robot pens off the HUMAN books entirely.
--
-- M5 found the gaps this closes:
--   * takeoff book + price book matched 0/36 LIVSTE rows (no schedule-tag aliases, and
--     twins could not add any);
--   * no floor-drain / laundry-tub / wall-box assemblies existed and twins could not
--     create them;
--   * the labor stage was hard-blocked: cost_estimate_labor_rows has no bid_id column,
--     so the fence's bid-child detection missed it and denied every insert on the
--     twin's own bid.
--
-- What this migration does (all idempotent):
--   1. `is_robot` flag on takeoff_book_versions / labor_book_versions /
--      price_book_versions / material_templates.
--   2. Fence applier v2: twins may write book ENTRIES whose parent version is a robot
--      book, robot assemblies + their items/prices, INSERT new fixture_types (additive
--      catalog rows), and — the M5 fix — any table linking to their bid through
--      cost_estimate_id, not just bid_id.
--   3. Seed one '🤖 Robot Default' version of each book kind per service type.

ALTER TABLE public.takeoff_book_versions ADD COLUMN IF NOT EXISTS is_robot boolean NOT NULL DEFAULT false;
ALTER TABLE public.labor_book_versions   ADD COLUMN IF NOT EXISTS is_robot boolean NOT NULL DEFAULT false;
ALTER TABLE public.price_book_versions   ADD COLUMN IF NOT EXISTS is_robot boolean NOT NULL DEFAULT false;
ALTER TABLE public.material_templates    ADD COLUMN IF NOT EXISTS is_robot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.takeoff_book_versions.is_robot IS 'Robot book: digital twins may add/edit entries in this version (write fence). Humans always can.';
COMMENT ON COLUMN public.labor_book_versions.is_robot   IS 'Robot book: digital twins may add/edit entries in this version (write fence). Humans always can.';
COMMENT ON COLUMN public.price_book_versions.is_robot   IS 'Robot book: digital twins may add/edit entries in this version (write fence). Humans always can.';
COMMENT ON COLUMN public.material_templates.is_robot    IS 'Robot assembly: created by a digital twin; twins may edit only these. Humans always can.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Fence applier v2 (drop+recreate converges every table; rerun after CREATE TABLE).
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  t record;
  created integer := 0;
  ins_allow text;
  mod_allow text;
  has_bid_id boolean;
  has_ce_id boolean;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    -- Per-table allowance predicates (what a TWIN may still write).
    IF t.table_name = 'bids' THEN
      ins_allow := 'created_by = auth.uid()';
      mod_allow := '(created_by = auth.uid() OR estimator_id = auth.uid())';
    ELSIF t.table_name = 'price_book_entries' THEN
      -- Bid-scoped pricings (unchanged) OR entries in a robot price book.
      ins_allow := '(EXISTS (SELECT 1 FROM public.price_book_versions v JOIN public.bids b ON b.id = v.bid_id WHERE v.id = version_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid())) OR EXISTS (SELECT 1 FROM public.price_book_versions v WHERE v.id = version_id AND v.is_robot))';
      mod_allow := ins_allow;
    ELSIF t.table_name IN ('takeoff_book_versions', 'labor_book_versions') THEN
      -- Twins may mint new ROBOT versions and edit only robot versions.
      ins_allow := 'is_robot = true';
      mod_allow := 'is_robot = true';
    ELSIF t.table_name = 'price_book_versions' THEN
      -- Robot versions, plus the bid-scoped frozen-copy flow on their own bid.
      ins_allow := '(is_robot = true OR (bid_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))))';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'takeoff_book_entries' THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.takeoff_book_versions v WHERE v.id = version_id AND v.is_robot)';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'takeoff_book_entry_items' THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.takeoff_book_entries e JOIN public.takeoff_book_versions v ON v.id = e.version_id WHERE e.id = entry_id AND v.is_robot)';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'labor_book_entries' THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.labor_book_versions v WHERE v.id = version_id AND v.is_robot)';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'material_templates' THEN
      ins_allow := 'is_robot = true';
      mod_allow := 'is_robot = true';
    ELSIF t.table_name IN ('material_template_items', 'material_template_prices') THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.material_templates mt WHERE mt.id = template_id AND mt.is_robot)';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'fixture_types' THEN
      -- Additive catalog rows: a robot pricing a new tag (FD-2, WB-1) may mint the
      -- fixture type it needs; it may not rename or delete anyone's.
      ins_allow := 'true';
      mod_allow := 'false';
    ELSIF t.table_name = 'help_feedback' THEN
      ins_allow := 'true';
      mod_allow := 'false';
    ELSIF t.table_name = 'twin_runs' THEN
      ins_allow := 'false';
      mod_allow := 'false';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.table_name AND column_name = 'bid_id'
      ) INTO has_bid_id;
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.table_name AND column_name = 'cost_estimate_id'
      ) INTO has_ce_id;
      IF has_bid_id THEN
        ins_allow := 'EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
        mod_allow := ins_allow;
      ELSIF has_ce_id THEN
        -- The M5 fix: cost-estimate children (labor rows, direct-cost rows) are bid
        -- family too — they just link through cost_estimates instead of carrying bid_id.
        ins_allow := 'EXISTS (SELECT 1 FROM public.cost_estimates ce JOIN public.bids b ON b.id = ce.bid_id WHERE ce.id = cost_estimate_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
        mod_allow := ins_allow;
      ELSE
        ins_allow := 'false';
        mod_allow := 'false';
      END IF;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_insert ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, ins_allow
    );
    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_update ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_update ON public.%I AS RESTRICTIVE FOR UPDATE USING ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, mod_allow
    );
    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_delete ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_delete ON public.%I AS RESTRICTIVE FOR DELETE USING ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, mod_allow
    );
    created := created + 3;
  END LOOP;

  RETURN created;
END;
$$;

COMMENT ON FUNCTION public.apply_digital_twin_write_blocks() IS 'Creates/refreshes the restrictive digital-twin write-fence policies on every RLS-enabled public table: no-op for real users; twins may write their own/assigned bid family (bid_id OR cost_estimate_id linkage), robot-book versions/entries (is_robot), robot assemblies, additive fixture_types, and help_feedback inserts. Rerun after CREATE TABLE (idempotent, drop+recreate). Returns the number of policies created.';

SELECT public.apply_digital_twin_write_blocks();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: one 🤖 Robot Default of each book kind per service type (idempotent by name).
INSERT INTO public.takeoff_book_versions (name, service_type_id, is_robot)
SELECT '🤖 Robot Default', st.id, true
FROM public.service_types st
WHERE NOT EXISTS (
  SELECT 1 FROM public.takeoff_book_versions v
  WHERE v.service_type_id = st.id AND v.is_robot AND v.name = '🤖 Robot Default'
);

INSERT INTO public.labor_book_versions (name, service_type_id, is_robot)
SELECT '🤖 Robot Default', st.id, true
FROM public.service_types st
WHERE NOT EXISTS (
  SELECT 1 FROM public.labor_book_versions v
  WHERE v.service_type_id = st.id AND v.is_robot AND v.name = '🤖 Robot Default'
);

INSERT INTO public.price_book_versions (name, service_type_id, is_robot)
SELECT '🤖 Robot Default', st.id, true
FROM public.service_types st
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_book_versions v
  WHERE v.service_type_id = st.id AND v.is_robot AND v.name = '🤖 Robot Default'
);
