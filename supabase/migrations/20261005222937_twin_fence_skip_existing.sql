SET lock_timeout = '3s';

-- apply_digital_twin_write_blocks() ran DROP POLICY + CREATE POLICY for all three
-- digital_twin_write_fence_* policies on every RLS-enabled public table (~250),
-- unconditionally. Both statements take an ACCESS EXCLUSIVE lock on the table, which
-- blocks even SELECTs, and every lock is held until the migration transaction
-- commits. So each CREATE TABLE migration that ends with the call locked the app's
-- tables one after another for the rest of its push: reads queued behind the growing
-- set of locks, and one slow query on any table stalled the sweep for the whole
-- lock_timeout with everything already locked still queued behind it. Same hazard
-- 20260814185815_read_only_stmt_blocks_skip_existing.sql fixed for
-- apply_read_only_stmt_blocks().
--
-- Same discipline here: only CREATE a fence policy where it is missing, so the
-- routine new-table rerun locks exactly the new table and a table that already
-- carries all three policies is never touched. The per-table allowances are v3's,
-- copied verbatim (20260830210000_robot_price_research.sql). If an allowance ever
-- changes (including an existing table gaining a bid_id or cost_estimate_id column,
-- which changes its derived allowance), ship a one-off migration that DROPs the
-- affected fence policies first and then reruns this: a plain rerun no longer
-- rebuilds them.
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
    SELECT c.oid AS table_oid, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      -- Incremental: a table that already carries all three fence policies is
      -- skipped, so no DDL runs on it and it is never locked.
      AND (
        SELECT count(*) FROM pg_policy p
        WHERE p.polrelid = c.oid
          AND p.polname IN ('digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete')
      ) < 3
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

    -- Create only the policies this table is missing; never DROP.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = t.table_oid AND p.polname = 'digital_twin_write_fence_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY digital_twin_write_fence_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT public.is_digital_twin()) OR (%s))',
        t.table_name, ins_allow
      );
      created := created + 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = t.table_oid AND p.polname = 'digital_twin_write_fence_update'
    ) THEN
      EXECUTE format(
        'CREATE POLICY digital_twin_write_fence_update ON public.%I AS RESTRICTIVE FOR UPDATE USING ((NOT public.is_digital_twin()) OR (%s))',
        t.table_name, mod_allow
      );
      created := created + 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = t.table_oid AND p.polname = 'digital_twin_write_fence_delete'
    ) THEN
      EXECUTE format(
        'CREATE POLICY digital_twin_write_fence_delete ON public.%I AS RESTRICTIVE FOR DELETE USING ((NOT public.is_digital_twin()) OR (%s))',
        t.table_name, mod_allow
      );
      created := created + 1;
    END IF;
  END LOOP;

  RETURN created;
END;
$$;

COMMENT ON FUNCTION public.apply_digital_twin_write_blocks() IS 'Creates the restrictive digital-twin write-fence policies (digital_twin_write_fence_insert/update/delete) on every RLS-enabled public table missing them: no-op for real users; twins may write their own/assigned bid family (bid_id OR cost_estimate_id linkage), robot-book versions/entries (is_robot), robot assemblies + robot-researched parts/prices, additive fixture_types, and help_feedback inserts. Idempotent AND incremental (since 2026-10-05): existing fence policies are left alone and a table that carries all three is skipped, so the rerun after CREATE TABLE locks only the new table (the old DROP+CREATE-everywhere version held ACCESS EXCLUSIVE locks on every RLS table until the push committed). Changing an allowance (including an existing table gaining a bid_id or cost_estimate_id column) now needs a one-off migration that drops the affected fence policies first, then reruns this; same discipline as apply_read_only_stmt_blocks(). Returns the number of policies created.';

-- Self-test with the new semantics. Every RLS table in prod already carries all three
-- policies (20261005173119_sent_documents.sql ran the old full rebuild and no table
-- was created since), so this creates 0 policies and takes no table locks; it also
-- fences any table that somehow lost a policy.
SELECT public.apply_digital_twin_write_blocks();
