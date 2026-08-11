SET lock_timeout = '3s';

-- Crew report visibility (v2.1546): widen list_reports_with_job_info's
-- helpers/subcontractor branch so a field person assigned to a job (via
-- jobs_ledger_team_members) also sees that job's reports authored by other
-- helpers/subcontractor users — powering "Reports for this Job" in the
-- Additional Report modal. Everything else (office/superintendent branches,
-- the sub visibility-months window, and the per-row GPS masking that hides
-- lat/lng on reports the sub did not author) is unchanged.

CREATE OR REPLACE FUNCTION public.list_reports_with_job_info()
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, job_ledger_id uuid, project_id uuid, bid_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric, job_google_drive_link text, job_job_pictures_link text, job_address text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
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
          AND role IN ('dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator')
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
      WHERE u2.id = auth.uid() AND u2.role IN ('dev', 'master_technician', 'assistant', 'primary')
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
