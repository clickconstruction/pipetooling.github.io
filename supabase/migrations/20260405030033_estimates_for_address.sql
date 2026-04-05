-- Staff "For:" line on estimates: optional address override; null = use linked customer.address.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS for_address text;

COMMENT ON COLUMN public.estimates.for_address IS
  'Optional address for the estimate For line. NULL means use linked customers.address when customer_id is set.';
