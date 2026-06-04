-- Primaries: full unrestricted access to bids (same as estimators)
-- Remove adoption-based restrictions; primaries see all bids and have full CRUD

-- ============================================================================
-- can_access_bid_for_pricing: add primary and master_technician
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_access_bid_for_pricing(bid_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  bid_created_by UUID;
  user_role_val TEXT;
BEGIN
  SELECT b.created_by, u.role
  INTO bid_created_by, user_role_val
  FROM public.bids b
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE b.id = bid_id_param;

  IF bid_created_by IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    bid_created_by = auth.uid()
    OR public.is_dev()
    OR user_role_val IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary')
  );
END;
$$;
COMMENT ON FUNCTION public.can_access_bid_for_pricing(UUID) IS 'Checks if the current user can access a bid for pricing (owner, dev, assistant, estimator, master, primary). Uses SECURITY DEFINER to optimize RLS.';

-- ============================================================================
-- bids: simplify SELECT (primaries see all), add primary to INSERT/UPDATE/DELETE
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids" ON public.bids;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries can read bids"
ON public.bids FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries can insert bids"
ON public.bids FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries can update bids"
ON public.bids FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries can delete bids"
ON public.bids FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
);

-- ============================================================================
-- bids_gc_builders: add primary to INSERT/UPDATE/DELETE (SELECT already has primary)
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries can read bids gc builders"
ON public.bids_gc_builders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries can insert bids gc builders"
ON public.bids_gc_builders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries can update bids gc builders"
ON public.bids_gc_builders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries can delete bids gc builders"
ON public.bids_gc_builders FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
  )
);

-- ============================================================================
-- bids_count_rows: add primary to all 4
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries can read bids count rows"
ON public.bids_count_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries can insert bids count rows"
ON public.bids_count_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries can update bids count rows"
ON public.bids_count_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries can delete bids count rows"
ON public.bids_count_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

-- ============================================================================
-- bids_submission_entries: simplify SELECT, add primary to INSERT/UPDATE/DELETE
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries can read bids submission entries"
ON public.bids_submission_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries can insert bids submission entries"
ON public.bids_submission_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries can update bids submission entries"
ON public.bids_submission_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries can delete bids submission entries"
ON public.bids_submission_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

-- ============================================================================
-- cost_estimates: add primary to all 4
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries can read cost estimates"
ON public.cost_estimates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries can insert cost estimates"
ON public.cost_estimates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries can update cost estimates"
ON public.cost_estimates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries can delete cost estimates"
ON public.cost_estimates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

-- ============================================================================
-- cost_estimate_labor_rows: add primary to all 4
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries can read cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries can update cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

-- ============================================================================
-- bids_takeoff_template_mappings: add primary to all 4
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read mappings" ON public.bids_takeoff_template_mappings;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert mappings" ON public.bids_takeoff_template_mappings;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update mappings" ON public.bids_takeoff_template_mappings;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete mappings" ON public.bids_takeoff_template_mappings;
CREATE POLICY "Devs masters assistants estimators primaries can read mappings"
ON public.bids_takeoff_template_mappings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);
CREATE POLICY "Devs masters assistants estimators primaries can insert mappings"
ON public.bids_takeoff_template_mappings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);
CREATE POLICY "Devs masters assistants estimators primaries can update mappings"
ON public.bids_takeoff_template_mappings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
CREATE POLICY "Devs masters assistants estimators primaries can delete mappings"
ON public.bids_takeoff_template_mappings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    )
  )
);

-- ============================================================================
-- bid_pricing_assignments: add primary (uses can_access_bid_for_pricing)
-- ============================================================================
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can read bid pricing assignments"
ON public.bid_pricing_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can insert bid pricing assignments"
ON public.bid_pricing_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can update bid pricing assignments"
ON public.bid_pricing_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
);
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries can delete bid pricing assignments"
ON public.bid_pricing_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

-- ============================================================================
-- bid_count_row_custom_prices: add primary
-- ============================================================================
DROP POLICY IF EXISTS "Bid pricing users can read custom prices" ON public.bid_count_row_custom_prices;
DROP POLICY IF EXISTS "Bid pricing users can insert custom prices" ON public.bid_count_row_custom_prices;
DROP POLICY IF EXISTS "Bid pricing users can update custom prices" ON public.bid_count_row_custom_prices;
DROP POLICY IF EXISTS "Bid pricing users can delete custom prices" ON public.bid_count_row_custom_prices;
CREATE POLICY "Bid pricing users can read custom prices"
ON public.bid_count_row_custom_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
CREATE POLICY "Bid pricing users can insert custom prices"
ON public.bid_count_row_custom_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
CREATE POLICY "Bid pricing users can update custom prices"
ON public.bid_count_row_custom_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);
CREATE POLICY "Bid pricing users can delete custom prices"
ON public.bid_count_row_custom_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary'))
  AND public.can_access_bid_for_pricing(bid_id)
);

-- ============================================================================
-- customers: primaries see all (like estimators) for New Bid GC picker
-- ============================================================================
DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them or shared with them" ON public.customers;
CREATE POLICY "Users can see their own customers or customers from masters who adopted them or shared with them"
ON public.customers FOR SELECT USING (
  master_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
  OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('estimator', 'primary'))
);
