SET lock_timeout = '3s';

-- The office side of a paid claim (punch list #129, PR 4; to-dos/estimator-money-word/README.md). A customer's word
-- that they paid (20261019080000, kind paid_claim) is useful at one moment, when the deposit lands, and in one other,
-- when nothing lands: the Accounts Receivable allocation names the claim's job for a deposit that fits, and after
-- seven days with nothing behind it the claim comes back to the person who heard it. This read hands both the live
-- claims the caller may read: every one for the office (can_read_payment_promises), their jobs' for the job's people
-- (is_job_people), each with its job, its customer and what landed on the job since the day they named. Nothing on
-- jobs_ledger's policies changes. Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.list_paid_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT e.*, j.hcp_number, j.click_number, j.job_name, j.status AS job_status, j.customer_id AS job_customer_id, j.customer_name AS job_customer_name,
           j.bid_id, j.account_manager_user_id
    FROM public.job_payment_promises e
    JOIN public.jobs_ledger j ON j.id = e.job_id
    WHERE e.voided_at IS NULL
      AND e.kind = 'paid_claim'
      AND (public.can_read_payment_promises() OR public.is_job_people(e.job_id))
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'jobId', l.job_id,
      'jobNumber', COALESCE(NULLIF(l.hcp_number, ''), NULLIF(l.click_number, ''), ''),
      'jobName', l.job_name,
      'jobStatus', l.job_status,
      'bidId', l.bid_id,
      'customerId', l.job_customer_id,
      'customerName', l.job_customer_name,
      'payerCustomerId', l.customer_id,
      'paidYmd', to_char(l.promised_date, 'YYYY-MM-DD'),
      'method', l.method,
      'amount', l.amount,
      'saidBy', l.said_by,
      'heardById', l.heard_by,
      'heardByName', CASE WHEN l.heard_by IS NULL THEN NULL ELSE COALESCE(NULLIF(trim(u.name), ''), 'office') END,
      'channel', l.channel,
      'note', l.note,
      'createdAt', l.created_at,
      -- What landed on the job on or after the day they named: the sum, and the latest day. Zero and null: nothing yet.
      'landedSince', COALESCE((SELECT SUM(p.amount) FROM public.jobs_ledger_payments p WHERE p.job_id = l.job_id AND p.paid_on >= l.promised_date), 0),
      'landedOn', (SELECT to_char(MAX(p.paid_on), 'YYYY-MM-DD') FROM public.jobs_ledger_payments p WHERE p.job_id = l.job_id AND p.paid_on >= l.promised_date)
    ) ORDER BY l.promised_date, l.created_at), '[]'::jsonb)
  FROM live l
  LEFT JOIN public.users u ON u.id = l.heard_by;
$$;

COMMENT ON FUNCTION public.list_paid_claims() IS
  'The live paid claims (punch list #129): every one for the promise readers, their jobs'' for the job''s people (is_job_people); each with its job, its customer, who heard it, and what landed on the job on or after the day they named. [] for nobody''s.';

REVOKE ALL ON FUNCTION public.list_paid_claims() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_paid_claims() TO authenticated, service_role;
