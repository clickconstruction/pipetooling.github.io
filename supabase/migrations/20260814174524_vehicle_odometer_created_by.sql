SET lock_timeout = '3s';

-- v2.1644 (Vehicles fleet phase 1): the vehicle ledger attributes odometer
-- readings ("entered by Danielle"), so entries gain a created_by. Nullable and
-- additive — legacy rows simply show without a name; old clients never select
-- or write the column. No RLS change (the existing pay-access manage policy
-- covers the new column).

ALTER TABLE public.vehicle_odometer_entries
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vehicle_odometer_entries.created_by IS
  'Who entered the reading (v2.1644). NULL on legacy rows and on writes from surfaces that predate attribution.';
