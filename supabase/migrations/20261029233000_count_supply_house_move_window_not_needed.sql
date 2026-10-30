SET lock_timeout = '3s';

-- The move window honors a job account marked not needed (punch list #178, D's PR 3, v2.6086).
-- count_supply_house_move_window() (20261021220000) counted every still-current unpaid charge not
-- on a job account, on exactly one job. A charge whose job's account at that house is on record
-- as NOT NEEDED (job_supply_house_accounts.status = 'not_needed': the insurer pays the house
-- direct, an online order, a house that never opens one) is not a charge the house would move,
-- so it leaves the window — the Needs You line, the Accounts payable strip and the Fill them in
-- deck's rows, which answer "no job account needed" for exactly this case. The tab's kernel
-- (isMovableAgingInvoice) and the SQL bed take the same rule. Idempotent; a read function only.

CREATE OR REPLACE FUNCTION public.count_supply_house_move_window()
RETURNS TABLE (count integer, dollars numeric, asked integer, soonest_due date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH movable AS (
    SELECT i.id, i.amount, i.due_date
    FROM public.supply_house_invoices i
    WHERE public.is_office_staff()
      AND NOT i.is_paid
      AND COALESCE(i.amount, 0) > 0
      AND i.on_job_account IS DISTINCT FROM true
      AND i.due_date IS NOT NULL
      AND i.due_date >= public.app_today()
      AND (SELECT count(*) FROM public.supply_house_invoice_job_allocations a WHERE a.invoice_id = i.id) = 1
      -- The one job's account at this house is not marked not needed.
      AND NOT EXISTS (
        SELECT 1
        FROM public.supply_house_invoice_job_allocations a
        JOIN public.job_supply_house_accounts ja
          ON ja.job_id = a.job_id AND ja.supply_house_id = i.supply_house_id
        WHERE a.invoice_id = i.id AND ja.status = 'not_needed'
      )
  )
  SELECT
    count(*)::int,
    COALESCE(sum(m.amount), 0)::numeric,
    (count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.supply_house_invoice_move_requests r
      WHERE r.invoice_id = m.id AND r.confirmed_at IS NULL
    )))::int,
    min(m.due_date)
  FROM movable m;
$$;

COMMENT ON FUNCTION public.count_supply_house_move_window() IS
  'The move window (punch list #132): the Needs You line''s numbers — still-current unpaid charges not on a job account, on exactly one job whose account at the house is not marked not needed (punch list #178), (count, dollars), how many have an open ask out (asked), and the soonest due date (soonest_due). Office roles only; the zero row otherwise.';

REVOKE EXECUTE ON FUNCTION public.count_supply_house_move_window() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_supply_house_move_window() TO authenticated, service_role;
