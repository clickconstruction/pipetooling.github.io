SET lock_timeout = '3s';

-- Signed hours statement (punch list #212): the paper is payroll data, so only a dev and the controller may see or
-- make one — Diane's call of 2026-11-02, revising the owner's call 6 of 2026-10-29 (which let a pay-approved master
-- make the paper with the money and an assistant the hours-only paper). The policies on hours_statements stay as
-- they are (every one goes through this function), so narrowing the function narrows the table for everyone the
-- screen may still show it to. The argument stays so the policies' calls need no rewrite; the pay switch no longer
-- changes who may touch a row.
CREATE OR REPLACE FUNCTION public.can_touch_hours_statement(p_with_pay boolean)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_dev() OR public.is_controller());
$$;
COMMENT ON FUNCTION public.can_touch_hours_statement(boolean) IS 'Signed hours statement (#212): a dev or the controller, for any row — payroll data, Diane''s call of 2026-11-02; the pay switch no longer widens or narrows who may touch a row.';
