SET lock_timeout = '3s';

-- Papers before a job opens, step 5 of seven: the lists and the functions that never ask row security. Step 4 closed
-- a job's rows to the crew and subs who owe it a paper. These functions run as their definer and name jobs to
-- whoever calls them, so each now asks the lock itself.
--
--   * job_shut_to_user(job, user) and jobs_shut_to_user(user): the lock's question about a named person, for the
--     edge functions that read with the service key (the push notices, the schedule emails, plan-set-files) and for
--     the two schedule functions below, which are keyed on a recipient. The same rule as job_shut_to_me: the person
--     owes a paper on the job and is not one of the prompt-only roles. Service role only.
--   * Four list functions, each from its newest definition (named beside it), answer a locked job with its number
--     alone: search_jobs_ledger, list_assigned_jobs_for_dashboard, list_superintendent_jobs_for_dashboard and
--     list_jobs_for_tally. list_reports_with_job_info leaves a locked job's reports out. No returned column changes,
--     so every caller keeps working.
--   * search_jobs_ledger also stops a locked job answering a search by its name, its address or its development: it
--     is found by its number alone. Otherwise typing a name would hand back the number of the job that carries it.
--   * The two functions the schedule emails read, list_job_schedule_blocks_for_schedule_email and
--     list_schedule_blocks_for_share, blank a block's job name, address and note for a person locked out of it.
--
--   * job_papers_roster leaves the walk tester out of the office it lists.
--
-- Nothing changes while no job requires a paper: every answer begins with the look at job_required_papers' live rows.
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE with unchanged RETURNS, so the grants in force stay.

-- 1) The lock's question about a named person.
CREATE OR REPLACE FUNCTION public.job_shut_to_user(p_job_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN p_job_id IS NULL OR p_user_id IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_user_id AND u.role::text IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.job_required_papers r
      WHERE r.job_id = p_job_id AND r.removed_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.person_contract_documents d
          JOIN public.people p ON p.id = d.person_id
          WHERE d.job_required_paper_id = r.id AND d.status = 'signed'
            AND p.account_user_id = p_user_id AND p.archived_at IS NULL
        )
    )
  END;
$$;

COMMENT ON FUNCTION public.job_shut_to_user(uuid, uuid) IS
  'Papers before a job opens: job_shut_to_me asked about a named user, for callers with no login of their own (the edge functions that read with the service key, the schedule email functions). True when that user owes a paper on the job and is not a prompt-only role (dev, master technician, assistant, controller, primary). Service role only.';
