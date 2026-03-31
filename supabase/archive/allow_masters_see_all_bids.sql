-- Allow master_technician to see all bids (same visibility as assistants and estimators).
-- Previously masters could only see bids they created; assistants/estimators could see all.
-- Fix: add master_technician to the row-level visibility clause in all bids-related policies.

-- ============================================================================
-- bids_gc_builders
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids gc builders" ON public.bids_gc_builders;

CREATE POLICY "Devs, masters, assistants, and estimators can read bids gc builders"
ON public.bids_gc_builders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bids gc builders"
ON public.bids_gc_builders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bids gc builders"
ON public.bids_gc_builders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bids gc builders"
ON public.bids_gc_builders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
);

-- ============================================================================
-- bids
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids" ON public.bids;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids" ON public.bids;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids" ON public.bids;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids" ON public.bids;

CREATE POLICY "Devs, masters, assistants, and estimators can read bids"
ON public.bids
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bids"
ON public.bids
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bids"
ON public.bids
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bids"
ON public.bids
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
    )
  )
);

-- ============================================================================
-- bids_count_rows
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids count rows" ON public.bids_count_rows;

CREATE POLICY "Devs, masters, assistants, and estimators can read bids count rows"
ON public.bids_count_rows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bids count rows"
ON public.bids_count_rows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bids count rows"
ON public.bids_count_rows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bids count rows"
ON public.bids_count_rows
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

-- ============================================================================
-- bids_submission_entries
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bids submission entries" ON public.bids_submission_entries;

CREATE POLICY "Devs, masters, assistants, and estimators can read bids submission entries"
ON public.bids_submission_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
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
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bids submission entries"
ON public.bids_submission_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
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
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bids submission entries"
ON public.bids_submission_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
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
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bids submission entries"
ON public.bids_submission_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
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
    )
  )
);

-- ============================================================================
-- cost_estimates
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimates" ON public.cost_estimates;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimates" ON public.cost_estimates;

CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimates"
ON public.cost_estimates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimates"
ON public.cost_estimates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimates"
ON public.cost_estimates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimates"
ON public.cost_estimates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = cost_estimates.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

-- ============================================================================
-- cost_estimate_labor_rows
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update cost estimate labor rows" ON public.cost_estimate_labor_rows;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete cost estimate labor rows" ON public.cost_estimate_labor_rows;

CREATE POLICY "Devs, masters, assistants, and estimators can read cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete cost estimate labor rows"
ON public.cost_estimate_labor_rows
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.cost_estimates ce
    JOIN public.bids b ON b.id = ce.bid_id
    WHERE ce.id = cost_estimate_labor_rows.cost_estimate_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

-- ============================================================================
-- bid_pricing_assignments
-- ============================================================================

DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can read bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can insert bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can update bid pricing assignments" ON public.bid_pricing_assignments;
DROP POLICY IF EXISTS "Devs, masters, assistants, and estimators can delete bid pricing assignments" ON public.bid_pricing_assignments;

CREATE POLICY "Devs, masters, assistants, and estimators can read bid pricing assignments"
ON public.bid_pricing_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bid pricing assignments"
ON public.bid_pricing_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bid pricing assignments"
ON public.bid_pricing_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bid pricing assignments"
ON public.bid_pricing_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator', 'master_technician')
      )
    )
  )
);
