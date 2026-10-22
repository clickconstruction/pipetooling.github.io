SET lock_timeout = '3s';

-- The move window's Needs You line (punch list #132, the owner's ask of 2026-10-21): the
-- Accounts payable strip's four numbers as one read, so the Dashboard and Quickfill can say
-- "$7,474.71 on 14 current invoices is not on a job account yet" without the tab's book.
-- Same predicate as movableCandidates + isMovableAgingInvoice (src/lib/supplyHouseAging.ts):
-- unpaid, a positive amount, not flagged on a job account, due today or later in the company
-- calendar (app_today()), allocated to exactly one job. asked = the rows with an open
-- (unconfirmed) ask in supply_house_invoice_move_requests; soonest_due = the first window
-- to close. Office roles only (is_office_staff), like the table's RLS — everyone else gets
-- the zero row. supabase/tests/supply_house_move_window pins the function to the kernel.

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
  'The move window (punch list #132): the Needs You line''s numbers — still-current unpaid charges not on a job account, on exactly one job (count, dollars), how many have an open ask out (asked), and the soonest due date (soonest_due). Office roles only; the zero row otherwise.';

REVOKE EXECUTE ON FUNCTION public.count_supply_house_move_window() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_supply_house_move_window() TO authenticated, service_role;
