-- Primary role: SELECT-only access to Bids Bid Board
-- Primaries can view the Bid Board tab (bids list) but not edit or access other tabs

-- ============================================================================
-- bids_gc_builders: add primary to SELECT
-- ============================================================================

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
      AND role IN ('dev', 'assistant', 'estimator', 'primary')
    )
  )
);

-- ============================================================================
-- bids: add primary to SELECT
-- ============================================================================

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
      AND role IN ('dev', 'assistant', 'estimator', 'primary')
    )
  )
);

-- ============================================================================
-- bids_submission_entries: add primary to SELECT (for Last Contact in Bid Board)
-- ============================================================================

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
        AND role IN ('dev', 'assistant', 'estimator', 'primary')
      )
    )
  )
);

-- ============================================================================
-- customers: add primary to SELECT (for GC/Builder display in Bid Board)
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
    AND role IN ('estimator', 'primary')
  )
);
