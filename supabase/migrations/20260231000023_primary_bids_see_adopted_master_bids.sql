-- Primary Bid Board: primaries see bids from adopted masters
-- Fix: Trace (Primary) could see Bid Board tab but no bids
-- Adds paths: (1) bids created by adopting master, (2) bids with gc_builder from adopting master

DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids" ON public.bids;

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
      -- Primaries: see bids from adopted masters
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'primary'
      )
      AND (
        -- Path 1: bid's customer owned by master who adopted primary
        EXISTS (
          SELECT 1 FROM public.customers c
          JOIN public.master_primaries mp ON mp.master_id = c.master_user_id
          WHERE c.id = bids.customer_id
          AND mp.primary_id = auth.uid()
        )
        -- Path 2: bid created by master who adopted primary
        OR EXISTS (
          SELECT 1 FROM public.master_primaries mp
          WHERE mp.master_id = bids.created_by
          AND mp.primary_id = auth.uid()
        )
        -- Path 3: bid has gc_builder created by master who adopted primary
        OR (
          bids.gc_builder_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.bids_gc_builders bgb
            JOIN public.master_primaries mp ON mp.master_id = bgb.created_by
            WHERE bgb.id = bids.gc_builder_id
            AND mp.primary_id = auth.uid()
          )
        )
      )
    )
  )
);

-- bids_submission_entries: align with bids policy (add paths 2 and 3)
DROP POLICY IF EXISTS "Devs masters assistants estimators primaries can read bids submission entries" ON public.bids_submission_entries;

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
        AND (
          EXISTS (
            SELECT 1 FROM public.customers c
            JOIN public.master_primaries mp ON mp.master_id = c.master_user_id
            WHERE c.id = b.customer_id
            AND mp.primary_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.master_primaries mp
            WHERE mp.master_id = b.created_by
            AND mp.primary_id = auth.uid()
          )
          OR (
            b.gc_builder_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.bids_gc_builders bgb
              JOIN public.master_primaries mp ON mp.master_id = bgb.created_by
              WHERE bgb.id = b.gc_builder_id
              AND mp.primary_id = auth.uid()
            )
          )
        )
      )
    )
  )
);
