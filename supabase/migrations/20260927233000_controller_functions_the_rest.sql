SET lock_timeout = '3s';

-- Controller access, batch 5 of the audit (to-dos/controller-access.md): the remaining functions
-- and the four membership triggers. The owner's calls of 2026-09-27: a controller may be in the
-- Dispatch and Estimator inbox groups, may be an activity viewer, and may merge customers — the
-- controller is the same as the assistant.
--
-- Each function is its live definition (pg_get_functiondef, read 2026-09-27) with 'controller'
-- named beside 'assistant' in its role check, and nothing else changed.

-- assert_caller_can_merge_customer_pair(p_survivor_master_user_id uuid, p_victim_master_user_id uuid)
CREATE OR REPLACE FUNCTION public.assert_caller_can_merge_customer_pair(p_survivor_master_user_id uuid, p_victim_master_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('assistant', 'controller')
  ) THEN
    IF p_survivor_master_user_id IS NULL OR p_victim_master_user_id IS NULL THEN
      RAISE EXCEPTION 'Not allowed to merge customers';
    END IF;
    IF NOT public.is_office_or_estimator() THEN
      RAISE EXCEPTION 'Not allowed to merge customers';
    END IF;
    IF NOT public.is_office_or_estimator() THEN
      RAISE EXCEPTION 'Not allowed to merge customers';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Not allowed to merge customers';
END;
$function$;

-- can_access_bid_for_pricing(bid_id_param uuid)
CREATE OR REPLACE FUNCTION public.can_access_bid_for_pricing(bid_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bid_rec RECORD;
  user_role_val TEXT;
BEGIN
  SELECT b.created_by, b.customer_id, b.gc_builder_id
  INTO bid_rec
  FROM public.bids b
  WHERE b.id = bid_id_param;

  IF bid_rec.created_by IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = auth.uid();

  IF bid_rec.created_by = auth.uid() THEN
    RETURN true;
  END IF;
  IF user_role_val IN ('dev', 'assistant', 'controller', 'estimator', 'master_technician', 'primary') THEN
    RETURN true;
  END IF;
  IF user_role_val = 'superintendent' THEN
    IF bid_rec.created_by = auth.uid() THEN
      RETURN true;
    END IF;
    IF bid_rec.customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.master_superintendents ms ON ms.master_id = c.master_user_id AND ms.superintendent_id = auth.uid()
      WHERE c.id = bid_rec.customer_id
    ) THEN
      RETURN true;
    END IF;
    IF EXISTS (SELECT 1 FROM public.master_superintendents ms WHERE ms.master_id = bid_rec.created_by AND ms.superintendent_id = auth.uid()) THEN
      RETURN true;
    END IF;
    IF bid_rec.gc_builder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bids_gc_builders bgb
      JOIN public.master_superintendents ms ON ms.master_id = bgb.created_by AND ms.superintendent_id = auth.uid()
      WHERE bgb.id = bid_rec.gc_builder_id
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$function$;

-- can_access_step_for_action(step_id_param uuid)
CREATE OR REPLACE FUNCTION public.can_access_step_for_action(step_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      user_role_val IN ('assistant', 'controller', 'subcontractor')
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
$function$;

-- can_manage_inspection_types()
CREATE OR REPLACE FUNCTION public.can_manage_inspection_types()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  );
$function$;

-- can_manage_schedule_share()
CREATE OR REPLACE FUNCTION public.can_manage_schedule_share()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.archived_at IS NULL
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')
  );
$function$;

-- can_manage_team_leader_assignments()
CREATE OR REPLACE FUNCTION public.can_manage_team_leader_assignments()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('master_technician', 'assistant', 'controller')
  );
$function$;

-- can_read_job_activity(p_job_id uuid, p_financial boolean)
CREATE OR REPLACE FUNCTION public.can_read_job_activity(p_job_id uuid, p_financial boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_financial then (
      exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and u.role = any (array['dev','master_technician','assistant', 'controller','primary']::user_role[])
      )
      and exists (
        select 1 from public.jobs_ledger j
        where j.id = p_job_id
          and (
            j.master_user_id = auth.uid()
            or public.is_dev()
            or exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role)
            or public.is_office_or_estimator()
            or public.is_office_or_estimator()
            or public.assistants_share_master(auth.uid(), j.master_user_id)
          )
      )
    )
    else exists (
      select 1 from public.jobs_ledger j
      where j.id = p_job_id
        and (
          j.master_user_id = auth.uid()
          or public.is_dev()
          or exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role)
          or public.is_office_or_estimator()
          or public.is_office_or_estimator()
          or public.assistants_share_master(auth.uid(), j.master_user_id)
          or exists (select 1 from public.jobs_ledger_team_members t where t.job_id = j.id and t.user_id = auth.uid())
        )
    )
  end;
$function$;

-- dispatch_group_members_enforce_assistant()
CREATE OR REPLACE FUNCTION public.dispatch_group_members_enforce_assistant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.role::text IN ('assistant', 'controller', 'estimator')
  ) THEN
    RAISE EXCEPTION 'Dispatch group may only include users with role assistant or estimator';
  END IF;
  RETURN NEW;
END;
$function$;

-- enforce_user_app_activity_viewer_role()
CREATE OR REPLACE FUNCTION public.enforce_user_app_activity_viewer_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r text;
BEGIN
  SELECT role INTO r FROM public.users WHERE id = NEW.viewer_user_id;
  IF r IS NULL THEN
    RAISE EXCEPTION 'viewer_user_id must reference an existing user';
  END IF;
  IF r NOT IN ('assistant', 'controller', 'master_technician', 'primary') THEN
    RAISE EXCEPTION 'Activity viewer must be assistant, master_technician, or primary';
  END IF;
  RETURN NEW;
END;
$function$;

-- enforce_user_labels_scope_master()
CREATE OR REPLACE FUNCTION public.enforce_user_labels_scope_master()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  l_master uuid;
  u_role text;
  u_email text;
BEGIN
  SELECT master_user_id INTO l_master FROM public.labels WHERE id = NEW.label_id;
  IF l_master IS NULL THEN
    RAISE EXCEPTION 'user_labels: label not found for label_id %', NEW.label_id;
  END IF;

  SELECT role::text, email INTO u_role, u_email FROM public.users WHERE id = NEW.user_id;
  IF u_role IS NULL THEN
    RAISE EXCEPTION 'user_labels: user not found for user_id %', NEW.user_id;
  END IF;

  IF u_role IN ('master_technician', 'dev') AND NEW.user_id = l_master THEN
    RETURN NEW;
  END IF;

  IF u_role IN ('assistant', 'controller') AND EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE assistant_id = NEW.user_id AND master_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  IF u_role = 'superintendent' AND EXISTS (
    SELECT 1 FROM public.master_superintendents
    WHERE superintendent_id = NEW.user_id AND master_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  IF u_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.master_user_id = l_master
      AND p.archived_at IS NULL
      AND lower(trim(p.email)) = lower(trim(u_email))
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_tag_org uto
    WHERE uto.user_id = NEW.user_id AND uto.master_user_id = l_master
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'user_labels: user % is not in scope for label master %', NEW.user_id, l_master;
END;
$function$;

-- estimator_group_members_enforce_roles()
CREATE OR REPLACE FUNCTION public.estimator_group_members_enforce_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.role::text IN ('assistant', 'controller', 'estimator')
  ) THEN
    RAISE EXCEPTION 'Estimator inbox group may only include users with role assistant or estimator';
  END IF;
  RETURN NEW;
END;
$function$;

