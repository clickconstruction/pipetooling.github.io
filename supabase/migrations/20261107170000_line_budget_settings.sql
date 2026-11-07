SET lock_timeout = '3s';

-- The owner tunes (punch list #234, PR 1b): the company's line budget settings as one app_settings row —
-- the split a typed line gets until the owner tunes it, per stage kind (Rough In, Top Out, Trim Set, any
-- other line), the burdened cost rate the hours use, and the target margin the read-out marks. Until this
-- row the settings were constants in src/lib/jobs/lineBudgets.ts (v2.6300). Nothing on a job is stored
-- for an assumed line, so a change here moves every line still assumed and never a workbench line or
-- one the owner tuned.
--
--   app_settings.line_budget_settings_v1 — value_text is the JSON
--     { "rateUsd": 45, "targetMarginPct": 20, "splits": { "rough_in": [45, 35], "top_out": [45, 35], "trim_set": [40, 40], "any": [45, 35] } }
--   Written by the owner (dev · master technician) through a key-scoped UPDATE policy, the way the owner-
--   of-record switch is (20260914270000); every signed-in role reads it (the table's existing SELECT).
--
-- Additive, idempotent. docs/migrations/20261107170000_line_budget_settings.md.

INSERT INTO public.app_settings (key, value_text)
VALUES ('line_budget_settings_v1', '{"rateUsd":45,"targetMarginPct":20,"splits":{"rough_in":[45,35],"top_out":[45,35],"trim_set":[40,40],"any":[45,35]}}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_line_budget_settings" ON public.app_settings;
CREATE POLICY "master_or_dev_update_line_budget_settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'line_budget_settings_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'line_budget_settings_v1' AND public.is_master_or_dev());
