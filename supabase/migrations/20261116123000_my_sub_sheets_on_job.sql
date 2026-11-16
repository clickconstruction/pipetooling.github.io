SET lock_timeout = '3s';

-- A sub's own sheets on one job, for their job window's Your pay row (punch list #355, v2.7399). Taunya's pick of
-- 2026-11-15, after the before and after were drawn: "Draw it now".
--
-- The sub's portal already states their money sheet by sheet: the edge function sub-portal reads the sheets the
-- junction people_labor_job_assignees ties to their roster person, with the items and the payments, and the pure
-- kernel buildSubSheets (_shared/subPortalStatement.ts) works out agreed, paid, back-charged and open. This read
-- hands the signed-in app the same rows for one job, so the window runs the same kernel and states the same money.
-- Nothing is summed here.
--
-- Whose: the roster person whose account is the caller (people.account_user_id = auth.uid()), and only the sheets
-- the junction ties to that person. A sheet the junction does not cover (an old sheet with several typed names) is
-- left out, as the portal leaves it out. Anyone with no roster person gets on_roster false and no rows.
--
-- The portal's address comes with it, for the row's Open your portal: the person's own short address, else their
-- newest live link. It is the link the office already texts them.
--
-- SECURITY DEFINER, row security off: the sheet tables are the office's. No CREATE TABLE. Idempotent.

CREATE OR REPLACE FUNCTION public.my_sub_sheets_on_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH me AS (
    SELECT p.id FROM public.people p WHERE p.account_user_id = auth.uid() AND p.archived_at IS NULL
  ), mine AS (
    SELECT DISTINCT lj.id
    FROM public.people_labor_job_assignees a
    JOIN me ON me.id = a.person_id
    JOIN public.people_labor_jobs lj ON lj.id = a.labor_job_id
    WHERE lj.job_ledger_id = p_job_id
  )
  SELECT CASE WHEN auth.uid() IS NULL OR p_job_id IS NULL THEN NULL ELSE jsonb_build_object(
    'on_roster', EXISTS (SELECT 1 FROM me),
    'sheets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', lj.id, 'address', lj.address, 'job_number', lj.job_number, 'job_ledger_id', lj.job_ledger_id,
        'job_date', lj.job_date, 'labor_rate', lj.labor_rate, 'stage', lj.stage, 'stage_changed_at', lj.stage_changed_at,
        'stage_source', lj.stage_source, 'payable_after', lj.payable_after, 'pay_hold_reason', lj.pay_hold_reason
      ) ORDER BY lj.created_at, lj.id)
      FROM public.people_labor_jobs lj JOIN mine ON mine.id = lj.id
    ), '[]'::jsonb),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'job_id', i.job_id, 'fixture', i.fixture, 'count', i.count, 'hrs_per_unit', i.hrs_per_unit, 'is_fixed', i.is_fixed,
        'labor_rate', i.labor_rate, 'direct_labor_amount', i.direct_labor_amount, 'sequence_order', i.sequence_order
      ))
      FROM public.people_labor_job_items i JOIN mine ON mine.id = i.job_id
    ), '[]'::jsonb),
    -- The memo is the office's note on a payment; the row does not read it, so it does not travel.
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'job_id', pm.job_id, 'amount', pm.amount, 'memo', NULL, 'payment_date', pm.payment_date, 'created_at', pm.created_at,
        'hidden_from_sub', pm.hidden_from_sub, 'sequence_order', pm.sequence_order
      ))
      FROM public.people_labor_job_payments pm JOIN mine ON mine.id = pm.job_id
    ), '[]'::jsonb),
    'portal_slug', (SELECT s.slug FROM public.sub_portal_slugs s JOIN me ON me.id = s.person_id LIMIT 1),
    'portal_token', (
      SELECT l.token FROM public.sub_portal_links l JOIN me ON me.id = l.person_id
      WHERE l.revoked_at IS NULL ORDER BY l.created_at DESC LIMIT 1
    )
  ) END
$$;

COMMENT ON FUNCTION public.my_sub_sheets_on_job(uuid) IS
  'Punch list #355: the caller''s own sub labor sheets on one job (the junction people_labor_job_assignees through people.account_user_id), with their items and payments as the sub portal reads them, and the caller''s own portal address. The client runs the portal''s kernel on them. SECURITY DEFINER + row_security off; nothing of anyone else''s is returned.';
REVOKE EXECUTE ON FUNCTION public.my_sub_sheets_on_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sub_sheets_on_job(uuid) TO authenticated, service_role;