-- get_man_hours_by_job()
CREATE OR REPLACE FUNCTION public.get_man_hours_by_job()
 RETURNS TABLE(job_id text, person_name text, man_hours numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'get_man_hours_by_job: not allowed';
  END IF;
  RETURN QUERY
  with crew as (
    select
      cj.work_date,
      cj.person_name,
      jsonb_array_elements(
        case when jsonb_typeof(cj.job_assignments) = 'array'
             then cj.job_assignments
             else '[]'::jsonb end
      ) as assignment
    from people_crew_jobs cj
  ),
  alloc as (
    select
      (c.assignment->>'job_id') as jid,
      c.person_name as pname,
      (case
         when coalesce(pc.is_salary, false)
           then case when extract(dow from c.work_date) between 1 and 5 then 8 else 0 end
         else coalesce(ph.hours, 0)
       end) * (coalesce(nullif(c.assignment->>'pct', '')::numeric, 0) / 100.0) as alloc_hours
    from crew c
    left join people_pay_config pc on pc.person_name = c.person_name
    -- v2.3179: recorded time (approved + awaiting approval), was people_hours.
    left join people_hours_recorded ph
      on ph.person_name = c.person_name
     and ph.work_date = c.work_date
     and ph.work_date >= (current_date - interval '2 years')
    where coalesce(c.assignment->>'job_id', '') <> ''
  )
  select a.jid, a.pname, sum(a.alloc_hours) as man_hours
  from alloc a
  group by a.jid, a.pname
  having sum(a.alloc_hours) > 0;
END $function$;

-- insert_material_po_generator_entry(p_job_ledger_id uuid, p_for_user_id uuid, p_supply_house_id uuid, p_notes text)
CREATE OR REPLACE FUNCTION public.insert_material_po_generator_entry(p_job_ledger_id uuid, p_for_user_id uuid, p_supply_house_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(out_id uuid, out_po_code integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt int;
  v_code int;
  v_new_id uuid;
  v_inserted_code int;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid ()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_ledger_id
      AND (
        jl.master_user_id = auth.uid ()
        OR public.is_dev ()
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = auth.uid ()
            AND ma.assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = jl.master_user_id
            AND ma.assistant_id = auth.uid ()
        )
        OR public.assistants_share_master (auth.uid (), jl.master_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'job not accessible';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_for_user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF p_supply_house_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_supply_house_id) THEN
    RAISE EXCEPTION 'supply house not found';
  END IF;

  FOR v_attempt IN 1..50 LOOP
    v_code := 10000 + floor(random() * 90000)::integer;
    BEGIN
      INSERT INTO public.material_po_generator_entries (
        po_code,
        job_ledger_id,
        for_user_id,
        supply_house_id,
        notes,
        created_by
      )
      VALUES (
        v_code,
        p_job_ledger_id,
        p_for_user_id,
        p_supply_house_id,
        NULLIF (trim(p_notes), ''),
        auth.uid ()
      )
      RETURNING
        material_po_generator_entries.id,
        material_po_generator_entries.po_code
        INTO v_new_id,
        v_inserted_code;

      RETURN QUERY
      SELECT
        v_new_id,
        v_inserted_code;

      RETURN;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'could not allocate unique PO code';
END;
$function$;

-- is_bid_pricing_user()
CREATE OR REPLACE FUNCTION public.is_bid_pricing_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
  );
$function$;

-- is_dev_or_master_or_assistant()
CREATE OR REPLACE FUNCTION public.is_dev_or_master_or_assistant()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  );
$function$;

-- jobs_ledger_row_visible_for_tally_assign(p_job_id uuid, p_user_id uuid)
CREATE OR REPLACE FUNCTION public.jobs_ledger_row_visible_for_tally_assign(p_job_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_job_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.role::text INTO v_role FROM public.users u WHERE u.id = p_user_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('subcontractor', 'helpers') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = p_job_id AND jtm.user_id = p_user_id
    );
  END IF;

  IF v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller', 'primary') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_id
      AND (
        jl.master_user_id = p_user_id
        OR v_role = 'dev'
        OR v_role = 'primary'
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_user_id AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_user_id
        )
        OR public.assistants_share_master(p_user_id, jl.master_user_id)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.clock_sessions cs
    WHERE cs.job_ledger_id = p_job_id
      AND public.is_team_lead_for_member(p_user_id, cs.user_id)
  );
END;
$function$;

-- list_job_schedule_blocks_for_schedule_email(p_recipient uuid, p_work_date date)
CREATE OR REPLACE FUNCTION public.list_job_schedule_blocks_for_schedule_email(p_recipient uuid, p_work_date date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    COALESCE(jl.job_name, b.project_name) AS job_name,
    COALESCE(jl.job_address, b.address) AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date = p_work_date
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient
                   AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'dev')
        OR jl.master_user_id = p_recipient
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_recipient
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_recipient))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_recipient AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_recipient
        )
        OR public.assistants_share_master(p_recipient, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_recipient
        )
      ))
    )
  ORDER BY jsb.time_start ASC, jsb.assignee_user_id ASC;
$function$;

-- list_reports_for_bid(p_bid_id uuid)
CREATE OR REPLACE FUNCTION public.list_reports_for_bid(p_bid_id uuid)
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, bid_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.bid_id,
    COALESCE(b.project_name, b.gc_contact_name, 'Bid')::TEXT AS job_display_name,
    COALESCE(b.bid_number, '')::TEXT AS job_hcp_number,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  JOIN public.bids b ON r.bid_id = b.id
  WHERE r.bid_id = p_bid_id
  AND (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND public.superintendent_can_access_bid(b)
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
    OR
    (public.is_estimator() AND public.can_access_bid_for_pricing(p_bid_id))
  )
  ORDER BY r.created_at ASC;
$function$;

-- list_reports_for_job_ledger(p_job_id uuid)
CREATE OR REPLACE FUNCTION public.list_reports_for_job_ledger(p_job_id uuid)
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, job_ledger_id uuid, project_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    r.id, r.template_id, rt.name AS template_name, r.created_by_user_id, u.name AS created_by_name,
    r.created_at, r.updated_at, r.field_values, r.job_ledger_id, r.project_id,
    COALESCE(jl.job_name, p.name) AS job_display_name,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), p.housecallpro_number, '')::TEXT AS job_hcp_number,
    CASE WHEN (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator'))
      OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')) AND r.created_by_user_id = auth.uid())
    ) THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator'))
      OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')) AND r.created_by_user_id = auth.uid())
    ) THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  WHERE r.job_ledger_id = p_job_id
  AND (
    EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary'))
    OR (EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND ((r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR (r.job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(r.job_ledger_id))))
    OR (EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval))
  )
  ORDER BY r.created_at ASC;
$function$;

-- list_reports_with_job_info()
CREATE OR REPLACE FUNCTION public.list_reports_with_job_info()
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, job_ledger_id uuid, project_id uuid, bid_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric, job_google_drive_link text, job_job_pictures_link text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    r.id,
    r.template_id,
    rt.name AS template_name,
    r.created_by_user_id,
    u.name AS created_by_name,
    r.created_at,
    r.updated_at,
    r.field_values,
    r.job_ledger_id,
    r.project_id,
    r.bid_id,
    COALESCE(jl.job_name, p.name, b.project_name, b.gc_contact_name, 'Bid') AS job_display_name,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), p.housecallpro_number, b.bid_number, '')::TEXT AS job_hcp_number,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lat ELSE NULL END AS reported_at_lat,
    CASE WHEN (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator')
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
            AND role IN ('helpers', 'subcontractor')
        )
        AND r.created_by_user_id = auth.uid()
      )
    )
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng,
    jl.google_drive_link::TEXT AS job_google_drive_link,
    jl.job_pictures_link::TEXT AS job_job_pictures_link,
    jl.job_address::TEXT AS job_address
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  LEFT JOIN public.bids b ON r.bid_id = b.id
  WHERE (
    EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u4 WHERE u4.id = auth.uid() AND u4.role = 'superintendent')
      AND (
        (r.project_id IS NOT NULL AND public.can_access_project_row(r.project_id))
        OR
        (r.job_ledger_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(r.job_ledger_id))
        OR
        (r.bid_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.bids b2
          WHERE b2.id = r.bid_id
            AND public.superintendent_can_access_bid(b2)
        ))
      )
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND (
        r.created_by_user_id = auth.uid()
        OR (
          -- Crew visibility (v2.1546): field crew assigned to a job also see
          -- reports on that job authored by other FIELD-level people
          -- (helpers/subcontractor). Office/superintendent-authored reports
          -- stay out of the sub view; GPS columns stay masked above for
          -- reports the caller did not write.
          r.job_ledger_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.jobs_ledger_team_members tm
            WHERE tm.job_id = r.job_ledger_id AND tm.user_id = auth.uid()
          )
          AND EXISTS (
            SELECT 1 FROM public.users au
            WHERE au.id = r.created_by_user_id AND au.role IN ('helpers', 'subcontractor')
          )
        )
      )
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$function$;

