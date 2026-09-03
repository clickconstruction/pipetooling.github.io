SET lock_timeout = '3s';

-- Wheels on Labor PR 1 (v2.2733): each person's vehicle arrangement decides
-- where fuel and truck cost land on People → Review.
--   none          — rides along / office; nothing changes for them
--   own_fuel_paid — drives their own vehicle, the company pays fuel → fuel is
--                   part of that person's labor cost
--   company       — drives a company truck (holder in vehicle_possessions) →
--                   fuel + insurance + registration + service per field hour
-- vehicle_rate_override: a manual $/field-hour figure that replaces the
-- computed rate when set (NULL = computed from the trailing 90 days).

ALTER TABLE public.people_pay_config
  ADD COLUMN IF NOT EXISTS vehicle_arrangement text NOT NULL DEFAULT 'none';

ALTER TABLE public.people_pay_config
  ADD COLUMN IF NOT EXISTS vehicle_rate_override numeric(8,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'people_pay_config_vehicle_arrangement_check'
  ) THEN
    ALTER TABLE public.people_pay_config
      ADD CONSTRAINT people_pay_config_vehicle_arrangement_check
      CHECK (vehicle_arrangement IN ('none', 'own_fuel_paid', 'company'));
  END IF;
END $$;

COMMENT ON COLUMN public.people_pay_config.vehicle_arrangement IS
  'none | own_fuel_paid (own vehicle, company pays fuel → labor) | company (company truck → per-field-hour Wheels line). v2.2733';
COMMENT ON COLUMN public.people_pay_config.vehicle_rate_override IS
  'Manual $/field hour that replaces the computed vehicle rate when set. v2.2733';
