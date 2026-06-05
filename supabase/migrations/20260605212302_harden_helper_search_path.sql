-- Harden 4 SECURITY DEFINER helper functions that lacked a fixed search_path
-- (advisor `function_search_path_mutable`). Without a SET search_path, a SECURITY
-- DEFINER function inherits the caller's mutable search_path — a privilege-escalation
-- surface. Their sibling helpers (is_assistant, is_estimator, is_team_lead_for_person_name,
-- auth_uid_is_helpers_or_subcontractor) already use `search_path=public`; this matches them.
--
-- Body-preserving: `ALTER FUNCTION ... SET` only attaches the config, no logic change.
-- All four bodies reference only schema-qualified objects (public.*, auth.uid()), so
-- pinning search_path to `public` is safe. Idempotent / re-runnable.

ALTER FUNCTION public.is_dev() SET search_path = public;
ALTER FUNCTION public.is_pay_approved_master() SET search_path = public;
ALTER FUNCTION public.is_assistant_of_pay_approved_master() SET search_path = public;
ALTER FUNCTION public.is_cost_matrix_shared_with_current_user() SET search_path = public;