-- list_schedule_blocks_for_share(p_viewer uuid, p_start date, p_end date)
CREATE OR REPLACE FUNCTION public.list_schedule_blocks_for_share(p_viewer uuid, p_start date, p_end date)
 RETURNS TABLE(id uuid, job_id uuid, assignee_user_id uuid, work_date date, time_start time without time zone, time_end time without time zone, note text, assignee_name text, job_hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jsb.id,
    jsb.job_id,
    jsb.assignee_user_id,
    jsb.work_date,
    jsb.time_start,
    jsb.time_end,
    jsb.note,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    COALESCE(jl.job_name, b.project_name) AS job_name,
    COALESCE(jl.job_address, b.address) AS job_address
  FROM public.job_schedule_blocks jsb
  LEFT JOIN public.jobs_ledger jl ON jl.id = jsb.job_id
  LEFT JOIN public.bids b ON b.id = jsb.bid_id
  LEFT JOIN public.users u ON u.id = jsb.assignee_user_id
  WHERE jsb.work_date BETWEEN p_start AND p_end
    AND (
      (jsb.bid_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer
                   AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'))
      ))
      OR (jsb.job_id IS NOT NULL AND (
        jsb.assignee_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'dev')
        OR jl.master_user_id = p_viewer
        OR EXISTS (SELECT 1 FROM public.users WHERE id = p_viewer AND role = 'primary')
        OR EXISTS (
          SELECT 1 FROM public.master_superintendents ms
          WHERE ms.master_id = jl.master_user_id AND ms.superintendent_id = p_viewer
        )
        OR (jl.project_id IS NOT NULL AND public.can_access_project_row_for_user(jl.project_id, p_viewer))
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = p_viewer AND assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_id = jl.master_user_id AND assistant_id = p_viewer
        )
        OR public.assistants_share_master(p_viewer, jl.master_user_id)
        OR EXISTS (
          SELECT 1 FROM public.jobs_ledger_team_members jtm
          WHERE jtm.job_id = jl.id AND jtm.user_id = p_viewer
        )
      ))
    )
  ORDER BY assignee_name ASC, jsb.work_date ASC, jsb.time_start ASC;
$function$;

-- list_tally_parts_with_po()
CREATE OR REPLACE FUNCTION public.list_tally_parts_with_po()
 RETURNS TABLE(id uuid, job_id uuid, fixture_name text, part_id uuid, quantity numeric, created_by_user_id uuid, created_at timestamp with time zone, price_at_time numeric, fixture_cost numeric, purchase_order_id uuid, purchase_order_name text, purchase_order_status text, hcp_number text, job_name text, job_address text, part_name text, part_manufacturer text, created_by_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jtp.id, jtp.job_id, jtp.fixture_name, jtp.part_id, jtp.quantity, jtp.created_by_user_id, jtp.created_at,
    poi.price_at_time, jtp.fixture_cost, jtp.purchase_order_id, po.name AS purchase_order_name, po.status::TEXT AS purchase_order_status,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name, jl.job_address, mp.name AS part_name, mp.manufacturer AS part_manufacturer, u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
  WHERE EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    AND (jl.master_user_id = auth.uid() OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)))
  OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid()))
  OR (public.auth_uid_is_helpers_or_subcontractor()
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid()))
  ORDER BY jtp.created_at DESC;
$function$;

