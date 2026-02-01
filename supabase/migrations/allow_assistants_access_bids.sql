-- Allow assistants full access to Bids (same as Materials)
-- Updates all RLS policies for bids-related tables to include 'assistant' role

-- ============================================================================
-- bids_gc_builders
-- ============================================================================

DROP POLICY IF EXISTS "Devs and masters can read bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs and masters can insert bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs and masters can update bids gc builders" ON public.bids_gc_builders;
DROP POLICY IF EXISTS "Devs and masters can delete bids gc builders" ON public.bids_gc_builders;

CREATE POLICY "Devs, masters, and assistants can read bids gc builders"
ON public.bids_gc_builders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert bids gc builders"
ON public.bids_gc_builders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, and assistants can update bids gc builders"
ON public.bids_gc_builders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete bids gc builders"
ON public.bids_gc_builders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

-- ============================================================================
-- bids
-- Assistants should see all bids (like devs)
-- ============================================================================

DROP POLICY IF EXISTS "Devs and masters can read bids" ON public.bids;
DROP POLICY IF EXISTS "Devs and masters can insert bids" ON public.bids;
DROP POLICY IF EXISTS "Devs and masters can update bids" ON public.bids;
DROP POLICY IF EXISTS "Devs and masters can delete bids" ON public.bids;

CREATE POLICY "Devs, masters, and assistants can read bids"
ON public.bids
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert bids"
ON public.bids
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, and assistants can update bids"
ON public.bids
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete bids"
ON public.bids
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant')
    )
  )
);

-- ============================================================================
-- bids_count_rows
-- ============================================================================

DROP POLICY IF EXISTS "Devs and masters can read bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs and masters can insert bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs and masters can update bids count rows" ON public.bids_count_rows;
DROP POLICY IF EXISTS "Devs and masters can delete bids count rows" ON public.bids_count_rows;

CREATE POLICY "Devs, masters, and assistants can read bids count rows"
ON public.bids_count_rows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert bids count rows"
ON public.bids_count_rows
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can update bids count rows"
ON public.bids_count_rows
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete bids count rows"
ON public.bids_count_rows
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_count_rows.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

-- ============================================================================
-- bids_submission_entries
-- ============================================================================

DROP POLICY IF EXISTS "Devs and masters can read bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs and masters can insert bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs and masters can update bids submission entries" ON public.bids_submission_entries;
DROP POLICY IF EXISTS "Devs and masters can delete bids submission entries" ON public.bids_submission_entries;

CREATE POLICY "Devs, masters, and assistants can read bids submission entries"
ON public.bids_submission_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert bids submission entries"
ON public.bids_submission_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can update bids submission entries"
ON public.bids_submission_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, and assistants can delete bids submission entries"
ON public.bids_submission_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bids_submission_entries.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant')
      )
    )
  )
);
