SET lock_timeout = '3s';

-- Person-identity Phase D (docs/PERSON_IDENTITY_PLAN.md) — the workflow-step
-- READER flip deferred since v2.1201: every server-side "is this user the
-- step's assignee?" check matched only lower(btrim(users.name)) =
-- lower(btrim(assigned_to_name)), so renaming a user silently revoked their
-- step visibility, dashboard lists, and sub step-update rights. Each check now
-- goes id-first (assigned_person_id -> people.account_user_id) with the name
-- match kept as fallback — a step whose id is unfilled degrades to today,
-- never worse.
--
-- Objects replaced (bodies otherwise verbatim from the baseline /
-- 20260801130000): step_assignee_matches_user (new shared helper),
-- get_assigned_steps_for_dashboard, get_assigned_steps_with_projects_for_dashboard,
-- can_access_step_for_action, user_has_assigned_step_in_project,
-- update_step_assignment (assistant self-match), and the three RLS policies
-- on project_workflow_steps / project_workflows.

-- Shared predicate: is p_user_id the assignee of a step carrying this
-- (assigned_person_id, assigned_to_name) pair? Id-first, name fallback.
-- SECURITY DEFINER so RLS on people/users never recurses into step policies.
CREATE OR REPLACE FUNCTION public.step_assignee_matches_user(
  p_assigned_person_id uuid,
  p_assigned_to_name text,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (p_assigned_person_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.id = p_assigned_person_id AND p.account_user_id = p_user_id
    ))
    OR
    (p_assigned_to_name IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_user_id AND u.name IS NOT NULL
        AND lower(btrim(u.name)) = lower(btrim(p_assigned_to_name))
    ));
$$;

COMMENT ON FUNCTION public.step_assignee_matches_user(uuid, text, uuid) IS
  'True when the user is the step''s assignee: assigned_person_id -> people.account_user_id first, legacy lower(btrim(name)) match as fallback. Shared by the step RLS policies and dashboard RPCs (identity Phase D).';

GRANT ALL ON FUNCTION public.step_assignee_matches_user(uuid, text, uuid) TO anon;
GRANT ALL ON FUNCTION public.step_assignee_matches_user(uuid, text, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.step_assignee_matches_user(uuid, text, uuid) TO service_role;

-- Dashboard: Assigned Stages (simple list). RLS still applies (not DEFINER).
CREATE OR REPLACE FUNCTION public.get_assigned_steps_for_dashboard(p_user_name text)
RETURNS SETOF public.project_workflow_steps
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT * FROM public.project_workflow_steps s
  WHERE (s.assigned_to_name IS NOT NULL
         AND LOWER(TRIM(s.assigned_to_name)) = LOWER(TRIM(p_user_name)))
     OR (s.assigned_person_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.people p
           WHERE p.id = s.assigned_person_id AND p.account_user_id = auth.uid()))
  ORDER BY s.created_at DESC
  LIMIT 100;
$$;

COMMENT ON FUNCTION public.get_assigned_steps_for_dashboard(text) IS
  'Returns steps assigned to the user: assigned_person_id first (via people.account_user_id = auth.uid()), name match (case-insensitive, trimmed) as fallback. Used by Dashboard Projects: Assigned Stages.';

-- Dashboard: Assigned Stages with project metadata.
CREATE OR REPLACE FUNCTION public.get_assigned_steps_with_projects_for_dashboard(p_user_name text)
RETURNS SETOF json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Only allow if caller's users.name matches p_user_name (case-insensitive, trimmed)
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.name IS NOT NULL
      AND LOWER(TRIM(u.name)) = LOWER(TRIM(p_user_name))
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT
      s.*,
      p.id AS project_id,
      p.name AS project_name,
      p.address AS project_address,
      p.plans_link AS project_plans_link,
      (SELECT string_agg(COALESCE(u.name, u.email, 'Unknown'), ', ' ORDER BY COALESCE(u.name, u.email, 'Unknown'))
       FROM (
         SELECT superintendent_id FROM project_superintendents WHERE project_id = p.id
         UNION
         SELECT superintendent_id FROM master_superintendents WHERE master_id = p.master_user_id
       ) ids
       JOIN users u ON u.id = ids.superintendent_id
      ) AS project_superintendent_names
    FROM public.project_workflow_steps s
    JOIN public.project_workflows pw ON pw.id = s.workflow_id
    JOIN public.projects p ON p.id = pw.project_id
    WHERE (s.assigned_to_name IS NOT NULL
           AND LOWER(TRIM(s.assigned_to_name)) = LOWER(TRIM(p_user_name)))
       OR (s.assigned_person_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.people p2
             WHERE p2.id = s.assigned_person_id AND p2.account_user_id = auth.uid()))
    ORDER BY s.created_at DESC
    LIMIT 100
  LOOP
    RETURN NEXT row_to_json(r);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_assigned_steps_with_projects_for_dashboard(text) IS
  'Returns steps with project metadata and superintendent names for Dashboard. SECURITY DEFINER to bypass workflow/project RLS. Matches assigned_person_id first, name as fallback; only returns steps assigned to current user.';

