# 20260903030000_fix_count_pending_approvals_gate.sql (2026-09-03, v2.2672)

Re-creates `count_pending_clock_session_approvals()` (from `20260903020000`) with the live role helpers: `is_dev() OR is_pay_approved_master() OR is_assistant()`. The original gate referenced `is_assistant_of_pay_approved_master()`, dropped by `20260714200000_dissolve_assistant_pay_linkage.sql`, so the RPC errored on every call (client failed soft — card just never showed). Body otherwise identical.
