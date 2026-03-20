-- Add customer_type to customers (commercial vs residential)
-- Add customer_id to jobs_ledger to link residential job contacts to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type text
  CHECK (customer_type IS NULL OR customer_type IN ('commercial', 'residential'));

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
