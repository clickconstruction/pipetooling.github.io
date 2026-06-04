-- Update report_enabled_users table comment to reflect new semantics:
-- Users in this table (subcontractors/estimators) can see Recent Reports on Dashboard.
COMMENT ON TABLE public.report_enabled_users IS 'Subcontractors/estimators who can see Recent Reports on Dashboard';