REVOKE EXECUTE ON FUNCTION public.job_shut_to_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_shut_to_user(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.jobs_shut_to_user(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN '{}'::uuid[]
    WHEN NOT EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.removed_at IS NULL) THEN '{}'::uuid[]
    ELSE coalesce((
      SELECT array_agg(DISTINCT r.job_id) FROM public.job_required_papers r
      WHERE r.removed_at IS NULL AND public.job_shut_to_user(r.job_id, p_user_id)
    ), '{}'::uuid[])
  END;
$$;

COMMENT ON FUNCTION public.jobs_shut_to_user(uuid) IS
  'Papers before a job opens: the ids of the jobs a named user is locked out of, the same rule as job_shut_to_user. Empty while no job requires a paper. Service role only.';
REVOKE EXECUTE ON FUNCTION public.jobs_shut_to_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_shut_to_user(uuid) TO service_role;


-- 2) search_jobs_ledger, from 20261102170000.
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT ''::text, include_billing_only boolean DEFAULT false)
RETURNS TABLE(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      coalesce(search_text, '') AS raw,
      public.escape_like_pattern(coalesce(search_text, '')) AS esc,
      -- Legacy "J1004" -> "1004": the remainder after the J, escaped.
      CASE
        WHEN length(coalesce(search_text, '')) >= 2 AND lower(left(search_text, 1)) = 'j'
        THEN public.escape_like_pattern(substring(search_text from 2))
      END AS j_rest,
      -- Papers before a job opens: the jobs the caller is locked out of, asked once.
      public.jobs_shut_to_me() AS shut
  )
  SELECT
    r.id,
    r.service_type_id,
    r.service_type_name,
    r.hcp_number,
    r.job_name,
    r.job_address,
    r.click_number
  FROM (
    SELECT
      jl.id,
      jl.service_type_id,
      coalesce(stj.name, '')::text AS service_type_name,
      coalesce(jl.hcp_number, '')::text AS hcp_number,
      -- A locked job answers with its number alone.
      CASE WHEN jl.id = ANY (q.shut) THEN '' ELSE coalesce(jl.job_name, '') END::text AS job_name,
      CASE WHEN jl.id = ANY (q.shut) THEN '' ELSE coalesce(jl.job_address, '') END::text AS job_address,
      coalesce(jl.click_number, '')::text AS click_number,
      coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') AS effective_number
    FROM public.jobs_ledger jl
    LEFT JOIN public.service_types stj ON stj.id = jl.service_type_id
    CROSS JOIN q
    WHERE (include_billing_only OR NOT jl.billing_only)
    AND (
      q.raw = ''
      OR jl.hcp_number ILIKE '%' || q.esc || '%'
      OR jl.click_number ILIKE '%' || q.esc || '%'
      OR (
        q.j_rest IS NOT NULL
        AND (
          jl.hcp_number ILIKE '%' || q.j_rest || '%'
          OR jl.click_number ILIKE '%' || q.j_rest || '%'
        )
      )
      -- The numbers a job answered to before a combine (prior_numbers, 2026-10-31): 'HCP 550', 'C# 543'.
      OR EXISTS (
        SELECT 1 FROM unnest(jl.prior_numbers) AS pn
        WHERE pn ILIKE '%' || q.esc || '%'
          OR (q.j_rest IS NOT NULL AND pn ILIKE '%' || q.j_rest || '%')
      )
      -- A locked job is found by its number alone: its name, address and development must not answer a search.
      OR (NOT jl.id = ANY (q.shut) AND jl.job_name ILIKE '%' || q.esc || '%')
      OR (NOT jl.id = ANY (q.shut) AND jl.job_address ILIKE '%' || q.esc || '%')
      -- The development the job sits in (2026-11-02): its name, archived or not.
      OR (
        q.raw <> ''
        AND NOT jl.id = ANY (q.shut)
        AND jl.development_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.developments d
          WHERE d.id = jl.development_id
            AND d.name ILIKE '%' || q.esc || '%'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.service_types st
        WHERE st.ledger_job_prefix IS NOT NULL
          AND btrim(st.ledger_job_prefix) <> ''
          AND q.raw <> ''
          AND length(q.raw) > length(btrim(st.ledger_job_prefix))
          AND lower(left(q.raw, length(btrim(st.ledger_job_prefix)))) = lower(btrim(st.ledger_job_prefix))
          AND (
            jl.hcp_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
            OR jl.click_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
          )
      )
    )
  ) r
  ORDER BY
    (CASE WHEN r.effective_number = '' THEN 1 ELSE 0 END),
    (substring(r.effective_number from '[0-9]+'))::numeric DESC NULLS LAST,
    r.effective_number DESC
  LIMIT 50;
$$;