-- migrate_job_ledger_costs_and_delete(p_from uuid, p_to uuid, p_allow_billed boolean)
CREATE OR REPLACE FUNCTION public.migrate_job_ledger_costs_and_delete(p_from uuid, p_to uuid, p_allow_billed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_to_amt numeric(18, 4);
  v_to_pct numeric(5, 2);
  v_sum_pct numeric(5, 2);
  v_new jsonb;
  v_blocked_reason text;
  v_from_master uuid;
  v_to_master uuid;
  v_src_name text;
  v_src_number text;
  v_src_status text;
  v_src_pct numeric;
  v_tgt_status text;
  v_tgt_pct numeric;
  v_src_label text;
  v_note_body text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Invalid source or target job');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_from)
     OR NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  -- Same visibility as "Devs, masters, assistants can delete jobs ledger" (20260228140000_assistants_delete_jobs_ledger.sql)
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_from
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_to
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to migrate these jobs');
  END IF;

  SELECT jl.master_user_id INTO v_from_master FROM public.jobs_ledger jl WHERE jl.id = p_from;
  SELECT jl.master_user_id INTO v_to_master FROM public.jobs_ledger jl WHERE jl.id = p_to;

  -- Snapshot both sides' identity and progress before anything moves: the note
  -- and the return payload are the only record of the source's status/pct once
  -- the row is deleted.
  SELECT jl.job_name,
         COALESCE(NULLIF(trim(jl.hcp_number), ''), NULLIF(trim(jl.click_number), ''), '—'),
         jl.status, jl.pct_complete
    INTO v_src_name, v_src_number, v_src_status, v_src_pct
    FROM public.jobs_ledger jl WHERE jl.id = p_from;
  SELECT jl.status, jl.pct_complete INTO v_tgt_status, v_tgt_pct
    FROM public.jobs_ledger jl WHERE jl.id = p_to;

  -- Billing guard on source: do not bypass invoices, payments, collect-payment flows, or advanced job billing status.
  -- Skipped when p_allow_billed = true (reassign-and-delete from the Delete-job modal): the source job's own
  -- invoices/payments are intentionally allowed to cascade-delete with it; only costs/labor/revenue move.
  IF NOT p_allow_billed THEN
    SELECT CASE
      WHEN (jl.status IS DISTINCT FROM 'working' AND jl.status IS DISTINCT FROM 'ready_to_bill') THEN
        'Job billing status must be Working or Ready to bill before migrate-delete.'
      WHEN COALESCE(jl.payments_made, 0) <> 0 THEN 'Clear or resolve recorded payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_from) THEN 'Remove or resolve invoices on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = p_from) THEN 'Remove or resolve payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_from) THEN 'Finish or cancel the in-app collect payment flow for this job before migrate-delete.'
      ELSE NULL
    END INTO v_blocked_reason
    FROM public.jobs_ledger jl
    WHERE jl.id = p_from;

    IF v_blocked_reason IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'billing_blocked',
        'error', v_blocked_reason
      );
    END IF;
  END IF;

  BEGIN
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_from FOR UPDATE;
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_to FOR UPDATE;

    -- Mercury splits: UNIQUE (mercury_transaction_id, job_id) — merge amounts into target when both exist.
    FOR r IN
      SELECT id, mercury_transaction_id, amount
      FROM public.mercury_transaction_job_allocations
      WHERE job_id = p_from
    LOOP
      SELECT m.amount INTO v_to_amt
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = r.mercury_transaction_id AND m.job_id = p_to;

      IF v_to_amt IS NULL THEN
        UPDATE public.mercury_transaction_job_allocations
        SET job_id = p_to
        WHERE id = r.id;
      ELSE
        UPDATE public.mercury_transaction_job_allocations
        SET amount = v_to_amt + r.amount
        WHERE mercury_transaction_id = r.mercury_transaction_id AND job_id = p_to;
        DELETE FROM public.mercury_transaction_job_allocations WHERE id = r.id;
      END IF;
    END LOOP;

    -- Supply invoice allocations: PRIMARY KEY (invoice_id, job_id) — merge pct; cap at 100 per invoice line.
    FOR r IN
      SELECT invoice_id, pct
      FROM public.supply_house_invoice_job_allocations
      WHERE job_id = p_from
    LOOP
      SELECT a.pct INTO v_to_pct
      FROM public.supply_house_invoice_job_allocations a
      WHERE a.invoice_id = r.invoice_id AND a.job_id = p_to;

      IF v_to_pct IS NULL THEN
        UPDATE public.supply_house_invoice_job_allocations
        SET job_id = p_to
        WHERE invoice_id = r.invoice_id AND job_id = p_from;
      ELSE
        v_sum_pct := v_to_pct + r.pct;
        IF v_sum_pct > 100 THEN
          RETURN jsonb_build_object(
            'ok', false,
            'code', 'supply_alloc_overflow',
            'error',
            format('Merging supply invoice allocations would exceed 100%% for invoice %s.', r.invoice_id)
          );
        END IF;
        UPDATE public.supply_house_invoice_job_allocations
        SET pct = v_sum_pct
        WHERE invoice_id = r.invoice_id AND job_id = p_to;
        DELETE FROM public.supply_house_invoice_job_allocations
        WHERE invoice_id = r.invoice_id AND job_id = p_from;
      END IF;
    END LOOP;

    -- Crew grid: replace source job id with target; collapse duplicate job ids; renormalize percentages to 100.
    FOR r IN
      SELECT work_date, person_name, job_assignments
      FROM public.people_crew_jobs
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(job_assignments) AS e
        WHERE (e->>'job_id')::uuid = p_from
      )
    LOOP
      SELECT COALESCE(
        (
          WITH elems AS (
            SELECT
              CASE
                WHEN (e->>'job_id')::uuid = p_from THEN p_to
                ELSE (e->>'job_id')::uuid
              END AS jid,
              COALESCE((e->>'pct')::numeric, 0) AS pct
            FROM jsonb_array_elements(r.job_assignments) AS e
          ),
          collapsed AS (
            SELECT jid, SUM(pct) AS sp FROM elems GROUP BY jid
          ),
          tot AS (
            SELECT COALESCE(SUM(sp), 0)::numeric AS t FROM collapsed
          ),
          scaled AS (
            SELECT
              c.jid,
              CASE
                WHEN tot.t > 0 THEN ROUND((c.sp * (100.0 / tot.t))::numeric, 6)
                ELSE 0::numeric
              END AS pct
            FROM collapsed c
            CROSS JOIN tot
          )
          SELECT jsonb_agg(
            jsonb_build_object('job_id', scaled.jid::text, 'pct', scaled.pct)
            ORDER BY scaled.jid
          )
          FROM scaled
        ),
        '[]'::jsonb
      )
      INTO v_new;

      UPDATE public.people_crew_jobs
      SET job_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;
    END LOOP;

    UPDATE public.jobs_tally_parts SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.jobs_ledger_materials SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.clock_sessions SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.job_schedule_blocks SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.jobs_ledger_fixtures SET job_id = p_to WHERE job_id = p_from;
    UPDATE public.reports SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.inspections SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.jobs_ledger_thread_notes SET job_id = p_to WHERE job_id = p_from;
    -- Migrated status events keep telling the SOURCE job's story — tag them so
    -- history consumers can tell them apart from the target's native events.
    UPDATE public.job_status_events SET job_id = p_to, source_job_id = p_from WHERE job_id = p_from;
    UPDATE public.estimates SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.estimator_requests SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.dispatch_requests SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.stripe_oob_payment_reverts SET job_id = p_to WHERE job_id = p_from;

    UPDATE public.salary_work_schedule_templates
    SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_templates
    SET segment_b_job_ledger_id = p_to WHERE segment_b_job_ledger_id = p_from;

    UPDATE public.salary_work_schedule_day_overrides
    SET job_ledger_id = p_to WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides
    SET segment_b_job_ledger_id = p_to WHERE segment_b_job_ledger_id = p_from;

    INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
    SELECT p_to, jtm.user_id
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = p_from
    ON CONFLICT (job_id, user_id) DO NOTHING;

    DELETE FROM public.jobs_ledger_team_members WHERE job_id = p_from;

    -- Add source job revenue to target job total before removing source row.
    UPDATE public.jobs_ledger AS jl_to
    SET revenue = COALESCE(jl_to.revenue, 0) + COALESCE(jl_from.revenue, 0)
    FROM public.jobs_ledger AS jl_from
    WHERE jl_to.id = p_to AND jl_from.id = p_from;

    -- Visible record of the combine on the target's activity thread, authored
    -- by the operator. Body format is a contract with jobCombineNote.ts
    -- (compose/parse) — change them together.
    v_src_label := CASE v_src_status
      WHEN 'waiting' THEN 'Waiting'
      WHEN 'working' THEN 'Working'
      WHEN 'ready_to_bill' THEN 'Ready to bill'
      WHEN 'billed' THEN 'Billed'
      WHEN 'paid' THEN 'Paid'
      ELSE NULLIF(trim(COALESCE(v_src_status, '')), '')
    END;
    v_note_body := format('Combined "%s" (Job #%s) into this job', COALESCE(v_src_name, ''), v_src_number);
    IF v_src_label IS NOT NULL THEN
      v_note_body := v_note_body || ' — source was ' || v_src_label;
      IF v_src_pct IS NOT NULL THEN
        v_note_body := v_note_body || ' at ' || rtrim(to_char(v_src_pct, 'FM999999990.##'), '.') || '%';
      END IF;
    END IF;
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (p_to, auth.uid(), v_note_body);

    DELETE FROM public.common_jobs WHERE job_id = p_from;

    DELETE FROM public.jobs_ledger WHERE id = p_from;

    RETURN jsonb_build_object(
      'ok', true,
      'from_master_user_id', v_from_master,
      'to_master_user_id', v_to_master,
      'note_body', v_note_body,
      'source', jsonb_build_object(
        'job_name', v_src_name, 'number', v_src_number,
        'status', v_src_status, 'pct_complete', v_src_pct
      ),
      'target', jsonb_build_object('status', v_tgt_status, 'pct_complete', v_tgt_pct)
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'migrate_failed', 'error', SQLERRM);
  END;
END;
$function$;

