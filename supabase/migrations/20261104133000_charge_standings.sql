SET lock_timeout = '3s';

-- charge_standings (v2.6490, punch list #254): every login with its standing, people who left included, for every
-- reader of a job's charges — the Job Summary's Charges and Premium columns, the Charges window and the charged
-- hours statement. The users select policy (20260905090000) shows an archived row to a dev alone, so the controller's
-- and a master's Job Summary read the active logins only: a person who left priced at nothing for them, with a note
-- that the person had no login, while the dev's Job Summary priced the same days (the PR review of 2026-11-04).
--
-- One SECURITY DEFINER read, gated as the Charges column's adjustments are — a dev or has_payroll_access() (the
-- controller, a pay-approved master) — answering id, name, charge_standing and archived_at and nothing wider. A
-- caller outside the gate is refused (42501), never answered with no rows: no rows would price every day at nothing
-- and name everyone as counting as nobody. Archived rows come first, so a last-wins map lands on the live login when
-- two share a name. Additive and idempotent; no table is created, so no fence is owed.

CREATE OR REPLACE FUNCTION public.charge_standings()
RETURNS TABLE (id uuid, name text, charge_standing text, archived_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_dev() OR public.has_payroll_access()) THEN
    RAISE EXCEPTION 'A job''s charges price for a dev, the controller and a pay-approved master.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.name, u.charge_standing, u.archived_at
    FROM public.users u
    ORDER BY (u.archived_at IS NULL), u.name, u.id;
END;
$$;

COMMENT ON FUNCTION public.charge_standings() IS
  'Every login with its Charged as (users.charge_standing), people who left included, for the screens that price a job''s charges; a dev or has_payroll_access(), refused otherwise (42501). Archived rows first. Punch list #254, v2.6490.';

REVOKE EXECUTE ON FUNCTION public.charge_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_standings() TO authenticated;