-- 3) list_assigned_jobs_for_dashboard, from 20260722258000.
CREATE OR REPLACE FUNCTION public.list_assigned_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, master_user_id uuid, created_at timestamp with time zone, last_report_at timestamp with time zone, my_last_report_at timestamp with time zone, last_thread_note_at timestamp with time zone, last_clock_activity_at timestamp with time zone, last_schedule_activity_at timestamp with time zone, last_job_activity_at timestamp with time zone, project_id uuid, in_progress_stage_name text, in_progress_step_id uuid, status text, service_type_id uuid, service_type_name text, customer_name text, click_number text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    -- Papers before a job opens: a locked job answers with its number alone.
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_name END,
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_address END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.google_drive_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.job_plans_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.job_pictures_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.revenue END,
    jl.master_user_id,
    jl.created_at,
    (SELECT MAX(r.created_at) FROM public.reports r WHERE r.job_ledger_id = jl.id) AS last_report_at,
    (SELECT MAX(r.created_at) FROM public.reports r WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at)) FROM public.clock_sessions cs WHERE cs.job_ledger_id = jl.id AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at)) FROM public.job_schedule_blocks jb WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at)) FROM public.clock_sessions cs2 WHERE cs2.job_ledger_id = jl.id AND cs2.approved_at IS NOT NULL AND cs2.rejected_at IS NULL AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at)) FROM public.job_schedule_blocks jb2 WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
    jl.project_id,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE (SELECT s.name FROM public.project_workflows pw JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress' WHERE pw.project_id = jl.project_id LIMIT 1) END AS in_progress_stage_name,
    (SELECT s.id FROM public.project_workflows pw JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress' WHERE pw.project_id = jl.project_id LIMIT 1) AS in_progress_step_id,
    jl.status::text,
    jl.service_type_id,
    (SELECT stn.name FROM public.service_types stn WHERE stn.id = jl.service_type_id LIMIT 1) AS service_type_name,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.customer_name END,
    jl.click_number
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  CROSS JOIN (SELECT public.jobs_shut_to_me() AS ids) shut
  WHERE jl.status IN ('waiting', 'working')
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- 4) list_superintendent_jobs_for_dashboard, from 20260908050000.
CREATE OR REPLACE FUNCTION public.list_superintendent_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, created_at timestamp with time zone, my_last_report_at timestamp with time zone, project_id uuid, in_progress_stage_name text, in_progress_step_id uuid, click_number text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    -- Papers before a job opens: a locked job answers with its number alone.
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_name END,
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_address END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.google_drive_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.job_plans_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.job_pictures_link END,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE jl.revenue END,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    jl.project_id,
    CASE WHEN jl.id = ANY (shut.ids) THEN NULL ELSE (SELECT s.name
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) END AS in_progress_stage_name,
    (SELECT s.id
     FROM public.project_workflows pw
     JOIN public.project_workflow_steps s ON s.workflow_id = pw.id AND s.status = 'in_progress'
     WHERE pw.project_id = p.id
     LIMIT 1) AS in_progress_step_id,
    jl.click_number,
    jl.status::text AS status
  FROM public.jobs_ledger jl
  JOIN public.projects p ON p.id = jl.project_id
  CROSS JOIN (SELECT public.jobs_shut_to_me() AS ids) shut
  WHERE jl.project_id IS NOT NULL
    AND jl.status IN ('waiting', 'working')
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    -- Assigned projects only (project_superintendents). Adoption via
    -- master_superintendents is company-wide (v2.921) and grants no project
    -- access (v2.2836), so it is no longer consulted here.
    AND EXISTS (SELECT 1 FROM public.project_superintendents ps WHERE ps.project_id = p.id AND ps.superintendent_id = auth.uid())
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- 5) list_jobs_for_tally, from 20260619160000.
CREATE OR REPLACE FUNCTION public.list_jobs_for_tally()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    -- Papers before a job opens: a locked job answers with its number alone.
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_name END,
    CASE WHEN jl.id = ANY (shut.ids) THEN '' ELSE jl.job_address END
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  CROSS JOIN (SELECT public.jobs_shut_to_me() AS ids) shut
  WHERE EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('helpers', 'subcontractor')
  )
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

-- 6) list_reports_with_job_info, from 20260927233000.
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
  -- Papers before a job opens: a report on a job the caller is locked out of is part of that job, so it is left out.
  AND (r.job_ledger_id IS NULL OR r.job_ledger_id <> ALL ((SELECT public.jobs_shut_to_me())::uuid[]))
  ORDER BY r.created_at DESC;
$function$;

-- 7) The two functions the schedule emails read, from 20260927233000. Each is keyed on a person.
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
    -- Papers before a job opens: a job the recipient is locked out of keeps its number and its time, and nothing else.
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN NULL ELSE jsb.note END,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN 'Papers to sign first' ELSE COALESCE(jl.job_name, b.project_name) END AS job_name,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_recipient) THEN NULL ELSE COALESCE(jl.job_address, b.address) END AS job_address
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
    -- Papers before a job opens: a job the viewer is locked out of keeps its number and its time, and nothing else.
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN NULL ELSE jsb.note END,
    trim(COALESCE(u.name, '')) AS assignee_name,
    CASE WHEN jsb.bid_id IS NOT NULL
      THEN COALESCE('B' || NULLIF(b.bid_number, ''), 'Bid')
      ELSE COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')
    END AS job_hcp_number,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN 'Papers to sign first' ELSE COALESCE(jl.job_name, b.project_name) END AS job_name,
    CASE WHEN public.job_shut_to_user(jsb.job_id, p_viewer) THEN NULL ELSE COALESCE(jl.job_address, b.address) END AS job_address
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

