-- Add price confirmation tracking to purchase_order_items table

ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS price_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS price_confirmed_by UUID REFERENCES public.users(id);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_price_confirmed_at ON public.purchase_order_items(price_confirmed_at);

-- Add comment
COMMENT ON COLUMN public.purchase_order_items.price_confirmed_at IS 'Timestamp when the price was confirmed by calling the supply house. Used to track price verification workflow.';
COMMENT ON COLUMN public.purchase_order_items.price_confirmed_by IS 'User who confirmed the price with the supply house.';

-- Policy: Assistants can update price confirmation fields for any purchase order
CREATE POLICY "Assistants can update price confirmation"
ON public.purchase_order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'assistant'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'assistant'
  )
  -- Only allow updating price_confirmed_at and price_confirmed_by
  -- This is enforced by only allowing these fields to be updated in the application code
);