-- migrate_job_ledger_costs_to_bid_and_delete(p_from uuid, p_to_bid uuid, p_allow_billed boolean, p_dry_run boolean)
CREATE OR REPLACE FUNCTION public.migrate_job_ledger_costs_to_bid_and_delete(p_from uuid, p_to_bid uuid, p_allow_billed boolean DEFAULT false, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_to_amt numeric(18,4);
  v_to_pct numeric(5,2);
  v_sum_pct numeric(5,2);
  v_new jsonb;
  v_blocked_reason text;
  v_revenue numeric;
  v_moved jsonb := '{}'::jsonb;
  v_dropped jsonb := '{}'::jsonb;
  v_n bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF p_from IS NULL OR p_to_bid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Invalid source job or target bid');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_from) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bids WHERE id = p_to_bid) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Bid not found');
  END IF;

  -- Source-job authority: identical to migrate_job_ledger_costs_and_delete.
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_from
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to migrate this job');
  END IF;

  -- Billing guard on the source job — same rules and same opt-out as job -> job.
  IF NOT p_allow_billed THEN
    SELECT CASE
      WHEN (jl.status IS DISTINCT FROM 'working' AND jl.status IS DISTINCT FROM 'ready_to_bill') THEN
        'Job billing status must be Working or Ready to bill before migrate-delete.'
      WHEN COALESCE(jl.payments_made, 0) <> 0 THEN 'Clear or resolve recorded payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_from) THEN 'Remove or resolve invoices on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = p_from) THEN 'Remove or resolve payments on this job before migrate-delete.'
      WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_from) THEN 'Finish or cancel the in-app collect payment flow for this job before migrate-delete.'
      ELSE NULL
    END INTO v_blocked_reason
    FROM public.jobs_ledger jl
    WHERE jl.id = p_from;

    IF v_blocked_reason IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'billing_blocked', 'error', v_blocked_reason);
    END IF;
  END IF;

  BEGIN
    PERFORM 1 FROM public.jobs_ledger WHERE id = p_from FOR UPDATE;
    PERFORM 1 FROM public.bids WHERE id = p_to_bid FOR UPDATE;

    -- Count what will be destroyed BEFORE anything moves, so the dry-run report
    -- and the real run agree exactly.
    SELECT jsonb_build_object(
      'fixtures',        (SELECT count(*) FROM public.jobs_ledger_fixtures WHERE job_id = p_from),
      'inspections',     (SELECT count(*) FROM public.inspections WHERE job_ledger_id = p_from),
      'thread_notes',    (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = p_from),
      'status_events',   (SELECT count(*) FROM public.job_status_events WHERE job_id = p_from),
      'team_members',    (SELECT count(*) FROM public.jobs_ledger_team_members WHERE job_id = p_from),
      'estimates',       (SELECT count(*) FROM public.estimates WHERE job_ledger_id = p_from),
      'invoices',        (SELECT count(*) FROM public.jobs_ledger_invoices WHERE job_id = p_from),
      'payments',        (SELECT count(*) FROM public.jobs_ledger_payments WHERE job_id = p_from)
    ) INTO v_dropped;

    SELECT COALESCE(revenue, 0) INTO v_revenue FROM public.jobs_ledger WHERE id = p_from;

    -- ---- Mercury card splits: UNIQUE (tx, bid) — merge amounts on collision.
    v_n := 0;
    FOR r IN SELECT id, mercury_transaction_id, amount, note, created_by
             FROM public.mercury_transaction_job_allocations WHERE job_id = p_from
    LOOP
      SELECT m.amount INTO v_to_amt
      FROM public.mercury_transaction_bid_allocations m
      WHERE m.mercury_transaction_id = r.mercury_transaction_id AND m.bid_id = p_to_bid;

      IF v_to_amt IS NULL THEN
        INSERT INTO public.mercury_transaction_bid_allocations
          (mercury_transaction_id, bid_id, amount, note, created_by, migrated_from_job_id)
        VALUES (r.mercury_transaction_id, p_to_bid, r.amount, r.note, r.created_by, p_from);
      ELSE
        UPDATE public.mercury_transaction_bid_allocations
        SET amount = v_to_amt + r.amount
        WHERE mercury_transaction_id = r.mercury_transaction_id AND bid_id = p_to_bid;
      END IF;
      DELETE FROM public.mercury_transaction_job_allocations WHERE id = r.id;
      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('mercury_allocations', v_n);

    -- ---- Supply-house invoice allocations. The 100% ceiling per invoice spans
    -- BOTH the job and bid tables now, so sum across both before accepting.
    v_n := 0;
    FOR r IN SELECT invoice_id, pct
             FROM public.supply_house_invoice_job_allocations WHERE job_id = p_from
    LOOP
      SELECT a.pct INTO v_to_pct
      FROM public.supply_house_invoice_bid_allocations a
      WHERE a.invoice_id = r.invoice_id AND a.bid_id = p_to_bid;

      v_sum_pct := COALESCE(v_to_pct, 0) + r.pct
                 + COALESCE((SELECT sum(j.pct) FROM public.supply_house_invoice_job_allocations j
                             WHERE j.invoice_id = r.invoice_id AND j.job_id <> p_from), 0)
                 + COALESCE((SELECT sum(b.pct) FROM public.supply_house_invoice_bid_allocations b
                             WHERE b.invoice_id = r.invoice_id AND b.bid_id <> p_to_bid), 0);

      IF v_sum_pct > 100 THEN
        RETURN jsonb_build_object(
          'ok', false, 'code', 'supply_alloc_overflow',
          'error', format('Moving supply invoice allocations would exceed 100%% for invoice %s.', r.invoice_id)
        );
      END IF;

      IF v_to_pct IS NULL THEN
        INSERT INTO public.supply_house_invoice_bid_allocations (invoice_id, bid_id, pct, migrated_from_job_id)
        VALUES (r.invoice_id, p_to_bid, r.pct, p_from);
      ELSE
        UPDATE public.supply_house_invoice_bid_allocations
        SET pct = v_to_pct + r.pct
        WHERE invoice_id = r.invoice_id AND bid_id = p_to_bid;
      END IF;
      DELETE FROM public.supply_house_invoice_job_allocations
      WHERE invoice_id = r.invoice_id AND job_id = p_from;
      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('supply_allocations', v_n);

    -- ---- Parts-style rows and billed materials: copy across, then drop.
    WITH moved AS (
      INSERT INTO public.bids_tally_parts
        (bid_id, fixture_name, part_id, quantity, sequence_order, created_by_user_id,
         created_at, purchase_order_id, fixture_cost, migrated_from_job_id)
      SELECT p_to_bid, t.fixture_name, t.part_id, t.quantity, t.sequence_order, t.created_by_user_id,
             t.created_at, t.purchase_order_id, t.fixture_cost, p_from
      FROM public.jobs_tally_parts t WHERE t.job_id = p_from
      RETURNING 1
    ) SELECT count(*) INTO v_n FROM moved;
    DELETE FROM public.jobs_tally_parts WHERE job_id = p_from;
    v_moved := v_moved || jsonb_build_object('tally_parts', v_n);

    WITH moved AS (
      INSERT INTO public.bids_materials
        (bid_id, description, amount, sequence_order, created_at, migrated_from_job_id)
      SELECT p_to_bid, m.description, m.amount, m.sequence_order, m.created_at, p_from
      FROM public.jobs_ledger_materials m WHERE m.job_id = p_from
      RETURNING 1
    ) SELECT count(*) INTO v_n FROM moved;
    DELETE FROM public.jobs_ledger_materials WHERE job_id = p_from;
    v_moved := v_moved || jsonb_build_object('materials', v_n);

    -- ---- Records that carry a bid anchor of their own: re-anchor in place.
    -- clock_sessions and reports both enforce "exactly one anchor", so
    -- job_ledger_id must be cleared in the same statement that sets bid_id.
    -- Keep the moved session ids: people_hours is resynced per session below,
    -- and after the UPDATE they can no longer be found by job_ledger_id.
    CREATE TEMP TABLE IF NOT EXISTS _migrated_sessions (id uuid) ON COMMIT DROP;
    DELETE FROM _migrated_sessions WHERE true;
    INSERT INTO _migrated_sessions (id)
    SELECT id FROM public.clock_sessions WHERE job_ledger_id = p_from;

    UPDATE public.clock_sessions SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('clock_sessions', v_n);

    UPDATE public.reports SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('reports', v_n);

    UPDATE public.dispatch_requests SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('dispatch_requests', v_n);

    UPDATE public.estimator_requests SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_moved := v_moved || jsonb_build_object('estimator_requests', v_n);

    UPDATE public.salary_work_schedule_templates SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_templates SET segment_b_job_ledger_id = NULL WHERE segment_b_job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides SET job_ledger_id = NULL, bid_id = p_to_bid WHERE job_ledger_id = p_from;
    UPDATE public.salary_work_schedule_day_overrides SET segment_b_job_ledger_id = NULL WHERE segment_b_job_ledger_id = p_from;

    -- ---- Crew grid: lift this job's share of each person-day onto the bid,
    -- collapsing duplicates and renormalising both sides to 100, exactly as the
    -- job -> job version does within people_crew_jobs.
    v_n := 0;
    FOR r IN
      SELECT work_date, person_name, person_id, crew_lead_person_name, job_assignments
      FROM public.people_crew_jobs
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(job_assignments) e
                    WHERE (e->>'job_id')::uuid = p_from)
    LOOP
      INSERT INTO public.people_crew_bids (work_date, person_name, person_id, crew_lead_person_name, bid_assignments)
      VALUES (r.work_date, r.person_name, r.person_id, r.crew_lead_person_name, '[]'::jsonb)
      ON CONFLICT (work_date, person_name) DO NOTHING;

      SELECT COALESCE((
        WITH existing AS (
          SELECT (e->>'bid_id')::uuid AS bid, COALESCE((e->>'pct')::numeric, 0) AS pct
          FROM public.people_crew_bids b, jsonb_array_elements(b.bid_assignments) e
          WHERE b.work_date = r.work_date AND b.person_name = r.person_name
        ),
        incoming AS (
          SELECT p_to_bid AS bid, COALESCE(sum((e->>'pct')::numeric), 0) AS pct
          FROM jsonb_array_elements(r.job_assignments) e
          WHERE (e->>'job_id')::uuid = p_from
        ),
        collapsed AS (
          SELECT bid, sum(pct) AS sp FROM (SELECT * FROM existing UNION ALL SELECT * FROM incoming) u GROUP BY bid
        ),
        tot AS (SELECT COALESCE(sum(sp), 0)::numeric AS t FROM collapsed)
        SELECT jsonb_agg(jsonb_build_object('bid_id', c.bid::text,
                 'pct', CASE WHEN tot.t > 0 THEN round((c.sp * (100.0 / tot.t))::numeric, 6) ELSE 0::numeric END)
               ORDER BY c.bid)
        FROM collapsed c CROSS JOIN tot
      ), '[]'::jsonb) INTO v_new;

      UPDATE public.people_crew_bids SET bid_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;

      -- Drop this job from the crew-jobs row and renormalise what remains.
      SELECT COALESCE((
        WITH elems AS (
          SELECT (e->>'job_id')::uuid AS jid, COALESCE((e->>'pct')::numeric, 0) AS pct
          FROM jsonb_array_elements(r.job_assignments) e
          WHERE (e->>'job_id')::uuid <> p_from
        ),
        collapsed AS (SELECT jid, sum(pct) AS sp FROM elems GROUP BY jid),
        tot AS (SELECT COALESCE(sum(sp), 0)::numeric AS t FROM collapsed)
        SELECT jsonb_agg(jsonb_build_object('job_id', c.jid::text,
                 'pct', CASE WHEN tot.t > 0 THEN round((c.sp * (100.0 / tot.t))::numeric, 6) ELSE 0::numeric END)
               ORDER BY c.jid)
        FROM collapsed c CROSS JOIN tot
      ), '[]'::jsonb) INTO v_new;

      UPDATE public.people_crew_jobs SET job_assignments = v_new
      WHERE work_date = r.work_date AND person_name = r.person_name;

      v_n := v_n + 1;
    END LOOP;
    v_moved := v_moved || jsonb_build_object('crew_day_rows', v_n);

    -- ---- Schedule blocks follow the bid (v2.1624 — bid anchors exist since
    -- v2.1613). Repointed BEFORE the job row deletes so the FK cascade never
    -- sees them; dispatch keeps the visits under the bid.
    UPDATE public.job_schedule_blocks SET job_id = NULL, bid_id = p_to_bid WHERE job_id = p_from;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_moved := v_moved || jsonb_build_object('schedule_blocks', v_n);

    -- ---- Everything else dies with the job (counted above).
    DELETE FROM public.jobs_ledger_team_members WHERE job_id = p_from;
    DELETE FROM public.common_jobs WHERE job_id = p_from;
    DELETE FROM public.jobs_ledger WHERE id = p_from;

    -- ---- people_hours is incrementally maintained (approve adds, revoke
    -- subtracts), so every re-anchored session must be recomputed or the
    -- People -> Hours grid silently drifts. Takes a SESSION id, one call each.
    FOR r IN SELECT id FROM _migrated_sessions LOOP
      PERFORM public.recompute_people_hours_after_session_edit(r.id);
    END LOOP;

    IF p_dry_run THEN
      RAISE EXCEPTION '__DRY_RUN__' USING ERRCODE = 'raise_exception';
    END IF;

    RETURN jsonb_build_object('ok', true, 'dry_run', false, 'bid_id', p_to_bid,
                              'moved', v_moved, 'dropped', v_dropped, 'revenue_dropped', v_revenue);
  EXCEPTION WHEN OTHERS THEN
    -- plpgsql rolls back the block's DB writes but keeps variable values, so the
    -- dry-run report survives the deliberate abort.
    IF SQLERRM = '__DRY_RUN__' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'bid_id', p_to_bid,
                                'moved', v_moved, 'dropped', v_dropped, 'revenue_dropped', v_revenue);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'migrate_failed', 'error', SQLERRM);
  END;
