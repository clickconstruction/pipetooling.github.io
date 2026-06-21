-- Finish the Click Number rollout on the backend: every remaining job-HCP RPC
-- surfaces the effective number (hcp_number if present, else click_number).
--
-- Two mechanisms:
--   * Bake-in (CREATE OR REPLACE, same return shape → grants preserved, no client
--     change): display/list/report/schedule/AR/search RPCs return/search/order by
--     COALESCE(NULLIF(hcp_number,''), NULLIF(click_number,'')).
--   * Separate click_number column (DROP+CREATE+re-GRANT) for the get_jobs_ledger_by_*
--     job-fetch family, matching get_jobs_ledger_by_ids / _by_hcp_numbers (PR 1).
--
-- Untouched on purpose: search_jobs_ledger / get_jobs_ledger_by_ids /
-- get_jobs_ledger_by_hcp_numbers (PR 1, return raw hcp + separate click);
-- get_jobs_ledger_office ('000' filter is HCP-specific); list_reports_for_bid (bid-only).

-- ============================================================================
-- Job-fetch family — add a click_number column (client resolves; PeopleReviewTab
-- already reads it optionally from PR 2).
-- ============================================================================

drop function if exists public.get_jobs_ledger_by_ids_paid_only(uuid[]);
create function public.get_jobs_ledger_by_ids_paid_only(p_job_ids uuid[])
returns table(id uuid, hcp_number text, job_name text, job_address text, revenue numeric, pct_complete integer, service_type_id uuid, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select jl.id,
         coalesce(jl.hcp_number, '')::text,
         coalesce(jl.job_name, '')::text,
         coalesce(jl.job_address, '')::text,
         jl.revenue,
         jl.pct_complete,
         jl.service_type_id,
         coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  where jl.id = any(p_job_ids)
    and jl.status = 'paid';
$$;
grant all on function public.get_jobs_ledger_by_ids_paid_only(uuid[]) to anon, authenticated, service_role;

drop function if exists public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]);
create function public.get_jobs_ledger_by_hcp_numbers_paid_only(p_hcp_numbers text[])
returns table(id uuid, hcp_number text, job_name text, job_address text, revenue numeric, pct_complete integer, service_type_id uuid, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select jl.id,
         coalesce(jl.hcp_number, '')::text,
         coalesce(jl.job_name, '')::text,
         coalesce(jl.job_address, '')::text,
         jl.revenue,
         jl.pct_complete,
         jl.service_type_id,
         coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  where jl.status = 'paid'
    and (
      lower(trim(coalesce(jl.hcp_number, ''))) = any(
        select lower(trim(coalesce(x, ''))) from unnest(p_hcp_numbers) as x
      )
      or (
        trim(coalesce(jl.hcp_number, '')) = ''
        and trim(coalesce(jl.click_number, '')) <> ''
        and lower(trim(jl.click_number)) = any(
          select lower(trim(coalesce(x, ''))) from unnest(p_hcp_numbers) as x
        )
      )
    );
$$;
grant all on function public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]) to anon, authenticated, service_role;

drop function if exists public.get_jobs_ledger_by_status(text);
create function public.get_jobs_ledger_by_status(p_status text)
returns table(id uuid, hcp_number text, job_name text, job_address text, revenue numeric, payments_made numeric, google_drive_link text, job_plans_link text, created_at timestamptz, customer_id uuid, click_number text)
language sql stable security definer set search_path to 'public'
as $$
  select jl.id,
         coalesce(jl.hcp_number, '')::text,
         coalesce(jl.job_name, '')::text,
         coalesce(jl.job_address, '')::text,
         jl.revenue,
         jl.payments_made,
         jl.google_drive_link,
         jl.job_plans_link,
         jl.created_at,
         jl.customer_id,
         coalesce(jl.click_number, '')::text
  from public.jobs_ledger jl
  where jl.status = p_status
  order by jl.created_at desc nulls last;
$$;
grant all on function public.get_jobs_ledger_by_status(text) to anon, authenticated, service_role;

-- ============================================================================
-- Reports — bake the effective number into the existing coalesced job_hcp_number
-- display field (NULLIF the hcp so an empty HCP falls through to click; project/
-- bid fallbacks preserved). CREATE OR REPLACE keeps grants (same return shape).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_job_display_for_report(p_source text, p_id uuid)
 RETURNS TABLE(id uuid, source text, display_name text, hcp_number text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  (SELECT jl.id, 'job_ledger'::TEXT, jl.job_name, COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '')::TEXT
   FROM public.jobs_ledger jl
   WHERE p_source = 'job_ledger' AND jl.id = p_id
   LIMIT 1)
  UNION ALL
  (SELECT p.id, 'project'::TEXT, p.name, COALESCE(p.housecallpro_number, '')::TEXT
   FROM public.projects p
   WHERE p_source = 'project' AND p.id = p_id
   LIMIT 1)
  UNION ALL
  (SELECT b.id, 'bid'::TEXT,
   COALESCE(b.project_name, b.gc_contact_name, 'Bid')::TEXT,
   COALESCE(b.bid_number, '')::TEXT
   FROM public.bids b
   WHERE p_source = 'bid' AND b.id = p_id
   LIMIT 1);
$function$;

CREATE OR REPLACE FUNCTION public.list_reports_for_job_ledger(p_job_id uuid)
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, job_ledger_id uuid, project_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric)
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
    COALESCE(jl.job_name, p.name) AS job_display_name,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), p.housecallpro_number, '')::TEXT AS job_hcp_number,
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
      THEN r.reported_at_lng ELSE NULL END AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  WHERE r.job_ledger_id = p_job_id
  AND (
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
      )
    )
    OR
    (
      EXISTS (SELECT 1 FROM public.users u3 WHERE u3.id = auth.uid() AND u3.role IN ('helpers', 'subcontractor'))
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_reports()
 RETURNS TABLE(id uuid, template_id uuid, template_name text, created_by_user_id uuid, created_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone, field_values jsonb, job_ledger_id uuid, project_id uuid, bid_id uuid, job_display_name text, job_hcp_number text, reported_at_lat numeric, reported_at_lng numeric)
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
    r.reported_at_lat AS reported_at_lat,
    r.reported_at_lng AS reported_at_lng
  FROM public.reports r
  JOIN public.report_templates rt ON r.template_id = rt.id
  JOIN public.users u ON r.created_by_user_id = u.id
  LEFT JOIN public.jobs_ledger jl ON r.job_ledger_id = jl.id
  LEFT JOIN public.projects p ON r.project_id = p.id
  LEFT JOIN public.bids b ON r.bid_id = b.id
  WHERE r.created_by_user_id = auth.uid()
    AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
  ORDER BY r.created_at DESC;
$function$;

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
      AND r.created_by_user_id = auth.uid()
      AND r.created_at >= (NOW() - (public.report_sub_visibility_months() || ' months')::interval)
    )
  )
  ORDER BY r.created_at DESC;
$function$;
