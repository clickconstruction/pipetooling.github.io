SET lock_timeout = '3s';

-- v2.5860: a bill's riders count no more than the bill's amount (punch list #105, the write-down cap).
--
-- apply_agreed_write_down_to_billed_invoice (20260927230000) lowers a bill's amount, but the bill's fee_lines entries
-- keep theirs. On a trip charge's bill — the bill IS the charge — the next rewrite of the revenue then put the whole
-- charge back in the job's total, and the waterfall attributed more to the bill than it holds. So job_rider_fees now
-- caps each bill's riders at that bill's amount: the entries on one bill are summed, and the sum counts up to
-- greatest(round(amount, 2), 0). A bill whose amount is null keeps today's count (there is nothing to cap at), and a
-- bill with no rider entry still counts nothing. The client twin is riderFeeLineCents
-- (src/lib/jobs/arReturnCaseFee.ts), capped the same way in the same change.
--
-- No table is created or altered, and no revenue row is rewritten: the write-down never lowered the revenue itself,
-- so the next rewrite of each affected job writes the capped figure, as every rewrite does. On 2026-10-25 production
-- held no written-down bill carrying a rider, so there is nothing to backfill.
--
-- The function keeps its signature, so CREATE OR REPLACE keeps its grants and its callers (Edit Job's billing save,
-- apply_job_discount, record_job_tip_from_deposit, add_collect_payment_fixture_from_job_book,
-- gc_owner_billing_revenue, and the primary-paid verbs of 20261019120000).

-- job_rider_fees, restated from 20261010044000: the same three kinds of fee_lines entry, summed per bill and capped
-- at the bill's amount.
CREATE OR REPLACE FUNCTION public.job_rider_fees(p_job_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT sum(h.fee_amount)
              FROM public.job_hazmat_incidents h
              WHERE h.job_id = p_job_id AND h.voided_at IS NULL), 0)
    + coalesce((SELECT sum(CASE WHEN b.amount IS NULL THEN b.riders
                                ELSE least(b.riders, greatest(round(b.amount, 2), 0)) END)
                FROM (
                  SELECT i.amount,
                         sum(CASE
                               WHEN ((jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '')
                                     OR (jsonb_typeof(l->'card_bill') = 'string' AND btrim(l->>'card_bill') <> '')
                                     OR (jsonb_typeof(l->'trip_charge') = 'string' AND btrim(l->>'trip_charge') <> ''))
                                AND (jsonb_typeof(l->'amount') = 'number'
                                     OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'))
                               THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                             END) AS riders
                  FROM public.jobs_ledger_invoices i
                  CROSS JOIN LATERAL jsonb_array_elements(
                    CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END
                  ) AS l
                  WHERE i.job_id = p_job_id
                  GROUP BY i.id
                ) AS b
                WHERE b.riders IS NOT NULL), 0)
$function$;

COMMENT ON FUNCTION public.job_rider_fees(uuid) IS
  'v2.5091, widened by v2.5113 and v2.5129, capped by v2.5860: the riders, the fees that ride on a job beyond its line items: its un-voided hazmat fees, every returned check fee on its bills (a jobs_ledger_invoices.fee_lines entry that names its case), every GC card fee (an entry that names its card bill) and every turnaway trip charge (an entry that names its trip charge). Each bill''s riders count no more than the bill''s amount, so a write-down trims them with it. Every rewrite of jobs_ledger.revenue from the line items adds it. The client twin is jobFormRiderFeesDollars.';
