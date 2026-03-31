-- Add finalized notes tracking to purchase_orders table

-- Add columns for tracking who added notes and when
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS notes_added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes_added_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_notes_added_by ON public.purchase_orders(notes_added_by);

-- Add comment
COMMENT ON COLUMN public.purchase_orders.notes_added_by IS 'User who added notes to a finalized purchase order. Only set when notes are added after finalization.';
COMMENT ON COLUMN public.purchase_orders.notes_added_at IS 'Timestamp when notes were added to a finalized purchase order.';

-- Create new RLS policy to allow updating notes fields on finalized POs (but only if notes is null)
-- This enforces add-only behavior: notes can only be added once
CREATE POLICY "Devs and masters can add notes to finalized purchase orders"
ON public.purchase_orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
  AND status = 'finalized'  -- Only finalized POs
  AND notes IS NULL  -- Only allow if notes is currently null (add-only)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'dev'
    )
  )
  AND status = 'finalized'
  AND notes IS NOT NULL  -- Must set notes (cannot be null after update)
  AND notes_added_by = auth.uid()  -- Must set notes_added_by to current user
  AND notes_added_at IS NOT NULL  -- Must set notes_added_at
);
