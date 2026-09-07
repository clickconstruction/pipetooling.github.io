SET lock_timeout = '3s';

-- v2.2967 — One company, Phase 1: ownership and adoption become inert at the helpers.
--
-- Will, 2026-09-06: "Instead of jobs being owned by people and assistants being adopted by
-- specific masters, tear down these walls. There are no job owners; assistants are just
-- assistants and masters are just masters. It is one company." Decisions the same day:
-- the company owner id lives in a settings row (never a hand-picked person); the
-- pay_approved_masters grant stays; superintendents and primaries stay walled; "master"
-- becomes "leader" in copy only. docs/ONE_COMPANY_PLAN.md has the phases.
--
-- This migration changes NO table, policy or grant. It re-creates the shared predicates so
-- every office role (dev, master, assistant, controller — public.is_office_staff(), v2.2950)
-- passes them, removes the three RPC/trigger guards that refused to cross owners, and seeds
-- the company owner row. The ~23 policies that compare master_user_id = auth.uid() inline
-- are Phase 2 (a mechanical sweep that merges alone).
--
-- Objects replaced (bodies otherwise verbatim from their last definition):
--   company_owner_user_id()                       NEW — the settings row, with fallbacks
--   master_adopted_current_user(uuid)             assistants branch → is_office_staff();
--                                                 primary / superintendent branches kept
--   assistants_share_master(uuid, uuid)           → is_office_staff()
--   can_see_sharing_master(uuid)                  → is_office_staff()
--   master_shared_current_user(uuid)              → is_office_staff()
--   can_access_project_row(uuid) / (uuid,uuid,uuid)
--   can_access_project(uuid), can_access_project_via_step(uuid),
--   can_access_step_for_action(uuid)              office → true; superintendent (assigned
--                                                 only, v2.2836), primary (master_primaries),
--                                                 owner and assignee branches kept verbatim
--   user_can_access_estimate(estimates)           office → true; created_by / primary /
--                                                 project branches kept
--   jobs_ledger_project_master_match_fn()         no-op (was: job owner = project owner)
--   jobs_ledger_customer_master_match_fn()        no-op (was: job owner = customer owner)
--   jobs_ledger_gc_customer_master_match_fn()     no-op (was: job owner = GC owner)
--   create_job_from_estimate (both overloads)     'customer does not belong to job owner'
--                                                 removed; new jobs stamp company_owner_user_id()
--   apply_estimate_to_job                         'job belongs to a different owner than the
--                                                 estimate' removed
--
-- Deliberately NOT changed: the customer→projects / →jobs cascades (harmless, fire only when
-- a customer's master changes, which the client stops doing in Phase 3); customers_master_role_check
-- (customer owner must be a master/dev account — still true of the company owner row);
-- people_labels / user_labels master scoping; the estimator immutable-fields guard; every
-- superintendent / primary / helpers / subcontractor / customer-side branch.
--
-- Rollback: the previous bodies live in 20250101000000_baseline.sql, 20260905100000,
-- 20260810200050, 20260820030000, 20260630200000 and 20260731205835.

-- 1) The company owner row ------------------------------------------------------------

-- Seed: the org-wide job_owner_override_default if one is set, else the single
-- master_technician. Left unset when neither exists (company_owner_user_id() then returns
-- NULL and the old per-user chain still runs). ON CONFLICT DO NOTHING: never overwrites a
-- value the office has chosen.
INSERT INTO public.app_settings (key, value_text)
SELECT 'company_owner_user_id', v.id::text
FROM (
  SELECT COALESCE(
    (SELECT NULLIF(trim(s.value_text), '')::uuid FROM public.app_settings s WHERE s.key = 'job_owner_override_default'),
    (SELECT u.id FROM public.users u WHERE u.role = 'master_technician' AND u.archived_at IS NULL
       AND (SELECT count(*) FROM public.users x WHERE x.role = 'master_technician' AND x.archived_at IS NULL) = 1)
  ) AS id
) v
WHERE v.id IS NOT NULL
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.company_owner_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(trim(s.value_text), '')::uuid FROM public.app_settings s WHERE s.key = 'company_owner_user_id'),
    (SELECT NULLIF(trim(s.value_text), '')::uuid FROM public.app_settings s WHERE s.key = 'job_owner_override_default'),
    (SELECT u.id FROM public.users u WHERE u.role = 'master_technician' AND u.archived_at IS NULL
       AND (SELECT count(*) FROM public.users x WHERE x.role = 'master_technician' AND x.archived_at IS NULL) = 1)
  );
