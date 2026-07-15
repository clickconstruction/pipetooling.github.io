-- Cost-matrix retirement, DB half (client half shipped first: matrix UI, person tags,
-- and the Sharing section are gone; nothing queries these tables or the shared-with flag).
--
-- Removes:
--   * the is_cost_matrix_shared_with_current_user() term from every RLS policy that
--     referenced it — each recreated body matches the CURRENT prod definition, i.e. the
--     20260605210913 / baseline bodies AFTER the 2026-07-14 generic rewrites
--     (is_assistant_of_pay_approved_master → is_assistant per 20260714200000, then
--     is_pay_approved_master → has_payroll_access per 20260714230000, duplicate
--     is_assistant() terms deduped) — so this only NARROWS access, never widens it;
--   * the three matrix-only tables (cost_matrix_teams_shares, people_cost_matrix_tags,
--     cost_matrix_tag_colors) — their own policies drop with them;
--   * the helper function itself.
--
-- Safety: the single existing share row belonged to a pay-approved master whose access
-- comes from pay approval, not the share. Future "see costs without admin" users get the
-- controller role instead (v2.662). Tags were confirmed unused before dropping.
--
-- Order matters: policies referencing the helper must go before DROP FUNCTION
-- (pg_depend), and the tags-table policy that references it dies via its DROP TABLE.

-- 1) Hot-table SELECT policies: same bodies minus the shared-with term.
DROP POLICY IF EXISTS "people_crew_bids select access" ON public.people_crew_bids;
CREATE POLICY "people_crew_bids select access" ON public.people_crew_bids FOR SELECT TO public
USING (
  ((select public.has_payroll_access()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

DROP POLICY IF EXISTS "people_crew_jobs select access" ON public.people_crew_jobs;
CREATE POLICY "people_crew_jobs select access" ON public.people_crew_jobs FOR SELECT TO public
USING (
  ((select public.has_payroll_access()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

DROP POLICY IF EXISTS "people_hours select access" ON public.people_hours;
CREATE POLICY "people_hours select access" ON public.people_hours FOR SELECT TO public
USING (
  ((select public.has_payroll_access()) OR (select public.is_assistant()))
  OR public.is_team_lead_for_person_name(person_name)
);

-- 2) Standalone shared-user grants: plain drops.
DROP POLICY IF EXISTS "Cost matrix shared users can read people pay config" ON public.people_pay_config;
DROP POLICY IF EXISTS "Cost matrix shared users can read people team members" ON public.people_team_members;
DROP POLICY IF EXISTS "Cost matrix shared users can read people teams" ON public.people_teams;

-- 3) common_jobs: recreate minus the term (renamed — "shared" no longer exists).
DROP POLICY IF EXISTS "Pay access and shared can read common jobs" ON public.common_jobs;
DROP POLICY IF EXISTS "Pay access can read common jobs" ON public.common_jobs;
CREATE POLICY "Pay access can read common jobs" ON public.common_jobs FOR SELECT
USING ((public.is_dev() OR public.has_payroll_access() OR public.is_assistant()));

-- 4) Matrix-only tables (policies on them, incl. the tag-read ones referencing the
--    helper, drop with the tables).
DROP TABLE IF EXISTS public.cost_matrix_teams_shares;
DROP TABLE IF EXISTS public.people_cost_matrix_tags;
DROP TABLE IF EXISTS public.cost_matrix_tag_colors;

-- 5) Helper + the grantee-check trigger function (its trigger died with the shares
--    table; v2.660/v2.663 created it) — nothing references either anymore.
DROP FUNCTION IF EXISTS public.is_cost_matrix_shared_with_current_user();
DROP FUNCTION IF EXISTS public.cost_matrix_share_grantee_role_check();
