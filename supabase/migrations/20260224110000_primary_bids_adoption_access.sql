-- Primary adoption: primaries see bids from customers owned by masters who adopted them
-- Fix: primaries were given "see all" but adoption model requires master_primaries check
-- Also restores master_technician to "see all" list (was accidentally omitted in 20260224100000)

-- ============================================================================
-- bids: adoption-based access for primaries
-- ============================================================================

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids" ON public.bids;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids" ON public.bids;

CREATE POLICY "Devs masters assistants estimators primaries can read bids"
ON public.bids
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
    OR (
      -- Primaries: see bids from customers owned by masters who adopted them
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'primary'
      )
      AND EXISTS (
        SELECT 1 FROM public.customers c
        JOIN public.master_primaries mp ON mp.master_id = c.master_user_id
        WHERE c.id = bids.customer_id
        AND mp.primary_id = auth.uid()
      )
    )
  )
);

-- ============================================================================
-- bids_gc_builders: adoption for primaries (needed for bid display)
-- ============================================================================

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids gc builders" ON public.bids_gc_builders;

CREATE POLICY "Devs masters assistants estimators primaries can read bids gc builders"
ON public.bids_gc_builders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'primary'
    )
  )
);

-- ============================================================================
-- bids_submission_entries: adoption for primaries
-- ============================================================================

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids submission entries" ON public.bids_submission_entries;

CREATE POLICY "Devs masters assistants estimators primaries can read bids submission entries"
ON public.bids_submission_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
          AND role = 'primary'
        )
        AND EXISTS (
          SELECT 1 FROM public.customers c
          JOIN public.master_primaries mp ON mp.master_id = c.master_user_id
          WHERE c.id = b.customer_id
          AND mp.primary_id = auth.uid()
        )
      )
    )
  )
);

-- ============================================================================
-- customers: primaries see only customers from masters who adopted them
-- (replaces "primaries see all" from 20260224100000)
-- ============================================================================

DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them or shared with them" ON public.customers;

CREATE POLICY "Users can see their own customers or customers from masters who adopted them or shared with them"
ON public.customers
FOR SELECT
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'estimator'
  )
  OR (
    -- Primaries: only customers from masters who adopted them
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'primary'
    )
    AND EXISTS (
      SELECT 1 FROM public.master_primaries
      WHERE master_id = master_user_id
      AND primary_id = auth.uid()
    )
  )
);