$$;

COMMENT ON FUNCTION public.company_owner_user_id() IS
  'One company (v2.2967): the account every new customer / project / job / estimate is stamped with (master_user_id). Reads app_settings.company_owner_user_id; falls back to job_owner_override_default, then the single master_technician; NULL when none. A settings row, never a hand-picked person — change it at Settings → Jobs & dispatch.';

REVOKE ALL ON FUNCTION public.company_owner_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_owner_user_id() TO authenticated, service_role;

-- 2) Adoption / sharing predicates -----------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."master_adopted_current_user"("master_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_office_staff()
  OR EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = master_adopted_current_user.master_user_id AND primary_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = master_adopted_current_user.master_user_id AND superintendent_id = auth.uid());
$$;

COMMENT ON FUNCTION "public"."master_adopted_current_user"("master_user_id" "uuid") IS
  'One company (v2.2967): true for every office role (is_office_staff) — assistants are no longer adopted per master. Primary and superintendent branches (master_primaries / master_superintendents, company-wide via v2.921 sync) kept so the users SELECT policy still shows them the office accounts; the project helpers branch on role before consulting this (v2.2836). SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION "public"."assistants_share_master"("assistant_a" "uuid", "assistant_b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_office_staff();
$$;

COMMENT ON FUNCTION "public"."assistants_share_master"("assistant_a" "uuid", "assistant_b" "uuid") IS
  'One company (v2.2967): always true for office roles — master_assistants is no longer consulted. Arguments kept for the policies that still pass them.';

CREATE OR REPLACE FUNCTION "public"."can_see_sharing_master"("sharing_master_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_office_staff();
$$;

COMMENT ON FUNCTION "public"."can_see_sharing_master"("sharing_master_id" "uuid") IS
  'One company (v2.2967): always true for office roles — master_shares is no longer consulted.';

CREATE OR REPLACE FUNCTION "public"."master_shared_current_user"("sharing_master_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_office_staff();
$$;

COMMENT ON FUNCTION "public"."master_shared_current_user"("sharing_master_id" "uuid") IS
  'One company (v2.2967): always true for office roles — master_shares is no longer consulted.';

-- 3) Project access helpers ------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."can_access_project_row"("project_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  proj_master_id UUID;
  proj_customer_id UUID;
  cust_master_id UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.master_user_id, p.customer_id
  INTO proj_master_id, proj_customer_id
  FROM public.projects p
  WHERE p.id = project_id_param;

  IF proj_master_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  -- Superintendents: ONLY project-level assignment (project_superintendents), NOT adoption
  IF user_role_val = 'superintendent' THEN
    RETURN EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = project_id_param AND superintendent_id = auth.uid());
  END IF;

  -- One company (v2.2967): every office role reaches every project.
  IF proj_master_id = auth.uid() OR public.is_office_staff() THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = proj_master_id AND primary_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Access via customer: if project has customer_id, check customer access
  IF proj_customer_id IS NOT NULL THEN
    SELECT master_user_id INTO cust_master_id FROM public.customers WHERE id = proj_customer_id;
    IF cust_master_id IS NOT NULL THEN
      IF cust_master_id = auth.uid() THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = cust_master_id AND primary_id = auth.uid()) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION "public"."can_access_project_row"("project_id_param" "uuid") IS
  'Checks if the current user can access a project. Superintendents: assigned projects only (project_superintendents). Office roles: every project (one company, v2.2967). Primaries: master_primaries. SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION public.can_access_project_row(project_id_param uuid, proj_master_id uuid, proj_customer_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cust_master_id UUID;
  user_role_val TEXT;
