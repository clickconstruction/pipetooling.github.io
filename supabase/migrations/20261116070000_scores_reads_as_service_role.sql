SET lock_timeout = '3s';

-- Team scorecard, PR 4 (punch list #360): two reads the team scores make, answered to the service role.
--
-- The Scores tab's reads move to the edge function team-scores, which makes them as the service role so the wages
-- that price the hours stay on the server. Two of the functions those reads call decide what to return from
-- auth.uid(), and the service role has none, so on the edge each would answer with nothing and say nothing:
--
--   * list_people_pay_flags() returned no rows, so a closed job's team labor would have read every salaried person
--     as hourly (utils/teamLabor.ts builds its wage map from these rows);
--   * get_invoice_amounts_for_jobs() returned no job, so a job's supply-house total would have read $0.
--
-- Each gains the branch list_tally_parts_with_po() already has for the Bridge's weekly sheet:
-- auth.role() = 'service_role' AND auth.uid() IS NULL. Nothing else in either body changes: both are the
-- definitions on prod on 2026-11-15, read back with pg_get_functiondef before this file was written. The service
-- role already reads both tables past RLS, so this opens nothing; a signed-in caller is answered as before.

CREATE OR REPLACE FUNCTION public.get_invoice_amounts_for_jobs(p_job_ids uuid[])
 RETURNS TABLE(job_id uuid, invoice_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      (auth.role() = 'service_role' AND auth.uid() IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid())
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    COALESCE(SUM(i.amount * a.pct / 100), 0)::numeric AS invoice_amount
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  GROUP BY a.job_id;
$function$;

CREATE OR REPLACE FUNCTION public.list_people_pay_flags()
 RETURNS TABLE(person_name text, person_id uuid, is_salary boolean, record_hours_but_salary boolean, show_in_hours boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- The service role (the team scores' edge function): every flag, as it reads the table itself.
  IF auth.role() = 'service_role' AND auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
             pc.show_in_hours
      FROM public.people_pay_config pc;
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN; -- was RAISE: unauthenticated boot races get empty rows, not log spam
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RETURN; -- was RAISE: field roles get empty rows (flags stay office-only)
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours
    FROM public.people_pay_config pc;
END $function$;
