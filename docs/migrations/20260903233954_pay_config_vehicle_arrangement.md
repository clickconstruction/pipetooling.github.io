# 20260903233954_pay_config_vehicle_arrangement.sql (v2.2733)

Wheels on Labor PR 1. Two additive columns on `people_pay_config`:

- `vehicle_arrangement text NOT NULL DEFAULT 'none'` with a CHECK on `none | own_fuel_paid | company`.
  - `none` — rides along / office; nothing changes.
  - `own_fuel_paid` — drives their own vehicle, the company pays fuel; fuel is part of that person's labor cost (Review wiring lands in PR 2).
  - `company` — drives a company truck (the holder in `vehicle_possessions`); fuel + insurance + registration + service per field hour.
- `vehicle_rate_override numeric(8,2)` — manual $/field hour that replaces the computed rate when set; NULL = computed from the trailing 90 days.

Idempotent (`ADD COLUMN IF NOT EXISTS`, constraint guarded by `pg_constraint`). No new table, so the read-only policy re-apply calls are not needed. Existing RLS on `people_pay_config` (pay-gated) covers both columns.