BEGIN
  IF proj_master_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  -- Superintendents: ONLY project-level assignment (project_superintendents), NOT adoption.
  -- Mirrors the 1-arg overload (2026-06-23). The helper is SECURITY DEFINER, so
  -- project_superintendents RLS (which calls can_access_project_row) cannot recurse.
  IF user_role_val = 'superintendent' THEN
    RETURN public.user_assigned_to_project_as_superintendent(project_id_param);
  END IF;

  -- One company (v2.2967): every office role reaches every project.
  IF proj_master_id = auth.uid() OR public.is_office_staff() THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = proj_master_id AND primary_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- Project-level assignment for any other role that holds a project_superintendents row
  -- (kept verbatim so non-superintendent behavior is unchanged).
  IF public.user_assigned_to_project_as_superintendent(project_id_param) THEN
    RETURN true;
  END IF;

  -- Access via customer: if project has customer_id, check customer access
  IF proj_customer_id IS NOT NULL THEN
    SELECT master_user_id INTO cust_master_id FROM public.customers WHERE id = proj_customer_id;
    IF cust_master_id IS NOT NULL THEN
      IF cust_master_id = auth.uid() THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = cust_master_id AND primary_id = auth.uid()) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_project_row(uuid, uuid, uuid) IS
  'Checks project access using passed master_user_id and customer_id. Used by projects RLS to avoid recursion (no projects table read). Superintendents: assigned projects only (project_superintendents), never adoption (v2.2836). Office roles: every project (one company, v2.2967). Primaries: master_primaries.';

CREATE OR REPLACE FUNCTION public.can_access_project(project_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_master_id UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.master_user_id, u.role
  INTO project_master_id, user_role_val
  FROM public.projects p
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE p.id = project_id_param;

  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    project_master_id = auth.uid()
    OR public.is_office_staff()
    -- Superintendents: assigned projects only (v2.2836) — never the adoption tables.
    OR (user_role_val = 'superintendent' AND public.can_access_project_row(project_id_param))
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(project_master_id))
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project(uuid) IS
  'Checks if the current user can access a project (office roles: all, one company v2.2967; primaries via master_primaries; superintendents: assigned projects only, v2.2836). Uses SECURITY DEFINER to optimize RLS.';

