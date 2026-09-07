SET lock_timeout = '3s';

-- v2.2976 — company_owner_user_id() must not answer the anon key.
-- 20260906190000 revoked PUBLIC and granted authenticated + service_role, but Supabase's
-- default privileges also grant EXECUTE to anon explicitly, so the publishable key could
-- read the company owner account id with no session (verified 2026-09-07: a bare
-- POST /rest/v1/rpc/company_owner_user_id returned the uuid). Rule from v2.2954:
-- no anonymous consumer → revoke anon in the same breath. Idempotent.
REVOKE EXECUTE ON FUNCTION public.company_owner_user_id() FROM PUBLIC, anon;
