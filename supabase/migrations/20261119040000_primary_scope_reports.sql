SET lock_timeout = '3s';

-- Primary scoping, part 4 — REPORTS (the owner's word of 2026-11-19: "A primary should only be able to see reports
-- for jobs they are the account manager of or the listed superintendent of they can no longer see all reports.").
--
-- Parts 1 to 3 (20260823171344, 171822, 172141; v2.2174 to v2.2177) scoped a primary's bids, estimates and jobs and
-- left reports open on purpose (D1 in part 3). Until now a primary read every field report in the company: the
-- "reports select access" policy names the role, and the three list functions are SECURITY DEFINER with the role in
-- their office list. This narrows the read, in the database, to:
--
--   * a report on a job the primary is the account manager of (primary_can_access_job, the predicate parts 1 to 3
--     run on: jobs_ledger.account_manager_user_id), or is listed on as superintendent. A job lists its
--     superintendent through its project: project_superintendents (the chips on Projects and Workflow) or
--     gc_projects.superintendent_user_id (the GC project's one), the two sources superintendent_scores reads;
--   * a report they wrote themselves, on any job: Settings, My reports is their own list, the edit window is theirs,
--     and a report they could not read back could not be saved (INSERT ... RETURNING reads the new row);
--   * a report on a project with no job, when they are listed on that project as superintendent;
--   * a report on a bid with no job, when the bid is one of theirs (primary_can_access_bid, part 1).
--
-- The same RESTRICTIVE mechanism as parts 1 to 3: a policy that bites only when the caller is a primary, so every
-- other role reads as before (NOT is_primary() is true and the policy is a no-op).
--
--   1. The predicates: primary_can_read_job_reports(job), primary_can_read_report(job, project, bid, author).
--   2. reports: primary_scope_reports, RESTRICTIVE FOR ALL. Every direct read goes through it, and so do the
--      invoker functions (list_latest_report_completion_pct, jobs_ledger_thread_note_stats,
--      list_my_accessible_job_activity_events, land_field_press) and the realtime feed.
--   3. report_photos: primary_scope_report_photos, RESTRICTIVE FOR ALL (their own shot, or a job whose reports they read).
--   4. The report-photos bucket: the read policy takes the same clause, so a signed link is refused too.
--   5. The definer functions, each from its live definition (pg_get_functiondef on a copy of the whole schema, every
--      migration applied, 2026-11-19) with ONE added clause: list_reports_with_job_info, list_reports_for_job_ledger,
--      list_reports_for_bid, and list_job_crew_position's newest-report percent.
--
-- Not touched: list_my_reports (the caller's own), the writes (insert_report, the insert and update policies), and
-- the two dashboard job lists' last-report time (a time on a job the caller is on the crew of, not a report).
-- Safe on either side of the client deploy: no name, argument or returned column changes, so the old client and the
-- new one both read through these and simply get fewer rows as a primary.
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE and DROP POLICY IF EXISTS + CREATE, so a second run changes nothing.
-- docs/migrations/20261119040000_primary_scope_reports.md.

-- ---------- 1 · the predicates ----------

-- The job's reports are open to the calling primary: its account manager (primary_can_access_job), or listed on the
-- job's project as superintendent.
CREATE OR REPLACE FUNCTION public.primary_can_read_job_reports(p_job_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT p_job_id IS NOT NULL
     AND (
       public.primary_can_access_job(p_job_id)
       OR EXISTS (
            SELECT 1
            FROM public.jobs_ledger j
            WHERE j.id = p_job_id
              AND j.project_id IS NOT NULL
              AND (
                EXISTS (SELECT 1 FROM public.project_superintendents ps
                        WHERE ps.project_id = j.project_id AND ps.superintendent_id = (SELECT auth.uid()))
                OR EXISTS (SELECT 1 FROM public.gc_projects gp
                           WHERE gp.project_id = j.project_id AND gp.superintendent_user_id = (SELECT auth.uid()))
              )
          )
     );
$$;
COMMENT ON FUNCTION public.primary_can_read_job_reports(uuid) IS
  'Primary scoping, reports: the caller is the job''s account manager (primary_can_access_job) or is listed as superintendent on the job''s project (project_superintendents, or gc_projects.superintendent_user_id).';
REVOKE ALL ON FUNCTION public.primary_can_read_job_reports(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.primary_can_read_job_reports(uuid) TO authenticated, service_role;

-- One report, by its anchors and its author. The job decides when there is one; a report on a project alone asks the
-- project's superintendents; a report on a bid alone asks the bid's people (part 1). The author always reads their own.
CREATE OR REPLACE FUNCTION public.primary_can_read_report(p_job_ledger_id uuid, p_project_id uuid, p_bid_id uuid, p_created_by uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       p_created_by = (SELECT auth.uid())
       OR CASE
            WHEN p_job_ledger_id IS NOT NULL THEN public.primary_can_read_job_reports(p_job_ledger_id)
            WHEN p_project_id IS NOT NULL THEN
              EXISTS (SELECT 1 FROM public.project_superintendents ps
                      WHERE ps.project_id = p_project_id AND ps.superintendent_id = (SELECT auth.uid()))
              OR EXISTS (SELECT 1 FROM public.gc_projects gp
                         WHERE gp.project_id = p_project_id AND gp.superintendent_user_id = (SELECT auth.uid()))
            WHEN p_bid_id IS NOT NULL THEN public.primary_can_access_bid(p_bid_id)
            ELSE false
          END
     );
$$;
COMMENT ON FUNCTION public.primary_can_read_report(uuid, uuid, uuid, uuid) IS
  'Primary scoping, reports (the owner''s word of 2026-11-19): the caller wrote the report, or its job is one whose reports they read (primary_can_read_job_reports: account manager or listed superintendent), or it sits on a project alone that lists them as superintendent, or on a bid alone that is theirs (primary_can_access_bid). Read by primary_scope_reports and the report list functions, each behind NOT is_primary().';
REVOKE ALL ON FUNCTION public.primary_can_read_report(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.primary_can_read_report(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- ---------- 2 · reports ----------

DROP POLICY IF EXISTS primary_scope_reports ON public.reports;
CREATE POLICY primary_scope_reports ON public.reports AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary()) OR public.primary_can_read_report(job_ledger_id, project_id, bid_id, created_by_user_id) )
  WITH CHECK ( NOT (SELECT public.is_primary()) OR public.primary_can_read_report(job_ledger_id, project_id, bid_id, created_by_user_id) );

-- ---------- 3 · report_photos ----------

DROP POLICY IF EXISTS primary_scope_report_photos ON public.report_photos;
CREATE POLICY primary_scope_report_photos ON public.report_photos AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary()) OR by_user_id = (SELECT auth.uid()) OR public.primary_can_read_job_reports(job_id) )
  WITH CHECK ( NOT (SELECT public.is_primary()) OR by_user_id = (SELECT auth.uid()) OR public.primary_can_read_job_reports(job_id) );

-- ---------- 4 · the report-photos bucket ----------

-- The read policy of 20261029220000 (dropped and made again, as that file does), with the primary's clause: their
-- own upload (the object's owner, or the taker on its report_photos row), or a job whose reports they read. Objects are named <job_id>/<photo_id>.jpg. The insert and delete
-- policies stay as they are.
DROP POLICY IF EXISTS report_photos_files_select ON storage.objects;
CREATE POLICY report_photos_files_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-photos'
    AND public.can_report_stage_progress(((storage.foldername(name))[1])::uuid)
    AND (
      NOT (SELECT public.is_primary())
      OR owner = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.report_photos rp
                 WHERE rp.storage_path = objects.name AND rp.by_user_id = (SELECT auth.uid()))
      OR public.primary_can_read_job_reports(((storage.foldername(name))[1])::uuid)
    )
  );

-- ---------- 5 · the definer functions ----------
-- list_reports_with_job_info: the live body (20261118020000), one clause added at the end of WHERE.
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
  -- Primary scoping, reports (2026-11-19): a primary reads their own jobs' reports and the ones they wrote.
  AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_report(r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id))
  ORDER BY r.created_at DESC;
$function$;

-- list_reports_for_job_ledger: the live body (20260927233000), one clause added at the end of WHERE.
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
  -- Primary scoping, reports (2026-11-19).
  AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_report(r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id))
  ORDER BY r.created_at ASC;
