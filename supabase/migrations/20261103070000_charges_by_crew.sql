SET lock_timeout = '3s';

-- Charges by crew (punch list #254, PR 1, v2.6441, stamp 20261103070000): a person's standing when a crew is priced, the rate card's rows
-- in app_settings, the markup on materials, and a job's rule for how its labor is charged. Additive and idempotent.

-- 1. A person's standing: master, tech, helper, or none (never charged). Null reads as none.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS charge_standing text;
COMMENT ON COLUMN public.users.charge_standing IS
  'What this person counts as when a crew''s hour is priced: master, tech, helper, or none (never charged to a customer). Null reads as none. Punch list #254.';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_charge_standing_check') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_charge_standing_check
      CHECK (charge_standing IS NULL OR charge_standing IN ('master', 'tech', 'helper', 'none')) NOT VALID;
  END IF;
END $$;

-- 2. A job's rule: the crew on each day (crew, the default when null), one shape throughout (shape + charge_shape),
--    or a flat rate for every hour (flat, the rate in the existing hourly_charge_rate). Plus the job's own markup.
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS charge_rule text,
  ADD COLUMN IF NOT EXISTS charge_shape text,
  ADD COLUMN IF NOT EXISTS materials_markup_pct numeric;
COMMENT ON COLUMN public.jobs_ledger.charge_rule IS
  'How this job''s labor is charged: crew (the crew on each day from the rate card; null reads as crew), shape (charge_shape throughout), or flat (hourly_charge_rate for every hour). Punch list #254.';
COMMENT ON COLUMN public.jobs_ledger.charge_shape IS
  'The crew shape every day of this job is charged as when charge_rule is shape: master_helper, two_techs, master_alone, tech_alone, two_helpers, helper_alone.';
COMMENT ON COLUMN public.jobs_ledger.materials_markup_pct IS
  'This job''s markup on materials, percent over cost; null means the company''s (app_settings.materials_markup_pct_v1).';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_charge_rule_check') THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_charge_rule_check
      CHECK (charge_rule IS NULL OR charge_rule IN ('crew', 'shape', 'flat')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_charge_shape_check') THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_charge_shape_check
      CHECK (charge_shape IS NULL OR charge_shape IN ('master_helper', 'two_techs', 'master_alone', 'tech_alone', 'two_helpers', 'helper_alone')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_materials_markup_pct_check') THEN
    ALTER TABLE public.jobs_ledger
      ADD CONSTRAINT jobs_ledger_materials_markup_pct_check
      CHECK (materials_markup_pct IS NULL OR materials_markup_pct >= 0) NOT VALID;
  END IF;
END $$;

-- 3. The rate card's rows the owner gave (2026-11-03). The master-with-a-helper row is the v2.6431 key, seeded by its
--    own migration and repeated here so either order leaves one row. The rows for a master alone, two helpers and each
--    person beyond two are the owner's to set, as is the markup on materials: nothing is seeded for them, and the
--    kernels say so instead of pricing.
INSERT INTO public.app_settings (key, value_num) VALUES
  ('hourly_charge_rate_v1', 285),
  ('charge_rate_two_techs_v1', 285),
  ('charge_rate_tech_alone_v1', 185),
  ('charge_rate_helper_alone_v1', 75)
ON CONFLICT (key) DO NOTHING;
