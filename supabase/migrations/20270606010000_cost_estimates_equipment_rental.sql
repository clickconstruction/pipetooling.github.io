-- Equipment & Tool Rental direct cost, entered per stage on the Labor tab and
-- summed into the bid's direct costs on the Pricing tab. Nullable; null means $0.
ALTER TABLE public.cost_estimates
  ADD COLUMN IF NOT EXISTS equipment_rental_rough_in numeric,
  ADD COLUMN IF NOT EXISTS equipment_rental_top_out numeric,
  ADD COLUMN IF NOT EXISTS equipment_rental_trim_set numeric;
