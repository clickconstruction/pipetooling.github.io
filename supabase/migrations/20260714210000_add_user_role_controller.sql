-- Controller role, part 1 of 2 (Phase 3 of the pay-visibility overhaul; RECENT_FEATURES v2.662).
-- Enum values can't be added and used in the same transaction, so the ADD VALUE lives in its
-- own migration; 20260714213000 wires the capabilities.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'controller';
COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor, estimator, primary, superintendent, helpers, controller (assistant-like + dev-level financial visibility incl. Payroll)';
