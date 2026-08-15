SET lock_timeout = '3s';

-- Vehicle trim (v2.1672, owner request): free-text trim level ("XLT",
-- "Lariat Crew Cab") edited on the Add/Edit vehicle dialog as its own row
-- above the VIN. Additive nullable column; idempotent.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS trim text;

COMMENT ON COLUMN public.vehicles.trim IS
  'Trim level / configuration ("XLT", "Lariat Crew Cab"). Optional free text shown beside the VIN on the open vehicle.';