-- Step action access: id-first assignee branch for assistants/subs.
CREATE OR REPLACE FUNCTION public.can_access_step_for_action(step_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  project_master_id UUID;
  user_role_val TEXT;
  user_name_val TEXT;
  step_assigned_to TEXT;
  step_person_id UUID;
BEGIN
  -- Get step and project info, plus user info in one query
  SELECT p.master_user_id, u.role, u.name, s.assigned_to_name, s.assigned_person_id
  INTO project_master_id, user_role_val, user_name_val, step_assigned_to, step_person_id
  FROM public.project_workflow_steps s
  JOIN public.project_workflows pw ON pw.id = s.workflow_id
  JOIN public.projects p ON p.id = pw.project_id
  LEFT JOIN public.users u ON u.id = auth.uid()
  WHERE s.id = step_id_param;

  -- If no step found, return false
  IF project_master_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check access: user owns project OR is dev/master OR master adopted them OR is assigned to step
  RETURN (
    project_master_id = auth.uid()
    OR public.is_dev()
    OR user_role_val = 'master_technician'
    OR public.master_adopted_current_user(project_master_id)
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

-- Project access via any assigned step (projects RLS helper).
CREATE OR REPLACE FUNCTION public.user_has_assigned_step_in_project(project_id_param uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_workflows pw
    JOIN public.project_workflow_steps s ON s.workflow_id = pw.id
    WHERE pw.project_id = project_id_param
      AND public.step_assignee_matches_user(s.assigned_person_id, s.assigned_to_name, auth.uid())
  );
$$;

COMMENT ON FUNCTION public.user_has_assigned_step_in_project(uuid) IS
  'Checks if current user has an assigned step in any workflow of this project (assigned_person_id first, name fallback). SECURITY DEFINER to bypass RLS and avoid projects recursion.';

-- Assignment RPC: assistant self-match goes id-first too.
CREATE OR REPLACE FUNCTION public.update_step_assignment("p_step_id" uuid, "p_assigned_to_name" text, "p_person_id" uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Access check: dev, master, owner, adopted, shared, OR assistant (assigned or can_access)
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'assistant')
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          WHERE s.id = p_step_id
            AND public.step_assignee_matches_user(s.assigned_person_id, s.assigned_to_name, auth.uid())
        )
        OR public.can_access_project_via_workflow(
          (SELECT workflow_id FROM public.project_workflow_steps WHERE id = p_step_id)
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.project_workflow_steps
  SET assigned_to_name = p_assigned_to_name,
      assigned_person_id = COALESCE(p_person_id, public.resolve_pay_person_id(p_assigned_to_name))
  WHERE id = p_step_id;
END;
$$;

COMMENT ON FUNCTION public.update_step_assignment(uuid, text, uuid) IS
  'Assigns a workflow step: writes assigned_to_name plus assigned_person_id (explicit id wins, else resolve_pay_person_id). Successor to update_step_assigned_to, which remains for old clients. Bypasses RLS to avoid timeout.';

-- RLS: steps SELECT — sub-like assignee branch goes id-first.
DROP POLICY IF EXISTS "Users can see steps for workflows they have access to" ON public.project_workflow_steps;
CREATE POLICY "Users can see steps for workflows they have access to" ON public.project_workflow_steps FOR SELECT USING (
  public.is_dev()
  OR (EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'master_technician'::public.user_role))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'assistant'::public.user_role))
      AND public.can_access_project_via_workflow(workflow_id))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'superintendent'::public.user_role))
      AND public.can_access_project_via_workflow(workflow_id))
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() )
         AND users.role = ANY (ARRAY['helpers'::public.user_role, 'subcontractor'::public.user_role])))
      AND public.step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() )))
);

-- RLS: steps UPDATE by sub-like assignee — id-first.
DROP POLICY IF EXISTS "Subcontractors can update their assigned project_workflow_steps" ON public.project_workflow_steps;
CREATE POLICY "Subcontractors can update their assigned project_workflow_steps" ON public.project_workflow_steps FOR UPDATE USING (
  (EXISTS ( SELECT 1 FROM public.users u
     WHERE u.id = ( SELECT auth.uid() )
       AND u.role = ANY (ARRAY['helpers'::public.user_role, 'subcontractor'::public.user_role])))
  AND public.step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() ))
) WITH CHECK (
  (EXISTS ( SELECT 1 FROM public.users u
     WHERE u.id = ( SELECT auth.uid() )
       AND u.role = ANY (ARRAY['helpers'::public.user_role, 'subcontractor'::public.user_role])))
  AND public.step_assignee_matches_user(assigned_person_id, assigned_to_name, ( SELECT auth.uid() ))
);

-- RLS: workflows SELECT — the has-an-assigned-step branch goes id-first.
DROP POLICY IF EXISTS "Users can see workflows they have access to" ON public.project_workflows;
CREATE POLICY "Users can see workflows they have access to" ON public.project_workflows FOR SELECT USING (
  public.can_access_project(project_id)
  OR ((EXISTS ( SELECT 1 FROM public.users
       WHERE users.id = ( SELECT auth.uid() ) AND users.role = 'superintendent'::public.user_role))
      AND public.can_access_project_row(project_id))
  OR (EXISTS ( SELECT 1 FROM public.project_workflow_steps s
       WHERE s.workflow_id = project_workflows.id
         AND public.step_assignee_matches_user(s.assigned_person_id, s.assigned_to_name, ( SELECT auth.uid() ))))
);