END;
$function$;

-- record_estimate_decline(p_estimate_id uuid, p_note text, p_channel text)
CREATE OR REPLACE FUNCTION public.record_estimate_decline(p_estimate_id uuid, p_note text DEFAULT ''::text, p_channel text DEFAULT 'phone'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.estimates%ROWTYPE;
  v_note text := left(btrim(regexp_replace(COALESCE(p_note, ''), '\s+', ' ', 'g')), 280);
  v_channel text := CASE WHEN p_channel IN ('phone', 'in_person', 'email', 'text', 'other') THEN p_channel ELSE 'other' END;
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent')
  ) THEN
    RAISE EXCEPTION 'You do not have access to estimates' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.estimates e WHERE e.id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  IF NOT (
    public.user_can_access_estimate(v_row)
    OR public.superintendent_can_access_estimate(v_row)
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = v_uid
        AND u.role IN ('dev', 'assistant', 'controller', 'estimator', 'master_technician', 'primary')
    )
  ) THEN
    RAISE EXCEPTION 'You do not have access to this estimate' USING ERRCODE = '42501';
  END IF;

  IF v_row.status IS DISTINCT FROM 'sent'::public.estimate_status THEN
    RAISE EXCEPTION 'Only a sent estimate can be marked declined (this one is %)', v_row.status;
  END IF;

  UPDATE public.estimates
     SET status = 'declined'::public.estimate_status
   WHERE id = p_estimate_id
     AND status = 'sent'::public.estimate_status;

  INSERT INTO public.estimate_customer_events (
    estimate_id, event_type, source, client_ip, user_agent, metadata
  ) VALUES (
    p_estimate_id,
    'declined',
    'record_estimate_decline',
    NULL,
    NULL,
    jsonb_build_object('by', 'staff', 'channel', v_channel, 'note', v_note, 'user_id', v_uid)
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('ok', true, 'estimate_id', p_estimate_id, 'event_id', v_event_id);
END;
$function$;

-- set_material_po_generator_stated_need(p_id uuid, p_notes text)
CREATE OR REPLACE FUNCTION public.set_material_po_generator_stated_need(p_id uuid, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT e.job_ledger_id INTO v_job
  FROM public.material_po_generator_entries e
  WHERE e.id = p_id;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'PO code not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger jl
    WHERE jl.id = v_job
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = auth.uid() AND ma.assistant_id = jl.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = jl.master_user_id AND ma.assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'job not accessible';
  END IF;

  UPDATE public.material_po_generator_entries
  SET notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_id;
END;
$function$;

-- split_job_ledger_fixtures_to_new_job(p_source_job_id uuid, p_fixture_ids uuid[], p_new_hcp text, p_new_job_name text, p_new_job_address text, p_clock_session_ids uuid[])
CREATE OR REPLACE FUNCTION public.split_job_ledger_fixtures_to_new_job(p_source_job_id uuid, p_fixture_ids uuid[], p_new_hcp text, p_new_job_name text, p_new_job_address text, p_clock_session_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src public.jobs_ledger%ROWTYPE;
  v_new_job_id uuid;
  v_split_revenue numeric(14, 2);
  v_total_fixtures int;
  v_move_n int;
  v_new_hcp text;
  v_new_name text;
  v_new_addr text;
  v_blocked_reason text;
  v_bad_fixture int;
  v_bad_session int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  v_new_hcp := trim(COALESCE(p_new_hcp, ''));
  v_new_name := trim(COALESCE(p_new_job_name, ''));
  v_new_addr := trim(COALESCE(p_new_job_address, ''));

  IF p_source_job_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Source job is required');
  END IF;

  IF p_fixture_ids IS NULL OR cardinality(p_fixture_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Select at least one Specific Work line to move');
  END IF;

  IF v_new_hcp = '' OR v_new_name = '' OR v_new_addr = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'New HCP, job name, and address are required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_source_job_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Job not found');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger jl
      WHERE jl.id = p_source_job_id
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authorized', 'error', 'Not authorized to split this job');
  END IF;

  SELECT CASE
    WHEN jl.status IS DISTINCT FROM 'working' THEN 'Only Working jobs can be split with this tool.'
    WHEN COALESCE(jl.payments_made, 0) <> 0 THEN 'Clear or resolve recorded payments on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.job_id = p_source_job_id) THEN
      'Remove or resolve invoices on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.job_id = p_source_job_id) THEN
      'Remove or resolve payments on this job before splitting.'
    WHEN EXISTS (SELECT 1 FROM public.job_collect_payment_flows c WHERE c.job_id = p_source_job_id) THEN
      'Finish or cancel the in-app collect payment flow for this job before splitting.'
    ELSE NULL
  END INTO v_blocked_reason
  FROM public.jobs_ledger jl
  WHERE jl.id = p_source_job_id;

  IF v_blocked_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_blocked', 'error', v_blocked_reason);
  END IF;

  SELECT COUNT(*) INTO v_total_fixtures
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_source_job_id;

  SELECT COUNT(DISTINCT x.id)::int INTO v_move_n
  FROM unnest(p_fixture_ids) AS x(id);

  IF v_total_fixtures = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_args', 'error', 'Source job has no Specific Work lines to split.');
  END IF;

  IF v_move_n >= v_total_fixtures THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'invalid_args',
      'error',
      'Leave at least one Specific Work line on the original job, or use Combine / Migrate instead of split.'
    );
  END IF;

  SELECT COUNT(*) INTO v_bad_fixture
  FROM unnest(p_fixture_ids) AS x(id)
  LEFT JOIN public.jobs_ledger_fixtures f ON f.id = x.id AND f.job_id = p_source_job_id
  WHERE f.id IS NULL;

  IF v_bad_fixture > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_fixtures', 'error', 'One or more lines are missing or do not belong to this job.');
  END IF;

  IF p_clock_session_ids IS NOT NULL AND cardinality(p_clock_session_ids) > 0 THEN
    SELECT COUNT(*) INTO v_bad_session
    FROM unnest(p_clock_session_ids) AS x(id)
    LEFT JOIN public.clock_sessions cs ON cs.id = x.id AND cs.job_ledger_id = p_source_job_id
    WHERE cs.id IS NULL;

    IF v_bad_session > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'invalid_sessions',
        'error',
        'One or more clock sessions are missing or not linked to this job.'
      );
    END IF;
  END IF;

  SELECT COALESCE(
    ROUND(
      SUM(
        CASE
          WHEN trim(COALESCE(f.name, '')) = '' THEN 0::numeric
          ELSE
            (
              CASE
                WHEN f.count IS NOT NULL AND f.count > 0 THEN f.count::numeric
                ELSE 1::numeric
              END
            ) * COALESCE(f.line_unit_price, 0::numeric)
        END
      )::numeric,
      2
    ),
    0::numeric
  ) INTO v_split_revenue
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_source_job_id AND f.id = ANY (p_fixture_ids);

  BEGIN
    SELECT * INTO v_src FROM public.jobs_ledger jl WHERE jl.id = p_source_job_id FOR UPDATE;

    INSERT INTO public.jobs_ledger (
      master_user_id,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      project_id,
      service_type_id,
      bid_id,
      hcp_number,
      job_name,
      job_address,
      google_drive_link,
      job_plans_link,
      job_pictures_link,
      status,
      revenue,
      payments_made,
      pct_complete,
      last_bill_date,
      last_work_date
    )
    VALUES (
      v_src.master_user_id,
      v_src.customer_id,
      v_src.customer_name,
      v_src.customer_email,
      v_src.customer_phone,
      v_src.project_id,
      v_src.service_type_id,
      v_src.bid_id,
      v_new_hcp,
      v_new_name,
      v_new_addr,
      v_src.google_drive_link,
      v_src.job_plans_link,
      v_src.job_pictures_link,
      'working',
      v_split_revenue,
      0,
      NULL,
      NULL,
      NULL
    )
    RETURNING id INTO v_new_job_id;

    UPDATE public.jobs_ledger_fixtures f
    SET job_id = v_new_job_id
    WHERE f.id = ANY (p_fixture_ids);

    IF p_clock_session_ids IS NOT NULL AND cardinality(p_clock_session_ids) > 0 THEN
      UPDATE public.clock_sessions cs
      SET job_ledger_id = v_new_job_id
      WHERE cs.id = ANY (p_clock_session_ids);
    END IF;

    UPDATE public.jobs_ledger jl
    SET revenue = GREATEST(0::numeric, COALESCE(jl.revenue, 0) - v_split_revenue)
    WHERE jl.id = p_source_job_id;

    INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
    SELECT v_new_job_id, jtm.user_id
    FROM public.jobs_ledger_team_members jtm
    WHERE jtm.job_id = p_source_job_id
    ON CONFLICT (job_id, user_id) DO NOTHING;

    -- Ledger: record the split on both the source job and the new job.
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES
      (p_source_job_id, 'job_separated', now(), auth.uid(),
       'Split ' || v_move_n || ' line(s) to new job ' || v_new_hcp,
       jsonb_build_object('new_job_id', v_new_job_id, 'moved_lines', v_move_n,
                          'source_id', p_source_job_id::text || ':sep:' || v_new_job_id::text), false),
      (v_new_job_id, 'job_separated', now(), auth.uid(),
       'Created by splitting ' || v_move_n || ' line(s) from ' || COALESCE(NULLIF(trim(v_src.hcp_number), ''), v_src.job_name, 'job'),
       jsonb_build_object('source_job_id', p_source_job_id,
                          'source_id', v_new_job_id::text || ':sepnew:' || p_source_job_id::text), false);

    RETURN jsonb_build_object('ok', true, 'new_job_id', v_new_job_id, 'split_revenue', v_split_revenue);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'split_failed', 'error', SQLERRM);
  END;
