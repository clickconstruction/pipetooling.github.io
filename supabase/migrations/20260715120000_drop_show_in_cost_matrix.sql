-- Cost-matrix retirement phase 5: drop people_pay_config.show_in_cost_matrix.
--
-- Soak replaced by proof (2026-07-15): all 21 prod rows had show_in_cost_matrix
-- identical to show_in_hours; since v2.673 every writer wrote both columns, and the
-- v2.675 client (deploy BEFORE this push) neither reads, writes, nor selects the
-- column anywhere — readers (CrewJobsBlock roster, useWeeklyTeamLaborTotal,
-- People.tsx costing roster, Settings pay-config loads) now use show_in_hours.
-- The service worker is registerType:'autoUpdate', so stale bundles that still
-- select the column self-replace on next navigation.
--
-- list_people_pay_flags() must be dropped and recreated (not CREATE OR REPLACE)
-- because its RETURNS TABLE loses a column; body otherwise identical to
-- 20260714213000. Recreate BEFORE the column drop so no window exists where the
-- function references a missing column.

DROP FUNCTION IF EXISTS public.list_people_pay_flags();
CREATE FUNCTION public.list_people_pay_flags()
RETURNS TABLE(
  person_name text,
  person_id uuid,
  is_salary boolean,
  record_hours_but_salary boolean,
  show_in_hours boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_people_pay_flags: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev','master_technician','assistant','controller')
  ) THEN
    RAISE EXCEPTION 'list_people_pay_flags: not allowed';
  END IF;
  RETURN QUERY
    SELECT pc.person_name, pc.person_id, pc.is_salary, pc.record_hours_but_salary,
           pc.show_in_hours
    FROM public.people_pay_config pc;
END $$;

ALTER TABLE public.people_pay_config DROP COLUMN IF EXISTS show_in_cost_matrix;
