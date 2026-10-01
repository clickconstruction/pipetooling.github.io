SET lock_timeout = '3s';

-- v2.4328 — punch list #76 PR 4: the payer remembers a check that came back.
--
-- list_ar_returned_check_payers(p_since_days default 365): one row per (case, job and
-- bill the check touched) for every case opened in the window, open or closed — the
-- payments it still carries, the ones taken off (deleted_records_archive), the payments of
-- the check that replaced it and, when
-- no job ever carried it, the hand-recorded payment it matches. Each row carries the
-- job's and the bill's party fields, so the client names the payer with the one
-- who-pays rule it already has (payerCustomerId / effectiveInvoiceParty in
-- _shared/billToParty.ts) instead of a second copy here. The pay history on a Billed
-- row then reads "2 checks came back · Apr" (Poolcorp, April 2026).
-- The AR roles, as everywhere else in Accounts Receivable.

CREATE OR REPLACE FUNCTION public.list_ar_returned_check_payers(p_since_days integer DEFAULT 365)
 RETURNS TABLE(
   mercury_transaction_id uuid,
   came_back_at timestamptz,
   job_id uuid,
   job_customer_id uuid,
   job_gc_customer_id uuid,
   job_bill_to_party text,
   invoice_bill_to_party text,
   invoice_bill_to_email text
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_returned_check_payers: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_ar_returned_check_payers: not authorized';
  END IF;

  RETURN QUERY
  WITH cases AS (
    SELECT r.mercury_transaction_id AS tx_id, r.replaced_by_mercury_transaction_id AS replaced_by,
           coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), r.opened_at, r.updated_at) AS came_back_at,
           t.amount, t.raw, t.created_at, r.source
    FROM public.mercury_transaction_ar_returned r
    JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
    WHERE r.returned
      AND coalesce(r.source, '') IN ('bank', 'rejected')
      AND coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), r.opened_at, r.updated_at) > now() - make_interval(days => greatest(1, least(coalesce(p_since_days, 365), 3650)))
  ), touched AS (
    SELECT c.tx_id, c.came_back_at, p.job_id, p.invoice_id
    FROM cases c
    JOIN public.jobs_ledger_payments p ON p.mercury_transaction_id = c.tx_id
    UNION
    SELECT c.tx_id, c.came_back_at, (a.row_data->>'job_id')::uuid, (a.row_data->>'invoice_id')::uuid
    FROM cases c
    JOIN public.deleted_records_archive a
      ON a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
     AND (a.row_data->>'mercury_transaction_id') = c.tx_id::text
    UNION
    -- The new check that replaced it pays the same customer (Poolcorp, Dudley: never left on a job).
    SELECT c.tx_id, c.came_back_at, p.job_id, p.invoice_id
    FROM cases c
    JOIN public.jobs_ledger_payments p ON p.mercury_transaction_id = c.replaced_by
    WHERE c.replaced_by IS NOT NULL
    UNION
    SELECT c.tx_id, c.came_back_at, rp.job_id, rp.invoice_id
    FROM cases c
    CROSS JOIN LATERAL (
      SELECT p.job_id, p.invoice_id
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id IS NULL
        AND p.amount > 0
        AND abs(p.amount - c.amount) < 0.005
        AND p.paid_on BETWEEN (coalesce(public._ar_try_timestamptz(c.raw->>'failedAt'), c.created_at) AT TIME ZONE 'America/Chicago')::date - CASE WHEN c.source = 'rejected' THEN 3 ELSE 14 END
                          AND (coalesce(public._ar_try_timestamptz(c.raw->>'failedAt'), c.created_at) AT TIME ZONE 'America/Chicago')::date + 10
      ORDER BY p.paid_on, p.id
      LIMIT 1
    ) rp
    WHERE NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments lp WHERE lp.mercury_transaction_id = c.tx_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.deleted_records_archive a2
        WHERE a2.table_name = 'jobs_ledger_payments' AND a2.restored_at IS NULL
          AND (a2.row_data->>'mercury_transaction_id') = c.tx_id::text
      )
  )
  SELECT tc.tx_id, tc.came_back_at, j.id, j.customer_id, j.gc_customer_id, j.bill_to_party, i.bill_to_party, i.bill_to_email
  FROM touched tc
  JOIN public.jobs_ledger j ON j.id = tc.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = tc.invoice_id
  ORDER BY tc.came_back_at DESC, tc.tx_id, j.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_returned_check_payers(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_returned_check_payers(integer) TO authenticated;

COMMENT ON FUNCTION public.list_ar_returned_check_payers(integer) IS
  'The payer remembers (v2.4328): for every check that came back in the window (bank or rejected cases, open or closed), the jobs and bills it touched with their party fields — the client names the payer with payerCustomerId(effectiveInvoiceParty(...)). AR roles.';
