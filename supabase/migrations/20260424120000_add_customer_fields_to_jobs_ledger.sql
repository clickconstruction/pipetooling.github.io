-- Add customer contact fields to jobs_ledger for New/Edit Job form.
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text;
