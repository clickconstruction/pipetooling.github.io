-- Add pct_complete to list_ready_to_bill_assigned_jobs_for_dashboard so the
-- subcontractor Ready to Bill cards can show "% complete" under "Open <age>".
-- Adding a column to the RETURNS TABLE changes the function signature, so this
-- is a DROP + CREATE (CREATE OR REPLACE cannot change OUT columns), and the
-- GRANTs must be re-applied afterward. Display-only, additive: the client reads
-- pct_complete by name and treats a missing value as "no percentage", so old
-- clients are unaffected. Body is otherwise identical to
-- 20260722258000_click_number_dashboard_rpcs.sql.

DROP FUNCTION IF EXISTS public.list_ready_to_bill_assigned_jobs_for_dashboard();

CREATE OR REPLACE FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard()
 RETURNS TABLE(id uuid, hcp_number text, job_name text, job_address text, google_drive_link text, job_plans_link text, job_pictures_link text, revenue numeric, master_user_id uuid, created_at timestamp with time zone, last_report_at timestamp with time zone, my_last_report_at timestamp with time zone, last_thread_note_at timestamp with time zone, last_clock_activity_at timestamp with time zone, last_schedule_activity_at timestamp with time zone, last_job_activity_at timestamp with time zone, status text, click_number text, pct_complete integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jl.id,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name,
    jl.job_address,
    jl.google_drive_link,
    jl.job_plans_link,
    jl.job_pictures_link,
    jl.revenue,
    jl.master_user_id,
    jl.created_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id) AS last_report_at,
    (SELECT MAX(r.created_at)
     FROM public.reports r
     WHERE r.job_ledger_id = jl.id AND r.created_by_user_id = auth.uid()) AS my_last_report_at,
    (SELECT max(n.created_at) FROM public.jobs_ledger_thread_notes n WHERE n.job_id = jl.id) AS last_thread_note_at,
    (SELECT max(coalesce(cs.clocked_out_at, cs.clocked_in_at))
     FROM public.clock_sessions cs
     WHERE cs.job_ledger_id = jl.id
       AND cs.approved_at IS NOT NULL
       AND cs.rejected_at IS NULL
       AND cs.revoked_at IS NULL) AS last_clock_activity_at,
    (SELECT max(greatest(jb.created_at, jb.updated_at))
     FROM public.job_schedule_blocks jb
     WHERE jb.job_id = jl.id) AS last_schedule_activity_at,
    (SELECT max(x.v) FROM (
      SELECT (SELECT max(n2.created_at) FROM public.jobs_ledger_thread_notes n2 WHERE n2.job_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(r2.created_at) FROM public.reports r2 WHERE r2.job_ledger_id = jl.id) AS v
      UNION ALL
      SELECT (SELECT max(coalesce(cs2.clocked_out_at, cs2.clocked_in_at))
              FROM public.clock_sessions cs2
              WHERE cs2.job_ledger_id = jl.id
                AND cs2.approved_at IS NOT NULL
                AND cs2.rejected_at IS NULL
                AND cs2.revoked_at IS NULL) AS v
      UNION ALL
      SELECT (SELECT max(greatest(jb2.created_at, jb2.updated_at))
              FROM public.job_schedule_blocks jb2
              WHERE jb2.job_id = jl.id) AS v
    ) x) AS last_job_activity_at,
    jl.status::text,
    jl.click_number,
    jl.pct_complete
  FROM public.jobs_ledger jl
  INNER JOIN public.jobs_ledger_team_members jtm ON jtm.job_id = jl.id AND jtm.user_id = auth.uid()
  WHERE jl.status = 'ready_to_bill'
  ORDER BY COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), '') DESC, jl.job_name;
$function$;

GRANT ALL ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO anon;
GRANT ALL ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO authenticated;
GRANT ALL ON FUNCTION public.list_ready_to_bill_assigned_jobs_for_dashboard() TO service_role;
