SET lock_timeout = '3s';

-- Robot price research (owner decision 2026-08-30, BT-1 follow-on): twins may research
-- the products a plan's fixture schedule names (manufacturer + catalog #) on the open
-- web and record what they find as PARTS with PRICES — checkable, never masquerading:
--   * every researched part carries its source URL in material_parts.link (the
--     estimator's one-click verification — owner requirement) + a dated provenance
--     note; is_robot marks it robot-authored;
--   * every researched price attributes to the dedicated '🤖 Web Research' supply
--     house, so Ferguson/Winsupply quotes stay unmistakably theirs;
--   * researched prices are COST-basis inputs; sale prices remain the Workbench's
--     margin call on top.
--
-- Idempotent; no new tables. Extends apply_digital_twin_write_blocks() v2 → v3.

ALTER TABLE public.material_parts ADD COLUMN IF NOT EXISTS is_robot boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.material_parts.is_robot IS 'Robot-researched part: created by a digital twin from plan schedule + web research; link column carries the source URL. Twins may edit only these; humans always can.';

-- Fence applier v3: adds material_parts (robot rows) + material_part_prices (parent
-- part robot). Everything else identical to v2 (20260830180000_robot_books.sql).
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
    IF t.table_name = 'bids' THEN
      ins_allow := 'created_by = auth.uid()';
      mod_allow := '(created_by = auth.uid() OR estimator_id = auth.uid())';
    ELSIF t.table_name = 'price_book_entries' THEN
      ins_allow := '(EXISTS (SELECT 1 FROM public.price_book_versions v JOIN public.bids b ON b.id = v.bid_id WHERE v.id = version_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid())) OR EXISTS (SELECT 1 FROM public.price_book_versions v WHERE v.id = version_id AND v.is_robot))';
      mod_allow := ins_allow;
    ELSIF t.table_name IN ('takeoff_book_versions', 'labor_book_versions') THEN
      ins_allow := 'is_robot = true';
      mod_allow := 'is_robot = true';
    ELSIF t.table_name = 'price_book_versions' THEN
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
    ELSIF t.table_name = 'material_parts' THEN
      -- Robot price research: twins mint parts they researched (link = source URL).
      ins_allow := 'is_robot = true';
      mod_allow := 'is_robot = true';
    ELSIF t.table_name = 'material_part_prices' THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.material_parts mp WHERE mp.id = part_id AND mp.is_robot)';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'fixture_types' THEN
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

COMMENT ON FUNCTION public.apply_digital_twin_write_blocks() IS 'Creates/refreshes the restrictive digital-twin write-fence policies on every RLS-enabled public table: no-op for real users; twins may write their own/assigned bid family (bid_id OR cost_estimate_id linkage), robot-book versions/entries (is_robot), robot assemblies + robot-researched parts/prices, additive fixture_types, and help_feedback inserts. Rerun after CREATE TABLE (idempotent, drop+recreate). Returns the number of policies created.';

SELECT public.apply_digital_twin_write_blocks();

-- Seed the provenance supply house (idempotent by name).
INSERT INTO public.supply_houses (name, notes)
SELECT '🤖 Web Research', 'Robot-researched web prices (list/street). NOT a supplier quote — every part carries its source URL in material_parts.link; verify before award. Seeded v2.2515.'
WHERE NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE name = '🤖 Web Research');