-- 8) job_papers_roster, from 20261117220000: the office set leaves the walk tester out, as it leaves out the sample
-- accounts. The first walk on prod listed it among the office.
CREATE OR REPLACE FUNCTION public.job_papers_roster(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office reads who has signed a job''s papers.' USING ERRCODE = '42501';
  END IF;

  WITH live AS (
    SELECT r.id, r.paper_name, r.form_template_id, r.required_at, r.book_document_id
    FROM public.job_required_papers r WHERE r.job_id = p_job_id AND r.removed_at IS NULL
  ), by_user AS (
    SELECT u.id AS user_id, 'office'::text AS way
    FROM public.users u
    WHERE u.role::text IN ('dev', 'master_technician', 'assistant', 'controller')
      AND u.archived_at IS NULL AND u.login_attached_at IS NOT NULL
      AND NOT u.is_digital_twin AND NOT u.is_sample AND NOT u.is_walk_tester
    UNION
    SELECT m.user_id, 'crew' FROM public.jobs_ledger_team_members m WHERE m.job_id = p_job_id
    UNION
    SELECT b.assignee_user_id, 'crew' FROM public.job_schedule_blocks b
    WHERE b.job_id = p_job_id AND b.work_date >= date_trunc('week', public.app_today())::date - 7
  ), by_person AS (
    SELECT a.person_id, 'sub'::text AS way
    FROM public.people_labor_job_assignees a
    JOIN public.people_labor_jobs lj ON lj.id = a.labor_job_id
    WHERE lj.job_ledger_id = p_job_id
    UNION
    SELECT c.person_id, 'sub' FROM public.step_commitments c
    WHERE c.job_id = p_job_id AND c.status NOT IN ('draft', 'declined', 'cancelled')
    UNION
    SELECT d.person_id, 'paper' FROM public.person_contract_documents d
    JOIN live ON live.id = d.job_required_paper_id
    WHERE d.person_id IS NOT NULL
  ), members AS (
    SELECT bu.user_id,
      (SELECT p.id FROM public.people p WHERE p.account_user_id = bu.user_id AND p.archived_at IS NULL LIMIT 1) AS person_id,
      bu.way
    FROM by_user bu
    JOIN public.users u ON u.id = bu.user_id
    WHERE u.archived_at IS NULL AND NOT u.is_digital_twin
    UNION ALL
    SELECT p.account_user_id, p.id, bp.way
    FROM by_person bp
    JOIN public.people p ON p.id = bp.person_id
    WHERE p.archived_at IS NULL
  ), folded AS (
    SELECT coalesce(m.person_id, m.user_id) AS key,
      max(m.person_id::text)::uuid AS person_id,
      max(m.user_id::text)::uuid AS user_id,
      array_agg(DISTINCT m.way) FILTER (WHERE m.way <> 'paper') AS ways
    FROM members m
    WHERE coalesce(m.person_id, m.user_id) IS NOT NULL
    GROUP BY coalesce(m.person_id, m.user_id)
  ), rows AS (
    SELECT f.key, f.person_id, f.user_id, coalesce(f.ways, '{}'::text[]) AS ways,
      coalesce(nullif(btrim(p.name), ''), nullif(btrim(u.name), ''), 'No name') AS name,
      coalesce(u.role::text, p.kind, '') AS role,
      (u.id IS NOT NULL AND u.login_attached_at IS NOT NULL) AS has_login
    FROM folded f
    LEFT JOIN public.people p ON p.id = f.person_id
    LEFT JOIN public.users u ON u.id = f.user_id
  )
  SELECT jsonb_build_object(
    'job_number', public.job_paper_job_number(p_job_id),
    'papers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'paper_name', l.paper_name, 'is_form', l.form_template_id IS NOT NULL,
        'book_document_id', l.book_document_id, 'required_at', l.required_at
      ) ORDER BY l.required_at, l.id) FROM live l
    ), '[]'::jsonb),
    'people', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'key', r.key, 'person_id', r.person_id, 'user_id', r.user_id, 'name', r.name, 'role', r.role,
        'ways', to_jsonb(r.ways), 'has_login', r.has_login,
        'linked', r.person_id IS NOT NULL,
        'papers', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'required_paper_id', l.id, 'document_id', d.id, 'status', coalesce(d.status, 'none'),
            'signed_at', CASE WHEN d.status = 'signed' THEN d.signed_at END
          ) ORDER BY l.required_at, l.id)
          FROM live l
          LEFT JOIN public.person_contract_documents d ON d.job_required_paper_id = l.id AND d.person_id = r.person_id
        ), '[]'::jsonb)
      ) ORDER BY
        CASE WHEN 'office' = ANY (r.ways) THEN 0 WHEN 'crew' = ANY (r.ways) THEN 1 WHEN 'sub' = ANY (r.ways) THEN 2 ELSE 3 END,
        lower(r.name), r.key)
      FROM rows r
    ), '[]'::jsonb)
  ) INTO v_out;
  RETURN v_out;
END;
$$;
