# 20260906130000_tally_payroll_flag_payroll_access.sql (2026-09-06, v2.2946)

Journey map Tier 5 X3 (J7-9), train T5-03 — "Mark payroll" on the Job Parts Tally admitted to every payroll-access role.

- **`mercury_tally_payroll_flags` policy**: `dev_all_payroll_flags` (`is_dev()`) → `payroll_access_all_payroll_flags` (`has_payroll_access()`: dev, controller, pay-approved masters).
- **`set_tally_payroll_flag(uuid, boolean)`**: same body as `20260704140000`, authorization line `is_dev()` → `has_payroll_access()`. `CREATE OR REPLACE`, idempotent.
- Untouched, deliberately dev-only: `mercury_tally_payroll_rules` and `bulk_apply_tally_payroll_rule_flags` (auto-mark rules are configuration, not the weekly chore).

No new table → no read-only appliers needed (the existing restrictive read-only policies on the flags table stay attached). Apply order: either — the client gates the button on `usePeopleAccess().canAccessPay`, which the old policy would simply refuse with 42501 until this lands.