CREATE OR REPLACE FUNCTION public.can_access_project_via_step(step_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_id_val UUID;
  project_master_id_val UUID;
  user_role_val TEXT;
BEGIN
  SELECT p.id, p.master_user_id, u.role
  INTO project_id_val, project_master_id_val, user_role_val
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;

  IF project_master_id_val IS NULL THEN
    RETURN false;
  END IF;

  RETURN (
    project_master_id_val = auth.uid()
    OR public.is_office_staff()
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(project_master_id_val))
    OR (
      user_role_val = 'superintendent'
      AND project_id_val IS NOT NULL
      AND public.can_access_project_row(project_id_val)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_step(uuid) IS
  'Checks if the current user can access a project via a workflow step. Office roles: all (one company, v2.2967). Superintendents: assigned projects only via can_access_project_row (v2.2836). Uses SECURITY DEFINER.';

CREATE OR REPLACE FUNCTION public.can_access_step_for_action(step_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_id_val UUID;
  project_master_id UUID;
  user_role_val TEXT;
  user_name_val TEXT;
  step_assigned_to TEXT;
  step_person_id UUID;
BEGIN
  -- Get step and project info, plus user info in one query
  SELECT p.id, p.master_user_id, u.role, u.name, s.assigned_to_name, s.assigned_person_id
  INTO project_id_val, project_master_id, user_role_val, user_name_val, step_assigned_to, step_person_id
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;

  -- If no step found, return false
  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check access: office role (one company) OR primary via master_primaries (not superintendents)
  -- OR a superintendent assigned to the project OR the step assignee
  RETURN (
    project_master_id = auth.uid()
    OR public.is_office_staff()
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(project_master_id))
    OR (user_role_val = 'superintendent' AND public.can_access_project_row(project_id_val))
    OR (
      user_role_val IN ('assistant', 'subcontractor')
      AND (
        (
          step_assigned_to IS NOT NULL
          AND user_name_val IS NOT NULL
          AND LOWER(TRIM(user_name_val)) = LOWER(TRIM(step_assigned_to))
        )
        OR (
          step_person_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.people pp
            WHERE pp.id = step_person_id AND pp.account_user_id = auth.uid()
          )
        )
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_step_for_action(uuid) IS
  'Step-action access: office roles (one company, v2.2967), primaries via master_primaries, superintendents on their assigned projects only (v2.2836), or the assignee (id first, name fallback). SECURITY DEFINER.';

-- 4) Estimates ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."user_can_access_estimate"("e" "public"."estimates") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    public.is_office_staff()
    OR e.created_by = auth.uid()
    OR e.master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR (
      e.project_id IS NOT NULL
      AND public.can_access_project_row(e.project_id)
    );
$$;

COMMENT ON FUNCTION "public"."user_can_access_estimate"("e" "public"."estimates") IS
  'One company (v2.2967): office roles reach every estimate; estimators their own (created_by); primaries all; anyone with project access. The master_assistants / assistants_share_master branches are gone.';

-- 5) Owner-equality guards become no-ops ---------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."jobs_ledger_project_master_match_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- One company (v2.2967): a job may sit on any project. Trigger kept so a rollback is a
  -- CREATE OR REPLACE, not a re-wire.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."jobs_ledger_project_master_match_fn"() IS
  'No-op since v2.2967 (one company). Previously: job master_user_id had to equal the project owner.';

CREATE OR REPLACE FUNCTION public.jobs_ledger_customer_master_match_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- One company (v2.2967): a job may link any customer.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_customer_master_match_fn() IS
  'No-op since v2.2967 (one company). Previously: the linked customer had to belong to the job master.';

CREATE OR REPLACE FUNCTION public.jobs_ledger_gc_customer_master_match_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- One company (v2.2967): a job may name any customer as its GC.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_gc_customer_master_match_fn() IS
  'No-op since v2.2967 (one company). Previously: the GC customer had to belong to the job master.';

-- 6) create_job_from_estimate — both overloads, verbatim from 20260810200050 except the owner
--    guard (removed) and the owner stamp (company_owner_user_id() first) ----------------------

CREATE OR REPLACE FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text" DEFAULT NULL::"text", "p_job_address" "text" DEFAULT NULL::"text", "p_revenue" numeric DEFAULT NULL::numeric, "p_customer_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  e public.estimates%ROWTYPE;
  v_master uuid;
  v_override text;
  v_job_id uuid;
  v_link_rows int;
  v_existing_link uuid;
  v_hcp text;
  v_cust_id uuid;
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  j_name text;
  j_addr text;
  rev numeric(12, 2);
  crec RECORD;
  ci jsonb;
  v_service_type_id uuid;
BEGIN
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE st.name = 'Plumbing'
  LIMIT 1;
  IF v_service_type_id IS NULL THEN
    RAISE EXCEPTION 'service_types missing Plumbing row';
  END IF;

  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    public.user_can_access_estimate(e) OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to create job for this estimate';
  END IF;

  IF e.project_id IS NOT NULL THEN
    SELECT p.master_user_id INTO v_master FROM public.projects p WHERE p.id = e.project_id;
    IF v_master IS NULL THEN
      RAISE EXCEPTION 'project not found';
    END IF;
  ELSE
    -- one company (v2.2967): every new job is stamped with the company owner account
    -- (app_settings.company_owner_user_id, seeded by 20260906190000). The personal
    -- job_owner_override_<uid> chain only runs while that row is unset.
    v_master := public.company_owner_user_id();
    IF v_master IS NULL THEN
      SELECT s.value_text INTO v_override
      FROM public.app_settings s
      WHERE s.key = 'job_owner_override_' || auth.uid()::text;
      IF v_override IS NULL OR trim(v_override) = '' THEN
        SELECT s.value_text INTO v_override
        FROM public.app_settings s
        WHERE s.key = 'job_owner_override_default';
      END IF;
      IF v_override IS NOT NULL AND trim(v_override) != '' THEN
        v_master := trim(v_override)::uuid;
      ELSE
        v_master := auth.uid();
      END IF;
    END IF;
  END IF;

  v_cust_id := COALESCE(p_customer_id, e.customer_id);

  IF v_cust_id IS NOT NULL THEN
    SELECT c.name, c.contact_info, c.master_user_id
    INTO crec
    FROM public.customers c
    WHERE c.id = v_cust_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer not found';
    END IF;
    -- one company (v2.2967): the customer may sit under any office account; no owner guard.
    v_cust_name := crec.name;
    ci := COALESCE(crec.contact_info::jsonb, '{}'::jsonb);
    v_cust_email := NULLIF(trim(ci->>'email'), '');
    v_cust_phone := NULLIF(trim(ci->>'phone'), '');
  ELSE
    v_cust_name := NULL;
    v_cust_email := NULLIF(trim(COALESCE(e.customer_email, '')), '');
    v_cust_phone := NULL;
  END IF;

  j_name := COALESCE(NULLIF(trim(p_job_name), ''), NULLIF(trim(e.title), ''), '');
  j_addr := COALESCE(
    NULLIF(trim(p_job_address), ''),
    NULLIF(trim(e.for_address), ''),
    ''
  );
  rev := COALESCE(p_revenue, (e.total_cents::numeric / 100.0));

  INSERT INTO public.jobs_ledger (
    master_user_id,
    hcp_number,
    job_name,
    job_address,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    project_id,
    revenue,
    payments_made,
    service_type_id
  ) VALUES (
    v_master,
    v_hcp,
    j_name,
    j_addr,
    v_cust_id,
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    e.project_id,
    rev,
    0,
    v_service_type_id
  )
  RETURNING id INTO v_job_id;

  UPDATE public.estimates
  SET job_ledger_id = v_job_id
  WHERE id = e.id AND job_ledger_id IS NULL;
  GET DIAGNOSTICS v_link_rows = ROW_COUNT;
  IF v_link_rows = 0 THEN
    SELECT el.job_ledger_id INTO v_existing_link FROM public.estimates el WHERE el.id = e.id;
    IF v_existing_link IS NOT NULL THEN
      DELETE FROM public.jobs_ledger WHERE id = v_job_id;
      RETURN v_existing_link;
    END IF;
    RAISE EXCEPTION 'could not link estimate to job';
  END IF;

  RETURN v_job_id;
END;
$$;


ALTER FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text", "p_job_address" "text", "p_revenue" numeric, "p_customer_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text", "p_job_address" "text", "p_revenue" numeric, "p_customer_id" "uuid") IS 'Creates jobs_ledger from customer_accepted estimate and sets estimates.job_ledger_id (idempotent if already linked).';


CREATE OR REPLACE FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text" DEFAULT NULL::"text", "p_job_address" "text" DEFAULT NULL::"text", "p_revenue" numeric DEFAULT NULL::numeric, "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_fixtures" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  e public.estimates%ROWTYPE;
  v_master uuid;
  v_override text;
  v_job_id uuid;
  v_link_rows int;
  v_existing_link uuid;
  v_hcp text;
  v_cust_id uuid;
  v_cust_name text;
  v_cust_email text;
  v_cust_phone text;
  j_name text;
  j_addr text;
  rev numeric(12, 2);
  crec RECORD;
  ci jsonb;
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_fixture_inserts int := 0;
  v_fixture_rev numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  fixture_el jsonb;
  idx int;
  v_len int;
  v_service_type_id uuid;
BEGIN
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE st.name = 'Plumbing'
  LIMIT 1;
  IF v_service_type_id IS NULL THEN
    RAISE EXCEPTION 'service_types missing Plumbing row';
  END IF;

  v_hcp := trim(COALESCE(p_hcp_number, ''));
  IF v_hcp = '' THEN
    RAISE EXCEPTION 'hcp_number is required';
  END IF;

  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    public.user_can_access_estimate(e) OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to create job for this estimate';
  END IF;

  IF e.project_id IS NOT NULL THEN
    SELECT p.master_user_id INTO v_master FROM public.projects p WHERE p.id = e.project_id;
    IF v_master IS NULL THEN
      RAISE EXCEPTION 'project not found';
    END IF;
  ELSE
    -- one company (v2.2967): every new job is stamped with the company owner account
    -- (app_settings.company_owner_user_id, seeded by 20260906190000). The personal
    -- job_owner_override_<uid> chain only runs while that row is unset.
    v_master := public.company_owner_user_id();
    IF v_master IS NULL THEN
      SELECT s.value_text INTO v_override
      FROM public.app_settings s
      WHERE s.key = 'job_owner_override_' || auth.uid()::text;
      IF v_override IS NULL OR trim(v_override) = '' THEN
        SELECT s.value_text INTO v_override
        FROM public.app_settings s
        WHERE s.key = 'job_owner_override_default';
      END IF;
      IF v_override IS NOT NULL AND trim(v_override) != '' THEN
        v_master := trim(v_override)::uuid;
      ELSE
        v_master := auth.uid();
      END IF;
    END IF;
  END IF;

  v_cust_id := COALESCE(p_customer_id, e.customer_id);

  IF v_cust_id IS NOT NULL THEN
    SELECT c.name, c.contact_info, c.master_user_id
    INTO crec
    FROM public.customers c
    WHERE c.id = v_cust_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer not found';
    END IF;
    -- one company (v2.2967): the customer may sit under any office account; no owner guard.
    v_cust_name := crec.name;
    ci := COALESCE(crec.contact_info::jsonb, '{}'::jsonb);
    v_cust_email := NULLIF(trim(ci->>'email'), '');
    v_cust_phone := NULLIF(trim(ci->>'phone'), '');
  ELSE
    v_cust_name := NULL;
    v_cust_email := NULLIF(trim(COALESCE(e.customer_email, '')), '');
    v_cust_phone := NULL;
  END IF;

  j_name := COALESCE(NULLIF(trim(p_job_name), ''), NULLIF(trim(e.title), ''), '');
  j_addr := COALESCE(
    NULLIF(trim(p_job_address), ''),
    NULLIF(trim(e.for_address), ''),
    ''
  );
  rev := COALESCE(p_revenue, (e.total_cents::numeric / 100.0));

  INSERT INTO public.jobs_ledger (
    master_user_id,
    hcp_number,
    job_name,
    job_address,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    project_id,
    revenue,
    payments_made,
    service_type_id
  ) VALUES (
    v_master,
    v_hcp,
    j_name,
    j_addr,
    v_cust_id,
    v_cust_name,
    v_cust_email,
    v_cust_phone,
    e.project_id,
    rev,
    0,
    v_service_type_id
  )
  RETURNING id INTO v_job_id;

  UPDATE public.estimates
  SET job_ledger_id = v_job_id
  WHERE id = e.id AND job_ledger_id IS NULL;
  GET DIAGNOSTICS v_link_rows = ROW_COUNT;
  IF v_link_rows = 0 THEN
    SELECT el.job_ledger_id INTO v_existing_link FROM public.estimates el WHERE el.id = e.id;
    IF v_existing_link IS NOT NULL THEN
      DELETE FROM public.jobs_ledger WHERE id = v_job_id;
      RETURN v_existing_link;
    END IF;
    RAISE EXCEPTION 'could not link estimate to job';
  END IF;

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    IF v_len IS NOT NULL AND v_len > 0 THEN
      FOR idx IN 0 .. v_len - 1 LOOP
        fixture_el := p_fixtures->idx;
        BEGIN
          fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
          IF fname IS NULL OR fname = '' THEN
            CONTINUE;
          END IF;

          fcount := 1;
          IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
            fcount := (fixture_el->>'count')::numeric;
          END IF;
          IF fcount IS NULL OR fcount <= 0 THEN
            fcount := 1;
          END IF;

          fprice := NULL;
          IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
            fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
          END IF;

          fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

          fseq := 0;
          IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
            fseq := (fixture_el->>'sequence_order')::int;
          END IF;

          INSERT INTO public.jobs_ledger_fixtures (
            job_id,
            name,
            count,
            line_unit_price,
            line_description,
            sequence_order
          ) VALUES (
            v_job_id,
            fname,
            fcount,
            fprice,
            fdesc,
            fseq
          );

          v_fixture_inserts := v_fixture_inserts + 1;
          v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
          v_fixture_rev := round(v_fixture_rev + v_row_ext, 2);
        EXCEPTION
          WHEN OTHERS THEN
            CONTINUE;
        END;
      END LOOP;
    END IF;
  END IF;

  IF v_fixture_inserts > 0 THEN
    UPDATE public.jobs_ledger
    SET revenue = v_fixture_rev
    WHERE id = v_job_id;
  END IF;

  RETURN v_job_id;
END;
$$;


ALTER FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text", "p_job_address" "text", "p_revenue" numeric, "p_customer_id" "uuid", "p_fixtures" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_job_from_estimate"("p_estimate_id" "uuid", "p_hcp_number" "text", "p_job_name" "text", "p_job_address" "text", "p_revenue" numeric, "p_customer_id" "uuid", "p_fixtures" "jsonb") IS 'Creates jobs_ledger from customer_accepted estimate, optional jobs_ledger_fixtures from p_fixtures, revenue from fixture totals when any inserted.';

-- 7) apply_estimate_to_job — verbatim from 20260820030000 except the owner guard --------------