$function$;

-- list_reports_for_bid: the live body (20260927233000), one clause added at the end of WHERE.
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
  -- Primary scoping, reports (2026-11-19).
  AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_report(r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id))
  ORDER BY r.created_at ASC;
$function$;

-- list_job_crew_position: the live body (20260914230000), one clause added to the newest-report read.
CREATE OR REPLACE FUNCTION public.list_job_crew_position(p_job_ids uuid[], p_today date)
 RETURNS TABLE(job_ledger_id uuid, last_work_date date, last_day_people text[], sessions_60d integer, people_60d integer, sheet_stage text, sheet_names text, sheet_date date, sheet_progress_pct integer, sheet_stage_changed_at timestamp with time zone, report_pct integer, report_at timestamp with time zone, pct_manual_at timestamp with time zone, pct_set_at timestamp with time zone, pct_source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH office AS (
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) AS ok
  ),
  jobs AS (
    SELECT DISTINCT x.id
    FROM unnest(COALESCE(p_job_ids, ARRAY[]::uuid[])) AS x(id)
    WHERE (SELECT ok FROM office)
  ),
  cs AS (
    SELECT c.job_ledger_id, c.work_date, c.user_id
    FROM public.clock_sessions c
    JOIN jobs j ON j.id = c.job_ledger_id
    WHERE c.revoked_at IS NULL
      AND c.rejected_at IS NULL
      AND c.work_date IS NOT NULL
      AND c.work_date >= p_today - 60
      AND c.work_date <= p_today
  ),
  last_day AS (
    SELECT cs.job_ledger_id, max(cs.work_date) AS d FROM cs GROUP BY cs.job_ledger_id
  ),
  last_people AS (
    SELECT cs.job_ledger_id, array_agg(DISTINCT btrim(u.name) ORDER BY btrim(u.name)) AS names
    FROM cs
    JOIN last_day ld ON ld.job_ledger_id = cs.job_ledger_id AND ld.d = cs.work_date
    JOIN public.users u ON u.id = cs.user_id
    WHERE btrim(COALESCE(u.name, '')) <> ''
    GROUP BY cs.job_ledger_id
  ),
  agg AS (
    SELECT cs.job_ledger_id, count(*)::integer AS sessions_60d, count(DISTINCT cs.user_id)::integer AS people_60d
    FROM cs GROUP BY cs.job_ledger_id
  ),
  sheet AS (
    SELECT DISTINCT ON (s.job_ledger_id)
      s.job_ledger_id, s.stage, s.assigned_to_name, s.job_date, s.progress_pct, s.stage_changed_at
    FROM public.people_labor_jobs s
    JOIN jobs j ON j.id = s.job_ledger_id
    ORDER BY s.job_ledger_id, s.job_date DESC NULLS LAST, s.created_at DESC
  ),
  rep AS (
    SELECT DISTINCT ON (r.job_ledger_id)
      r.job_ledger_id,
      ((regexp_match(btrim(r.field_values ->> 'How complete is the job?'), '^[+-]?\d+'))[1])::bigint AS n,
      r.created_at
    FROM public.reports r
    JOIN jobs j ON j.id = r.job_ledger_id
    WHERE btrim(COALESCE(r.field_values ->> 'How complete is the job?', '')) ~ '^[+-]?\d+'
      -- Primary scoping, reports (2026-11-19): the percent is a report's own line.
      AND (NOT (SELECT public.is_primary()) OR public.primary_can_read_report(r.job_ledger_id, r.project_id, r.bid_id, r.created_by_user_id))
    ORDER BY r.job_ledger_id, r.created_at DESC
  ),
  manual AS (
    SELECT e.job_id, max(e.changed_at) AS at
    FROM public.job_pct_events e
    JOIN jobs j ON j.id = e.job_id
    WHERE e.source = 'manual'
    GROUP BY e.job_id
  ),
  newest AS (
    -- The event that set the number the job carries now, whatever its source.
    SELECT DISTINCT ON (e.job_id) e.job_id, e.changed_at, e.source
    FROM public.job_pct_events e
    JOIN jobs j ON j.id = e.job_id
    ORDER BY e.job_id, e.changed_at DESC
  )
  SELECT
    j.id AS job_ledger_id,
    ld.d AS last_work_date,
    lp.names AS last_day_people,
    COALESCE(a.sessions_60d, 0) AS sessions_60d,
    COALESCE(a.people_60d, 0) AS people_60d,
    sh.stage AS sheet_stage,
    sh.assigned_to_name AS sheet_names,
    sh.job_date AS sheet_date,
    sh.progress_pct AS sheet_progress_pct,
    sh.stage_changed_at AS sheet_stage_changed_at,
    CASE WHEN rep.n BETWEEN 0 AND 100 THEN rep.n::integer END AS report_pct,
    rep.created_at AS report_at,
    m.at AS pct_manual_at,
    n.changed_at AS pct_set_at,
    n.source AS pct_source
  FROM jobs j
  LEFT JOIN last_day ld ON ld.job_ledger_id = j.id
  LEFT JOIN last_people lp ON lp.job_ledger_id = j.id
  LEFT JOIN agg a ON a.job_ledger_id = j.id
  LEFT JOIN sheet sh ON sh.job_ledger_id = j.id
  LEFT JOIN rep ON rep.job_ledger_id = j.id
  LEFT JOIN manual m ON m.job_id = j.id
  LEFT JOIN newest n ON n.job_id = j.id;
$function$;
