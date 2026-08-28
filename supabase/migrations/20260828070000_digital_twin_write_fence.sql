SET lock_timeout = '3s';

-- Digital twins Phase E2 (docs/DIGITAL_TWINS_PLAN.md): the estimator twin WRITE-FENCE +
-- the twin_runs ledger.
--
-- The fence is the training-mode machinery's sibling: RESTRICTIVE per-table policies of
-- the shape (NOT is_digital_twin()) OR (<allowance>) — a no-op for every real user, and
-- one-directional by design: humans can always read AND edit twin work; only twins are
-- bound. For twins, writes are allowed only on:
--   * bids they CREATED or are the ASSIGNED ESTIMATOR on ("assignment is the grant" —
--     setting a real bid's estimator to a twin admits exactly that bid; un-assigning
--     revokes it), and every bid-child table (detected by a bid_id column, so future
--     bid-family tables inherit the rule when the applier reruns);
--   * price_book_entries whose version belongs to such a bid (bid-scoped pricings only —
--     template/catalog books have no bid_id and stay read-only);
--   * help_feedback INSERT (the bug-report channel — twins report what they find).
-- Everything else is read-only for twins. Notably customers has no created_by, so twins
-- cannot mint customers in this phase — they pick existing GCs and report when a new one
-- is needed.
--
-- Like read-only training mode: service-role and SECURITY DEFINER (postgres-owned) writes
-- bypass the fence; is_digital_twin() is false for anon.

CREATE OR REPLACE FUNCTION public.is_digital_twin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_digital_twin = true
  );
$$;

COMMENT ON FUNCTION public.is_digital_twin() IS 'True when the current user is a flagged digital twin (users.is_digital_twin). Used by the restrictive twin write-fence policies; false for anon and every real person.';

-- ─────────────────────────────────────────────────────────────────────────────
-- twin_runs: the fleet ledger — one row per twin-login mint / mission. Written by the
-- twin-login edge function (service role); read by devs.
CREATE TABLE IF NOT EXISTS public.twin_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mission text NOT NULL DEFAULT 'twin-login',
  notes text NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS twin_runs_twin_idx ON public.twin_runs (twin_user_id, started_at DESC);

COMMENT ON TABLE public.twin_runs IS 'Digital twin fleet ledger: one row per twin-login mint / mission (docs/DIGITAL_TWINS_PLAN.md). Service-role written; dev-read.';

ALTER TABLE public.twin_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "twin_runs_select_dev" ON public.twin_runs;
CREATE POLICY "twin_runs_select_dev" ON public.twin_runs
  FOR SELECT USING (public.is_dev());

GRANT SELECT ON public.twin_runs TO authenticated;
GRANT ALL ON public.twin_runs TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- The fence applier. Idempotent AND updatable: it drops+recreates its own policies, so
-- rerunning after a predicate change (or after CREATE TABLE) converges every table.
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
      ins_allow := 'EXISTS (SELECT 1 FROM public.price_book_versions v JOIN public.bids b ON b.id = v.bid_id WHERE v.id = version_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
      mod_allow := ins_allow;
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
      IF has_bid_id THEN
        ins_allow := 'EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
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

COMMENT ON FUNCTION public.apply_digital_twin_write_blocks() IS 'Creates/refreshes the restrictive digital-twin write-fence policies on every RLS-enabled public table: no-op for real users; twins may write only their own/assigned bid family + help_feedback inserts. Rerun after CREATE TABLE (idempotent, drop+recreate). Returns the number of policies created.';

SELECT public.apply_digital_twin_write_blocks();

-- House rule for every CREATE TABLE: training-mode blocks on the new twin_runs table too.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