CREATE OR REPLACE FUNCTION "public"."apply_estimate_to_job"(
  "p_estimate_id" "uuid",
  "p_job_ledger_id" "uuid",
  "p_fixtures" "jsonb" DEFAULT '[]'::"jsonb"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  e public.estimates%ROWTYPE;
  j public.jobs_ledger%ROWTYPE;
  fixture_el jsonb;
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_seq_base int := 0;
  v_fixture_inserts int := 0;
  v_net numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  v_len int;
  idx int;
  v_doc_label text;
  v_amount_label text;
  v_body text;
BEGIN
  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  -- Idempotent: already applied/linked → return the existing link.
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    public.user_can_access_estimate(e) OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to apply this estimate';
  END IF;

  SELECT * INTO j FROM public.jobs_ledger WHERE id = p_job_ledger_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;

  -- one company (v2.2967): a change order applies to any job the caller can reach; no owner guard.

  SELECT COALESCE(MAX(f.sequence_order) + 1, 0)
  INTO v_seq_base
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_ledger_id;

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    idx := 0;
    WHILE idx < v_len LOOP
      BEGIN
        fixture_el := p_fixtures->idx;
        idx := idx + 1;

        fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
        IF fname IS NULL THEN
          CONTINUE;
        END IF;

        fcount := NULL;
        IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
          fcount := (fixture_el->>'count')::numeric;
        END IF;
        IF fcount IS NULL OR fcount <= 0 THEN
          fcount := 1;
        END IF;

        fprice := NULL;
        IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
          fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
        END IF;

        fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

        fseq := 0;
        IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
          fseq := (fixture_el->>'sequence_order')::int;
        END IF;

        INSERT INTO public.jobs_ledger_fixtures (
          job_id,
          name,
          count,
          line_unit_price,
          line_description,
          sequence_order
        ) VALUES (
          p_job_ledger_id,
          fname,
          fcount,
          fprice,
          fdesc,
          v_seq_base + fseq
        );

        v_fixture_inserts := v_fixture_inserts + 1;
        v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
        v_net := round(v_net + v_row_ext, 2);
      EXCEPTION
        WHEN OTHERS THEN
          CONTINUE;
      END;
    END LOOP;
  END IF;

  -- No usable line items → the accepted total IS the net.
  IF v_fixture_inserts = 0 THEN
    v_net := round(COALESCE(e.total_cents, 0)::numeric / 100.0, 2);
  END IF;

  UPDATE public.jobs_ledger
  SET revenue = round(COALESCE(revenue, 0::numeric) + v_net, 2)
  WHERE id = p_job_ledger_id;

  UPDATE public.estimates
  SET job_ledger_id = p_job_ledger_id
  WHERE id = p_estimate_id
    AND job_ledger_id IS NULL;

  -- Best-effort activity note; never fails the apply.
  BEGIN
    v_doc_label := CASE WHEN e.doc_kind = 'change_order' THEN 'Change order' ELSE 'Estimate' END;
    v_amount_label := CASE WHEN v_net < 0 THEN '-$' ELSE '+$' END
      || to_char(abs(v_net), 'FM999,999,990.00');
    v_body := v_doc_label || ' #' || e.estimate_number::text || ' applied: ' || v_amount_label
      || CASE
           WHEN NULLIF(trim(COALESCE(e.change_order_fields->>'description_of_change', '')), '') IS NOT NULL
             THEN ' — ' || trim(e.change_order_fields->>'description_of_change')
           WHEN NULLIF(trim(COALESCE(e.title, '')), '') IS NOT NULL
             THEN ' — ' || trim(e.title)
           ELSE ''
         END;
    v_body := left(v_body, 2000);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (p_job_ledger_id, auth.uid(), v_body);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN p_job_ledger_id;
END;
$$;

ALTER FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") IS 'Applies a customer_accepted estimate/change order to an EXISTING job: appends p_fixtures rows to jobs_ledger_fixtures (sequenced after existing), moves jobs_ledger.revenue by the signed net (credits subtract; no rows -> estimate total), sets estimates.job_ledger_id, best-effort posts the "Change order #N applied: +$X - desc" thread note. Idempotent: already-linked estimates return their link untouched.';

GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "service_role";
