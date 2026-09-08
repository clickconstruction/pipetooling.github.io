SET lock_timeout = '3s';

-- Needs You "job account" gap counts (follow-up to v2.2669's on_job_account
-- flag). Two hygiene queues, both self-clearing:
--   unflagged  — jobs whose job-account packet went out (supply_house_job_accounts)
--                but which still carry unpaid, UNflagged supplier invoices.
--   no_packet  — unpaid invoices flagged on_job_account on jobs that were never
--                shared from the app (phone-opened accounts are fine; the card
--                is a nudge, not a block).
-- Gate inside, count_pending_accounting_label_suggestions precedent: office
-- roles get numbers, everyone else the zero row. Dollars are allocated
-- (amount × pct / 100), matching the Job Accounts tab.
CREATE OR REPLACE FUNCTION public.count_job_account_flag_gaps()
RETURNS TABLE(unflagged_jobs integer, unflagged_total numeric, no_packet_invoices integer, no_packet_total numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RETURN QUERY SELECT 0, 0::numeric, 0, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  WITH shared AS (
    SELECT DISTINCT s.job_id FROM public.supply_house_job_accounts s
  ),
  alloc AS (
    SELECT a.job_id,
           i.id AS invoice_id,
           i.on_job_account,
           (coalesce(i.amount, 0) * coalesce(a.pct, 0) / 100)::numeric AS allocated
    FROM public.supply_house_invoice_job_allocations a
    JOIN public.supply_house_invoices i ON i.id = a.invoice_id
    WHERE NOT i.is_paid
  )
  SELECT
    (SELECT count(DISTINCT x.job_id) FROM alloc x
      WHERE NOT x.on_job_account AND EXISTS (SELECT 1 FROM shared sh WHERE sh.job_id = x.job_id))::int,
    coalesce((SELECT sum(x.allocated) FROM alloc x
      WHERE NOT x.on_job_account AND EXISTS (SELECT 1 FROM shared sh WHERE sh.job_id = x.job_id)), 0)::numeric,
    (SELECT count(DISTINCT x.invoice_id) FROM alloc x
      WHERE x.on_job_account AND NOT EXISTS (SELECT 1 FROM shared sh WHERE sh.job_id = x.job_id))::int,
    coalesce((SELECT sum(x.allocated) FROM alloc x
      WHERE x.on_job_account AND NOT EXISTS (SELECT 1 FROM shared sh WHERE sh.job_id = x.job_id)), 0)::numeric;
END;
$$;

COMMENT ON FUNCTION public.count_job_account_flag_gaps() IS
  'Needs You job-account gaps: (jobs with a share packet on file but unpaid unflagged invoices, their allocated $, unpaid on_job_account invoices on never-shared jobs, their allocated $). Gate inside: dev/master/assistant/controller get numbers, everyone else the zero row.';

REVOKE EXECUTE ON FUNCTION public.count_job_account_flag_gaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_job_account_flag_gaps() TO authenticated, service_role;
