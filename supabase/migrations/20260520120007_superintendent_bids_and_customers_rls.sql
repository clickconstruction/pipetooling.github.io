-- Superintendent: Bids and Customers RLS (adoption-based)
-- Superintendent can draft bids (Bid Board, Counts, Takeoff, Cost Estimate, RFI, Change Order, Lien Release)
-- Create customers from Bids modal only (like estimator)

-- ============================================================================
-- can_access_bid_for_pricing: add superintendent with adoption
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_access_bid_for_pricing(bid_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  bid_rec RECORD;
  user_role_val TEXT;
BEGIN
  SELECT b.created_by, b.customer_id, b.gc_builder_id
  INTO bid_rec
  FROM public.bids b
  WHERE b.id = bid_id_param;

  IF bid_rec.created_by IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  IF bid_rec.created_by = auth.uid() THEN
    RETURN true;
  END IF;
  IF user_role_val IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary') THEN
    RETURN true;
  END IF;
  IF user_role_val = 'superintendent' THEN
    IF bid_rec.created_by = auth.uid() THEN
      RETURN true;
    END IF;
    IF bid_rec.customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.master_superintendents ms ON ms.master_id = c.master_user_id AND ms.superintendent_id = auth.uid()
      WHERE c.id = bid_rec.customer_id
    ) THEN
      RETURN true;
    END IF;
    IF EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = bid_rec.created_by AND ms.superintendent_id = auth.uid()) THEN
      RETURN true;
    END IF;
    IF bid_rec.gc_builder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids_gc_builders bgb
      JOIN public.master_superintendents ms ON ms.master_id = bgb.created_by AND ms.superintendent_id = auth.uid()
      WHERE bgb.id = bid_rec.gc_builder_id
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;
COMMENT ON FUNCTION public.can_access_bid_for_pricing(UUID) IS 'Checks if the current user can access a bid (owner, dev, assistant, estimator, master, primary, or superintendent via adoption).';

-- ============================================================================
-- Helper: superintendent can access bid (for inline policy use)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.superintendent_can_access_bid(b public.bids)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND (
    b.created_by = auth.uid()
    OR (b.customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.master_superintendents ms ON ms.master_id = c.master_user_id AND ms.superintendent_id = auth.uid()
      WHERE c.id = b.customer_id
    ))
    OR EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = b.created_by AND ms.superintendent_id = auth.uid())
    OR (b.gc_builder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids_gc_builders bgb
      JOIN public.master_superintendents ms ON ms.master_id = bgb.created_by AND ms.superintendent_id = auth.uid()
      WHERE bgb.id = b.gc_builder_id
    ))
  );
$$;

-- ============================================================================
-- bids: add superintendent (adoption-based)
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read bids"
ON public.bids FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR public.superintendent_can_access_bid(bids)
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert bids"
ON public.bids FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update bids"
ON public.bids FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR public.superintendent_can_access_bid(bids)
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bids" ON public.bids;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete bids"
ON public.bids FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR public.superintendent_can_access_bid(bids)
  )
);

-- ============================================================================
-- bids_gc_builders: add superintendent
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read bids gc builders"
ON public.bids_gc_builders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = created_by AND ms.superintendent_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert bids gc builders"
ON public.bids_gc_builders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update bids gc builders"
ON public.bids_gc_builders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = created_by AND ms.superintendent_id = auth.uid())
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bids gc builders" ON public.bids_gc_builders;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete bids gc builders"
ON public.bids_gc_builders FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
    OR EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = created_by AND ms.superintendent_id = auth.uid())
  )
);

-- ============================================================================
-- bids_count_rows, bids_submission_entries, cost_estimates, etc: add superintendent
-- Uses can_access_bid_for_pricing or bid access check
-- ============================================================================
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read bids count rows"
ON public.bids_count_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert bids count rows"
ON public.bids_count_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update bids count rows"
ON public.bids_count_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bids count rows" ON public.bids_count_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete bids count rows"
ON public.bids_count_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

-- bids_submission_entries
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read bids submission entries"
ON public.bids_submission_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert bids submission entries"
ON public.bids_submission_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update bids submission entries"
ON public.bids_submission_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bids submission entries" ON public.bids_submission_entries;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete bids submission entries"
ON public.bids_submission_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

-- cost_estimates, cost_estimate_labor_rows, bids_takeoff_template_mappings
-- bid_pricing_assignments, bid_count_row_custom_prices use can_access_bid_for_pricing
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimates"
ON public.cost_estimates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimates"
ON public.cost_estimates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimates"
ON public.cost_estimates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete cost estimates" ON public.cost_estimates;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimates"
ON public.cost_estimates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

-- cost_estimate_labor_rows
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

-- bids_takeoff_template_mappings
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read mappings" ON public.bids_takeoff_template_mappings;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read mappings"
ON public.bids_takeoff_template_mappings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert mappings" ON public.bids_takeoff_template_mappings;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert mappings"
ON public.bids_takeoff_template_mappings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update mappings" ON public.bids_takeoff_template_mappings;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update mappings"
ON public.bids_takeoff_template_mappings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete mappings" ON public.bids_takeoff_template_mappings;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete mappings"
ON public.bids_takeoff_template_mappings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_takeoff_template_mappings.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary'))
      OR public.superintendent_can_access_bid(b)
    )
  )
);

-- bid_pricing_assignments, bid_count_row_custom_prices (use can_access_bid_for_pricing)
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can read bid pricing assignments"
ON public.bid_pricing_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can insert bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can insert bid pricing assignments"
ON public.bid_pricing_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can update bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can update bid pricing assignments"
ON public.bid_pricing_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
);
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can delete bid pricing assignments" ON public.bid_pricing_assignments;
CREATE POLICY "Devs masters assistants estimators primaries superintendents can delete bid pricing assignments"
ON public.bid_pricing_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);

DROP POLICY IF EXISTS "Bid pricing users can read custom prices" ON public.bid_count_row_custom_prices;
CREATE POLICY "Bid pricing users can read custom prices"
ON public.bid_count_row_custom_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Bid pricing users can insert custom prices" ON public.bid_count_row_custom_prices;
CREATE POLICY "Bid pricing users can insert custom prices"
ON public.bid_count_row_custom_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Bid pricing users can update custom prices" ON public.bid_count_row_custom_prices;
CREATE POLICY "Bid pricing users can update custom prices"
ON public.bid_count_row_custom_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);
DROP POLICY IF EXISTS "Bid pricing users can delete custom prices" ON public.bid_count_row_custom_prices;
CREATE POLICY "Bid pricing users can delete custom prices"
ON public.bid_count_row_custom_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator', 'primary', 'superintendent'))
  AND public.can_access_bid_for_pricing(bid_id)
);

-- ============================================================================
-- customers: superintendent SELECT and INSERT (for Bids modal, like estimator)
-- ============================================================================
DROP POLICY IF EXISTS "Users can see their own customers or customers from masters who adopted them or shared with them" ON public.customers;
CREATE POLICY "Users can see their own customers or customers from masters who adopted them or shared with them"
ON public.customers FOR SELECT USING (
  master_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
  OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = master_user_id AND assistant_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = master_user_id AND viewing_master_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('estimator', 'primary', 'superintendent'))
);

CREATE POLICY "Superintendents can insert customers when master is assigned"
ON public.customers
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
  AND master_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = master_user_id
    AND u.role IN ('master_technician', 'dev')
  )
  AND EXISTS (
    SELECT 1 FROM public.master_superintendents ms
    WHERE ms.master_id = master_user_id
    AND ms.superintendent_id = auth.uid()
  )
);