END;
$function$;

-- staff_can_view_user_for_tally_followup(p_viewer uuid, p_target uuid)
CREATE OR REPLACE FUNCTION public.staff_can_view_user_for_tally_followup(p_viewer uuid, p_target uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_viewer IS NULL OR p_target IS NULL THEN
    RETURN false;
  END IF;
  IF p_viewer = p_target THEN
    RETURN true;
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_dev() OR v_role = 'dev' THEN
    RETURN true;
  END IF;

  IF v_role = 'master_technician' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.master_assistants ma
      WHERE ma.master_id = p_viewer AND ma.assistant_id = p_target
    )
    OR EXISTS (
      SELECT 1
      FROM public.jobs_ledger jl
      INNER JOIN public.jobs_ledger_team_members jtm
        ON jtm.job_id = jl.id AND jtm.user_id = p_target
      WHERE jl.master_user_id = p_viewer
    );
  END IF;

  IF v_role IN ('assistant', 'controller') THEN
    RETURN public.assistants_share_master(p_viewer, p_target)
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = p_target AND ma.assistant_id = p_viewer
      )
      OR EXISTS (
        SELECT 1
        FROM public.jobs_ledger jl
        INNER JOIN public.jobs_ledger_team_members jtm
          ON jtm.job_id = jl.id AND jtm.user_id = p_target
        WHERE jl.master_user_id IN (
          SELECT ma2.master_id
          FROM public.master_assistants ma2
          WHERE ma2.assistant_id = p_viewer
        )
      );
  END IF;

  RETURN false;
