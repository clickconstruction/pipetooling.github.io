-- Add monthly_payment_day to supply_houses for Due column in supply house list
ALTER TABLE public.supply_houses
ADD COLUMN monthly_payment_day INTEGER
CHECK (monthly_payment_day >= 1 AND monthly_payment_day <= 31);

COMMENT ON COLUMN public.supply_houses.monthly_payment_day IS
  'Day of month (1-31) when payment is typically due. Used for Due column in supply house list.';
