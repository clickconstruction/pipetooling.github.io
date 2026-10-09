SET lock_timeout = '3s';

-- Signed-out callers reach only the functions granted to anon by name (v2.5040; the owner's call of 2026-10-09,
-- sent by Punchlist). The evidence is the bed in docs/migrations/20261010027000_revoke_anon_function_execute.md.
--
-- Until now Supabase's defaults gave every new public function EXECUTE for PUBLIC and for anon, so the publishable
-- key could call 524 of the 868 public functions. A signed-out page calls one: /hazmat-notice's
-- get_hazmat_notice_by_token. Everything else a public page reads goes through an edge function with the service
-- role, which keeps its own grant on every function. Grants and default privileges only: no table or row changes,
-- and a second run changes nothing.

-- 1. Take EXECUTE on every public function from PUBLIC and anon. authenticated and service_role keep their own
--    grants. authenticated loses exactly two, sync_controller_banking_attributors() and its trigger function, which
--    20260804100000 meant to keep from it; the statement trigger on users still fires.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- 2. New functions start the same way. PUBLIC's EXECUTE is a global default, so its revoke covers every schema
--    postgres creates a function in. public's own default still grants authenticated and service_role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 3. What anon keeps, by name (docs/ACCESS_CONTROL.md → SECURITY DEFINER RPCs and the anon key).
GRANT EXECUTE ON FUNCTION public.get_hazmat_notice_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.list_my_contract_dashboard_prompts() TO anon;

-- 4. The two database agent roles reached these policy helpers only through PUBLIC, and their reads and writes
--    evaluate them: cost_agent's jobs_ledger reads meet the restrictive primary fences, and hr_agent's person_reports
--    read and its HR writes meet is_dev and the read-only and twin fences.
GRANT EXECUTE ON FUNCTION public.is_primary() TO cost_agent;
GRANT EXECUTE ON FUNCTION public.primary_can_access_job(uuid) TO cost_agent;
GRANT EXECUTE ON FUNCTION public.is_dev() TO hr_agent;
GRANT EXECUTE ON FUNCTION public.is_digital_twin() TO hr_agent;
GRANT EXECUTE ON FUNCTION public.is_read_only() TO hr_agent;
