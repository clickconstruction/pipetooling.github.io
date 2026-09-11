-- Who pays the bill, PR 4 — the sweep (data only; run through psql, never as a migration).
-- Dry run first: leave ROLLBACK; check the counts; then swap in COMMIT.
BEGIN;

-- 1. Jobs entered with the GC as the customer row: the GC pays by definition.
--    Stamp the rule so it survives a later customer change (site owner restored).
WITH s AS (
  UPDATE public.jobs_ledger
     SET bill_to_party = 'gc'
   WHERE gc_customer_id IS NOT NULL
     AND gc_customer_id = customer_id
     AND bill_to_party = 'customer'
  RETURNING id
)
SELECT 'stamped gc-as-customer jobs' AS what, count(*) FROM s;

-- 2. Jobs with a distinct GC whose customer email is the GC's address (the
--    job-650 workaround): the GC was being billed all along — say so.
WITH s AS (
  UPDATE public.jobs_ledger j
     SET bill_to_party = 'gc'
    FROM public.customers g
   WHERE g.id = j.gc_customer_id
     AND j.gc_customer_id <> j.customer_id
     AND j.bill_to_party = 'customer'
     AND coalesce(j.customer_email, '') <> ''
     AND (lower(j.customer_email) = lower(coalesce(g.billing_email, ''))
          OR position(lower(j.customer_email) IN lower(coalesce(g.contact_info::text, ''))) > 0)
  RETURNING j.id, j.click_number, j.hcp_number
)
SELECT 'stamped gc-email-on-customer jobs' AS what, count(*) FROM s;

-- 3. Read-back
SELECT bill_to_party, count(*) FROM public.jobs_ledger GROUP BY 1 ORDER BY 1;

ROLLBACK;
