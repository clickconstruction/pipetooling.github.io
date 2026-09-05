SET lock_timeout = '3s';

-- v2.2836 — superintendents see only the projects they are assigned to.
--
-- Journey map J31 (Tier-1 #4, N1/N2/N4/N7): every superintendent could read every
-- project — and its workflow, steps, money line items (read AND write) and the
-- signed sub work orders (step_commitments) that ride the same helper — because
-- the project-access helpers still granted through the ADOPTION table
-- (master_superintendents), which v2.921's sync_company_access_grants() fills for
-- every live dev/master × superintendent pair. Live on 2026-09-04: 3 projects,
-- project_superintendents = 1 row, master_superintendents = 4 rows; the walked
-- superintendent was assigned to at most 1 project and saw all 3.
--
-- History: the 2026-06-23 "superintendent_assigned_only" migration rewrote ONLY
-- the 1-arg can_access_project_row(uuid). The 3-arg overload that the projects
-- SELECT policy actually calls ("Users can see projects they have access to" →
-- can_access_project_row(id, master_user_id, customer_id)) kept its
-- master_superintendents branches; can_access_project(), can_access_project_via_step()
-- and can_access_step_for_action() kept theirs via master_adopted_current_user().
--
-- Objects replaced (bodies otherwise verbatim from the baseline / 20260817012110):
--   can_access_project_row(uuid, uuid, uuid)  — superintendent → project_superintendents ONLY,
--                                               placed before every adoption check;
--                                               the two master_superintendents branches removed
--   can_access_project(uuid)                  — superintendent → strict can_access_project_row(uuid);
--                                               adoption consulted for every OTHER role only
--   can_access_project_via_step(uuid)         — same split
--   can_access_step_for_action(uuid)          — same split
--
-- Deliberately NOT changed:
--   master_adopted_current_user(uuid) — it is a generic "did this master adopt me"
--     predicate that the users SELECT policy ("Users can select users") relies on
--     so a superintendent can see the masters who adopted them (assign pickers,
--     the Project Master line). Removing its superintendent branch would blind
--     superintendents to every master account. Only its COMMENT is corrected.
--   master_superintendents table + sync_company_access_grants() — still read by
--     dashboards, dispatch/schedule RLS, bids helpers, people RLS, tag org, feedback.
--   can_access_project_row_for_user(uuid, uuid) — the schedule-email cron path;
--     its callers grant superintendents through their own direct
--     master_superintendents checks (dispatch is company-wide by design), so
--     changing this helper alone would change nothing there.
--   can_access_project_via_workflow(uuid) — carries no adoption branch of its own;
--     it is fixed through can_access_project().
--
-- dev / master / assistant-like / primary / owner / customer-side branches are
-- byte-for-byte what they were. No table, policy or grant changes.

-- 1) The overload the projects SELECT policy calls ---------------------------

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

  -- Direct access: owner, dev, master, adopted, shared
  IF proj_master_id = auth.uid() THEN
    RETURN true;
  END IF;
  IF user_role_val IN ('dev', 'master_technician') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = proj_master_id AND assistant_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = proj_master_id AND primary_id = auth.uid()) THEN
    RETURN true;
  END IF;
  -- master_superintendents removed (v2.2836): superintendents returned above; no other role holds a row.
  IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = proj_master_id AND viewing_master_id = auth.uid()) THEN
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
      IF user_role_val IN ('dev', 'master_technician') THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = cust_master_id AND assistant_id = auth.uid()) THEN
        RETURN true;
      END IF;
      IF EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = cust_master_id AND primary_id = auth.uid()) THEN
        RETURN true;
      END IF;
      -- master_superintendents removed (v2.2836): see above.
      IF EXISTS (SELECT 1 FROM public.master_shares WHERE sharing_master_id = cust_master_id AND viewing_master_id = auth.uid()) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_project_row(uuid, uuid, uuid) IS
  'Checks project access using passed master_user_id and customer_id. Used by projects RLS to avoid recursion (no projects table read). Superintendents: assigned projects only (project_superintendents), never adoption (v2.2836). Others: owner/dev/master/adopted/shared.';

-- 2) The helper the project_workflows SELECT policy (and via_workflow) calls --

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
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    -- Superintendents: assigned projects only (v2.2836) — never the adoption tables.
    OR (user_role_val = 'superintendent' AND public.can_access_project_row(project_id_param))
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(project_master_id))
    OR public.master_shared_current_user(project_master_id)
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project(uuid) IS
  'Checks if the current user can access a project (owner/dev/master/adopted/shared; superintendents: assigned projects only, v2.2836). Uses SECURITY DEFINER to optimize RLS.';

-- 3) The helper workflow_step_line_items + step_commitments policies call -----

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
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    -- Adoption grants every role EXCEPT superintendent (v2.2836).
    OR (user_role_val IS DISTINCT FROM 'superintendent' AND public.master_adopted_current_user(project_master_id_val))
    OR public.master_shared_current_user(project_master_id_val)
    OR (
      user_role_val = 'superintendent'
      AND project_id_val IS NOT NULL
      AND public.can_access_project_row(project_id_val)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_project_via_step(uuid) IS
  'Checks if the current user can access a project via a workflow step. Superintendents: assigned projects only via can_access_project_row (v2.2836); adoption never grants them. Uses SECURITY DEFINER.';

-- 4) The helper project_workflow_step_actions policies call ------------------

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

  -- Check access: user owns project OR is dev/master OR master adopted them (not superintendents)
  -- OR is a superintendent assigned to the project OR is assigned to the step
  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
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
  'Step-action access: owner, dev, master, adopted (every role but superintendent), superintendents on their assigned projects only (v2.2836), or the assignee (id first, name fallback). SECURITY DEFINER.';

-- 5) Truthful comment on the generic adoption predicate (body unchanged) ------

COMMENT ON FUNCTION public.master_adopted_current_user(uuid) IS
  'Checks if the given master has adopted the current user (as assistant, primary OR superintendent). Superintendent adoption is company-wide (v2.921 sync) and grants NO project access — the project helpers branch on role before consulting this (v2.2836). Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
