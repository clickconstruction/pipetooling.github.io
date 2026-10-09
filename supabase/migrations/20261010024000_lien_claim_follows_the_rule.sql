SET lock_timeout = '3s';

-- The lien claim follows the payment rule (v2.5093, the owner's call of 2026-10-09: a payment put on a job
-- with no bill picked is applied oldest bill first, everywhere).
--
-- lien_billed_open() (v2.4969, 20261009150000_lien_claim_is_billed.sql) netted each sent bill only of the
-- payments tied to it, so a payment with no bill picked lowered no claim, while the Pipeline, GC Review, the
-- statement, the Dashboard and the customers applied it (v2.5006, v2.5010, v2.5017). Job 273 claimed $17,585
-- where its bills owe $16,685. Now the claim is what the sent bills still owe under attributeJobPayments
-- (supabase/functions/_shared/paymentAttribution.ts), the client's lienBilledOpen (v2.5093) word for word:
--   * linked money is its bill's, in full;
--   * the job's unlinked money (each payment above zero; a refund is never applied) pays the part of the job
--     on no sent bill first, its revenue less every sent bill, billed or paid (none when revenue is NULL);
--   * what is left walks the sent bills, billed or paid, oldest first by sequence_order, then billed_at, then
--     id, each taking what it still needs after its own linked money;
--   * the claim sums what the billed ones still need. Paid bills owe nothing, as before, and the shell arm
--     (a job billed as one bill, none sent) is unchanged.
-- Unlinked money is pooled: the off-bill part is filled before any bill whatever order the payments came in, so
-- what each bill takes does not depend on the payments' order. The signature is unchanged, so the three desk
-- readers that call it (list_lien_notice_months, list_lien_affidavit_windows, list_lien_retainage_windows) read
-- the new claim as they are.

CREATE OR REPLACE FUNCTION public.lien_billed_open(p_job_id uuid, p_status text, p_revenue numeric, p_payments_made numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sent AS (
    SELECT i.id,
           i.status,
           COALESCE(i.amount, 0) AS amount,
           GREATEST(0, COALESCE(i.amount, 0) - COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.invoice_id = i.id), 0)) AS need,
           i.sequence_order,
           i.billed_at
    FROM public.jobs_ledger_invoices i
    WHERE i.job_id = p_job_id AND i.status IN ('billed', 'paid')
  ),
  walk AS (
    SELECT s.status,
           s.need,
           COALESCE(SUM(s.need) OVER (ORDER BY s.sequence_order ASC NULLS LAST, s.billed_at ASC NULLS LAST, s.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS need_before
    FROM sent s
  ),
  pool AS (
    SELECT GREATEST(0,
             COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.job_id = p_job_id AND p.invoice_id IS NULL AND p.amount > 0), 0)
             - CASE WHEN p_revenue IS NULL THEN 0 ELSE GREATEST(0, p_revenue - COALESCE((SELECT SUM(s.amount) FROM sent s), 0)) END
           ) AS for_bills
  )
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM sent)
             THEN COALESCE((
               SELECT SUM(w.need - LEAST(w.need, GREATEST(0, pool.for_bills - w.need_before)))
               FROM walk w CROSS JOIN pool
               WHERE w.status = 'billed'
             ), 0)
           WHEN p_status = 'billed' THEN GREATEST(0, COALESCE(p_revenue, 0) - COALESCE(p_payments_made, 0))
           ELSE 0
         END::numeric
$$;

COMMENT ON FUNCTION public.lien_billed_open(uuid, text, numeric, numeric) IS
  'Lien money (v2.4969; the payment rule since v2.5093): what the job''s sent bills still owe. Once any bill has gone out (status billed or paid), each billed invoice net of what it has been paid under attributeJobPayments: its linked payments in full, then the job''s unlinked money (above zero), which pays the part of the job on no sent bill first (revenue less the sent bills; none when revenue is NULL) and then the sent bills, billed or paid, oldest first by sequence_order, billed_at, id. Clamped at 0; paid bills nothing. A job billed as one shell (status billed, no bill ever sent) is revenue - payments_made; else 0. The lien readers take it as open_balance, so a notice never claims work not yet billed. The client twin is src/lib/jobs/lienBilledOpen.ts.';

GRANT EXECUTE ON FUNCTION public.lien_billed_open(uuid, text, numeric, numeric) TO authenticated, service_role;
