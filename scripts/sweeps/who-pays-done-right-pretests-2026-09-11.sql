-- Who pays the bill — Done Right Foundation pays for pretests (owner decision 2026-09-11).
-- Data only; run through psql. Dry run first: leave ROLLBACK; check the counts; then swap in COMMIT.
--
-- "Pretest" is read from the job: a Done Right GC job whose revenue is at most
-- $450 (the $250 pretest and the $450 pinpoint) or whose name says test /
-- pretest / pinpoint. The 53 repair-priced jobs (> $450, all paid) stay on the
-- customer rule — the owner has not said who pays those.
BEGIN;

WITH s AS (
  UPDATE public.jobs_ledger j
     SET bill_to_party = 'gc'
    FROM public.customers g
   WHERE g.id = j.gc_customer_id
     AND g.name = 'Done Right Foundation'
     AND j.customer_id <> j.gc_customer_id
     AND j.bill_to_party = 'customer'
     AND (coalesce(j.revenue, 0) <= 450 OR j.job_name ~* 'pre ?-?test|pinpoint|test')
  RETURNING j.id
)
SELECT 'Done Right pretest-priced jobs → gc' AS what, count(*) FROM s;

-- Standing rule for new jobs (v2.3353 adds customers.gc_pays_by_default): once
-- that column exists, every new job with Done Right as the GC starts on GC pays.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'gc_pays_by_default') THEN
    EXECUTE $q$ UPDATE public.customers SET gc_pays_by_default = true WHERE name = 'Done Right Foundation' $q$;
    RAISE NOTICE 'Done Right Foundation: gc_pays_by_default = true';
  ELSE
    RAISE NOTICE 'customers.gc_pays_by_default not present yet — re-run this script after v2.3353 is pushed to set the standing rule';
  END IF;
END $$;

SELECT bill_to_party, count(*) FROM public.jobs_ledger GROUP BY 1 ORDER BY 1;

ROLLBACK;
