-- Share this bill — Done Right Foundation sees its customers' repair bills (owner decision 2026-09-13).
-- Data only; run through psql. Dry run first: leave ROLLBACK; check the counts; then swap in COMMIT.
--
-- Three things, all keyed to the Done Right customers row:
--   1. the card flag (v2.3377): every NEW job naming Done Right as GC starts with its memory on;
--   2. the memory on Done Right's OPEN owner-paid jobs (customer distinct, Bills go to: customer,
--      not paid): Bill Customer's tick starts ticked on their next bills;
--   3. the stamp on the billed, unpaid invoices of those jobs: Done Right's portal lists them under
--      "Your customers' open bills" without anyone re-sending. Pretests (Bills go to: GC) are
--      Done Right's own bills and are untouched; paid jobs are untouched (nothing to show).
--
-- Every write is limited to rows the reader can see with the portal rule (customer <> gc,
-- bill_to_party = 'customer', no typed bill_to_email, status billed). Re-runnable: the
-- UPDATEs only touch rows not already set.
BEGIN;

WITH g AS (SELECT id FROM public.customers WHERE name = 'Done Right Foundation' AND archived_at IS NULL LIMIT 1),
c AS (
  UPDATE public.customers SET sees_customer_bills = true
   WHERE id = (SELECT id FROM g) AND sees_customer_bills = false
  RETURNING id
)
SELECT 'Done Right: sees_customer_bills → true' AS what, count(*) FROM c;

WITH g AS (SELECT id FROM public.customers WHERE name = 'Done Right Foundation' AND archived_at IS NULL LIMIT 1),
j AS (
  UPDATE public.jobs_ledger j
     SET show_bills_to_other_party = true
   WHERE j.gc_customer_id = (SELECT id FROM g)
     AND j.customer_id IS NOT NULL
     AND j.customer_id <> j.gc_customer_id
     AND j.bill_to_party = 'customer'
     AND j.status IS DISTINCT FROM 'paid'
     AND j.show_bills_to_other_party = false
  RETURNING j.id
)
SELECT 'Done Right open owner-paid jobs: memory → on' AS what, count(*) FROM j;

WITH g AS (SELECT id FROM public.customers WHERE name = 'Done Right Foundation' AND archived_at IS NULL LIMIT 1),
i AS (
  UPDATE public.jobs_ledger_invoices i
     SET shown_to_party = 'gc'
    FROM public.jobs_ledger j
   WHERE j.id = i.job_id
     AND j.gc_customer_id = (SELECT id FROM g)
     AND j.customer_id IS NOT NULL
     AND j.customer_id <> j.gc_customer_id
     AND j.bill_to_party = 'customer'
     AND j.status IS DISTINCT FROM 'paid'
     AND i.status = 'billed'
     AND i.bill_to_party IS DISTINCT FROM 'gc'
     AND NULLIF(trim(coalesce(i.bill_to_email, '')), '') IS NULL
     AND i.shown_to_party IS NULL
  RETURNING i.id
)
SELECT 'Done Right owner-paid billed invoices: shown_to_party → gc' AS what, count(*) FROM i;

-- Read-back: what Done Right's portal will list.
SELECT j.hcp_number, j.customer_name, j.status, i.amount, i.billed_at::date, i.shown_to_party
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
 WHERE j.gc_customer_id = (SELECT id FROM public.customers WHERE name = 'Done Right Foundation' AND archived_at IS NULL LIMIT 1)
   AND i.shown_to_party = 'gc'
 ORDER BY i.billed_at;

ROLLBACK;