END;
$function$;

-- update_job_status(p_job_id uuid, p_to_status text)
CREATE OR REPLACE FUNCTION public.update_job_status(p_job_id uuid, p_to_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status TEXT;
  v_master_id UUID;
  v_can_update BOOLEAN := false;
  v_deleted_rtb INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jl.status, jl.master_user_id INTO v_current_status, v_master_id
  FROM public.jobs_ledger jl
  WHERE jl.id = p_job_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF p_to_status = 'ready_to_bill' THEN
    IF v_current_status = 'working' THEN
      v_can_update :=
        -- Team-member path: any team member, including helpers.
        EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = p_job_id AND user_id = auth.uid())
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
          AND (v_master_id = auth.uid()
            OR public.is_dev()
            OR public.is_office_or_estimator()
            OR public.is_office_or_estimator()
            OR public.assistants_share_master(auth.uid(), v_master_id)))
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
          AND EXISTS (
            SELECT 1 FROM public.jobs_ledger jl2
            JOIN public.projects p ON p.id = jl2.project_id
            WHERE jl2.id = p_job_id
              AND (EXISTS (SELECT 1 FROM public.project_superintendents WHERE project_id = p.id AND superintendent_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.master_superintendents WHERE master_id = p.master_user_id AND superintendent_id = auth.uid()))
          ));
    ELSIF v_current_status = 'billed' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Working or Billed to mark Ready for Billing');
    END IF;
  ELSIF p_to_status = 'billed' THEN
    IF v_current_status = 'ready_to_bill' THEN
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'paid' THEN
      -- Revert: paid -> billed (dev/master/assistant/primary with job access)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Paid to mark as Billed');
    END IF;
  ELSIF p_to_status = 'paid' THEN
    IF v_current_status <> 'billed' THEN
      RETURN jsonb_build_object('error', 'Job must be in Billed to mark as Paid');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSIF p_to_status = 'working' THEN
    IF v_current_status = 'ready_to_bill' THEN
      -- Revert: ready_to_bill -> working (office only; deletes RTB drafts below)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSIF v_current_status = 'waiting' THEN
      -- Manual promote: waiting -> working (office only; no side effects)
      v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
        AND (v_master_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), v_master_id));
    ELSE
      RETURN jsonb_build_object('error', 'Job must be in Ready to Bill or Waiting to move to Working');
    END IF;
  ELSIF p_to_status = 'waiting' THEN
    -- Send back: working -> waiting (office only; no side effects)
    IF v_current_status <> 'working' THEN
      RETURN jsonb_build_object('error', 'Job must be in Working to send back to Waiting');
    END IF;
    v_can_update := EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller'))
      AND (v_master_id = auth.uid()
        OR public.is_dev()
        OR public.is_office_or_estimator()
        OR public.is_office_or_estimator()
        OR public.assistants_share_master(auth.uid(), v_master_id));
  ELSE
    RETURN jsonb_build_object('error', 'Invalid status');
  END IF;

  IF NOT v_can_update THEN
    RETURN jsonb_build_object('error', 'Not authorized to update job status');
  END IF;

  IF p_to_status = 'working' AND v_current_status = 'ready_to_bill' THEN
    DELETE FROM public.jobs_ledger_invoices
    WHERE job_id = p_job_id
      AND status = 'ready_to_bill';
    GET DIAGNOSTICS v_deleted_rtb = ROW_COUNT;
  END IF;

  UPDATE public.jobs_ledger SET status = p_to_status, updated_at = NOW() WHERE id = p_job_id;

  -- Event logging moved to the jobs_ledger_log_status_transition trigger
  -- (v2.1435 single-writer rule) — do NOT reintroduce an INSERT here.

  RETURN jsonb_build_object('ok', true, 'deleted_ready_to_bill_invoices', v_deleted_rtb);
END;
$function$;

-- update_step_assigned_to(p_step_id uuid, p_assigned_to_name text)
CREATE OR REPLACE FUNCTION public.update_step_assigned_to(p_step_id uuid, p_assigned_to_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Access check: dev, master, owner, adopted, shared, OR assistant (assigned or can_access)
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant', 'controller'))
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
            AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
          WHERE s.id = p_step_id
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
  SET assigned_to_name = p_assigned_to_name
  WHERE id = p_step_id;
END;
$function$;

-- update_step_assignment(p_step_id uuid, p_assigned_to_name text, p_person_id uuid)
CREATE OR REPLACE FUNCTION public.update_step_assignment(p_step_id uuid, p_assigned_to_name text, p_person_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Access check: dev, master, owner, adopted, shared, OR assistant (assigned or can_access)
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant', 'controller'))
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
$function$;

-- update_step_notes(p_step_id uuid, p_notes text)
CREATE OR REPLACE FUNCTION public.update_step_notes(p_step_id uuid, p_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant', 'controller'))
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
            AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
          WHERE s.id = p_step_id
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
  SET notes = p_notes
  WHERE id = p_step_id;
END;
$function$;

-- update_step_private_notes(p_step_id uuid, p_private_notes text)
CREATE OR REPLACE FUNCTION public.update_step_private_notes(p_step_id uuid, p_private_notes text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.can_access_project_via_step(p_step_id)
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('assistant', 'controller'))
      AND (
        EXISTS (
          SELECT 1 FROM public.project_workflow_steps s
          JOIN public.users u ON u.id = auth.uid() AND u.name IS NOT NULL
            AND LOWER(TRIM(u.name)) = LOWER(TRIM(s.assigned_to_name))
          WHERE s.id = p_step_id
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
  SET private_notes = p_private_notes
  WHERE id = p_step_id;
END;
$function$;

-- user_can_manage_estimate_catalog()
CREATE OR REPLACE FUNCTION public.user_can_manage_estimate_catalog()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev','master_technician','assistant', 'controller','estimator','primary','superintendent')
  );
$function$;

-- user_can_manage_recurring_job_report_scope(p_scope_master_user_id uuid)
CREATE OR REPLACE FUNCTION public.user_can_manage_recurring_job_report_scope(p_scope_master_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.archived_at IS NULL)
    AND (
      public.is_dev()
      OR (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.role IN ('master_technician', 'assistant', 'controller')
        )
        AND (
          p_scope_master_user_id = auth.uid()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), p_scope_master_user_id)
        )
      )
    );
$function$;
